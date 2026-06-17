import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Monitor, Droplets, Thermometer, Gauge, Waves,
  ToggleLeft, ToggleRight, AlertTriangle, AlertCircle,
  ArrowUp, ArrowDown, Minus, ClipboardList, RefreshCw,
  X, Wrench, ListTodo, Package, Send, ThumbsUp, ThumbsDown, UserCheck,
  ImagePlus, Clock, CheckCircle2, ArrowUpCircle,
} from 'lucide-react'
import { devices as deviceApi, fields as fieldApi, workorders as orderApi } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import type { Sensor, Valve, Pump, Field, Urgency, WorkOrder, WorkOrderStep, WorkOrderPart } from '@/types'

type Tab = 'sensors' | 'valves' | 'pumps' | 'alerts'
type StatusFilter = '' | 'normal' | 'fault' | 'offline'

interface AlertItem {
  id: number
  deviceType: string
  deviceName: string
  fieldId: number
  fieldName: string
  description: string
  severity: 'high' | 'medium' | 'low'
  time: string
  relatedOrder?: WorkOrder | null
}

const SENSOR_TYPE_LABELS: Record<string, string> = {
  moisture: '湿度', temperature: '温度', pressure: '压力', flow: '流量',
}
const SENSOR_TYPE_ICONS: Record<string, React.ElementType> = {
  moisture: Droplets, temperature: Thermometer, pressure: Gauge, flow: Waves,
}

const SEVERITY_STYLES: Record<string, string> = {
  high: 'bg-red-50 text-red-600 border-red-100',
  medium: 'bg-orange-50 text-orange-600 border-orange-100',
  low: 'bg-yellow-50 text-yellow-600 border-yellow-100',
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待接单',
  accepted: '已接单',
  in_progress: '进行中',
  submitted: '待复核',
  completed: '已完成',
}

const URGENCY_LABELS: Record<Urgency, string> = {
  high: '紧急', medium: '中等', low: '低',
}

function TrendArrow({ current, prev }: { current: number; prev: number }) {
  if (current > prev) return <ArrowUp className="w-3.5 h-3.5 text-red-400" />
  if (current < prev) return <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
  return <Minus className="w-3.5 h-3.5 text-gray-300" />
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'normal' || status === 'running') return <span className="status-normal">正常</span>
  if (status === 'fault') return <span className="status-fault">故障</span>
  return <span className="status-offline">离线</span>
}

function OrderStatusBadge({ status }: { status: string }) {
  const color = status === 'completed' ? 'badge-green' : status === 'submitted' ? 'badge-purple' : status === 'pending' ? 'badge-orange' : 'badge-blue'
  return <span className={color}>{STATUS_LABELS[status] || status}</span>
}

