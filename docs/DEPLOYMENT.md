# Deploying The Cushman Davis Cookbook

This guide takes the site from your existing Droplet to a live site that redeploys on every push to `main`. It assumes:

- the Droplet was created with the bootstrap script (Ubuntu 24.04, admin user `mdavis`, Docker, nginx, Certbot, ufw, fail2ban, key-only SSH);
- you have this repository cloned on your own computer.

Everything runs on that one Droplet: the app, PostgreSQL, and a nightly backup job.

## How it fits together

```
Browser ──HTTPS──▶ nginx on the Droplet (ports 80/443, Certbot certificate)
                     │ proxies to 127.0.0.1:3000 (loopback only)
                     ▼
   Docker Compose in /opt/larder
   ├── app      the site; runs database migrations as it starts
   ├── db       PostgreSQL 16; internal Docker network only, no published ports
   └── backup   nightly pg_dump at 03:15 UTC ──▶ /opt/larder/backups
                                             └─▶ private Spaces bucket (off-site copy)

Photos ──▶ DigitalOcean Spaces + CDN       AI ──▶ Anthropic API (server side only)
Password reset emails ──▶ Resend           Backup alerts ──▶ healthchecks.io

git push to main ──▶ GitHub Actions: checks, build image, push to GHCR,
                     SSH as `deploy`, pull, restart, health check
```

- **The database** lives in the Docker volume `larder_pgdata` on the Droplet.
- **Backups:** the Droplet has no DigitalOcean backups, so a copy that stayed on the Droplet would be lost with it. Every night the backup job writes a dump to `/opt/larder/backups` (for quick restores) **and** uploads it to a private Spaces bucket (for when the Droplet is gone). If the upload fails, the backup run fails, and `verify-server.sh` reports it. Both places keep 14 days.
- **The app container holds no data.** Photos live in Spaces and everything else lives in the database.

## What you will need

- A domain or subdomain you can point at the Droplet, e.g. `recipes.example.com`.
- Your Anthropic API key.
- Two Spaces buckets and an access key (step 1).
- A free Resend account for password reset emails (step 2b). healthchecks.io and UptimeRobot alerts are optional.
- Admin access to the GitHub repository (for secrets).
- About 30 minutes.

Throughout, replace:

| Placeholder | Meaning |
| --- | --- |
| `DROPLET_IP` | The Droplet's public IPv4 address |
| `recipes.example.com` | Your domain |
| `you@example.com` | Email for certificate expiry notices |

---

## Step 1. Create the Spaces buckets and access key

The app container must not store files, and the backups must leave the Droplet, so both go to Spaces. Use the Droplet's region for both buckets.

1. **Photos bucket:** go to **Spaces Object Storage > Create bucket** and name it e.g. `larder-images`. Turn on the **CDN**. Keep file listing **restricted**: photos are uploaded as public-read one by one, so the bucket doesn't need to be listable.
2. **Backups bucket:** create a second bucket, e.g. `larder-backups`. **Do not** turn on the CDN, and keep file listing **restricted**. Database dumps contain every account's email and password hash, so this bucket must stay private. The verify script refuses a public one.
3. **Access key:** under **Spaces Object Storage > Access Keys > Create access key**, choose **Limited access** and give it **Read/Write/Delete** on both buckets. Save the key and secret; the secret is shown only once.
4. **Note these values** for step 6:

   | Setting | Example |
   | --- | --- |
   | `SPACES_REGION` | `nyc3` |
   | `SPACES_ENDPOINT` | `https://nyc3.digitaloceanspaces.com` |
   | `SPACES_BUCKET` | `larder-images` |
   | `SPACES_CDN_URL` | `https://larder-images.nyc3.cdn.digitaloceanspaces.com` |
   | `SPACES_BACKUP_BUCKET` | `larder-backups` |

## Step 2. Point your domain at the Droplet

At your DNS provider (or **Networking > Domains** in DigitalOcean), create an **A record** for `recipes.example.com` pointing to `DROPLET_IP`. Check it from your computer; it should print the Droplet's IP:

```bash
dig +short recipes.example.com
```

Wait until it does before step 3. The setup script checks this too.

## Step 2b. Email, alerts, and a contact address

**Already live?** Do this section, add the new values to `PRODUCTION_ENV` (step 6), then re-run **Actions > Deploy**. Only email is required; the two alert services are optional extras.

### Email for password resets (Resend)

Without this, the "Forgot your password?" page says reset is unavailable, and `verify-server.sh` reports a `FAIL`.

