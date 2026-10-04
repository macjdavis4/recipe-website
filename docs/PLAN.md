# Larder: build plan

## Context
The repo holds only `CLAUDE.md` and `.env.example`. We are building Larder, a recipe sharing app (Next.js 15, Prisma/Postgres, Auth.js v5, Anthropic AI), in 7 phases. Each phase ends with lint + typecheck + tests, a commit, a PR, and a short summary before the next phase starts.

Tooling here: Node 22, pnpm 10, Docker 29, and Chromium preinstalled for Playwright.

## Approved extra dependencies
- Added: `next-themes`, `sonner`, `@auth/prisma-adapter`, `tsx` (dev), `eslint-config-prettier`, `prettier-plugin-tailwindcss`, and the packages shadcn always installs (cva, clsx, tailwind-merge, tw-animate-css, `@radix-ui/*`).
- Not added: `remark-gfm` (plain react-markdown only). I'll write my own code for singularizing, slugs, fraction parsing, and image signature checks. Steps get up/down buttons instead of drag-and-drop, and the shadcn Sheet stands in for vaul.
- Lighthouse runs one-off through `pnpm dlx lighthouse` and is never added to package.json. If the network blocks it, I'll say so and skip it.
- If I find I need anything else, I'll stop and ask first.

## Folder structure
```
.
├── CLAUDE.md  README.md  .env.example  docker-compose.yml (dev Postgres)
├── next.config.ts  middleware.ts  components.json  eslint.config.mjs  .prettierrc
├── vitest.config.ts  playwright.config.ts
├── prisma/  schema.prisma  migrations/  seed.ts
├── public/  images/placeholder-recipe.webp  seed/*.webp  uploads/ (gitignored)
├── deploy/  Dockerfile  entrypoint.sh  docker-compose.prod.yml  Caddyfile
│            backup/ (Dockerfile, backup.sh, crontab)  server-setup.sh
├── .github/workflows/  ci.yml (PRs)  deploy.yml (main)
├── e2e/  fixtures.ts  guest.spec.ts  recipe-crud.spec.ts  ownership.spec.ts
└── src/
    ├── app/
    │   ├── layout.tsx  page.tsx  not-found.tsx  forbidden.tsx  error.tsx  globals.css
    │   ├── (auth)/login  (auth)/signup
    │   ├── recipes/page.tsx  recipes/new  recipes/[slug]/page.tsx  recipes/[slug]/edit
    │   ├── u/[id]  pantry  assistant
    │   └── api/  auth/[...nextauth]  ai/chat (stream)  ai/pantry  uploads  health
    ├── components/  ui/ (shadcn)  layout/ (header, mobile-sheet, bottom-tabs, theme-toggle, user-menu)
    ├── features/
    │   ├── auth/     actions.ts  schemas.ts  login-form.tsx  signup-form.tsx  login-rate-limit.ts
    │   ├── recipes/  actions.ts  queries.ts  schemas.ts  ownership.ts (assertRecipeOwner)
    │   │             scaling.ts (fractions)  normalize.ts  slug.ts  components/ (card, filters, form/*, servings-adjuster, checklist)
    │   ├── ai/       chat-panel.tsx  ask-about-recipe.tsx  markdown.tsx  rate-limit.ts
    │   ├── pantry/   ranking.ts  schemas.ts  components/
    │   └── profile/  queries.ts  components/
    └── lib/
        ├── env.ts (Zod env, server only)  db.ts (Prisma singleton)  auth.ts  auth.config.ts (edge safe)
        ├── ai/  provider.ts (AIProvider interface)  anthropic.ts  mock.ts  prompts.ts  index.ts (picks provider)
        └── storage/  adapter.ts (StorageAdapter)  local.ts  spaces.ts  index.ts (STORAGE_DRIVER)  file-signature.ts
```
Unit tests live next to their code as `*.test.ts`.

## Git flow
I'll work on one branch per phase (`phase-1-foundation`, `phase-2-auth`, and so on). If the previous phase's PR isn't merged yet, the next branch starts from it and its PR targets it, so each diff stays reviewable. If it is merged, the branch starts from `main`. I commit after each step and open the PR at the end of the phase.

