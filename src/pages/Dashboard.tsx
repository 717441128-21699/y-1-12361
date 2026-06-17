import { useState, useEffect, useCallback, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts/core'
import { HeatmapChart, BarChart, GaugeChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  VisualMapComponent,
  TitleComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { Droplets, Activity, AlertTriangle, Gauge, Download, RefreshCw, X, FileJson } from 'lucide-react'
import { dashboard as dashboardApi, fields as fieldsApi, water as waterApi } from '@/utils/api'
import type { DashboardData, Field, WaterUsage } from '@/types'

echarts.use([
  HeatmapChart,
  BarChart,
  GaugeChart,
  GridComponent,
  TooltipComponent,
  VisualMapComponent,
  TitleComponent,
  CanvasRenderer,
])

const BG = '#0f1923'
const CARD_BG = 'rgba(13, 30, 46, 0.85)'
const CARD_BORDER = 'rgba(0, 210, 211, 0.25)'
const TEAL = '#00D2D3'
const TEAL_GLOW = '0 0 20px rgba(0, 210, 211, 0.4)'

const STATUS_LABELS: Record<string, string> = {
  completed: '已完成',
  running: '灌溉中',
  pending: '待执行',
  cancelled: '已取消',
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#10B981',
  running: '#3B82F6',
  pending: '#4B5563',
  cancelled: '#6B7280',
}

function CardTitle({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="w-4 h-4" style={{ color: TEAL }} />
      <h3 className="text-sm font-medium tracking-wide" style={{ color: TEAL }}>{text}</h3>
    </div>
  )
}

function SkeletonBlock() {
  return (
    <div
      className="animate-pulse rounded-lg"
      style={{ background: 'rgba(255,255,255,0.05)', width: '100%', height: '100%' }}
    />
  )
}

function HeatmapChartComp({ data }: { data: DashboardData['heatmap'] }) {
  const option = useMemo(() => {
    if (!data.length) return {}
    const xs = [...new Set(data.map((d) => d.x))].sort((a, b) => a - b)
    const ys = [...new Set(data.map((d) => d.y))].sort((a, b) => a - b)
    const chartData = data.map((d) => [d.x, d.y, d.moisture])
    const values = data.map((d) => d.moisture)
    const minVal = Math.min(...values)
    const maxVal = Math.max(...values)
    return {
      tooltip: {
        backgroundColor: 'rgba(13,30,46,0.95)',
        borderColor: TEAL,
        borderWidth: 1,
        textStyle: { color: '#e0e0e0', fontSize: 12 },
        formatter: (params: any) => {
          const item = data.find((d) => d.x === params.data[0] && d.y === params.data[1])
          if (!item) return ''
          return `<b>${item.fieldName}</b><br/>湿度: ${item.moisture}%`
        },
      },
      grid: { top: 10, right: 40, bottom: 30, left: 40 },
      xAxis: {
        type: 'category',
        data: xs,
        splitArea: { show: true, areaStyle: { color: 'rgba(255,255,255,0.02)' } },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
      },
      yAxis: {
        type: 'category',
        data: ys,
        splitArea: { show: true, areaStyle: { color: 'rgba(255,255,255,0.02)' } },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
      },
      visualMap: {
        min: 0,
        max: 100,
        calculable: true,
        orient: 'vertical',
        right: 0,
        top: 'center',
        itemHeight: 120,
        textStyle: { color: 'rgba(255,255,255,0.6)', fontSize: 10 },
        inRange: {
          color: ['#EF4444', '#F59E0B', '#10B981'],
        },
      },
      series: [{
        type: 'heatmap',
        data: chartData,
        itemStyle: { borderColor: BG, borderWidth: 3, borderRadius: 4 },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,210,211,0.5)' },
        },
      }],
    }
  }, [data])

  return (
    <ReactECharts
      echarts={echarts}
      option={option}
      style={{ width: '100%', height: 'calc(100% - 40px)' }}
      theme="dark"
      opts={{ renderer: 'canvas' }}
    />
  )
}

