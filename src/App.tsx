import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import Layout from '@/components/Layout'
import LoginPage from '@/components/LoginPage'
import Dashboard from '@/pages/Dashboard'
import Fields from '@/pages/Fields'
import FieldDetail from '@/pages/FieldDetail'
import Devices from '@/pages/Devices'
import Irrigation from '@/pages/Irrigation'
import Water from '@/pages/Water'
import WorkOrders from '@/pages/WorkOrders'
import SettingsPage from '@/pages/Settings'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const fetchMe = useAuthStore((s) => s.fetchMe)
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated && !user) {
      fetchMe()
    }
  }, [isAuthenticated, user, fetchMe])

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true })
    }
  }, [isAuthenticated, navigate])

  if (!isAuthenticated) return null

  return <>{children}</>
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-700">{title}</h2>
        <p className="text-gray-400 mt-2">功能开发中...</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/fields" element={<Fields />} />
          <Route path="/fields/:id" element={<FieldDetail />} />
          <Route path="/irrigation" element={<Irrigation />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/workorders" element={<WorkOrders />} />
          <Route path="/water" element={<Water />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}
