// All bot / notification text, in Uzbek. Every value that comes from user
// input (name, phone, address, comment, item names/colors) MUST be passed
// through escapeHtml before being interpolated here, because messages are
// sent with Telegram HTML parse_mode.

import { formatSom, installmentMonthly } from '@dunyo/shared';
import type { DeliveryType, OrderStatus } from '@dunyo/shared';
import { escapeHtml, type InlineKeyboardMarkup } from './telegram.js';
import { channelLink } from './channelGate.js';
import type { PaymentMethod } from './validators.js';

export const OPEN_SHOP_BUTTON_TEXT = "Do'konni ochish";
export const OPEN_ADMIN_BUTTON_TEXT = 'Admin panel';

const PAYMENT_METHOD_LABELS: Readonly<Record<PaymentMethod, string>> = {
  cash: 'Naqd',
  card_to_courier: 'Kuryerga karta orqali',
  installment_request: "Nasiya (0-0-12)",
};

const DELIVERY_TYPE_LABELS: Readonly<Record<DeliveryType, string>> = {
  delivery: 'Yetkazib berish',
  pickup: 'Olib ketish',
};

// All six order_status values, including `shipped` ("handed to a courier
// service for a regional delivery" — meaningful only for delivery orders).
const STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  new: 'Yangi',
  confirmed: 'Qabul qilindi',
  shipped: "Jo'natildi",
  on_the_way: "Yo'lga chiqdi",
  delivered: 'Yetkazib berildi',
  cancelled: 'Bekor qilindi',
};

export interface OrderItemForMessage {
  name: string;
  colorName: string | null;
  storageGb: number | null;
  qty: number;
  price: number;
}

export interface OrderForMessage {
  orderNo: string;
  customerName: string;
  customerPhone: string;
  deliveryType: DeliveryType;
  /** Selected delivery region's name; null for pickup orders. */
  regionName: string | null;
  addressText: string | null;
  lat: number | null;
  lng: number | null;
  comment: string | null;
  paymentMethod: PaymentMethod;
  /** Set only when paymentMethod === 'installment_request'. */
  installmentMonths: number | null;
  itemsTotal: number;
  deliveryFee: number;
  grandTotal: number;
  items: readonly OrderItemForMessage[];
}

