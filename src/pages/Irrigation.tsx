import { useState, useEffect, useCallback } from 'react'
import { Calendar, Sparkles, Eye, EyeOff, Clock, Check, X, Play, Edit3 } from 'lucide-react'
import { irrigation as api } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import type { IrrigationPlan, IrrigationRecommendation, PlanStatus } from '@/types'

const STATUS_MAP: Record<PlanStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  pending: { label: '待执行', cls: 'bg-gray-100 text-gray-500', icon: <Clock className="w-3 h-3" /> },
  running: { label: '执行中', cls: 'bg-blue-50 text-blue-600 animate-pulse-status', icon: <Play className="w-3 h-3" /> },
  completed: { label: '已完成', cls: 'bg-emerald-50 text-emerald-600', icon: <Check className="w-3 h-3" /> },
  cancelled: { label: '已取消', cls: 'bg-red-50 text-red-500', icon: <X className="w-3 h-3" /> },
}

function formatTime(t: string) {
  return t.slice(11, 16)
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function nowMinutes() {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

function timeToMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export default function Irrigation() {
  const user = useAuthStore((s) => s.user)
  const [date, setDate] = useState(todayStr())
  const [plans, setPlans] = useState<IrrigationPlan[]>([])
  const [recs, setRecs] = useState<IrrigationRecommendation[]>([])
  const [showRecs, setShowRecs] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editPlan, setEditPlan] = useState<IrrigationPlan | null>(null)
  const [editForm, setEditForm] = useState({ startTime: '', endTime: '', waterAmount: 0, reason: '' })
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [p, r] = await Promise.all([
        api.listPlans({ date }),
        api.getRecommendations(date),
      ])
      setPlans(p.sort((a, b) => a.startTime.localeCompare(b.startTime)))
      setRecs(r)
    } catch {
      setPlans([])
      setRecs([])
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { fetchData() }, [fetchData])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await api.generatePlans(date)
      await fetchData()
    } finally {
      setGenerating(false)
    }
  }

  const handleAdopt = async (rec: IrrigationRecommendation) => {
    try {
      await api.adoptRecommendation({
        fieldId: rec.fieldId,
        recommendedTime: rec.recommendedTime,
        reason: rec.reason,
        date,
      })
      setRecs((prev) => prev.filter((r) => r.fieldId !== rec.fieldId))
      showToast(`已采纳「${rec.fieldName}」推荐时段`)
      await fetchData()
    } catch (e: any) {
      showToast(e?.message || '采纳推荐失败')
    }
  }

  const openEdit = (plan: IrrigationPlan) => {
    setEditPlan(plan)
    setEditForm({
      startTime: plan.startTime.slice(11, 16),
      endTime: plan.endTime.slice(11, 16),
      waterAmount: plan.waterAmount,
      reason: '',
    })
  }

  const handleSaveEdit = async () => {
    if (!editPlan || !editForm.reason) return
    await api.updatePlan(editPlan.id, {
      startTime: `${date}T${editForm.startTime}:00`,
      endTime: `${date}T${editForm.endTime}:00`,
      waterAmount: editForm.waterAmount,
      reason: editForm.reason,
    })
    setEditPlan(null)
    await fetchData()
  }

  const isToday = date === todayStr()
  const nowMin = isToday ? nowMinutes() : -1

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-5 gap-6">
          <div className="col-span-3 space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
          <div className="col-span-2 space-y-3">
            <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-primary-500 text-white px-5 py-3 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-gray-800">灌溉计划</h1>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="form-input w-44" />
          <button onClick={handleGenerate} disabled={generating}
            className="btn-primary inline-flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            {generating ? '生成中...' : '自动生成今日计划'}
          </button>
          <button onClick={() => setShowRecs(!showRecs)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${showRecs ? 'bg-primary text-white' : 'btn-secondary'}`}>
            {showRecs ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            查看推荐时段
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        <div className="flex-[3] min-w-0">
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="font-semibold text-gray-700">今日灌溉时间轴</h2>
              <span className="text-sm text-gray-400">共 {plans.length} 条计划</span>
            </div>
            <div className="card-body relative">
              {plans.length === 0 && (
                <p className="text-center text-gray-400 py-12">暂无灌溉计划，请点击"自动生成今日计划"</p>
              )}
              <div className="relative ml-4 border-l-2 border-gray-100 pl-6 space-y-0">
                {plans.map((plan) => {
                  const st = STATUS_MAP[plan.status]
                  const startMin = timeToMin(formatTime(plan.startTime))
                  const endMin = timeToMin(formatTime(plan.endTime))
                  const isCurrent = nowMin >= startMin && nowMin <= endMin
                  return (
                    <div key={plan.id} className="relative pb-6">
                      <div className="absolute -left-[33px] top-1 w-4 h-4 rounded-full bg-white border-2 border-gray-200" />
                      <div className={`card p-4 cursor-pointer hover:shadow-md transition-shadow ${editPlan?.id === plan.id ? 'ring-2 ring-primary' : ''}`}
                        onClick={() => openEdit(plan)}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-sm text-gray-500">
                            {formatTime(plan.startTime)} - {formatTime(plan.endTime)}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                            {st.icon} {st.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-800">{plan.fieldName}</span>
                          <span className="badge-blue">阀门 #{plan.valveId}</span>
                        </div>
                        <span className="text-sm text-gray-500">用水量 {plan.waterAmount} m³</span>
                        {plan.reason && <p className="text-xs text-gray-400 mt-1">{plan.reason}</p>}
                      </div>
                      {isCurrent && (
                        <div className="absolute -left-[41px] top-1 flex items-center">
                          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                          <span className="ml-2 text-xs text-red-500 font-medium whitespace-nowrap">当前时间</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {isToday && plans.length > 0 && (
                <div className="absolute left-4 border-l-2 border-dashed border-red-400"
                  style={{ top: 0, bottom: 0 }} />
              )}
            </div>
          </div>
        </div>

        <div className="flex-[2] min-w-0 space-y-6">
          {showRecs && (
            <div className="card">
              <div className="card-header">
                <h2 className="font-semibold text-gray-700">智能推荐卡片组</h2>
              </div>
              <div className="card-body space-y-3">
                {recs.length === 0 && <p className="text-gray-400 text-sm text-center py-4">暂无推荐</p>}
                {recs.map((rec) => (
                  <div key={rec.fieldId} className="p-3 rounded-lg border border-primary/20 bg-primary-50/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-800">{rec.fieldName}</span>
                      <span className="badge-green">节水 {rec.expectedSaving}%</span>
                    </div>
                    <p className="text-sm text-gray-500 mb-1">推荐时段：{rec.recommendedTime}</p>
                    <p className="text-xs text-gray-400 mb-2">{rec.reason}</p>
                    <button onClick={() => handleAdopt(rec)} className="btn-primary text-xs px-3 py-1">
                      采纳
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {editPlan && (
            <div className="card">
              <div className="card-header flex items-center justify-between">
                <h2 className="font-semibold text-gray-700">
                  <Edit3 className="w-4 h-4 inline mr-1" />计划调整
                </h2>
                <button onClick={() => setEditPlan(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="card-body space-y-4">
                <p className="text-sm text-gray-500">调整田块：<strong>{editPlan.fieldName}</strong></p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">开始时间</label>
                    <input type="time" value={editForm.startTime}
                      onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                      className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">结束时间</label>
                    <input type="time" value={editForm.endTime}
                      onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                      className="form-input" />
                  </div>
                </div>
                <div>
                  <label className="form-label">用水量 (m³)</label>
                  <input type="number" value={editForm.waterAmount} min={0}
                    onChange={(e) => setEditForm({ ...editForm, waterAmount: Number(e.target.value) })}
                    className="form-input" />
                </div>
                <div>
                  <label className="form-label">调整原因 <span className="text-red-400">*</span></label>
                  <textarea value={editForm.reason}
                    onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                    className="form-input" rows={3} placeholder="请填写调整原因" />
                </div>
                <div className="flex gap-3 justify-end">
                  <button onClick={() => setEditPlan(null)} className="btn-secondary">取消</button>
                  <button onClick={handleSaveEdit}
                    disabled={!editForm.reason}
                    className="btn-primary disabled:opacity-50">保存</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
