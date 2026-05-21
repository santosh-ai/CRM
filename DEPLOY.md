# NDIS CRM — Deployment Guide

This document covers three deployment methods: **Docker Compose** (recommended), **manual on a Linux VPS**, and **cloud platforms** (Railway / Render / Fly.io).

---

## Prerequisites

| Tool | Minimum Version |
|------|----------------|
| Docker | 24+ |
| Docker Compose | 2.20+ |
| Node.js (manual only) | 18 LTS |
| PostgreSQL (manual only) | 15+ |
| Git | any |

---

## Option 1 — Docker Compose (Recommended)

This starts PostgreSQL, the Node.js backend, and the Nginx-served React frontend in three containers.

### 1. Clone the repository

```bash
git clone https://github.com/santosh-ai/CRM.git
cd CRM
```

### 2. Configure secrets

Create a `.env` file for Docker Compose overrides. You do **not** need to edit `docker-compose.yml` directly — Docker Compose automatically reads a `.env` file at the project root.

```bash
cat > .env << 'EOF'
POSTGRES_PASSWORD=change_me_strong_password
JWT_SECRET=change_me_use_a_long_random_string_32plus_chars
EOF
```

Then update `docker-compose.yml` to reference these variables (or set them inline). For a quick start you can update the two hardcoded values in `docker-compose.yml`:

- `POSTGRES_PASSWORD: password` → your strong password
- `JWT_SECRET: change_this_in_production_use_a_long_random_secret` → your secret

Generate a strong JWT secret:

```bash
openssl rand -hex 32
```

### 3. Build and start

```bash
docker-compose up --build -d
```

- **Frontend** → http://your-server-ip:3000
- **Backend API** → http://your-server-ip:5000/api
- **Database** → localhost:5432 (internal only)

### 4. Verify

```bash
# Check all containers are running
docker-compose ps

# Check backend logs
docker-compose logs backend

# Test API health
curl http://localhost:5000/api/health
```

Expected response: `{"status":"ok","timestamp":"..."}`

### 5. Default login credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@ndis.com | Admin@123 |
| Manager | manager@ndis.com | Admin@123 |
| Staff | michael.chen@ndis.com | Admin@123 |

**⚠ Change all passwords immediately after first login.**

### 6. Persist uploads across restarts

File uploads are stored in a Docker volume named `uploads`. They survive container restarts automatically. To back up:

```bash
docker run --rm -v crm_uploads:/data -v $(pwd):/backup alpine \
  tar czf /backup/uploads-backup.tar.gz -C /data .
```

### 7. Stop / restart

```bash
docker-compose down        # stop, keep volumes
docker-compose down -v     # stop AND delete database + uploads (destructive!)
docker-compose restart backend
```

---

## Option 2 — Manual Deployment on Ubuntu 22.04 LTS

### 1. Install system dependencies

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nodejs npm postgresql postgresql-contrib nginx git

# Verify versions
node --version   # should be 18+
psql --version   # should be 15+
```

If Node.js 18 is not available via apt, install via NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. Create a PostgreSQL database

```bash
sudo -u postgres psql -c "CREATE USER crmuser WITH PASSWORD 'your_db_password';"
sudo -u postgres psql -c "CREATE DATABASE ndis_crm OWNER crmuser;"
sudo -u postgres psql -d ndis_crm -f /path/to/CRM/backend/migrations/001_init.sql
```

### 3. Clone and configure the backend

```bash
git clone https://github.com/santosh-ai/CRM.git /opt/ndis-crm
cd /opt/ndis-crm/backend

cp .env.example .env
nano .env
```

Edit `.env`:

```env
PORT=5000
DATABASE_URL=postgresql://crmuser:your_db_password@localhost:5432/ndis_crm
JWT_SECRET=your_long_random_secret_here
UPLOAD_DIR=/opt/ndis-crm/uploads
NODE_ENV=production
```

```bash
mkdir -p /opt/ndis-crm/uploads
npm install --omit=dev
```

### 4. Run the backend as a systemd service

```bash
sudo nano /etc/systemd/system/ndis-crm-backend.service
```

Paste:

```ini
[Unit]
Description=NDIS CRM Backend
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/ndis-crm/backend
EnvironmentFile=/opt/ndis-crm/backend/.env
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable ndis-crm-backend
sudo systemctl start ndis-crm-backend
sudo systemctl status ndis-crm-backend
```

### 5. Build the frontend

```bash
cd /opt/ndis-crm/frontend
npm install
npm run build
# Output: /opt/ndis-crm/frontend/dist
```

### 6. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/ndis-crm
```

