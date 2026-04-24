import { Navigate } from 'react-router-dom'

// Decode JWT payload without an external library
function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token')

  if (!token) {
    return <Navigate to="/login" replace />
  }

  const payload = decodeJwtPayload(token)
  if (!payload || !payload.exp || Date.now() >= payload.exp * 1000) {
    // Token is missing, malformed, or expired — clear storage and redirect
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    return <Navigate to="/login" replace />
  }

  return children
}
