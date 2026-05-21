import axios from 'axios'

// Decode JWT payload without external library
function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}

function clearSession() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

// ── Request interceptor ─────────────────────────────────────────────────────
// Attaches the token and performs a proactive client-side expiry check so
// we never send a request we know will fail with 401.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      const payload = decodeJwtPayload(token)
      if (!payload || !payload.exp || Date.now() >= payload.exp * 1000) {
        // Token is already expired — clear local storage and redirect before
        // wasting a round-trip to the server.
        clearSession()
        window.location.href = '/login'
        return Promise.reject(new Error('Session expired'))
      }
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ── Response interceptor ────────────────────────────────────────────────────
// Handles 401s that slip through (e.g. server-side revocation).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearSession()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
