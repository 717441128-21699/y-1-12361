import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Map,
  CalendarCheck,
  Monitor,
  ClipboardList,
  Droplets,
  Settings,
  LogOut,
  Menu,
  ChevronLeft,
  Sprout,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import type { UserRole } from '@/types'

interface NavItem {
  label: string
  path: string
  icon: React.ElementType
  roles: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  { label: '首页大屏', path: '/', icon: LayoutDashboard, roles: ['farmer', 'technician', 'repairman', 'owner'] },
  { label: '田块管理', path: '/fields', icon: Map, roles: ['farmer', 'technician', 'owner'] },
  { label: '灌溉计划', path: '/irrigation', icon: CalendarCheck, roles: ['farmer', 'technician', 'owner'] },
  { label: '设备监控', path: '/devices', icon: Monitor, roles: ['technician', 'owner'] },
  { label: '工单管理', path: '/workorders', icon: ClipboardList, roles: ['repairman', 'owner'] },
  { label: '水资源管理', path: '/water', icon: Droplets, roles: ['technician', 'owner'] },
  { label: '系统设置', path: '/settings', icon: Settings, roles: ['owner'] },
]

const ROLE_LABELS: Record<UserRole, string> = {
  farmer: '农户',
  technician: '技术员',
  repairman: '维修员',
  owner: '管理员',
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => user && item.roles.includes(user.role)
  )

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-[#f0f4f8] overflow-hidden">
      <aside
        className={`flex flex-col bg-[#1B2A4A] text-white transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10 shrink-0">
          <Sprout className="w-7 h-7 text-teal-400 shrink-0" />
          {!collapsed && (
            <span className="text-lg font-bold tracking-wide whitespace-nowrap">
              智慧灌溉
            </span>
          )}
        </div>

        <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-[#0D7377] text-white shadow-md'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center py-3 border-t border-white/10 text-gray-400 hover:text-white transition-colors"
        >
          {collapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between h-14 px-6 bg-white border-b border-gray-200 shrink-0 shadow-sm">
          <div className="text-sm text-gray-500">
            智慧灌溉管理平台
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#0D7377] text-white text-xs font-medium">
                  {user.username.charAt(0).toUpperCase()}
                </span>
                <span className="font-medium">{user.username}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-teal-50 text-[#0D7377]">
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-red-500 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              退出
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
