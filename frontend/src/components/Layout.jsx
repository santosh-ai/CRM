import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, UserCheck, FileText, BookOpen,
  AlertTriangle, LogOut, Menu, X, ChevronRight, Shield
} from 'lucide-react'
import api from '../api'

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}')
  } catch {
    return {}
  }
}

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'staff'] },
  { to: '/staff', label: 'Staff', icon: Users, roles: ['admin', 'manager'] },
  { to: '/clients', label: 'Clients', icon: UserCheck, roles: ['admin', 'manager', 'staff'] },
  { to: '/documents', label: 'Documents', icon: FileText, roles: ['admin', 'manager', 'staff'] },
  { to: '/trainings', label: 'Trainings', icon: BookOpen, roles: ['admin', 'manager', 'staff'] },
  { to: '/incidents', label: 'Incidents', icon: AlertTriangle, roles: ['admin', 'manager', 'staff'] },
]

function roleColor(role) {
  if (role === 'admin') return 'bg-purple-100 text-purple-700'
  if (role === 'manager') return 'bg-blue-100 text-blue-700'
  return 'bg-gray-100 text-gray-700'
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const user = getUser()

  const handleLogout = async () => {
    try {
      // Revoke the token server-side so it cannot be replayed after logout
      await api.post('/auth/logout')
    } catch {
      // If the server call fails (e.g. network error) we still clear locally
    } finally {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      navigate('/login')
    }
  }

  const filteredNav = navItems.filter(item => item.roles.includes(user.role))

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-blue-700">
        <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
          <Shield className="w-5 h-5 text-blue-700" />
        </div>
        <div>
          <p className="font-bold text-white text-sm leading-tight">NDIS CRM</p>
          <p className="text-blue-300 text-xs">Disability Services</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredNav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-700 text-white'
                  : 'text-blue-100 hover:bg-blue-700/60 hover:text-white'
              }`
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User info */}
      <div className="px-4 py-4 border-t border-blue-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-blue-400 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-medium truncate">{user.name}</p>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium capitalize ${roleColor(user.role)}`}>
              {user.role}
            </span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-blue-200 hover:text-white hover:bg-blue-700 rounded-lg text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-shrink-0 flex-col bg-blue-800">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative z-50 w-64 h-full bg-blue-800 flex flex-col">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 text-blue-200 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 lg:px-6 h-14 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center text-sm text-gray-500">
              <ChevronRight className="w-4 h-4 mx-1" />
              <span className="font-medium text-gray-900">
                {navItems.find(n => window.location.pathname.startsWith(n.to))?.label || 'Dashboard'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 hidden sm:block">{user.name}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Logout</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
