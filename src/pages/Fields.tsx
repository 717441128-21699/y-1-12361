import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Plus, Search, Ruler, Droplets, Radio, Wrench } from 'lucide-react'
import { fields as api } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import type { Field } from '@/types'

const CROP_COLORS: Record<string, string> = {
  小麦: 'bg-amber-50 text-amber-600',
  玉米: 'bg-yellow-50 text-yellow-600',
  水稻: 'bg-sky-50 text-sky-600',
  大豆: 'bg-green-50 text-green-600',
  蔬菜: 'bg-emerald-50 text-emerald-600',
}

const CROPS = ['小麦', '玉米', '水稻', '大豆', '蔬菜']

function getIrrigationBadge(f: Field) {
  const used = f.monthlyUsed
  const quota = f.monthlyQuota
  if (f.irrigationSuspended) return <span className="status-fault">已暂停</span>
  if (used > 0 && used < quota) return <span className="status-running animate-pulse-status">灌溉中</span>
  return <span className="status-offline">待灌溉</span>
}

function FieldCard({ field, onClick }: { field: Field; onClick: () => void }) {
  const overQuota = field.monthlyUsed > field.monthlyQuota
  return (
    <div
      onClick={onClick}
      className="card p-5 cursor-pointer hover:shadow-md hover:border-primary-200 transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-gray-800 group-hover:text-primary-500 transition-colors">
          {field.name}
        </h3>
        {getIrrigationBadge(field)}
      </div>

      <div className="space-y-2.5 text-sm">
        <div className="flex items-center gap-2 text-gray-500">
          <Ruler className="w-4 h-4" />
          <span>{field.area} 亩</span>
          <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${CROP_COLORS[field.cropType] || 'bg-gray-50 text-gray-500'}`}>
            {field.cropType}
          </span>
        </div>

        <div>
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="flex items-center gap-1"><Droplets className="w-3.5 h-3.5" />土壤湿度</span>
            <span className="font-mono text-xs">{field.soilMoisture}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-400 rounded-full transition-all"
              style={{ width: `${Math.min(field.soilMoisture, 100)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-gray-500">
          <span>月度配额</span>
          <span className={`font-mono text-xs ${overQuota ? 'text-red-500 font-semibold' : ''}`}>
            {field.monthlyUsed}/{field.monthlyQuota} m³
            {overQuota && ' ⚠'}
          </span>
        </div>

        <div className="flex items-center gap-3 text-gray-400 text-xs pt-1 border-t border-gray-50">
          <span className="flex items-center gap-1"><Radio className="w-3 h-3" />传感器</span>
          <span className="flex items-center gap-1"><Wrench className="w-3 h-3" />阀门</span>
          <span className="flex items-center gap-1"><Droplets className="w-3 h-3" />水泵</span>
        </div>
      </div>
    </div>
  )
}

function FieldModal({
  open,
  onClose,
  onSave,
  initial,
}: {
  open: boolean
  onClose: () => void
  onSave: (data: Partial<Field>) => void
  initial?: Partial<Field>
}) {
  const [name, setName] = useState(initial?.name || '')
  const [area, setArea] = useState(String(initial?.area || ''))
  const [cropType, setCropType] = useState(initial?.cropType || CROPS[0])
  const [monthlyQuota, setMonthlyQuota] = useState(String(initial?.monthlyQuota || ''))

  useEffect(() => {
    if (open) {
      setName(initial?.name || '')
      setArea(String(initial?.area || ''))
      setCropType(initial?.cropType || CROPS[0])
      setMonthlyQuota(String(initial?.monthlyQuota || ''))
    }
  }, [open, initial])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">{initial?.id ? '编辑田块' : '新增田块'}</h3>
        <div className="space-y-4">
          <div>
            <label className="form-label">田块名称</label>
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="输入田块名称" />
          </div>
          <div>
            <label className="form-label">面积（亩）</label>
            <input className="form-input" type="number" value={area} onChange={(e) => setArea(e.target.value)} placeholder="输入面积" />
          </div>
          <div>
            <label className="form-label">作物类型</label>
            <select className="form-input" value={cropType} onChange={(e) => setCropType(e.target.value)}>
              {CROPS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">月度配额（m³）</label>
            <input className="form-input" type="number" value={monthlyQuota} onChange={(e) => setMonthlyQuota(e.target.value)} placeholder="输入月度配额" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button
            className="btn-primary"
            onClick={() => onSave({ name, area: Number(area), cropType, monthlyQuota: Number(monthlyQuota) })}
            disabled={!name || !area || !monthlyQuota}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Fields() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [fieldList, setFieldList] = useState<Field[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cropFilter, setCropFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingField, setEditingField] = useState<Partial<Field> | undefined>()
  const [toast, setToast] = useState('')

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }, [])

  const fetchFields = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.list()
      setFieldList(data)
    } catch {
      showToast('加载田块列表失败')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { fetchFields() }, [fetchFields])

  const filtered = fieldList.filter((f) => {
    if (search && !f.name.includes(search)) return false
    if (cropFilter && f.cropType !== cropFilter) return false
    return true
  })

  const handleSave = async (data: Partial<Field>) => {
    try {
      if (editingField?.id) {
        await api.update(editingField.id, data)
        showToast('田块更新成功')
      } else {
        await api.create(data)
        showToast('田块创建成功')
      }
      setModalOpen(false)
      setEditingField(undefined)
      fetchFields()
    } catch {
      showToast('操作失败')
    }
  }

  const canEdit = user?.role === 'technician' || user?.role === 'owner'

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-primary-500 text-white px-5 py-3 rounded-lg shadow-lg text-sm animate-pulse-status">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MapPin className="w-6 h-6 text-primary-500" />
          <h1 className="text-xl font-bold text-gray-800">田块管理</h1>
        </div>
        {canEdit && (
          <button className="btn-primary" onClick={() => { setEditingField(undefined); setModalOpen(true) }}>
            <Plus className="w-4 h-4 mr-1" />新增田块
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="form-input pl-9"
            placeholder="搜索田块名称..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="form-input w-36" value={cropFilter} onChange={(e) => setCropFilter(e.target.value)}>
          <option value="">全部作物</option>
          {CROPS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-5 bg-gray-100 rounded w-1/2 mb-4" />
              <div className="space-y-3">
                <div className="h-4 bg-gray-100 rounded w-3/4" />
                <div className="h-4 bg-gray-100 rounded w-2/3" />
                <div className="h-4 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((f) => (
            <FieldCard key={f.id} field={f} onClick={() => navigate(`/fields/${f.id}`)} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-400">
              暂无匹配的田块数据
            </div>
          )}
        </div>
      )}

      <FieldModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingField(undefined) }}
        onSave={handleSave}
        initial={editingField}
      />
    </div>
  )
}
