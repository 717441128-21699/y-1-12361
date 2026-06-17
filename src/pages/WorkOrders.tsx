import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Wrench, Plus, Clock, AlertTriangle, CheckCircle2, ArrowUpCircle, ImagePlus, X,
  ListTodo, Package, Send, ThumbsUp, ThumbsDown, UserCheck,
} from 'lucide-react'
import { workorders, fields as fieldsApi } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import type { WorkOrder, Field, Urgency, WorkOrderStep, WorkOrderPart } from '@/types'

type StatusFilter = 'all' | 'pending' | 'in_progress' | 'submitted' | 'completed'

const URGENCY_COLORS: Record<Urgency, string> = {
  high: 'border-l-4 border-l-red-500',
  medium: 'border-l-4 border-l-orange-400',
  low: 'border-l-4 border-l-yellow-400',
}

const URGENCY_LABELS: Record<Urgency, string> = {
  high: '紧急', medium: '中等', low: '低',
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待接单',
  accepted: '已接单',
  in_progress: '进行中',
  submitted: '待复核',
  completed: '已完成',
}

const DEVICE_TYPES = ['传感器', '阀门', '水泵', '管道']

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}分钟前`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}小时前`
  return `${Math.floor(hrs / 24)}天前`
}

function isOverdue(dateStr: string, hours: number) {
  return Date.now() - new Date(dateStr).getTime() > hours * 3600000
}

