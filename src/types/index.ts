export type UserRole = 'farmer' | 'technician' | 'repairman' | 'owner'
export type DeviceStatus = 'normal' | 'fault' | 'offline'
export type ValveStatus = 'open' | 'closed'
export type PumpStatus = 'running' | 'stopped' | 'fault'
export type PlanStatus = 'pending' | 'running' | 'completed' | 'cancelled'
export type WorkOrderStatus = 'pending' | 'accepted' | 'in_progress' | 'submitted' | 'completed'

export interface WorkOrderStep {
  id: number
  step: string
  createdAt: string
  createdBy: number
}

export interface WorkOrderPart {
  id: number
  partName: string
  quantity: number
  createdAt: string
}
export type Urgency = 'low' | 'medium' | 'high'

export interface User {
  id: number
  username: string
  role: UserRole
  status: string
  fieldIds?: number[]
}

export interface Field {
  id: number
  name: string
  area: number
  cropType: string
  soilMoisture: number
  monthlyQuota: number
  monthlyUsed: number
  irrigationSuspended: boolean
  deviceCount: number
  gridX: number
  gridY: number
}

export interface FieldDetail extends Field {
  sensors: Sensor[]
  valves: Valve[]
  pumps: Pump[]
}

export interface Sensor {
  id: number
  fieldId: number
  type: string
  value: number
  unit: string
  status: string
  lastUpdate: string
}

export interface Valve {
  id: number
  fieldId: number
  name: string
  status: ValveStatus
  flowRate: number
  pressure: number
  lastToggle: string
}

export interface Pump {
  id: number
  fieldId: number
  name: string
  status: PumpStatus
  todayRuntime: number
  totalRuntime: number
  lastMaintenance: string
}

export interface IrrigationPlan {
  id: number
  fieldId: number
  fieldName: string
  valveId: number
  startTime: string
  endTime: string
  waterAmount: number
  status: PlanStatus
  reason?: string
}

export interface IrrigationRecommendation {
  fieldId: number
  fieldName: string
  recommendedTime: string
  reason: string
  expectedSaving: number
}

export interface WorkOrder {
  id: number
  type: string
  deviceId: number
  deviceType: string
  fieldId: number
  fieldName: string
  description: string
  urgency: Urgency
  status: WorkOrderStatus
  assignedTo: number
  assigneeName: string
  createdAt: string
  acceptedAt?: string
  submittedAt?: string
  completedAt?: string
  escalated: boolean
  photos: string[]
  steps?: WorkOrderStep[]
  parts?: WorkOrderPart[]
  reviewerId?: number
  reviewComment?: string
  reviewedAt?: string
}

export interface WaterUsage {
  fieldId: number
  fieldName: string
  cropType: string
  monthlyQuota: number
  monthlyUsed: number
  dailyUsage: { date: string; amount: number }[]
}

export interface DashboardData {
  heatmap: HeatmapItem[]
  progress: ProgressItem[]
  faults: FaultItem[]
  efficiency: EfficiencyData
}

export interface HeatmapItem {
  fieldId: number
  fieldName: string
  x: number
  y: number
  moisture: number
}

export interface ProgressItem {
  fieldId: number
  fieldName: string
  progress: number
  status: string
}

export interface FaultItem {
  deviceType: string
  count: number
}

export interface EfficiencyData {
  overallRate: number
  fieldRates: { fieldId: number; fieldName: string; rate: number }[]
}

export interface SettingsRules {
  irrigationWindow: { start: string; end: string }
  optimalTimeWeights: Record<string, number>
  autoEscalationHours: number
}
