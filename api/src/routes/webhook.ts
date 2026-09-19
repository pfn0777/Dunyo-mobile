// POST /tg/webhook — Telegram bot webhook. Mirrors XUMO's bot/index.ts,
// adapted to Dunyo's schema and Fastify. Always answers 200 for anything
// past the secret check (even on internal failure) so Telegram does not
// retry-storm; every failure is logged instead.

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { normalizePhone } from '@dunyo/shared';
import { isValidWebhookSecret } from '../lib/webhookSecret.js';
import { answerCallbackQuery, sendTelegramMessage } from '../lib/telegram.js';
import {
  buildStartGreeting,
  buildSubscribeKeyboard,
  buildSubscribeRequiredMessage,
  CALLBACK_DONE_TEXT,
  CALLBACK_FAILED_TEXT,
  CALLBACK_FORBIDDEN_TEXT,
  CALLBACK_STALE_TEXT,
  CALLBACK_SUBSCRIBE_MISSING_TEXT,
  CALLBACK_SUBSCRIBE_OK_TEXT,
  isSubscriptionCallback,
  OPEN_ADMIN_BUTTON_TEXT,
  OPEN_SHOP_BUTTON_TEXT,
  parseOrderStatusCallback,
} from '../lib/messages.uz.js';
import { notifyOrderStatusChanged, refreshGroupOrderMessage } from '../lib/orderNotify.js';
import { resolveChannelState } from '../lib/channelCheck.js';
import { isAdminUser } from '../lib/adminUsers.js';
import { setOrderStatusRpc, PgRpcError, type Db } from '../lib/db.js';
import type { Env } from '../lib/env.js';

const WEBHOOK_SECRET_HEADER = 'x-telegram-bot-api-secret-token';
const ORDER_NOT_FOUND_ERRCODE = '22023';

interface TelegramFrom {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TelegramContact {
  user_id?: number;
  phone_number: string;
}

interface TelegramMessage {
  from?: TelegramFrom;
  text?: string;
  contact?: TelegramContact;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramFrom;
  data?: string;
}

interface TelegramUpdate {
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

async function upsertUser(db: Db, from: TelegramFrom): Promise<void> {
  try {
    await db.query(
      `insert into users (id, first_name, last_name, username)
       values ($1, $2, $3, $4)
       on conflict (id) do update set first_name = excluded.first_name, last_name = excluded.last_name, username = excluded.username`,
      [from.id, from.first_name, from.last_name ?? null, from.username ?? null],
    );
  } catch (error) {
    console.error('webhook: failed to upsert user', error);
  }
}

async function resolveStartGate(
  db: Db,
  env: Env,
  telegramId: number,
  options: { force?: boolean } = {},
): Promise<{ admin: boolean; blockedChannel: string | null }> {
  if (await isAdminUser(db, telegramId)) {
    return { admin: true, blockedChannel: null };
  }
  const channel = await resolveChannelState(db, env.TELEGRAM_BOT_TOKEN, telegramId, options);
  return { admin: false, blockedChannel: channel.blocked ? channel.requiredChannel : null };
}

async function sendShopButtons(env: Env, from: TelegramFrom, admin: boolean): Promise<void> {
  const buttons = [[{ text: OPEN_SHOP_BUTTON_TEXT, web_app: { url: env.WEBAPP_URL } }]];
  if (admin) {
    buttons.push([{ text: OPEN_ADMIN_BUTTON_TEXT, web_app: { url: `${env.WEBAPP_URL}/admin` } }]);
  }
  await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
    chatId: from.id,
    text: buildStartGreeting(from.first_name),
    replyMarkup: { inline_keyboard: buttons },
  });
}

async function sendSubscribePrompt(env: Env, from: TelegramFrom, channel: string): Promise<void> {
  await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, {
    chatId: from.id,
    text: buildSubscribeRequiredMessage(from.first_name, channel),
    replyMarkup: buildSubscribeKeyboard(channel),
  });
}

async function handleStart(db: Db, env: Env, message: TelegramMessage): Promise<void> {
  const from = message.from;
  if (from === undefined) return;
  await upsertUser(db, from);

  const gate = await resolveStartGate(db, env, from.id);
  if (gate.blockedChannel !== null) {
    // The web_app button is withheld entirely; handing it out would make the
    // gate pointless, since the button opens the shop directly.
    await sendSubscribePrompt(env, from, gate.blockedChannel);
    return;
  }
  await sendShopButtons(env, from, gate.admin);
}

