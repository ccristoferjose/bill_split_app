# Bill Split App — Architecture Trace

## Table of Contents
1. [Overview](#overview)
2. [System Topology](#system-topology)
3. [Authentication Flow](#authentication-flow)
4. [Backend](#backend)
   - [Entry Point](#entry-point)
   - [Middleware](#middleware)
   - [Routes & Endpoints](#routes--endpoints)
   - [Controllers](#controllers)
   - [Services & Utilities](#services--utilities)
   - [Email Templates](#email-templates)
5. [Database](#database)
6. [Frontend](#frontend)
   - [Entry Point & Routing](#entry-point--routing)
   - [State Management](#state-management)
   - [API Layer](#api-layer)
   - [Real-time Layer](#real-time-layer)
   - [Components](#components)
7. [Data Flows](#data-flows)
   - [Auth Flow](#auth-flow)
   - [Service Bill (BillSplitModal) Flow](#service-bill-billsplitmodal-flow)
   - [Transaction Split (CreateTransactionModal) Flow](#transaction-split-createtransactionmodal-flow)
   - [Email Notification Flow](#email-notification-flow)
8. [Environment Configuration](#environment-configuration)
9. [Key File Index](#key-file-index)

---

## Overview

A full-stack bill-splitting application with two parallel billing systems:

| System | UI Entry Point | DB Tables | Use Case |
|--------|---------------|-----------|----------|
| **Service Bills** | `BillSplitModal.jsx` | `service_bills`, `bill_invitations` | Recurring monthly services (rent, utilities) |
| **Transactions** | `CreateTransactionModal.jsx` | `transactions`, `transaction_participants` | One-off shared expenses or bills |

**Stack:**
- **Frontend:** React 19 + Vite, Redux Toolkit (RTK Query), Tailwind CSS, Radix UI, AWS Amplify
- **Backend:** Node.js + Express 4, Socket.IO, MySQL2, Nodemailer (AWS SES)
- **Auth:** Amazon Cognito (Amplify on client, `aws-jwt-verify` on server)
- **Email:** Amazon SES via SMTP
- **Real-time:** Socket.IO (same server as Express)

---

## System Topology

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (React + Vite :5173)                                   │
│                                                                  │
│  ┌──────────┐   ┌────────────────┐   ┌──────────────────────┐  │
│  │  Amplify │   │  Redux / RTK   │   │  SocketContext.jsx   │  │
│  │ (Cognito)│   │  Query (api.js)│   │  (Socket.IO client)  │  │
│  └────┬─────┘   └───────┬────────┘   └──────────┬───────────┘  │
│       │                 │                         │              │
└───────┼─────────────────┼─────────────────────────┼─────────────┘
        │                 │  HTTP + Bearer token     │ WebSocket
        │                 ▼                          ▼
        │  ┌──────────────────────────────────────────────────┐
        │  │  Express Server  (Node.js :5001)                 │
        │  │                                                  │
        │  │  verifyToken ─── routes ─── controllers          │
        │  │                                  │               │
        │  │  Socket.IO ──────────────────────┘               │
        │  │  (same http server)                              │
        │  └─────────────────────┬────────────────────────────┘
        │                        │
        ▼                        ▼
┌──────────────┐     ┌──────────────────────┐
│  Amazon      │     │  MySQL (work_db)      │
│  Cognito     │     │  15 tables            │
│  (us-west-1) │     └──────────────────────┘
└──────────────┘
        │
        ▼
┌──────────────┐
│  Amazon SES  │
│  (SMTP/587)  │
└──────────────┘
```

---

## Authentication Flow

```
Login.jsx
  │
  ├─1─► Amplify.signIn(email, password)
  │         └──► Cognito validates credentials
  │              └──► Returns JWT access token (cached by Amplify)
  │
  ├─2─► RTK Query: POST /auth/sync  { username, email }
  │         └──► verifyToken middleware
  │                  └──► aws-jwt-verify checks token against Cognito JWKS
  │                  └──► sets req.user = { userId: payload.sub }
  │              syncUser() controller
  │                  └──► INSERT/UPDATE users SET id=Cognito.sub, username, email
  │                  └──► Returns full user row
  │
  ├─3─► dispatch(setCredentials({ user }))  — Redux persisted store
  │
  └─4─► Socket.IO connects → emit('authenticate', { userId })
            └──► Server maps userId → socket.id in connectedUsers Map
```

All subsequent API calls:
- Amplify injects `Authorization: Bearer <access_token>` header automatically (via RTK Query `prepareHeaders`)
- `verifyToken` validates on every protected route

---

## Backend

### Entry Point

**`backend/server.js`**

```
Express app
  ├── Middleware: cors, json, cookie-parser, morgan
  ├── Routes mounted:
  │   ├── POST /auth/sync           → auth.routes
  │   ├── /bills/*                  → verifyToken → bill + invitation + payment routes
  │   ├── /user/*  /users/*         → verifyToken → user.routes
  │   ├── /friends/*                → verifyToken → friend.routes
  │   └── /transactions/*           → verifyToken → transaction.routes
  │
  └── Socket.IO (attached to same HTTP server)
      ├── on 'authenticate' → connectedUsers.set(userId, socket.id)
      └── on 'disconnect'   → connectedUsers.delete(userId)
```

### Middleware

**`backend/middleware/auth.js`** — `verifyToken`

```
Authorization: Bearer <token>
  └─► CognitoJwtVerifier.verify(token)
        ├── success → req.user = { userId: sub }; next()
        └── failure → 403 Forbidden
```

### Routes & Endpoints

#### Auth
| Method | Path | Controller |
|--------|------|------------|
| POST | `/auth/sync` | `syncUser` |

#### Bills (`/bills/*`)
| Method | Path | Controller |
|--------|------|------------|
| POST | `/bills` | `createBill` |
| GET | `/bills/:billId` | `getBillDetails` |
| GET | `/bills/code/:billCode` | `getBillByCode` |
| POST | `/bills/:billId/finalize` | `finalizeBill` |
| POST | `/bills/:billId/check-status` | `checkBillStatus` |
| DELETE | `/bills/:billId` | `deleteBill` |
| POST | `/bills/:billId/invite` | `inviteUsers` |
| POST | `/bills/:billId/respond` | `respondToInvitation` |
| GET | `/bills/:billId/status` | `getInvitationStatus` |
| POST | `/bills/:billId/reopen` | `reopenBill` |
| POST | `/bills/:billId/mark-paid` | `markAsPaid` |
| POST | `/bills/:billId/pay-in-full` | `payInFull` |
| POST | `/bills/:billId/pay-cycle` | `payCycle` |
| POST | `/bills/:billId/new-cycle` | `startNewCycle` |
| GET | `/bills/:billId/cycle-payments` | `getBillCyclePayments` |
| GET | `/bills/:billId/cycle-history` | `getBillCycleHistory` |

#### Transactions (`/transactions/*`)
| Method | Path | Controller |
|--------|------|------------|
| POST | `/transactions` | `createTransaction` |
| GET | `/transactions/user/:userId` | `getUserTransactions` |
| GET | `/transactions/user/:userId/invitations` | `getTransactionInvitations` |
| GET | `/transactions/:transactionId` | `getTransactionDetails` |
| DELETE | `/transactions/:transactionId` | `deleteTransaction` |
| POST | `/transactions/:transactionId/respond` | `respondToTransactionSplit` |
| POST | `/transactions/:transactionId/mark-paid` | `markTransactionPaid` |
| PUT | `/transactions/:transactionId/participants` | `updateTransactionParticipants` |
| POST | `/transactions/:transactionId/participants/:uid/mark-paid` | `markParticipantPaid` |
| POST | `/transactions/:transactionId/participants/:uid/resend` | `resendTransactionInvitation` |
| POST | `/transactions/:transactionId/cycles/:year/:month/mark-paid` | `markTransactionCyclePaid` |

#### Friends (`/friends/*`)
| Method | Path | Controller |
|--------|------|------------|
| POST | `/friends/request` | `sendFriendRequest` |
| POST | `/friends/respond` | `respondToFriendRequest` |
| GET | `/friends/:userId` | `getFriends` |
| GET | `/friends/:userId/pending` | `getPendingRequests` |
| GET | `/friends/:userId/sent` | `getSentRequests` |
| GET | `/friends/:userId/search` | `searchNonFriends` |
| DELETE | `/friends/:friendshipId` | `removeFriend` |

#### User (`/user/*`, `/users/*`)
| Method | Path | Controller |
|--------|------|------------|
| GET | `/users/search` | `searchUsers` |
| GET | `/user/:userId/profile` | `getProfile` |
| PUT | `/user/:userId/profile` | `updateProfile` |
| GET | `/user/:userId/services` | `getUserServices` |
| GET | `/user/:userId/bills` | `getUserBills` |
| GET | `/user/:userId/bills/created` | `getCreatedBills` |
| GET | `/user/:userId/bills/invited` | `getInvitedBills` |
| GET | `/user/:userId/bills/participating` | `getParticipatingBills` |
| GET | `/user/:userId/monthly-bills` | `getMonthlyBills` |
| GET | `/user/:userId/monthly-payments` | `getMonthlyPayments` |

### Controllers

```
backend/controllers/
│
├── auth.controller.js
│   └── syncUser()              — upsert user after Cognito login
│
├── bill.controller.js
│   ├── createBill()            — insert service_bills + optional items
│   ├── getBillDetails()        — bill + participants + items JOIN
│   ├── getBillByCode()         — lookup by unique bill_code
│   ├── finalizeBill()          — status='finalized', send emails
│   ├── checkBillStatus()       — invitation/payment aggregation
│   └── deleteBill()            — cascade delete
│
├── invitation.controller.js
│   ├── inviteUsers()           — create bill_invitations, email + socket
│   ├── respondToInvitation()   — accept/reject, notify owner
│   ├── getInvitationStatus()   — count accepted/rejected/pending
│   └── reopenBill()            — revert finalized → pending_responses
│
├── payment.controller.js
│   ├── markAsPaid()            — single participant payment
│   ├── payInFull()             — mark entire bill paid
│   ├── payCycle()              — monthly cycle payment
│   ├── startNewCycle()         — new monthly_cycle_payments row
│   ├── getBillCyclePayments()  — cycle payments for month/year
│   └── getBillCycleHistory()   — all historical cycles
│
├── transaction.controller.js
│   ├── createTransaction()             — insert transactions + participants + email
│   ├── getUserTransactions()           — all transactions for user
│   ├── getTransactionInvitations()     — pending invites (invitation_status='pending')
│   ├── getTransactionDetails()         — transaction + participants + cycle_payments
│   ├── updateTransactionParticipants() — re-sync split, only email newly added
│   ├── respondToTransactionSplit()     — accept/reject, check all-responded
│   ├── resendTransactionInvitation()   — re-send email + socket
│   ├── markTransactionPaid()           — owner marks whole transaction paid
│   ├── markParticipantPaid()           — participant self-marks paid
│   ├── markTransactionCyclePaid()      — monthly cycle payment
│   └── deleteTransaction()             — cascade delete
│
├── friend.controller.js
│   ├── sendFriendRequest()     — insert pending friendship
│   ├── respondToFriendRequest()— accept/reject/block
│   ├── getFriends()            — accepted friends list
│   ├── getPendingRequests()    — incoming pending requests
│   ├── getSentRequests()       — outgoing pending requests
│   ├── searchNonFriends()      — users not yet friends with caller
│   └── removeFriend()          — delete accepted friendship
│
└── user.controller.js
    ├── getUserServices()       — user's created services
    ├── getUserBills()          — all bills user participates in
    ├── getCreatedBills()       — bills created by user
    ├── getInvitedBills()       — bills with pending invitation
    ├── getParticipatingBills() — bills user accepted
    ├── getMonthlyBills()       — aggregated monthly bill data
    ├── getMonthlyPayments()    — payment totals by month
    ├── searchUsers()           — global username/email search
    ├── getProfile()            — profile + contact info
    └── updateProfile()         — update phone, address, etc.
```

### Services & Utilities

**`backend/services/email.service.js`**
- Nodemailer transport configured for **AWS SES SMTP** (port 587, STARTTLS)
- `sendEmail({ to, subject, html, text?, replyTo? })` — main send function
- `verifyConnection()` — called at server startup to validate SMTP credentials
- Config: `SES_SMTP_HOST`, `SES_SMTP_PORT`, `SES_SMTP_USER`, `SES_SMTP_PASSWORD`, `SES_FROM_EMAIL`

**`backend/utils/notifications.js`**
- `connectedUsers: Map<userId, socketId>` — live user → socket mapping
- `sendNotificationToUser(userId, notification)` — looks up socket ID and emits `'notification'` event
- Notification payload: `{ type, title, message, data }`

### Email Templates

```
backend/templates/emails/
│
├── base.template.js
│   └── baseTemplate({ title, previewText, content })
│       — Full HTML shell: header, body slot, footer, inline CSS
│
├── bill-invitation.template.js          (Service Bill system)
│   └── billInvitationTemplate(params)
│       — CTA: /bills/:billId?action=accept  ← only valid for service bills
│
├── bill-status.template.js
│   └── billStatusTemplate(params)
│       — Handles: finalized, cancelled, reopened, response_received,
│                  invitation_accepted, invitation_rejected
│
├── friend-invitation.template.js
│   └── friendInvitationTemplate(params)
│       — Friend request notification
│
└── transaction-invitation.template.js  (Transaction system)
    └── transactionInvitationTemplate(params)
        — CTA: /dashboard?tab=invitations  ← always valid
        — Branches on transactionType:
            'expense' → "Shared expense tracking" wording, blue info box,
                        no pay-now implication
            'bill'    → standard split invitation wording
```

---

## Database

**Engine:** MySQL (pool via mysql2, `work_db`)

### Schema Overview

```
┌────────────────────────────────────────────────────────────┐
│  AUTH                                                       │
│  users (id=Cognito sub VARCHAR 128)                         │
│    ├── username, email, phone, address, city, country       │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  SERVICE BILLS SYSTEM                                       │
│                                                             │
│  service_bills                                              │
│    ├── id, user_id (owner), title, description              │
│    ├── total_amount, bill_code (unique)                     │
│    ├── bill_type: 'one_time' | 'monthly'                    │
│    └── status: 'draft'|'pending_responses'|'finalized'      │
│         │                                                   │
│         ├──► service_bill_items (line items)                │
│         ├──► service_bill_participants (amount_owed, paid)  │
│         ├──► bill_invitations (pending|accepted|rejected)   │
│         ├──► monthly_cycle_payments (year, month, paid)     │
│         ├──► bill_activity_log (audit trail)                │
│         └──► email_invitations (token-based, unregistered)  │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  TRANSACTIONS SYSTEM                                        │
│                                                             │
│  transactions                                               │
│    ├── id, user_id (owner), type: 'expense'|'bill'|'income'│
│    ├── title, amount, date, due_date, category              │
│    ├── recurrence: null|'monthly'|'weekly'|'yearly'|'custom'│
│    ├── notes, is_shared                                     │
│    └── status: 'pending'|'paid'                             │
│         │                                                   │
│         ├──► transaction_participants                        │
│         │      ├── user_id, amount_owed                     │
│         │      ├── invitation_status: 'pending'|'accepted'|'rejected'
│         │      └── status: 'pending'|'paid'                 │
│         └──► transaction_cycle_payments                     │
│                └── user_id, cycle_year, cycle_month         │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  SOCIAL                                                     │
│  friendships                                                │
│    └── user_id, friend_id, status: 'pending'|'accepted'|'blocked'
│                                                             │
│  services (user-defined billing templates)                  │
└────────────────────────────────────────────────────────────┘
```

### Key Query Helpers (`config/database.js`)

| Function | Use |
|----------|-----|
| `executeQuery(sql, params)` | Generic — returns all rows |
| `findOne(sql, params)` | Returns first row or `null` |
| `findMany(sql, params)` | Returns array (alias for executeQuery) |
| `pool` | Raw mysql2 pool (for manual connection checkout) |

---

## Frontend

### Entry Point & Routing

**`frontend/src/main.jsx`**
1. Configure Amplify (Cognito) — must run before anything else
2. Wrap in Redux `<Provider>` + `<PersistGate>`
3. Mount React app

**`frontend/src/App.jsx`**
```
/           → <Login> (or redirect /dashboard if authed)
/login      → <Login>
/register   → <Register>
/dashboard  → <ProtectedRoute> → <Dashboard>
```

`ProtectedRoute` checks Redux `state.auth.user`; redirects to `/login` if null.

### State Management

```
frontend/src/store.js
│
├── Redux store
│   ├── auth  (authSlice — persisted to localStorage)
│   │   ├── state: { user: null | { id, username, email, ... } }
│   │   ├── setCredentials({ user }) — store user after /auth/sync
│   │   └── logout()                — clear user
│   │
│   └── api   (RTK Query — NOT persisted)
│       └── 43 endpoints with automatic caching + invalidation
│
└── redux-persist
    └── persists only 'auth' slice (tokens managed by Amplify internally)
```

### API Layer

**`frontend/src/services/api.js`** — RTK Query base API

**Base query config:**
- `baseUrl: http://localhost:5001`
- `credentials: 'include'`
- `prepareHeaders`: calls `fetchAuthSession()` from Amplify, injects `Authorization: Bearer <token>`

**Tag types:** `Bill`, `User`, `Profile`, `BillStatus`, `Friend`, `MonthlyPayment`, `Transaction`

**All endpoints:**

| Hook | Method | Path | Tags |
|------|--------|------|------|
| `useSyncUserMutation` | POST | `/auth/sync` | — |
| `useCreateBillMutation` | POST | `/bills` | invalidates Bill |
| `useGetUserCreatedBillsQuery` | GET | `/user/:id/bills/created` | Bill |
| `useGetUserInvitedBillsQuery` | GET | `/user/:id/bills/invited` | Bill |
| `useGetUserParticipatingBillsQuery` | GET | `/user/:id/bills/participating` | Bill |
| `useGetBillDetailsQuery` | GET | `/bills/:billId` | Bill |
| `useInviteUsersToBillMutation` | POST | `/bills/:billId/invite` | invalidates Bill |
| `useRespondToBillInvitationMutation` | POST | `/bills/:billId/respond` | invalidates Bill |
| `useFinalizeBillMutation` | POST | `/bills/:billId/finalize` | invalidates Bill |
| `useMarkBillAsPaidMutation` | POST | `/bills/:billId/mark-paid` | invalidates Bill, BillStatus |
| `useDeleteBillMutation` | DELETE | `/bills/:billId` | invalidates Bill |
| `usePayBillInFullMutation` | POST | `/bills/:billId/pay-in-full` | invalidates Bill |
| `useReopenBillMutation` | POST | `/bills/:billId/reopen` | invalidates Bill |
| `useStartMonthlyBillCycleMutation` | POST | `/bills/:billId/new-cycle` | invalidates Bill |
| `useGetMonthlyPaymentsQuery` | GET | `/user/:id/monthly-payments` | MonthlyPayment |
| `useGetBillCyclePaymentsQuery` | GET | `/bills/:billId/cycle-payments` | Bill |
| `useGetBillCycleHistoryQuery` | GET | `/bills/:billId/cycle-history` | Bill |
| `usePayMonthlyCycleMutation` | POST | `/bills/:billId/pay-cycle` | invalidates Bill |
| `useGetBillStatusQuery` | GET | `/bills/:billId/status` | BillStatus |
| `useCreateTransactionMutation` | POST | `/transactions` | invalidates Transaction |
| `useGetUserTransactionsQuery` | GET | `/transactions/user/:id` | Transaction |
| `useGetTransactionInvitationsQuery` | GET | `/transactions/user/:id/invitations` | Transaction |
| `useRespondToTransactionSplitMutation` | POST | `/transactions/:id/respond` | invalidates Transaction |
| `useResendTransactionInvitationMutation` | POST | `/transactions/:id/participants/:uid/resend` | — |
| `useDeleteTransactionMutation` | DELETE | `/transactions/:id` | invalidates Transaction |
| `useUpdateTransactionParticipantsMutation` | PUT | `/transactions/:id/participants` | invalidates Transaction |
| `useMarkTransactionPaidMutation` | POST | `/transactions/:id/mark-paid` | invalidates Transaction |
| `useMarkParticipantPaidMutation` | POST | `/transactions/:id/participants/:uid/mark-paid` | invalidates Transaction |
| `useMarkTransactionCyclePaidMutation` | POST | `/transactions/:id/cycles/:y/:m/mark-paid` | invalidates Transaction |
| `useGetFriendsQuery` | GET | `/friends/:id` | Friend |
| `useGetPendingRequestsQuery` | GET | `/friends/:id/pending` | Friend |
| `useGetSentRequestsQuery` | GET | `/friends/:id/sent` | Friend |
| `useSearchNonFriendsQuery` | GET | `/friends/:id/search` | Friend |
| `useSendFriendRequestMutation` | POST | `/friends/request` | invalidates Friend |
| `useRespondToFriendRequestMutation` | POST | `/friends/respond` | invalidates Friend |
| `useRemoveFriendMutation` | DELETE | `/friends/:friendshipId` | invalidates Friend |
| `useSearchUsersQuery` | GET | `/users/search` | User |
| `useGetUserProfileQuery` | GET | `/user/:id/profile` | Profile |
| `useUpdateUserProfileMutation` | PUT | `/user/:id/profile` | invalidates Profile |

### Real-time Layer

**`frontend/src/contexts/SocketContext.jsx`**

```
SocketProvider
  ├── Connects to ws://localhost:5001 when user is in Redux store
  ├── On connect → emit('authenticate', { userId })
  ├── On 'notification' event:
  │   ├── transaction_split_invitation  → invalidate Transaction + toast.info
  │   ├── transaction_split_response    → invalidate Transaction + toast.info
  │   ├── transaction_all_responded     → invalidate Transaction + toast.success (if all accepted)
  │   ├── transaction_payment           → invalidate Transaction + toast (success if allPaid)
  │   ├── bill_invitation               → invalidate Bill + toast.info (action: View)
  │   ├── bill_response                 → invalidate Bill + toast.success (if not own action)
  │   ├── bill_status_update            → invalidate Bill + toast.info
  │   ├── bill_finalized                → invalidate Bill, BillStatus + toast.success
  │   ├── friend_request                → invalidate Friend + toast.info (action: View)
  │   ├── friend_accepted               → invalidate Friend + toast.success
  │   └── payment_reminder              → toast.warning
  └── Exports: socket, isConnected, lastNotification (via useSocket() hook)
```

### Components

```
frontend/src/components/
│
├── Auth
│   ├── Login.jsx           Cognito signIn → /auth/sync → Redux → /dashboard
│   ├── Register.jsx        Cognito signUp + confirm → /login
│   └── ProtectedRoute.jsx  Guard: redirect to /login if no Redux user
│
├── Layout
│   ├── Dashboard.jsx       Tab container: Calendar | Bills | Transactions | Friends | Profile
│   └── Navbar.jsx          Header: user greeting, logout, create-bill CTA
│
├── Service Bill System
│   ├── BillsList.jsx           Renders list of bills (created/invited/participating)
│   ├── BillCard.jsx            Card per bill; opens BillDetails or BillSplitModal
│   ├── BillDetails.jsx         Full bill view: participants, items, finalize/pay/delete
│   └── BillSplitModal.jsx      Invite friends, set per-user %, slider validation
│
├── Transaction System
│   ├── PersonalBillsList.jsx        List of user's transactions (expense/bill/income)
│   ├── CreateTransactionModal.jsx   Create transaction: type, amount, percentage split, friends
│   ├── TransactionBillDetailModal.jsx  Detail + actions: pay/undo, accept/decline, expense tracking
│   └── TransactionInvitationsList.jsx  Pending transaction invites tab
│
├── Calendar
│   └── BillCalendar.jsx        Monthly calendar; bills/transactions overlaid on due dates
│
├── Social
│   └── FriendsList.jsx         Friends, pending, sent tabs; search + send/accept/reject
│
├── User
│   └── UserProfile.jsx         View/edit profile: phone, address, city, country
│
└── ui/  (Radix UI + Tailwind wrappers)
    badge, button, card, dialog, dropdown-menu,
    input, label, select, switch, tabs, textarea
```

---

## Data Flows

### Auth Flow

```
User submits login form
  → Amplify.signIn(email, password)
    → Cognito validates, returns JWT (Amplify caches it)
  → RTK syncUser mutation: POST /auth/sync
    → verifyToken: decode JWT, req.user.userId = Cognito sub
    → syncUser: INSERT OR UPDATE users (id = Cognito sub)
    → Returns user row
  → dispatch(setCredentials({ user })) → Redux persisted
  → SocketContext connects → authenticate { userId }
  → All future RTK calls: Amplify injects Bearer token automatically
```

### Service Bill (BillSplitModal) Flow

```
Owner creates bill
  → POST /bills → createBill → service_bills(status='draft')

Owner invites friends via BillSplitModal
  → POST /bills/:id/invite → inviteUsers
    → INSERT bill_invitations(status='pending')
    → sendEmail (billInvitationTemplate) for each invitee
    → sendNotificationToUser (type='bill_invitation') — socket

Invitee responds
  → POST /bills/:id/respond → respondToInvitation
    → UPDATE bill_invitations SET status='accepted'|'rejected'
    → sendEmail (billStatusTemplate, status='response_received') to owner
    → socket: 'bill_response' to owner

Owner finalizes
  → POST /bills/:id/finalize → finalizeBill
    → UPDATE service_bills SET status='finalized'
    → sendEmail (billStatusTemplate, status='finalized') to all accepted
    → socket: 'bill_finalized' to all

Payment (monthly cycle or one-time)
  → POST /bills/:id/pay-cycle or /mark-paid or /pay-in-full
    → INSERT monthly_cycle_payments or UPDATE payment_status
    → socket: 'bill_status_update'
```

### Transaction Split (CreateTransactionModal) Flow

```
Owner creates transaction (expense or bill type)
  → POST /transactions → createTransaction
    → INSERT transactions(type, is_shared=1)
    → for each participant:
        INSERT transaction_participants(invitation_status='pending', status='pending')
        sendEmail (transactionInvitationTemplate)
          ├── expense: "shared expense tracking" wording, no pay-now CTA
          └── bill: standard split invitation wording
        sendNotificationToUser (type='transaction_split_invitation')

Participant responds via TransactionBillDetailModal
  → POST /transactions/:id/respond → respondToTransactionSplit
    → UPDATE transaction_participants SET invitation_status='accepted'|'rejected'
    → sendEmail (billStatusTemplate) to owner
    → if all participants responded:
        socket: 'transaction_all_responded' → all participants invalidate Transaction cache

Participant marks their share paid (bill type only)
  → POST /transactions/:id/participants/:uid/mark-paid → markParticipantPaid
    → UPDATE transaction_participants SET status='paid'
    → socket: 'transaction_payment' (allPaid flag included)
  → UI: optimistic localPaid state updates immediately (no waiting for cache refresh)

For expense type: no pay action — accepted = expense tracked on their account
  → TransactionBillDetailModal shows blue "Expense accepted — tracked" banner
```

### Email Notification Flow

```
Controller calls sendInvitationEmail() or sendResponseEmail()
  │
  ├── Fetch participant email from users table
  ├── Fetch amount_owed from transaction_participants
  ├── Build HTML with appropriate template
  │   ├── transactionInvitationTemplate → CTA: /dashboard?tab=invitations
  │   └── billInvitationTemplate        → CTA: /bills/:id (service bills only)
  └── sendEmail({ to, subject, html })
        └── Nodemailer → SES SMTP (email-smtp.us-west-1.amazonaws.com:587)

Socket notification (parallel to email, not dependent):
  sendNotificationToUser(userId, { type, title, message, data })
    └── connectedUsers.get(userId) → socket.to(socketId).emit('notification', payload)
```

---

## Environment Configuration

| Variable | Where Used | Value (dev) |
|----------|-----------|-------------|
| `PORT` | server.js | `5001` |
| `NODE_ENV` | email service | `development` |
| `DB_HOST` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | database.js | `localhost / work_db` |
| `COGNITO_USER_POOL_ID` | middleware/auth.js | `us-west-1_a48MtZvaJ` |
| `COGNITO_CLIENT_ID` | middleware/auth.js | _(Cognito app client)_ |
| `COGNITO_REGION` | middleware/auth.js | `us-west-1` |
| `SES_SMTP_HOST` | email.service.js | `email-smtp.us-west-1.amazonaws.com` |
| `SES_SMTP_PORT` | email.service.js | `587` |
| `SES_SMTP_USER` / `SES_SMTP_PASSWORD` | email.service.js | _(AWS SES credentials)_ |
| `SES_FROM_EMAIL` | email.service.js | `mail@spend-sync.com` |
| `SES_FROM_NAME` | email.service.js | `BillSplit App` |
| `FRONTEND_URL` | email templates | `http://localhost:5173` |
| `APP_NAME` | email templates | `BillSplit` |
| `VITE_COGNITO_USER_POOL_ID` | frontend/services/cognito.js | _(same pool)_ |
| `VITE_COGNITO_CLIENT_ID` | frontend/services/cognito.js | _(same client)_ |

---

## Key File Index

| File | Role |
|------|------|
| `backend/server.js` | Express + Socket.IO bootstrap, route mounting |
| `backend/config/database.js` | MySQL pool, query helpers |
| `backend/middleware/auth.js` | Cognito JWT verification |
| `backend/controllers/auth.controller.js` | User upsert post-login |
| `backend/controllers/bill.controller.js` | Service bill CRUD |
| `backend/controllers/invitation.controller.js` | Service bill invite/respond |
| `backend/controllers/payment.controller.js` | Bill payments + cycles |
| `backend/controllers/transaction.controller.js` | Shared expense CRUD + splits |
| `backend/controllers/friend.controller.js` | Friendship management |
| `backend/controllers/user.controller.js` | Profile + bill aggregation |
| `backend/services/email.service.js` | SES SMTP email sending |
| `backend/utils/notifications.js` | Socket.IO push helper |
| `backend/templates/emails/base.template.js` | HTML email shell |
| `backend/templates/emails/bill-invitation.template.js` | Service bill invite email |
| `backend/templates/emails/bill-status.template.js` | Bill status change emails |
| `backend/templates/emails/transaction-invitation.template.js` | Transaction invite email (expense-aware) |
| `backend/database/schema.sql` | Full MySQL schema (15 tables) |
| `frontend/src/main.jsx` | Amplify config + Redux bootstrap |
| `frontend/src/App.jsx` | React Router routes + ProtectedRoute |
| `frontend/src/store.js` | Redux store + redux-persist config |
| `frontend/src/feature/auth/authSlice.js` | Auth state (user, setCredentials, logout) |
| `frontend/src/services/cognito.js` | Amplify configuration |
| `frontend/src/services/api.js` | RTK Query — 43 endpoints, tag-based cache |
| `frontend/src/contexts/SocketContext.jsx` | Socket.IO: connect, notify, invalidate cache |
| `frontend/src/components/Login.jsx` | Cognito signIn + /auth/sync |
| `frontend/src/components/Register.jsx` | Cognito signUp + confirm |
| `frontend/src/components/Dashboard.jsx` | Main tab container |
| `frontend/src/components/BillSplitModal.jsx` | Service bill split + invite UI |
| `frontend/src/components/CreateTransactionModal.jsx` | Transaction create + percentage split |
| `frontend/src/components/TransactionBillDetailModal.jsx` | Transaction detail + pay/accept actions |
| `frontend/src/components/PersonalBillsList.jsx` | Transaction list with filters |
| `frontend/src/components/FriendsList.jsx` | Friend requests + search |
