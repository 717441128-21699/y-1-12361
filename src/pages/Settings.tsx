import { useState, useEffect } from 'react'
import { Settings, Users, Droplets, Clock, Plus, Pencil, ToggleLeft, ToggleRight, RotateCcw, Save } from 'lucide-react'
import { settings as settingsApi, fields as fieldsApi, water } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import type { User, Field, UserRole, SettingsRules } from '@/types'

type Tab = 'users' | 'quota' | 'rules'

const ROLE_LABELS: Record<UserRole, { label: string; cls: string }> = {
  owner: { label: '农场主', cls: 'bg-purple-50 text-purple-600' },
  technician: { label: '技术员', cls: 'bg-sky-50 text-sky-600' },
  repairman: { label: '维修工', cls: 'bg-amber-50 text-amber-600' },
  farmer: { label: '农户', cls: 'bg-emerald-50 text-emerald-600' },
}

const DEFAULT_RULES: SettingsRules = {
  irrigationWindow: { start: '18:00', end: '06:00' },
  optimalTimeWeights: { '00-06': 3, '06-12': 1, '12-18': 1, '18-24': 2 },
  autoEscalationHours: 2,
}

const TIME_PERIOD_LABELS: Record<string, string> = {
  '00-06': '凌晨(00-06)', '06-12': '上午(06-12)', '12-18': '下午(12-18)', '18-24': '夜间(18-24)',
}

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user)
  const [tab, setTab] = useState<Tab>('users')
  const [users, setUsers] = useState<User[]>([])
  const [allFields, setAllFields] = useState<Field[]>([])
  const [rules, setRules] = useState<SettingsRules>(DEFAULT_RULES)
  const [loading, setLoading] = useState(true)
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'farmer' as UserRole, fieldIds: [] as number[], status: 'active' })

  if (user?.role !== 'owner') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-400">
          <Settings className="w-12 h-12 mx-auto mb-2" />
          <p>仅农场主可访问系统设置</p>
        </div>
      </div>
    )
  }

  useEffect(() => {
    Promise.all([settingsApi.listUsers(), fieldsApi.list(), settingsApi.getRules()])
      .then(([u, f, r]) => { setUsers(u); setAllFields(f); if (r) setRules(r) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const openAddUser = () => {
    setEditingUser(null)
    setUserForm({ username: '', password: '', role: 'farmer', fieldIds: [], status: 'active' })
    setShowUserModal(true)
  }

  const openEditUser = (u: User) => {
    setEditingUser(u)
    setUserForm({ username: u.username, password: '', role: u.role, fieldIds: u.fieldIds ?? [], status: u.status })
    setShowUserModal(true)
  }

  const handleSaveUser = async () => {
    if (editingUser) {
      await settingsApi.updateUser(editingUser.id, { role: userForm.role, fieldIds: userForm.fieldIds, status: userForm.status })
    } else {
      await settingsApi.createUser({ username: userForm.username, password: userForm.password, role: userForm.role, fieldIds: userForm.fieldIds })
    }
    setShowUserModal(false)
    settingsApi.listUsers().then(setUsers)
  }

  const toggleUserStatus = async (u: User) => {
    const newStatus = u.status === 'active' ? 'disabled' : 'active'
    await settingsApi.updateUser(u.id, { status: newStatus })
    settingsApi.listUsers().then(setUsers)
  }

  const handleSaveRules = async () => {
    await settingsApi.updateRules(rules)
  }

  const handleResetRules = () => setRules(DEFAULT_RULES)

  const toggleFieldId = (id: number) => {
    setUserForm((f) => ({
      ...f,
      fieldIds: f.fieldIds.includes(id) ? f.fieldIds.filter((i) => i !== id) : [...f.fieldIds, id],
    }))
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-10 w-48 bg-gray-200 rounded animate-pulse mb-6" />
        <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold text-gray-800">系统设置</h1>
      </div>

      <div className="flex bg-gray-100 rounded-lg p-0.5 mb-4 w-fit">
        {([['users', '用户管理', Users], ['quota', '配额配置', Droplets], ['rules', '排程规则', Clock]] as const).map(([val, label, Icon]) => (
          <button key={val} onClick={() => setTab(val)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === val ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <span className="font-semibold">用户列表</span>
            <button onClick={openAddUser} className="btn-primary gap-1"><Plus className="w-4 h-4" /> 新增用户</button>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>用户名</th><th>角色</th><th>分配田块</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium">{u.username}</td>
                    <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_LABELS[u.role].cls}`}>{ROLE_LABELS[u.role].label}</span></td>
                    <td className="text-xs text-gray-500">{u.role === 'farmer' ? (u.fieldIds ?? []).map((id) => allFields.find((f) => f.id === id)?.name ?? `#${id}`).join(', ') || '-' : '-'}</td>
                    <td><span className={u.status === 'active' ? 'badge-green' : 'badge-red'}>{u.status === 'active' ? '启用' : '禁用'}</span></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditUser(u)} className="text-gray-400 hover:text-primary"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => toggleUserStatus(u)} className="text-gray-400 hover:text-primary">
                          {u.status === 'active' ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'quota' && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <span className="font-semibold">配额配置</span>
            <button onClick={() => { allFields.forEach((f) => water.updateQuota(f.id, f.area * 50)) }} className="btn-secondary text-xs">批量重置默认</button>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>田块</th><th>作物</th><th>已用/配额(m³)</th><th>月配额</th><th>操作</th></tr></thead>
              <tbody>
                {allFields.map((f) => <QuotaRow key={f.id} field={f} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'rules' && (
        <div className="card max-w-2xl">
          <div className="card-body space-y-6">
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">灌溉时段窗口</h3>
              <div className="flex items-center gap-3">
                <input type="time" value={rules.irrigationWindow.start} onChange={(e) => setRules({ ...rules, irrigationWindow: { ...rules.irrigationWindow, start: e.target.value } })} className="form-input w-32" />
                <span className="text-gray-400">至</span>
                <input type="time" value={rules.irrigationWindow.end} onChange={(e) => setRules({ ...rules, irrigationWindow: { ...rules.irrigationWindow, end: e.target.value } })} className="form-input w-32" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">最优时段权重</h3>
              <div className="space-y-3">
                {Object.entries(rules.optimalTimeWeights).map(([period, weight]) => (
                  <div key={period} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-28">{TIME_PERIOD_LABELS[period]}</span>
                    <input type="range" min={0} max={5} step={0.5} value={weight}
                      onChange={(e) => setRules({ ...rules, optimalTimeWeights: { ...rules.optimalTimeWeights, [period]: Number(e.target.value) } })}
                      className="flex-1" />
                    <span className="text-sm font-medium w-8 text-right">{weight}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">自动升级时长</h3>
              <div className="flex items-center gap-2">
                <input type="number" value={rules.autoEscalationHours} min={0.5} step={0.5}
                  onChange={(e) => setRules({ ...rules, autoEscalationHours: Number(e.target.value) })}
                  className="form-input w-24" />
                <span className="text-sm text-gray-500">小时</span>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSaveRules} className="btn-primary gap-1"><Save className="w-4 h-4" /> 保存规则</button>
              <button onClick={handleResetRules} className="btn-secondary gap-1"><RotateCcw className="w-4 h-4" /> 恢复默认</button>
            </div>
          </div>
        </div>
      )}

      {showUserModal && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center" onClick={() => setShowUserModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{editingUser ? '编辑用户' : '新增用户'}</h3>
            <div className="space-y-3">
              <div><label className="form-label">用户名</label>
                <input value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  className="form-input" disabled={!!editingUser} /></div>
              {!editingUser && <div><label className="form-label">密码</label>
                <input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="form-input" /></div>}
              <div><label className="form-label">角色</label>
                <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value as UserRole })} className="form-input">
                  <option value="farmer">农户</option><option value="repairman">维修工</option>
                  <option value="technician">技术员</option><option value="owner">农场主</option>
                </select></div>
              {userForm.role === 'farmer' && (
                <div><label className="form-label">分配田块</label>
                  <div className="flex flex-wrap gap-2">
                    {allFields.map((f) => (
                      <label key={f.id} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs cursor-pointer transition-colors ${userForm.fieldIds.includes(f.id) ? 'border-primary bg-primary-50 text-primary' : 'border-gray-200 text-gray-500'}`}>
                        <input type="checkbox" checked={userForm.fieldIds.includes(f.id)} onChange={() => toggleFieldId(f.id)} className="sr-only" />
                        {f.name}
                      </label>
                    ))}
                  </div></div>
              )}
              {editingUser && (
                <div className="flex items-center gap-2">
                  <label className="form-label mb-0">状态</label>
                  <button onClick={() => setUserForm({ ...userForm, status: userForm.status === 'active' ? 'disabled' : 'active' })}>
                    {userForm.status === 'active' ? <ToggleRight className="w-6 h-6 text-green-500" /> : <ToggleLeft className="w-6 h-6 text-gray-400" />}
                  </button>
                  <span className="text-sm">{userForm.status === 'active' ? '启用' : '禁用'}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowUserModal(false)} className="btn-secondary">取消</button>
              <button onClick={handleSaveUser} className="btn-primary">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function QuotaRow({ field }: { field: Field }) {
  const [quota, setQuota] = useState(field.monthlyQuota)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try { await water.updateQuota(field.id, quota); setEditing(false) } catch { setQuota(field.monthlyQuota) }
    setSaving(false)
  }

  return (
    <tr>
      <td className="font-medium">{field.name}</td>
      <td className="text-sm text-gray-500">{field.cropType}</td>
      <td><div className="flex items-center gap-2">
        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, (field.monthlyUsed / quota) * 100)}%` }} />
        </div>
        <span className="text-xs text-gray-500">{field.monthlyUsed}/{quota}</span>
      </div></td>
      <td>
        {editing ? (
          <input type="number" value={quota} onChange={(e) => setQuota(Number(e.target.value))}
            className="form-input w-24 text-sm" autoFocus />
        ) : (
          <span className="text-sm">{quota}</span>
        )}
      </td>
      <td>
        {editing ? (
          <div className="flex gap-1">
            <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-1 px-2">保存</button>
            <button onClick={() => { setEditing(false); setQuota(field.monthlyQuota) }} className="btn-secondary text-xs py-1 px-2">取消</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-primary"><Pencil className="w-4 h-4" /></button>
        )}
      </td>
    </tr>
  )
}
