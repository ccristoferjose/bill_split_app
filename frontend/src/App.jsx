// frontend/src/App.jsx
import './App.css'
import './index.css'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Login from './components/Login'
import Register from './components/Register'
import Dashboard from './components/Dashboard'
import Profile from './components/Profile'
// Import other components...

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/bills/create" element={<CreateBill />} />
        <Route path="/bills/:billId" element={<BillDetails />} />
        <Route path="/bills/created" element={<CreatedBills />} />
        <Route path="/bills/invited" element={<InvitedBills />} />
        <Route path="/bills/participating" element={<ParticipatingBills />} />
      </Routes>
    </Router>
  )
}

export default App