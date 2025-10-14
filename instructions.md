We're implementing real-time updates for a bill-splitting app using Socket.IO and MySQL. When a user is invited to a bill, they receive a notification and can accept or reject the invitation. 

Express server with JWT authentication
backend
├── config/
│   └── database.js
├── database/
│   └── schema.sql
├── node_modules/
├── package.json
├── package-lock.json
├── server.js
└── token.js

React app with login, route protection, and automatic token refresh
frontend
├── components.json
├── eslint.config.js
├── index.html
├── jsconfig.json
├── node_modules/
├── package.json
├── package-lock.json
├── public/
├── src/
│   ├── App.css
│   ├── App.jsx
│   ├── assets/
│   ├── components/
│   │   ├── BillDetails.jsx
│   │   ├── BillSplitModal.jsx
│   │   ├── BillsList.jsx
│   │   ├── CreateBilModal.jsx
│   │   ├── Dashboard.jsx
│   │   ├── InvitationResponseModal.jsx
│   │   ├── Login.jsx
│   │   ├── ProtectedRoute.jsx
│   │   ├── Register.jsx
│   │   ├── UserProfile.jsx
│   │   └── ui/
│   ├── contexts/
│   ├── feature/
│   ├── features/
│   │   └── api/
│   ├── index.css
│   ├── lib/
│   ├── main.jsx
│   ├── services/
│   │   └── api.js
│   └── store.ts
└── vite.config.js


Current configuration:
- Frontend: React + Vite + TypeScript  
  - Real-time events handled via socket.on('bill:updated', ...)
- Backend: Node.js + Express + Socket.IO  
  - MySQL schema includes:  
    - service_bills — global bill state  
    - bill_invitations — per-user responses  
    - service_bill_participants — final accepted participants  
    - bill_activity_log — activity tracking