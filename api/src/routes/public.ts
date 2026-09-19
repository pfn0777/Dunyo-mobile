// /api/public/* — no auth, catalog reads only. Every handler here must:
//   - return only is_active rows,
//   - send Cache-Control: public, max-age=60,
//   - never expose a users/orders/addresses/admin_users/audit_log row or any
//     of settings' private columns (shop_group_chat_id, required_channel).
//
// Money (bigint) columns are converted string -> number right after the
// query, via toNumber/toNullableNumber, so the JSON response always carries
// numbers.

import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { toNullableNumber, toNumber } from '../lib/money.js';
import {
  parseIdsParam,
  parseProductsListQuery,
  PRODUCTS_PAGE_SIZE,
  PRODUCTS_SORT_SQL,
  type RawProductsListQuery,
} from '../lib/publicProductsQuery.js';
import { projectPublicSettings, type PublicSettingsRow } from '../lib/publicSettings.js';
import { parsePositiveIntegerId } from '../lib/validators.js';
import { errorResult } from '../lib/http.js';

const CACHE_HEADER = 'public, max-age=60';

function withCache(reply: FastifyReply): FastifyReply {
  return reply.header('Cache-Control', CACHE_HEADER);
}

interface ProductCardRow {
  id: number;
  name: string;
  brand_id: number;
  brand_name: string;
  category_id: number;
  category_icon: string | null;
  warranty_months: number;
  min_price: string;
  old_price: string | null;
  thumb: string | null;
  total_stock: string;
  variant_count: string;
  sold_count: number;
}

function toProductCard(row: ProductCardRow) {
  return {
    id: row.id,
    name: row.name,
    brand_id: row.brand_id,
    brand_name: row.brand_name,
    category_id: row.category_id,
    category_icon: row.category_icon,
    warranty_months: row.warranty_months,
    min_price: toNumber(row.min_price),
    old_price: toNullableNumber(row.old_price),
    thumb: row.thumb,
    total_stock: toNumber(row.total_stock),
    variant_count: toNumber(row.variant_count),
    sold_count: row.sold_count,
  };
}

// Shared CTEs behind every product-card query (list, by-ids, and the
// favorites list in routes/customer.ts could reuse the same shape, but each
// route builds its own SQL — this comment documents the shape they share):
//   variant_agg      — per-product min price / total stock / variant count
//                       over ACTIVE variants only.
//   min_price_variant — the id/old_price/thumb of the specific active variant
//                       that has that min price (ties broken by variant id).
// A product with zero active variants has no variant_agg row, so the join
// drops it from every list automatically — never a manual "stock > 0" filter.
const PRODUCT_CARD_CTES = `
  with variant_agg as (
    select product_id, min(price) as min_price, sum(stock) as total_stock, count(*) as variant_count
    from product_variants
    where is_active = true
    group by product_id
  ),
  min_price_variant as (
    select distinct on (product_id) product_id, old_price, image_thumb_path
    from product_variants
    where is_active = true
    order by product_id, price asc, id asc
  )
`;

