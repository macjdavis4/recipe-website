# The Cushman Cookbook: Recipe Sharing App

A community recipe sharing site with two AI features: a cooking Q&A assistant and a pantry-based recipe suggester. Anyone can browse recipes. Only registered users can create recipes, and users can edit or delete only their own.

## Stack
- Next.js 15 (App Router, Server Components, Server Actions) with TypeScript in strict mode
- Tailwind CSS and shadcn/ui (Radix primitives), lucide-react icons
- PostgreSQL 16 with Prisma ORM (Docker Compose locally and in production on a DigitalOcean Droplet)
- Auth.js v5 (next-auth@beta): Credentials provider with bcrypt, JWT session strategy, optional Google provider enabled only when GOOGLE_CLIENT_ID is set
- Zod for all input validation (forms, server actions, route handlers, AI output)
- react-hook-form with zodResolver for forms
- Anthropic SDK (@anthropic-ai/sdk) behind an `AIProvider` interface in `src/lib/ai/`
- Image storage behind a `StorageAdapter` interface: local disk (`/public/uploads`) in dev, DigitalOcean Spaces (S3-compatible, via @aws-sdk/client-s3) in production, chosen by `STORAGE_DRIVER`
- Production: one DigitalOcean Droplet running Docker Compose (app, Postgres, Caddy for automatic HTTPS, nightly backup job), deployed by GitHub Actions through GitHub Container Registry
- Vitest for unit tests, Playwright for end-to-end tests
- pnpm as the package manager

## Commands
- `pnpm dev` start dev server
- `docker compose up -d` start local Postgres
- `pnpm db:migrate` run Prisma migrations
- `pnpm db:seed` load demo users and recipes
- `pnpm lint` and `pnpm typecheck`
- `pnpm test` unit tests, `pnpm test:e2e` Playwright

## Deployment rules
- `next.config` uses `output: "standalone"` and allows the Spaces CDN domain in `images.remotePatterns`.
- Production config lives in `deploy/` (Dockerfile, docker-compose.prod.yml, Caddyfile, backup and server setup scripts).
- Every production service uses `restart: unless-stopped` and a healthcheck. Only Caddy publishes ports (80, 443). Postgres is never exposed outside the Docker network.
- Migrations run with `prisma migrate deploy` when the app container starts. Never use `migrate dev` or `db push` in production.
- Keep everything 12-factor: all config comes from env vars, and the app container holds no state.

## Working in Claude Code cloud sessions
- This project is built in Claude Code on the web. Each session is a fresh Ubuntu VM with the repo cloned, and it can pause or be rebuilt between phases. Never rely on state outside the repo.
- For local dev and tests, start Postgres with `docker compose up -d` (Docker is available). If Docker has trouble, fall back to `service postgresql start`.
- Never commit secrets. Real values live in the cloud environment's variables (dev only) and in GitHub Actions secrets (production).
- Never call the real AI API in tests. Use the mocked provider.
- Do not attempt to SSH into or deploy to the Droplet from a session. Production deploys happen only through GitHub Actions after a merge to main.
- If installing Playwright browsers fails because of network restrictions, say so and continue. Do not try workarounds.
- Commit after each completed step with a clear message, and open a pull request at the end of each phase.

## Data model
- **User**: id, name, email (unique), passwordHash (nullable for OAuth users), image, createdAt. Plus the Auth.js Account and VerificationToken tables.
- **Recipe**: id, slug (unique), title, description, imageUrl, prepMinutes, cookMinutes, servings, difficulty (EASY | MEDIUM | HARD), cuisine, authorId, createdAt, updatedAt
- **Ingredient**: id, recipeId, position, quantity (string, allows "1/2"), unit, name, normalizedName (lowercased, trimmed, singularized for matching), note
- **Step**: id, recipeId, position, text
- **Tag**: id, name (unique). **RecipeTag**: join table. Dietary labels (vegan, gluten-free, etc.) are tags.
- **AiUsage**: id, userId, kind (CHAT | PANTRY), createdAt. Used for rate limiting.
- Deleting a Recipe cascades to its Ingredients, Steps, and RecipeTags.

## Non-negotiable rules
1. **Authorization lives on the server.** Every create, update, and delete checks the session. Every update and delete also verifies `recipe.authorId === session.user.id` and returns 403 otherwise. Hiding buttons in the UI is a convenience, not security. Put this check in one helper (`assertRecipeOwner`) and use it everywhere.
2. **Reads are public.** Recipe list, recipe detail, search, and profile pages work without login.
3. **Secrets never reach the client.** The AI key and storage tokens are only read in server code. Never prefix them with NEXT_PUBLIC_.
4. **Validate everything with Zod** on the server, including AI responses before rendering or saving them.
5. **AI requires login and is rate limited** to `AI_RATE_LIMIT_PER_HOUR` requests per user (default 30), tracked in AiUsage. Return 429 with a friendly message when exceeded.
6. **AI output is untrusted text.** Render it as sanitized markdown (react-markdown, no raw HTML).
7. **Mobile first.** Every page must work at 360px wide with no horizontal scroll and tap targets of at least 44px.
8. **Accessible.** Semantic HTML, labeled form fields, visible focus states, alt text on images, AA color contrast in both themes.

## Conventions
- Feature folders under `src/features/` (recipes, auth, ai, pantry, profile), shared UI in `src/components/ui`
- Server Actions for form mutations; route handlers only for streaming AI and uploads
- Use `next/image` for all recipe photos
- Keep components small; no file over about 250 lines
- Write tests alongside features, not at the end
- Use clear, direct copy in the UI. No em dashes in UI text.
- The site name is "The Cushman Cookbook" and lives only in `src/lib/site.ts` (`SITE_NAME`). Never hardcode it. Internal identifiers (package name, `larder` database and Postgres user, Docker resources) keep the original project codename "larder" on purpose.
