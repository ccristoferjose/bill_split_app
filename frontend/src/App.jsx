import './App.css'
import './index.css'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Login from './components/Login'
import Register from './components/Register'

function App() {

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<div>Welcome! You are logged in.</div>} />
      </Routes>
    </Router>
  )
}

export default App