export default function WorkOrders() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [orders, setOrders] = useState<WorkOrder[]>([])
  const [allFields, setAllFields] = useState<Field[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [showDetail, setShowDetail] = useState<WorkOrder | null>(null)
  const [showUploadPhotos, setShowUploadPhotos] = useState<WorkOrder | null>(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [pendingPhotos, setPendingPhotos] = useState<string[]>([])
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [newStep, setNewStep] = useState('')
  const [newPart, setNewPart] = useState({ name: '', qty: 1 })
  const [reviewComment, setReviewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [createForm, setCreateForm] = useState({
    deviceType: '传感器', deviceId: '', fieldId: 0, description: '', urgency: 'medium' as Urgency,
  })

  const canManage = user?.role === 'technician' || user?.role === 'owner'
  const canReview = canManage

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }, [])

  const fetchOrders = useCallback(async () => {
    try {
      const data = await workorders.list()
      setOrders(data)
    } catch { /* ignore */ }
  }, [])

  const refreshDetail = useCallback(async (id: number) => {
    try {
      const d = await workorders.get(id)
      setShowDetail(d)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchOrders().then(() => setLoading(false))
    fieldsApi.list().then(setAllFields).catch(() => {})
  }, [fetchOrders])

  const filtered = statusFilter === 'all' ? orders : orders.filter((o) => {
    if (statusFilter === 'pending') return o.status === 'pending'
    if (statusFilter === 'in_progress') return o.status === 'accepted' || o.status === 'in_progress'
    if (statusFilter === 'submitted') return o.status === 'submitted'
    return o.status === 'completed'
  })

  const pending = filtered.filter((o) => o.status === 'pending')
  const inProgress = filtered.filter((o) => o.status === 'accepted' || o.status === 'in_progress')
  const submitted = filtered.filter((o) => o.status === 'submitted')
  const completed = filtered.filter((o) => o.status === 'completed')

  const handleAccept = async (id: number) => {
    try {
      await workorders.accept(id)
      fetchOrders()
      if (showDetail?.id === id) refreshDetail(id)
    } catch (e: any) {
      showToast(e?.message || '操作失败')
    }
  }

  const handleEscalate = async (id: number) => {
    try {
      await workorders.escalate(id)
      fetchOrders()
    } catch {
      showToast('操作失败')
    }
  }

  const handleAddStep = async () => {
    if (!showDetail || !newStep.trim()) return
    try {
      setSubmitting(true)
      await workorders.addStep(showDetail.id, newStep.trim())
      setNewStep('')
      await refreshDetail(showDetail.id)
      showToast('已添加处理步骤')
    } catch (e: any) {
      showToast(e?.message || '添加失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddPart = async () => {
    if (!showDetail || !newPart.name.trim() || newPart.qty <= 0) return
    try {
      setSubmitting(true)
      await workorders.addPart(showDetail.id, newPart.name.trim(), newPart.qty)
      setNewPart({ name: '', qty: 1 })
      await refreshDetail(showDetail.id)
      showToast('已添加配件记录')
    } catch (e: any) {
      showToast(e?.message || '添加失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUploadPhotos = async () => {
    if (!showUploadPhotos) return
    if (pendingPhotos.length === 0) {
      showToast('请至少添加一张照片')
      return
    }
    try {
      await workorders.uploadPhotos(showUploadPhotos.id, pendingPhotos)
      showToast('照片已保存')
      setShowUploadPhotos(null)
      setPendingPhotos([])
      setPhotoUrl('')
      fetchOrders()
      if (showDetail?.id === showUploadPhotos.id) refreshDetail(showUploadPhotos.id)
    } catch (e: any) {
      showToast(e?.message || '上传失败')
    }
  }

  const handleSubmitReview = async (orderId?: number) => {
    const id = orderId || showDetail?.id
    if (!id) return
    const order = orders.find((o) => o.id === id)
    if (order && (!order.photos || order.photos.length === 0)) {
      showToast('请至少上传一张维修配件更换照片后再提交复核')
      return
    }
    try {
      setSubmitting(true)
      await workorders.submitComplete(id)
      await fetchOrders()
      if (showDetail?.id === id) await refreshDetail(id)
      showToast('已提交复核，等待主管确认')
    } catch (e: any) {
      showToast(e?.message || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReview = async (pass: boolean) => {
    if (!showDetail) return
    try {
      setSubmitting(true)
      await workorders.review(showDetail.id, pass, reviewComment.trim())
      setReviewComment('')
      await fetchOrders()
      await refreshDetail(showDetail.id)
      showToast(pass ? '复核通过，工单已完成' : '已驳回，工单返回进行中')
    } catch (e: any) {
      showToast(e?.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreate = async () => {
    if (!createForm.fieldId || !createForm.description) {
      showToast('请填写完整工单信息')
      return
    }
    try {
      await workorders.create({
        type: 'maintenance',
        deviceType: createForm.deviceType,
        deviceId: Number(createForm.deviceId),
        fieldId: createForm.fieldId,
        description: createForm.description,
        urgency: createForm.urgency,
      })
      setShowCreate(false)
      setCreateForm({ deviceType: '传感器', deviceId: '', fieldId: 0, description: '', urgency: 'medium' })
      fetchOrders()
      showToast('工单创建成功')
    } catch (e: any) {
      if (e?.status === 409 && e?.data?.existingId) {
        if (confirm('该设备已有进行中的工单，是否直接跳转到该工单详情？')) {
          try {
            const existing = await workorders.get(e.data.existingId)
            setShowCreate(false)
            setShowDetail(existing)
          } catch {
            showToast('查找现有工单失败')
          }
          return
        }
      }
      showToast(e?.message || '创建失败')
    }
  }

  const fieldName = (id: number) => allFields.find((f) => f.id === id)?.name ?? `田块#${id}`

  const openUploadPhotos = (order: WorkOrder) => {
    setShowDetail(null)
    setShowUploadPhotos(order)
    setPendingPhotos([])
    setPhotoUrl('')
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-10 w-48 bg-gray-200 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 h-full flex flex-col">
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-primary-500 text-white px-5 py-3 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wrench className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-gray-800">工单管理</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {([
              ['all', '全部'],
              ['pending', '待接单'],
              ['in_progress', '进行中'],
              ['submitted', '待复核'],
              ['completed', '已完成'],
            ] as const).map(([val, label]) => (
              <button key={val} onClick={() => setStatusFilter(val)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${statusFilter === val ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {label}
              </button>
            ))}
          </div>
          {canManage && (
            <button onClick={() => setShowCreate(true)} className="btn-primary gap-1">
              <Plus className="w-4 h-4" /> 新建工单
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 flex-1 min-h-0 overflow-hidden">
        <Column title="待接单" count={pending.length} icon={<Clock className="w-4 h-4 text-orange-500" />}>
          {pending.map((o) => (
            <OrderCard key={o.id} order={o} borderColor={URGENCY_COLORS[o.urgency]} onClick={() => setShowDetail(o)}>
              <div className="flex items-center gap-1 mb-2">
                <span className={o.urgency === 'high' ? 'badge-red' : o.urgency === 'medium' ? 'badge-orange' : 'badge-green'}>
                  {URGENCY_LABELS[o.urgency]}
                </span>
                {o.escalated && <span className="badge-red animate-pulse-status">已升级</span>}
              </div>
              <p className="text-sm font-medium text-gray-800">{o.deviceType} - #{o.deviceId}</p>
              <p className="text-xs text-gray-500 mt-0.5">{fieldName(o.fieldId)}</p>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{o.description}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">{relativeTime(o.createdAt)}</span>
                {isOverdue(o.createdAt, 2) && <span className="text-xs font-bold text-red-500">超时!</span>}
              </div>
              <p className="text-xs text-gray-500 mt-1">负责人: {o.assigneeName}</p>
              <div className="flex gap-2 mt-2">
                {user?.id === o.assignedTo && (
                  <button onClick={(e) => { e.stopPropagation(); handleAccept(o.id) }}
                    className="btn-primary text-xs py-1 px-2">接单</button>
                )}
                {canManage && (
                  <button onClick={(e) => { e.stopPropagation(); handleEscalate(o.id) }}
                    className="btn-secondary text-xs py-1 px-2 flex items-center gap-1">
                    <ArrowUpCircle className="w-3 h-3" /> 升级
                  </button>
                )}
              </div>
            </OrderCard>
          ))}
        </Column>

        <Column title="进行中" count={inProgress.length} icon={<AlertTriangle className="w-4 h-4 text-blue-500" />} accent="blue">
          {inProgress.map((o) => (
            <OrderCard key={o.id} order={o} borderColor="border-l-4 border-l-blue-400" onClick={() => setShowDetail(o)}>
              <div className="flex items-center gap-1 mb-2">
                <span className="badge-blue">进行中</span>
                {o.escalated && <span className="badge-red animate-pulse-status">已升级</span>}
              </div>
              <p className="text-sm font-medium text-gray-800">{o.deviceType} - #{o.deviceId}</p>
              <p className="text-xs text-gray-500 mt-0.5">{fieldName(o.fieldId)}</p>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{o.description}</p>
              <p className="text-xs text-gray-400 mt-1">接单: {o.acceptedAt ? relativeTime(o.acceptedAt) : '-'}</p>
              <p className="text-xs text-gray-500">负责人: {o.assigneeName}</p>
              {o.photos.length > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <ImagePlus className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-400">{o.photos.length}张照片</span>
                </div>
              )}
              {user?.id === o.assignedTo && (
                <div className="flex gap-2 mt-2">
                  <button onClick={(e) => { e.stopPropagation(); openUploadPhotos(o) }}
                    className="btn-secondary text-xs py-1 px-2 flex items-center gap-1">
                    <ImagePlus className="w-3 h-3" /> 上传照片
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleSubmitReview(o.id) }} disabled={submitting}
                    className="btn-primary text-xs py-1 px-2 flex items-center gap-1">
                    <Send className="w-3 h-3" /> 提交复核
                  </button>
                </div>
              )}
            </OrderCard>
          ))}
        </Column>

        <Column title="待复核" count={submitted.length} icon={<UserCheck className="w-4 h-4 text-purple-500" />}>
          {submitted.map((o) => (
            <OrderCard key={o.id} order={o} borderColor="border-l-4 border-l-purple-400" onClick={() => setShowDetail(o)}>
              <div className="flex items-center gap-1 mb-2">
                <span className="badge-purple">待复核</span>
              </div>
              <p className="text-sm font-medium text-gray-800">{o.deviceType} - #{o.deviceId}</p>
              <p className="text-xs text-gray-500 mt-0.5">{fieldName(o.fieldId)}</p>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{o.description}</p>
              <p className="text-xs text-gray-400 mt-1">提交: {o.submittedAt ? relativeTime(o.submittedAt) : '-'}</p>
              <p className="text-xs text-gray-500">负责人: {o.assigneeName}</p>
              {o.photos.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {o.photos.slice(0, 3).map((p, i) => (
                    <img key={i} src={p} alt="" className="w-10 h-10 rounded object-cover border border-gray-200"
                      onClick={(e) => { e.stopPropagation(); setLightbox(p) }} />
                  ))}
                </div>
              )}
              {canReview && (
                <div className="flex gap-2 mt-2">
                  <button onClick={(e) => { e.stopPropagation(); setShowDetail(o); setTimeout(() => setReviewComment(''), 100) }}
                    className="btn-primary text-xs py-1 px-2">复核</button>
                </div>
              )}
            </OrderCard>
          ))}
        </Column>

        <Column title="已完成" count={completed.length} icon={<CheckCircle2 className="w-4 h-4 text-green-500" />} accent="green">
          {completed.map((o) => (
            <OrderCard key={o.id} order={o} borderColor="border-l-4 border-l-green-400" onClick={() => setShowDetail(o)}>
              <span className="badge-green mb-2">已完成</span>
              <p className="text-sm font-medium text-gray-800">{o.deviceType} - #{o.deviceId}</p>
              <p className="text-xs text-gray-500 mt-0.5">{fieldName(o.fieldId)}</p>
              <p className="text-xs text-gray-400 mt-1">完成于 {o.completedAt ? relativeTime(o.completedAt) : '-'}</p>
              {o.photos.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {o.photos.slice(0, 3).map((p, i) => (
                    <img key={i} src={p} alt="" className="w-10 h-10 rounded object-cover border border-gray-200 cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); setLightbox(p) }} />
                  ))}
                </div>
              )}
            </OrderCard>
          ))}
        </Column>
      </div>

      {showCreate && <CreateModal form={createForm} setForm={setCreateForm} fields={allFields}
        onSubmit={handleCreate} onClose={() => setShowCreate(false)} />}

      {showDetail && <DetailModal
        order={showDetail}
        fieldName={fieldName(showDetail.fieldId)}
        canManage={canManage}
        canReview={canReview}
        isAssigned={user?.id === showDetail.assignedTo}
        newStep={newStep}
        setNewStep={setNewStep}
        newPart={newPart}
        setNewPart={setNewPart}
        reviewComment={reviewComment}
        setReviewComment={setReviewComment}
        submitting={submitting}
        onAddStep={handleAddStep}
        onAddPart={handleAddPart}
        onSubmitReview={() => handleSubmitReview()}
        onReview={handleReview}
        onAccept={() => handleAccept(showDetail.id)}
        onEscalate={() => handleEscalate(showDetail.id)}
        onUploadPhotos={() => openUploadPhotos(showDetail)}
        onClose={() => setShowDetail(null)}
      />}

      {showUploadPhotos && (
        <Modal onClose={() => setShowUploadPhotos(null)}>
          <h3 className="text-lg font-bold mb-3">上传维修照片</h3>
          <p className="text-xs text-gray-500 mb-3">照片作为补充材料保存，工单仍保持在「进行中」。提交复核时必须至少有一张照片。</p>
          <div className="flex gap-2 mb-3">
            <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="输入照片URL" className="form-input flex-1" />
            <button onClick={() => { if (photoUrl) { setPendingPhotos([...pendingPhotos, photoUrl]); setPhotoUrl('') } }}
              className="btn-secondary gap-1"><ImagePlus className="w-4 h-4" /> 添加</button>
          </div>
          {pendingPhotos.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-3">
              {pendingPhotos.map((p, i) => (
                <div key={i} className="relative">
                  <img src={p} alt="" className="w-16 h-16 rounded object-cover border" />
                  <button onClick={() => setPendingPhotos(pendingPhotos.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-xs">
                    <X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowUploadPhotos(null)} className="btn-secondary">取消</button>
            <button onClick={handleUploadPhotos} disabled={pendingPhotos.length === 0} className="btn-primary disabled:opacity-50">保存照片</button>
          </div>
        </Modal>
      )}

      {lightbox && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-[80vw] max-h-[80vh] rounded-lg shadow-xl" />
        </div>
      )}
    </div>
  )
}

function Column({ title, count, icon, accent, children }: {
  title: string; count: number; icon: React.ReactNode; accent?: string; children: React.ReactNode
}) {
  const accentCls = accent === 'blue' ? 'text-blue-500' : accent === 'green' ? 'text-green-500' : 'text-gray-700'
  return (
    <div className="flex flex-col min-h-0">
      <div className={`flex items-center gap-2 mb-2 font-semibold ${accentCls}`}>
        {icon} {title}
        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{count}</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">{children}</div>
    </div>
  )
}

function OrderCard({ order, borderColor, onClick, children }: {
  order: WorkOrder; borderColor: string; onClick: () => void; children: React.ReactNode
}) {
  return (
    <div onClick={onClick}
      className={`bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${borderColor}`}>
      {children}
    </div>
  )
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function CreateModal({ form, setForm, fields, onSubmit, onClose }: {
  form: any; setForm: (f: any) => void; fields: Field[]; onSubmit: () => void; onClose: () => void
}) {
  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold mb-4">新建工单</h3>
      <div className="space-y-3">
        <div><label className="form-label">设备类型</label>
          <select value={form.deviceType} onChange={(e) => setForm({ ...form, deviceType: e.target.value })} className="form-input">
            {DEVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select></div>
        <div><label className="form-label">设备ID</label>
          <input value={form.deviceId} onChange={(e) => setForm({ ...form, deviceId: e.target.value })} className="form-input" type="number" /></div>
        <div><label className="form-label">所属田块</label>
          <select value={form.fieldId} onChange={(e) => setForm({ ...form, fieldId: Number(e.target.value) })} className="form-input">
            <option value={0}>选择田块</option>
            {fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select></div>
        <div><label className="form-label">描述</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="form-input" rows={3} /></div>
        <div><label className="form-label">紧急程度</label>
          <select value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })} className="form-input">
            <option value="high">紧急</option><option value="medium">中等</option><option value="low">低</option>
          </select></div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="btn-secondary">取消</button>
        <button onClick={onSubmit} className="btn-primary">提交</button>
      </div>
    </Modal>
  )
}

function DetailModal({
  order, fieldName, canManage, canReview, isAssigned,
  newStep, setNewStep, newPart, setNewPart, reviewComment, setReviewComment, submitting,
  onAddStep, onAddPart, onSubmitReview, onReview, onAccept, onEscalate, onUploadPhotos, onClose,
}: {
  order: WorkOrder; fieldName: string; canManage: boolean; canReview: boolean; isAssigned: boolean
  newStep: string; setNewStep: (v: string) => void
  newPart: { name: string; qty: number }; setNewPart: (v: { name: string; qty: number }) => void
  reviewComment: string; setReviewComment: (v: string) => void
  submitting: boolean
  onAddStep: () => void; onAddPart: () => void; onSubmitReview: () => void
  onReview: (pass: boolean) => void; onAccept: () => void; onEscalate: () => void
  onUploadPhotos: () => void; onClose: () => void
}) {
  const noPhotos = !order.photos || order.photos.length === 0

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold">工单详情 #{order.id}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between"><span className="text-gray-500">状态</span>
          <span className={order.status === 'completed' ? 'badge-green' : order.status === 'submitted' ? 'badge-purple' : order.status === 'pending' ? 'badge-orange' : 'badge-blue'}>
            {STATUS_LABELS[order.status]}
          </span></div>
        <div className="flex justify-between"><span className="text-gray-500">紧急程度</span>
          <span className={order.urgency === 'high' ? 'badge-red' : order.urgency === 'medium' ? 'badge-orange' : 'badge-green'}>
            {{ high: '紧急', medium: '中等', low: '低' }[order.urgency]}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">设备</span><span>{order.deviceType} - #{order.deviceId}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">田块</span><span>{fieldName}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">负责人</span><span>{order.assigneeName}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">创建时间</span><span>{new Date(order.createdAt).toLocaleString()}</span></div>
        {order.acceptedAt && <div className="flex justify-between"><span className="text-gray-500">接单时间</span><span>{new Date(order.acceptedAt).toLocaleString()}</span></div>}
        {order.submittedAt && <div className="flex justify-between"><span className="text-gray-500">提交复核</span><span>{new Date(order.submittedAt).toLocaleString()}</span></div>}
        {order.completedAt && <div className="flex justify-between"><span className="text-gray-500">完成时间</span><span>{new Date(order.completedAt).toLocaleString()}</span></div>}
        {order.reviewComment && (
          <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs">
            <div className="font-medium text-amber-800 mb-0.5">复核意见</div>
            <div className="text-amber-700">{order.reviewComment}</div>
          </div>
        )}
        {order.escalated && <div className="flex justify-between"><span className="text-gray-500">升级</span><span className="badge-red">已升级</span></div>}
        <div><span className="text-gray-500">描述</span><p className="mt-1 text-gray-700">{order.description}</p></div>

        <div className="border-t pt-3">
          <div className="flex items-center gap-2 mb-2 font-semibold text-gray-700">
            <ListTodo className="w-4 h-4 text-primary" />处理步骤
          </div>
          {order.steps && order.steps.length > 0 ? (
            <ol className="space-y-2 text-xs mb-2">
              {order.steps.map((s: WorkOrderStep, i: number) => (
                <li key={s.id} className="flex gap-2">
                  <span className="text-primary font-bold">{i + 1}.</span>
                  <div className="flex-1">
                    <p className="text-gray-700">{s.step}</p>
                    <p className="text-gray-400 mt-0.5">{new Date(s.createdAt).toLocaleString()}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-gray-400 mb-2">暂无处理步骤</p>
          )}
          {isAssigned && order.status === 'in_progress' && (
            <div className="flex gap-2">
              <input value={newStep} onChange={(e) => setNewStep(e.target.value)}
                placeholder="记录本步处理内容..." className="form-input flex-1 text-sm"
                onKeyDown={(e) => { if (e.key === 'Enter') onAddStep() }} />
              <button onClick={onAddStep} disabled={submitting || !newStep.trim()} className="btn-secondary text-sm">添加</button>
            </div>
          )}
        </div>

        <div className="border-t pt-3">
          <div className="flex items-center gap-2 mb-2 font-semibold text-gray-700">
            <Package className="w-4 h-4 text-primary" />更换配件
          </div>
          {order.parts && order.parts.length > 0 ? (
            <div className="space-y-1 text-xs mb-2">
              {order.parts.map((p: WorkOrderPart) => (
                <div key={p.id} className="flex justify-between bg-gray-50 rounded px-2 py-1.5">
                  <span className="text-gray-700">{p.partName}</span>
                  <span className="text-gray-500">× {p.quantity}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 mb-2">暂无更换配件</p>
          )}
          {isAssigned && order.status === 'in_progress' && (
            <div className="flex gap-2">
              <input value={newPart.name} onChange={(e) => setNewPart({ ...newPart, name: e.target.value })}
                placeholder="配件名称" className="form-input flex-1 text-sm" />
              <input type="number" min="1" value={newPart.qty}
                onChange={(e) => setNewPart({ ...newPart, qty: Math.max(1, Number(e.target.value) || 1) })}
                className="form-input w-20 text-sm" />
              <button onClick={onAddPart} disabled={submitting || !newPart.name.trim()} className="btn-secondary text-sm">添加</button>
            </div>
          )}
        </div>

        <div className="border-t pt-3">
          <div className="flex items-center gap-2 mb-2 font-semibold text-gray-700">
            <ImagePlus className="w-4 h-4 text-primary" />维修照片
            {noPhotos && order.status === 'in_progress' && (
              <span className="text-xs text-red-500 font-normal">（未上传，提交复核前需补传）</span>
            )}
          </div>
          {order.photos.length > 0 ? (
            <div className="flex gap-2 flex-wrap">
              {order.photos.map((p, i) => <img key={i} src={p} alt="" className="w-20 h-20 rounded object-cover border" />)}
            </div>
          ) : (
            <p className="text-xs text-gray-400">暂无照片</p>
          )}
        </div>

        <div className="border-t pt-3">
          <p className="text-gray-500 mb-2 text-sm font-semibold">状态时间线</p>
          <div className="space-y-1 text-xs text-gray-600">
            <div>📌 创建 - {new Date(order.createdAt).toLocaleString()}</div>
            {order.acceptedAt && <div>✅ 接单 - {new Date(order.acceptedAt).toLocaleString()}</div>}
            {order.submittedAt && <div>📤 提交复核 - {new Date(order.submittedAt).toLocaleString()}</div>}
            {order.reviewedAt && <div>
              {order.status === 'completed' ? '✅' : '🔄'} 复核{order.status === 'completed' ? '通过' : '驳回'} - {new Date(order.reviewedAt).toLocaleString()}
            </div>}
            {order.completedAt && <div>🏁 完成 - {new Date(order.completedAt).toLocaleString()}</div>}
          </div>
        </div>
      </div>

      <div className="border-t pt-4 mt-4 flex flex-wrap gap-2">
        {isAssigned && order.status === 'pending' && <button onClick={onAccept} className="btn-primary">接单</button>}
        {isAssigned && order.status === 'in_progress' && (
          <>
            <button onClick={onUploadPhotos} className="btn-secondary gap-1">
              <ImagePlus className="w-4 h-4" /> 上传照片
            </button>
            <button onClick={onSubmitReview} disabled={submitting || noPhotos} className="btn-primary gap-1 disabled:opacity-50">
              <Send className="w-4 h-4" /> 提交复核
              {noPhotos && <span className="text-xs ml-1">（需照片）</span>}
            </button>
          </>
        )}
        {canReview && order.status === 'submitted' && (
          <>
            <div className="flex-1" />
            <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)}
              placeholder="复核意见（可选）" className="form-input text-sm w-full mb-2" rows={2} />
            <button onClick={() => onReview(false)} disabled={submitting} className="btn-danger gap-1">
              <ThumbsDown className="w-4 h-4" /> 驳回
            </button>
            <button onClick={() => onReview(true)} disabled={submitting} className="btn-primary gap-1">
              <ThumbsUp className="w-4 h-4" /> 通过
            </button>
          </>
        )}
        {canManage && <button onClick={onEscalate} className="btn-secondary flex items-center gap-1">
          <ArrowUpCircle className="w-4 h-4" /> 升级
        </button>}
      </div>
    </Modal>
  )
}
