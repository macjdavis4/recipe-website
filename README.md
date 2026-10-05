# The Cushman Cookbook

A community recipe site. Anyone can browse, search, and cook from shared recipes. Registered cooks can share their own recipes, and edit or delete only their own. Two AI features help in the kitchen: a cooking assistant you can chat with (on its own page or about a specific recipe), and a pantry tool that finds recipes for what you already have.

The project codename is **Larder**, which you will still see in internal names (the `larder` database, the package name, Docker resources). The site name lives in one place: `src/lib/site.ts`.

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Run it locally](#run-it-locally)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Testing](#testing)
- [Architecture](#architecture)
- [Deploying to DigitalOcean](#deploying-to-digitalocean)
- [Operating production](#operating-production)
- [Future ideas](#future-ideas)

## Features

- **Recipes for everyone.** Browse, search (title, description, cuisine, and ingredient names), and filter by cuisine, difficulty, and tag. Every read page works without an account.
- **Cooking-friendly recipe pages.** A servings adjuster scales quantities as kitchen fractions (`1 1/2 cups` at 4 servings becomes `2 1/4 cups` at 6), and an ingredient checklist lets you tick things off.
- **Share and edit your own recipes.** Photo upload, ingredients and steps you can reorder, tags, and unsaved drafts that survive a reload. Only the author can edit or delete, and the server checks this on every change.
- **Cooking assistant.** Streaming answers about techniques, swaps, timing, and food safety, plus "Ask about this recipe" on every recipe page.
- **Cook from your pantry.** List what you have to see community recipes ranked by fewest missing ingredients, then ask AI for more ideas and save one as your own recipe.
- **Accounts.** Email and password sign-up, with optional Google sign-in.
- **Built for phones.** Works at 360px wide with 44px tap targets, light and dark themes, and AA contrast.

## Tech stack

| Area       | Choice                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App        | Next.js 15 (App Router, Server Components, Server Actions), TypeScript (strict)                                                                               |
| UI         | Tailwind CSS v4, shadcn/ui on Radix, lucide-react, next-themes, Fraunces and Inter                                                                            |
| Data       | PostgreSQL 16, Prisma 6                                                                                                                                       |
| Auth       | Auth.js v5: credentials with bcrypt, JWT sessions, optional Google                                                                                            |
| Validation | Zod for forms, actions, route handlers, env, and AI output; react-hook-form                                                                                   |
| AI         | Anthropic SDK behind an `AIProvider` interface, with a mock for tests                                                                                         |
| Images     | `StorageAdapter`: local disk in development, DigitalOcean Spaces in production                                                                                |
| Tests      | Vitest (unit), Playwright (end to end, desktop and 390px)                                                                                                     |
| Production | One DigitalOcean Droplet running Docker Compose: app, Postgres, Caddy (HTTPS), nightly backups. Deployed by GitHub Actions through GitHub Container Registry. |

## Run it locally

You need **Node 22**, **pnpm 10**, and **Docker**.

```bash
git clone https://github.com/macjdavis4/recipe-website.git
cd recipe-website
pnpm install

cp .env.example .env
# Set AUTH_SECRET in .env to the output of:
openssl rand -base64 33
# No Anthropic key? Set AI_PROVIDER="mock" to use the built-in stand-in.

docker compose up -d   # Postgres 16 on localhost:5432 (also creates larder_test)
pnpm db:migrate        # apply migrations
pnpm db:seed           # 3 demo cooks and 8 recipes
pnpm dev               # http://localhost:3000
```

Log in as a demo cook, for example `maya@example.com`, with the password `cookbook-demo` (or your `SEED_PASSWORD`). The seed is safe to run again: it updates the demo users and replaces the demo recipes.

If Docker is not available, any Postgres 16 works. Point `DATABASE_URL` at it.

## Environment variables

All configuration comes from environment variables, validated at start-up by `src/lib/env.ts`. Errors name the variable but never print its value. Secrets are read only in server code and never use the `NEXT_PUBLIC_` prefix.

| Variable                                                                                             | Required      | Description                                                                                                                  |
| ---------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                                       | Yes           | Postgres connection string. In production, compose builds it from the `POSTGRES_*` values.                                   |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`                                                  | Compose       | Used by both Docker Compose files. Use a hex password (`openssl rand -hex 32`) so it is safe inside a URL.                   |
| `AUTH_SECRET`                                                                                        | Yes           | 32+ random characters for signing sessions: `openssl rand -base64 33`.                                                       |
| `AUTH_URL`                                                                                           | Yes           | The public site URL (`http://localhost:3000` locally, `https://your-domain` in production). Also used for link-preview URLs. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                                           | No            | Turns on Google sign-in when both are set.                                                                                   |
| `ANTHROPIC_API_KEY`                                                                                  | Production    | Required in production unless `AI_PROVIDER=mock`.                                                                            |
| `AI_MODEL`                                                                                           | No            | Claude model for both AI features. Default `claude-haiku-4-5-20251001`.                                                      |
| `AI_RATE_LIMIT_PER_HOUR`                                                                             | No            | AI requests per user per hour. Default 30.                                                                                   |
| `AI_PROVIDER`                                                                                        | No            | `mock` or `anthropic`. Blank means `anthropic`, except tests, which always use the mock.                                     |
| `STORAGE_DRIVER`                                                                                     | No            | `local` (default, files in `public/uploads`) or `spaces`. Use `spaces` in production.                                        |
| `SPACES_KEY`, `SPACES_SECRET`, `SPACES_REGION`, `SPACES_ENDPOINT`, `SPACES_BUCKET`, `SPACES_CDN_URL` | With `spaces` | DigitalOcean Spaces credentials, bucket, and CDN URL for recipe photos.                                                      |
| `SPACES_BACKUP_BUCKET`                                                                               | Production    | Private Spaces bucket for nightly database backups.                                                                          |
| `BACKUP_RETENTION_DAYS`                                                                              | No            | Days of backups to keep. Default 14.                                                                                         |
| `DOMAIN`                                                                                             | Production    | Domain Caddy serves and gets certificates for, e.g. `recipes.example.com`.                                                   |
| `SEED_PASSWORD`                                                                                      | No            | Password for demo users. Default `cookbook-demo`; required to seed in production.                                            |
| `E2E_DATABASE_URL`                                                                                   | No            | Overrides the end-to-end database (defaults to `DATABASE_URL` renamed to `larder_test`).                                     |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE`                                                                     | No            | Path to a preinstalled Chromium when `playwright install` cannot download one.                                               |

## Scripts

| Command                             | What it does                                                               |
| ----------------------------------- | -------------------------------------------------------------------------- |
| `pnpm dev`                          | Start the dev server on port 3000.                                         |
| `pnpm build` / `pnpm start`         | Production build (standalone output) and server.                           |
| `pnpm lint`                         | ESLint.                                                                    |
| `pnpm format` / `pnpm format:check` | Prettier (with Tailwind class sorting).                                    |
| `pnpm typecheck`                    | TypeScript, no emit.                                                       |
| `pnpm test` / `pnpm test:watch`     | Vitest unit tests.                                                         |
| `pnpm test:e2e`                     | Playwright end-to-end tests (builds the app first).                        |
| `pnpm check:bundle`                 | After a build, fails if client bundles mention the AI SDK or secret names. |
| `pnpm db:migrate`                   | Create and apply migrations in development (`prisma migrate dev`).         |
| `pnpm db:deploy`                    | Apply migrations without creating new ones (`prisma migrate deploy`).      |
| `pnpm db:seed`                      | Load demo users and recipes.                                               |
| `pnpm db:generate`                  | Regenerate the Prisma client (also runs after install).                    |

## Testing

**Unit tests** (`pnpm test`) sit next to the code they cover. They include:

- Authorization: the `assertRecipeOwner` helper, and 401/403/404 results from every recipe action, with no writes on failure.
- Login and signup rate limits.
- Upload checks: magic bytes, the 5 MB limit, and ownership of storage keys.
- Fraction scaling, ingredient normalization, slugs, and Zod schemas.
- AI routes with a stub provider: 401, 429, 400, streaming, refusals, and one retry on bad output.
- Markdown sanitization of AI answers.
- AA contrast for every theme color pair.
- Deployment rules, such as healthchecks and that only Caddy publishes ports.

**End-to-end tests** (`pnpm test:e2e`) run a production build against a separate `larder_test` database, at desktop width and at 390px. Global setup migrates, empties, and seeds that database, and refuses to run against any database with another name. The server runs with `AI_PROVIDER=mock`, so tests never call the real AI API. The suite covers:

- guest browsing, search, filters, and pantry matching;
- sign-up and login;
- creating, editing, and deleting a recipe, and restoring a draft;
- a non-author getting a 403 page;
- a delete server action replayed with another user's session (403) and with none (401);
- AI streaming, the hourly limit, and saving a pantry idea;
- no horizontal scrolling on any page.

## Architecture

```
src/
  app/                    routes: pages, /api/auth, /api/ai/{chat,pantry}, /api/uploads, /api/health
  components/             layout (header, mobile menu, bottom tabs), shared form fields, shadcn/ui
  features/
    auth/                 schemas, server actions, credential checks, login rate limit, forms
    recipes/              queries, actions, schemas, ownership (assertRecipeOwner), scaling,
                          normalize, slug, components (cards, filters, form, servings, checklist)
    ai/                   chat UI, Markdown renderer, rate limit, request schemas
    pantry/               SQL ranking, matching, schemas, AI ideas UI
  lib/
    env.ts                Zod-validated server env (server-only)
    db.ts, auth.ts        Prisma client, Auth.js setup (auth.config.ts is edge safe, for middleware)
    ai/                   AIProvider interface, Anthropic and mock providers, prompts (server-only)
    storage/              StorageAdapter, local and Spaces drivers, file signatures
prisma/                   schema, migrations, idempotent seed
deploy/                   Dockerfile, compose files, Caddyfile, backup image, server setup
e2e/                      Playwright tests and fixtures
```

### Authorization

Every create, update, and delete checks the session on the server. Updates and deletes also go through `assertRecipeOwner` (`src/features/recipes/ownership.ts`), the single ownership check. Hiding buttons in the UI is only a convenience.

- Server Actions cannot return an HTTP status, so they return `{ ok: false, status: 403 }`.
- The edit page calls Next's `forbidden()` (experimental `authInterrupts`) for a real 403 response.
- Middleware redirects guests away from protected pages with a `callbackUrl`. Only same-site paths are accepted, so the redirect cannot be abused.

### Login protection

- One generic error for every login failure.
- An unknown email still runs a bcrypt compare, so response timing does not reveal which accounts exist.
- Failed logins are counted per email and per IP in a `LoginAttempt` table, which keeps the app container stateless.
- Signups are limited per IP.
- The client IP is the last `X-Forwarded-For` hop, the one added by Caddy.

### AI requests

The browser only ever calls our own routes; it never talks to Anthropic. Each AI request:

1. checks the session (401);
2. checks the hourly limit in `AiUsage` (429 with `Retry-After`);
3. validates input with Zod (400);
4. logs usage, then calls the provider.

On the server side:

- **Prompts:** the server builds the system prompt.
- **Recipe context:** loaded from the database by id, never taken from the client. User-written recipe text is wrapped in tags and marked as data, not instructions.
- **Pantry ideas:** validated against a strict Zod schema, with one retry.
- **Answers:** rendered with react-markdown with raw HTML skipped, images dropped, and unsafe links removed.
- **Keeping the key server-side:** `src/lib/ai` is `server-only`, and `pnpm check:bundle` scans client bundles for leaks.

### Images

Uploads go through `/api/uploads`:

- Login required, 5 MB maximum.
- The type is detected from magic bytes (JPEG, PNG, WebP), never from the browser's MIME type.
- Storage keys look like `recipes/<userId>/<uuid>.<ext>`, so a recipe can only use its author's own photos, and cleanup never touches another user's files.

In production, photos go to Spaces and are served from its CDN. The demo seed's photos ship inside the image under `public/seed`.

### Production stack

Caddy (HTTPS, security headers, CSP) proxies to the app. The app runs `prisma migrate deploy` on start, then serves from the Next.js standalone build. Postgres and the app are only reachable on the internal Docker network. A backup container runs `pg_dump` nightly to Spaces.

### Decisions and trade-offs

- **Pantry ideas use a route handler, not a Server Action,** so a 429 is a real status code, consistent with chat.
- **The CSP allows `'unsafe-inline'` scripts.** Next.js injects inline bootstrap scripts, and per-request nonces would turn off static rendering. Everything else in the CSP is strict.
- **Staples:** salt, pepper, oil, and water count toward pantry matches but cannot qualify a recipe on their own.
- **Pinned to Prisma 6,** because Prisma 7 requires an extra driver adapter package.

## Deploying to DigitalOcean

This is a one-time setup. After it, every merge to `main` deploys automatically. The deploy workflow skips the deploy step until the secrets below exist, so merging before you finish does no harm.

### 1. Create the Droplet

- Ubuntu 24.04, Basic plan. 2 GB of RAM is comfortable; 1 GB works with the swap the setup script adds. The app image is built by GitHub Actions, not on the server (only the small backup image builds there).
- Add your own SSH key when creating it.
- Optional: enable DigitalOcean backups or snapshots as a second safety net.

### 2. Create two Spaces buckets and a key

- **Images bucket** (e.g. `larder-images`): turn on the CDN, and keep "file listing" restricted. Photos are uploaded with public-read access, so the site can show them.
- **Backups bucket** (e.g. `larder-backups`): private, no CDN.
- **Access key:** create a Spaces access key. Its key and secret become `SPACES_KEY` and `SPACES_SECRET`.
- **Region values:** for a region like `nyc3`, the endpoint is `https://nyc3.digitaloceanspaces.com` and the CDN URL is `https://larder-images.nyc3.cdn.digitaloceanspaces.com`.

### 3. Point your domain at the Droplet

Create an `A` record (and `AAAA` if you use IPv6) for your domain to the Droplet's IP. Caddy gets HTTPS certificates automatically once DNS resolves.

### 4. Prepare the server

Create a key pair that GitHub Actions will use to deploy (no passphrase):

```bash
ssh-keygen -t ed25519 -N "" -C "github-actions-deploy" -f larder-deploy
```

Copy the setup script to the Droplet and run it as root with the public key:

```bash
scp deploy/server-setup.sh root@YOUR_DROPLET_IP:
ssh root@YOUR_DROPLET_IP "DEPLOY_PUBLIC_KEY='$(cat larder-deploy.pub)' bash server-setup.sh"
```

It installs Docker and the compose plugin, sets up log rotation, creates a `deploy` user (in the `docker` group) holding only that key, and creates `/opt/larder`. It also allows SSH logins by key only, opens only SSH, 80, and 443 in `ufw`, adds 2 GB of swap, and turns on unattended security upgrades. It is safe to re-run.

### 5. Add GitHub secrets and a variable

In the repository, go to **Settings > Secrets and variables > Actions**.

| Secret               | Value                                                                |
| -------------------- | -------------------------------------------------------------------- |
| `DEPLOY_HOST`        | Droplet IP or hostname                                               |
| `DEPLOY_USER`        | `deploy`                                                             |
| `DEPLOY_SSH_KEY`     | Contents of `larder-deploy` (the private key)                        |
| `DEPLOY_KNOWN_HOSTS` | Output of `ssh-keyscan YOUR_DROPLET_IP` (pins the server's host key) |
| `PRODUCTION_ENV`     | The full production `.env` file (below)                              |

| Variable         | Value                                                        |
| ---------------- | ------------------------------------------------------------ |
| `PRODUCTION_URL` | `https://your-domain`, used for the post-deploy health check |

A starting point for `PRODUCTION_ENV`:

```bash
DOMAIN="recipes.example.com"
POSTGRES_USER="larder"
POSTGRES_PASSWORD="<openssl rand -hex 32>"
POSTGRES_DB="larder"
AUTH_SECRET="<openssl rand -base64 33>"
AUTH_URL="https://recipes.example.com"
ANTHROPIC_API_KEY="<your key>"
AI_MODEL="claude-haiku-4-5-20251001"
AI_RATE_LIMIT_PER_HOUR=30
STORAGE_DRIVER="spaces"
SPACES_KEY="<spaces key>"
SPACES_SECRET="<spaces secret>"
SPACES_REGION="nyc3"
SPACES_ENDPOINT="https://nyc3.digitaloceanspaces.com"
SPACES_BUCKET="larder-images"
SPACES_CDN_URL="https://larder-images.nyc3.cdn.digitaloceanspaces.com"
SPACES_BACKUP_BUCKET="larder-backups"
# Optional: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
```

To enable Google sign-in, create an OAuth client in Google Cloud with the redirect URI `https://your-domain/api/auth/callback/google`, and add both values.

Optional: under **Settings > Environments**, add required reviewers to the `production` environment so each deploy waits for your approval.

### 6. Deploy

Merge to `main`, or run the **Deploy** workflow by hand from the Actions tab. It runs these steps:

1. Runs lint, typecheck, and unit tests.
2. Builds and pushes `ghcr.io/macjdavis4/recipe-website:<commit>` (and `:latest`).
3. Copies `deploy/` and your `.env` to `/opt/larder`.
4. Pulls the image with a short-lived token and restarts the stack. Migrations run as the app starts.
5. Waits for `https://your-domain/api/health` to report `ok`, and prints logs if it does not.

Production starts with an empty database. The demo seed is meant for development.

## Operating production

Run these on the Droplet as the `deploy` user, from `/opt/larder`. `dc` is shorthand for `docker compose -f docker-compose.prod.yml`.

| Task              | Command                                                                                |
| ----------------- | -------------------------------------------------------------------------------------- |
| Status and health | `dc ps`                                                                                |
| Logs              | `dc logs -f app` (or `caddy`, `db`, `backup`)                                          |
| Health check      | `curl https://your-domain/api/health`                                                  |
| Back up now       | `dc exec backup backup.sh`                                                             |
| List backups      | `dc exec backup restore.sh`                                                            |
| Restore a backup  | `dc stop app && dc exec backup restore.sh larder-YYYYMMDD-HHMMSS.dump && dc start app` |
| Database shell    | `dc exec db psql -U larder larder`                                                     |

- **Changing configuration:** edit the `PRODUCTION_ENV` secret, then re-run the Deploy workflow. The server's `.env` is rewritten on every deploy, so edits made on the server do not last.
- **Rolling back:** set `IMAGE_TAG` in `/opt/larder/.env` to an earlier commit SHA (every deploy's image stays in GHCR), then run `dc up -d app`. The next deploy from `main` replaces it. Migrations only move forward, so roll back code only when its schema is still compatible. Restore a backup if not.
  - Earlier images usually remain on the server. If one is not there and the package is private, log in first: `docker login ghcr.io` with a personal access token that has `read:packages`.
- **Backups:** these run nightly at 03:15 UTC and keep 14 days. Test a restore occasionally.
- **Firewall:** Docker manages its own firewall rules for published ports. That is fine here, because only Caddy publishes any (80 and 443).
- **Checking the stack locally before a deploy:** build the image, then run it over plain HTTP with the local override:

  ```bash
  docker build -f deploy/Dockerfile -t larder-app:local .
  # In a copy of deploy/ with a .env containing DOMAIN=":80":
  docker compose -f docker-compose.prod.yml -f docker-compose.local.yml up -d
  curl http://localhost:8080/api/health
  ```

## Future ideas

- Save and favorite other cooks' recipes; ratings and comments.
- Strip photo metadata (such as GPS) on upload, and clean up uploads from abandoned forms.
- Postgres full-text search with ranking once there are many recipes.
- Shopping list generated from one or more recipes, using the normalized ingredients.
- Keep chat history per user, and stream pantry ideas as they arrive.
- An atomic rate-limit check (a transaction or advisory lock) for bursts of parallel AI requests.
- A smaller production image, by running migrations from a separate one-off container.
- A strict nonce-based CSP if Next.js makes that compatible with static rendering.
- Uptime monitoring and error reporting.
- A way to load demo content into production.

## Working on this project

`CLAUDE.md` holds the project rules (stack, data model, security and accessibility requirements, conventions) and how the project is built in Claude Code cloud sessions. `docs/PLAN.md` is the original build plan, including the decisions referenced above.