function googleMapsUrl(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

function yandexMapsUrl(lat: number, lng: number): string {
  return `https://yandex.uz/maps/?pt=${lng},${lat}&z=17`;
}

/** "name · color · storageGB", each escaped, storage rendered as "128GB". */
function formatItemLabel(item: OrderItemForMessage): string {
  const parts = [item.name];
  if (item.colorName !== null && item.colorName.length > 0) {
    parts.push(item.colorName);
  }
  if (item.storageGb !== null) {
    parts.push(`${item.storageGb}GB`);
  }
  return parts.map((part) => escapeHtml(part)).join(' · ');
}

function buildItemLines(items: readonly OrderItemForMessage[]): string {
  return items
    .map((item) => {
      const sum = item.price * item.qty;
      return `${formatItemLabel(item)} × ${item.qty} = ${formatSom(sum)}`;
    })
    .join('\n');
}

function buildDeliveryLine(order: OrderForMessage): string {
  if (order.deliveryType === 'pickup') {
    return `Yetkazish turi: ${DELIVERY_TYPE_LABELS.pickup}`;
  }
  const region = order.regionName !== null ? escapeHtml(order.regionName) : '—';
  const address = order.addressText !== null ? escapeHtml(order.addressText) : '—';
  let line = `Yetkazish turi: ${DELIVERY_TYPE_LABELS.delivery}\nHudud: ${region}\nManzil: ${address}`;
  if (order.lat !== null && order.lng !== null) {
    line += `\n<a href="${googleMapsUrl(order.lat, order.lng)}">Google Maps</a> | <a href="${yandexMapsUrl(order.lat, order.lng)}">Yandex Maps</a>`;
  }
  return line;
}

const SHOP_UTC_OFFSET_MINUTES = 5 * 60; // Asia/Tashkent, no DST.
const MS_PER_MINUTE = 60_000;

const ORDER_STATUS_CALLBACK_PREFIX = 'os';
const ORDER_STATUS_CALLBACK_PATTERN = /^os:([1-9][0-9]{0,15}):(confirmed|shipped|on_the_way|delivered)$/;

export type GroupButtonStatus = 'confirmed' | 'shipped' | 'on_the_way' | 'delivered';

export const GROUP_BUTTON_TEXTS: Readonly<Record<GroupButtonStatus, string>> = {
  confirmed: 'Qabul qildim',
  shipped: "Jo'natdim",
  on_the_way: "Yo'lga chiqardim",
  delivered: 'Topshirdim',
};

export const CALLBACK_DONE_TEXT = 'Bajarildi';
export const CALLBACK_FORBIDDEN_TEXT = "Sizda ruxsat yo'q";
export const CALLBACK_STALE_TEXT = "Holat allaqachon o'zgargan";
export const CALLBACK_FAILED_TEXT = "Xatolik, qaytadan urinib ko'ring";

interface GroupStatusHeader {
  icon: string;
  title: string;
  actorLabel: string | null;
}

function groupStatusHeader(status: OrderStatus, deliveryType: DeliveryType): GroupStatusHeader {
  switch (status) {
    case 'new':
      return { icon: '🆕', title: 'YANGI buyurtma', actorLabel: null };
    case 'confirmed':
      return { icon: '✅', title: 'QABUL QILINDI', actorLabel: 'Qabul qildi' };
    case 'shipped':
      return { icon: '📮', title: "JO'NATILDI", actorLabel: "Jo'natdi" };
    case 'on_the_way':
      return { icon: '🚚', title: "YO'LGA CHIQDI", actorLabel: "Yo'lga chiqardi" };
    case 'delivered':
      return deliveryType === 'pickup'
        ? { icon: '📦', title: 'TOPSHIRILDI', actorLabel: 'Topshirdi' }
        : { icon: '📦', title: 'YETKAZILDI', actorLabel: 'Belgiladi' };
    case 'cancelled':
      return { icon: '❌', title: 'BEKOR QILINDI', actorLabel: 'Bekor qildi' };
  }
}

/** Formats a timestamp as "HH:MM DD.MM" in shop local time. */
export function formatShopTime(date: Date): string {
  const local = new Date(date.getTime() + SHOP_UTC_OFFSET_MINUTES * MS_PER_MINUTE);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())} ${pad(local.getUTCDate())}.${pad(local.getUTCMonth() + 1)}`;
}

export interface OrderStatusForMessage {
  status: OrderStatus;
  /** Who made the latest status change; null for a new order. */
  changedByName: string | null;
  changedAt: Date | null;
}

/** Order message posted to the shop's Telegram group; re-rendered on every status change. */
export function buildGroupOrderMessage(order: OrderForMessage, statusInfo: OrderStatusForMessage): string {
  const header = groupStatusHeader(statusInfo.status, order.deliveryType);
  const lines: string[] = [];
  if (order.paymentMethod === 'installment_request') {
    lines.push("⚠️ <b>NASIYA SO'ROVI</b>");
  }
  lines.push(`${header.icon} <b>${header.title} ${escapeHtml(order.orderNo)}</b>`);
  if (header.actorLabel !== null && statusInfo.changedByName !== null) {
    const time = statusInfo.changedAt !== null ? `, ${formatShopTime(statusInfo.changedAt)}` : '';
    lines.push(`${header.actorLabel}: ${escapeHtml(statusInfo.changedByName)}${time}`);
  }
  lines.push(
    '',
    `Mijoz: ${escapeHtml(order.customerName)}`,
    `Telefon: ${escapeHtml(order.customerPhone)}`,
    buildDeliveryLine(order),
    '',
    buildItemLines(order.items),
    '',
    `Mahsulotlar summasi: ${formatSom(order.itemsTotal)}`,
    `Yetkazish narxi: ${formatSom(order.deliveryFee)}`,
    `Jami: <b>${formatSom(order.grandTotal)}</b>`,
    `To'lov usuli: ${PAYMENT_METHOD_LABELS[order.paymentMethod]}`,
  );
  if (order.paymentMethod === 'installment_request' && order.installmentMonths !== null) {
    const monthly = installmentMonthly(order.grandTotal, order.installmentMonths);
    if (monthly !== null) {
      lines.push(`Oylik to'lov (taxminiy): ${formatSom(monthly)} × ${order.installmentMonths} oy`);
    }
  }
  if (order.comment !== null && order.comment.length > 0) {
    lines.push(`Izoh: ${escapeHtml(order.comment)}`);
  }
  return lines.join('\n');
}

/** Derives the next group-button status from the current status/deliveryType,
 * staying strictly inside what shared/src/orderStatus.ts canTransition allows:
 * new -> confirmed; confirmed -> shipped (delivery) | delivered (pickup);
 * shipped -> on_the_way; on_the_way -> delivered; terminal -> no button. */
function nextGroupButtonStatus(status: OrderStatus, deliveryType: DeliveryType): GroupButtonStatus | null {
  if (status === 'new') {
    return 'confirmed';
  }
  if (status === 'confirmed') {
    return deliveryType === 'pickup' ? 'delivered' : 'shipped';
  }
  if (status === 'shipped') {
    return 'on_the_way';
  }
  if (status === 'on_the_way') {
    return 'delivered';
  }
  return null;
}