async function handleSubscriptionCallback(db: Db, env: Env, query: TelegramCallbackQuery): Promise<void> {
  await upsertUser(db, query.from);
  const gate = await resolveStartGate(db, env, query.from.id, { force: true });
  if (gate.blockedChannel !== null) {
    await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, query.id, CALLBACK_SUBSCRIBE_MISSING_TEXT, true);
    return;
  }
  await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, query.id, CALLBACK_SUBSCRIBE_OK_TEXT);
  await sendShopButtons(env, query.from, gate.admin);
}

async function handleContact(db: Db, message: TelegramMessage): Promise<void> {
  const from = message.from;
  const contact = message.contact;
  if (from === undefined || contact === undefined) return;
  if (contact.user_id !== from.id) {
    console.warn(`webhook: ignored contact from=${from.id}: contact belongs to another user`);
    return;
  }
  const phone = normalizePhone(contact.phone_number);
  if (phone === null) {
    console.warn(`webhook: ignored contact from=${from.id}: phone is not a +998 number`);
    return;
  }
  try {
    await db.query('update users set phone = $1, phone_verified = true where id = $2', [phone, from.id]);
  } catch (error) {
    console.error('webhook: failed to save contact phone', error);
  }
}

async function handleOrderStatusCallback(db: Db, env: Env, query: TelegramCallbackQuery): Promise<void> {
  const parsed = parseOrderStatusCallback(query.data);
  if (parsed === null) {
    await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, query.id);
    return;
  }
  // Anyone in the group can press the button; only admin_users may act on
  // it. This is re-checked here, not trusted from anything client-side —
  // group buttons are not a permission boundary.
  if (!(await isAdminUser(db, query.from.id))) {
    console.warn(`webhook: non-admin ${query.from.id} pressed status button for order ${parsed.orderId}`);
    await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, query.id, CALLBACK_FORBIDDEN_TEXT);
    return;
  }
  await upsertUser(db, query.from);

  let result;
  try {
    result = await setOrderStatusRpc(db, parsed.orderId, parsed.status, query.from.id, null);
  } catch (error) {
    if (!(error instanceof PgRpcError) || error.code !== ORDER_NOT_FOUND_ERRCODE) {
      console.error(`webhook: set_order_status failed for order ${parsed.orderId}`, error);
    }
    await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, query.id, CALLBACK_FAILED_TEXT);
    return;
  }

  if (!result.ok) {
    // Another admin (or the admin panel) changed it first: show the real state.
    await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, query.id, CALLBACK_STALE_TEXT);
    await refreshGroupOrderMessage(db, env.TELEGRAM_BOT_TOKEN, parsed.orderId);
    return;
  }

  await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, query.id, CALLBACK_DONE_TEXT);
  await notifyOrderStatusChanged(db, env.TELEGRAM_BOT_TOKEN, {
    orderId: result.order_id,
    userId: result.user_id,
    orderNo: result.order_no,
    status: result.to,
    trackingNote: null,
  });
}

async function handleUpdate(db: Db, env: Env, update: TelegramUpdate): Promise<void> {
  if (update.callback_query !== undefined) {
    if (isSubscriptionCallback(update.callback_query.data)) {
      await handleSubscriptionCallback(db, env, update.callback_query);
      return;
    }
    await handleOrderStatusCallback(db, env, update.callback_query);
    return;
  }
  const message = update.message;
  if (message === undefined) return;
  if (message.contact !== undefined) {
    await handleContact(db, message);
    return;
  }
  if (message.text === '/start') {
    await handleStart(db, env, message);
  }
}

function isTelegramUpdate(value: unknown): value is TelegramUpdate {
  return typeof value === 'object' && value !== null;
}

const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  const db = fastify.db;
  const env = fastify.env;

  // Scoped to this plugin only: a malformed JSON body would otherwise reach
  // Fastify's default error handler (a 400) before our route handler ever
  // runs. Telegram must always get 200 past the secret check, even for a
  // body it (in practice never, but defensively) sends malformed.
  fastify.setErrorHandler((error, request, reply) => {
    console.error('webhook: request-level error', error);
    reply.code(200).send();
  });

  fastify.post('/webhook', async (request: FastifyRequest, reply) => {
    const secretHeader = request.headers[WEBHOOK_SECRET_HEADER];
    const secret = typeof secretHeader === 'string' ? secretHeader : null;
    if (!isValidWebhookSecret(secret, env.TELEGRAM_WEBHOOK_SECRET)) {
      return reply.code(401).send();
    }

    const body = request.body;
    if (!isTelegramUpdate(body)) {
      // Malformed body: never retry-storm Telegram over it.
      return reply.code(200).send();
    }

    try {
      await handleUpdate(db, env, body);
    } catch (error) {
      console.error('webhook: unhandled error while processing update', error);
    }
    return reply.code(200).send();
  });
};

export default webhookRoutes;
