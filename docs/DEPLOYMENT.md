# Deploying The Cushman Cookbook

This guide takes the site from your existing Droplet to a live site that redeploys on every push to `main`. It assumes:

- the Droplet was created with the bootstrap script (Ubuntu 24.04, admin user `mdavis`, Docker, nginx, Certbot, ufw, fail2ban, key-only SSH);
- you have a DigitalOcean **Managed PostgreSQL** cluster, ideally in the same region as the Droplet;
- you have this repository cloned on your own computer.

## How it fits together

```
Browser ──HTTPS──▶ nginx on the Droplet (ports 80/443, Certbot certificate)
                     │ proxies to 127.0.0.1:3000 (loopback only)
                     ▼
                   app container (Docker Compose, /opt/larder)
                     │ SSL (sslmode=require)
                     ▼
                   Managed PostgreSQL (trusted sources: the Droplet)

Photos ──▶ DigitalOcean Spaces + CDN       AI ──▶ Anthropic API (server side only)

git push to main ──▶ GitHub Actions: checks, build image, push to GHCR,
                     SSH as `deploy`, pull, restart, health check
```

- **Database backups** come from Managed PostgreSQL: daily backups plus point-in-time recovery.
- **The Droplet's** own backups cover the server.
- **The app container holds no data.** Photos live in Spaces and everything else lives in the database.

## What you will need

- A domain or subdomain you can point at the Droplet, e.g. `recipes.example.com`.
- Your Anthropic API key.
- A Spaces bucket for recipe photos (step 2).
- Admin access to the GitHub repository (for secrets).
- About 30 minutes.

Throughout, replace:

| Placeholder | Meaning |
| --- | --- |
| `DROPLET_IP` | The Droplet's public IPv4 address |
| `recipes.example.com` | Your domain |
| `you@example.com` | Email for certificate expiry notices |

---

## Step 1. Prepare Managed PostgreSQL

In the DigitalOcean control panel, open **Databases**, then your cluster.

1. **Trusted sources** (Settings tab): add your Droplet. Only the Droplet needs access. GitHub Actions never connects to the database.
2. **Users & Databases** tab:
   - Add a user named `larder`. DigitalOcean generates the password.
   - Add a database named `larder`.
3. **Connection details** (Overview tab):
   - Pick **VPC network** if the Droplet is in the same region (traffic stays private). Otherwise pick **Public network**.
   - Choose user `larder` and database `larder`, and copy the **Connection string**. It looks like this:

   ```
   postgresql://larder:PASSWORD@private-your-cluster-do-user-123-0.k.db.ondigitalocean.com:25060/larder?sslmode=require
   ```

   This is your `DATABASE_URL`. Keep `?sslmode=require` at the end.

4. **Let `larder` create tables.** PostgreSQL 15 and newer no longer let new users create tables in the `public` schema, so migrations would fail without this. From your computer, open a shell on the Droplet, then run the grant as the admin user `doadmin`:

   ```bash
   ssh mdavis@DROPLET_IP
   docker run --rm -it postgres:16-alpine psql \
     "postgresql://doadmin:DOADMIN_PASSWORD@YOUR_DB_HOST:25060/larder?sslmode=require" \
     -c 'GRANT CREATE, USAGE ON SCHEMA public TO larder;'
   ```

   It should print `GRANT`. You can copy the `doadmin` connection string from Connection details by choosing user `doadmin`, then change its database name at the end to `larder`. Step 5 checks that this worked.

## Step 2. Create a Spaces bucket for photos

The app container must not store files, so recipe photos go to Spaces.

1. **Create a bucket:** go to **Spaces Object Storage > Create bucket**, choose the same region as the Droplet, and name it e.g. `larder-images`. Turn on the **CDN**. Keep file listing **restricted**: photos are uploaded as public-read individually, so the bucket doesn't need to be listable.
2. **Create an access key:** under **Spaces Object Storage > Access Keys > Create access key**, choose access to that bucket. Save the key and secret; the secret is shown only once.
3. **Note these values** for step 6:

   | Setting | Example |
   | --- | --- |
   | `SPACES_REGION` | `nyc3` |
   | `SPACES_ENDPOINT` | `https://nyc3.digitaloceanspaces.com` |
   | `SPACES_BUCKET` | `larder-images` |
   | `SPACES_CDN_URL` | `https://larder-images.nyc3.cdn.digitaloceanspaces.com` |

