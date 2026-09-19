// telegram-web-app.js calls the requestContact callback with an event object
// ({ status, response, responseUnsafe }); older clients passed the signed
// string directly. Only the signed string may be sent to the server.
export function extractContactResponse(raw: unknown): string | null {
  const value =
    typeof raw === 'object' && raw !== null && 'response' in raw ? (raw as { response: unknown }).response : raw;
  return typeof value === 'string' && value.length > 0 ? value : null;
}
