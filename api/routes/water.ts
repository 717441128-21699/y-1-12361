import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { authMiddleware, requireRole } from '../middleware/auth.js'

const router = Router()

router.get('/usage', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    let fieldQuery = db('fields')
    if (req.user!.role === 'farmer') {
      const fieldRows = await db('user_fields').where({ user_id: req.user!.id })
      const fieldIds = fieldRows.map((r: any) => r.field_id)
      fieldQuery = fieldQuery.whereIn('id', fieldIds)
    }
    if (req.query.fieldId) fieldQuery = fieldQuery.where({ id: Number(req.query.fieldId) })
    if (req.query.cropType) fieldQuery = fieldQuery.where({ crop_type: req.query.cropType })
    const fields = await fieldQuery
    const result = []
    for (const field of fields) {
      let usageQuery = db('water_usage').where({ field_id: field.id })
      if (req.query.month) {
        const month = req.query.month as string
        usageQuery = usageQuery.whereRaw("strftime('%Y-%m', usage_date) = ?", [month])
      }
      const usage = await usageQuery.orderBy('usage_date', 'asc')
      const dailyUsage = usage.map((u: any) => ({ date: u.usage_date, amount: u.amount }))
      result.push({
        fieldId: field.id,
        fieldName: field.name,
        cropType: field.crop_type,
        monthlyQuota: field.monthly_quota,
        monthlyUsed: field.monthly_used,
        dailyUsage,
      })
    }
    res.json({ success: true, data: result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.put('/quota/:fieldId', authMiddleware, requireRole('owner', 'technician'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { monthlyQuota } = req.body
    if (monthlyQuota === undefined || monthlyQuota < 0) {
      res.status(400).json({ success: false, error: '配额值无效' })
      return
    }
    await db('fields').where({ id: req.params.fieldId }).update({ monthly_quota: monthlyQuota })
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/approve/:fieldId', authMiddleware, requireRole('owner', 'technician'), async (req: Request, res: Response): Promise<void> => {
  try {
    const field = await db('fields').where({ id: req.params.fieldId }).first()
    if (!field) {
      res.status(404).json({ success: false, error: '田块不存在' })
      return
    }
    if (!field.irrigation_suspended) {
      res.status(400).json({ success: false, error: '该田块灌溉权限正常，无需恢复' })
      return
    }
    const { reason } = req.body
    const usedBefore = field.monthly_used
    const quota = field.monthly_quota
    await db('fields').where({ id: req.params.fieldId }).update({
      irrigation_suspended: 0,
      monthly_used: 0,
    })
    await db('approval_records').insert({
      field_id: field.id,
      field_name: field.name,
      approver_id: req.user!.id,
      approver_name: req.user!.username,
      reason: reason || '管理员审批恢复',
      used_before: usedBefore,
      quota,
      created_at: db.fn.now(),
    })
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/approval-history', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    let query = db('approval_records').orderBy('created_at', 'desc')
    if (req.user!.role === 'farmer') {
      const fieldRows = await db('user_fields').where({ user_id: req.user!.id })
      const fieldIds = fieldRows.map((r: any) => r.field_id)
      query = query.whereIn('field_id', fieldIds)
    }
    const records = await query
    const data = records.map((r: any) => ({
      id: r.id,
      fieldId: r.field_id,
      fieldName: r.field_name,
      approverId: r.approver_id,
      approverName: r.approver_name,
      reason: r.reason,
      usedBefore: r.used_before,
      quota: r.quota,
      createdAt: r.created_at,
    }))
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/export', authMiddleware, requireRole('owner', 'technician'), async (req: Request, res: Response): Promise<void> => {
  try {
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7)
    const fields = await db('fields')
    const exportData: any[] = []
    for (const field of fields) {
      const usage = await db('water_usage')
        .where({ field_id: field.id })
        .whereRaw("strftime('%Y-%m', usage_date) = ?", [month])
      const totalUsed = usage.reduce((sum: number, u: any) => sum + u.amount, 0)
      exportData.push({
        fieldName: field.name,
        cropType: field.crop_type,
        area: field.area,
        monthlyQuota: field.monthly_quota,
        monthlyUsed: Number(totalUsed.toFixed(1)),
        utilization: field.monthly_quota > 0 ? Number((totalUsed / field.monthly_quota * 100).toFixed(1)) : 0,
        dailyRecords: usage.map((u: any) => ({ date: u.usage_date, amount: u.amount })),
      })
    }
    res.json({ success: true, data: { month, records: exportData } })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
