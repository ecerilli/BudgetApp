import { NavLink } from 'react-router'
import { useAuth } from '@/features/auth/auth-context'

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
      <nav className="sticky top-0 z-40 hidden border-b border-border/70 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/72 sm:block">
        <div className="mx-auto flex h-18 w-full max-w-[1200px] items-center justify-between gap-6 px-6">
          <div className="flex items-center gap-6">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Household Finance
              </p>
              <p className="text-sm font-semibold tracking-tight text-foreground">
                Shared cash planning
              </p>
            </div>

            <div className="flex items-center gap-1 rounded-full border border-border/80 bg-card/90 p-1 shadow-sm">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                      isActive
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:text-foreground'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-full border border-border/80 bg-card/90 px-3 py-2 shadow-sm">
            <span className="max-w-40 truncate text-xs text-muted-foreground">
              {profile?.display_name}
            </span>
            <button
              onClick={signOut}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-4 z-50 px-4 sm:hidden">
        <div className="mx-auto flex h-16 max-w-sm items-center justify-around rounded-[1.25rem] border border-border/80 bg-card/95 px-2 shadow-lg shadow-black/8 backdrop-blur safe-area-bottom">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex min-w-0 flex-1 items-center justify-center rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  )
}
