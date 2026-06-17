import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sprout, Droplets, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/store/auth'

const DEMO_ACCOUNTS = [
  { role: '管理员', username: 'owner', password: 'owner123' },
  { role: '技术员', username: 'technician', password: 'tech123' },
  { role: '维修员', username: 'repairman', password: 'repair123' },
  { role: '农户', username: 'farmer', password: 'farm123' },
]

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/')
    } catch (err: any) {
      setError(err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = (u: string, p: string) => {
    setUsername(u)
    setPassword(p)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1B2A4A] relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#1B2A4A] via-[#0D7377]/30 to-[#1B2A4A]" />
      <div className="absolute top-20 left-20 w-72 h-72 bg-[#0D7377]/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden">
          <div className="px-8 pt-10 pb-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#0D7377] mb-4 shadow-lg shadow-teal-500/30">
              <Sprout className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">智慧灌溉平台</h1>
            <p className="text-sm text-gray-300 mt-1">Smart Irrigation Management System</p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 pb-6 space-y-5">
            {error && (
              <div className="bg-red-500/20 border border-red-400/30 text-red-200 text-sm px-4 py-2.5 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-300 mb-1.5">用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-[#0D7377] focus:ring-1 focus:ring-[#0D7377] transition-colors"
                placeholder="请输入用户名"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1.5">密码</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-[#0D7377] focus:ring-1 focus:ring-[#0D7377] transition-colors pr-10"
                  placeholder="请输入密码"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#0D7377] hover:bg-[#0a8a8e] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-teal-700/30"
            >
              {loading ? '登录中...' : '登 录'}
            </button>
          </form>

          <div className="px-8 pb-8">
            <div className="border-t border-white/10 pt-5">
              <div className="flex items-center gap-2 mb-3">
                <Droplets className="w-4 h-4 text-teal-400" />
                <span className="text-sm text-gray-300">演示账号</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((item) => (
                  <button
                    key={item.username}
                    type="button"
                    onClick={() => handleDemoLogin(item.username, item.password)}
                    className="flex flex-col items-start px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#0D7377]/50 transition-colors text-left"
                  >
                    <span className="text-xs text-teal-300 font-medium">{item.role}</span>
                    <span className="text-xs text-gray-400 mt-0.5">{item.username}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
