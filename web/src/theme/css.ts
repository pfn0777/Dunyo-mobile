import { TOKEN_NAMES, tokensFor, type Theme, type TokenName } from './tokens.ts';

const HEX_COLOR = /^#([0-9a-f]{6})$/i;

/** '#ffd682' -> '255 214 130' (the channel form Tailwind's `<alpha-value>` needs). */
export function hexToChannels(hex: string): string {
  const match = HEX_COLOR.exec(hex);
  if (match === null || match[1] === undefined) {
    throw new Error(`theme: expected #rrggbb colour, got "${hex}"`);
  }
  const n = parseInt(match[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export function cssVarName(token: TokenName): string {
  return `--color-${token}`;
}

function block(selector: string, theme: Theme): string {
  const tokens = tokensFor(theme);
  const lines = TOKEN_NAMES.map((name) => `${cssVarName(name)}:${hexToChannels(tokens[name])};`);
  return `${selector}{color-scheme:${theme};${lines.join('')}}`;
}

/** `:root` = light (default), `.dark` = dark. Injected into <head> by the Vite plugin. */
export function themeCss(): string {
  return `${block(':root', 'light')}\n${block(':root.dark', 'dark')}`;
}
