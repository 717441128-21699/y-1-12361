import knex from 'knex'
import BetterSqlite3 from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = path.join(__dirname, 'irrigation.db')

const sqliteDb = new BetterSqlite3(DB_PATH)
sqliteDb.pragma('journal_mode = WAL')
sqliteDb.pragma('foreign_keys = ON')

const db = knex({
  client: 'better-sqlite3',
  connection: { filename: DB_PATH },
  useNullAsDefault: true,
})

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function now(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function rand(min: number, max: number, decimals = 1): number {
  const v = Math.random() * (max - min) + min
  return Number(v.toFixed(decimals))
}

async function createTables() {
  await db.schema.dropTableIfExists('repair_photos')
  await db.schema.dropTableIfExists('work_orders')
  await db.schema.dropTableIfExists('water_usage')
  await db.schema.dropTableIfExists('irrigation_plans')
  await db.schema.dropTableIfExists('settings')
  await db.schema.dropTableIfExists('sensors')
  await db.schema.dropTableIfExists('valves')
  await db.schema.dropTableIfExists('pumps')
  await db.schema.dropTableIfExists('user_fields')
  await db.schema.dropTableIfExists('fields')
  await db.schema.dropTableIfExists('users')

  await db.schema.createTable('users', (t) => {
    t.increments('id').primary()
    t.string('username').notNullable().unique()
    t.string('password').notNullable()
    t.string('role').notNullable()
    t.string('status').notNullable().defaultTo('active')
    t.datetime('created_at').defaultTo(db.fn.now())
  })

  await db.schema.createTable('fields', (t) => {
    t.increments('id').primary()
    t.string('name').notNullable()
    t.float('area').notNullable()
    t.string('crop_type').notNullable()
    t.float('monthly_quota').notNullable().defaultTo(0)
    t.float('monthly_used').notNullable().defaultTo(0)
    t.integer('irrigation_suspended').notNullable().defaultTo(0)
    t.integer('grid_x').notNullable().defaultTo(0)
    t.integer('grid_y').notNullable().defaultTo(0)
    t.datetime('created_at').defaultTo(db.fn.now())
  })

  await db.schema.createTable('user_fields', (t) => {
    t.increments('id').primary()
    t.integer('user_id').notNullable().references('id').inTable('users')
    t.integer('field_id').notNullable().references('id').inTable('fields')
    t.unique(['user_id', 'field_id'])
  })

  await db.schema.createTable('sensors', (t) => {
    t.increments('id').primary()
    t.integer('field_id').notNullable().references('id').inTable('fields')
    t.string('type').notNullable()
    t.float('value').notNullable().defaultTo(0)
    t.string('unit').notNullable()
    t.string('status').notNullable().defaultTo('normal')
    t.datetime('last_update').defaultTo(db.fn.now())
  })

  await db.schema.createTable('valves', (t) => {
    t.increments('id').primary()
    t.integer('field_id').notNullable().references('id').inTable('fields')
    t.string('name').notNullable()
    t.string('status').notNullable().defaultTo('closed')
    t.float('flow_rate').notNullable().defaultTo(0)
    t.float('pressure').notNullable().defaultTo(0)
    t.datetime('last_toggle')
  })

  await db.schema.createTable('pumps', (t) => {
    t.increments('id').primary()
    t.integer('field_id').notNullable().references('id').inTable('fields')
    t.string('name').notNullable()
    t.string('status').notNullable().defaultTo('stopped')
    t.float('today_runtime').notNullable().defaultTo(0)
    t.float('total_runtime').notNullable().defaultTo(0)
    t.datetime('last_maintenance')
  })

  await db.schema.createTable('irrigation_plans', (t) => {
    t.increments('id').primary()
    t.integer('field_id').notNullable().references('id').inTable('fields')
    t.integer('valve_id').notNullable().references('id').inTable('valves')
    t.date('plan_date').notNullable()
    t.datetime('start_time').notNullable()
    t.datetime('end_time').notNullable()
    t.float('water_amount').notNullable()
    t.string('status').notNullable().defaultTo('pending')
    t.string('reason')
    t.datetime('created_at').defaultTo(db.fn.now())
  })

  await db.schema.createTable('water_usage', (t) => {
    t.increments('id').primary()
    t.integer('field_id').notNullable().references('id').inTable('fields')
    t.date('usage_date').notNullable()
    t.float('amount').notNullable()
    t.datetime('created_at').defaultTo(db.fn.now())
  })

  await db.schema.createTable('work_orders', (t) => {
    t.increments('id').primary()
    t.string('type').notNullable()
    t.integer('device_id').notNullable()
    t.string('device_type').notNullable()
    t.integer('field_id').references('id').inTable('fields')
    t.string('description').notNullable()
    t.string('urgency').notNullable()
    t.string('status').notNullable().defaultTo('pending')
    t.integer('assigned_to').references('id').inTable('users')
    t.datetime('created_at').defaultTo(db.fn.now())
    t.datetime('accepted_at')
    t.datetime('completed_at')
    t.integer('escalated').notNullable().defaultTo(0)
  })

  await db.schema.createTable('repair_photos', (t) => {
    t.increments('id').primary()
    t.integer('work_order_id').notNullable().references('id').inTable('work_orders')
    t.string('photo_url').notNullable()
    t.datetime('uploaded_at').defaultTo(db.fn.now())
  })

  await db.schema.createTable('settings', (t) => {
    t.increments('id').primary()
    t.string('key').notNullable().unique()
    t.string('value').notNullable()
    t.datetime('updated_at').defaultTo(db.fn.now())
  })

  await db.schema.createTable('approval_records', (t) => {
    t.increments('id').primary()
    t.integer('field_id').notNullable().references('id').inTable('fields')
    t.string('field_name').notNullable()
    t.integer('approver_id').notNullable().references('id').inTable('users')
    t.string('approver_name').notNullable()
    t.string('reason').notNullable()
    t.float('used_before').notNullable().defaultTo(0)
    t.float('quota').notNullable().defaultTo(0)
    t.datetime('created_at').defaultTo(db.fn.now())
  })
}

async function seedData() {
  const hash = (pw: string) => bcrypt.hashSync(pw, 10)

  await db('users').insert([
    { id: 1, username: 'owner', password: hash('owner123'), role: 'owner', status: 'active' },
    { id: 2, username: 'technician', password: hash('tech123'), role: 'technician', status: 'active' },
    { id: 3, username: 'repairman', password: hash('repair123'), role: 'repairman', status: 'active' },
    { id: 4, username: 'farmer', password: hash('farmer123'), role: 'farmer', status: 'active' },
  ])

  await db('fields').insert([
    { id: 1, name: '东区小麦田', area: 120, crop_type: '小麦', monthly_quota: 3600, monthly_used: 2100, grid_x: 2, grid_y: 1 },
    { id: 2, name: '西区玉米田', area: 85, crop_type: '玉米', monthly_quota: 2800, monthly_used: 1950, grid_x: 0, grid_y: 1 },
    { id: 3, name: '南区水稻田', area: 150, crop_type: '水稻', monthly_quota: 5000, monthly_used: 3800, grid_x: 1, grid_y: 2 },
    { id: 4, name: '北区大豆田', area: 60, crop_type: '大豆', monthly_quota: 1800, monthly_used: 900, grid_x: 1, grid_y: 0 },
    { id: 5, name: '中区蔬菜田', area: 45, crop_type: '蔬菜', monthly_quota: 1500, monthly_used: 1200, grid_x: 1, grid_y: 1 },
    { id: 6, name: '东南小麦田', area: 95, crop_type: '小麦', monthly_quota: 3000, monthly_used: 1800, grid_x: 2, grid_y: 2 },
    { id: 7, name: '西北玉米田', area: 110, crop_type: '玉米', monthly_quota: 3500, monthly_used: 2200, grid_x: 0, grid_y: 0 },
    { id: 8, name: '西南水稻田', area: 130, crop_type: '水稻', monthly_quota: 4500, monthly_used: 3200, grid_x: 0, grid_y: 2 },
  ])

  await db('user_fields').insert([
    { user_id: 4, field_id: 1 },
    { user_id: 4, field_id: 4 },
    { user_id: 4, field_id: 5 },
  ])

  const sensorData: any[] = []
  const sensorTypes = [
    { type: 'soil_moisture', unit: '%', min: 20, max: 80 },
    { type: 'temperature', unit: '°C', min: 15, max: 35 },
    { type: 'flow_rate', unit: 'L/min', min: 0, max: 50 },
    { type: 'pressure', unit: 'MPa', min: 0.2, max: 0.8 },
  ]
  for (let fieldId = 1; fieldId <= 8; fieldId++) {
    for (const st of sensorTypes) {
      const count = st.type === 'soil_moisture' ? 2 : 1
      for (let j = 0; j < count; j++) {
        sensorData.push({
          field_id: fieldId,
          type: st.type,
          value: rand(st.min, st.max),
          unit: st.unit,
          status: Math.random() > 0.9 ? 'fault' : 'normal',
          last_update: now(),
        })
      }
    }
  }
  await db('sensors').insert(sensorData)

  const valveData: any[] = []
  for (let fieldId = 1; fieldId <= 8; fieldId++) {
    valveData.push(
      { field_id: fieldId, name: `${fieldId}号田主阀门`, status: 'closed', flow_rate: rand(10, 40), pressure: rand(0.3, 0.7), last_toggle: now() },
      { field_id: fieldId, name: `${fieldId}号田副阀门`, status: 'closed', flow_rate: rand(5, 30), pressure: rand(0.3, 0.7), last_toggle: now() },
    )
  }
  await db('valves').insert(valveData)

  const pumpData: any[] = []
  const pumpNames = ['一号泵站', '二号泵站', '三号泵站', '四号泵站', '五号泵站', '六号泵站']
  const pumpFields = [
    [1, 2], [3, 4], [5, 6], [7, 8], [1, 3, 5], [2, 4, 6, 7, 8]
  ]
  for (let i = 0; i < 6; i++) {
    pumpData.push({
      field_id: pumpFields[i][0],
      name: pumpNames[i],
      status: i < 2 ? 'running' : 'stopped',
      today_runtime: rand(2, 8),
      total_runtime: rand(200, 1500),
      last_maintenance: daysAgo(rand(10, 60, 0)),
    })
  }
  await db('pumps').insert(pumpData)

  const td = today()
  const planData: any[] = []
  const planStatuses = ['pending', 'running', 'completed', 'completed', 'pending']
  for (let fieldId = 1; fieldId <= 8; fieldId++) {
    const valve = await db('valves').where({ field_id: fieldId }).first()
    const startHour = 5 + (fieldId - 1) % 4
    planData.push({
      field_id: fieldId,
      valve_id: valve.id,
      plan_date: td,
      start_time: `${td} ${String(startHour).padStart(2, '0')}:00:00`,
      end_time: `${td} ${String(startHour + 2).padStart(2, '0')}:00:00`,
      water_amount: rand(80, 300),
      status: planStatuses[(fieldId - 1) % planStatuses.length],
      reason: null,
    })
  }
  await db('irrigation_plans').insert(planData)

  const waterData: any[] = []
  for (let fieldId = 1; fieldId <= 8; fieldId++) {
    for (let d = 0; d < 30; d++) {
      waterData.push({
        field_id: fieldId,
        usage_date: daysAgo(d),
        amount: rand(30, 200),
      })
    }
  }
  await db('water_usage').insert(waterData)

  const orderData: any[] = [
    { id: 1, type: 'sensor_fault', device_id: 3, device_type: 'sensor', field_id: 1, description: '土壤湿度传感器读数异常，数据波动较大', urgency: 'high', status: 'pending', assigned_to: 3, created_at: `${daysAgo(0)} 08:30:00`, escalated: 0 },
    { id: 2, type: 'valve_stuck', device_id: 5, device_type: 'valve', field_id: 3, description: '3号田主阀门无法关闭，持续漏水', urgency: 'high', status: 'accepted', assigned_to: 3, created_at: `${daysAgo(0)} 07:15:00`, accepted_at: `${daysAgo(0)} 08:00:00`, escalated: 0 },
    { id: 3, type: 'pump_maintenance', device_id: 2, device_type: 'pump', field_id: 3, description: '二号泵站运行噪音增大，需要检查轴承', urgency: 'medium', status: 'in_progress', assigned_to: 3, created_at: `${daysAgo(1)} 10:00:00`, accepted_at: `${daysAgo(1)} 11:00:00`, escalated: 0 },
    { id: 4, type: 'sensor_fault', device_id: 7, device_type: 'sensor', field_id: 2, description: '温度传感器无数据返回', urgency: 'low', status: 'completed', assigned_to: 3, created_at: `${daysAgo(3)} 09:00:00`, accepted_at: `${daysAgo(3)} 10:30:00`, completed_at: `${daysAgo(2)} 16:00:00`, escalated: 0 },
    { id: 5, type: 'pipe_leak', device_id: 10, device_type: 'valve', field_id: 5, description: '5号田灌溉管道接口处漏水', urgency: 'medium', status: 'pending', assigned_to: 3, created_at: `${daysAgo(0)} 06:00:00`, escalated: 1 },
    { id: 6, type: 'pump_fault', device_id: 4, device_type: 'pump', field_id: 7, description: '四号泵站启动后自动停机', urgency: 'high', status: 'pending', assigned_to: 3, created_at: `${daysAgo(0)} 05:00:00`, escalated: 1 },
  ]
  await db('work_orders').insert(orderData)

  await db('repair_photos').insert([
    { work_order_id: 4, photo_url: '/uploads/repair/2024-01/sensor_fix_01.jpg', uploaded_at: `${daysAgo(2)} 15:30:00` },
    { work_order_id: 4, photo_url: '/uploads/repair/2024-01/sensor_fix_02.jpg', uploaded_at: `${daysAgo(2)} 15:45:00` },
  ])

  await db('settings').insert([
    { key: 'irrigation_window', value: JSON.stringify({ start: '05:00', end: '22:00' }) },
    { key: 'optimal_time_weights', value: JSON.stringify({ soil_moisture: 0.4, temperature: 0.2, crop_type: 0.3, weather: 0.1 }) },
    { key: 'auto_escalation_hours', value: '2' },
  ])
}

export async function initDatabase() {
  let tablesExist = false
  try {
    const hasUsers = await db('users').count('* as cnt').first()
    tablesExist = Number(hasUsers!.cnt) > 0
    if (!tablesExist) {
      throw new Error('need to create')
    }
  } catch {
    await createTables()
    await seedData()
    console.log('Database initialized with seed data')
    return
  }

  try {
    await db.schema.hasTable('approval_records').then(async (exists) => {
      if (!exists) {
        await db.schema.createTable('approval_records', (t) => {
          t.increments('id').primary()
          t.integer('field_id').notNullable().references('id').inTable('fields')
          t.string('field_name').notNullable()
          t.integer('approver_id').notNullable().references('id').inTable('users')
          t.string('approver_name').notNullable()
          t.string('reason').notNullable()
          t.float('used_before').notNullable().defaultTo(0)
          t.float('quota').notNullable().defaultTo(0)
          t.datetime('created_at').defaultTo(db.fn.now())
        })
      }
    })
  } catch {
    // ignore migration errors
  }
}

export default db
