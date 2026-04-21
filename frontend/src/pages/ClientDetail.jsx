import { useEffect, useState, Fragment } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Dialog, Transition } from '@headlessui/react'
import { ArrowLeft, StickyNote, AlertTriangle, Plus, Edit2, Trash2, X } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import api from '../api'

function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
}

function SeverityBadge({ severity }) {
  const map = { low: 'bg-gray-100 text-gray-700', medium: 'bg-yellow-100 text-yellow-700', high: 'bg-orange-100 text-orange-700', critical: 'bg-red-100 text-red-800' }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${map[severity] || map.medium}`}>{severity}</span>
}

function StatusBadge({ status }) {
  const map = { open: 'bg-red-100 text-red-700', under_review: 'bg-yellow-100 text-yellow-700', resolved: 'bg-green-100 text-green-700' }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-700'}`}>{status?.replace('_', ' ')}</span>
}

export default function ClientDetail() {
  const { id } = useParams()
  const [client, setClient] = useState(null)
  const [notes, setNotes] = useState([])
  const [incidents, setIncidents] = useState([])
  const [activeTab, setActiveTab] = useState('notes')
  const [loading, setLoading] = useState(true)
  const [noteText, setNoteText] = useState('')
  const [submittingNote, setSubmittingNote] = useState(false)
  const [incidentModal, setIncidentModal] = useState(false)
  const [incidentForm, setIncidentForm] = useState({ title: '', description: '', severity: 'medium', incident_date: '' })
  const [savingIncident, setSavingIncident] = useState(false)
  const [editingIncident, setEditingIncident] = useState(null)
  const [updateModal, setUpdateModal] = useState(false)
  const [updateForm, setUpdateForm] = useState({ status: '', severity: '', supervisor_notes: '' })
  const currentUser = getUser()
  const canManage = currentUser.role === 'admin' || currentUser.role === 'manager'

  const fetchData = async () => {
    try {
      const [clientRes, notesRes, incidentsRes] = await Promise.all([
        api.get(`/clients/${id}`),
        api.get('/notes', { params: { client_id: id } }),
        api.get('/incidents', { params: { client_id: id } }),
      ])
      setClient(clientRes.data)
      setNotes(notesRes.data)
      setIncidents(incidentsRes.data)
    } catch {
      toast.error('Failed to load client data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [id])

  const addNote = async (e) => {
    e.preventDefault()
    if (!noteText.trim()) return
    setSubmittingNote(true)
    try {
      await api.post('/notes', { client_id: id, note: noteText })
      toast.success('Note added')
      setNoteText('')
      fetchData()
    } catch {
      toast.error('Failed to add note')
    } finally {
      setSubmittingNote(false)
    }
  }

  const deleteNote = async (noteId) => {
    if (!confirm('Delete this note?')) return
    try {
      await api.delete(`/notes/${noteId}`)
      toast.success('Note deleted')
      fetchData()
    } catch {
      toast.error('Failed to delete note')
    }
  }

  const submitIncident = async (e) => {
    e.preventDefault()
    setSavingIncident(true)
    try {
      await api.post('/incidents', { ...incidentForm, client_id: id })
      toast.success('Incident reported')
      setIncidentModal(false)
      setIncidentForm({ title: '', description: '', severity: 'medium', incident_date: '' })
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed')
    } finally {
      setSavingIncident(false)
    }
  }

  const openUpdate = (incident) => {
    setEditingIncident(incident)
    setUpdateForm({ status: incident.status, severity: incident.severity, supervisor_notes: incident.supervisor_notes || '' })
    setUpdateModal(true)
  }

  const saveUpdate = async (e) => {
    e.preventDefault()
    try {
      await api.put(`/incidents/${editingIncident.id}`, updateForm)
      toast.success('Incident updated')
      setUpdateModal(false)
      fetchData()
    } catch {
      toast.error('Failed to update')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>
  if (!client) return <div className="text-center py-20 text-gray-400">Client not found</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link to="/clients" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
            {client.ndis_number && <p className="text-sm text-gray-500 font-mono">NDIS: {client.ndis_number}</p>}
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${client.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {client.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Info */}
      <div className="card p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div><p className="text-gray-500">Date of Birth</p><p className="font-medium">{client.dob ? format(new Date(client.dob), 'dd MMM yyyy') : '—'}</p></div>
          <div><p className="text-gray-500">Phone</p><p className="font-medium">{client.phone || '—'}</p></div>
          <div><p className="text-gray-500">Email</p><p className="font-medium">{client.email || '—'}</p></div>
          <div className="col-span-2"><p className="text-gray-500">Address</p><p className="font-medium">{client.address || '—'}</p></div>
          {client.emergency_contact_name && (
            <div>
              <p className="text-gray-500">Emergency Contact</p>
              <p className="font-medium">{client.emergency_contact_name}</p>
              <p className="text-xs text-gray-400">{client.emergency_contact_relation} · {client.emergency_contact_phone}</p>
            </div>
          )}
        </div>
        {client.support_needs && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Support Needs</p>
            <p className="text-sm text-gray-700">{client.support_needs}</p>
          </div>
        )}
        {client.risk_notes && (
          <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-100">
            <p className="text-xs font-medium text-red-600 uppercase tracking-wider mb-1">⚠ Risk Notes</p>
            <p className="text-sm text-red-800">{client.risk_notes}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button onClick={() => setActiveTab('notes')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'notes' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
          <StickyNote className="w-4 h-4" /> Case Notes ({notes.length})
        </button>
        <button onClick={() => setActiveTab('incidents')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'incidents' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
          <AlertTriangle className="w-4 h-4" /> Incidents ({incidents.length})
        </button>
      </div>

      {/* Notes Tab */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          {/* Add note */}
          <div className="card p-5">
            <form onSubmit={addNote} className="space-y-3">
              <label className="label">Add Case Note</label>
              <textarea
                className="input-field"
                rows={3}
                placeholder="Enter case note..."
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                required
              />
              <div className="flex justify-end">
                <button type="submit" disabled={submittingNote} className="btn-primary flex items-center gap-2">
                  <Plus className="w-4 h-4" /> {submittingNote ? 'Adding...' : 'Add Note'}
                </button>
              </div>
            </form>
          </div>

          {/* Notes list */}
          {notes.length === 0 ? (
            <div className="card py-12 text-center text-gray-400">
              <StickyNote className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No case notes yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map(note => (
                <div key={note.id} className="card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-900">{note.staff_name || 'Unknown'}</span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-500">{format(new Date(note.note_date), 'dd MMM yyyy HH:mm')}</span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-line">{note.note}</p>
                    </div>
                    {(canManage || note.staff_id === currentUser.id) && (
                      <button onClick={() => deleteNote(note.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Incidents Tab */}
      {activeTab === 'incidents' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setIncidentModal(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Report Incident
            </button>
          </div>

          {incidents.length === 0 ? (
            <div className="card py-12 text-center text-gray-400">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No incidents recorded</p>
            </div>
          ) : (
            <div className="space-y-3">
              {incidents.map(inc => (
                <div key={inc.id} className="card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-medium text-gray-900">{inc.title || 'Untitled Incident'}</h3>
                        <SeverityBadge severity={inc.severity} />
                        <StatusBadge status={inc.status} />
                      </div>
                      <p className="text-xs text-gray-500 mb-2">
                        Reported by {inc.reported_by_name} · {format(new Date(inc.incident_date), 'dd MMM yyyy')}
                      </p>
                      <p className="text-sm text-gray-700">{inc.description}</p>
                      {inc.supervisor_notes && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                          <p className="text-xs font-medium text-blue-700 mb-1">Supervisor Notes</p>
                          <p className="text-sm text-blue-900">{inc.supervisor_notes}</p>
                        </div>
                      )}
                    </div>
                    {canManage && (
                      <button onClick={() => openUpdate(inc)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg flex-shrink-0">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Report Incident Modal */}
      <Transition show={incidentModal} as={Fragment}>
        <Dialog onClose={() => setIncidentModal(false)} className="relative z-50">
          <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/40" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-lg bg-white rounded-2xl shadow-xl">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <Dialog.Title className="font-semibold text-gray-900">Report Incident</Dialog.Title>
                    <button onClick={() => setIncidentModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
                  </div>
                  <form onSubmit={submitIncident} className="p-6 space-y-4">
                    <div>
                      <label className="label">Title</label>
                      <input className="input-field" value={incidentForm.title} onChange={e => setIncidentForm(f => ({ ...f, title: e.target.value }))} placeholder="Brief title" />
                    </div>
                    <div>
                      <label className="label">Description *</label>
                      <textarea className="input-field" rows={4} value={incidentForm.description} onChange={e => setIncidentForm(f => ({ ...f, description: e.target.value }))} required placeholder="Describe what happened..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">Severity</label>
                        <select className="input-field" value={incidentForm.severity} onChange={e => setIncidentForm(f => ({ ...f, severity: e.target.value }))}>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">Incident Date</label>
                        <input type="datetime-local" className="input-field" value={incidentForm.incident_date} onChange={e => setIncidentForm(f => ({ ...f, incident_date: e.target.value }))} />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => setIncidentModal(false)} className="btn-secondary">Cancel</button>
                      <button type="submit" disabled={savingIncident} className="btn-primary">{savingIncident ? 'Submitting...' : 'Report Incident'}</button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Update Incident Modal */}
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
                      <textarea className="input-field" rows={3} value={updateForm.supervisor_notes} onChange={e => setUpdateForm(f => ({ ...f, supervisor_notes: e.target.value }))} />
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