const publicRoutes: FastifyPluginAsync = async (fastify) => {
  const db = fastify.db;

  fastify.get('/settings', async (_request, reply) => {
    const row = await db.queryOne<PublicSettingsRow>(
      `select min_order_amount, free_delivery_threshold, delivery_enabled,
              pickup_address, installment_months, support_username
       from settings where id = 1`,
    );
    if (row === null) {
      const result = errorResult('internal', 'Settings not configured', 500);
      return withCache(reply).code(result.status).send(result.body);
    }
    return withCache(reply).code(200).send(projectPublicSettings(row));
  });

  fastify.get('/regions', async (_request, reply) => {
    const rows = await db.query(
      `select id, name, delivery_fee, eta_text, free_delivery_threshold
       from regions where is_active = true order by sort_order asc, name asc`,
    );
    return withCache(reply).code(200).send({
      items: rows.map((r) => ({
        id: r['id'],
        name: r['name'],
        delivery_fee: toNumber(r['delivery_fee'] as string | number),
        eta_text: r['eta_text'],
        free_delivery_threshold: toNullableNumber(r['free_delivery_threshold'] as string | number | null),
      })),
    });
  });

  fastify.get('/categories', async (_request, reply) => {
    const rows = await db.query(
      `select id, name, icon, image_path from categories where is_active = true order by sort_order asc, name asc`,
    );
    return withCache(reply).code(200).send({ items: rows });
  });

  fastify.get('/brands', async (_request, reply) => {
    const rows = await db.query(
      `select id, name, logo_path from brands where is_active = true order by sort_order asc, name asc`,
    );
    return withCache(reply).code(200).send({ items: rows });
  });

  fastify.get('/banners', async (_request, reply) => {
    const rows = await db.query(
      `select id, image_path, title, subtitle, link_type, link_id
       from banners
       where is_active = true and image_path is not null
       order by sort_order asc, id asc`,
    );
    return withCache(reply).code(200).send({ items: rows });
  });

  fastify.get('/products', async (request, reply) => {
    const query = parseProductsListQuery(request.query as RawProductsListQuery);
    const orderBySql = PRODUCTS_SORT_SQL[query.sort];

    const conditions = ['p.is_active = true'];
    const params: unknown[] = [];
    if (query.q !== null) {
      params.push(`%${query.q}%`);
      conditions.push(`p.name ilike $${params.length}`);
    }
    if (query.categoryId !== null) {
      params.push(query.categoryId);
      conditions.push(`p.category_id = $${params.length}`);
    }
    if (query.brandId !== null) {
      params.push(query.brandId);
      conditions.push(`p.brand_id = $${params.length}`);
    }
    if (query.discountOnly) {
      conditions.push('mpv.old_price is not null');
    }
    const whereSql = conditions.join(' and ');

    const countRow = await db.queryOne<{ total: string }>(
      `${PRODUCT_CARD_CTES}
       select count(*) as total
       from products p
       join brands b on b.id = p.brand_id
       join categories c on c.id = p.category_id
       join variant_agg va on va.product_id = p.id
       join min_price_variant mpv on mpv.product_id = p.id
       where ${whereSql}`,
      params,
    );
    const total = countRow !== null ? toNumber(countRow.total) : 0;

    const offset = (query.page - 1) * PRODUCTS_PAGE_SIZE;
    const listParams = [...params, PRODUCTS_PAGE_SIZE, offset];
    const rows = await db.query<ProductCardRow>(
      `${PRODUCT_CARD_CTES}
       select p.id, p.name, p.brand_id, b.name as brand_name, p.category_id, c.icon as category_icon, p.warranty_months,
              va.min_price, mpv.old_price, mpv.image_thumb_path as thumb,
              va.total_stock, va.variant_count, p.sold_count
       from products p
       join brands b on b.id = p.brand_id
       join categories c on c.id = p.category_id
       join variant_agg va on va.product_id = p.id
       join min_price_variant mpv on mpv.product_id = p.id
       where ${whereSql}
       order by ${orderBySql}
       limit $${listParams.length - 1} offset $${listParams.length}`,
      listParams,
    );

    return withCache(reply).code(200).send({
      items: rows.map(toProductCard),
      total,
      page: query.page,
      page_size: PRODUCTS_PAGE_SIZE,
    });
  });

  fastify.get('/products/by-ids', async (request, reply) => {
    const ids = parseIdsParam((request.query as { ids?: string }).ids);
    if (ids.length === 0) {
      return withCache(reply).code(200).send({ items: [] });
    }
    const rows = await db.query<ProductCardRow>(
      `${PRODUCT_CARD_CTES}
       select p.id, p.name, p.brand_id, b.name as brand_name, p.category_id, c.icon as category_icon, p.warranty_months,
              va.min_price, mpv.old_price, mpv.image_thumb_path as thumb,
              va.total_stock, va.variant_count, p.sold_count
       from products p
       join brands b on b.id = p.brand_id
       join categories c on c.id = p.category_id
       join variant_agg va on va.product_id = p.id
       join min_price_variant mpv on mpv.product_id = p.id
       where p.is_active = true and p.id = any($1::bigint[])`,
      [ids],
    );
    return withCache(reply).code(200).send({ items: rows.map(toProductCard) });
  });

  fastify.get('/products/:id', async (request, reply) => {
    const id = parsePositiveIntegerId((request.params as { id: string }).id);
    if (id === null) {
      const result = errorResult('bad_request', 'Invalid product id', 400);
      return withCache(reply).code(result.status).send(result.body);
    }

    const product = await db.queryOne<{
      id: number;
      name: string;
      brand_id: number;
      brand_name: string;
      category_id: number;
      category_icon: string | null;
      warranty_months: number;
      description: string | null;
      specs: unknown;
    }>(
      `select p.id, p.name, p.brand_id, b.name as brand_name, p.category_id,
              c.icon as category_icon, p.warranty_months, p.description, p.specs
       from products p
       join brands b on b.id = p.brand_id
       join categories c on c.id = p.category_id
       where p.id = $1 and p.is_active = true`,
      [id],
    );
    if (product === null) {
      const result = errorResult('not_found', 'Product not found', 404);
      return withCache(reply).code(result.status).send(result.body);
    }

    const variants = await db.query<{
      id: number;
      sku: string | null;
      color_name: string;
      color_hex: string | null;
      storage_gb: number | null;
      price: string;
      old_price: string | null;
      stock: number;
      image_thumb_path: string | null;
      image_path: string | null;
      sort_order: number;
    }>(
      `select id, sku, color_name, color_hex, storage_gb, price, old_price, stock,
              image_thumb_path, image_path, sort_order
       from product_variants
       where product_id = $1 and is_active = true
       order by sort_order asc, id asc`,
      [id],
    );

    return withCache(reply).code(200).send({
      ...product,
      variants: variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        color_name: v.color_name,
        color_hex: v.color_hex,
        storage_gb: v.storage_gb,
        price: toNumber(v.price),
        old_price: toNullableNumber(v.old_price),
        stock: v.stock,
        image_thumb_path: v.image_thumb_path,
        image_path: v.image_path,
        sort_order: v.sort_order,
      })),
    });
  });
};

export default publicRoutes;
