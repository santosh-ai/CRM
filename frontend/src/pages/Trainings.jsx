import { useEffect, useState, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Plus, Filter, CheckCircle, AlertTriangle, XCircle, Edit2, Trash2, X, Upload, Download } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import api from '../api'

function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
}

function StatusBadge({ status }) {
  if (status === 'expired') return <span className="badge-expired"><XCircle className="w-3 h-3" />Expired</span>
  if (status === 'expiring_soon') return <span className="badge-expiring"><AlertTriangle className="w-3 h-3" />Expiring Soon</span>
  return <span className="badge-valid"><CheckCircle className="w-3 h-3" />Valid</span>
}

const EMPTY_FORM = { user_id: '', training_name: '', completion_date: '', expiry_date: '', notes: '' }

export default function Trainings() {
  const [trainings, setTrainings] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterStaff, setFilterStaff] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const currentUser = getUser()
  const canEdit = currentUser.role === 'admin' || currentUser.role === 'manager'

  const fetchTrainings = async () => {
    try {
      const params = {}
      if (filterStatus) params.status = filterStatus
      if (filterStaff) params.user_id = filterStaff
      const res = await api.get('/trainings', { params })
      setTrainings(res.data)
    } catch {
      toast.error('Failed to load trainings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTrainings()
    api.get('/staff').then(res => setStaff(res.data)).catch(() => {})
  }, [filterStatus, filterStaff])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFile(null)
    setModalOpen(true)
  }

  const openEdit = (t) => {
    setEditing(t)
    setForm({
      user_id: t.user_id,
      training_name: t.training_name,
      completion_date: t.completion_date ? t.completion_date.split('T')[0] : '',
      expiry_date: t.expiry_date ? t.expiry_date.split('T')[0] : '',
      notes: t.notes || ''
    })
    setFile(null)
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        Object.entries(form).forEach(([k, v]) => fd.append(k, v))
        await api.post('/trainings/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      } else if (editing) {
        await api.put(`/trainings/${editing.id}`, form)
      } else {
        await api.post('/trainings', form)
      }
      toast.success(editing ? 'Training updated' : 'Training added')
      setModalOpen(false)
      fetchTrainings()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const deleteTraining = async (id) => {
    if (!confirm('Delete this training?')) return
    try {
      await api.delete(`/trainings/${id}`)
      toast.success('Training deleted')
      fetchTrainings()
    } catch {
      toast.error('Failed to delete')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trainings</h1>
          <p className="text-sm text-gray-500 mt-1">{trainings.length} training record{trainings.length !== 1 ? 's' : ''}</p>
        </div>
        {canEdit && (
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Training
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select className="input-field py-1.5 text-sm w-auto" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="valid">Valid</option>
            <option value="expiring_soon">Expiring Soon</option>
            <option value="expired">Expired</option>
          </select>
        </div>
        {canEdit && (
          <select className="input-field py-1.5 text-sm w-auto" value={filterStaff} onChange={e => setFilterStaff(e.target.value)}>
            <option value="">All Staff</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {(filterStatus || filterStaff) && (
          <button onClick={() => { setFilterStatus(''); setFilterStaff('') }} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : trainings.length === 0 ? (
          <div className="text-center py-16 text-gray-400"><p>No training records found</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                  <th className="px-6 py-3">Staff Member</th>
                  <th className="px-6 py-3">Training</th>
                  <th className="px-6 py-3">Completion</th>
                  <th className="px-6 py-3">Expiry</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Certificate</th>
                  {canEdit && <th className="px-6 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {trainings.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium">{t.staff_name}</td>
                    <td className="px-6 py-3 text-gray-700">{t.training_name}</td>
                    <td className="px-6 py-3 text-gray-500">{t.completion_date ? format(new Date(t.completion_date), 'dd MMM yyyy') : '—'}</td>
                    <td className="px-6 py-3 text-gray-500">{t.expiry_date ? format(new Date(t.expiry_date), 'dd MMM yyyy') : '—'}</td>
                    <td className="px-6 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-6 py-3">
                      {t.certificate_url ? (
                        <a href={t.certificate_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline text-xs">
                          <Download className="w-3 h-3" />{t.certificate_name || 'View'}
                        </a>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    {canEdit && (
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(t)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteTraining(t.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
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
                <Dialog.Panel className="w-full max-w-md bg-white rounded-2xl shadow-xl">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <Dialog.Title className="font-semibold text-gray-900">{editing ? 'Edit Training' : 'Add Training'}</Dialog.Title>
                    <button onClick={() => setModalOpen(false)}><X className="w-5 h-5 text-gray-400" /></button>
                  </div>
                  <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                      <label className="label">Staff Member *</label>
                      <select className="input-field" value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))} required>
                        <option value="">Select staff</option>
                        {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Training Name *</label>
                      <input className="input-field" value={form.training_name} onChange={e => setForm(f => ({ ...f, training_name: e.target.value }))} required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">Completion Date</label>
                        <input type="date" className="input-field" value={form.completion_date} onChange={e => setForm(f => ({ ...f, completion_date: e.target.value }))} />
                      </div>
                      <div>
                        <label className="label">Expiry Date</label>
                        <input type="date" className="input-field" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <label className="label">Upload Certificate</label>
                      <label className="cursor-pointer block">
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-blue-400 transition-colors">
                          <Upload className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                          <p className="text-xs text-gray-500">{file ? file.name : 'Click to upload'}</p>
                        </div>
                        <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files[0])} />
                      </label>
                    </div>
                    <div>
                      <label className="label">Notes</label>
                      <textarea className="input-field" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
                      <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
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
