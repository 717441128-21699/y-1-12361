import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { authMiddleware, requireRole } from '../middleware/auth.js'

const router = Router()

const CROP_MOISTURE_TARGET: Record<string, number> = {
  '小麦': 55, '玉米': 60, '水稻': 75, '大豆': 50, '蔬菜': 65,
}

router.get('/plans', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    let query = db('irrigation_plans')
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10)
    query = query.where({ plan_date: date })
    if (req.query.fieldId) query = query.where({ field_id: Number(req.query.fieldId) })
    if (req.user!.role === 'farmer') {
      const fieldRows = await db('user_fields').where({ user_id: req.user!.id })
      const fieldIds = fieldRows.map((r: any) => r.field_id)
      query = query.whereIn('field_id', fieldIds)
    }
    const plans = await query
    const result = []
    for (const p of plans) {
      const field = await db('fields').where({ id: p.field_id }).first()
      result.push({
        id: p.id,
        fieldId: p.field_id,
        fieldName: field?.name || '',
        startTime: p.start_time,
        endTime: p.end_time,
        waterAmount: p.water_amount,
        status: p.status,
        valveId: p.valve_id,
        reason: p.reason,
      })
    }
    res.json({ success: true, data: result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/plans/generate', authMiddleware, requireRole('owner', 'technician'), async (req: Request, res: Response): Promise<void> => {
  try {
    const date = (req.body.date as string) || new Date().toISOString().slice(0, 10)
    const fields = await db('fields').where({ irrigation_suspended: 0 })
    const generated: any[] = []
    for (const field of fields) {
      const existing = await db('irrigation_plans').where({ field_id: field.id, plan_date: date }).first()
      if (existing) continue
      const sensor = await db('sensors')
        .where({ field_id: field.id, type: 'soil_moisture', status: 'normal' })
        .first()
      const currentMoisture = sensor ? sensor.value : 50
      const target = CROP_MOISTURE_TARGET[field.crop_type] || 60
      if (currentMoisture >= target * 0.9) continue
      const deficit = target - currentMoisture
      const waterAmount = Number((deficit * field.area * 0.3).toFixed(1))
      const valve = await db('valves').where({ field_id: field.id }).first()
      if (!valve) continue
      const hour = 5 + (field.id % 6)
      const [id] = await db('irrigation_plans').insert({
        field_id: field.id,
        valve_id: valve.id,
        plan_date: date,
        start_time: `${date} ${String(hour).padStart(2, '0')}:00:00`,
        end_time: `${date} ${String(hour + 2).padStart(2, '0')}:00:00`,
        water_amount: waterAmount,
        status: 'pending',
        reason: `土壤湿度${currentMoisture}%低于目标值${target}%，需补水量${waterAmount}m³`,
      })
      generated.push({ id, fieldId: field.id, fieldName: field.name, waterAmount })
    }
    res.json({ success: true, data: generated })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.put('/plans/:id', authMiddleware, requireRole('owner', 'technician'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { startTime, endTime, waterAmount, status, reason } = req.body
    const update: any = {}
    if (startTime !== undefined) update.start_time = startTime
    if (endTime !== undefined) update.end_time = endTime
    if (waterAmount !== undefined) update.water_amount = waterAmount
    if (status !== undefined) update.status = status
    if (reason !== undefined) update.reason = reason
    await db('irrigation_plans').where({ id: req.params.id }).update(update)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/recommendations', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10)
    let fieldsQ = db('fields')
    if (req.user!.role === 'farmer') {
      const fieldRows = await db('user_fields').where({ user_id: req.user!.id })
      const fieldIds = fieldRows.map((r: any) => r.field_id)
      fieldsQ = fieldsQ.whereIn('id', fieldIds)
    }
    const fields = await fieldsQ
    const recommendations = []
    for (const field of fields) {
      const sensor = await db('sensors')
        .where({ field_id: field.id, type: 'soil_moisture', status: 'normal' })
        .first()
      const moisture = sensor ? sensor.value : 50
      const target = CROP_MOISTURE_TARGET[field.crop_type] || 60
      if (moisture < target * 0.85) {
        const bestHour = 5 + (field.id % 4)
        recommendations.push({
          fieldId: field.id,
          fieldName: field.name,
          recommendedTime: `${String(bestHour).padStart(2, '0')}:00-${String(bestHour + 2).padStart(2, '0')}:00`,
          reason: `${field.crop_type}目标湿度${target}%，当前${moisture}%，建议尽早灌溉`,
          expectedSaving: Number(((target - moisture) * 0.1 * field.area).toFixed(1)),
        })
      }
    }
    res.json({ success: true, data: recommendations })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
