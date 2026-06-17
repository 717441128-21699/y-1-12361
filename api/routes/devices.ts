import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

function jitter(value: number, pct: number = 0.05): number {
  const delta = value * pct
  return Number((value + (Math.random() * 2 - 1) * delta).toFixed(2))
}

router.get('/sensors', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    let query = db('sensors')
    if (req.query.fieldId) query = query.where({ field_id: Number(req.query.fieldId) })
    if (req.user!.role === 'farmer') {
      const fieldRows = await db('user_fields').where({ user_id: req.user!.id })
      const fieldIds = fieldRows.map((r: any) => r.field_id)
      query = query.whereIn('field_id', fieldIds)
    }
    const sensors = await query
    const data = sensors.map((s: any) => ({
      ...s,
      value: s.status === 'fault' ? s.value : jitter(s.value),
      last_update: new Date().toISOString().replace('T', ' ').slice(0, 19),
    }))
    if (sensors.length > 0) {
      await db('sensors').update({ last_update: new Date().toISOString().replace('T', ' ').slice(0, 19) })
    }
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/valves', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    let query = db('valves')
    if (req.query.fieldId) query = query.where({ field_id: Number(req.query.fieldId) })
    if (req.user!.role === 'farmer') {
      const fieldRows = await db('user_fields').where({ user_id: req.user!.id })
      const fieldIds = fieldRows.map((r: any) => r.field_id)
      query = query.whereIn('field_id', fieldIds)
    }
    const valves = await query
    res.json({ success: true, data: valves })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/pumps', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    let query = db('pumps')
    if (req.query.fieldId) query = query.where({ field_id: Number(req.query.fieldId) })
    if (req.user!.role === 'farmer') {
      const fieldRows = await db('user_fields').where({ user_id: req.user!.id })
      const fieldIds = fieldRows.map((r: any) => r.field_id)
      query = query.whereIn('field_id', fieldIds)
    }
    const pumps = await query
    res.json({ success: true, data: pumps })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/valves/:id/toggle', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const valve = await db('valves').where({ id: req.params.id }).first()
    if (!valve) {
      res.status(404).json({ success: false, error: '阀门不存在' })
      return
    }
    const newStatus = req.body.action === 'open' ? 'open' : req.body.action === 'closed' ? 'closed' : (valve.status === 'open' ? 'closed' : 'open')
    await db('valves').where({ id: req.params.id }).update({
      status: newStatus,
      last_toggle: new Date().toISOString().replace('T', ' ').slice(0, 19),
    })
    res.json({ success: true, data: { id: valve.id, status: newStatus } })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
