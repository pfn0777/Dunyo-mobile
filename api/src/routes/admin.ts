// /api/admin/* — every route requires admin_users on every request
// (requireAdmin, re-checked fresh — never trusted from the client). The
// /admins* routes additionally require role='owner', checked before the
// general admin branch runs (via a route-scoped preHandler on top of the
// plugin-wide admin check).
//
// Every mutation writes an audit_log row with before/after, EXCEPT order
// status changes: set_order_status (db/migrations/0003_rpc.sql) already
// writes its own audit_log row inside the same transaction as the status
// change, so writing a second one here would double-log every transition.

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import {
  IMPORT_BATCH_SIZE,
  IMPORT_MAX_FILE_BYTES,
  IMPORT_MAX_ROWS,
  validateImportRow,
  type ImportedVariantRow,
} from '@dunyo/shared';
import { decideAdminDeletion } from '../lib/adminDeletion.js';
import { requireAdmin, requireOwner, type AdminRole, type AuthenticatedUser } from '../lib/auth.js';
import { errorResult } from '../lib/http.js';
import { toNullableNumber, toNumber } from '../lib/money.js';
import { buildKnownNameMap } from '../lib/importKnownMaps.js';
import { importProductRow, type ProductImportStore } from '../lib/productImport.js';
import { setOrderStatusRpc, PgRpcError, type Db } from '../lib/db.js';
import { notifyOrderStatusChanged } from '../lib/orderNotify.js';
import { decideFieldUpload } from '../lib/uploadField.js';
import { buildVariantImagePaths, deleteFiles, sha256Hex, writeWebp } from '../lib/storage.js';
import {
  isOrderStatus,
  isPlainObject,
  parsePositiveIntegerId,
  validateAdminWriteBody,
  validateBannerPatchBody,
  validateBannerWriteBody,
  validateBrandWriteBody,
  validateImportRequestBody,
  validateOrderStatusBody,
  validateProductWriteBody,
  validateRegionWriteBody,
  validateSettingsWriteBody,
  validateVariantWriteBody,
} from '../lib/validators.js';

declare module 'fastify' {
  interface FastifyRequest {
    admin?: { user: AuthenticatedUser; role: AdminRole };
  }
}

const PAGE_SIZE = 20;

function sendError(reply: FastifyReply, code: string, message: string, status: number, details?: Record<string, unknown>): FastifyReply {
  const result = errorResult(code, message, status, details);
  return reply.code(result.status).send(result.body);
}

