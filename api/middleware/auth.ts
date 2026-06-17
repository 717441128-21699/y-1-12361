import { type Request, type Response, type NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = 'smart-irrigation-secret-2024'

export interface AuthUser {
  id: number
  username: string
  role: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: '未提供认证令牌' })
    return
  }
  const token = header.slice(7)
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser
    req.user = decoded
    next()
  } catch {
    res.status(401).json({ success: false, error: '令牌无效或已过期' })
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: '未认证' })
      return
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: '权限不足' })
      return
    }
    next()
  }
}

export { JWT_SECRET }
