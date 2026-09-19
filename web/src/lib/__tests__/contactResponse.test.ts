import { describe, expect, it } from 'vitest';
import { extractContactResponse } from '../contactResponse.ts';

const SIGNED = 'contact=%7B%22user_id%22%3A1%7D&auth_date=1789660000&hash=abc';

describe('extractContactResponse', () => {
  it('reads the signed string from the event object passed by telegram-web-app.js', () => {
    const event = { status: 'sent', response: SIGNED, responseUnsafe: { contact: { user_id: 1 } } };
    expect(extractContactResponse(event)).toBe(SIGNED);
  });

  it('accepts a plain string from older clients', () => {
    expect(extractContactResponse(SIGNED)).toBe(SIGNED);
  });

  it('returns null when the client timed out fetching the signed contact', () => {
    expect(extractContactResponse({ status: 'sent' })).toBeNull();
    expect(extractContactResponse({ status: 'sent', response: '' })).toBeNull();
    expect(extractContactResponse(undefined)).toBeNull();
  });
});
