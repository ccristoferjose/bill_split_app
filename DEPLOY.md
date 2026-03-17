# BillSplit — Production Deployment Guide

**Architecture: Lightsail ($10/mo) + Amplify Hosting (~$0) + existing Cognito + existing SES**
**Total estimated cost: $10–12/month**

---

## Folder Structure (new files)

```
bill_split_app/
├── backend/
│   ├── Dockerfile              ← production Node 18 image
│   └── .dockerignore
├── nginx/
│   └── api.conf                ← reverse proxy config (copy to Lightsail)
├── docker-compose.yml          ← backend + mysql services
├── .env.example                ← template — copy to .env on server
└── DEPLOY.md                   ← this file
```

---

## Prerequisites

- AWS account with Lightsail access
- Domain managed in Squarespace
- Cognito User Pool already exists (do NOT recreate)
- SES already verified and configured
- Git repository (GitHub / GitLab / Bitbucket)

---

## Step 1 — Create Lightsail Instance

### Via AWS Console

1. Go to **Lightsail → Instances → Create instance**
2. Settings:
   - **Region:** same as Cognito (`us-west-1`)
   - **OS:** Ubuntu 22.04 LTS
   - **Plan:** $10/month (2 GB RAM, 1 vCPU, 60 GB SSD)
   - **Instance name:** `billsplit-prod`
3. Click **Create**
4. After creation: **Networking tab → Create static IP → Attach to instance**
   - Note the static IP — you'll need it for DNS

### Open Firewall Ports

In Lightsail → Instance → Networking → IPv4 firewall:

| Port | Protocol | Purpose |
|------|----------|---------|
| 22   | TCP      | SSH |
| 80   | TCP      | HTTP (Certbot challenge + redirect) |
| 443  | TCP      | HTTPS |

> Port 5001 does NOT need to be open — Nginx proxies to it internally.

---

## Step 2 — Connect via SSH

```bash
# Download the .pem key from Lightsail → Account → SSH keys
chmod 400 ~/Downloads/LightsailDefaultKey-us-west-1.pem

ssh -i ~/Downloads/LightsailDefaultKey-us-west-1.pem ubuntu@<STATIC_IP>
```

Or use the browser-based SSH from the Lightsail console.

---

## Step 3 — Install Dependencies on the Instance

Run these commands after connecting via SSH:

```bash
# ── System update ──────────────────────────────────────────
sudo apt update && sudo apt upgrade -y

# ── Docker ─────────────────────────────────────────────────
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker                          # apply group without logout

# Verify
docker --version                       # Docker 24.x+

# ── Docker Compose (plugin) ────────────────────────────────
sudo apt install -y docker-compose-plugin
docker compose version                 # Docker Compose version v2.x

# ── Nginx ──────────────────────────────────────────────────
sudo apt install -y nginx
sudo systemctl enable nginx

# ── Certbot ────────────────────────────────────────────────
sudo apt install -y certbot python3-certbot-nginx

# ── Git ────────────────────────────────────────────────────
sudo apt install -y git
```

---

## Step 4 — Clone Repository

```bash
cd /opt
sudo git clone https://github.com/YOUR_ORG/bill_split_app.git
sudo chown -R $USER:$USER /opt/bill_split_app
cd /opt/bill_split_app
```

---

## Step 5 — Configure Environment

```bash
cp .env.example .env
nano .env
```

Fill in **every value**. Key changes from local dev:

```bash
NODE_ENV=production
DB_HOST=mysql                        # Docker service name — do NOT change

# Use your production Amplify URL (fill in after Step 9)
FRONTEND_URL=https://app.yourdomain.com

# Keep your existing Cognito and SES values
COGNITO_USER_POOL_ID=us-west-1_a48MtZvaJ
COGNITO_CLIENT_ID=3a7rsjmnhbq48h95663q4vu4bq
COGNITO_REGION=us-west-1

SES_SMTP_HOST=email-smtp.us-west-1.amazonaws.com
SES_SMTP_PORT=587
SES_SMTP_USER=<your SES SMTP user>
SES_SMTP_PASSWORD=<your SES SMTP password>
SES_FROM_EMAIL=mail@spend-sync.com
SES_FROM_NAME=BillSplit App
```

> **Security:** `chmod 600 .env` after editing. Never commit this file.

```bash
chmod 600 .env
```

---

## Step 6 — Configure DNS (Squarespace)

Go to **Squarespace → Domains → DNS Settings → Custom Records**

Add these records (replace `<STATIC_IP>` with your Lightsail static IP):

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A | `api` | `<STATIC_IP>` | 1 hour |
| CNAME | `app` | `<amplify-domain>.amplifyapp.com` | 1 hour |

> `auth.yourdomain.com` points to Cognito's hosted UI. If you have a custom domain on Cognito, add an A or CNAME record as instructed by the Cognito console. If not using a custom Cognito domain, skip the auth record.

Wait for DNS propagation (5–30 minutes) before running Certbot.

