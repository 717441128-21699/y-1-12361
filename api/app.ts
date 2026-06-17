import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { initDatabase } from './db.js'
import authRoutes from './routes/auth.js'
import fieldRoutes from './routes/fields.js'
import deviceRoutes from './routes/devices.js'
import irrigationRoutes from './routes/irrigation.js'
import workorderRoutes from './routes/workorders.js'
import waterRoutes from './routes/water.js'
import dashboardRoutes from './routes/dashboard.js'
import settingsRoutes from './routes/settings.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api/auth', authRoutes)
app.use('/api/fields', fieldRoutes)
app.use('/api/devices', deviceRoutes)
app.use('/api/irrigation', irrigationRoutes)
app.use('/api/workorders', workorderRoutes)
app.use('/api/water', waterRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/settings', settingsRoutes)

app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

initDatabase().catch((err) => {
  console.error('Failed to initialize database:', err)
})

export default app
