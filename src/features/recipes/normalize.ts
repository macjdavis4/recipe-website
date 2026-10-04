// Ingredient name normalization for pantry matching. Both recipe ingredients
// and pantry entries go through the same function, so consistency matters
// more than perfect English.

const IRREGULAR: Record<string, string> = {
  leaves: "leaf",
  loaves: "loaf",
  halves: "half",
  knives: "knife",
  cookies: "cookie",
  pies: "pie",
  brownies: "brownie",
  anchovies: "anchovy",
  potatoes: "potato",
  tomatoes: "tomato",
  mangoes: "mango",
  avocadoes: "avocado",
  geese: "goose",
  teeth: "tooth",
  mice: "mouse",
};

// Words that end in "s" but are not plurals.
const INVARIANT = new Set([
  "asparagus",
  "couscous",
  "hummus",
  "molasses",
  "swiss",
  "citrus",
  "octopus",
  "series",
  "species",
  "grits",
  "oats",
  "lentils",
  "brussels",
]);

export function singularize(word: string): string {
  if (word.length <= 3 || INVARIANT.has(word)) return word;
  if (IRREGULAR[word]) return IRREGULAR[word];
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (/(ches|shes|sses|xes|zes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s") && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

/** "  Fresh Tomatoes, diced " -> "fresh tomato diced". Every word is singularized. */
export function normalizeIngredientName(name: string): string {
  const words = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(singularize);
  return words.join(" ");
}
