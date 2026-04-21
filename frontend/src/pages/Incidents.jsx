import { useEffect, useState, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Plus, Filter, Edit2, X } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import api from '../api'

function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
}

function SeverityBadge({ severity }) {
  const map = {
    low: 'bg-gray-100 text-gray-700',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-800'
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${map[severity] || map.medium}`}>
      {severity}
    </span>
  )
}

function StatusBadge({ status }) {
  const map = {
    open: 'bg-red-100 text-red-700',
    under_review: 'bg-yellow-100 text-yellow-700',
    resolved: 'bg-green-100 text-green-700'
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${map[status] || 'bg-gray-100 text-gray-700'}`}>
      {status?.replace('_', ' ')}
    </span>
  )
}

export default function Incidents() {
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')
  const [updateModal, setUpdateModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [updateForm, setUpdateForm] = useState({ status: '', severity: '', supervisor_notes: '' })
  const [newModal, setNewModal] = useState(false)
  const [clients, setClients] = useState([])
  const [newForm, setNewForm] = useState({ client_id: '', title: '', description: '', severity: 'medium', incident_date: '' })
  const [saving, setSaving] = useState(false)
  const currentUser = getUser()
  const canManage = currentUser.role === 'admin' || currentUser.role === 'manager'

  const fetchIncidents = async () => {
    try {
      const params = {}
      if (filterStatus) params.status = filterStatus
      if (filterSeverity) params.severity = filterSeverity
      const res = await api.get('/incidents', { params })
      setIncidents(res.data)
    } catch {
      toast.error('Failed to load incidents')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIncidents()
    api.get('/clients').then(res => setClients(res.data)).catch(() => {})
  }, [filterStatus, filterSeverity])

  const openUpdate = (incident) => {
    setSelected(incident)
    setUpdateForm({ status: incident.status, severity: incident.severity, supervisor_notes: incident.supervisor_notes || '' })
    setUpdateModal(true)
  }

  const saveUpdate = async (e) => {
    e.preventDefault()
    try {
      await api.put(`/incidents/${selected.id}`, updateForm)
      toast.success('Incident updated')
      setUpdateModal(false)
      fetchIncidents()
    } catch {
      toast.error('Failed to update')
    }
  }

  const submitNew = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/incidents', newForm)
      toast.success('Incident reported')
      setNewModal(false)
      setNewForm({ client_id: '', title: '', description: '', severity: 'medium', incident_date: '' })
      fetchIncidents()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Incidents</h1>
          <p className="text-sm text-gray-500 mt-1">{incidents.length} incident{incidents.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setNewModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Report Incident
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select className="input-field py-1.5 text-sm w-auto" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="under_review">Under Review</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        <select className="input-field py-1.5 text-sm w-auto" value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}>
          <option value="">All Severities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        {(filterStatus || filterSeverity) && (
          <button onClick={() => { setFilterStatus(''); setFilterSeverity('') }} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Open', status: 'open', color: 'bg-red-100 text-red-700' },
          { label: 'Under Review', status: 'under_review', color: 'bg-yellow-100 text-yellow-700' },
          { label: 'Resolved', status: 'resolved', color: 'bg-green-100 text-green-700' },
        ].map(({ label, status, color }) => {
          const count = incidents.filter(i => i.status === status).length
          return count > 0 ? (
            <span key={status} className={`px-3 py-1.5 rounded-full text-xs font-medium ${color}`}>
              {count} {label}
            </span>
          ) : null
        })}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : incidents.length === 0 ? (
          <div className="text-center py-16 text-gray-400"><p>No incidents found</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                  <th className="px-6 py-3">Title</th>
                  <th className="px-6 py-3">Client</th>
                  <th className="px-6 py-3">Reported By</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Severity</th>
                  <th className="px-6 py-3">Status</th>
                  {canManage && <th className="px-6 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {incidents.map(inc => (
                  <tr key={inc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <p className="font-medium text-gray-900">{inc.title || 'Untitled'}</p>
                      <p className="text-xs text-gray-400 max-w-xs truncate">{inc.description}</p>
                    </td>
                    <td className="px-6 py-3 text-gray-600">{inc.client_name}</td>
                    <td className="px-6 py-3 text-gray-500">{inc.reported_by_name}</td>
                    <td className="px-6 py-3 text-gray-500">{format(new Date(inc.incident_date), 'dd MMM yyyy')}</td>
                    <td className="px-6 py-3"><SeverityBadge severity={inc.severity} /></td>
                    <td className="px-6 py-3"><StatusBadge status={inc.status} /></td>
                    {canManage && (
                      <td className="px-6 py-3 text-right">
                        <button onClick={() => openUpdate(inc)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Report new incident modal */}
      <Transition show={newModal} as={Fragment}>
        <Dialog onClose={() => setNewModal(false)} className="relative z-50">
          <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/40" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-lg bg-white rounded-2xl shadow-xl">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <Dialog.Title className="font-semibold text-gray-900">Report Incident</Dialog.Title>
                    <button onClick={() => setNewModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
                  </div>
                  <form onSubmit={submitNew} className="p-6 space-y-4">
                    <div>
                      <label className="label">Client *</label>
                      <select className="input-field" value={newForm.client_id} onChange={e => setNewForm(f => ({ ...f, client_id: e.target.value }))} required>
                        <option value="">Select client</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Title</label>
                      <input className="input-field" value={newForm.title} onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))} placeholder="Brief incident title" />
                    </div>
                    <div>
                      <label className="label">Description *</label>
                      <textarea className="input-field" rows={4} value={newForm.description} onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))} required placeholder="Describe the incident in detail..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">Severity</label>
                        <select className="input-field" value={newForm.severity} onChange={e => setNewForm(f => ({ ...f, severity: e.target.value }))}>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">Incident Date/Time</label>
                        <input type="datetime-local" className="input-field" value={newForm.incident_date} onChange={e => setNewForm(f => ({ ...f, incident_date: e.target.value }))} />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => setNewModal(false)} className="btn-secondary">Cancel</button>
                      <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Submitting...' : 'Report Incident'}</button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Update incident modal */}
      <Transition show={updateModal} as={Fragment}>
        <Dialog onClose={() => setUpdateModal(false)} className="relative z-50">
          <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/40" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-md bg-white rounded-2xl shadow-xl">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <Dialog.Title className="font-semibold text-gray-900">Update Incident</Dialog.Title>
                    <button onClick={() => setUpdateModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
                  </div>
                  {selected && (
                    <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{selected.title || 'Untitled'}</p>
                      <p className="text-xs text-gray-500">{selected.client_name}</p>
                    </div>
                  )}
                  <form onSubmit={saveUpdate} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">Status</label>
                        <select className="input-field" value={updateForm.status} onChange={e => setUpdateForm(f => ({ ...f, status: e.target.value }))}>
                          <option value="open">Open</option>
                          <option value="under_review">Under Review</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">Severity</label>
                        <select className="input-field" value={updateForm.severity} onChange={e => setUpdateForm(f => ({ ...f, severity: e.target.value }))}>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="label">Supervisor Notes</label>
                      <textarea className="input-field" rows={4} value={updateForm.supervisor_notes} onChange={e => setUpdateForm(f => ({ ...f, supervisor_notes: e.target.value }))} placeholder="Add investigation notes, actions taken..." />
                    </div>
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => setUpdateModal(false)} className="btn-secondary">Cancel</button>
                      <button type="submit" className="btn-primary">Save Changes</button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  )
}
