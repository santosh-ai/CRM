import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, UserCheck, AlertTriangle, ShieldCheck, XCircle, Clock, ChevronRight } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import api from '../api'

function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="card p-6 flex items-start gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
        <p className="text-sm text-gray-500">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function severityBadge(severity) {
  const map = {
    low: 'bg-gray-100 text-gray-700',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
  }
  return map[severity] || map.medium
}

function statusBadge(status) {
  const map = {
    open: 'bg-red-100 text-red-700',
    under_review: 'bg-yellow-100 text-yellow-700',
    resolved: 'bg-green-100 text-green-700',
  }
  return map[status] || 'bg-gray-100 text-gray-700'
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/dashboard')
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  const { stats = {}, expired_docs = [], expiring_docs = [], expiring_trainings = [], recent_incidents = [] } = data || {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">NDIS compliance & service overview</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Active Staff" value={stats.total_staff} color="bg-blue-600" />
        <StatCard icon={UserCheck} label="Active Clients" value={stats.total_clients} color="bg-emerald-600" />
        <StatCard icon={AlertTriangle} label="Active Incidents" value={stats.active_incidents} color="bg-orange-500" />
        <StatCard
          icon={ShieldCheck}
          label="Compliance Rate"
          value={stats.compliance_rate != null ? `${stats.compliance_rate}%` : '—'}
          color={stats.compliance_rate >= 80 ? 'bg-green-600' : 'bg-red-500'}
          sub="Staff with all docs valid"
        />
      </div>

      {/* Alerts */}
      {(expired_docs.length > 0 || expiring_docs.length > 0 || expiring_trainings.length > 0) && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Compliance Alerts
          </h2>

          {expired_docs.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-medium text-red-800">
                  {expired_docs.length} Expired Document{expired_docs.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                {expired_docs.map(doc => (
                  <div key={doc.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{doc.document_type}</p>
                      <p className="text-xs text-gray-500">{doc.staff_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-red-600 font-medium">
                        Expired {format(new Date(doc.expiry_date), 'dd MMM yyyy')}
                      </p>
                      <Link
                        to={`/staff/${doc.user_id}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View staff →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {expiring_docs.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">
                  {expiring_docs.length} Document{expiring_docs.length > 1 ? 's' : ''} Expiring Soon
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                {expiring_docs.map(doc => (
                  <div key={doc.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{doc.document_type}</p>
                      <p className="text-xs text-gray-500">{doc.staff_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-yellow-700 font-medium">
                        Expires {format(new Date(doc.expiry_date), 'dd MMM yyyy')}
                        {' '}({differenceInDays(new Date(doc.expiry_date), new Date())} days)
                      </p>
                      <Link
                        to={`/staff/${doc.user_id}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View staff →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {expiring_trainings.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">
                  {expiring_trainings.length} Training{expiring_trainings.length > 1 ? 's' : ''} Expiring Soon
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                {expiring_trainings.map(t => (
                  <div key={t.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t.training_name}</p>
                      <p className="text-xs text-gray-500">{t.staff_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-yellow-700 font-medium">
                        Expires {format(new Date(t.expiry_date), 'dd MMM yyyy')}
                      </p>
                      <Link
                        to={`/staff/${t.user_id}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View staff →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Incidents */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent Incidents</h2>
          <Link to="/incidents" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        {recent_incidents.length === 0 ? (
          <div className="px-6 py-10 text-center text-gray-400">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No incidents recorded</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                  <th className="px-6 py-3">Incident</th>
                  <th className="px-6 py-3">Client</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Severity</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recent_incidents.map(inc => (
                  <tr key={inc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-gray-900">{inc.title || 'Untitled'}</td>
                    <td className="px-6 py-3 text-gray-600">{inc.client_name}</td>
                    <td className="px-6 py-3 text-gray-500">
                      {format(new Date(inc.incident_date), 'dd MMM yyyy')}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${severityBadge(inc.severity)}`}>
                        {inc.severity}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge(inc.status)}`}>
                        {inc.status?.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
