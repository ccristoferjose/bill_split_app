// frontend/src/App.jsx
import './App.css'
import './index.css'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import LandingPage from './components/LandingPage'
import Login from './components/Login'
import Register from './components/Register'
import Dashboard from './components/Dashboard'
import ProtectedRoute from './components/ProtectedRoute'
import ForgotPassword from './components/ForgotPassword'
import VerifyEmail from './components/VerifyEmail'
import FriendInvitationHandler from './components/FriendInvitationHandler'
import SubscriptionPage from './components/SubscriptionPage'
import { SocketProvider } from './contexts/SocketContext'
import { Toaster } from 'sonner'

function App() {
  const { user } = useSelector((state) => state.auth);

  return (
    <SocketProvider>
      <Router>
        <Routes>
          <Route
            path="/"
            element={user ? <Navigate to="/dashboard" replace /> : <LandingPage />}
          />
          <Route
            path="/login"
            element={user ? <Navigate to="/dashboard" replace /> : <Login />}
          />
          <Route
            path="/register"
            element={user ? <Navigate to="/dashboard" replace /> : <Register />}
          />
          <Route
            path="/verify"
            element={user ? <Navigate to="/dashboard" replace /> : <VerifyEmail />}
          />
          <Route
            path="/friends/invitations/:friendshipId"
            element={<FriendInvitationHandler />}
          />
          <Route
            path="/forgot-password"
            element={user ? <Navigate to="/dashboard" replace /> : <ForgotPassword />}
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/subscription"
            element={
              <ProtectedRoute>
                <SubscriptionPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
      <Toaster position="top-right" />
    </SocketProvider>
  )
}

export default App
