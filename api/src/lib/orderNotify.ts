// Order notifications: order created, status set from the admin panel, and
// status set from a group button. This is the only module that sends order
// notifications. Like telegram.ts, nothing here throws into the caller's
// order/status flow: failures are logged and the notification is skipped.

import type { Db } from './db.js';
import type { OrderStatus } from '@dunyo/shared';
import type { PaymentMethod } from './validators.js';
import {
  buildCustomerOrderConfirmationMessage,
  buildCustomerStatusMessage,
  buildGroupOrderKeyboard,
  buildGroupOrderMessage,
  type OrderForMessage,
  type OrderStatusForMessage,
} from './messages.uz.js';
import { editTelegramMessage, sendTelegramMessage, sendTelegramMessageForId } from './telegram.js';

interface LoadedOrder {
  id: number;
  userId: number;
  status: OrderStatus;
  trackingNote: string | null;
  groupChatId: number | null;
  groupMessageId: number | null;
  message: OrderForMessage;
  statusInfo: OrderStatusForMessage;
}

interface OrderRow {
  id: number;
  order_no: string;
  status: OrderStatus;
  delivery_type: 'delivery' | 'pickup';
  address_text: string | null;
  lat: string | null;
  lng: string | null;
  customer_name: string;
  customer_phone: string;
  comment: string | null;
  tracking_note: string | null;
  payment_method: PaymentMethod;
  installment_months: number | null;
  items_total: string;
  delivery_fee: string;
  grand_total: string;
  user_id: number;
  group_chat_id: number | null;
  group_message_id: number | null;
  region_name: string | null;
}

interface OrderItemRow {
  name_snapshot: string;
  color_snapshot: string | null;
  storage_snapshot: number | null;
  price_snapshot: string;
  qty: number;
}

async function loadStatusInfo(db: Db, orderId: number, status: OrderStatus): Promise<OrderStatusForMessage> {
  if (status === 'new') {
    return { status, changedByName: null, changedAt: null };
  }

  let history: { changed_by: number | null; created_at: string } | null;
  try {
    history = await db.queryOne<{ changed_by: number | null; created_at: string }>(
      `select changed_by, created_at
       from order_status_history
       where order_id = $1 and to_status = $2
       order by created_at desc
       limit 1`,
      [orderId, status],
    );
  } catch (error) {
    console.error('orderNotify: failed to load status history', error);
    return { status, changedByName: null, changedAt: null };
  }
  if (history === null) {
    return { status, changedByName: null, changedAt: null };
  }

  const changedAt = new Date(history.created_at);
  if (history.changed_by === null) {
    return { status, changedByName: null, changedAt };
  }

  let user: { first_name: string; username: string | null } | null = null;
  try {
    user = await db.queryOne<{ first_name: string; username: string | null }>(
      'select first_name, username from users where id = $1',
      [history.changed_by],
    );
  } catch (error) {
    console.error('orderNotify: failed to load status actor', error);
  }
  const changedByName = user?.first_name ?? (user?.username ? `@${user.username}` : String(history.changed_by));
  return { status, changedByName, changedAt };
}

