// Fails if any browser bundle contains the AI SDK or the names of server-only
// secrets. Run after `next build` (CI runs it too).
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), ".next", "static");
const FORBIDDEN = [
  "@anthropic-ai/sdk",
  "api.anthropic.com",
  "ANTHROPIC_API_KEY",
  "AUTH_SECRET",
  "SPACES_SECRET",
  "SPACES_KEY",
  "GOOGLE_CLIENT_SECRET",
  "DATABASE_URL",
];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) yield* files(full);
    else if (/\.(js|mjs|css|json)$/.test(name)) yield full;
  }
}

let scanned = 0;
const hits = [];
try {
  for (const file of files(root)) {
    scanned++;
    const text = readFileSync(file, "utf8");
    for (const needle of FORBIDDEN)
      if (text.includes(needle)) hits.push(`${path.relative(root, file)}: ${needle}`);
  }
} catch {
  console.error("No .next/static found. Run `pnpm build` first.");
  process.exit(1);
}

if (hits.length) {
  console.error(
    `Server-only code or secret names found in client bundles:\n  ${hits.join("\n  ")}`,
  );
  process.exit(1);
}
console.log(`Client bundle check passed (${scanned} files scanned).`);
