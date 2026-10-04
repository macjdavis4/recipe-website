// Parse, scale, and format ingredient quantities such as "1 1/2", "½", "0.25",
// and ranges like "2-3". Anything else ("a pinch") is left as written.

const UNICODE_FRACTIONS: Record<string, string> = {
  "½": "1/2",
  "⅓": "1/3",
  "⅔": "2/3",
  "¼": "1/4",
  "¾": "3/4",
  "⅕": "1/5",
  "⅛": "1/8",
  "⅜": "3/8",
  "⅝": "5/8",
  "⅞": "7/8",
};

const NICE_FRACTIONS: [number, string][] = [
  [1 / 8, "1/8"],
  [1 / 4, "1/4"],
  [1 / 3, "1/3"],
  [3 / 8, "3/8"],
  [1 / 2, "1/2"],
  [5 / 8, "5/8"],
  [2 / 3, "2/3"],
  [3 / 4, "3/4"],
  [7 / 8, "7/8"],
];

export type Quantity = { min: number; max?: number };

function parseNumber(text: string): number | null {
  const s = text.trim();
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/))) {
    const [, whole, num, den] = m.map(Number);
    return den ? whole + num / den : null;
  }
  if ((m = s.match(/^(\d+)\/(\d+)$/))) {
    const [, num, den] = m.map(Number);
    return den ? num / den : null;
  }
  if (/^(\d+\.?\d*|\.\d+)$/.test(s)) return Number(s);
  return null;
}

export function parseQuantity(raw: string | null | undefined): Quantity | null {
  if (!raw) return null;
  let text = raw.trim();
  for (const [glyph, ascii] of Object.entries(UNICODE_FRACTIONS)) {
    // "1½" -> "1 1/2", "½" -> "1/2"
    text = text.replace(new RegExp(`(\\d)${glyph}`, "g"), `$1 ${ascii}`).replaceAll(glyph, ascii);
  }
  const range = text.split(/\s*(?:-|–|to)\s*/);
  if (range.length === 2) {
    const [min, max] = range.map(parseNumber);
    return min !== null && max !== null && min > 0 && max > min ? { min, max } : null;
  }
  const value = parseNumber(text);
  return value !== null && value > 0 ? { min: value } : null;
}

export function formatNumber(value: number): string {
  const whole = Math.floor(value);
  const rest = value - whole;
  if (rest < 0.02) return String(whole);
  if (rest > 0.98) return String(whole + 1);
  if (value < 10) {
    for (const [fraction, label] of NICE_FRACTIONS) {
      if (Math.abs(rest - fraction) < 0.02) return whole ? `${whole} ${label}` : label;
    }
  }
  return String(Number(value.toFixed(value < 10 ? 2 : 1)));
}

/** Scales a written quantity by factor. Unparseable text is returned unchanged. */
export function scaleQuantity(raw: string | null | undefined, factor: number): string | null {
  if (!raw) return raw ?? null;
  const q = parseQuantity(raw);
  if (!q || factor === 1) return raw;
  const min = formatNumber(q.min * factor);
  return q.max === undefined ? min : `${min}-${formatNumber(q.max * factor)}`;
}