1. Sign up at [resend.com](https://resend.com). Under **Domains > Add domain**, enter `recipes.example.com`.
2. Resend lists DNS records (a DKIM `TXT` record, plus `MX` and `TXT` records on a `send` subdomain). Add **exactly those records** at your DNS provider. At Cloudflare, set each to **DNS only**. Then click **Verify DNS records** in Resend; it can take a few minutes.
   - Your existing root `v=spf1 -all` and `_dmarc` records can stay. Resend sends from the `send` subdomain and signs as your domain, so DMARC passes.
3. Under **API Keys > Create API key**, choose **Sending access** for this domain only. Copy the key; it starts with `re_`.
4. For step 6, note:

   | Setting | Value |
   | --- | --- |
   | `RESEND_API_KEY` | the `re_...` key |
   | `EMAIL_FROM` | `The Cushman Davis Cookbook <no-reply@recipes.example.com>` |

### A contact address

The privacy page and the "reset unavailable" message point people to `hello@<your domain>` (set in `src/lib/site.ts` as `CONTACT_EMAIL`). If your DNS is at Cloudflare, forward it to your own inbox for free:

1. In Cloudflare, open the domain, then **Email > Email Routing**, and click **Get started** / **Enable**.
2. Let it add its `MX` and `TXT` records. It replaces the root `v=spf1 -all` record with its own SPF record; that's expected. Keep the `_dmarc` record.
3. Add a **custom address** `hello` that forwards to your personal email, and confirm the verification email.
4. Send a test message to `hello@recipes.example.com` from another account.

### Optional: backup alerts (healthchecks.io)

Skip this if you'd rather check backups yourself with `verify-server.sh`, which fails when the latest dump is more than 36 hours old. With it, the backup job reports each run. If a night is missed or fails, you get an email.

1. Sign up at [healthchecks.io](https://healthchecks.io) and **Add Check**. Name it "Cookbook backup".
2. Set **Period** to `1 day` and **Grace time** to `3 hours`. The backup runs at 03:15 UTC.
3. Copy the check's **ping URL** (`https://hc-ping.com/...`). For step 6, it's `BACKUP_PING_URL`.
4. Email alerts go to your account's address by default (**Integrations** shows them).

### Optional: uptime alerts (UptimeRobot)

No code involved. At [uptimerobot.com](https://uptimerobot.com), add a monitor:

- Type **HTTP(s)**, or **Keyword** with keyword `"db":"ok"` to also catch a broken database.
- URL `https://recipes.example.com/api/health`, every 5 minutes.
- Alert contact: your email.

## Step 3. Set up the server

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
4. Creates `/opt/larder`, owned by `deploy`, and the private folder `/opt/larder/backups` (mode 700).
5. Installs the nginx site `/etc/nginx/sites-available/larder.conf`. The site proxies to `127.0.0.1:3000`, sets the security headers, allows 6 MB photo uploads, and streams AI answers.
6. Checks that DNS points at this Droplet, then runs Certbot to get a certificate and redirect HTTP to HTTPS. Renewal is automatic.

Your default nginx site and anything under `/var/www` are left alone. ufw needs no changes: PostgreSQL is never published, and the app listens only on loopback.

## Step 4. Verify the server before the first deploy

Still on the Droplet:

```bash
sudo bash ~/larder-deploy/verify-server.sh recipes.example.com
```

**Every line should be `PASS`, except these expected `WARN`s:**

- `No /opt/larder/.env yet` (the first deploy writes it)
- `App is not running yet`, `Database is not running yet`, `Backup service is not running yet`
- `https://recipes.example.com/ not checked (app not deployed yet)`

The checks that matter most at this point:

| Check | Why it matters |
| --- | --- |
| `deploy is in the docker group`, `sshd lets deploy log in` | GitHub Actions can connect and run Docker |
| `Port 3000 is not opened in ufw` | The app stays private behind nginx |
| `recipes.example.com points at this Droplet` | Certbot and visitors reach the right server |
| `Certbot manages HTTPS for the site`, `Certificate valid for N more days` | HTTPS works |

Fix any `FAIL` (see [Troubleshooting](#troubleshooting)) and run it again until none remain.

**Also confirm GitHub's key works, from your computer.** This should print `deploy-key-ok` and nothing else:

```bash
ssh -i ~/.ssh/larder-deploy deploy@DROPLET_IP echo deploy-key-ok
```

## Step 5. Generate the secrets

On your computer:

```bash
openssl rand -base64 33   # AUTH_SECRET
openssl rand -hex 24      # POSTGRES_PASSWORD (letters and digits only, so it is safe inside a URL)
```

The database password is set once, when the first deploy creates the database. Changing `POSTGRES_PASSWORD` later does not change the password inside the existing database (see [Day to day](#day-to-day)).

## Step 6. Add the GitHub secrets

The production settings live only in GitHub. Every deploy writes them to `/opt/larder/.env` (mode 600, owned by `deploy`).

**Create the production settings file on your computer, outside the repository**, e.g. `~/larder-production.env`. Do not set `DATABASE_URL`: the compose file builds it from the `POSTGRES_*` values.

```bash
POSTGRES_USER="larder"
POSTGRES_PASSWORD="<openssl rand -hex 24>"
POSTGRES_DB="larder"
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
SPACES_BACKUP_BUCKET="larder-backups"
BACKUP_RETENTION_DAYS=14
# Optional: BACKUP_PING_URL="https://hc-ping.com/<your check's id>"
RESEND_API_KEY="<re_... key>"
EMAIL_FROM="The Cushman Davis Cookbook <no-reply@recipes.example.com>"
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

**Keep a copy of `~/larder-production.env` in your password manager**, then delete the file. If the Droplet is ever lost, you need `POSTGRES_PASSWORD` and the Spaces key to restore, and GitHub never shows a secret again after it is saved.

Optional: to approve each deploy by hand, open **Settings > Environments > production** and add yourself as a required reviewer.

## Step 7. Deploy

Every push to `main` deploys. Pushes to other branches and pull requests run only the checks (`ci.yml`).

For the first deploy, either push any commit to `main`, or open **Actions > Deploy > Run workflow**.

The **Deploy** workflow (`.github/workflows/deploy.yml`) does this:

1. **Verify:** lint, typecheck, and unit tests.
2. **Build and push** `ghcr.io/macjdavis4/recipe-website:<commit>` (and `:latest`).
3. **Deploy** over a single SSH connection as `deploy`:
   - copies `docker-compose.prod.yml`, the `backup/` folder, the nginx template, and the setup and verify scripts to `/opt/larder`;
   - writes `/opt/larder/.env` from `PRODUCTION_ENV`, plus the image tag;
   - logs in to GHCR with a short-lived token, pulls the new image, and logs out;
   - runs `docker compose up -d --build`. The first run creates the database; every run applies new migrations as the app starts.
   - waits until `https://recipes.example.com/api/health` reports `ok`, and prints the app's logs if it doesn't within 5 minutes.

Watch it under **Actions**. A green run means the site answered its health check over HTTPS.

## Step 8. Verify the live setup and take the first backup

On the Droplet, add this shortcut to `~/.bashrc` as `mdavis` (the `.env` belongs to `deploy`, so compose runs as that user), then reload it:

```bash
echo "alias dc='sudo -u deploy docker compose --project-directory /opt/larder -f /opt/larder/docker-compose.prod.yml'" >> ~/.bashrc
source ~/.bashrc
```

Take the first backup now instead of waiting for 03:15 UTC. It should end with `Backup complete.`:

```bash
dc exec backup backup.sh
```

Then run the full check:

```bash
sudo bash /opt/larder/verify-server.sh recipes.example.com
```

Now **every** line should be `PASS`, with `Result: N passed, 0 warnings, 0 failed`. In addition to the step 4 checks, this confirms:

- `/opt/larder/.env` exists with mode 600 and every required setting (values are never printed), including a strong, URL-safe `POSTGRES_PASSWORD` and a backup bucket separate from the photos bucket;
- `STORAGE_DRIVER is spaces` and `AUTH_URL is https://recipes.example.com`;
- email is configured for password resets;
- the app, db, and backup containers are healthy and restart unless stopped;
- the app listens on loopback only; Postgres publishes no ports and nothing listens on 5432;
- the database answers, its data is on the `larder_pgdata` volume, and the migrations are applied;
- the backup job can reach the Spaces bucket, **the bucket is private**, `/opt/larder/backups` is private, and the latest dump is less than 36 hours old;
- `https://recipes.example.com/` loads with a trusted certificate and the security headers;
- `/api/health` reports the database ok over HTTPS, and HTTP redirects to HTTPS.

Then try it in a browser:

1. Open `https://recipes.example.com` on your phone and computer.
2. Sign up, share a recipe **with a photo**, and confirm the photo loads (it comes from the Spaces CDN).
3. Open **Assistant** and ask a question. The answer should stream in word by word.
4. Try **Pantry** with a few ingredients.
5. Log out, choose **Forgot your password?**, and reset your password from the email. The email should arrive within a minute (check spam the first time).
6. If you set up healthchecks.io, the check should turn green after `dc exec backup backup.sh`.

Production starts with an empty database. The demo seed is for development only.

---

## Day to day

**Deploying:** push to `main`. Nothing to do on the server.

**Changing a setting or secret:** edit `PRODUCTION_ENV` in GitHub, then re-run **Actions > Deploy > Run workflow**. Edits made directly to `/opt/larder/.env` are overwritten by the next deploy.

| Task | Command |
| --- | --- |
| Status | `dc ps` |
| Live logs | `dc logs -f app` (or `db`, `backup`) |
| Restart the app | `dc restart app` |
| Back up now | `dc exec backup backup.sh` |
| List backups (Droplet and Spaces) | `dc exec backup restore.sh` |
| Database shell | `dc exec db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'` |
| Full check | `sudo bash /opt/larder/verify-server.sh recipes.example.com` |
| nginx logs | `sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log` |
| Certificate status | `sudo certbot certificates` |

Run the full check now and then (for example after a server reboot). It fails if the last backup is more than 36 hours old or the Spaces copy stops working.

**Rolling back to an earlier version:**

1. Find the commit SHA of a good deploy in **Actions**.
2. On the Droplet:

   ```bash
   sudo -u deploy sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=<sha>/' /opt/larder/.env
   dc up -d app
   ```

3. The next push to `main` deploys normally again.

Migrations only move forward. Roll back the code only when the database schema hasn't changed since that version; otherwise restore the database too (below).

**Restoring the database on this Droplet.** This replaces everything in the database with the chosen dump.

```bash
dc exec backup restore.sh                               # lists dumps on the Droplet and in Spaces
dc stop app
dc exec backup restore.sh larder-20261004-031500.dump  # uses the local copy, or downloads it from Spaces
dc start app
```

**If the Droplet is lost.** Create a new Droplet with the same bootstrap script, then:

1. Point DNS at the new IP (step 2) and run steps 3 and 4.
2. Update `DEPLOY_HOST` and `DEPLOY_KNOWN_HOSTS` in GitHub. Keep `PRODUCTION_ENV` as it is, so `POSTGRES_PASSWORD` and the Spaces settings match.
3. Run **Actions > Deploy > Run workflow**. This creates an empty database.
4. Restore the newest dump from Spaces with the commands above. `restore.sh` lists the Spaces copies and downloads the one you name.

Photos are already in Spaces, so nothing else needs restoring.

**Changing the database password:** `POSTGRES_PASSWORD` only takes effect when the database is first created. To change it later, change it inside the database first, then in `PRODUCTION_ENV`, then re-run Deploy. Inside the database, `\password` prompts for the new password, so it never lands in your shell history:

```bash
dc exec db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
# then at the larder=# prompt:
\password larder
\q
```

**Server updates:** your bootstrap turned on unattended security upgrades with automatic reboots at 04:00. Every container restarts by itself after a reboot.

**Disk space:** the database and 14 days of dumps share the Droplet's disk. Check with `df -h /` and `sudo du -sh /opt/larder/backups /var/lib/docker/volumes/larder_pgdata`.

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| Deploy: `Permission denied (publickey)` | `DEPLOY_SSH_KEY` doesn't match `larder-deploy.pub`, or `deploy` isn't in `AllowUsers`. Run step 4's checks and the `ssh -i ... echo deploy-key-ok` test. |
| Deploy: `Host key verification failed` | `DEPLOY_KNOWN_HOSTS` is wrong or the Droplet was rebuilt. Re-run `ssh-keyscan DROPLET_IP` and update the secret. |
| Deploy: SSH connection refused or timing out | fail2ban may have banned the runner's IP after failed attempts. Check `sudo fail2ban-client status sshd` and unban with `sudo fail2ban-client set sshd unbanip <ip>`. |
| Health check fails and logs show `Invalid environment variables` | The listed variable names are missing or invalid in `PRODUCTION_ENV`. Values are never printed. |
| App logs show `password authentication failed` | `POSTGRES_PASSWORD` was changed after the database was created. Put the original back, or change it inside the database (see [Day to day](#day-to-day)). |
| `db` container is unhealthy | `dc logs db`. A full disk is the usual cause: check `df -h /`. |
| Verify: `Spaces backup bucket check failed` | Check `SPACES_BACKUP_BUCKET`, `SPACES_ENDPOINT`, and that the access key has access to the backups bucket. Then `dc exec backup backup.sh --check`. |
| Verify: `Bucket ... is public` | In the bucket's settings, set file listing to **Restricted** (and turn off the CDN). |
| Verify: latest dump is too old | `dc logs backup` shows the nightly run's output. Run `dc exec backup backup.sh` to see the error directly. |
| Password reset email never arrives | In Resend, check **Logs** and that the domain shows **Verified**. On the Droplet, `dc logs app \| grep -i "reset email"` shows send errors. |
| healthchecks.io says the backup is late or down | `dc logs backup` shows the run's output. Run `dc exec backup backup.sh` to see it fail directly. |
| Browser shows `502 Bad Gateway` | nginx is up but the app isn't. Check `dc ps` and `dc logs app`. |
| Certbot failed during setup | DNS didn't point at the Droplet yet, or port 80 was blocked. Fix it, then re-run `server-setup.sh`. |
| Photos fail to upload | Check the `SPACES_*` values and that the access key can write to the photos bucket. |
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
