// /api/* customer routes. Every route requires a valid initData
// (`Authorization: tma <initData>`); every route except /me, /me/contact and
// /me/channel-check is additionally gated on the required-channel check
// (admins are exempt). Every address/favorite/order query is scoped to the
// caller's own user_id in its `where` clause — never trust a client-supplied
// id alone.

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { requireUser, type AuthenticatedUser } from '../lib/auth.js';
import { resolveChannelState, type ChannelState } from '../lib/channelCheck.js';
import { isChannelGateExemptPath } from '../lib/channelGateExempt.js';
import { isAdminUser } from '../lib/adminUsers.js';
import { stripPrefix } from '../lib/router.js';
import { errorResult } from '../lib/http.js';
import { buildMeResponse, type MeAdminRow, type MeUserRow } from '../lib/meResponse.js';
import {
  MAX_ADDRESSES_PER_USER,
  parsePositiveIntegerId,
  validateAddressWriteBody,
  validateOrderCreateBody,
  validateProfileWriteBody,
} from '../lib/validators.js';
import { createOrderRpc, PgRpcError } from '../lib/db.js';
import { mapCreateOrderFailure } from '../lib/orderErrors.js';
import { notifyOrderCreated } from '../lib/orderNotify.js';
import { toNullableNumber, toNumber } from '../lib/money.js';
import { validateContactResponse } from '@dunyo/shared';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
    channel?: ChannelState;
  }
}

const ORDERS_PAGE_SIZE = 20;

function sendError(reply: FastifyReply, code: string, message: string, status: number, details?: Record<string, unknown>): FastifyReply {
  const result = errorResult(code, message, status, details);
  return reply.code(result.status).send(result.body);
}

async function loadMeRow(db: import('../lib/db.js').Db, userId: number) {
  return db.queryOne<MeUserRow>(
    'select id, first_name, last_name, username, phone, phone_verified from users where id = $1',
    [userId],
  );
}

async function loadAdminRow(db: import('../lib/db.js').Db, userId: number) {
  return db.queryOne<MeAdminRow>('select telegram_id, role from admin_users where telegram_id = $1', [userId]);
}

async function sendMeResponse(
  reply: FastifyReply,
  db: import('../lib/db.js').Db,
  userId: number,
  channel: ChannelState,
): Promise<FastifyReply> {
  const [userRow, adminRow] = await Promise.all([loadMeRow(db, userId), loadAdminRow(db, userId)]);
  if (userRow === null) {
    return sendError(reply, 'internal', 'Failed to load profile', 500);
  }
  return reply.code(200).send(buildMeResponse(userRow, adminRow, channel));
}