function ProgressList({ data }: { data: DashboardData['progress'] }) {
  return (
    <div className="space-y-3 overflow-y-auto scrollbar-dark" style={{ maxHeight: 'calc(100% - 40px)' }}>
      {data.map((item) => {
        const color = STATUS_COLORS[item.status] || STATUS_COLORS.pending
        const isRunning = item.status === 'running'
        return (
          <div key={item.fieldId} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs text-gray-300">{item.fieldName}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold" style={{ color }}>{item.progress}%</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${isRunning ? 'animate-pulse-status' : ''}`}
                  style={{ background: `${color}22`, color }}
                >
                  {STATUS_LABELS[item.status] || item.status}
                </span>
              </div>
            </div>
            <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${item.progress}%`,
                  background: isRunning
                    ? `linear-gradient(90deg, ${color}, ${color}88)`
                    : color,
                  boxShadow: isRunning ? `0 0 8px ${color}66` : undefined,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function FaultBarChart({ data }: { data: DashboardData['faults'] }) {
  const option = useMemo(() => {
    if (!data.length) return {}
    const sorted = [...data].sort((a, b) => a.count - b.count)
    return {
      tooltip: {
        backgroundColor: 'rgba(13,30,46,0.95)',
        borderColor: TEAL,
        borderWidth: 1,
        textStyle: { color: '#e0e0e0', fontSize: 12 },
      },
      grid: { top: 10, right: 40, bottom: 20, left: 80 },
      xAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      yAxis: {
        type: 'category',
        data: sorted.map((d) => d.deviceType),
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
      },
      series: [{
        type: 'bar',
        data: sorted.map((d) => ({
          value: d.count,
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#EF4444' },
              { offset: 1, color: '#F59E0B' },
            ]),
          },
        })),
        barWidth: 16,
      }],
    }
  }, [data])

  return (
    <ReactECharts
      echarts={echarts}
      option={option}
      style={{ width: '100%', height: 'calc(100% - 40px)' }}
      theme="dark"
      opts={{ renderer: 'canvas' }}
    />
  )
}

function EfficiencyPanel({ data, waterUsages }: { data: DashboardData['efficiency']; waterUsages: WaterUsage[] }) {
  const gaugeOption = useMemo(() => ({
    series: [{
      type: 'gauge',
      startAngle: 220,
      endAngle: -40,
      min: 0,
      max: 100,
      radius: '85%',
      progress: {
        show: true,
        width: 14,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#0D7377' },
            { offset: 1, color: TEAL },
          ]),
        },
      },
      axisLine: { lineStyle: { width: 14, color: [[1, 'rgba(255,255,255,0.08)']] } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      pointer: { show: false },
      anchor: { show: false },
      title: { show: false },
      detail: {
        valueAnimation: true,
        offsetCenter: [0, 0],
        fontSize: 28,
        fontWeight: 'bold',
        fontFamily: 'JetBrains Mono, monospace',
        color: TEAL,
        formatter: '{value}%',
      },
      data: [{ value: data.overallRate }],
    }],
  }), [data.overallRate])

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col items-center justify-center">
        <ReactECharts
          echarts={echarts}
          option={gaugeOption}
          style={{ width: '100%', height: '55%' }}
          opts={{ renderer: 'canvas' }}
        />
        <span className="text-xs text-gray-400 -mt-2">综合利用率</span>
        <div className="grid grid-cols-4 gap-2 w-full mt-3 px-2">
          {data.fieldRates.map((f) => (
            <div key={f.fieldId} className="text-center rounded px-1 py-1.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="text-[10px] text-gray-400 truncate">{f.fieldName}</div>
              <div className="text-sm font-mono font-bold" style={{ color: f.rate >= 80 ? '#10B981' : f.rate >= 50 ? '#F59E0B' : '#EF4444' }}>
                {f.rate}%
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="w-px mx-2" style={{ background: 'rgba(255,255,255,0.08)' }} />
      <div className="w-[45%] flex flex-col py-1 overflow-y-auto scrollbar-dark">
        <div className="text-[10px] text-gray-500 mb-2 px-1">配额使用情况</div>
        {waterUsages.map((w) => {
          const pct = w.monthlyQuota > 0 ? Math.round((w.monthlyUsed / w.monthlyQuota) * 100) : 0
          const overQuota = pct > 100
          return (
            <div key={w.fieldId} className="px-1 py-1.5">
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-gray-400">{w.fieldName}</span>
                <span className={`font-mono ${overQuota ? 'text-red-400' : 'text-gray-400'}`}>
                  {w.monthlyUsed}/{w.monthlyQuota}m³
                </span>
              </div>
              <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div
                  className={`h-full rounded-full transition-all duration-700 ${overQuota ? 'animate-pulse-status' : ''}`}
                  style={{
                    width: `${Math.min(pct, 100)}%`,
                    background: overQuota
                      ? 'linear-gradient(90deg, #EF4444, #F59E0B)'
                      : pct > 80
                        ? '#F59E0B'
                        : '#10B981',
                    boxShadow: overQuota ? '0 0 8px rgba(239,68,68,0.5)' : undefined,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [fieldList, setFieldList] = useState<Field[]>([])
  const [waterUsages, setWaterUsages] = useState<WaterUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedField, setSelectedField] = useState<string>('all')
  const [selectedCrop, setSelectedCrop] = useState<string>('all')
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [refreshing, setRefreshing] = useState(false)
  const [exportModal, setExportModal] = useState<{ open: boolean; data: any; month: string }>({ open: false, data: null, month: '' })

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true)
      const [dashRes, fieldsRes, waterRes] = await Promise.all([
        dashboardApi.getRealtime(),
        fieldsApi.list(),
        waterApi.getUsage(),
      ])
      setData(dashRes)
      setFieldList(fieldsRes)
      setWaterUsages(waterRes)
    } catch {
      // silently handle - keep previous data
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const timer = setInterval(fetchData, 10000)
    return () => clearInterval(timer)
  }, [fetchData])

  const cropTypes = useMemo(() => {
    const crops = [...new Set(fieldList.map((f) => f.cropType))]
    return crops
  }, [fieldList])

  const handleExport = async () => {
    const month = selectedDate.slice(0, 7)
    try {
      const report = await waterApi.exportReport(month)
      setExportModal({ open: true, data: report, month })
    } catch {
      // silently handle
    }
  }

  const handleDownload = () => {
    if (!exportModal.data) return
    const jsonStr = JSON.stringify(exportModal.data, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `irrigation-report-${exportModal.month}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className="h-full -m-6 p-4 overflow-hidden flex flex-col"
      style={{ background: BG }}
    >
      {/* Grid pattern overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,210,211,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,210,211,0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <select
            value={selectedField}
            onChange={(e) => setSelectedField(e.target.value)}
            className="text-xs rounded px-2.5 py-1.5 outline-none"
            style={{
              background: 'rgba(13,30,46,0.9)',
              border: `1px solid ${CARD_BORDER}`,
              color: '#c0c0c0',
            }}
          >
            <option value="all">全部田块</option>
            {fieldList.map((f) => (
              <option key={f.id} value={String(f.id)}>{f.name}</option>
            ))}
          </select>
          <select
            value={selectedCrop}
            onChange={(e) => setSelectedCrop(e.target.value)}
            className="text-xs rounded px-2.5 py-1.5 outline-none"
            style={{
              background: 'rgba(13,30,46,0.9)',
              border: `1px solid ${CARD_BORDER}`,
              color: '#c0c0c0',
            }}
          >
            <option value="all">全部作物</option>
            {cropTypes.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-xs rounded px-2.5 py-1.5 outline-none"
            style={{
              background: 'rgba(13,30,46,0.9)',
              border: `1px solid ${CARD_BORDER}`,
              color: '#c0c0c0',
            }}
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <RefreshCw
              className="w-3 h-3"
              style={{
                color: TEAL,
                animation: refreshing ? 'none' : 'spin 2s linear infinite',
              }}
            />
            <span>每10秒刷新</span>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded"
            style={{
              background: 'rgba(0,210,211,0.15)',
              border: `1px solid ${CARD_BORDER}`,
              color: TEAL,
            }}
          >
            <Download className="w-3.5 h-3.5" />
            导出月度报告
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="relative z-10 flex-1 grid grid-cols-5 grid-rows-2 gap-3 min-h-0">
        {/* Module 1: Heatmap - top left */}
        <div
          className="col-span-3 row-span-1 rounded-lg p-4 flex flex-col"
          style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, boxShadow: TEAL_GLOW }}
        >
          <CardTitle icon={Droplets} text="土壤湿度分布" />
          {loading && !data ? <SkeletonBlock /> : <HeatmapChartComp data={data?.heatmap || []} />}
        </div>

        {/* Module 2: Progress - top right */}
        <div
          className="col-span-2 row-span-1 rounded-lg p-4 flex flex-col"
          style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, boxShadow: TEAL_GLOW }}
        >
          <CardTitle icon={Activity} text="今日灌溉进度" />
          {loading && !data ? <SkeletonBlock /> : <ProgressList data={data?.progress || []} />}
        </div>

        {/* Module 3: Faults - bottom left */}
        <div
          className="col-span-2 row-span-1 rounded-lg p-4 flex flex-col"
          style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, boxShadow: TEAL_GLOW }}
        >
          <CardTitle icon={AlertTriangle} text="故障报修排行" />
          {loading && !data ? <SkeletonBlock /> : <FaultBarChart data={data?.faults || []} />}
        </div>

        {/* Module 4: Efficiency - bottom right */}
        <div
          className="col-span-3 row-span-1 rounded-lg p-4 flex flex-col"
          style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, boxShadow: TEAL_GLOW }}
        >
          <CardTitle icon={Gauge} text="水资源利用率" />
          {loading && !data ? (
            <SkeletonBlock />
          ) : (
            <EfficiencyPanel data={data?.efficiency || { overallRate: 0, fieldRates: [] }} waterUsages={waterUsages} />
          )}
        </div>
      </div>

      {exportModal.open && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setExportModal((s) => ({ ...s, open: false }))}>
          <div
            className="rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col"
            style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, boxShadow: TEAL_GLOW }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'rgba(0,210,211,0.2)' }}>
              <div className="flex items-center gap-2">
                <FileJson className="w-5 h-5" style={{ color: TEAL }} />
                <h3 className="font-semibold" style={{ color: TEAL }}>月度灌溉报告 · {exportModal.month}</h3>
              </div>
              <button onClick={() => setExportModal((s) => ({ ...s, open: false }))} className="text-gray-400 hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre
                className="text-[11px] leading-relaxed rounded p-3 overflow-x-auto"
                style={{ background: 'rgba(0,0,0,0.3)', color: '#c0d0d0', fontFamily: 'JetBrains Mono, monospace' }}
              >{JSON.stringify(exportModal.data, null, 2)}</pre>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t" style={{ borderColor: 'rgba(0,210,211,0.2)' }}>
              <button
                onClick={() => setExportModal((s) => ({ ...s, open: false }))}
                className="text-xs px-4 py-2 rounded"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#c0c0c0', border: '1px solid rgba(255,255,255,0.1)' }}
              >关闭</button>
              <button
                onClick={handleDownload}
                className="text-xs px-4 py-2 rounded flex items-center gap-1.5"
                style={{ background: 'rgba(0,210,211,0.2)', color: TEAL, border: `1px solid ${CARD_BORDER}` }}
              >
                <Download className="w-3.5 h-3.5" />下载JSON
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        option {
          background: #0f1923;
          color: #c0c0c0;
        }
      `}</style>
    </div>
  )
}
