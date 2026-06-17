import { useState, useEffect, useCallback } from 'react'
import { Droplets, Download, FileSpreadsheet, ShieldCheck } from 'lucide-react'
import ReactECharts from 'echarts-for-react'
import { water as api } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import type { WaterUsage } from '@/types'

type TabKey = 'usage' | 'quota' | 'approval'

function monthStr() {
  return new Date().toISOString().slice(0, 7)
}

function quotaColor(pct: number) {
  if (pct > 90) return 'bg-red-500'
  if (pct > 70) return 'bg-amber-400'
  return 'bg-emerald-500'
}

export default function Water() {
  const user = useAuthStore((s) => s.user)
  const isOwner = user?.role === 'owner'
  const isTech = user?.role === 'technician'
  const canEdit = isOwner || isTech

  const [month, setMonth] = useState(monthStr())
  const [data, setData] = useState<WaterUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('usage')
  const [editField, setEditField] = useState<WaterUsage | null>(null)
  const [editQuota, setEditQuota] = useState(0)
  const [approvalField, setApprovalField] = useState<WaterUsage | null>(null)
  const [approvalReason, setApprovalReason] = useState('')
  const [approvalHistory, setApprovalHistory] = useState<{
    id: number; fieldId: number; fieldName: string;
    approverId: number; approverName: string; reason: string;
    usedBefore: number; quota: number; createdAt: string;
  }[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [d, history] = await Promise.all([
        api.getUsage({ month }),
        canEdit ? api.approvalHistory().catch(() => []) : Promise.resolve([]),
      ])
      setData(d)
      setApprovalHistory(history || [])
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [month, canEdit])

  useEffect(() => { fetchData() }, [fetchData])

  const totalUsed = data.reduce((s, d) => s + d.monthlyUsed, 0)
  const totalQuota = data.reduce((s, d) => s + d.monthlyQuota, 0)
  const avgRate = totalQuota > 0 ? Math.round((totalUsed / totalQuota) * 100) : 0
  const overCount = data.filter((d) => d.monthlyUsed > d.monthlyQuota).length
  const savingRate = totalQuota > 0 ? Math.max(0, Math.round((1 - totalUsed / totalQuota) * 100)) : 0
  const suspended = data.filter((d) => d.monthlyUsed > d.monthlyQuota)

  const barOption = {
    tooltip: { trigger: 'axis' as const },
    legend: { data: ['实际用量', '配额'] },
    xAxis: { type: 'category' as const, data: data.map((d) => d.fieldName), axisLabel: { rotate: 30 } },
    yAxis: { type: 'value' as const, name: 'm³' },
    series: [
      {
        name: '实际用量', type: 'bar', data: data.map((d) => ({
          value: d.monthlyUsed,
          itemStyle: { color: d.monthlyUsed > d.monthlyQuota ? '#EF4444' : '#3B82F6' },
        })),
      },
      {
        name: '配额', type: 'line', data: data.map((d) => d.monthlyQuota),
        lineStyle: { type: 'dashed' as const, color: '#9CA3AF' },
        symbol: 'none',
      },
    ],
  }

  const fieldNames = data.map((d) => d.fieldName)
  const dates = data[0]?.dailyUsage.map((d) => d.date.slice(8)) || []
  const lineOption = {
    tooltip: { trigger: 'axis' as const },
    legend: { data: fieldNames },
    xAxis: { type: 'category' as const, data: dates },
    yAxis: { type: 'value' as const, name: 'm³' },
    series: data.map((d) => ({
      name: d.fieldName, type: 'line', data: d.dailyUsage.map((du) => du.amount), smooth: true,
    })),
  }

  const handleExport = async () => {
    try { await api.exportReport(month) } catch { /* ignore */ }
  }

  const handleSaveQuota = async () => {
    if (!editField) return
    await api.updateQuota(editField.fieldId, editQuota)
    setEditField(null)
    await fetchData()
  }

  const handleApprove = async () => {
    if (!approvalField || !approvalReason) return
    try {
      await api.approve(approvalField.fieldId, approvalReason)
      setApprovalField(null)
      setApprovalReason('')
      await fetchData()
    } catch (e: any) {
      alert(e?.message || '审批失败')
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (<div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Droplets className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-gray-800">水资源管理</h1>
        </div>
        <div className="flex items-center gap-3">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="form-input w-44" />
          <button onClick={handleExport} className="btn-primary inline-flex items-center gap-2">
            <Download className="w-4 h-4" />导出月度报告
          </button>
          <button onClick={handleExport} className="btn-secondary inline-flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />导出用水成本明细
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-100">
        {([
          ['usage', '用水量统计'],
          ['quota', '配额管理'],
          ['approval', '灌溉权限审批'],
        ] as [TabKey, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === key ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'usage' && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: '本月总用水量', value: `${totalUsed} m³`, icon: '💧', color: 'bg-blue-50 text-blue-600' },
              { label: '平均配额使用率', value: `${avgRate}%`, icon: '📊', color: 'bg-amber-50 text-amber-600' },
              { label: '超额田块数', value: `${overCount}`, icon: '⚠️', color: 'bg-red-50 text-red-600' },
              { label: '节水率', value: `${savingRate}%`, icon: '🌱', color: 'bg-emerald-50 text-emerald-600' },
            ].map((s) => (
              <div key={s.label} className="stat-card">
                <div className={`stat-icon ${s.color}`}>{s.icon}</div>
                <div>
                  <p className="text-sm text-gray-400">{s.label}</p>
                  <p className="text-xl font-bold">{s.value}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card-header"><h2 className="font-semibold text-gray-700">各田块用水量对比</h2></div>
            <div className="card-body"><ReactECharts option={barOption} style={{ height: 320 }} /></div>
          </div>
          <div className="card">
            <div className="card-header"><h2 className="font-semibold text-gray-700">每日用水趋势</h2></div>
            <div className="card-body"><ReactECharts option={lineOption} style={{ height: 300 }} /></div>
          </div>
        </div>
      )}

      {tab === 'quota' && (
        <div className="card">
          <div className="card-body p-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>田块</th><th>作物类型</th><th>月配额 (m³)</th><th>已用 (m³)</th>
                  <th>使用率</th><th>状态</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => {
                  const pct = d.monthlyQuota > 0 ? Math.round((d.monthlyUsed / d.monthlyQuota) * 100) : 0
                  const over = d.monthlyUsed > d.monthlyQuota
                  return (
                    <tr key={d.fieldId}>
                      <td className="font-medium">{d.fieldName}</td>
                      <td>{d.cropType}</td>
                      <td>{d.monthlyQuota}</td>
                      <td>{d.monthlyUsed}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden min-w-[80px]">
                            <div className={`h-full rounded-full ${quotaColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <span className="text-xs text-gray-500">{pct}%</span>
                        </div>
                      </td>
                      <td>
                        {over ? (
                          <span className="badge-red animate-pulse-status">超额</span>
                        ) : pct > 70 ? (
                          <span className="badge-orange">接近配额</span>
                        ) : (
                          <span className="badge-green">正常</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          {canEdit && (
                            <button onClick={() => { setEditField(d); setEditQuota(d.monthlyQuota) }}
                              className="text-primary text-sm hover:underline">调整配额</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'approval' && (
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />暂停灌溉田块
              </h2>
            </div>
            <div className="card-body space-y-3">
              {suspended.length === 0 && <p className="text-gray-400 text-sm text-center py-6">暂无暂停灌溉的田块</p>}
              {suspended.map((d) => (
                <div key={d.fieldId} className="flex items-center justify-between p-4 rounded-lg border border-red-100 bg-red-50/30">
                  <div>
                    <span className="font-medium text-gray-800">{d.fieldName}</span>
                    <span className="badge-red ml-2">超额暂停</span>
                    <p className="text-sm text-gray-400 mt-1">
                      已用 {d.monthlyUsed} / {d.monthlyQuota} m³
                    </p>
                  </div>
                  {isOwner && (
                    <button onClick={() => setApprovalField(d)}
                      className="btn-primary text-sm">审批恢复</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {approvalHistory.length > 0 && (
            <div className="card">
              <div className="card-header"><h2 className="font-semibold text-gray-700">审批历史</h2></div>
              <div className="card-body space-y-2">
                {approvalHistory.map((h) => (
                  <div key={h.id} className="text-sm py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{h.fieldName}</span>
                      <span className="text-gray-400 text-xs">{new Date(h.createdAt).toLocaleString('zh-CN')}</span>
                    </div>
                    <div className="text-gray-500 text-xs flex flex-wrap gap-x-4 gap-y-0.5">
                      <span>审批人：{h.approverName}</span>
                      <span>恢复前用量：{h.usedBefore?.toFixed?.(1) || h.usedBefore} / {h.quota} m³</span>
                    </div>
                    <div className="text-gray-600 text-xs mt-1">原因：{h.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {editField && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setEditField(null)}>
          <div className="bg-white rounded-xl p-6 w-96 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-800">调整配额 - {editField.fieldName}</h3>
            <div>
              <label className="form-label">月配额 (m³)</label>
              <input type="number" value={editQuota} min={0}
                onChange={(e) => setEditQuota(Number(e.target.value))} className="form-input" />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setEditField(null)} className="btn-secondary">取消</button>
              <button onClick={handleSaveQuota} className="btn-primary">保存</button>
            </div>
          </div>
        </div>
      )}

      {approvalField && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setApprovalField(null)}>
          <div className="bg-white rounded-xl p-6 w-96 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-800">审批恢复 - {approvalField.fieldName}</h3>
            <p className="text-sm text-gray-500">
              当前用量 {approvalField.monthlyUsed} / {approvalField.monthlyQuota} m³
            </p>
            <div>
              <label className="form-label">恢复原因 <span className="text-red-400">*</span></label>
              <textarea value={approvalReason}
                onChange={(e) => setApprovalReason(e.target.value)}
                className="form-input" rows={3} placeholder="请填写恢复灌溉的原因" />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setApprovalField(null)} className="btn-secondary">取消</button>
              <button onClick={handleApprove} disabled={!approvalReason}
                className="btn-primary disabled:opacity-50">确认恢复</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
