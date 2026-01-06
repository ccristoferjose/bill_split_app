// frontend/src/App.jsx
import './App.css'
import './index.css'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import Login from './components/Login'
import Register from './components/Register'
import Dashboard from './components/Dashboard'
import ProtectedRoute from './components/ProtectedRoute'
import { SocketProvider } from './contexts/SocketContext'
import { Toaster } from 'sonner'

function App() {
  const { token } = useSelector((state) => state.auth);

  return (
    <SocketProvider>
      <Router>
        <Routes>
          <Route 
            path="/" 
            element={token ? <Navigate to="/dashboard" replace /> : <Login />} 
          />
          <Route 
            path="/login" 
            element={token ? <Navigate to="/dashboard" replace /> : <Login />} 
          />
          <Route 
            path="/register" 
            element={token ? <Navigate to="/dashboard" replace /> : <Register />} 
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
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
