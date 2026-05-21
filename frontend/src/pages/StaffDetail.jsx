import { useEffect, useState, Fragment } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Dialog, Transition } from '@headlessui/react'
import { ArrowLeft, FileText, BookOpen, Plus, Upload, Edit2, Trash2, X, CheckCircle, AlertTriangle, XCircle, Download } from 'lucide-react'
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
const EMPTY_DOC = { document_type: '', issue_date: '', expiry_date: '', notes: '' }
const EMPTY_TRAINING = { training_name: '', completion_date: '', expiry_date: '', notes: '' }

export default function StaffDetail() {
  const { id } = useParams()
  const [member, setMember] = useState(null)
  const [documents, setDocuments] = useState([])
  const [trainings, setTrainings] = useState([])
  const [activeTab, setActiveTab] = useState('documents')
  const [loading, setLoading] = useState(true)
  const [docModal, setDocModal] = useState(false)
  const [trainingModal, setTrainingModal] = useState(false)
  const [editingDoc, setEditingDoc] = useState(null)
  const [editingTraining, setEditingTraining] = useState(null)
  const [docForm, setDocForm] = useState(EMPTY_DOC)
  const [trainingForm, setTrainingForm] = useState(EMPTY_TRAINING)
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const currentUser = getUser()
  const canEdit = currentUser.role === 'admin' || currentUser.role === 'manager'

  const fetchData = async () => {
    try {
      const [memberRes, docsRes, trainingsRes] = await Promise.all([
        api.get(`/staff/${id}`),
        api.get('/documents', { params: { user_id: id } }),
        api.get('/trainings', { params: { user_id: id } }),
      ])
      setMember(memberRes.data)
      setDocuments(docsRes.data)
      setTrainings(trainingsRes.data)
    } catch (err) {
      toast.error('Failed to load staff data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [id])

  // Documents
  const openDocModal = (doc = null) => {
    setEditingDoc(doc)
    setDocForm(doc ? {
      document_type: doc.document_type,
      issue_date: doc.issue_date ? doc.issue_date.split('T')[0] : '',
      expiry_date: doc.expiry_date ? doc.expiry_date.split('T')[0] : '',
      notes: doc.notes || ''
    } : EMPTY_DOC)
    setFile(null)
    setDocModal(true)
  }

  const saveDocument = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('user_id', id)
        Object.entries(docForm).forEach(([k, v]) => fd.append(k, v))
        await api.post('/documents/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      } else if (editingDoc) {
        await api.put(`/documents/${editingDoc.id}`, docForm)
      } else {
        await api.post('/documents', { ...docForm, user_id: id })
      }
      toast.success(editingDoc ? 'Document updated' : 'Document added')
      setDocModal(false)
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save document')
    } finally {
      setSaving(false)
    }
  }

  const deleteDocument = async (docId) => {
    if (!confirm('Delete this document?')) return
    try {
      await api.delete(`/documents/${docId}`)
      toast.success('Document deleted')
      fetchData()
    } catch {
      toast.error('Failed to delete')
    }
  }

  // Trainings
  const openTrainingModal = (training = null) => {
    setEditingTraining(training)
    setTrainingForm(training ? {
      training_name: training.training_name,
      completion_date: training.completion_date ? training.completion_date.split('T')[0] : '',
      expiry_date: training.expiry_date ? training.expiry_date.split('T')[0] : '',
      notes: training.notes || ''
    } : EMPTY_TRAINING)
    setFile(null)
    setTrainingModal(true)
  }

  const saveTraining = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('user_id', id)
        Object.entries(trainingForm).forEach(([k, v]) => fd.append(k, v))
        await api.post('/trainings/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      } else if (editingTraining) {
        await api.put(`/trainings/${editingTraining.id}`, trainingForm)
      } else {
        await api.post('/trainings', { ...trainingForm, user_id: id })
      }
      toast.success(editingTraining ? 'Training updated' : 'Training added')
      setTrainingModal(false)
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save training')
    } finally {
      setSaving(false)
    }
  }

  const deleteTraining = async (tId) => {
    if (!confirm('Delete this training?')) return
    try {
      await api.delete(`/trainings/${tId}`)
      toast.success('Training deleted')
      fetchData()
    } catch {
      toast.error('Failed to delete')
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>
  }
  if (!member) return <div className="text-center py-20 text-gray-400">Staff member not found</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link to="/staff" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{member.name}</h1>
            <p className="text-sm text-gray-500">{member.email}</p>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${member.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {member.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Info card */}
      <div className="card p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-gray-500">Role</p><p className="font-medium capitalize">{member.role}</p></div>
          <div><p className="text-gray-500">Position</p><p className="font-medium">{member.position || '—'}</p></div>
          <div><p className="text-gray-500">Employment</p><p className="font-medium capitalize">{member.employment_type?.replace('-', ' ') || '—'}</p></div>
          <div><p className="text-gray-500">Phone</p><p className="font-medium">{member.phone || '—'}</p></div>
          {member.address && <div className="col-span-2"><p className="text-gray-500">Address</p><p className="font-medium">{member.address}</p></div>}
          {member.availability && <div className="col-span-2"><p className="text-gray-500">Availability</p><p className="font-medium">{member.availability}</p></div>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('documents')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'documents' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <FileText className="w-4 h-4" /> Documents ({documents.length})
        </button>
        <button
          onClick={() => setActiveTab('trainings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'trainings' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <BookOpen className="w-4 h-4" /> Trainings ({trainings.length})
        </button>
      </div>

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Compliance Documents</h2>
            {canEdit && (
              <button onClick={() => openDocModal()} className="btn-primary flex items-center gap-2 text-sm py-1.5">
                <Plus className="w-4 h-4" /> Add Document
              </button>
            )}
          </div>
          {documents.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No documents on file</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                    <th className="px-6 py-3">Document Type</th>
                    <th className="px-6 py-3">Issue Date</th>
                    <th className="px-6 py-3">Expiry Date</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">File</th>
                    <th className="px-6 py-3">Notes</th>
                    {canEdit && <th className="px-6 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {documents.map(doc => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium">{doc.document_type}</td>
                      <td className="px-6 py-3 text-gray-500">{doc.issue_date ? format(new Date(doc.issue_date), 'dd MMM yyyy') : '—'}</td>
                      <td className="px-6 py-3 text-gray-500">{doc.expiry_date ? format(new Date(doc.expiry_date), 'dd MMM yyyy') : '—'}</td>
                      <td className="px-6 py-3"><StatusBadge status={doc.status} /></td>
                      <td className="px-6 py-3">
                        {doc.file_url ? (
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                            <Download className="w-3 h-3" />{doc.file_name || 'Download'}
                          </a>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-6 py-3 text-gray-500 max-w-xs truncate">{doc.notes || '—'}</td>
                      {canEdit && (
                        <td className="px-6 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openDocModal(doc)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
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
      )}

      {/* Trainings Tab */}
      {activeTab === 'trainings' && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Training Records</h2>
            {canEdit && (
              <button onClick={() => openTrainingModal()} className="btn-primary flex items-center gap-2 text-sm py-1.5">
                <Plus className="w-4 h-4" /> Add Training
              </button>
            )}
          </div>
          {trainings.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No training records</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                    <th className="px-6 py-3">Training Name</th>
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
                      <td className="px-6 py-3 font-medium">{t.training_name}</td>
                      <td className="px-6 py-3 text-gray-500">{t.completion_date ? format(new Date(t.completion_date), 'dd MMM yyyy') : '—'}</td>
                      <td className="px-6 py-3 text-gray-500">{t.expiry_date ? format(new Date(t.expiry_date), 'dd MMM yyyy') : '—'}</td>
                      <td className="px-6 py-3"><StatusBadge status={t.status} /></td>
                      <td className="px-6 py-3">
                        {t.certificate_url ? (
                          <a href={t.certificate_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                            <Download className="w-3 h-3" />{t.certificate_name || 'Download'}
                          </a>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      {canEdit && (
                        <td className="px-6 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openTrainingModal(t)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
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
      )}

      {/* Document Modal */}
      <Transition show={docModal} as={Fragment}>
        <Dialog onClose={() => setDocModal(false)} className="relative z-50">
          <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/40" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-md bg-white rounded-2xl shadow-xl">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <Dialog.Title className="font-semibold text-gray-900">{editingDoc ? 'Edit Document' : 'Add Document'}</Dialog.Title>
                    <button onClick={() => setDocModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
                  </div>
                  <form onSubmit={saveDocument} className="p-6 space-y-4">
                    <div>
                      <label className="label">Document Type *</label>
                      <select className="input-field" value={docForm.document_type} onChange={e => setDocForm(f => ({ ...f, document_type: e.target.value }))} required>
                        <option value="">Select type</option>
                        {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">Issue Date</label>
                        <input type="date" className="input-field" value={docForm.issue_date} onChange={e => setDocForm(f => ({ ...f, issue_date: e.target.value }))} />
                      </div>
                      <div>
                        <label className="label">Expiry Date</label>
                        <input type="date" className="input-field" value={docForm.expiry_date} onChange={e => setDocForm(f => ({ ...f, expiry_date: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <label className="label">Upload File (optional)</label>
                      <div className="flex items-center gap-2">
                        <label className="flex-1 cursor-pointer">
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-blue-400 transition-colors">
                            <Upload className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                            <p className="text-xs text-gray-500">{file ? file.name : 'Click to upload PDF/JPG/PNG'}</p>
                          </div>
                          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => setFile(e.target.files[0])} />
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="label">Notes</label>
                      <textarea className="input-field" rows={2} value={docForm.notes} onChange={e => setDocForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => setDocModal(false)} className="btn-secondary">Cancel</button>
                      <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Training Modal */}
      <Transition show={trainingModal} as={Fragment}>
        <Dialog onClose={() => setTrainingModal(false)} className="relative z-50">
          <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/40" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-md bg-white rounded-2xl shadow-xl">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <Dialog.Title className="font-semibold text-gray-900">{editingTraining ? 'Edit Training' : 'Add Training'}</Dialog.Title>
                    <button onClick={() => setTrainingModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
                  </div>
                  <form onSubmit={saveTraining} className="p-6 space-y-4">
                    <div>
                      <label className="label">Training Name *</label>
                      <input className="input-field" value={trainingForm.training_name} onChange={e => setTrainingForm(f => ({ ...f, training_name: e.target.value }))} required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">Completion Date</label>
                        <input type="date" className="input-field" value={trainingForm.completion_date} onChange={e => setTrainingForm(f => ({ ...f, completion_date: e.target.value }))} />
                      </div>
                      <div>
                        <label className="label">Expiry Date</label>
                        <input type="date" className="input-field" value={trainingForm.expiry_date} onChange={e => setTrainingForm(f => ({ ...f, expiry_date: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <label className="label">Upload Certificate (optional)</label>
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
                      <textarea className="input-field" rows={2} value={trainingForm.notes} onChange={e => setTrainingForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => setTrainingModal(false)} className="btn-secondary">Cancel</button>
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
