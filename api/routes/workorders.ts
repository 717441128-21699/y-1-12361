import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { authMiddleware, requireRole } from '../middleware/auth.js'

const router = Router()

async function checkAutoEscalation() {
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19)
  await db('work_orders')
    .where({ status: 'pending', escalated: 0 })
    .where('created_at', '<', cutoff)
    .update({ escalated: 1 })
}

router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    await checkAutoEscalation()
    let query = db('work_orders')
    if (req.query.status) query = query.where({ status: req.query.status })
    if (req.query.assignedTo) query = query.where({ assigned_to: Number(req.query.assignedTo) })
    if (req.user!.role === 'farmer') {
      const fieldRows = await db('user_fields').where({ user_id: req.user!.id })
      const fieldIds = fieldRows.map((r: any) => r.field_id)
      query = query.whereIn('field_id', fieldIds)
    }
    if (req.user!.role === 'repairman') {
      query = query.where({ assigned_to: req.user!.id })
    }
    const orders = await query.orderBy('created_at', 'desc')
    const result = []
    for (const o of orders) {
      const assignee = o.assigned_to ? await db('users').where({ id: o.assigned_to }).first() : null
      const field = o.field_id ? await db('fields').where({ id: o.field_id }).first() : null
      const photos = await db('repair_photos').where({ work_order_id: o.id })
      result.push({
        id: o.id,
        type: o.type,
        deviceId: o.device_id,
        deviceType: o.device_type,
        fieldId: o.field_id,
        fieldName: field?.name || '',
        description: o.description,
        urgency: o.urgency,
        status: o.status,
        assignedTo: o.assigned_to,
        assigneeName: assignee?.username || '',
        createdAt: o.created_at,
        acceptedAt: o.accepted_at,
        completedAt: o.completed_at,
        escalated: o.escalated,
        photos: photos.map((p: any) => p.photo_url),
      })
    }
    res.json({ success: true, data: result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/', authMiddleware, requireRole('owner', 'technician'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, deviceId, deviceType, fieldId, description, urgency } = req.body
    if (!type || !deviceId || !description) {
      res.status(400).json({ success: false, error: '缺少必要字段' })
      return
    }
    const repairmen = await db('users').where({ role: 'repairman', status: 'active' })
    const assignedTo = repairmen.length > 0 ? repairmen[0].id : null
    const [id] = await db('work_orders').insert({
      type,
      device_id: deviceId,
      device_type: deviceType || 'unknown',
      field_id: fieldId || null,
      description,
      urgency: urgency || 'medium',
      status: 'pending',
      assigned_to: assignedTo,
    })
    res.json({ success: true, data: { id } })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.put('/:id/accept', authMiddleware, requireRole('repairman'), async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await db('work_orders').where({ id: req.params.id }).first()
    if (!order) {
      res.status(404).json({ success: false, error: '工单不存在' })
      return
    }
    if (order.status !== 'pending') {
      res.status(400).json({ success: false, error: '工单状态不允许接受' })
      return
    }
    await db('work_orders').where({ id: req.params.id }).update({
      status: 'accepted',
      assigned_to: req.user!.id,
      accepted_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    })
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.put('/:id/complete', authMiddleware, requireRole('repairman'), async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await db('work_orders').where({ id: req.params.id }).first()
    if (!order) {
      res.status(404).json({ success: false, error: '工单不存在' })
      return
    }
    if (order.status !== 'accepted' && order.status !== 'in_progress') {
      res.status(400).json({ success: false, error: '工单状态不允许完成' })
      return
    }
    await db('work_orders').where({ id: req.params.id }).update({
      status: 'completed',
      completed_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    })
    if (req.body.photos && Array.isArray(req.body.photos)) {
      for (const url of req.body.photos) {
        await db('repair_photos').insert({
          work_order_id: Number(req.params.id),
          photo_url: url,
        })
      }
    }
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.put('/:id/escalate', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await db('work_orders').where({ id: req.params.id }).first()
    if (!order) {
      res.status(404).json({ success: false, error: '工单不存在' })
      return
    }
    await db('work_orders').where({ id: req.params.id }).update({ escalated: 1 })
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
