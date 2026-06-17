import { useState, useEffect, useCallback } from 'react'
import { Wrench, Plus, Clock, AlertTriangle, CheckCircle2, ArrowUpCircle, ImagePlus, X } from 'lucide-react'
import { workorders, fields as fieldsApi } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import type { WorkOrder, Field, Urgency } from '@/types'

type StatusFilter = 'all' | 'pending' | 'in_progress' | 'completed'

const URGENCY_COLORS: Record<Urgency, string> = {
  high: 'border-l-4 border-l-red-500',
  medium: 'border-l-4 border-l-orange-400',
  low: 'border-l-4 border-l-yellow-400',
}

const URGENCY_LABELS: Record<Urgency, string> = {
  high: '紧急', medium: '中等', low: '低',
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
  const [orders, setOrders] = useState<WorkOrder[]>([])
  const [allFields, setAllFields] = useState<Field[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [showDetail, setShowDetail] = useState<WorkOrder | null>(null)
  const [showComplete, setShowComplete] = useState<WorkOrder | null>(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [completePhotos, setCompletePhotos] = useState<string[]>([])
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const [createForm, setCreateForm] = useState({
    deviceType: '传感器', deviceId: '', fieldId: 0, description: '', urgency: 'medium' as Urgency,
  })

  const canManage = user?.role === 'technician' || user?.role === 'owner'

  const fetchOrders = useCallback(async () => {
    try {
      const data = await workorders.list()
      setOrders(data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchOrders().then(() => setLoading(false))
    fieldsApi.list().then(setAllFields).catch(() => {})
  }, [fetchOrders])

  const filtered = statusFilter === 'all' ? orders : orders.filter((o) => {
    if (statusFilter === 'pending') return o.status === 'pending'
    if (statusFilter === 'in_progress') return o.status === 'accepted' || o.status === 'in_progress'
    return o.status === 'completed'
  })

  const pending = filtered.filter((o) => o.status === 'pending')
  const inProgress = filtered.filter((o) => o.status === 'accepted' || o.status === 'in_progress')
  const completed = filtered.filter((o) => o.status === 'completed')

  const handleAccept = async (id: number) => {
    await workorders.accept(id)
    fetchOrders()
  }

  const handleEscalate = async (id: number) => {
    await workorders.escalate(id)
    fetchOrders()
  }

  const handleComplete = async () => {
    if (!showComplete) return
    if (completePhotos.length === 0) {
      setToast('请至少上传一张配件更换照片后才能完成工单')
      setTimeout(() => setToast(''), 2500)
      return
    }
    await workorders.complete(showComplete.id, completePhotos)
    setShowComplete(null)
    setCompletePhotos([])
    setPhotoUrl('')
    fetchOrders()
  }

  const handleCreate = async () => {
    if (!createForm.fieldId || !createForm.description) {
      setToast('请填写完整工单信息')
      setTimeout(() => setToast(''), 2500)
      return
    }
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
  }

  const fieldName = (id: number) => allFields.find((f) => f.id === id)?.name ?? `田块#${id}`

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-10 w-48 bg-gray-200 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
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
            {([['all', '全部'], ['pending', '待接单'], ['in_progress', '进行中'], ['completed', '已完成']] as const).map(([val, label]) => (
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

      <div className="grid grid-cols-3 gap-4 flex-1 min-h-0 overflow-hidden">
        <Column title="待接单" count={pending.length} icon={<Clock className="w-4 h-4 text-orange-500" />}>
          {pending.map((o) => (
            <OrderCard key={o.id} order={o} borderColor={URGENCY_COLORS[o.urgency]} onClick={() => setShowDetail(o)}>
              <div className="flex items-center gap-1 mb-2">
                <span className={o.urgency === 'high' ? 'badge-red' : o.urgency === 'medium' ? 'badge-orange' : 'badge-green'}>
                  {URGENCY_LABELS[o.urgency]}
                </span>
                {o.escalated && (
                  <span className="badge-red animate-pulse-status">已升级</span>
                )}
              </div>
              <p className="text-sm font-medium text-gray-800">{o.deviceType} - #{o.deviceId}</p>
              <p className="text-xs text-gray-500 mt-0.5">{fieldName(o.fieldId)}</p>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{o.description}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">{relativeTime(o.createdAt)}</span>
                {isOverdue(o.createdAt, 2) && (
                  <span className="text-xs font-bold text-red-500">超时!</span>
                )}
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
              {user?.id === o.assignedTo && (
                <button onClick={(e) => { e.stopPropagation(); setShowComplete(o); setCompletePhotos([]) }}
                  className="btn-primary text-xs py-1 px-2 mt-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> 完成
                </button>
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
              <p className="text-xs text-gray-400 mt-1">完成于 {relativeTime(o.createdAt)}</p>
              {o.photos.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {o.photos.map((p, i) => (
                    <img key={i} src={p} alt="" className="w-10 h-10 rounded object-cover cursor-pointer border border-gray-200"
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

      {showDetail && <DetailModal order={showDetail} fieldName={fieldName(showDetail.fieldId)}
        canManage={canManage} isAssigned={user?.id === showDetail.assignedTo}
        onAccept={() => handleAccept(showDetail.id)} onEscalate={() => handleEscalate(showDetail.id)}
        onComplete={() => { setShowDetail(null); setShowComplete(showDetail); setCompletePhotos([]) }}
        onClose={() => setShowDetail(null)} />}

      {showComplete && (
        <Modal onClose={() => setShowComplete(null)}>
          <h3 className="text-lg font-bold mb-3">上传维修照片</h3>
          <div className="flex gap-2 mb-3">
            <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="输入照片URL" className="form-input flex-1" />
            <button onClick={() => { if (photoUrl) { setCompletePhotos([...completePhotos, photoUrl]); setPhotoUrl('') } }}
              className="btn-secondary gap-1"><ImagePlus className="w-4 h-4" /> 添加</button>
          </div>
          {completePhotos.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-3">
              {completePhotos.map((p, i) => (
                <div key={i} className="relative">
                  <img src={p} alt="" className="w-16 h-16 rounded object-cover border" />
                  <button onClick={() => setCompletePhotos(completePhotos.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowComplete(null)} className="btn-secondary">取消</button>
            <button onClick={handleComplete} className="btn-primary">确认完成</button>
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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

function DetailModal({ order, fieldName, canManage, isAssigned, onAccept, onEscalate, onComplete, onClose }: {
  order: WorkOrder; fieldName: string; canManage: boolean; isAssigned: boolean
  onAccept: () => void; onEscalate: () => void; onComplete: () => void; onClose: () => void
}) {
  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold mb-3">工单详情 #{order.id}</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-gray-500">状态</span>
          <span className={order.status === 'completed' ? 'badge-green' : order.status === 'pending' ? 'badge-orange' : 'badge-blue'}>
            {{ pending: '待接单', accepted: '已接单', in_progress: '进行中', completed: '已完成' }[order.status]}
          </span></div>
        <div className="flex justify-between"><span className="text-gray-500">紧急程度</span>
          <span className={order.urgency === 'high' ? 'badge-red' : order.urgency === 'medium' ? 'badge-orange' : 'badge-green'}>
            {{ high: '紧急', medium: '中等', low: '低' }[order.urgency]}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">设备</span><span>{order.deviceType} - #{order.deviceId}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">田块</span><span>{fieldName}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">负责人</span><span>{order.assigneeName}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">创建时间</span><span>{new Date(order.createdAt).toLocaleString()}</span></div>
        {order.acceptedAt && <div className="flex justify-between"><span className="text-gray-500">接单时间</span><span>{new Date(order.acceptedAt).toLocaleString()}</span></div>}
        {order.escalated && <div className="flex justify-between"><span className="text-gray-500">升级</span><span className="badge-red">已升级</span></div>}
        <div><span className="text-gray-500">描述</span><p className="mt-1 text-gray-700">{order.description}</p></div>
        <div className="border-t pt-2">
          <p className="text-gray-500 mb-1">状态时间线</p>
          <div className="space-y-1 text-xs text-gray-600">
            <div>📌 创建 - {new Date(order.createdAt).toLocaleString()}</div>
            {order.acceptedAt && <div>✅ 接单 - {new Date(order.acceptedAt).toLocaleString()}</div>}
            {order.status === 'completed' && <div>🏁 完成</div>}
          </div>
        </div>
        {order.photos.length > 0 && (
          <div className="border-t pt-2">
            <p className="text-gray-500 mb-1">维修照片</p>
            <div className="flex gap-2 flex-wrap">
              {order.photos.map((p, i) => <img key={i} src={p} alt="" className="w-20 h-20 rounded object-cover border" />)}
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2 mt-4">
        {isAssigned && order.status === 'pending' && <button onClick={onAccept} className="btn-primary">接单</button>}
        {isAssigned && (order.status === 'accepted' || order.status === 'in_progress') && <button onClick={onComplete} className="btn-primary">完成</button>}
        {canManage && <button onClick={onEscalate} className="btn-secondary flex items-center gap-1"><ArrowUpCircle className="w-4 h-4" /> 升级</button>}
      </div>
    </Modal>
  )
}
