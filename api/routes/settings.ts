import { Router, type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import db from '../db.js'
import { authMiddleware, requireRole } from '../middleware/auth.js'

const router = Router()

router.get('/users', authMiddleware, requireRole('owner'), async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await db('users').select('id', 'username', 'role', 'status', 'created_at')
    const result = []
    for (const u of users) {
      const fieldRows = await db('user_fields').where({ user_id: u.id })
      result.push({
        ...u,
        fieldIds: fieldRows.map((r: any) => r.field_id),
      })
    }
    res.json({ success: true, data: result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/users', authMiddleware, requireRole('owner'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password, role, fieldIds } = req.body
    if (!username || !password || !role) {
      res.status(400).json({ success: false, error: '缺少必要字段' })
      return
    }
    const existing = await db('users').where({ username }).first()
    if (existing) {
      res.status(409).json({ success: false, error: '用户名已存在' })
      return
    }
    const hashed = bcrypt.hashSync(password, 10)
    const [id] = await db('users').insert({ username, password: hashed, role })
    if (fieldIds && Array.isArray(fieldIds) && role === 'farmer') {
      for (const fid of fieldIds) {
        await db('user_fields').insert({ user_id: id, field_id: fid })
      }
    }
    res.json({ success: true, data: { id } })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.put('/users/:id', authMiddleware, requireRole('owner'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { role, fieldIds, status } = req.body
    const update: any = {}
    if (role !== undefined) update.role = role
    if (status !== undefined) update.status = status
    if (Object.keys(update).length > 0) {
      await db('users').where({ id: req.params.id }).update(update)
    }
    if (fieldIds && Array.isArray(fieldIds)) {
      await db('user_fields').where({ user_id: Number(req.params.id) }).delete()
      for (const fid of fieldIds) {
        await db('user_fields').insert({ user_id: Number(req.params.id), field_id: fid })
      }
    }
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/rules', authMiddleware, requireRole('owner'), async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await db('settings')
    const result: any = {}
    for (const s of settings) {
      try {
        result[s.key] = JSON.parse(s.value)
      } catch {
        result[s.key] = s.value
      }
    }
    res.json({ success: true, data: result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.put('/rules', authMiddleware, requireRole('owner'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { irrigationWindow, optimalTimeWeights, autoEscalationHours } = req.body
    if (irrigationWindow !== undefined) {
      await db('settings').where({ key: 'irrigation_window' }).update({
        value: JSON.stringify(irrigationWindow),
        updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      })
    }
    if (optimalTimeWeights !== undefined) {
      await db('settings').where({ key: 'optimal_time_weights' }).update({
        value: JSON.stringify(optimalTimeWeights),
        updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      })
    }
    if (autoEscalationHours !== undefined) {
      await db('settings').where({ key: 'auto_escalation_hours' }).update({
        value: String(autoEscalationHours),
        updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      })
    }
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
