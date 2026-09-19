// Minimal Telegram Bot API client used across the api for order/status
// notifications and webhook replies. Every network call is wrapped so a
// Telegram failure is logged, never thrown into the caller's order/status flow.

import { isSubscribedStatus, isUserNotFoundDescription } from './channelGate.js';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

// editMessageText returns 400 with this description when text and markup are
// unchanged; for an idempotent refresh that is a success, not a failure.
const MESSAGE_NOT_MODIFIED = 'message is not modified';

const HTML_ESCAPE_MAP: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};

/** Escapes text for Telegram's HTML parse_mode (escapes &, <, > only, per
 * the Telegram Bot API HTML style documentation). */
export function escapeHtml(input: string): string {
  return input.replace(/[&<>]/g, (char) => HTML_ESCAPE_MAP[char] ?? char);
}

export interface InlineKeyboardButton {
  text: string;
  web_app?: { url: string };
  callback_data?: string;
  url?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface SendMessageOptions {
  chatId: number | string;
  text: string;
  replyMarkup?: InlineKeyboardMarkup;
}

export interface EditMessageOptions {
  chatId: number | string;
  messageId: number;
  text: string;
  replyMarkup: InlineKeyboardMarkup;
}

// The failure branch carries the status and description because getChatMember
// has to tell "this user is not a member" (a 400) apart from "the bot cannot
// read this channel" (also a 400, but with a different description).
type TelegramCallResult =
  | { ok: true; result: unknown }
  | { ok: false; httpStatus: number | null; description: string | null };

async function callTelegram(botToken: string, method: string, payload: unknown): Promise<TelegramCallResult> {
  try {
    const response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.text();
    if (!response.ok) {
      if (method === 'editMessageText' && body.includes(MESSAGE_NOT_MODIFIED)) {
        return { ok: true, result: null };
      }
      console.error(`telegram ${method} failed: status=${response.status} body=${body}`);
      return { ok: false, httpStatus: response.status, description: parseDescription(body) };
    }
    const parsed = JSON.parse(body) as { result?: unknown };
    return { ok: true, result: parsed.result ?? null };
  } catch (error) {
    console.error(`telegram ${method} threw:`, error);
    return { ok: false, httpStatus: null, description: null };
  }
}

function parseDescription(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { description?: unknown };
    return typeof parsed.description === 'string' ? parsed.description : null;
  } catch {
    return null;
  }
}

function sendMessagePayload(options: SendMessageOptions): Record<string, unknown> {
  return {
    chat_id: options.chatId,
    text: options.text,
    parse_mode: 'HTML',
    reply_markup: options.replyMarkup,
  };
}

/**
 * Sends a Telegram message with HTML parse_mode. Returns true on success,
 * false on any failure (network error or non-2xx response). Never throws:
 * callers (order creation, status change) must not fail because a Telegram
 * notification failed.
 */
export async function sendTelegramMessage(botToken: string, options: SendMessageOptions): Promise<boolean> {
  const result = await callTelegram(botToken, 'sendMessage', sendMessagePayload(options));
  return result.ok;
}

/** Same as sendTelegramMessage, but returns the sent message_id (null on failure). */
export async function sendTelegramMessageForId(botToken: string, options: SendMessageOptions): Promise<number | null> {
  const result = await callTelegram(botToken, 'sendMessage', sendMessagePayload(options));
  if (!result.ok) {
    return null;
  }
  const messageId = (result.result as { message_id?: unknown } | null)?.message_id;
  return typeof messageId === 'number' ? messageId : null;
}

/** Replaces a message's text and inline keyboard. Never throws. */
export async function editTelegramMessage(botToken: string, options: EditMessageOptions): Promise<boolean> {
  const result = await callTelegram(botToken, 'editMessageText', {
    chat_id: options.chatId,
    message_id: options.messageId,
    text: options.text,
    parse_mode: 'HTML',
    reply_markup: options.replyMarkup,
  });
  return result.ok;
}

/** Stops the button spinner on the client, optionally showing a short toast. Never throws. */
export async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  text?: string,
  showAlert?: boolean,
): Promise<boolean> {
  const result = await callTelegram(botToken, 'answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert,
  });
  return result.ok;
}

/**
 * `{ok:false}` means the membership could not be determined (the bot is not an
 * administrator of the channel, the channel does not exist, Telegram is down):
 * callers must fail open, never block the shop over it.
 */
export type ChatMemberResult = { ok: true; subscribed: boolean } | { ok: false };

/** Reads a user's membership in a channel. Never throws. */
export async function getChatMember(botToken: string, chatId: string, userId: number): Promise<ChatMemberResult> {
  const result = await callTelegram(botToken, 'getChatMember', { chat_id: chatId, user_id: userId });
  if (!result.ok) {
    // A user who has never been in the channel is a normal answer, not a failure.
    return isUserNotFoundDescription(result.description) ? { ok: true, subscribed: false } : { ok: false };
  }
  const member = result.result as { status?: unknown; is_member?: unknown } | null;
  if (member === null || typeof member.status !== 'string') {
    console.error('telegram getChatMember returned an unexpected result shape');
    return { ok: false };
  }
  const isMember = typeof member.is_member === 'boolean' ? member.is_member : undefined;
  return { ok: true, subscribed: isSubscribedStatus(member.status, isMember) };
}
