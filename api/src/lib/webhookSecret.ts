// Constant-time comparison for the Telegram webhook secret header, so a
// timing attack can't be used to guess it byte-by-byte.

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function isValidWebhookSecret(received: string | null, expected: string): boolean {
  if (received === null) {
    return false;
  }
  return constantTimeEqual(received, expected);
}
