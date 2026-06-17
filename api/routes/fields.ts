import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { authMiddleware, requireRole } from '../middleware/auth.js'

const router = Router()

router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    let query = db('fields')
    if (req.user!.role === 'farmer') {
      const fieldRows = await db('user_fields').where({ user_id: req.user!.id })
      const fieldIds = fieldRows.map((r: any) => r.field_id)
      query = query.whereIn('id', fieldIds)
    }
    const fields = await query
    const result = []
    for (const f of fields) {
      const sensorCount = await db('sensors').where({ field_id: f.id }).count('* as cnt').first()
      const valveCount = await db('valves').where({ field_id: f.id }).count('* as cnt').first()
      const pumpCount = await db('pumps').where({ field_id: f.id }).count('* as cnt').first()
      const soilSensor = await db('sensors')
        .where({ field_id: f.id, type: 'soil_moisture' })
        .orderBy('last_update', 'desc')
        .first()
      const plans = await db('irrigation_plans')
        .where({ field_id: f.id })
        .where('plan_date', new Date().toISOString().slice(0, 10))
      const runningPlan = plans.find((p: any) => p.status === 'running')
      let irrigationStatus = 'idle'
      if (runningPlan) irrigationStatus = 'irrigating'
      else if (plans.some((p: any) => p.status === 'pending')) irrigationStatus = 'scheduled'
      result.push({
        id: f.id,
        name: f.name,
        area: f.area,
        cropType: f.crop_type,
        soilMoisture: soilSensor ? soilSensor.value : null,
        irrigationStatus,
        deviceCount: Number(sensorCount!.cnt) + Number(valveCount!.cnt) + Number(pumpCount!.cnt),
        monthlyQuota: f.monthly_quota,
        monthlyUsed: f.monthly_used,
        irrigationSuspended: f.irrigation_suspended,
      })
    }
    res.json({ success: true, data: result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const field = await db('fields').where({ id: req.params.id }).first()
    if (!field) {
      res.status(404).json({ success: false, error: '田块不存在' })
      return
    }
    if (req.user!.role === 'farmer') {
      const uf = await db('user_fields').where({ user_id: req.user!.id, field_id: field.id }).first()
      if (!uf) {
        res.status(403).json({ success: false, error: '无权访问此田块' })
        return
      }
    }
    const sensors = await db('sensors').where({ field_id: field.id })
    const valves = await db('valves').where({ field_id: field.id })
    const pumps = await db('pumps').where({ field_id: field.id })
    res.json({
      success: true,
      data: {
        id: field.id,
        name: field.name,
        area: field.area,
        cropType: field.crop_type,
        monthlyQuota: field.monthly_quota,
        monthlyUsed: field.monthly_used,
        irrigationSuspended: field.irrigation_suspended,
        gridX: field.grid_x,
        gridY: field.grid_y,
        sensors,
        valves,
        pumps,
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/', authMiddleware, requireRole('owner', 'technician'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, area, cropType, monthlyQuota } = req.body
    if (!name || !area || !cropType) {
      res.status(400).json({ success: false, error: '缺少必要字段' })
      return
    }
    const [id] = await db('fields').insert({
      name,
      area,
      crop_type: cropType,
      monthly_quota: monthlyQuota || 0,
    })
    res.json({ success: true, data: { id } })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.put('/:id', authMiddleware, requireRole('owner', 'technician'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, area, cropType, monthlyQuota } = req.body
    const update: any = {}
    if (name !== undefined) update.name = name
    if (area !== undefined) update.area = area
    if (cropType !== undefined) update.crop_type = cropType
    if (monthlyQuota !== undefined) update.monthly_quota = monthlyQuota
    await db('fields').where({ id: req.params.id }).update(update)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.delete('/:id', authMiddleware, requireRole('owner'), async (req: Request, res: Response): Promise<void> => {
  try {
    await db('fields').where({ id: req.params.id }).delete()
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
