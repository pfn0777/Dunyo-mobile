import { describe, expect, it } from 'vitest';
import { isChannelGateExemptPath } from '../src/lib/channelGateExempt';

describe('isChannelGateExemptPath', () => {
  it('exempts /me, /me/contact and /me/channel-check', () => {
    expect(isChannelGateExemptPath('/me')).toBe(true);
    expect(isChannelGateExemptPath('/me/contact')).toBe(true);
    expect(isChannelGateExemptPath('/me/channel-check')).toBe(true);
  });

  it('does not exempt every other customer route', () => {
    expect(isChannelGateExemptPath('/orders')).toBe(false);
    expect(isChannelGateExemptPath('/favorites')).toBe(false);
    expect(isChannelGateExemptPath('/addresses')).toBe(false);
    expect(isChannelGateExemptPath('/me/extra')).toBe(false);
  });
});