function ConfirmDialog({ open, onConfirm, onCancel, message }: {
  open: boolean; onConfirm: () => void; onCancel: () => void; message: string
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-5 h-5 text-orange-500" />
          <h3 className="font-semibold text-gray-800">操作确认</h3>
        </div>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={onCancel}>取消</button>
          <button className="btn-primary" onClick={onConfirm}>确认</button>
        </div>
      </div>
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

function SensorTable({ sensors, fieldMap }: { sensors: Sensor[]; fieldMap: Record<number, string> }) {
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [fieldFilter, setFieldFilter] = useState('')

  const filtered = sensors.filter((s) => {
    if (typeFilter && s.type !== typeFilter) return false
    if (statusFilter && s.status !== statusFilter) return false
    if (fieldFilter && s.fieldId !== Number(fieldFilter)) return false
    return true
  })

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <select className="form-input w-36" value={fieldFilter} onChange={(e) => setFieldFilter(e.target.value)}>
          <option value="">全部田块</option>
          {Object.entries(fieldMap).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select className="form-input w-32" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">全部类型</option>
          {Object.entries(SENSOR_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="form-input w-28" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
          <option value="">全部</option>
          <option value="normal">正常</option>
          <option value="fault">故障</option>
          <option value="offline">离线</option>
        </select>
      </div>
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr><th>田块</th><th>传感器类型</th><th>当前值</th><th>趋势</th><th>状态</th><th>最后更新</th></tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const Icon = SENSOR_TYPE_ICONS[s.type] || Gauge
              const prevVal = s.value + (Math.random() - 0.5) * s.value * 0.05
              return (
                <tr key={s.id}>
                  <td className="text-gray-700">{fieldMap[s.fieldId] || `田块#${s.fieldId}`}</td>
                  <td className="flex items-center gap-2 text-gray-700"><Icon className="w-4 h-4 text-gray-400" />{SENSOR_TYPE_LABELS[s.type] || s.type}</td>
                  <td className="font-mono">{s.value} <span className="text-gray-400 text-xs">{s.unit}</span></td>
                  <td><TrendArrow current={s.value} prev={prevVal} /></td>
                  <td><StatusBadge status={s.status} /></td>
                  <td className="text-sm text-gray-400">{new Date(s.lastUpdate).toLocaleString('zh-CN')}</td>
                </tr>
              )
            })}
            {filtered.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-400">暂无数据</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ValveGrid({ valves, fieldMap, onToggle }: { valves: Valve[]; fieldMap: Record<number, string>; onToggle: (v: Valve) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {valves.map((v) => (
        <div key={v.id} className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-700 text-sm">{v.name}</h4>
            <div className={`w-3 h-3 rounded-full ${v.status === 'open' ? 'bg-emerald-400 animate-pulse-status' : 'bg-gray-300'}`} />
          </div>
          <p className="text-xs text-gray-400 mb-3">{fieldMap[v.fieldId] || `田块#${v.fieldId}`}</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
            <div>流量: <span className="font-mono text-gray-700">{v.flowRate} m³/h</span></div>
            <div>压力: <span className="font-mono text-gray-700">{v.pressure} MPa</span></div>
          </div>
          <button
            className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              v.status === 'open' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
            }`}
            onClick={() => onToggle(v)}
          >
            {v.status === 'open' ? <><ToggleRight className="w-4 h-4" />关闭阀门</> : <><ToggleLeft className="w-4 h-4" />开启阀门</>}
          </button>
        </div>
      ))}
      {valves.length === 0 && <div className="col-span-full text-center py-8 text-gray-400">暂无阀门</div>}
    </div>
  )
}

function PumpDashboard({ pumps, fieldMap, onRepair }: {
  pumps: Pump[]; fieldMap: Record<number, string>; onRepair: (p: Pump) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {pumps.map((p) => (
        <div key={p.id} className={`card p-5 ${p.status === 'fault' ? 'border-red-200' : ''}`}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h4 className="font-medium text-gray-700">{p.name}</h4>
              <p className="text-xs text-gray-400 mt-0.5">{fieldMap[p.fieldId] || `田块#${p.fieldId}`}</p>
            </div>
            {p.status === 'running' ? (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse-status" />
                <span className="text-xs font-medium text-emerald-600">运行中</span>
              </div>
            ) : p.status === 'fault' ? (
              <span className="status-fault flex items-center gap-1"><AlertTriangle className="w-3 h-3" />故障</span>
            ) : (
              <span className="status-offline">已停止</span>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">今日运行</span>
              <span className="font-mono text-gray-800">{p.todayRuntime} h</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-primary-400 rounded-full" style={{ width: `${Math.min((p.todayRuntime / 24) * 100, 100)}%` }} />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">累计运行</span>
              <span className="font-mono text-gray-800">{p.totalRuntime} h</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">上次维护</span>
              <span className="text-gray-700">{p.lastMaintenance || '-'}</span>
            </div>
          </div>
          {p.status === 'fault' && (
            <button onClick={() => onRepair(p)} className="mt-4 w-full btn-danger text-xs flex items-center justify-center gap-1">
              <Wrench className="w-3.5 h-3.5" />报修
            </button>
          )}
        </div>
      ))}
      {pumps.length === 0 && <div className="col-span-full text-center py-8 text-gray-400">暂无水泵</div>}
    </div>
  )
}