/** Next-step button under the group order message; empty keyboard once no group action remains. */
export function buildGroupOrderKeyboard(
  orderId: number,
  status: OrderStatus,
  deliveryType: DeliveryType,
): InlineKeyboardMarkup {
  const next = nextGroupButtonStatus(status, deliveryType);
  if (next === null) {
    return { inline_keyboard: [] };
  }
  return {
    inline_keyboard: [[{
      text: GROUP_BUTTON_TEXTS[next],
      callback_data: `${ORDER_STATUS_CALLBACK_PREFIX}:${orderId}:${next}`,
    }]],
  };
}

/** Parses callback_data produced by buildGroupOrderKeyboard; null for anything else. */
export function parseOrderStatusCallback(
  data: string | undefined,
): { orderId: number; status: GroupButtonStatus } | null {
  if (data === undefined) {
    return null;
  }
  const match = ORDER_STATUS_CALLBACK_PATTERN.exec(data);
  if (match === null) {
    return null;
  }
  const orderId = Number(match[1]);
  if (!Number.isSafeInteger(orderId)) {
    return null;
  }
  return { orderId, status: match[2] as GroupButtonStatus };
}

/** Confirmation message sent to the customer right after order creation. */
export function buildCustomerOrderConfirmationMessage(order: OrderForMessage): string {
  return [
    `Buyurtmangiz yuborildi: <b>${escapeHtml(order.orderNo)}</b>`,
    `Jami: ${formatSom(order.grandTotal)}`,
    "Do'kon buyurtmani qabul qilganda sizga xabar keladi.",
    "Holatini profilingizdagi \"Mening buyurtmalarim\" bo'limidan kuzatishingiz mumkin.",
  ].join('\n');
}

/** Sent to the customer whenever an admin changes the order status. When the
 * new status is `shipped` and a tracking_note was set, it is appended. */
export function buildCustomerStatusMessage(orderNo: string, status: OrderStatus, trackingNote: string | null): string {
  const label = STATUS_LABELS[status];
  const lines = [`Buyurtma <b>${escapeHtml(orderNo)}</b> holati: <b>${label}</b>`];
  if (status === 'shipped' && trackingNote !== null && trackingNote.length > 0) {
    lines.push(`Kuzatuv: ${escapeHtml(trackingNote)}`);
  }
  return lines.join('\n');
}

export function buildStartGreeting(firstName: string): string {
  return `Assalomu alaykum, ${escapeHtml(firstName)}! Dunyo Mobile botiga xush kelibsiz.`;
}

// ---------------------------------------------------------------------------
// Required-channel gate
// ---------------------------------------------------------------------------

const SUBSCRIPTION_CALLBACK_DATA = 'sub:check';

export const SUBSCRIBE_CHANNEL_BUTTON_TEXT = "Kanalga o'tish";
export const SUBSCRIBE_CHECK_BUTTON_TEXT = "A'zo bo'ldim";
export const CALLBACK_SUBSCRIBE_OK_TEXT = "Rahmat! Endi do'kondan foydalanishingiz mumkin";
export const CALLBACK_SUBSCRIBE_MISSING_TEXT = "Siz hali kanalga a'zo bo'lmadingiz";

/** Sent instead of the shop buttons while the user is not in the required channel. */
export function buildSubscribeRequiredMessage(firstName: string, channel: string): string {
  const lines = [
    `Assalomu alaykum, ${escapeHtml(firstName)}!`,
    '',
    "Do'kondan foydalanish uchun avval kanalimizga a'zo bo'lishingiz kerak.",
  ];
  if (channelLink(channel) !== null) {
    lines.push(`Kanal: @${escapeHtml(channel)}`);
  }
  lines.push('', `A'zo bo'lgach "${SUBSCRIBE_CHECK_BUTTON_TEXT}" tugmasini bosing.`);
  return lines.join('\n');
}

/** Channel link (when the channel has a username) plus the re-check button. */
export function buildSubscribeKeyboard(channel: string): InlineKeyboardMarkup {
  const rows: InlineKeyboardMarkup['inline_keyboard'] = [];
  const link = channelLink(channel);
  if (link !== null) {
    rows.push([{ text: SUBSCRIBE_CHANNEL_BUTTON_TEXT, url: link }]);
  }
  rows.push([{ text: SUBSCRIBE_CHECK_BUTTON_TEXT, callback_data: SUBSCRIPTION_CALLBACK_DATA }]);
  return { inline_keyboard: rows };
}

/** True for the callback_data produced by buildSubscribeKeyboard; never collides with the `os:` prefix. */
export function isSubscriptionCallback(data: string | undefined): boolean {
  return data === SUBSCRIPTION_CALLBACK_DATA;
}