Verify:
```bash
dig +short api.yourdomain.com        # should return <STATIC_IP>
```

---

## Step 7 — Nginx — Pre-SSL Config

Before Certbot can issue a certificate, Nginx must serve HTTP on port 80.

```bash
# Copy config to Nginx
sudo cp /opt/bill_split_app/nginx/api.conf /etc/nginx/sites-available/api.conf

# Replace the placeholder domain with your real domain
sudo sed -i 's/api.yourdomain.com/api.spend-sync.com/g' \
  /etc/nginx/sites-available/api.conf

# Enable site
sudo ln -s /etc/nginx/sites-available/api.conf /etc/nginx/sites-enabled/api.conf

# Disable default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Start Nginx
sudo systemctl restart nginx
```

---

## Step 8 — SSL with Let's Encrypt

```bash
sudo certbot --nginx -d api.yourdomain.com \
  --non-interactive --agree-tos -m admin@yourdomain.com

# Verify auto-renewal works
sudo certbot renew --dry-run
```

Certbot automatically edits your Nginx config to add SSL certificates.

Test HTTPS:
```bash
curl -I https://api.yourdomain.com/health
# Expected: HTTP/2 200
```

---

## Step 9 — Start Backend + Database

```bash
cd /opt/bill_split_app

# Build images and start containers in background
docker compose up -d --build

# Watch startup logs
docker compose logs -f
```

Expected output:
```
billsplit_mysql    | ... ready for connections
billsplit_backend  | Connected to MySQL database successfully
billsplit_backend  | Server running on http://localhost:5001
```

Verify:
```bash
# Health endpoint via Nginx
curl https://api.yourdomain.com/health
# {"status":"ok"}

# Direct check (from within the instance)
curl http://127.0.0.1:5001/health
```

---

## Step 10 — Enable Restart on Reboot

Docker already uses `restart: unless-stopped` in `docker-compose.yml`.
Nginx is already enabled with `systemctl enable nginx`.

Confirm Docker starts on boot:
```bash
sudo systemctl enable docker
sudo systemctl enable containerd
```

Test full reboot:
```bash
sudo reboot
# Wait ~60 seconds, then SSH back in
ssh -i ~/key.pem ubuntu@<STATIC_IP>
docker compose -f /opt/bill_split_app/docker-compose.yml ps
# Both containers should show "Up"
```

---

## Step 11 — Frontend on AWS Amplify Hosting

### Option A — Connect Git repository (recommended)

1. AWS Console → **Amplify → New app → Host web app**
2. Connect your GitHub/GitLab repo → select `main` branch
3. **Build settings** (Amplify auto-detects Vite, but confirm):

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - cd frontend
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: frontend/dist
    files:
      - '**/*'
  cache:
    paths:
      - frontend/node_modules/**/*
```

4. **Environment variables** → Add:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://api.yourdomain.com` |
| `VITE_COGNITO_USER_POOL_ID` | `us-west-1_a48MtZvaJ` |
| `VITE_COGNITO_CLIENT_ID` | `3a7rsjmnhbq48h95663q4vu4bq` |

5. Click **Save and deploy**

### Option B — Manual deploy (no Git required)

```bash
# Build locally
cd frontend
VITE_API_URL=https://api.yourdomain.com \
VITE_COGNITO_USER_POOL_ID=us-west-1_a48MtZvaJ \
VITE_COGNITO_CLIENT_ID=3a7rsjmnhbq48h95663q4vu4bq \
npm run build

# Install Amplify CLI if not already installed
npm install -g @aws-amplify/cli

# Deploy the dist folder
amplify publish --codegen-version 2 --yes
```

### Add custom domain to Amplify

1. Amplify → App → **Domain management → Add domain**
2. Enter `yourdomain.com`
3. Configure subdomain: `app` → maps to `main` branch
4. Amplify provides a **CNAME value** — add it to Squarespace DNS (Step 6)

> Amplify handles SSL for the frontend automatically.

---

## Step 12 — Update Cognito Callback URLs

In **AWS Cognito → User Pool → App clients → your client → Edit hosted UI**:

Add to **Allowed callback URLs:**
```
https://app.yourdomain.com/
https://app.yourdomain.com/dashboard
```

Add to **Allowed sign-out URLs:**
```
https://app.yourdomain.com/login
```

Remove localhost entries for production.

---

## Updating the Application

```bash
ssh -i ~/key.pem ubuntu@<STATIC_IP>
cd /opt/bill_split_app

# Pull latest code
git pull origin main

# Rebuild and restart backend only (zero DB downtime)
docker compose up -d --build backend

# Watch logs
docker compose logs -f backend
```

Amplify redeploys the frontend automatically on each git push (Option A).

---

## Monitoring & Logs

```bash
# Tail backend logs (last 100 lines, then follow)
docker logs -f --tail 100 billsplit_backend

# Tail MySQL logs
docker logs -f --tail 50 billsplit_mysql

# Nginx access/error logs
sudo tail -f /var/log/nginx/api.access.log
sudo tail -f /var/log/nginx/api.error.log

# Container status + resource usage
docker compose ps
docker stats billsplit_backend billsplit_mysql

# Disk usage
df -h
du -sh /var/lib/docker/volumes/bill_split_app_mysql_data
```