function AlertList({ alerts, onGenerateOrder, onViewOrder }: {
  alerts: AlertItem[]; onGenerateOrder: (a: AlertItem) => void; onViewOrder: (o: WorkOrder) => void
}) {
  return (
    <div className="space-y-3">
      {alerts.map((a) => (
        <div key={a.id} className={`card p-4 border ${SEVERITY_STYLES[a.severity]}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-medium">{a.deviceName}</span>
                  <span className="text-xs opacity-70">{a.fieldName}</span>
                  {a.relatedOrder && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onViewOrder(a.relatedOrder!) }}
                      className="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/70 hover:bg-white transition-colors"
                    >
                      <ClipboardList className="w-3 h-3" />
                      工单: <OrderStatusBadge status={a.relatedOrder.status} />
                    </button>
                  )}
                </div>
                <p className="text-sm opacity-80">{a.description}</p>
                <p className="text-xs opacity-50 mt-1">{new Date(a.time).toLocaleString('zh-CN')}</p>
              </div>
            </div>
            {!a.relatedOrder ? (
              <button
                className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/60 hover:bg-white/80 transition-colors"
                onClick={() => onGenerateOrder(a)}
              >
                <ClipboardList className="w-3.5 h-3.5" />生成工单
              </button>
            ) : (
              <button
                className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors"
                onClick={(e) => { e.stopPropagation(); onViewOrder(a.relatedOrder!) }}
              >
                <ClipboardList className="w-3.5 h-3.5" />查看工单
              </button>
            )}
          </div>
        </div>
      ))}
      {alerts.length === 0 && <div className="text-center py-8 text-gray-400">暂无告警</div>}
    </div>
  )
}

function DetailModal({
  order, fieldName, onClose, onOpenWorkOrders,
}: {
  order: WorkOrder; fieldName: string; onClose: () => void; onOpenWorkOrders: () => void
}) {
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
            {URGENCY_LABELS[order.urgency]}</span></div>
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
        </div>

        {order.photos.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-gray-700 mb-2 text-sm font-semibold">维修照片</p>
            <div className="flex gap-2 flex-wrap">
              {order.photos.map((p, i) => <img key={i} src={p} alt="" className="w-20 h-20 rounded object-cover border" />)}
            </div>
          </div>
        )}

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

      <div className="border-t pt-4 mt-4 flex justify-end">
        <button onClick={onOpenWorkOrders} className="btn-primary gap-1">
          <ClipboardList className="w-4 h-4" /> 前往工单管理处理
        </button>
      </div>
    </Modal>
  )
}

export default function Devices() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [valves, setValves] = useState<Valve[]>([])
  const [pumps, setPumps] = useState<Pump[]>([])
  const [fieldMap, setFieldMap] = useState<Record<number, string>>({})
  const [fields, setFields] = useState<Field[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('sensors')
  const [toast, setToast] = useState('')
  const [confirmValve, setConfirmValve] = useState<Valve | null>(null)
  const [showDetail, setShowDetail] = useState<WorkOrder | null>(null)
  const refreshRef = useRef<ReturnType<typeof setInterval>>()

  const [orderForm, setOrderForm] = useState<{
    open: boolean; deviceType: string; deviceId: string; deviceName: string;
    fieldId: number; description: string; urgency: Urgency;
  }>({ open: false, deviceType: '', deviceId: '', deviceName: '', fieldId: 0, description: '', urgency: 'high' })

  const [alerts, setAlerts] = useState<AlertItem[]>([])

  const canManage = user?.role === 'technician' || user?.role === 'owner'

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }, [])

  const loadRelatedOrders = useCallback(async (alertList: AlertItem[]) => {
    const alertsWithOrders = await Promise.all(
      alertList.map(async (a) => {
        try {
          const orders = await orderApi.getByDevice(a.deviceType, Number(a.id))
          if (orders && orders.length > 0) {
            return { ...a, relatedOrder: orders[0] }
          }
        } catch { /* ignore */ }
        return { ...a, relatedOrder: null }
      })
    )
    setAlerts(alertsWithOrders)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const [s, v, p, f] = await Promise.all([
        deviceApi.listSensors(),
        deviceApi.listValves(),
        deviceApi.listPumps(),
        fieldApi.list(),
      ])
      setSensors(s)
      setValves(v)
      setPumps(p)
      setFields(f)
      const map: Record<number, string> = {}
      f.forEach((field) => { map[field.id] = field.name })
      setFieldMap(map)

      const alertList: AlertItem[] = [
        ...s.filter((s) => s.status === 'fault').map((s, i) => ({
          id: 1000 + i, deviceType: '传感器', deviceName: SENSOR_TYPE_LABELS[s.type] || s.type,
          fieldId: s.fieldId, fieldName: map[s.fieldId] || `田块#${s.fieldId}`,
          description: `传感器异常，当前值 ${s.value}${s.unit}`, severity: 'high' as const, time: s.lastUpdate,
        })),
        ...pumps.filter((p) => p.status === 'fault').map((p, i) => ({
          id: 2000 + i, deviceType: '水泵', deviceName: p.name,
          fieldId: p.fieldId, fieldName: map[p.fieldId] || `田块#${p.fieldId}`,
          description: `水泵故障，需要维修`, severity: 'high' as const, time: new Date().toISOString(),
        })),
      ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

      loadRelatedOrders(alertList)
    } catch {
      showToast('加载数据失败')
    } finally {
      setLoading(false)
    }
  }, [showToast, loadRelatedOrders])

  useEffect(() => {
    fetchData()
    refreshRef.current = setInterval(fetchData, 10000)
    return () => { if (refreshRef.current) clearInterval(refreshRef.current) }
  }, [fetchData])

  const faultCount = sensors.filter((s) => s.status === 'fault').length
    + valves.filter((v) => (v as { status: string }).status === 'fault').length
    + pumps.filter((p) => p.status === 'fault').length

  const handleToggleValve = async () => {
    if (!confirmValve) return
    try {
      const action = confirmValve.status === 'open' ? 'closed' : 'open'
      await deviceApi.toggleValve(confirmValve.id, action)
      showToast(`阀门 ${confirmValve.name} 已${action === 'open' ? '开启' : '关闭'}`)
      fetchData()
    } catch {
      showToast('操作失败')
    } finally {
      setConfirmValve(null)
    }
  }

  const openOrderFromAlert = (a: AlertItem) => {
    setOrderForm({
      open: true, deviceType: a.deviceType, deviceId: String(a.id),
      deviceName: a.deviceName, fieldId: a.fieldId,
      description: a.description, urgency: a.severity === 'high' ? 'high' : a.severity === 'medium' ? 'medium' : 'low',
    })
  }

  const openOrderFromPump = (p: Pump) => {
    setOrderForm({
      open: true, deviceType: '水泵', deviceId: String(p.id), deviceName: p.name,
      fieldId: p.fieldId, description: `${p.name} 故障，需要维修`, urgency: 'high',
    })
  }

  const handleViewOrder = async (order: WorkOrder) => {
    try {
      const detail = await orderApi.get(order.id)
      setShowDetail(detail)
    } catch (e: any) {
      showToast(e?.message || '加载工单详情失败')
    }
  }

  const handleSubmitOrder = async () => {
    if (!orderForm.fieldId || !orderForm.description) {
      showToast('请填写完整工单信息')
      return
    }
    try {
      await orderApi.create({
        type: orderForm.deviceType === '水泵' ? 'maintenance' : 'maintenance',
        deviceType: orderForm.deviceType,
        deviceId: Number(orderForm.deviceId),
        fieldId: orderForm.fieldId,
        description: orderForm.description,
        urgency: orderForm.urgency,
      })
      showToast('工单已创建，将指派维修人员处理')
      setOrderForm({ open: false, deviceType: '', deviceId: '', deviceName: '', fieldId: 0, description: '', urgency: 'high' })
      fetchData()
    } catch (e: any) {
      if (e?.status === 409 && e?.data?.existingId) {
        if (confirm('该设备已有进行中的工单，是否直接跳转到该工单详情？')) {
          try {
            const existing = await orderApi.get(e.data.existingId)
            setOrderForm({ open: false, deviceType: '', deviceId: '', deviceName: '', fieldId: 0, description: '', urgency: 'high' })
            setShowDetail(existing)
          } catch {
            showToast('查找现有工单失败')
          }
          return
        }
      }
      showToast(e?.message || '创建工单失败')
    }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'sensors', label: '传感器监控' },
    { key: 'valves', label: '阀门控制' },
    { key: 'pumps', label: '水泵监控' },
    { key: 'alerts', label: `异常告警${alerts.length > 0 ? ` (${alerts.length})` : ''}` },
  ]

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-gray-100 rounded w-1/2" />
        <div className="h-64 bg-gray-100 rounded" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-primary-500 text-white px-5 py-3 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      {faultCount > 0 && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-5 py-3">
          <div className="flex items-center gap-3 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">当前有 {faultCount} 台设备异常</span>
          </div>
          <button
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
            onClick={() => setTab('alerts')}
          >
            查看异常设备
          </button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Monitor className="w-6 h-6 text-primary-500" />
        <h1 className="text-xl font-bold text-gray-800">设备监控</h1>
        <button className="ml-auto btn-secondary text-xs" onClick={fetchData}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" />刷新
        </button>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sensors' && <SensorTable sensors={sensors} fieldMap={fieldMap} />}
      {tab === 'valves' && <ValveGrid valves={valves} fieldMap={fieldMap} onToggle={(v) => setConfirmValve(v)} />}
      {tab === 'pumps' && <PumpDashboard pumps={pumps} fieldMap={fieldMap} onRepair={openOrderFromPump} />}
      {tab === 'alerts' && <AlertList alerts={alerts} onGenerateOrder={openOrderFromAlert} onViewOrder={handleViewOrder} />}

      <ConfirmDialog
        open={!!confirmValve}
        message={`确定要${confirmValve?.status === 'open' ? '关闭' : '开启'}阀门「${confirmValve?.name}」吗？`}
        onConfirm={handleToggleValve}
        onCancel={() => setConfirmValve(null)}
      />

      {orderForm.open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => canManage && setOrderForm((s) => ({ ...s, open: false }))}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />新建维修工单
              </h3>
              <button onClick={() => setOrderForm((s) => ({ ...s, open: false }))} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="form-label">设备类型</label>
                <input className="form-input" value={orderForm.deviceType} readOnly />
              </div>
              <div>
                <label className="form-label">设备名称</label>
                <input className="form-input" value={orderForm.deviceName} readOnly />
              </div>
              <div>
                <label className="form-label">所属田块</label>
                <input className="form-input bg-gray-50" value={fieldMap[orderForm.fieldId] || `田块#${orderForm.fieldId}`} readOnly />
              </div>
              <div>
                <label className="form-label">故障描述</label>
                <textarea className="form-input" rows={3} value={orderForm.description}
                  onChange={(e) => setOrderForm((s) => ({ ...s, description: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">紧急程度</label>
                <select className="form-input" value={orderForm.urgency}
                  onChange={(e) => setOrderForm((s) => ({ ...s, urgency: e.target.value as Urgency }))}>
                  <option value="high">紧急（红色）</option>
                  <option value="medium">中等（橙色）</option>
                  <option value="low">低（黄色）</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button className="btn-secondary" onClick={() => setOrderForm((s) => ({ ...s, open: false }))}>取消</button>
              <button className="btn-primary" onClick={handleSubmitOrder} disabled={!canManage}>
                {canManage ? '提交工单' : '无权限'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetail && <DetailModal
        order={showDetail}
        fieldName={fieldMap[showDetail.fieldId] || `田块#${showDetail.fieldId}`}
        onOpenWorkOrders={() => navigate('/workorders')}
        onClose={() => setShowDetail(null)}
      />}
    </div>
  )
}
