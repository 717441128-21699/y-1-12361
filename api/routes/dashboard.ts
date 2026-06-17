import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

async function getHeatmapData(userId?: number, role?: string) {
  let fieldQuery = db('fields')
  if (role === 'farmer' && userId) {
    const fieldRows = await db('user_fields').where({ user_id: userId })
    const fieldIds = fieldRows.map((r: any) => r.field_id)
    fieldQuery = fieldQuery.whereIn('id', fieldIds)
  }
  const fields = await fieldQuery
  const data = []
  for (const field of fields) {
    const sensor = await db('sensors')
      .where({ field_id: field.id, type: 'soil_moisture', status: 'normal' })
      .first()
    data.push({
      fieldId: field.id,
      fieldName: field.name,
      x: field.grid_x,
      y: field.grid_y,
      moisture: sensor ? sensor.value : 0,
    })
  }
  return data
}

async function getProgressData() {
  const today = new Date().toISOString().slice(0, 10)
  const fields = await db('fields')
  const data = []
  for (const field of fields) {
    const plans = await db('irrigation_plans')
      .where({ field_id: field.id, plan_date: today })
    const total = plans.length
    const completed = plans.filter((p: any) => p.status === 'completed').length
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0
    const status = plans.some((p: any) => p.status === 'running') ? 'running'
      : plans.some((p: any) => p.status === 'pending') ? 'pending'
      : completed === total && total > 0 ? 'completed' : 'idle'
    data.push({ fieldId: field.id, fieldName: field.name, progress, status })
  }
  return data
}

async function getFaultRanking() {
  const orders = await db('work_orders')
    .whereNot({ status: 'completed' })
  const counts: Record<string, number> = {}
  for (const o of orders) {
    counts[o.device_type] = (counts[o.device_type] || 0) + 1
  }
  return Object.entries(counts)
    .map(([deviceType, count]) => ({ deviceType, count }))
    .sort((a, b) => b.count - a.count)
}

async function getWaterEfficiency() {
  const fields = await db('fields')
  let totalQuota = 0
  let totalUsed = 0
  const fieldRates = []
  for (const field of fields) {
    totalQuota += field.monthly_quota
    totalUsed += field.monthly_used
    const rate = field.monthly_quota > 0
      ? Number((field.monthly_used / field.monthly_quota * 100).toFixed(1))
      : 0
    fieldRates.push({ fieldId: field.id, fieldName: field.name, rate })
  }
  const overallRate = totalQuota > 0 ? Number((totalUsed / totalQuota * 100).toFixed(1)) : 0
  return { overallRate, fieldRates }
}

router.get('/realtime', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const [heatmap, progress, faults, efficiency] = await Promise.all([
      getHeatmapData(req.user!.id, req.user!.role),
      getProgressData(),
      getFaultRanking(),
      getWaterEfficiency(),
    ])
    res.json({ success: true, data: { heatmap, progress, faults, efficiency } })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/heatmap', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await getHeatmapData(req.user!.id, req.user!.role)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/progress', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await getProgressData()
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/fault-ranking', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await getFaultRanking()
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/water-efficiency', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await getWaterEfficiency()
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