Paste (replace `your-domain.com` or use your server IP):

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /opt/ndis-crm/frontend/dist;
    index index.html;

    # React SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API to backend
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 10m;
    }

    # Proxy file uploads
    location /uploads {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/ndis-crm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7. (Optional) Enable HTTPS with Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Certbot auto-renews certificates. Test renewal:

```bash
sudo certbot renew --dry-run
```

---

## Option 3 — Railway (Cloud, Free Tier Available)

### Backend

1. Push your repository to GitHub (already done).
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
3. Select the `CRM` repo.
4. Railway detects Node.js. Set **Root Directory** to `backend`.
5. Add environment variables:
   - `DATABASE_URL` — Railway can provision a PostgreSQL plugin; copy its connection string.
   - `JWT_SECRET` — generate with `openssl rand -hex 32`
   - `PORT` — `5000`
   - `NODE_ENV` — `production`
   - `UPLOAD_DIR` — `/app/uploads`
6. Run the SQL migration: connect to your Railway PostgreSQL using the provided connection string and run `backend/migrations/001_init.sql`.

### Frontend

1. In the same Railway project, add a new service → **GitHub repo** → root directory `frontend`.
2. Set the build command: `npm run build`
3. Set the start command: `npx serve -s dist -l 3000`
4. Add environment variable: none required (the Vite proxy is only for local dev; in production the nginx.conf handles routing — but on Railway you'll need to configure the API base URL).

> **Note for Railway / other PaaS:** The frontend `api.js` uses a relative `/api` base URL which relies on Nginx or a proxy to route requests. On Railway you'll need to set `VITE_API_URL=https://your-backend.railway.app` and update `frontend/src/api.js` to read `import.meta.env.VITE_API_URL || '/api'`.

---

## Environment Variables Reference

### Backend (`.env`)

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `PORT` | No | `5000` | Defaults to 5000 |
| `DATABASE_URL` | Yes | `postgresql://user:pass@host:5432/ndis_crm` | Full connection string |
| `JWT_SECRET` | Yes | `openssl rand -hex 32` | Min 32 chars, random |
| `UPLOAD_DIR` | No | `./uploads` | Path for uploaded files |
| `NODE_ENV` | No | `production` | `production` disables detailed errors |
| `FRONTEND_URL` | No | `https://your-domain.com` | Added to CORS allow-list |

---

## Post-Deployment Checklist

- [ ] All three containers running (`docker-compose ps`) / systemd service active
- [ ] API health check returns 200: `GET /api/health`
- [ ] Login works at the frontend URL with `admin@ndis.com` / `Admin@123`
- [ ] **Change the admin password** via Staff → Edit
- [ ] **Change the `JWT_SECRET`** from the default value
- [ ] **Change the PostgreSQL password** from the default value
- [ ] File uploads work (try uploading a document on a staff detail page)
- [ ] HTTPS configured (production) and HTTP redirects to HTTPS

---

## Backup and Maintenance

### Database backup

```bash
# With Docker
docker-compose exec postgres pg_dump -U postgres ndis_crm > backup-$(date +%Y%m%d).sql

# Without Docker
pg_dump -U crmuser ndis_crm > backup-$(date +%Y%m%d).sql
```

### Database restore

```bash
# With Docker
docker-compose exec -T postgres psql -U postgres ndis_crm < backup.sql

# Without Docker
psql -U crmuser ndis_crm < backup.sql
```

### Update the application

```bash
git pull origin main

# With Docker
docker-compose up --build -d

# Without Docker (backend)
cd backend && npm install --omit=dev
sudo systemctl restart ndis-crm-backend

# Without Docker (frontend)
cd frontend && npm install && npm run build
sudo systemctl reload nginx
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Frontend shows blank page | Backend unreachable | Check `docker-compose logs backend` |
| `502 Bad Gateway` | Backend not running | `systemctl status ndis-crm-backend` |
| Login fails with "Server error" | DB connection issue | Check `DATABASE_URL` in `.env` |
| File upload fails | Upload directory permissions | `chown -R www-data /opt/ndis-crm/uploads` |
| CORS errors in browser | Frontend URL not in allow-list | Set `FRONTEND_URL` env var in backend |
| JWT errors after restart | Secret changed | Re-login; old tokens are invalidated |