## Phases (as specified, plus implementation notes)
1. **Foundation**: install Next 15 (pinned to 15.x, since the create-next-app default is now 16) with Tailwind v4, shadcn, ESLint + Prettier, `docker-compose.yml` with Postgres 16, the full Prisma schema with the first migration, `src/lib/env.ts`, and the app shell. The shell has a sticky header, a mobile sheet menu, and a bottom tab bar. Theming uses next-themes with Fraunces and Inter from next/font, and green, terracotta, and off-white tokens checked for AA contrast in both themes. First Vitest smoke test (env schema).
2. **Auth**: Auth.js v5 split config. `auth.config.ts` is edge safe and used by middleware. `auth.ts` adds Prisma, bcrypt cost 12, and Credentials, plus Google only when its env vars are set. Includes signup and login pages, a generic login error, middleware redirects with callbackUrl, and a DB-backed login rate limit.
3. **Recipes CRUD**: every item in the Phase 3 spec. Ownership goes through `assertRecipeOwner` in every update and delete action. Uploads go through `/api/uploads`, which checks magic bytes and the 5 MB limit. Form drafts are saved to sessionStorage. Vitest covers scaling, normalization, schemas, and ownership as each piece lands.
4. **AI**: the `AIProvider` interface with an Anthropic implementation (non-streaming plus streaming) and a mock provider used in tests (`AI_PROVIDER=mock` or NODE_ENV=test). Chat streams from `/api/ai/chat` through a server-side system prompt and Zod-validated input (2,000 characters, last 20 messages). Pantry runs community ranking in SQL and AI ideas through Zod with one retry. "Save as my recipe" fills the form with the idea through sessionStorage.
5. **Polish/tests/seed**: seed data, the full Vitest suite, Playwright against a `larder_test` database at desktop and 390px, the mocked AI, a Lighthouse pass, and OG metadata.
6. **Deploy**: as specified. Adds `/api/health`, a multi-stage Dockerfile, the production compose file, Caddy, a backup container built on `postgres:16-alpine` that uses crond and pg_dump, with Alpine's `aws-cli` package for uploads to Spaces and 14-day pruning. (a system package, not an npm one), `server-setup.sh`, and the deploy workflow.
7. **Docs**: README covering setup, env vars, scripts, architecture, the DigitalOcean guide, and future ideas.

## AI runs only on the back end (user requirement)
- The browser never talks to Anthropic. It only calls our own `/api/ai/chat` and `/api/ai/pantry`.
- `src/lib/ai/*` starts with `import "server-only"`, so the build fails if any client component imports it. `ANTHROPIC_API_KEY` and `AI_MODEL` are read only in `src/lib/env.ts` (server only), and nothing AI-related uses NEXT_PUBLIC_.
- The server builds the system prompt and the recipe context, loading the recipe from the DB by id rather than trusting text from the client. The client sends only the user's messages.
- On the server, each request goes through auth, then the rate limit, then Zod validation of input and output, then the AiUsage log. The client gets back either the streamed text or already-validated JSON.
- Tests check that no client bundle contains `@anthropic-ai/sdk` or the key's env name.

## Conflicts and decisions to flag
1. **Server Actions can't return HTTP 403.** CLAUDE.md wants Server Actions for mutations, and also wants a 403. My approach: `assertRecipeOwner` throws a `ForbiddenError`. On edit pages I call Next 15's `forbidden()`, which renders `forbidden.tsx` with a real 403 status. That needs the **experimental** `authInterrupts` flag. Server actions return `{ ok: false, status: 403 }` and the UI shows the friendly error. The Playwright direct-call test checks that result and that the recipe still exists.
2. **The pantry AI isn't streaming, but it needs a 429.** CLAUDE.md limits route handlers to streaming AI and uploads. I'll still make pantry ideas a route handler (`/api/ai/pantry`) so the 429 is a real status code and every AI endpoint works the same way. `/api/health` is a route handler too, because the spec requires it.
3. **The login rate limit needs storage that isn't in the data model.** In-memory storage would break the "stateless container" rule, so I'll add a small `LoginAttempt` table (key, createdAt) and prune old rows.
4. **Every service needs a healthcheck, including the backup job.** Its healthcheck will check that crond is running.
5. **CSP vs. Next.js inline scripts.** A strict CSP needs per-request nonces in middleware, which turns off static rendering. I'll use a "sensible" Caddy CSP with `script-src 'self' 'unsafe-inline'` and say so in the README.
6. **CI scope.** The spec runs lint, typecheck, and unit tests only on pushes to main. I'll also run them, plus Playwright, on pull requests in `ci.yml`. Deploy only runs on main.
7. **bcrypt on Alpine.** bcrypt is native code. Recent bcrypt versions ship musl prebuilds; if one fails in the Docker build, I'll add build tools to the deps stage rather than swap libraries.
8. **Seed images in production.** The seed's local placeholder images are served from `/public/seed`, while new uploads go to Spaces. That's intentional, and the README will say so.

## Verification (each phase)
- `pnpm lint`, `pnpm typecheck`, `pnpm test`. From Phase 5 on, also `pnpm test:e2e` against `docker compose up -d` Postgres, using a separate `larder_test` database.
- Run `pnpm dev` and spot-check pages at 360px and desktop with Playwright screenshots.
- No real AI calls: tests use the mock provider.
- Phase 6: build the image locally with `docker build -f deploy/Dockerfile .` and run the production compose file with a local override (HTTP only) to check healthchecks and `/api/health`. Never touch the Droplet.