const customerRoutes: FastifyPluginAsync = async (fastify) => {
  const db = fastify.db;
  const env = fastify.env;

  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = (request.headers.authorization as string | undefined) ?? null;
    const userResult = await requireUser(authHeader, db, env.TELEGRAM_BOT_TOKEN, env.INIT_DATA_MAX_AGE_SEC);
    if (!userResult.ok) {
      return sendError(reply, 'auth_invalid', 'Authentication required', 401);
    }
    request.user = userResult.user;

    const pathOnly = request.url.split('?')[0] ?? request.url;
    const relativePath = stripPrefix('/api', pathOnly) ?? pathOnly;

    // POST /me/channel-check does its own forced re-check; resolving the
    // (unforced, cached) state here first would be redundant work.
    if (request.method === 'POST' && relativePath === '/me/channel-check') {
      return;
    }

    const channel = await resolveChannelState(db, env.TELEGRAM_BOT_TOKEN, userResult.user.id);
    request.channel = channel;

    if (channel.blocked && !isChannelGateExemptPath(relativePath)) {
      // The admin_users lookup only runs for a user who would otherwise be
      // blocked, so exempting admins costs nothing on the normal path.
      if (!(await isAdminUser(db, userResult.user.id))) {
        return sendError(reply, 'channel_required', 'Channel subscription required', 403, {
          channel: channel.requiredChannel,
        });
      }
    }
  });

  // -------------------------------------------------------------------------
  // Profile
  // -------------------------------------------------------------------------

  fastify.post('/me/channel-check', async (request, reply) => {
    const user = request.user!;
    const channel = await resolveChannelState(db, env.TELEGRAM_BOT_TOKEN, user.id, { force: true });
    return sendMeResponse(reply, db, user.id, channel);
  });

  fastify.get('/me', async (request, reply) => {
    const user = request.user!;
    return sendMeResponse(reply, db, user.id, request.channel!);
  });

  fastify.patch('/me', async (request, reply) => {
    const user = request.user!;
    const result = validateProfileWriteBody(request.body);
    if (!result.ok) {
      return sendError(reply, result.code, 'Invalid profile update', 422);
    }
    const update: Record<string, unknown> = {};
    if (result.value.firstName !== undefined) update['first_name'] = result.value.firstName;
    if (result.value.lastName !== undefined) update['last_name'] = result.value.lastName;
    if (result.value.phone !== undefined) {
      update['phone'] = result.value.phone;
      update['phone_verified'] = false; // manual entry is never pre-verified.
    }
    if (Object.keys(update).length > 0) {
      const setSql = Object.keys(update)
        .map((key, i) => `${key} = $${i + 2}`)
        .join(', ');
      await db.query(`update users set ${setSql} where id = $1`, [user.id, ...Object.values(update)]);
    }
    return sendMeResponse(reply, db, user.id, request.channel!);
  });

  fastify.post('/me/contact', async (request, reply) => {
    const user = request.user!;
    const body = request.body;
    if (typeof body !== 'object' || body === null || typeof (body as Record<string, unknown>)['response'] !== 'string') {
      return sendError(reply, 'bad_request', 'Missing response', 400);
    }
    const response = (body as Record<string, unknown>)['response'] as string;
    const result = await validateContactResponse(response, env.TELEGRAM_BOT_TOKEN, user.id, {
      maxAgeSec: env.INIT_DATA_MAX_AGE_SEC,
    });
    if (!result.ok) {
      return sendError(reply, result.code, 'Contact verification failed', 422);
    }
    await db.query('update users set phone = $1, phone_verified = true where id = $2', [result.data.phone, user.id]);
    return sendMeResponse(reply, db, user.id, request.channel!);
  });

  // -------------------------------------------------------------------------
  // Favorites (product-level, not variant-level)
  // -------------------------------------------------------------------------

  fastify.get('/favorites', async (request, reply) => {
    const user = request.user!;
    const rows = await db.query<{
      id: number;
      name: string;
      brand_id: number;
      brand_name: string;
      category_id: number;
      warranty_months: number;
      min_price: string;
      old_price: string | null;
      thumb: string | null;
      total_stock: string;
      variant_count: string;
      sold_count: number;
    }>(
      `with variant_agg as (
         select product_id, min(price) as min_price, sum(stock) as total_stock, count(*) as variant_count
         from product_variants where is_active = true group by product_id
       ),
       min_price_variant as (
         select distinct on (product_id) product_id, old_price, image_thumb_path
         from product_variants where is_active = true
         order by product_id, price asc, id asc
       )
       select p.id, p.name, p.brand_id, b.name as brand_name, p.category_id, p.warranty_months,
              va.min_price, mpv.old_price, mpv.image_thumb_path as thumb,
              va.total_stock, va.variant_count, p.sold_count
       from favorites f
       join products p on p.id = f.product_id
       join brands b on b.id = p.brand_id
       join variant_agg va on va.product_id = p.id
       join min_price_variant mpv on mpv.product_id = p.id
       where f.user_id = $1 and p.is_active = true
       order by f.created_at desc`,
      [user.id],
    );
    return reply.code(200).send({
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        brand_id: r.brand_id,
        brand_name: r.brand_name,
        category_id: r.category_id,
        warranty_months: r.warranty_months,
        min_price: toNumber(r.min_price),
        old_price: toNullableNumber(r.old_price),
        thumb: r.thumb,
        total_stock: toNumber(r.total_stock),
        variant_count: toNumber(r.variant_count),
        sold_count: r.sold_count,
      })),
    });
  });

  fastify.put('/favorites/:productId', async (request, reply) => {
    const user = request.user!;
    const id = parsePositiveIntegerId((request.params as { productId: string }).productId);
    if (id === null) {
      return sendError(reply, 'bad_request', 'Invalid product id', 400);
    }
    try {
      await db.query('insert into favorites (user_id, product_id) values ($1, $2) on conflict do nothing', [
        user.id,
        id,
      ]);
    } catch (error) {
      if (typeof error === 'object' && error !== null && (error as { code?: string }).code === '23503') {
        return sendError(reply, 'not_found', 'Product not found', 404);
      }
      console.error('PUT /favorites/:productId failed', error);
      return sendError(reply, 'internal', 'Failed to add favorite', 500);
    }
    return reply.code(200).send({ ok: true });
  });

  fastify.delete('/favorites/:productId', async (request, reply) => {
    const user = request.user!;
    const id = parsePositiveIntegerId((request.params as { productId: string }).productId);
    if (id === null) {
      return sendError(reply, 'bad_request', 'Invalid product id', 400);
    }
    await db.query('delete from favorites where user_id = $1 and product_id = $2', [user.id, id]);
    return reply.code(200).send({ ok: true });
  });

  // -------------------------------------------------------------------------
  // Addresses
  // -------------------------------------------------------------------------

  fastify.get('/addresses', async (request, reply) => {
    const user = request.user!;
    const rows = await db.query(
      `select id, region_id, label, text, lat, lng, is_default, created_at
       from addresses where user_id = $1
       order by is_default desc, created_at desc`,
      [user.id],
    );
    return reply.code(200).send({ items: rows });
  });

  /** null = no region_id given (fine); 'invalid' = present but not a valid,
   * active region id; number = validated active region id. */
  async function resolveOptionalRegionId(raw: unknown): Promise<number | null | 'invalid'> {
    if (raw === undefined || raw === null) {
      return null;
    }
    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw <= 0) {
      return 'invalid';
    }
    const region = await db.queryOne<{ id: number }>('select id from regions where id = $1 and is_active = true', [
      raw,
    ]);
    return region === null ? 'invalid' : raw;
  }

  async function unsetOtherDefaults(userId: number, exceptId: number): Promise<void> {
    await db.query('update addresses set is_default = false where user_id = $1 and id <> $2 and is_default = true', [
      userId,
      exceptId,
    ]);
  }

  fastify.post('/addresses', async (request, reply) => {
    const user = request.user!;
    const result = validateAddressWriteBody(request.body);
    if (!result.ok) {
      return sendError(reply, result.code, 'Invalid address', 422);
    }
    const regionId = await resolveOptionalRegionId((request.body as Record<string, unknown>)['region_id']);
    if (regionId === 'invalid') {
      return sendError(reply, 'region_invalid', 'Invalid region', 422);
    }

    const countRow = await db.queryOne<{ count: string }>('select count(*) as count from addresses where user_id = $1', [
      user.id,
    ]);
    if (countRow !== null && toNumber(countRow.count) >= MAX_ADDRESSES_PER_USER) {
      return sendError(reply, 'too_many_addresses', 'Address limit reached', 422);
    }

    const row = await db.queryOne<{ id: number }>(
      `insert into addresses (user_id, region_id, label, text, lat, lng, is_default)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id, region_id, label, text, lat, lng, is_default, created_at`,
      [user.id, regionId, result.value.label, result.value.text, result.value.lat, result.value.lng, result.value.isDefault],
    );
    if (row === null) {
      return sendError(reply, 'internal', 'Failed to save address', 500);
    }
    if (result.value.isDefault) {
      await unsetOtherDefaults(user.id, row.id);
    }
    return reply.code(201).send(row);
  });

  fastify.patch('/addresses/:id', async (request, reply) => {
    const user = request.user!;
    const id = parsePositiveIntegerId((request.params as { id: string }).id);
    if (id === null) {
      return sendError(reply, 'bad_request', 'Invalid address id', 400);
    }
    const result = validateAddressWriteBody(request.body);
    if (!result.ok) {
      return sendError(reply, result.code, 'Invalid address', 422);
    }
    const regionId = await resolveOptionalRegionId((request.body as Record<string, unknown>)['region_id']);
    if (regionId === 'invalid') {
      return sendError(reply, 'region_invalid', 'Invalid region', 422);
    }

    const row = await db.queryOne<{ id: number }>(
      `update addresses set region_id = $1, label = $2, text = $3, lat = $4, lng = $5, is_default = $6
       where id = $7 and user_id = $8
       returning id, region_id, label, text, lat, lng, is_default, created_at`,
      [regionId, result.value.label, result.value.text, result.value.lat, result.value.lng, result.value.isDefault, id, user.id],
    );
    if (row === null) {
      return sendError(reply, 'not_found', 'Address not found', 404);
    }
    if (result.value.isDefault) {
      await unsetOtherDefaults(user.id, row.id);
    }
    return reply.code(200).send(row);
  });

  fastify.delete('/addresses/:id', async (request, reply) => {
    const user = request.user!;
    const id = parsePositiveIntegerId((request.params as { id: string }).id);
    if (id === null) {
      return sendError(reply, 'bad_request', 'Invalid address id', 400);
    }
    await db.query('delete from addresses where id = $1 and user_id = $2', [id, user.id]);
    return reply.code(200).send({ ok: true });
  });

  // -------------------------------------------------------------------------
  // Orders
  // -------------------------------------------------------------------------

  fastify.post('/orders', async (request, reply) => {
    const user = request.user!;
    const result = validateOrderCreateBody(request.body);
    if (!result.ok) {
      return sendError(reply, result.code, 'Invalid order', 422);
    }

    const payload = {
      idempotency_key: result.value.idempotencyKey,
      delivery_type: result.value.deliveryType,
      region_id: result.value.regionId,
      address_text: result.value.addressText,
      lat: result.value.lat,
      lng: result.value.lng,
      customer_name: result.value.customerName,
      customer_phone: result.value.customerPhone,
      comment: result.value.comment,
      payment_method: result.value.paymentMethod,
      items: result.value.items,
    };

    let rpcResult;
    try {
      rpcResult = await createOrderRpc(db, user.id, payload);
    } catch (error) {
      if (error instanceof PgRpcError && error.code === '22023') {
        return sendError(reply, 'bad_request', 'Invalid order payload', 400);
      }
      console.error('POST /orders: create_order RPC failed', error);
      return sendError(reply, 'internal', 'Failed to create order', 500);
    }

    if (!rpcResult.ok) {
      const mapped = mapCreateOrderFailure(rpcResult);
      return sendError(reply, mapped.code, 'Order could not be created', mapped.status, mapped.details);
    }

    if (!rpcResult.duplicate) {
      await notifyOrderCreated(db, env.TELEGRAM_BOT_TOKEN, rpcResult.order_id);
    }

    return reply.code(201).send({
      ok: true,
      order_id: rpcResult.order_id,
      order_no: rpcResult.order_no,
      duplicate: rpcResult.duplicate,
    });
  });

  fastify.get('/orders', async (request, reply) => {
    const user = request.user!;
    const rawPage = (request.query as { page?: string }).page;
    const parsedPage = rawPage !== undefined ? Number.parseInt(rawPage, 10) : 1;
    const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const offset = (page - 1) * ORDERS_PAGE_SIZE;

    const countRow = await db.queryOne<{ count: string }>('select count(*) as count from orders where user_id = $1', [
      user.id,
    ]);
    const total = countRow !== null ? toNumber(countRow.count) : 0;

    const rows = await db.query<{
      id: number;
      order_no: string;
      status: string;
      delivery_type: string;
      payment_method: string;
      tracking_note: string | null;
      items_total: string;
      delivery_fee: string;
      grand_total: string;
      created_at: string;
    }>(
      `select id, order_no, status, delivery_type, payment_method, tracking_note,
              items_total, delivery_fee, grand_total, created_at
       from orders where user_id = $1
       order by created_at desc
       limit $2 offset $3`,
      [user.id, ORDERS_PAGE_SIZE, offset],
    );
    return reply.code(200).send({
      items: rows.map((r) => ({
        id: r.id,
        order_no: r.order_no,
        status: r.status,
        delivery_type: r.delivery_type,
        payment_method: r.payment_method,
        tracking_note: r.tracking_note,
        items_total: toNumber(r.items_total),
        delivery_fee: toNumber(r.delivery_fee),
        grand_total: toNumber(r.grand_total),
        created_at: r.created_at,
      })),
      total,
      page,
      page_size: ORDERS_PAGE_SIZE,
    });
  });

  fastify.get('/orders/:id', async (request, reply) => {
    const user = request.user!;
    const id = parsePositiveIntegerId((request.params as { id: string }).id);
    if (id === null) {
      return sendError(reply, 'bad_request', 'Invalid order id', 400);
    }

    const order = await db.queryOne<Record<string, unknown>>(
      `select o.*, r.name as region_name
       from orders o
       left join regions r on r.id = o.region_id
       where o.id = $1 and o.user_id = $2`,
      [id, user.id],
    );
    if (order === null) {
      return sendError(reply, 'not_found', 'Order not found', 404);
    }

    const items = await db.query(
      `select id, variant_id, product_id, name_snapshot, color_snapshot, storage_snapshot,
              price_snapshot, old_price_snapshot, warranty_snapshot, qty
       from order_items where order_id = $1 order by id`,
      [id],
    );
    const history = await db.query(
      `select from_status, to_status, changed_by, created_at
       from order_status_history where order_id = $1 order by created_at asc`,
      [id],
    );

    const moneyKeys = ['items_total', 'discount_total', 'delivery_fee', 'grand_total'] as const;
    for (const key of moneyKeys) {
      if (order[key] !== undefined) {
        order[key] = toNumber(order[key] as string | number);
      }
    }

    return reply.code(200).send({
      ...order,
      items: items.map((item) => ({
        ...item,
        price_snapshot: toNumber(item['price_snapshot'] as string | number),
        old_price_snapshot: toNullableNumber(item['old_price_snapshot'] as string | number | null),
      })),
      history,
    });
  });
};

export default customerRoutes;
