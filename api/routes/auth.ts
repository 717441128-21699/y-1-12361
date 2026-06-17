import { Router, type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import db from '../db.js'
import { authMiddleware, JWT_SECRET } from '../middleware/auth.js'

const router = Router()

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      res.status(400).json({ success: false, error: '请提供用户名和密码' })
      return
    }
    const user = await db('users').where({ username }).first()
    if (!user || !bcrypt.compareSync(password, user.password)) {
      res.status(401).json({ success: false, error: '用户名或密码错误' })
      return
    }
    if (user.status !== 'active') {
      res.status(403).json({ success: false, error: '账号已被禁用' })
      return
    }
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    )
    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, username: user.username, role: user.role },
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await db('users').where({ id: req.user!.id }).first()
    if (!user) {
      res.status(404).json({ success: false, error: '用户不存在' })
      return
    }
    const fieldRows = await db('user_fields').where({ user_id: user.id })
    const fieldIds = fieldRows.map((r: any) => r.field_id)
    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        role: user.role,
        fieldIds,
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