## Step 3. Point your domain at the Droplet

At your DNS provider (or **Networking > Domains** in DigitalOcean), create an **A record** for `recipes.example.com` pointing to `DROPLET_IP`. Check it from your computer; it should print the Droplet's IP:

```bash
dig +short recipes.example.com
```

Wait until it does before step 4. The setup script checks this too.

## Step 4. Set up the server

**On your computer**, from the repository folder, create the key GitHub Actions will use to deploy. It has no passphrase and is used for nothing else.

```bash
ssh-keygen -t ed25519 -N "" -C "github-actions-deploy" -f ~/.ssh/larder-deploy
```

Copy the `deploy/` folder and the public key to the Droplet:

```bash
scp -r deploy mdavis@DROPLET_IP:~/larder-deploy
scp ~/.ssh/larder-deploy.pub mdavis@DROPLET_IP:~/larder-deploy/
```

**On the Droplet**, run the setup script:

```bash
ssh mdavis@DROPLET_IP
cd ~/larder-deploy
sudo DOMAIN=recipes.example.com CERTBOT_EMAIL=you@example.com \
     DEPLOY_PUBLIC_KEY="$(cat larder-deploy.pub)" bash server-setup.sh
```

It is safe to run again. It does the following:

1. Checks that Docker, compose, nginx, Certbot, and ufw are installed and running.
2. Creates a `deploy` user. It is in the `docker` group, has no sudo, and its key may only run commands: no terminal, no forwarding.
3. Adds `deploy` to your `AllowUsers mdavis webhost` SSH rule. It tests the change with `sshd -t` and restores the file if the test fails. Your current session is not affected.
4. Creates `/opt/larder`, owned by `deploy`.
5. Installs the nginx site `/etc/nginx/sites-available/larder.conf`. The site proxies to `127.0.0.1:3000`, sets the security headers, allows 6 MB photo uploads, and streams AI answers.
6. Checks that DNS points at this Droplet, then runs Certbot to get a certificate and redirect HTTP to HTTPS. Renewal is automatic.

Your default nginx site and anything under `/var/www` are left alone.

## Step 5. Verify the server before the first deploy

Still on the Droplet:

```bash
sudo bash ~/larder-deploy/verify-server.sh recipes.example.com --ask-db
```

When prompted, paste the `DATABASE_URL` from step 1. Input is hidden, and the value is not stored or printed.

**Every line should be `PASS`, except these expected `WARN`s:**

- `No /opt/larder/.env yet` (the first deploy writes it)
- `App is not running yet`
- `https://recipes.example.com/ not checked (app not deployed yet)`

The checks that matter most at this point:

| Check | Why it matters |
| --- | --- |
| `deploy is in the docker group`, `sshd lets deploy log in` | GitHub Actions can connect and run Docker |
| `Port 3000 is not opened in ufw` | The app stays private behind nginx |
| `recipes.example.com points at this Droplet` | Certbot and visitors reach the right server |
| `Certbot manages HTTPS for the site`, `Certificate valid for N more days` | HTTPS works |
| `Connected to database larder as larder (PostgreSQL N)` | Trusted sources and the password are right |
| `larder can create tables in schema public` | The step 1 grant worked, so migrations will run |

