import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Pencil, Trash2, Droplets, Thermometer, Gauge, Waves,
  ToggleLeft, ToggleRight, AlertTriangle,
} from 'lucide-react'
import { fields as fieldApi, devices as deviceApi } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import type { FieldDetail, Sensor, Valve, Pump } from '@/types'

const SENSOR_ICONS: Record<string, React.ElementType> = {
  moisture: Droplets,
  temperature: Thermometer,
  pressure: Gauge,
  flow: Waves,
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'normal' || status === 'running') return <span className="status-normal">正常</span>
  if (status === 'fault') return <span className="status-fault">故障</span>
  return <span className="status-offline">离线</span>
}

function ValveStatusBadge({ status }: { status: string }) {
  return status === 'open'
    ? <span className="status-running animate-pulse-status">开启</span>
    : <span className="status-offline">关闭</span>
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const w = 120
  const h = 32
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={w} height={h} className="opacity-60">
      <polyline fill="none" stroke="#0D7377" strokeWidth="1.5" points={points} />
    </svg>
  )
}

function generateSparkData(base: number) {
  return Array.from({ length: 24 }, (_, i) =>
    base + Math.sin(i * 0.5) * base * 0.1 + (Math.random() - 0.5) * base * 0.08
  )
}

function SensorCard({ sensor }: { sensor: Sensor }) {
  const Icon = SENSOR_ICONS[sensor.type] || Gauge
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">{sensor.type === 'moisture' ? '湿度' : sensor.type === 'temperature' ? '温度' : sensor.type === 'pressure' ? '压力' : '流量'}</p>
          </div>
        </div>
        <StatusBadge status={sensor.status} />
      </div>
      <div className="flex items-end justify-between">
        <div>
          <span className="text-2xl font-mono font-semibold text-gray-800">{sensor.value}</span>
          <span className="text-sm text-gray-400 ml-1">{sensor.unit}</span>
        </div>
        <Sparkline data={generateSparkData(sensor.value)} />
      </div>
      <p className="text-xs text-gray-400 mt-2">最后更新: {new Date(sensor.lastUpdate).toLocaleString('zh-CN')}</p>
    </div>
  )
}

function ValveRow({ valve, onToggle, toggling }: { valve: Valve; onToggle: (v: Valve) => void; toggling: boolean }) {
  return (
    <tr>
      <td className="px-4 py-3 text-gray-700">{valve.name}</td>
      <td className="px-4 py-3"><ValveStatusBadge status={valve.status} /></td>
      <td className="px-4 py-3 font-mono text-sm">{valve.flowRate} m³/h</td>
      <td className="px-4 py-3 font-mono text-sm">{valve.pressure} MPa</td>
      <td className="px-4 py-3 text-sm text-gray-400">{new Date(valve.lastToggle).toLocaleString('zh-CN')}</td>
      <td className="px-4 py-3">
        <button
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            valve.status === 'open' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
          } disabled:opacity-50`}
          onClick={() => onToggle(valve)}
          disabled={toggling}
        >
          {valve.status === 'open' ? <><ToggleRight className="w-4 h-4" />关闭</> : <><ToggleLeft className="w-4 h-4" />开启</>}
        </button>
      </td>
    </tr>
  )
}

function PumpCard({ pump }: { pump: Pump }) {
  return (
    <div className={`card p-4 ${pump.status === 'fault' ? 'border-red-200 bg-red-50/30' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <h4 className="font-medium text-gray-700">{pump.name}</h4>
        {pump.status === 'running' ? (
          <span className="status-running animate-pulse-status">运行中</span>
        ) : pump.status === 'fault' ? (
          <span className="status-fault flex items-center gap-1"><AlertTriangle className="w-3 h-3" />故障</span>
        ) : (
          <span className="status-offline">已停止</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="text-gray-500">今日运行</div>
        <div className="font-mono text-gray-800">{pump.todayRuntime} h</div>
        <div className="text-gray-500">累计运行</div>
        <div className="font-mono text-gray-800">{pump.totalRuntime} h</div>
        <div className="text-gray-500">上次维护</div>
        <div className="text-gray-700">{pump.lastMaintenance || '-'}</div>
      </div>
    </div>
  )
}

type Tab = 'sensors' | 'valves' | 'pumps'

export default function FieldDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [detail, setDetail] = useState<FieldDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('sensors')
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [toast, setToast] = useState('')

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }, [])

  const fetchDetail = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      const data = await fieldApi.get(Number(id))
      setDetail(data)
    } catch {
      showToast('加载田块详情失败')
    } finally {
      setLoading(false)
    }
  }, [id, showToast])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  const handleToggleValve = async (valve: Valve) => {
    try {
      setTogglingId(valve.id)
      const action = valve.status === 'open' ? 'closed' : 'open'
      await deviceApi.toggleValve(valve.id, action)
      showToast(`阀门 ${valve.name} 已${action === 'open' ? '开启' : '关闭'}`)
      fetchDetail()
    } catch {
      showToast('操作失败')
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async () => {
    if (!detail || !confirm('确定删除该田块？')) return
    try {
      await fieldApi.delete(detail.id)
      navigate('/fields')
    } catch {
      showToast('删除失败')
    }
  }

  const canEdit = user?.role === 'technician' || user?.role === 'owner'

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-100 rounded w-1/3" />
        <div className="h-40 bg-gray-100 rounded" />
      </div>
    )
  }

  if (!detail) return <div className="text-center py-12 text-gray-400">田块不存在</div>

  const TABS: { key: Tab; label: string }[] = [
    { key: 'sensors', label: `传感器 (${detail.sensors.length})` },
    { key: 'valves', label: `阀门 (${detail.valves.length})` },
    { key: 'pumps', label: `水泵 (${detail.pumps.length})` },
  ]

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-primary-500 text-white px-5 py-3 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/fields')} className="flex items-center gap-1 text-sm text-gray-400 hover:text-primary-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />返回列表
        </button>
      </div>

      <div className="card p-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">{detail.name}</h1>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>{detail.area} 亩</span>
              <span>{detail.cropType}</span>
              {detail.irrigationSuspended
                ? <span className="status-fault">已暂停</span>
                : <span className="status-normal">正常</span>}
            </div>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <button className="btn-secondary text-xs" onClick={() => navigate('/fields')}>
                <Pencil className="w-3.5 h-3.5 mr-1" />编辑
              </button>
              <button className="btn-danger text-xs" onClick={handleDelete}>
                <Trash2 className="w-3.5 h-3.5 mr-1" />删除
              </button>
            </div>
          )}
        </div>
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

      {tab === 'sensors' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {detail.sensors.map((s) => <SensorCard key={s.id} sensor={s} />)}
          {detail.sensors.length === 0 && <div className="col-span-full text-center py-8 text-gray-400">暂无传感器</div>}
        </div>
      )}

      {tab === 'valves' && (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>阀门名称</th><th>状态</th><th>流量</th><th>压力</th><th>最后操作</th><th>远程控制</th>
              </tr>
            </thead>
            <tbody>
              {detail.valves.map((v) => (
                <ValveRow key={v.id} valve={v} onToggle={handleToggleValve} toggling={togglingId === v.id} />
              ))}
              {detail.valves.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">暂无阀门</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'pumps' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {detail.pumps.map((p) => <PumpCard key={p.id} pump={p} />)}
          {detail.pumps.length === 0 && <div className="col-span-full text-center py-8 text-gray-400">暂无水泵</div>}
        </div>
      )}
    </div>
  )
}
