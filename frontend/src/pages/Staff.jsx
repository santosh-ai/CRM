import { useEffect, useState, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { Dialog, Transition } from '@headlessui/react'
import { Plus, Search, Edit2, UserX, X, ChevronRight, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import api from '../api'

function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
}

function ComplianceBadge({ expired, expiring }) {
  if (expired > 0) return <span className="badge-expired"><XCircle className="w-3 h-3" />{expired} expired</span>
  if (expiring > 0) return <span className="badge-expiring"><AlertTriangle className="w-3 h-3" />{expiring} expiring</span>
  return <span className="badge-valid"><CheckCircle className="w-3 h-3" />Compliant</span>
}

const EMPTY_FORM = {
  name: '', email: '', password: '', role: 'staff', position: '',
  employment_type: 'full-time', phone: '', address: '', availability: ''
}

export default function Staff() {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const currentUser = getUser()

  const fetchStaff = async () => {
    try {
      const params = {}
      if (search) params.search = search
      const res = await api.get('/staff', { params })
      setStaff(res.data)
    } catch (err) {
      toast.error('Failed to load staff')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStaff() }, [search])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (member) => {
    setEditing(member)
    setForm({
      name: member.name, email: member.email, password: '',
      role: member.role, position: member.position || '',
      employment_type: member.employment_type || 'full-time',
      phone: member.phone || '', address: member.address || '',
      availability: member.availability || ''
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        const payload = { ...form }
        if (!payload.password) delete payload.password
        await api.put(`/staff/${editing.id}`, payload)
        toast.success('Staff updated')
      } else {
        await api.post('/staff', form)
        toast.success('Staff member created')
      }
      setModalOpen(false)
      fetchStaff()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (member) => {
    if (!confirm(`Deactivate ${member.name}?`)) return
    try {
      await api.delete(`/staff/${member.id}`)
      toast.success('Staff member deactivated')
      fetchStaff()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
          <p className="text-sm text-gray-500 mt-1">{staff.length} team member{staff.length !== 1 ? 's' : ''}</p>
        </div>
        {currentUser.role === 'admin' && (
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Staff
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          className="input-field pl-9"
          placeholder="Search staff..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : staff.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p>No staff members found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Position</th>
                  <th className="px-6 py-3">Employment</th>
                  <th className="px-6 py-3">Compliance</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staff.map(member => (
                  <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3">
                      <Link
                        to={`/staff/${member.id}`}
                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                      >
                        {member.name} <ChevronRight className="w-3 h-3" />
                      </Link>
                      <p className="text-xs text-gray-400">{member.email}</p>
                    </td>
                    <td className="px-6 py-3 capitalize">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize
                        ${member.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                          member.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'}`}>
                        {member.role}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-600">{member.position || '—'}</td>
                    <td className="px-6 py-3 text-gray-600 capitalize">{member.employment_type?.replace('-', ' ') || '—'}</td>
                    <td className="px-6 py-3">
                      <ComplianceBadge
                        expired={parseInt(member.expired_docs) || 0}
                        expiring={parseInt(member.expiring_docs) || 0}
                      />
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${member.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {member.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
                          <button
                            onClick={() => openEdit(member)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {currentUser.role === 'admin' && member.id !== currentUser.id && member.is_active && (
                          <button
                            onClick={() => handleDeactivate(member)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Deactivate"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        )}
                      </div>
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
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
            leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
                leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-xl bg-white rounded-2xl shadow-xl">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <Dialog.Title className="font-semibold text-gray-900">
                      {editing ? 'Edit Staff Member' : 'Add Staff Member'}
                    </Dialog.Title>
                    <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">Full Name *</label>
                        <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                      </div>
                      <div>
                        <label className="label">Email *</label>
                        <input type="email" className="input-field" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                      </div>
                    </div>

                    <div>
                      <label className="label">{editing ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                      <input
                        type="password"
                        className="input-field"
                        value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                        required={!editing}
                        minLength={12}
                        placeholder={editing ? '••••••••' : 'Min 12 characters'}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">Role *</label>
                        <select className="input-field" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                          <option value="staff">Staff</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">Position</label>
                        <select className="input-field" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))}>
                          <option value="">Select position</option>
                          <option value="Support Worker">Support Worker</option>
                          <option value="RN">RN</option>
                          <option value="Admin">Admin</option>
                          <option value="Support Coordinator">Support Coordinator</option>
                          <option value="Team Leader">Team Leader</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">Employment Type</label>
                        <select className="input-field" value={form.employment_type} onChange={e => setForm(f => ({ ...f, employment_type: e.target.value }))}>
                          <option value="full-time">Full-time</option>
                          <option value="part-time">Part-time</option>
                          <option value="casual">Casual</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">Phone</label>
                        <input className="input-field" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                      </div>
                    </div>

                    <div>
                      <label className="label">Address</label>
                      <input className="input-field" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                    </div>

                    <div>
                      <label className="label">Availability</label>
                      <input className="input-field" placeholder="e.g. Mon-Fri 9am-5pm" value={form.availability} onChange={e => setForm(f => ({ ...f, availability: e.target.value }))} />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
                      <button type="submit" disabled={saving} className="btn-primary">
                        {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Staff'}
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
