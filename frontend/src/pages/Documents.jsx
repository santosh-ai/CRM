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

const DOC_TYPES = ['WWVP', 'Police Check', 'First Aid', 'CPR', 'Manual Handling', 'NDIS Worker Screening']
const EMPTY_FORM = { user_id: '', document_type: '', issue_date: '', expiry_date: '', notes: '' }

export default function Documents() {
  const [documents, setDocuments] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStaff, setFilterStaff] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const currentUser = getUser()
  const canEdit = currentUser.role === 'admin' || currentUser.role === 'manager'

  const fetchDocuments = async () => {
    try {
      const params = {}
      if (filterStatus) params.status = filterStatus
      if (filterType) params.document_type = filterType
      if (filterStaff) params.user_id = filterStaff
      const res = await api.get('/documents', { params })
      setDocuments(res.data)
    } catch {
      toast.error('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  const fetchStaff = async () => {
    try {
      const res = await api.get('/staff')
      setStaff(res.data)
    } catch {}
  }

  useEffect(() => {
    fetchDocuments()
    fetchStaff()
  }, [filterStatus, filterType, filterStaff])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFile(null)
    setModalOpen(true)
  }

  const openEdit = (doc) => {
    setEditing(doc)
    setForm({
      user_id: doc.user_id,
      document_type: doc.document_type,
      issue_date: doc.issue_date ? doc.issue_date.split('T')[0] : '',
      expiry_date: doc.expiry_date ? doc.expiry_date.split('T')[0] : '',
      notes: doc.notes || ''
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
        await api.post('/documents/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      } else if (editing) {
        await api.put(`/documents/${editing.id}`, form)
      } else {
        await api.post('/documents', form)
      }
      toast.success(editing ? 'Document updated' : 'Document added')
      setModalOpen(false)
      fetchDocuments()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const deleteDocument = async (id) => {
    if (!confirm('Delete this document?')) return
    try {
      await api.delete(`/documents/${id}`)
      toast.success('Document deleted')
      fetchDocuments()
    } catch {
      toast.error('Failed to delete')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-sm text-gray-500 mt-1">{documents.length} document{documents.length !== 1 ? 's' : ''}</p>
        </div>
        {canEdit && (
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Document
          </button>
        )}
      </div>

      {/* Filters */}
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
        <select className="input-field py-1.5 text-sm w-auto" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {canEdit && (
          <select className="input-field py-1.5 text-sm w-auto" value={filterStaff} onChange={e => setFilterStaff(e.target.value)}>
            <option value="">All Staff</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {(filterStatus || filterType || filterStaff) && (
          <button onClick={() => { setFilterStatus(''); setFilterType(''); setFilterStaff('') }} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-3">
        {['valid', 'expiring_soon', 'expired'].map(s => {
          const count = documents.filter(d => d.status === s).length
          return count > 0 ? (
            <button key={s} onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${filterStatus === s ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
            >
              {s === 'expired' && <span className="badge-expired">{count} Expired</span>}
              {s === 'expiring_soon' && <span className="badge-expiring">{count} Expiring Soon</span>}
              {s === 'valid' && <span className="badge-valid">{count} Valid</span>}
            </button>
          ) : null
        })}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : documents.length === 0 ? (
          <div className="text-center py-16 text-gray-400"><p>No documents found</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                  <th className="px-6 py-3">Staff Member</th>
                  <th className="px-6 py-3">Document Type</th>
                  <th className="px-6 py-3">Issue Date</th>
                  <th className="px-6 py-3">Expiry Date</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">File</th>
                  {canEdit && <th className="px-6 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {documents.map(doc => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <p className="font-medium text-gray-900">{doc.staff_name}</p>
                      <p className="text-xs text-gray-400">{doc.staff_email}</p>
                    </td>
                    <td className="px-6 py-3 font-medium">{doc.document_type}</td>
                    <td className="px-6 py-3 text-gray-500">{doc.issue_date ? format(new Date(doc.issue_date), 'dd MMM yyyy') : '—'}</td>
                    <td className="px-6 py-3 text-gray-500">{doc.expiry_date ? format(new Date(doc.expiry_date), 'dd MMM yyyy') : '—'}</td>
                    <td className="px-6 py-3"><StatusBadge status={doc.status} /></td>
                    <td className="px-6 py-3">
                      {doc.file_url ? (
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline text-xs">
                          <Download className="w-3 h-3" />{doc.file_name || 'View'}
                        </a>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    {canEdit && (
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(doc)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteDocument(doc.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
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
                    <Dialog.Title className="font-semibold text-gray-900">{editing ? 'Edit Document' : 'Add Document'}</Dialog.Title>
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
                      <label className="label">Document Type *</label>
                      <select className="input-field" value={form.document_type} onChange={e => setForm(f => ({ ...f, document_type: e.target.value }))} required>
                        <option value="">Select type</option>
                        {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">Issue Date</label>
                        <input type="date" className="input-field" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
                      </div>
                      <div>
                        <label className="label">Expiry Date</label>
                        <input type="date" className="input-field" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <label className="label">Upload File</label>
                      <label className="cursor-pointer block">
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-blue-400 transition-colors">
                          <Upload className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                          <p className="text-xs text-gray-500">{file ? file.name : 'Click to upload PDF/JPG/PNG'}</p>
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
