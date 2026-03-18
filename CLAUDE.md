# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend (React 19 + Vite)
```bash
cd frontend
npm install
npm run dev       # Vite dev server on :5173
npm run build     # Production build → frontend/dist
npm run lint      # ESLint
npm run preview   # Preview production build
```

### Backend (Node.js/Express)
```bash
cd backend
npm install
npm run dev       # Nodemon hot reload on :5001
npm start         # Production: node server.js
```

### Database & Docker
```bash
docker compose up mysql    # Start MySQL only (for local dev)
docker compose up -d       # Start full stack (MySQL + backend)
```

### Infrastructure
```bash
cd terraform
terraform init && terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

No test suites are configured. Backend `npm test` is a placeholder.

## Architecture

**Full-stack bill-splitting app** (spend-sync.com) with React SPA frontend hosted on AWS Amplify, Express API on AWS Lightsail, and MySQL database.

### Two Parallel Billing Systems

1. **Service Bills** — recurring monthly services split among friends. Status flow: `draft → pending_responses → finalized`. Tables: `service_bills`, `service_bill_items`, `service_bill_participants`, `bill_invitations`, `monthly_cycle_payments`.

2. **Transactions** — one-off shared expenses. Types: `expense | bill | income`. Status flow: `pending → paid`. Tables: `transactions`, `transaction_participants`, `transaction_cycle_payments`.

### Key Data Flows

- **Auth**: Amplify.signIn → Cognito JWT → POST `/auth/sync` (UPSERT user by Cognito sub) → Redux persists user → Socket.IO authenticates
- **API calls**: RTK Query injects Amplify Bearer token via `prepareHeaders`. Backend `verifyToken` middleware validates against Cognito JWKS.
- **Real-time**: Socket.IO embedded in Express server. `SocketContext` listens for 10+ event types and invalidates RTK Query cache tags + shows toast notifications.
- **Email**: Controllers call `sendEmail()` → Nodemailer → AWS SES SMTP. HTML templates in `backend/templates/emails/`.

### Frontend Stack
- **State**: Redux Toolkit + RTK Query (43 endpoints with tag-based cache invalidation). Only `auth` slice persisted via redux-persist to localStorage.
- **UI**: Tailwind CSS 4 + Radix UI primitives (in `frontend/src/components/ui/`)
- **i18n**: i18next with English (`en.json`) and Spanish (`es.json`) in `frontend/src/locales/`
- **Routing**: React Router DOM v7. Routes: `/`, `/login`, `/register`, `/dashboard`
- **Auth config**: `frontend/src/services/cognito.js` (Cognito pool/client IDs)
- **API config**: `frontend/src/services/api.js` (RTK Query base API + all endpoint definitions)

### Backend Structure
- **Entry**: `backend/server.js` — Express + Socket.IO, mounts routes at `/auth`, `/bills`, `/transactions`, `/friends`, `/user`, `/users`
- **Pattern**: routes → controllers → database helpers (`executeQuery`/`findOne`/`findMany` from `config/database.js`)
- **Auth middleware**: `middleware/auth.js` — Cognito JWT verification via `aws-jwt-verify`
- **Socket.IO helpers**: `utils/notifications.js` — `connectedUsers` Map + `sendNotificationToUser()`
- **DB schema**: `backend/database/schema.sql` (15 tables) + `add_*.sql` migration files, auto-imported on first Docker boot

### Deployment
- **Frontend**: AWS Amplify (auto-deploy from main, build spec in `amplify.yml`)
- **Backend**: Docker on AWS Lightsail, Nginx reverse proxy with Certbot SSL
- **DNS**: `app.spend-sync.com` → Amplify, `api.spend-sync.com` → Lightsail
- **IaC**: Terraform in `terraform/` manages Lightsail instance, static IP, firewall, Amplify app

### Environment Variables
Backend `.env` requires: `PORT`, `DB_*`, `COGNITO_*`, `SES_*`, `FRONTEND_URL`. See `.env.example`.
Frontend uses Vite env vars: `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_API_URL`.