Fix any `FAIL` (see [Troubleshooting](#troubleshooting)) and run it again until none remain.

**Also confirm GitHub's key works, from your computer.** This should print `deploy-key-ok` and nothing else:

```bash
ssh -i ~/.ssh/larder-deploy deploy@DROPLET_IP echo deploy-key-ok
```

## Step 6. Add the GitHub secrets

The production settings live only in GitHub. Every deploy writes them to `/opt/larder/.env` (mode 600, owned by `deploy`).

**Create the production settings file on your computer, outside the repository**, e.g. `~/larder-production.env`. Generate `AUTH_SECRET` with `openssl rand -base64 33`.

```bash
DATABASE_URL="postgresql://larder:PASSWORD@private-...db.ondigitalocean.com:25060/larder?sslmode=require"
AUTH_SECRET="<openssl rand -base64 33>"
AUTH_URL="https://recipes.example.com"
ANTHROPIC_API_KEY="<your key>"
AI_MODEL="claude-haiku-4-5-20251001"
AI_RATE_LIMIT_PER_HOUR=30
STORAGE_DRIVER="spaces"
SPACES_KEY="<spaces access key>"
SPACES_SECRET="<spaces secret>"
SPACES_REGION="nyc3"
SPACES_ENDPOINT="https://nyc3.digitaloceanspaces.com"
SPACES_BUCKET="larder-images"
SPACES_CDN_URL="https://larder-images.nyc3.cdn.digitaloceanspaces.com"
# Optional Google sign-in (redirect URI: https://recipes.example.com/api/auth/callback/google)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

**Add the secrets and one variable** in the repository under **Settings > Secrets and variables > Actions**:

| Name | Kind | Value |
| --- | --- | --- |
| `DEPLOY_HOST` | Secret | `DROPLET_IP` |
| `DEPLOY_USER` | Secret | `deploy` |
| `DEPLOY_SSH_KEY` | Secret | Contents of `~/.ssh/larder-deploy` (the private key, including the BEGIN and END lines) |
| `DEPLOY_KNOWN_HOSTS` | Secret | Output of `ssh-keyscan DROPLET_IP` (pins the server's identity) |
| `PRODUCTION_ENV` | Secret | Contents of `~/larder-production.env` |
| `PRODUCTION_URL` | Variable | `https://recipes.example.com` |

Or, with the GitHub CLI from the repository folder:

```bash
gh secret set DEPLOY_HOST --body "DROPLET_IP"
gh secret set DEPLOY_USER --body "deploy"
gh secret set DEPLOY_SSH_KEY < ~/.ssh/larder-deploy
ssh-keyscan DROPLET_IP 2> /dev/null | gh secret set DEPLOY_KNOWN_HOSTS
gh secret set PRODUCTION_ENV < ~/larder-production.env
gh variable set PRODUCTION_URL --body "https://recipes.example.com"
```

Once the secrets are saved, delete `~/larder-production.env` or store it in a password manager.

Optional: to approve each deploy by hand, open **Settings > Environments > production** and add yourself as a required reviewer.

## Step 7. Deploy

Every push to `main` deploys. Pushes to other branches and pull requests run only the checks (`ci.yml`).

For the first deploy, either push any commit to `main`, or open **Actions > Deploy > Run workflow**.

The **Deploy** workflow (`.github/workflows/deploy.yml`) does this:

1. **Verify:** lint, typecheck, and unit tests.
2. **Build and push** `ghcr.io/macjdavis4/recipe-website:<commit>` (and `:latest`).
3. **Deploy** over a single SSH connection as `deploy`:
   - copies `docker-compose.prod.yml`, the nginx template, and the setup and verify scripts to `/opt/larder`;
   - writes `/opt/larder/.env` from `PRODUCTION_ENV`, plus the image tag;
   - logs in to GHCR with a short-lived token, pulls the new image, and logs out;
   - runs `docker compose up -d`. The app applies database migrations as it starts.
   - waits until `https://recipes.example.com/api/health` reports `ok`, and prints the app's logs if it doesn't within 5 minutes.

Watch it under **Actions**. A green run means the site answered its health check over HTTPS.

## Step 8. Verify the live setup

On the Droplet:

```bash
sudo bash /opt/larder/verify-server.sh recipes.example.com
```

Now **every** line should be `PASS`, with `Result: N passed, 0 warnings, 0 failed`. In addition to the step 5 checks, this confirms:

- `/opt/larder/.env` exists with mode 600 and every required setting (values are never printed);
- `STORAGE_DRIVER is spaces` and `AUTH_URL is https://recipes.example.com`;
- the app container is healthy, restarts unless stopped, and listens on loopback only;
- `https://recipes.example.com/` loads with a trusted certificate and the security headers;
- `/api/health` reports the database ok over HTTPS, and HTTP redirects to HTTPS.

Then try it in a browser:

1. Open `https://recipes.example.com` on your phone and computer.
2. Sign up, share a recipe **with a photo**, and confirm the photo loads (it comes from the Spaces CDN).
3. Open **Assistant** and ask a question. The answer should stream in word by word.
4. Try **Pantry** with a few ingredients.

Production starts with an empty database. The demo seed is for development only.

---

## Day to day

**Deploying:** push to `main`. Nothing to do on the server.

**Changing a setting or secret:** edit `PRODUCTION_ENV` in GitHub, then re-run **Actions > Deploy > Run workflow**. Edits made directly to `/opt/larder/.env` are overwritten by the next deploy.

**Shortcut for commands on the Droplet.** The `.env` file belongs to `deploy`, so run compose as that user. Add this line to `~/.bashrc` as `mdavis`:

```bash
alias dc='sudo -u deploy docker compose --project-directory /opt/larder -f /opt/larder/docker-compose.prod.yml'
```

| Task | Command |
| --- | --- |
| Status | `dc ps` |
| Live logs | `dc logs -f app` |
| Restart the app | `dc restart app` |
| Full check | `sudo bash /opt/larder/verify-server.sh recipes.example.com` |
| nginx logs | `sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log` |
| Certificate status | `sudo certbot certificates` |

**Rolling back to an earlier version:**

1. Find the commit SHA of a good deploy in **Actions**.
2. On the Droplet:

   ```bash
   sudo -u deploy sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=<sha>/' /opt/larder/.env
   dc up -d app
   ```

3. The next push to `main` deploys normally again.

Migrations only move forward. Roll back the code only when the database schema hasn't changed since that version; otherwise restore the database too (below).

**Restoring the database:** in DigitalOcean, open **Databases > your cluster > Backups**. Restore to a point in time, which creates a new cluster. Then:

1. Add the Droplet to the new cluster's trusted sources.
2. Repeat step 1's user, database, and grant on it.
3. Put its connection string in `PRODUCTION_ENV` and re-run Deploy.

**Server updates:** your bootstrap turned on unattended security upgrades with automatic reboots at 04:00. The app container restarts by itself after a reboot.

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| Deploy: `Permission denied (publickey)` | `DEPLOY_SSH_KEY` doesn't match `larder-deploy.pub`, or `deploy` isn't in `AllowUsers`. Run step 5's checks and the `ssh -i ... echo deploy-key-ok` test. |
| Deploy: `Host key verification failed` | `DEPLOY_KNOWN_HOSTS` is wrong or the Droplet was rebuilt. Re-run `ssh-keyscan DROPLET_IP` and update the secret. |
| Deploy: SSH connection refused or timing out | fail2ban may have banned the runner's IP after failed attempts. Check `sudo fail2ban-client status sshd` and unban with `sudo fail2ban-client set sshd unbanip <ip>`. |
| Health check fails and logs show `Invalid environment variables` | The listed variable names are missing or invalid in `PRODUCTION_ENV`. Values are never printed. |
| Logs show `Can't reach database server` | Add the Droplet to the cluster's **Trusted sources**, and check the host and port (25060) in `DATABASE_URL`. |
| Logs show `permission denied for schema public` | Run step 1's `GRANT` command. Then `dc restart app`. |
| Browser shows `502 Bad Gateway` | nginx is up but the app isn't. Check `dc ps` and `dc logs app`. |
| Certbot failed during setup | DNS didn't point at the Droplet yet, or port 80 was blocked. Fix it, then re-run `server-setup.sh`. |
| Photos fail to upload | Check the `SPACES_*` values and that the access key can write to the bucket. |
| Assistant answers appear all at once instead of streaming | The nginx site is missing `proxy_buffering off` for `/api/ai/`. Re-run `server-setup.sh` with `FORCE_NGINX=1`, then re-run Certbot (the script does both). |
| Forms fail with "Invalid Server Actions request" | The nginx site must pass `Host $http_host` and `X-Forwarded-Host $http_host`, as the template does. |

If you change the nginx template later, update the server with:

```bash
cd /opt/larder
sudo DOMAIN=recipes.example.com CERTBOT_EMAIL=you@example.com \
     DEPLOY_PUBLIC_KEY="$(sudo cat /home/deploy/.ssh/authorized_keys | tail -1 | cut -d' ' -f2-)" \
     FORCE_NGINX=1 bash server-setup.sh
```

The deploy workflow keeps the latest template and scripts in `/opt/larder`.
