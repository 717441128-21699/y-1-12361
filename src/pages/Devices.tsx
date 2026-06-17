import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Monitor, Droplets, Thermometer, Gauge, Waves,
  ToggleLeft, ToggleRight, AlertTriangle, AlertCircle,
  ArrowUp, ArrowDown, Minus, ClipboardList, RefreshCw,
  X, Wrench,
} from 'lucide-react'
import { devices as deviceApi, fields as fieldApi, workorders as orderApi } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import type { Sensor, Valve, Pump, Field, Urgency } from '@/types'

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

function AlertList({ alerts, onGenerateOrder }: { alerts: AlertItem[]; onGenerateOrder: (a: AlertItem) => void }) {
  return (
    <div className="space-y-3">
      {alerts.map((a) => (
        <div key={a.id} className={`card p-4 border ${SEVERITY_STYLES[a.severity]}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{a.deviceName}</span>
                  <span className="text-xs opacity-70">{a.fieldName}</span>
                </div>
                <p className="text-sm opacity-80">{a.description}</p>
                <p className="text-xs opacity-50 mt-1">{new Date(a.time).toLocaleString('zh-CN')}</p>
              </div>
            </div>
            <button
              className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/60 hover:bg-white/80 transition-colors"
              onClick={() => onGenerateOrder(a)}
            >
              <ClipboardList className="w-3.5 h-3.5" />生成工单
            </button>
          </div>
        </div>
      ))}
      {alerts.length === 0 && <div className="text-center py-8 text-gray-400">暂无告警</div>}
    </div>
  )
}

export default function Devices() {
  const user = useAuthStore((s) => s.user)
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [valves, setValves] = useState<Valve[]>([])
  const [pumps, setPumps] = useState<Pump[]>([])
  const [fieldMap, setFieldMap] = useState<Record<number, string>>({})
  const [fields, setFields] = useState<Field[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('sensors')
  const [toast, setToast] = useState('')
  const [confirmValve, setConfirmValve] = useState<Valve | null>(null)
  const refreshRef = useRef<ReturnType<typeof setInterval>>()

  const [orderForm, setOrderForm] = useState<{
    open: boolean; deviceType: string; deviceId: string; deviceName: string;
    fieldId: number; description: string; urgency: Urgency;
  }>({ open: false, deviceType: '', deviceId: '', deviceName: '', fieldId: 0, description: '', urgency: 'high' })

  const canManage = user?.role === 'technician' || user?.role === 'owner'

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
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
    } catch {
      showToast('加载数据失败')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchData()
    refreshRef.current = setInterval(fetchData, 5000)
    return () => { if (refreshRef.current) clearInterval(refreshRef.current) }
  }, [fetchData])

  const faultCount = sensors.filter((s) => s.status === 'fault').length
    + valves.filter((v) => (v as { status: string }).status === 'fault').length
    + pumps.filter((p) => p.status === 'fault').length

  const alerts: AlertItem[] = [
    ...sensors.filter((s) => s.status === 'fault').map((s, i) => ({
      id: 1000 + i, deviceType: '传感器', deviceName: SENSOR_TYPE_LABELS[s.type] || s.type,
      fieldId: s.fieldId, fieldName: fieldMap[s.fieldId] || `田块#${s.fieldId}`,
      description: `传感器异常，当前值 ${s.value}${s.unit}`, severity: 'high' as const, time: s.lastUpdate,
    })),
    ...pumps.filter((p) => p.status === 'fault').map((p, i) => ({
      id: 2000 + i, deviceType: '水泵', deviceName: p.name,
      fieldId: p.fieldId, fieldName: fieldMap[p.fieldId] || `田块#${p.fieldId}`,
      description: `水泵故障，需要维修`, severity: 'high' as const, time: new Date().toISOString(),
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

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
    } catch (e: any) {
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
      {tab === 'alerts' && <AlertList alerts={alerts} onGenerateOrder={openOrderFromAlert} />}

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
                <select className="form-input" value={orderForm.fieldId}
                  onChange={(e) => setOrderForm((s) => ({ ...s, fieldId: Number(e.target.value) }))}>
                  <option value={0}>选择田块</option>
                  {fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
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
    </div>
  )
}
