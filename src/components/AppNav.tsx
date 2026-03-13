import { NavLink } from 'react-router'
import { useAuth } from '@/features/auth/AuthProvider'

const navItems = [
  { to: '/', label: 'Accounts' },
  { to: '/cashflow', label: 'Cash Flow' },
  { to: '/budget', label: 'Budget' },
]

export function AppNav() {
  const { signOut, profile } = useAuth()

  return (
    <>
      {/* Desktop top nav */}
      <nav className="hidden sm:flex items-center justify-between border-b border-border bg-card px-6 h-14">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold tracking-tight mr-6">
            Household Finance
          </span>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-secondary text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {profile?.display_name}
          </span>
          <button
            onClick={signOut}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border bg-card h-14 safe-area-bottom">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center px-4 py-2 text-xs transition-colors ${
                isActive
                  ? 'text-accent font-medium'
                  : 'text-muted-foreground'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
