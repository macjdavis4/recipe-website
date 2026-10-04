/** 45 -> "45 min", 60 -> "1 hr", 135 -> "2 hr 15 min" */
export function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

/** "1 1/2 cups flour, sifted" (quantity and unit are optional). */
export function ingredientLine(parts: {
  quantity?: string | null;
  unit?: string | null;
  name: string;
  note?: string | null;
}): string {
  const head = [parts.quantity, parts.unit, parts.name].filter(Boolean).join(" ");
  return parts.note ? `${head}, ${parts.note}` : head;
}
