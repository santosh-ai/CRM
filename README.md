# NDIS Disability Services Management System

A full-stack CRM for NDIS service providers — managing staff compliance, client records, case notes, incidents and training records.

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| Database | PostgreSQL 15 (raw SQL migrations) |
| Frontend | React 18 + Vite |
| Auth | JWT + bcrypt, role-based (Admin / Manager / Staff) |
| Styling | Tailwind CSS |
| File uploads | multer (local disk) |
| Containerisation | Docker Compose |

## Features

- **Dashboard** — staff/client stats, compliance rate, expired/expiring document alerts, recent incidents
- **Staff management** — create, edit, deactivate; compliance badge per staff member
- **Staff detail** — Documents tab (WWVP, Police Check, First Aid, CPR, etc.) + Trainings tab with upload support
- **Client management** — NDIS number, emergency contacts, care plan, support needs, risk notes
- **Client detail** — Case notes timeline + Incidents log with status tracking
- **Documents (global)** — filter by status (expired/expiring/valid), type, staff member
- **Trainings (global)** — all training records with certificate upload
- **Incidents** — report, filter by severity/status; manager/admin can update status + supervisor notes
- **Audit log** — every create/update action is logged
- **Role-based UI** — Admin sees everything; Manager can't create staff; Staff see own records only

## Default Login

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@ndis.com | Admin@123 |
| Manager | manager@ndis.com | Admin@123 |
| Staff | michael.chen@ndis.com | Admin@123 |

> Change passwords immediately in production.

## Quick Start (Docker)

```bash
git clone <repo>
cd CRM
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api
- Database: localhost:5432

## Manual Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 15+

### Database
```bash
createdb ndis_crm
psql ndis_crm < backend/migrations/001_init.sql
```

### Backend
```bash
cd backend
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET
npm install
npm start
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend dev server: http://localhost:5173 (proxies `/api` to backend on port 5000)

## Project Structure

```
backend/
  src/
    index.js          # Express entry point
    db.js             # PostgreSQL pool
    middleware/
      auth.js         # JWT + requireRole middleware
      upload.js       # multer config (10MB limit, PDF/JPG/PNG/DOC)
    routes/
      auth.js         # POST /login, POST /register, GET /me
      staff.js        # CRUD /api/staff
      clients.js      # CRUD /api/clients
      documents.js    # CRUD /api/documents + file upload
      trainings.js    # CRUD /api/trainings + certificate upload
      notes.js        # Case notes per client
      incidents.js    # Incident reporting + status management
      dashboard.js    # Aggregated stats + alerts
  migrations/
    001_init.sql      # Schema + seed data
  .env.example

frontend/
  src/
    api.js            # axios instance with JWT interceptor
    App.jsx           # Routes
    components/
      Layout.jsx      # Sidebar + topbar
      ProtectedRoute.jsx
      AlertBanner.jsx
    pages/
      Login.jsx
      Dashboard.jsx
      Staff.jsx / StaffDetail.jsx
      Clients.jsx / ClientDetail.jsx
      Documents.jsx
      Trainings.jsx
      Incidents.jsx
```

## Document Status Logic

Computed in SQL on every query:
- **expired** — `expiry_date < today`
- **expiring_soon** — `expiry_date` within next 30 days
- **valid** — `expiry_date > today + 30 days` or no expiry date

## Environment Variables (Backend)

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 5000) |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for JWT signing (use a long random string) |
| `UPLOAD_DIR` | Directory for uploaded files (default: `./uploads`) |
| `NODE_ENV` | `development` or `production` |
