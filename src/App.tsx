import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { Toaster } from '@/components/ui/sonner'

const ProtectedRoute = lazy(() =>
  import('@/components/ProtectedRoute').then((module) => ({ default: module.ProtectedRoute }))
)
const LoginPage = lazy(() =>
  import('@/features/auth/LoginPage').then((module) => ({ default: module.LoginPage }))
)
const OnboardingPage = lazy(() =>
  import('@/features/auth/OnboardingPage').then((module) => ({ default: module.OnboardingPage }))
)
const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage }))
)
const CashFlowPage = lazy(() =>
  import('@/features/cashflow/CashFlowPage').then((module) => ({ default: module.CashFlowPage }))
)
const BudgetPage = lazy(() =>
  import('@/features/budget/BudgetPage').then((module) => ({ default: module.BudgetPage }))
)

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoadingScreen />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/cashflow" element={<CashFlowPage />} />
            <Route path="/budget" element={<BudgetPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster position="bottom-right" />
    </BrowserRouter>
  )
}

function RouteLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  )
}
