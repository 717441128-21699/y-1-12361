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

function transformOrder(o: any, field?: any, assignee?: any, photos?: any[], steps?: any[], parts?: any[]) {
  return {
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
    submittedAt: o.submitted_at,
    completedAt: o.completed_at,
    escalated: o.escalated,
    reviewerId: o.reviewer_id,
    reviewComment: o.review_comment,
    reviewedAt: o.reviewed_at,
    photos: photos ? photos.map((p: any) => p.photo_url) : undefined,
    steps: steps
      ? steps.map((s: any) => ({ id: s.id, step: s.step, createdAt: s.created_at, createdBy: s.created_by }))
      : undefined,
    parts: parts
      ? parts.map((p: any) => ({ id: p.id, partName: p.part_name, quantity: p.quantity, createdAt: p.created_at }))
      : undefined,
  }
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
      result.push(transformOrder(o, field, assignee, photos))
    }
    res.json({ success: true, data: result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/by-device', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, id } = req.query
    if (!type || !id) {
      res.status(400).json({ success: false, error: '缺少type或id参数' })
      return
    }
    const orders = await db('work_orders')
      .where({ device_type: type, device_id: Number(id) })
      .whereNotIn('status', ['completed', 'cancelled'])
      .orderBy('created_at', 'desc')
    const result = []
    for (const o of orders) {
      const assignee = o.assigned_to ? await db('users').where({ id: o.assigned_to }).first() : null
      const field = o.field_id ? await db('fields').where({ id: o.field_id }).first() : null
      result.push(transformOrder(o, field, assignee))
    }
    res.json({ success: true, data: result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const o = await db('work_orders').where({ id: req.params.id }).first()
    if (!o) {
      res.status(404).json({ success: false, error: '工单不存在' })
      return
    }
    const assignee = o.assigned_to ? await db('users').where({ id: o.assigned_to }).first() : null
    const field = o.field_id ? await db('fields').where({ id: o.field_id }).first() : null
    const photos = await db('repair_photos').where({ work_order_id: o.id })
    const steps = await db('work_order_steps').where({ work_order_id: o.id }).orderBy('created_at', 'asc')
    const parts = await db('work_order_parts').where({ work_order_id: o.id }).orderBy('created_at', 'asc')
    res.json({ success: true, data: transformOrder(o, field, assignee, photos, steps, parts) })
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
    const existing = await db('work_orders')
      .where({ device_type: deviceType, device_id: deviceId })
      .whereNotIn('status', ['completed', 'cancelled'])
      .first()
    if (existing) {
      res.status(409).json({ success: false, error: '该设备已有进行中的工单', data: { existingId: existing.id } })
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
      status: 'in_progress',
      assigned_to: req.user!.id,
      accepted_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    })
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/:id/steps', authMiddleware, requireRole('repairman', 'technician', 'owner'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { step } = req.body
    if (!step) {
      res.status(400).json({ success: false, error: '请输入步骤说明' })
      return
    }
    const order = await db('work_orders').where({ id: req.params.id }).first()
    if (!order) {
      res.status(404).json({ success: false, error: '工单不存在' })
      return
    }
    if (order.status !== 'in_progress') {
      res.status(400).json({ success: false, error: '仅进行中的工单可添加步骤' })
      return
    }
    if (order.assigned_to !== req.user!.id && req.user!.role !== 'owner' && req.user!.role !== 'technician') {
      res.status(403).json({ success: false, error: '只有指派的维修人员可添加步骤' })
      return
    }
    await db('work_order_steps').insert({
      work_order_id: Number(req.params.id),
      step,
      created_by: req.user!.id,
    })
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/:id/parts', authMiddleware, requireRole('repairman', 'technician', 'owner'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { partName, quantity } = req.body
    if (!partName || !quantity || quantity <= 0) {
      res.status(400).json({ success: false, error: '请填写正确的配件名称和数量' })
      return
    }
    const order = await db('work_orders').where({ id: req.params.id }).first()
    if (!order) {
      res.status(404).json({ success: false, error: '工单不存在' })
      return
    }
    if (order.status !== 'in_progress') {
      res.status(400).json({ success: false, error: '仅进行中的工单可添加配件' })
      return
    }
    if (order.assigned_to !== req.user!.id && req.user!.role !== 'owner' && req.user!.role !== 'technician') {
      res.status(403).json({ success: false, error: '只有指派的维修人员可添加配件' })
      return
    }
    await db('work_order_parts').insert({
      work_order_id: Number(req.params.id),
      part_name: partName,
      quantity,
    })
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.put('/:id/submit-complete', authMiddleware, requireRole('repairman'), async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await db('work_orders').where({ id: req.params.id }).first()
    if (!order) {
      res.status(404).json({ success: false, error: '工单不存在' })
      return
    }
    if (order.status !== 'in_progress') {
      res.status(400).json({ success: false, error: '仅进行中的工单可提交复核' })
      return
    }
    if (order.assigned_to !== req.user!.id) {
      res.status(403).json({ success: false, error: '只有指派的维修人员可提交复核' })
      return
    }
    const photos = await db('repair_photos').where({ work_order_id: order.id })
    if (photos.length === 0) {
      res.status(400).json({ success: false, error: '请上传至少一张维修配件更换照片后再提交' })
      return
    }
    await db('work_orders').where({ id: req.params.id }).update({
      status: 'submitted',
      submitted_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    })
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.put('/:id/review', authMiddleware, requireRole('owner', 'technician'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { pass, comment } = req.body
    const order = await db('work_orders').where({ id: req.params.id }).first()
    if (!order) {
      res.status(404).json({ success: false, error: '工单不存在' })
      return
    }
    if (order.status !== 'submitted') {
      res.status(400).json({ success: false, error: '仅待复核的工单可进行复核操作' })
      return
    }
    if (pass) {
      await db('work_orders').where({ id: req.params.id }).update({
        status: 'completed',
        completed_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
        reviewer_id: req.user!.id,
        review_comment: comment || '',
        reviewed_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      })
    } else {
      await db('work_orders').where({ id: req.params.id }).update({
        status: 'in_progress',
        reviewer_id: req.user!.id,
        review_comment: comment || '',
        reviewed_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      })
    }
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.put('/:id/upload-photos', authMiddleware, requireRole('repairman', 'technician', 'owner'), async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await db('work_orders').where({ id: req.params.id }).first()
    if (!order) {
      res.status(404).json({ success: false, error: '工单不存在' })
      return
    }
    if (order.status !== 'in_progress') {
      res.status(400).json({ success: false, error: '仅进行中的工单可上传照片' })
      return
    }
    if (!req.body.photos || !Array.isArray(req.body.photos) || req.body.photos.length === 0) {
      res.status(400).json({ success: false, error: '请至少上传一张照片' })
      return
    }
    for (const url of req.body.photos) {
      await db('repair_photos').insert({
        work_order_id: Number(req.params.id),
        photo_url: url,
      })
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
