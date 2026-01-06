# React Auth Fullstack App (Frontend + Backend)

This project implements a complete authentication system using:

- **Frontend:** React + Vite + Redux Toolkit + RTK Query + Tailwind 
- **Backend:** Express + JWT (access & refresh tokens with HTTP-only cookies)

## Project Structure

```
react-auth/
├── backend/     # Express server with JWT authentication
├── frontend/    # React app with login, route protection, and automatic token refresh
└── README.md
```

## Getting Started

### 1. Clone the repository

```bash
cd react-auth
```

### 2. Start the backend (Express)

```bash
cd backend
npm install
node index.js
```

The server will be running at:
http://localhost:5001

Backend endpoints:
- `POST /auth/login` → generates access and refresh tokens
- `POST /auth/refresh-token` → renews the access token
- `GET /protected` → example of a private route

### 3. Start the frontend [React + Vite + Tailwind + shadcn/ui ]

```bash
cd ../frontend
npm install
npm run dev
```

The app will be available at:
http://localhost:5173

## Authentication Flow

1. User logs in via `/auth/login`
2. Backend returns an `access_token` (in the response body) and a `refreshToken` (as a HTTP-only cookie)
3. The frontend stores the access token in Redux
4. Protected requests include the access token in the `Authorization` header
5. If the token expires, the frontend automatically calls `/auth/refresh-token` to get a new access token
6. If both tokens are invalid, the user is redirected to the login page

## Technologies Used

### Backend
- Express
- jsonwebtoken
- cookie-parser
- cors

### Frontend
- React + Vite
- Redux Toolkit
- RTK Query
- React Router DOM
- Tailwind CSS (optional)