function pageFromQuery(raw: string | undefined): number {
  const parsed = raw !== undefined ? Number.parseInt(raw, 10) : 1;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

async function writeAudit(
  db: Db,
  adminId: number,
  action: string,
  entity: string,
  entityId: number | null,
  before: unknown,
  after: unknown,
): Promise<void> {
  try {
    await db.query(
      'insert into audit_log (admin_id, action, entity, entity_id, before, after) values ($1, $2, $3, $4, $5, $6)',
      [adminId, action, entity, entityId, before ?? null, after ?? null],
    );
  } catch (error) {
    console.error('writeAudit failed', error);
  }
}

interface CollectedFile {
  mimetype: string;
  buffer: Buffer;
  truncated: boolean;
}

async function collectMultipartFiles(request: FastifyRequest): Promise<Map<string, CollectedFile>> {
  const result = new Map<string, CollectedFile>();
  for await (const part of request.parts()) {
    if (part.type === 'file') {
      const buffer = await part.toBuffer();
      result.set(part.fieldname, { mimetype: part.mimetype, buffer, truncated: part.file.truncated === true });
    }
  }
  return result;
}

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  const db = fastify.db;
  const env = fastify.env;

  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = (request.headers.authorization as string | undefined) ?? null;
    const result = await requireAdmin(authHeader, db, env.TELEGRAM_BOT_TOKEN, env.INIT_DATA_MAX_AGE_SEC);
    if (!result.ok) {
      const status = result.reason === 'unauthenticated' ? 401 : 403;
      const code = result.reason === 'unauthenticated' ? 'auth_invalid' : 'forbidden';
      return sendError(reply, code, 'Admin access required', status);
    }
    request.admin = { user: result.user, role: result.role };
  });

  async function requireOwnerHook(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | undefined> {
    if (request.admin!.role !== 'owner') {
      return sendError(reply, 'forbidden', 'Owner access required', 403);
    }
    return undefined;
  }

  // ---------------------------------------------------------------------
  // Products
  // ---------------------------------------------------------------------

  fastify.get('/products', async (request, reply) => {
    const query = request.query as { page?: string; q?: string; category_id?: string; brand_id?: string };
    const page = pageFromQuery(query.page);
    const offset = (page - 1) * PAGE_SIZE;
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (query.q !== undefined && query.q.trim().length > 0) {
      params.push(`%${query.q.trim()}%`);
      conditions.push(`name ilike $${params.length}`);
    }
    if (query.category_id !== undefined) {
      const id = parsePositiveIntegerId(query.category_id);
      if (id !== null) {
        params.push(id);
        conditions.push(`category_id = $${params.length}`);
      }
    }
    if (query.brand_id !== undefined) {
      const id = parsePositiveIntegerId(query.brand_id);
      if (id !== null) {
        params.push(id);
        conditions.push(`brand_id = $${params.length}`);
      }
    }
    const whereSql = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';

    const countRow = await db.queryOne<{ total: string }>(`select count(*) as total from products ${whereSql}`, params);
    const rows = await db.query(
      `select * from products ${whereSql} order by id desc limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, PAGE_SIZE, offset],
    );
    return reply.code(200).send({ items: rows, total: countRow ? toNumber(countRow.total) : 0, page, page_size: PAGE_SIZE });
  });

  fastify.get('/products/:id', async (request, reply) => {
    const id = parsePositiveIntegerId((request.params as { id: string }).id);
    if (id === null) return sendError(reply, 'bad_request', 'Invalid product id', 400);
    const row = await db.queryOne('select * from products where id = $1', [id]);
    if (row === null) return sendError(reply, 'not_found', 'Product not found', 404);
    return reply.code(200).send(row);
  });

  fastify.post('/products', async (request, reply) => {
    const admin = request.admin!.user;
    const result = validateProductWriteBody(request.body);
    if (!result.ok) return sendError(reply, result.code, 'Invalid product', 422);
    const row = await db.queryOne<{ id: number }>(
      `insert into products (name, brand_id, category_id, warranty_months, description, specs, is_active)
       values ($1,$2,$3,$4,$5,$6,$7) returning *`,
      [
        result.value.name,
        result.value.brandId,
        result.value.categoryId,
        result.value.warrantyMonths,
        result.value.description,
        JSON.stringify(result.value.specs),
        result.value.isActive,
      ],
    );
    if (row === null) return sendError(reply, 'internal', 'Failed to create product', 500);
    await writeAudit(db, admin.id, 'product_create', 'products', row.id, null, row);
    return reply.code(201).send(row);
  });

  fastify.patch('/products/:id', async (request, reply) => {
    const admin = request.admin!.user;
    const id = parsePositiveIntegerId((request.params as { id: string }).id);
    if (id === null) return sendError(reply, 'bad_request', 'Invalid product id', 400);
    const result = validateProductWriteBody(request.body);
    if (!result.ok) return sendError(reply, result.code, 'Invalid product', 422);
    const before = await db.queryOne('select * from products where id = $1', [id]);
    if (before === null) return sendError(reply, 'not_found', 'Product not found', 404);
    const after = await db.queryOne(
      `update products set name=$1, brand_id=$2, category_id=$3, warranty_months=$4, description=$5, specs=$6, is_active=$7
       where id = $8 returning *`,
      [
        result.value.name,
        result.value.brandId,
        result.value.categoryId,
        result.value.warrantyMonths,
        result.value.description,
        JSON.stringify(result.value.specs),
        result.value.isActive,
        id,
      ],
    );
    if (after === null) return sendError(reply, 'internal', 'Failed to update product', 500);
    await writeAudit(db, admin.id, 'product_update', 'products', id, before, after);
    return reply.code(200).send(after);
  });

  fastify.delete('/products/:id', async (request, reply) => {
    const admin = request.admin!.user;
    const id = parsePositiveIntegerId((request.params as { id: string }).id);
    if (id === null) return sendError(reply, 'bad_request', 'Invalid product id', 400);
    const before = await db.queryOne('select * from products where id = $1', [id]);
    if (before === null) return sendError(reply, 'not_found', 'Product not found', 404);
    const after = await db.queryOne('update products set is_active = false where id = $1 returning *', [id]);
    await writeAudit(db, admin.id, 'product_delete', 'products', id, before, after);
    return reply.code(200).send({ ok: true });
  });

  // ---------------------------------------------------------------------
  // Product import (Excel, rows already parsed client-side to JSON)
  // ---------------------------------------------------------------------

  fastify.post('/products/import', async (request, reply) => {
    const admin = request.admin!.user;
    const result = validateImportRequestBody(request.body, IMPORT_MAX_ROWS);
    if (!result.ok) return sendError(reply, result.code, 'Invalid import request', 422);
    const encodedSize = Buffer.byteLength(JSON.stringify(result.value.rows));
    if (encodedSize > IMPORT_MAX_FILE_BYTES) {
      return sendError(reply, 'file_too_large', 'Import payload too large', 422);
    }

    const brands = await db.query<{ id: number; name: string }>('select id, name from brands');
    const categories = await db.query<{ id: number; name: string }>('select id, name from categories');
    const knownBrands = buildKnownNameMap(brands);
    const knownCategories = buildKnownNameMap(categories);

    const store: ProductImportStore = {
      async findOrCreateProductId(row: ImportedVariantRow) {
        const existing = await db.queryOne<{ id: number }>(
          'select id from products where name = $1 and brand_id = $2',
          [row.name, row.brandId],
        );
        if (existing !== null) return { id: existing.id, error: null };
        try {
          const created = await db.queryOne<{ id: number }>(
            'insert into products (name, brand_id, category_id, warranty_months) values ($1,$2,$3,$4) returning id',
            [row.name, row.brandId, row.categoryId, row.warrantyMonths],
          );
          return created !== null ? { id: created.id, error: null } : { id: null, error: 'insert returned no id' };
        } catch (error) {
          return { id: null, error: error instanceof Error ? error.message : 'product insert failed' };
        }
      },
      async findVariantId(productId: number, row: ImportedVariantRow) {
        try {
          if (row.sku !== null) {
            const existing = await db.queryOne<{ id: number }>('select id from product_variants where sku = $1', [row.sku]);
            return { id: existing?.id ?? null, error: null };
          }
          const existing = await db.queryOne<{ id: number }>(
            `select id from product_variants
             where product_id = $1 and color_name = $2 and storage_gb is not distinct from $3`,
            [productId, row.colorName, row.storageGb],
          );
          return { id: existing?.id ?? null, error: null };
        } catch (error) {
          return { id: null, error: error instanceof Error ? error.message : 'variant lookup failed' };
        }
      },
      async updateVariant(variantId: number, _productId: number, row: ImportedVariantRow) {
        try {
          await db.query(
            `update product_variants set sku=$1, color_name=$2, storage_gb=$3, price=$4, old_price=$5, stock=$6
             where id = $7`,
            [row.sku, row.colorName, row.storageGb, row.price, row.oldPrice, row.stock, variantId],
          );
          return null;
        } catch (error) {
          return error instanceof Error ? error.message : 'variant update failed';
        }
      },
      async insertVariant(productId: number, row: ImportedVariantRow) {
        try {
          await db.query(
            `insert into product_variants (product_id, sku, color_name, storage_gb, price, old_price, stock)
             values ($1,$2,$3,$4,$5,$6,$7)`,
            [productId, row.sku, row.colorName, row.storageGb, row.price, row.oldPrice, row.stock],
          );
          return null;
        } catch (error) {
          return error instanceof Error ? error.message : 'variant insert failed';
        }
      },
    };

    let created = 0;
    let updated = 0;
    const rowErrors: { rowNumber: number; errors: string[] }[] = [];

    for (let batchStart = 0; batchStart < result.value.rows.length; batchStart += IMPORT_BATCH_SIZE) {
      const batch = result.value.rows.slice(batchStart, batchStart + IMPORT_BATCH_SIZE);
      for (let i = 0; i < batch.length; i += 1) {
        const rowNumber = batchStart + i + 1;
        const validated = validateImportRow(batch[i]!, rowNumber, knownBrands, knownCategories);
        if (!validated.ok) {
          rowErrors.push({ rowNumber: validated.rowNumber, errors: validated.errors });
          continue;
        }
        const outcome = await importProductRow(store, validated.value);
        if (outcome.kind === 'failed') {
          rowErrors.push({ rowNumber, errors: [outcome.error] });
        } else if (outcome.kind === 'updated') {
          updated += 1;
        } else {
          created += 1;
        }
      }
    }

    await writeAudit(db, admin.id, 'product_import', 'products', null, null, {
      file_name: result.value.fileName,
      created,
      updated,
      errors: rowErrors.length,
    });

    return reply.code(200).send({ created, updated, errors: rowErrors });
  });

  // ---------------------------------------------------------------------
  // Variants
  // ---------------------------------------------------------------------

  fastify.get('/products/:id/variants', async (request, reply) => {
    const productId = parsePositiveIntegerId((request.params as { id: string }).id);
    if (productId === null) return sendError(reply, 'bad_request', 'Invalid product id', 400);
    const rows = await db.query<Record<string, unknown>>(
      'select * from product_variants where product_id = $1 order by sort_order asc, id asc',
      [productId],
    );
    return reply.code(200).send({
      items: rows.map((r) => ({
        ...r,
        price: toNumber(r['price'] as string | number),
        old_price: toNullableNumber(r['old_price'] as string | number | null),
      })),
    });
  });

  fastify.post('/products/:id/variants', async (request, reply) => {
    const admin = request.admin!.user;
    const productId = parsePositiveIntegerId((request.params as { id: string }).id);
    if (productId === null) return sendError(reply, 'bad_request', 'Invalid product id', 400);
    const result = validateVariantWriteBody(request.body);
    if (!result.ok) return sendError(reply, result.code, 'Invalid variant', 422);
    const product = await db.queryOne('select id from products where id = $1', [productId]);
    if (product === null) return sendError(reply, 'not_found', 'Product not found', 404);
    const row = await db.queryOne<Record<string, unknown>>(
      `insert into product_variants (product_id, sku, color_name, color_hex, storage_gb, price, old_price, stock, sort_order, is_active)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
      [
        productId,
        result.value.sku,
        result.value.colorName,
        result.value.colorHex,
        result.value.storageGb,
        result.value.price,
        result.value.oldPrice,
        result.value.stock,
        result.value.sortOrder,
        result.value.isActive,
      ],
    );
    if (row === null) return sendError(reply, 'internal', 'Failed to create variant', 500);
    await writeAudit(db, admin.id, 'variant_create', 'product_variants', row['id'] as number, null, row);
    return reply.code(201).send(row);
  });

  fastify.patch('/variants/:id', async (request, reply) => {
    const admin = request.admin!.user;
    const id = parsePositiveIntegerId((request.params as { id: string }).id);
    if (id === null) return sendError(reply, 'bad_request', 'Invalid variant id', 400);
    const result = validateVariantWriteBody(request.body);
    if (!result.ok) return sendError(reply, result.code, 'Invalid variant', 422);
    const before = await db.queryOne('select * from product_variants where id = $1', [id]);
    if (before === null) return sendError(reply, 'not_found', 'Variant not found', 404);
    const after = await db.queryOne(
      `update product_variants set sku=$1, color_name=$2, color_hex=$3, storage_gb=$4, price=$5, old_price=$6,
              stock=$7, sort_order=$8, is_active=$9
       where id = $10 returning *`,
      [
        result.value.sku,
        result.value.colorName,
        result.value.colorHex,
        result.value.storageGb,
        result.value.price,
        result.value.oldPrice,
        result.value.stock,
        result.value.sortOrder,
        result.value.isActive,
        id,
      ],
    );
    if (after === null) return sendError(reply, 'internal', 'Failed to update variant', 500);
    await writeAudit(db, admin.id, 'variant_update', 'product_variants', id, before, after);
    return reply.code(200).send(after);
  });

  fastify.delete('/variants/:id', async (request, reply) => {
    const admin = request.admin!.user;
    const id = parsePositiveIntegerId((request.params as { id: string }).id);
    if (id === null) return sendError(reply, 'bad_request', 'Invalid variant id', 400);
    const before = await db.queryOne('select * from product_variants where id = $1', [id]);
    if (before === null) return sendError(reply, 'not_found', 'Variant not found', 404);
    const after = await db.queryOne('update product_variants set is_active = false where id = $1 returning *', [id]);
    await writeAudit(db, admin.id, 'variant_delete', 'product_variants', id, before, after);
    return reply.code(200).send({ ok: true });
  });

  fastify.post('/variants/:id/image', async (request, reply) => {
    const admin = request.admin!.user;
    const id = parsePositiveIntegerId((request.params as { id: string }).id);
    if (id === null) return sendError(reply, 'bad_request', 'Invalid variant id', 400);
    const before = await db.queryOne<{ image_thumb_path: string | null; image_path: string | null }>(
      'select image_thumb_path, image_path from product_variants where id = $1',
      [id],
    );
    if (before === null) return sendError(reply, 'not_found', 'Variant not found', 404);

    const files = await collectMultipartFiles(request);
    const thumbFile = files.get('thumb') ?? null;
    const mainFile = files.get('main') ?? null;

    const thumbResult = decideFieldUpload(
      'thumb',
      thumbFile ? { mimetype: thumbFile.mimetype, size: thumbFile.buffer.length, truncated: thumbFile.truncated } : null,
      thumbFile?.buffer ?? null,
    );
    if (!thumbResult.ok) return sendError(reply, thumbResult.code, 'Invalid thumb image', 422);
    const mainResult = decideFieldUpload(
      'main',
      mainFile ? { mimetype: mainFile.mimetype, size: mainFile.buffer.length, truncated: mainFile.truncated } : null,
      mainFile?.buffer ?? null,
    );
    if (!mainResult.ok) return sendError(reply, mainResult.code, 'Invalid main image', 422);

    // One hash over both bytes together, so the pathname changes whenever
    // either image in the pair changes (matches storage.ts's "<hash>-thumb"/
    // "<hash>-main" scheme, which shares a single hash across both files).
    const combined = new Uint8Array(thumbResult.bytes.length + mainResult.bytes.length);
    combined.set(thumbResult.bytes, 0);
    combined.set(mainResult.bytes, thumbResult.bytes.length);
    const hash = await sha256Hex(combined);
    const paths = buildVariantImagePaths(id, hash);
    await writeWebp(env.MEDIA_DIR, paths.thumb, thumbResult.bytes);
    await writeWebp(env.MEDIA_DIR, paths.main, mainResult.bytes);

    const after = await db.queryOne(
      'update product_variants set image_thumb_path = $1, image_path = $2 where id = $3 returning *',
      [paths.thumb, paths.main, id],
    );
    if (after === null) return sendError(reply, 'internal', 'Failed to save image paths', 500);

    await deleteFiles(
      env.MEDIA_DIR,
      [before.image_thumb_path, before.image_path].filter((p): p is string => p !== null),
    );
    await writeAudit(db, admin.id, 'variant_image', 'product_variants', id, before, {
      image_thumb_path: paths.thumb,
      image_path: paths.main,
    });
    return reply.code(200).send(after);
  });

  // ---------------------------------------------------------------------
  // Categories (no shared validator; a category is name + icon/image + order)
  // ---------------------------------------------------------------------

  fastify.get('/categories', async (_request, reply) => {
    const rows = await db.query('select * from categories order by sort_order asc, id asc');
    return reply.code(200).send({ items: rows });
  });

  fastify.post('/categories', async (request, reply) => {
    const admin = request.admin!.user;
    const body = request.body;
    if (!isPlainObject(body) || typeof body['name'] !== 'string' || body['name'].trim().length === 0) {
      return sendError(reply, 'invalid_name', 'Invalid category', 422);
    }
    const icon = typeof body['icon'] === 'string' ? body['icon'] : null;
    const sortOrder = typeof body['sort_order'] === 'number' ? body['sort_order'] : 0;
    const isActive = body['is_active'] !== false;
    const row = await db.queryOne(
      'insert into categories (name, icon, sort_order, is_active) values ($1,$2,$3,$4) returning *',
      [body['name'].trim(), icon, sortOrder, isActive],
    );
    await writeAudit(db, admin.id, 'category_create', 'categories', (row as { id: number } | null)?.id ?? null, null, row);
    return reply.code(201).send(row);
  });

  fastify.patch('/categories/:id', async (request, reply) => {
    const admin = request.admin!.user;
    const id = parsePositiveIntegerId((request.params as { id: string }).id);
    if (id === null) return sendError(reply, 'bad_request', 'Invalid category id', 400);
    const body = request.body;
    if (!isPlainObject(body)) return sendError(reply, 'bad_request', 'Invalid JSON body', 400);
    const before = await db.queryOne('select * from categories where id = $1', [id]);
    if (before === null) return sendError(reply, 'not_found', 'Category not found', 404);
    const update: Record<string, unknown> = {};
    if (typeof body['name'] === 'string' && body['name'].trim().length > 0) update['name'] = body['name'].trim();
    if ('icon' in body) update['icon'] = body['icon'];
    if (typeof body['sort_order'] === 'number') update['sort_order'] = body['sort_order'];
    if (typeof body['is_active'] === 'boolean') update['is_active'] = body['is_active'];
    if (Object.keys(update).length === 0) return reply.code(200).send(before);
    const setSql = Object.keys(update).map((key, i) => `${key} = $${i + 2}`).join(', ');
    const after = await db.queryOne(`update categories set ${setSql} where id = $1 returning *`, [
      id,
      ...Object.values(update),
    ]);
    await writeAudit(db, admin.id, 'category_update', 'categories', id, before, after);
    return reply.code(200).send(after);
  });

  fastify.delete('/categories/:id', async (request, reply) => {
    const admin = request.admin!.user;
    const id = parsePositiveIntegerId((request.params as { id: string }).id);
    if (id === null) return sendError(reply, 'bad_request', 'Invalid category id', 400);
    const before = await db.queryOne('select * from categories where id = $1', [id]);
    if (before === null) return sendError(reply, 'not_found', 'Category not found', 404);
    const after = await db.queryOne('update categories set is_active = false where id = $1 returning *', [id]);
    await writeAudit(db, admin.id, 'category_delete', 'categories', id, before, after);
    return reply.code(200).send({ ok: true });
  });

  // ---------------------------------------------------------------------
  // Brands
  // ---------------------------------------------------------------------

  fastify.get('/brands', async (_request, reply) => {
    const rows = await db.query('select * from brands order by sort_order asc, id asc');
    return reply.code(200).send({ items: rows });
  });

  fastify.post('/brands', async (request, reply) => {
    const admin = request.admin!.user;
    const result = validateBrandWriteBody(request.body);
    if (!result.ok) return sendError(reply, result.code, 'Invalid brand', 422);
    const row = await db.queryOne(
      'insert into brands (name, sort_order, is_active) values ($1,$2,$3) returning *',
      [result.value.name, result.value.sortOrder, result.value.isActive],
    );
    await writeAudit(db, admin.id, 'brand_create', 'brands', (row as { id: number } | null)?.id ?? null, null, row);
    return reply.code(201).send(row);
  });

  fastify.patch('/brands/:id', async (request, reply) => {
    const admin = request.admin!.user;
    const id = parsePositiveIntegerId((request.params as { id: string }).id);
    if (id === null) return sendError(reply, 'bad_request', 'Invalid brand id', 400);
    const result = validateBrandWriteBody(request.body);
    if (!result.ok) return sendError(reply, result.code, 'Invalid brand', 422);
    const before = await db.queryOne('select * from brands where id = $1', [id]);
    if (before === null) return sendError(reply, 'not_found', 'Brand not found', 404);
    const after = await db.queryOne('update brands set name=$1, sort_order=$2, is_active=$3 where id=$4 returning *', [
      result.value.name,
      result.value.sortOrder,
      result.value.isActive,
      id,
    ]);
    await writeAudit(db, admin.id, 'brand_update', 'brands', id, before, after);
    return reply.code(200).send(after);
  });

  fastify.delete('/brands/:id', async (request, reply) => {
    const admin = request.admin!.user;
    const id = parsePositiveIntegerId((request.params as { id: string }).id);
    if (id === null) return sendError(reply, 'bad_request', 'Invalid brand id', 400);
    const before = await db.queryOne('select * from brands where id = $1', [id]);
    if (before === null) return sendError(reply, 'not_found', 'Brand not found', 404);
    const after = await db.queryOne('update brands set is_active = false where id = $1 returning *', [id]);
    await writeAudit(db, admin.id, 'brand_delete', 'brands', id, before, after);
    return reply.code(200).send({ ok: true });
  });

  // ---------------------------------------------------------------------
  // Regions
  // ---------------------------------------------------------------------

  fastify.get('/regions', async (_request, reply) => {
    const rows = await db.query<Record<string, unknown>>('select * from regions order by sort_order asc, id asc');
    return reply.code(200).send({
      items: rows.map((r) => ({
        ...r,
        delivery_fee: toNumber(r['delivery_fee'] as string | number),
        free_delivery_threshold: toNullableNumber(r['free_delivery_threshold'] as string | number | null),
      })),
    });
  });

  fastify.post('/regions', async (request, reply) => {
    const admin = request.admin!.user;
    const result = validateRegionWriteBody(request.body);
    if (!result.ok) return sendError(reply, result.code, 'Invalid region', 422);
    const row = await db.queryOne(
      `insert into regions (name, delivery_fee, eta_text, free_delivery_threshold, sort_order, is_active)
       values ($1,$2,$3,$4,$5,$6) returning *`,
      [
        result.value.name,
        result.value.deliveryFee,
        result.value.etaText,
        result.value.freeDeliveryThreshold,
        result.value.sortOrder,
        result.value.isActive,
      ],
    );
    await writeAudit(db, admin.id, 'region_create', 'regions', (row as { id: number } | null)?.id ?? null, null, row);
    return reply.code(201).send(row);
  });

  fastify.patch('/regions/:id', async (request, reply) => {
    const admin = request.admin!.user;
    const id = parsePositiveIntegerId((request.params as { id: string }).id);
    if (id === null) return sendError(reply, 'bad_request', 'Invalid region id', 400);
    const result = validateRegionWriteBody(request.body);
    if (!result.ok) return sendError(reply, result.code, 'Invalid region', 422);
    const before = await db.queryOne('select * from regions where id = $1', [id]);
    if (before === null) return sendError(reply, 'not_found', 'Region not found', 404);
    const after = await db.queryOne(
      `update regions set name=$1, delivery_fee=$2, eta_text=$3, free_delivery_threshold=$4, sort_order=$5, is_active=$6
       where id = $7 returning *`,
      [
        result.value.name,
        result.value.deliveryFee,
        result.value.etaText,
        result.value.freeDeliveryThreshold,
        result.value.sortOrder,
        result.value.isActive,
        id,
      ],
    );
    await writeAudit(db, admin.id, 'region_update', 'regions', id, before, after);
    return reply.code(200).send(after);
  });

  fastify.delete('/regions/:id', async (request, reply) => {
    const admin = request.admin!.user;
    const id = parsePositiveIntegerId((request.params as { id: string }).id);
    if (id === null) return sendError(reply, 'bad_request', 'Invalid region id', 400);
    const before = await db.queryOne('select * from regions where id = $1', [id]);
    if (before === null) return sendError(reply, 'not_found', 'Region not found', 404);
    const after = await db.queryOne('update regions set is_active = false where id = $1 returning *', [id]);
    await writeAudit(db, admin.id, 'region_delete', 'regions', id, before, after);
    return reply.code(200).send({ ok: true });
  });

  // ---------------------------------------------------------------------
  // Banners
  // ---------------------------------------------------------------------

  fastify.get('/banners', async (_request, reply) => {
    const rows = await db.query('select * from banners order by sort_order asc, id asc');
    return reply.code(200).send({ items: rows });
  });

  fastify.post('/banners', async (request, reply) => {
    const admin = request.admin!.user;
    const result = validateBannerWriteBody(request.body);
    if (!result.ok) return sendError(reply, result.code, 'Invalid banner', 422);
    const row = await db.queryOne(
      `insert into banners (image_path, title, subtitle, link_type, link_id, sort_order, is_active)
       values (null, $1,$2,$3,$4,$5,$6) returning *`,
      [
        result.value.title,
        result.value.subtitle,
        result.value.linkType,
        result.value.linkId,
        result.value.sortOrder,
        result.value.isActive,
      ],
    );
    await writeAudit(db, admin.id, 'banner_create', 'banners', (row as { id: number } | null)?.id ?? null, null, row);
    return reply.code(201).send(row);
  });

  fastify.patch('/banners/:id', async (request, reply) => {
    const admin = request.admin!.user;
    const id = parsePositiveIntegerId((request.params as { id: string }).id);
    if (id === null) return sendError(reply, 'bad_request', 'Invalid banner id', 400);
    const result = validateBannerPatchBody(request.body);
    if (!result.ok) return sendError(reply, result.code, 'Invalid banner', 422);
    const before = await db.queryOne('select * from banners where id = $1', [id]);
    if (before === null) return sendError(reply, 'not_found', 'Banner not found', 404);
    const update: Record<string, unknown> = {};
    if (result.value.title !== undefined) update['title'] = result.value.title;
    if (result.value.subtitle !== undefined) update['subtitle'] = result.value.subtitle;
    if (result.value.linkType !== undefined) update['link_type'] = result.value.linkType;
    if (result.value.linkId !== undefined) update['link_id'] = result.value.linkId;
    if (result.value.sortOrder !== undefined) update['sort_order'] = result.value.sortOrder;
    if (result.value.isActive !== undefined) update['is_active'] = result.value.isActive;
    if (Object.keys(update).length === 0) return reply.code(200).send(before);
    const setSql = Object.keys(update).map((key, i) => `${key} = $${i + 2}`).join(', ');
    const after = await db.queryOne(`update banners set ${setSql} where id = $1 returning *`, [
      id,
      ...Object.values(update),
    ]);
    await writeAudit(db, admin.id, 'banner_update', 'banners', id, before, after);
    return reply.code(200).send(after);
  });

  fastify.delete('/banners/:id', async (request, reply) => {
    const admin = request.admin!.user;
    const id = parsePositiveIntegerId((request.params as { id: string }).id);
    if (id === null) return sendError(reply, 'bad_request', 'Invalid banner id', 400);
    const before = await db.queryOne('select * from banners where id = $1', [id]);
    if (before === null) return sendError(reply, 'not_found', 'Banner not found', 404);
    const after = await db.queryOne('update banners set is_active = false where id = $1 returning *', [id]);
    await writeAudit(db, admin.id, 'banner_delete', 'banners', id, before, after);
    return reply.code(200).send({ ok: true });
  });

  fastify.post('/banners/:id/image', async (request, reply) => {
    const admin = request.admin!.user;
    const id = parsePositiveIntegerId((request.params as { id: string }).id);
    if (id === null) return sendError(reply, 'bad_request', 'Invalid banner id', 400);
    const before = await db.queryOne<{ image_path: string | null }>('select image_path from banners where id = $1', [id]);
    if (before === null) return sendError(reply, 'not_found', 'Banner not found', 404);

    const files = await collectMultipartFiles(request);
    const imageFile = files.get('image') ?? null;
    const imageResult = decideFieldUpload(
      'image',
      imageFile ? { mimetype: imageFile.mimetype, size: imageFile.buffer.length, truncated: imageFile.truncated } : null,
      imageFile?.buffer ?? null,
    );
    if (!imageResult.ok) return sendError(reply, imageResult.code, 'Invalid banner image', 422);

    const hash = await sha256Hex(imageResult.bytes);
    const relPath = `banners/${id}/${hash}.webp`;
    await writeWebp(env.MEDIA_DIR, relPath, imageResult.bytes);

    const after = await db.queryOne('update banners set image_path = $1 where id = $2 returning *', [relPath, id]);
    if (after === null) return sendError(reply, 'internal', 'Failed to save banner image', 500);

    if (before.image_path !== null) {
      await deleteFiles(env.MEDIA_DIR, [before.image_path]);
    }
    await writeAudit(db, admin.id, 'banner_image', 'banners', id, before, { image_path: relPath });
    return reply.code(200).send(after);
  });

  // ---------------------------------------------------------------------
  // Orders
  // ---------------------------------------------------------------------

  fastify.get('/orders', async (request, reply) => {
    const query = request.query as { page?: string; status?: string; region_id?: string };
    const page = pageFromQuery(query.page);
    const offset = (page - 1) * PAGE_SIZE;
    const conditions: string[] = [];
    const params: unknown[] = [];
    // An unrecognized status string is silently ignored (no filter applied)
    // rather than passed to SQL: casting junk to public.order_status raises
    // Postgres 22P02, which must never surface as a 500.
    if (query.status !== undefined && isOrderStatus(query.status)) {
      params.push(query.status);
      conditions.push(`o.status = $${params.length}::public.order_status`);
    }
    if (query.region_id !== undefined) {
      const id = parsePositiveIntegerId(query.region_id);
      if (id !== null) {
        params.push(id);
        conditions.push(`o.region_id = $${params.length}`);
      }
    }
    const whereSql = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
    const countRow = await db.queryOne<{ total: string }>(`select count(*) as total from orders o ${whereSql}`, params);
    const rows = await db.query<Record<string, unknown>>(
      `select o.*, r.name as region_name from orders o left join regions r on r.id = o.region_id
       ${whereSql} order by o.created_at desc limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, PAGE_SIZE, offset],
    );
    return reply.code(200).send({
      items: rows.map((r) => ({
        ...r,
        items_total: toNumber(r['items_total'] as string | number),
        discount_total: toNumber(r['discount_total'] as string | number),
        delivery_fee: toNumber(r['delivery_fee'] as string | number),
        grand_total: toNumber(r['grand_total'] as string | number),
      })),
      total: countRow ? toNumber(countRow.total) : 0,
      page,
      page_size: PAGE_SIZE,
    });
  });

  fastify.get('/orders/:id', async (request, reply) => {
    const id = parsePositiveIntegerId((request.params as { id: string }).id);
    if (id === null) return sendError(reply, 'bad_request', 'Invalid order id', 400);
    const order = await db.queryOne<Record<string, unknown>>(
      `select o.*, r.name as region_name from orders o left join regions r on r.id = o.region_id where o.id = $1`,
      [id],
    );
    if (order === null) return sendError(reply, 'not_found', 'Order not found', 404);
    const items = await db.query('select * from order_items where order_id = $1 order by id', [id]);
    const history = await db.query(
      'select from_status, to_status, changed_by, created_at from order_status_history where order_id = $1 order by created_at asc',
      [id],
    );
    const moneyKeys = ['items_total', 'discount_total', 'delivery_fee', 'grand_total'] as const;
    for (const key of moneyKeys) {
      if (order[key] !== undefined) order[key] = toNumber(order[key] as string | number);
    }
    return reply.code(200).send({ ...order, items, history });
  });

  fastify.post('/orders/:id/status', async (request, reply) => {
    const admin = request.admin!.user;
    const id = parsePositiveIntegerId((request.params as { id: string }).id);
    if (id === null) return sendError(reply, 'bad_request', 'Invalid order id', 400);
    const result = validateOrderStatusBody(request.body);
    if (!result.ok) return sendError(reply, result.code, 'Invalid status', 400);

    let rpcResult;
    try {
      rpcResult = await setOrderStatusRpc(db, id, result.value.status, admin.id, result.value.trackingNote);
    } catch (error) {
      if (error instanceof PgRpcError && error.code === '22023') {
        return sendError(reply, 'not_found', 'Order not found', 404);
      }
      console.error('POST /admin/orders/:id/status: RPC failed', error);
      return sendError(reply, 'internal', 'Failed to update order status', 500);
    }

    if (!rpcResult.ok) {
      return sendError(reply, rpcResult.code, 'Invalid status transition', 422, {
        from: rpcResult.from,
        to: rpcResult.to,
      });
    }

    // set_order_status already wrote its own audit_log row (see file header).
    await notifyOrderStatusChanged(db, env.TELEGRAM_BOT_TOKEN, {
      orderId: rpcResult.order_id,
      userId: rpcResult.user_id,
      orderNo: rpcResult.order_no,
      status: rpcResult.to,
      trackingNote: result.value.trackingNote,
    });
    return reply.code(200).send({ ok: true, order_id: rpcResult.order_id, status: rpcResult.to });
  });

  // ---------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------

  fastify.get('/settings', async (_request, reply) => {
    const row = await db.queryOne<Record<string, unknown>>('select * from settings where id = 1');
    if (row === null) return sendError(reply, 'internal', 'Settings not configured', 500);
    return reply.code(200).send({
      ...row,
      min_order_amount: toNumber(row['min_order_amount'] as string | number),
      free_delivery_threshold: toNumber(row['free_delivery_threshold'] as string | number),
    });
  });

  fastify.patch('/settings', async (request, reply) => {
    const admin = request.admin!.user;
    const result = validateSettingsWriteBody(request.body);
    if (!result.ok) return sendError(reply, result.code, 'Invalid settings', 422);
    const before = await db.queryOne('select * from settings where id = 1');

    const update: Record<string, unknown> = {};
    if (result.value.freeDeliveryThreshold !== undefined) update['free_delivery_threshold'] = result.value.freeDeliveryThreshold;
    if (result.value.minOrderAmount !== undefined) update['min_order_amount'] = result.value.minOrderAmount;
    if (result.value.deliveryEnabled !== undefined) update['delivery_enabled'] = result.value.deliveryEnabled;
    if (result.value.shopGroupChatId !== undefined) update['shop_group_chat_id'] = result.value.shopGroupChatId;
    if (result.value.pickupAddress !== undefined) update['pickup_address'] = result.value.pickupAddress;
    if (result.value.requiredChannel !== undefined) update['required_channel'] = result.value.requiredChannel;
    if (result.value.installmentMonths !== undefined) update['installment_months'] = result.value.installmentMonths;
    if (result.value.supportUsername !== undefined) update['support_username'] = result.value.supportUsername;

    if (Object.keys(update).length === 0) return reply.code(200).send(before);
    const setSql = Object.keys(update).map((key, i) => `${key} = $${i + 1}`).join(', ');
    const after = await db.queryOne(`update settings set ${setSql} where id = 1 returning *`, Object.values(update));
    await writeAudit(db, admin.id, 'settings_update', 'settings', 1, before, after);
    return reply.code(200).send(after);
  });

  // ---------------------------------------------------------------------
  // Audit log
  // ---------------------------------------------------------------------

  fastify.get('/audit', async (request, reply) => {
    const page = pageFromQuery((request.query as { page?: string }).page);
    const offset = (page - 1) * PAGE_SIZE;
    const countRow = await db.queryOne<{ total: string }>('select count(*) as total from audit_log');
    const rows = await db.query(
      'select * from audit_log order by created_at desc limit $1 offset $2',
      [PAGE_SIZE, offset],
    );
    return reply.code(200).send({ items: rows, total: countRow ? toNumber(countRow.total) : 0, page, page_size: PAGE_SIZE });
  });

  // ---------------------------------------------------------------------
  // Admins (owner only)
  // ---------------------------------------------------------------------

  fastify.get('/admins', { preHandler: requireOwnerHook }, async (_request, reply) => {
    const rows = await db.query('select * from admin_users order by created_at asc');
    return reply.code(200).send({ items: rows });
  });

  fastify.post('/admins', { preHandler: requireOwnerHook }, async (request, reply) => {
    const owner = request.admin!.user;
    const result = validateAdminWriteBody(request.body);
    if (!result.ok) return sendError(reply, result.code, 'Invalid admin payload', 422);
    const row = await db.queryOne(
      'insert into admin_users (telegram_id, role, added_by) values ($1,$2,$3) returning *',
      [result.value.telegramId, result.value.role, owner.id],
    );
    await writeAudit(db, owner.id, 'admin_create', 'admin_users', result.value.telegramId, null, row);
    return reply.code(201).send(row);
  });

  fastify.delete('/admins/:telegramId', { preHandler: requireOwnerHook }, async (request, reply) => {
    const owner = request.admin!.user;
    const telegramId = parsePositiveIntegerId((request.params as { telegramId: string }).telegramId);
    if (telegramId === null) return sendError(reply, 'bad_request', 'Invalid telegram id', 400);

    const target = await db.queryOne<{ telegram_id: number; role: AdminRole }>(
      'select * from admin_users where telegram_id = $1',
      [telegramId],
    );

    // Only count owners when it can change the outcome. A null count (the
    // query returned no row) is passed through as "unknown", which makes
    // decideAdminDeletion fail CLOSED instead of silently skipping the guard.
    let ownerCount: number | null = null;
    if (target !== null && target.role === 'owner') {
      const countRow = await db.queryOne<{ count: string }>(
        "select count(*) as count from admin_users where role = 'owner'",
      );
      ownerCount = countRow === null ? null : toNumber(countRow.count);
    }

    const decision = decideAdminDeletion({
      targetId: telegramId,
      targetRole: target === null ? null : target.role,
      requesterId: owner.id,
      ownerCount,
    });
    if (!decision.ok) {
      return sendError(reply, decision.code, 'Admin deletion refused', decision.status);
    }

    await db.query('delete from admin_users where telegram_id = $1', [telegramId]);
    await writeAudit(db, owner.id, 'admin_delete', 'admin_users', telegramId, target, null);
    return reply.code(200).send({ ok: true });
  });
};

export default adminRoutes;
