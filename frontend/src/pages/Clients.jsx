import { useEffect, useState, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { Dialog, Transition } from '@headlessui/react'
import { Plus, Search, Edit2, ChevronRight, X } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import api from '../api'

function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
}

const EMPTY_FORM = {
  name: '', ndis_number: '', dob: '', address: '', phone: '', email: '',
  emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relation: '',
  care_plan: '', support_needs: '', risk_notes: ''
}

export default function Clients() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const currentUser = getUser()
  const canEdit = currentUser.role === 'admin' || currentUser.role === 'manager'

  const fetchClients = async () => {
    try {
      const params = {}
      if (search) params.search = search
      const res = await api.get('/clients', { params })
      setClients(res.data)
    } catch {
      toast.error('Failed to load clients')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchClients() }, [search])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (client) => {
    setEditing(client)
    setForm({
      name: client.name,
      ndis_number: client.ndis_number || '',
      dob: client.dob ? client.dob.split('T')[0] : '',
      address: client.address || '',
      phone: client.phone || '',
      email: client.email || '',
      emergency_contact_name: client.emergency_contact_name || '',
      emergency_contact_phone: client.emergency_contact_phone || '',
      emergency_contact_relation: client.emergency_contact_relation || '',
      care_plan: client.care_plan || '',
      support_needs: client.support_needs || '',
      risk_notes: client.risk_notes || '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        await api.put(`/clients/${editing.id}`, form)
        toast.success('Client updated')
      } else {
        await api.post('/clients', form)
        toast.success('Client created')
      }
      setModalOpen(false)
      fetchClients()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const f = (key) => ({ value: form[key], onChange: e => setForm(p => ({ ...p, [key]: e.target.value })) })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-1">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
        </div>
        {canEdit && (
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Client
          </button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" className="input-field pl-9" placeholder="Search by name or NDIS number..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : clients.length === 0 ? (
          <div className="text-center py-16 text-gray-400"><p>No clients found</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">NDIS Number</th>
                  <th className="px-6 py-3">DOB</th>
                  <th className="px-6 py-3">Phone</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clients.map(client => (
                  <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3">
                      <Link to={`/clients/${client.id}`} className="font-medium text-blue-600 hover:underline flex items-center gap-1">
                        {client.name} <ChevronRight className="w-3 h-3" />
                      </Link>
                      {client.email && <p className="text-xs text-gray-400">{client.email}</p>}
                    </td>
                    <td className="px-6 py-3 text-gray-600 font-mono text-xs">{client.ndis_number || '—'}</td>
                    <td className="px-6 py-3 text-gray-500">{client.dob ? format(new Date(client.dob), 'dd MMM yyyy') : '—'}</td>
                    <td className="px-6 py-3 text-gray-500">{client.phone || '—'}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${client.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {client.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      {canEdit && (
                        <button onClick={() => openEdit(client)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <Transition show={modalOpen} as={Fragment}>
        <Dialog onClose={() => setModalOpen(false)} className="relative z-50">
          <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/40" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-2xl bg-white rounded-2xl shadow-xl">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <Dialog.Title className="font-semibold text-gray-900">{editing ? 'Edit Client' : 'Add Client'}</Dialog.Title>
                    <button onClick={() => setModalOpen(false)}><X className="w-5 h-5 text-gray-400" /></button>
                  </div>
                  <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">Full Name *</label>
                        <input className="input-field" {...f('name')} required />
                      </div>
                      <div>
                        <label className="label">NDIS Number</label>
                        <input className="input-field" {...f('ndis_number')} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">Date of Birth</label>
                        <input type="date" className="input-field" {...f('dob')} />
                      </div>
                      <div>
                        <label className="label">Phone</label>
                        <input className="input-field" {...f('phone')} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">Email</label>
                        <input type="email" className="input-field" {...f('email')} />
                      </div>
                      <div>
                        <label className="label">Address</label>
                        <input className="input-field" {...f('address')} />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-sm font-medium text-gray-700 mb-3">Emergency Contact</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="label">Name</label>
                          <input className="input-field" {...f('emergency_contact_name')} />
                        </div>
                        <div>
                          <label className="label">Phone</label>
                          <input className="input-field" {...f('emergency_contact_phone')} />
                        </div>
                        <div>
                          <label className="label">Relationship</label>
                          <input className="input-field" placeholder="e.g. Spouse" {...f('emergency_contact_relation')} />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="label">Care Plan</label>
                      <textarea className="input-field" rows={3} {...f('care_plan')} />
                    </div>
                    <div>
                      <label className="label">Support Needs</label>
                      <textarea className="input-field" rows={2} {...f('support_needs')} />
                    </div>
                    <div>
                      <label className="label">Risk Notes</label>
                      <textarea className="input-field" rows={2} {...f('risk_notes')} />
                    </div>

                    {editing && (
                      <div className="flex items-center gap-3">
                        <input type="checkbox" id="is_active" checked={form.is_active !== false} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} className="rounded" />
                        <label htmlFor="is_active" className="text-sm text-gray-700">Active client</label>
                      </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                      <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
                      <button type="submit" disabled={saving} className="btn-primary">
                        {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Client'}
                      </button>
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
