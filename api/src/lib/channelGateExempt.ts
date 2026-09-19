// Which customer-API paths are reachable while the required-channel gate
// blocks the user. Extracted as a pure decision (no Fastify/DB types) so it
// is trivially unit-testable: get this wrong and either a blocked user can
// never see the "join the channel" screen (missing an exempt path) or the
// gate becomes a no-op (an extra path slipping in here bypasses it).

export const CHANNEL_GATE_EXEMPT_PATHS: readonly string[] = ['/me', '/me/contact', '/me/channel-check'];

export function isChannelGateExemptPath(path: string): boolean {
  return CHANNEL_GATE_EXEMPT_PATHS.includes(path);
}