async function loadOrder(db: Db, orderId: number): Promise<LoadedOrder | null> {
  let order: OrderRow | null;
  try {
    order = await db.queryOne<OrderRow>(
      `select o.id, o.order_no, o.status, o.delivery_type, o.address_text, o.lat, o.lng,
              o.customer_name, o.customer_phone, o.comment, o.tracking_note,
              o.payment_method, o.installment_months,
              o.items_total, o.delivery_fee, o.grand_total,
              o.user_id, o.group_chat_id, o.group_message_id,
              r.name as region_name
       from orders o
       left join regions r on r.id = o.region_id
       where o.id = $1`,
      [orderId],
    );
  } catch (error) {
    console.error(`orderNotify: failed to load order ${orderId}`, error);
    return null;
  }
  if (order === null) {
    console.error(`orderNotify: order ${orderId} not found`);
    return null;
  }

  let items: OrderItemRow[];
  try {
    items = await db.query<OrderItemRow>(
      `select name_snapshot, color_snapshot, storage_snapshot, price_snapshot, qty
       from order_items
       where order_id = $1
       order by id`,
      [orderId],
    );
  } catch (error) {
    console.error(`orderNotify: failed to load items for order ${orderId}`, error);
    return null;
  }

  return {
    id: order.id,
    userId: order.user_id,
    status: order.status,
    trackingNote: order.tracking_note,
    groupChatId: order.group_chat_id,
    groupMessageId: order.group_message_id,
    message: {
      orderNo: order.order_no,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      deliveryType: order.delivery_type,
      regionName: order.region_name,
      addressText: order.address_text,
      lat: order.lat !== null ? Number(order.lat) : null,
      lng: order.lng !== null ? Number(order.lng) : null,
      comment: order.comment,
      paymentMethod: order.payment_method,
      installmentMonths: order.installment_months,
      itemsTotal: Number(order.items_total),
      deliveryFee: Number(order.delivery_fee),
      grandTotal: Number(order.grand_total),
      items: items.map((item) => ({
        name: item.name_snapshot,
        colorName: item.color_snapshot,
        storageGb: item.storage_snapshot,
        qty: item.qty,
        price: Number(item.price_snapshot),
      })),
    },
    statusInfo: await loadStatusInfo(db, orderId, order.status),
  };
}

/** Posts the new order to the shop group (with its status button) and confirms it to the customer. */
export async function notifyOrderCreated(db: Db, botToken: string, orderId: number): Promise<void> {
  const order = await loadOrder(db, orderId);
  if (order === null) {
    return;
  }

  let groupChatId: number | null = null;
  try {
    const settings = await db.queryOne<{ shop_group_chat_id: number | null }>(
      'select shop_group_chat_id from settings where id = 1',
    );
    groupChatId = settings?.shop_group_chat_id ?? null;
  } catch (error) {
    // The customer confirmation below is still sent; only the group message is lost.
    console.error('notifyOrderCreated: failed to load settings, group message skipped', error);
  }

  if (groupChatId !== null) {
    const messageId = await sendTelegramMessageForId(botToken, {
      chatId: groupChatId,
      text: buildGroupOrderMessage(order.message, order.statusInfo),
      replyMarkup: buildGroupOrderKeyboard(order.id, order.status, order.message.deliveryType),
    });
    if (messageId !== null) {
      try {
        await db.query('update orders set group_chat_id = $1, group_message_id = $2 where id = $3', [
          groupChatId,
          messageId,
          order.id,
        ]);
      } catch (error) {
        console.error(`notifyOrderCreated: failed to save group message id for order ${order.id}`, error);
      }
    }
  }

  await sendTelegramMessage(botToken, {
    chatId: order.userId,
    text: buildCustomerOrderConfirmationMessage(order.message),
  });
}

/** Re-renders the group message to the order's current status. No-op for orders without one. */
export async function refreshGroupOrderMessage(db: Db, botToken: string, orderId: number): Promise<void> {
  const order = await loadOrder(db, orderId);
  if (order === null || order.groupChatId === null || order.groupMessageId === null) {
    return;
  }
  await editTelegramMessage(botToken, {
    chatId: order.groupChatId,
    messageId: order.groupMessageId,
    text: buildGroupOrderMessage(order.message, order.statusInfo),
    replyMarkup: buildGroupOrderKeyboard(order.id, order.status, order.message.deliveryType),
  });
}

export interface StatusChange {
  orderId: number;
  userId: number;
  orderNo: string;
  status: OrderStatus;
  trackingNote: string | null;
}

/** Tells the customer about a status change and updates the group message. */
export async function notifyOrderStatusChanged(db: Db, botToken: string, change: StatusChange): Promise<void> {
  await sendTelegramMessage(botToken, {
    chatId: change.userId,
    text: buildCustomerStatusMessage(change.orderNo, change.status, change.trackingNote),
  });
  await refreshGroupOrderMessage(db, botToken, change.orderId);
}