---

## MySQL Backup

```bash
# Manual backup — dumps to /opt/backups/
mkdir -p /opt/backups
docker exec billsplit_mysql mysqldump \
  -u root -p"${DB_PASSWORD}" \
  --single-transaction --routines --triggers \
  ${DB_NAME} \
  > /opt/backups/billsplit_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
docker exec billsplit_mysql mysqldump \
  -u root -p"${DB_PASSWORD}" ${DB_NAME} \
  | gzip > /opt/backups/billsplit_$(date +%Y%m%d).sql.gz
```

### Automated daily backup (cron)

```bash
sudo crontab -e
```

Add:
```cron
# Daily backup at 02:00 UTC, keep last 7 days
0 2 * * * docker exec billsplit_mysql mysqldump -u root -p"YOURPASSWORD" billsplit_db | gzip > /opt/backups/billsplit_$(date +\%Y\%m\%d).sql.gz && find /opt/backups -name "*.sql.gz" -mtime +7 -delete
```

---

## Common Failure Cases

### Backend container exits immediately
```bash
docker compose logs backend
```
**Cause 1:** MySQL not ready yet → normal on first boot; the `depends_on: healthcheck` should handle it. If it persists, increase `start_period` in `docker-compose.yml`.

**Cause 2:** Missing `.env` variable → look for `❌ NOT SET` in logs.

**Cause 3:** Port 5001 already in use on host → `sudo lsof -i :5001`

---

### MySQL fails to start / loses data
```bash
docker compose logs mysql
```
**Cause:** Incompatible volume from previous MySQL version. Fix:
```bash
docker compose down
docker volume rm bill_split_app_mysql_data
docker compose up -d
# Note: this wipes all data — restore from backup first
```

---

### WebSocket (Socket.IO) not connecting
Symptom: Frontend console shows WebSocket connection failed.

Check 1 — Nginx config has the `/socket.io/` block with `Upgrade` headers:
```bash
sudo nginx -T | grep -A 10 "socket.io"
```

Check 2 — Firewall allows port 443:
```bash
curl -I https://api.yourdomain.com/socket.io/?EIO=4&transport=polling
# Should return 200, not 502
```

Check 3 — `VITE_API_URL` in Amplify does NOT have a trailing slash:
```
VITE_API_URL=https://api.yourdomain.com   ✓
VITE_API_URL=https://api.yourdomain.com/  ✗
```

---

### Certbot fails — "DNS problem: NXDOMAIN"
DNS has not propagated yet. Wait 5–30 minutes and retry:
```bash
dig +short api.yourdomain.com    # must return your static IP before running certbot
```

---

### Frontend shows "Network Error" on all API calls
1. Check `VITE_API_URL` is set in Amplify environment variables
2. Check Cognito callback URLs include the Amplify domain
3. Check backend CORS: `FRONTEND_URL` in `.env` must match the Amplify URL exactly (no trailing slash)

---

### SSL certificate renewal fails
```bash
sudo systemctl status certbot.timer    # should be active
sudo certbot renew --dry-run           # simulate renewal
```
If Nginx is blocking the ACME challenge:
```bash
sudo certbot renew --nginx
```

---

## Architecture Summary

```
Squarespace DNS
  ├── app.yourdomain.com  (CNAME → Amplify)
  └── api.yourdomain.com  (A → Lightsail static IP)

Amplify Hosting ($0–1/mo)
  └── React/Vite static site
      └── VITE_API_URL → https://api.yourdomain.com

Lightsail $10/mo — single Ubuntu 22.04 instance
  │
  ├── Nginx (host, port 80/443)
  │   ├── HTTPS termination (Let's Encrypt)
  │   ├── /socket.io/ → 127.0.0.1:5001 (WebSocket upgrade)
  │   └── /           → 127.0.0.1:5001 (REST)
  │
  └── Docker (backend_net bridge)
      ├── billsplit_backend  (Node 18, port 5001 → 127.0.0.1 only)
      │     ├── Express + Socket.IO
      │     ├── → Cognito (JWT verify, us-west-1)
      │     └── → SES SMTP (email, us-west-1)
      └── billsplit_mysql    (MySQL 8.0, internal only)
            └── Volume: mysql_data (persisted on host)
```

---

## Cost Estimate

| Service | Cost |
|---------|------|
| Lightsail $10 instance | $10.00/mo |
| Amplify Hosting (free tier: 5 GB storage, 15 GB transfer) | $0.00/mo |
| Lightsail static IP (free when attached) | $0.00/mo |
| Cognito (50,000 MAU free tier) | $0.00/mo |
| SES ($0.10 per 1,000 emails, ~100 emails/mo) | ~$0.01/mo |
| **Total** | **~$10/mo** |
