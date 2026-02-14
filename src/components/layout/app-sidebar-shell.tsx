import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { LayoutDashboard, LogOut, ShieldCheck, Users2 } from 'lucide-react'

import { cn } from '@/lib/utils'

type ActiveNav = 'dashboard' | 'teams' | 'profile'

type AppSidebarShellProps = {
  sectionLabel: string
  title: string
  description?: string
  activeNav: ActiveNav
  userLabel: string
  userEmail?: string
  children: ReactNode
}

const navItems: Array<{
  key: ActiveNav
  label: string
  to: '/dashboard' | '/teams' | '/profile'
  icon: typeof LayoutDashboard
}> = [
  { key: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { key: 'teams', label: 'Teams', to: '/teams', icon: Users2 },
  { key: 'profile', label: 'Profile', to: '/profile', icon: ShieldCheck },
]

export function AppSidebarShell({
  sectionLabel,
  title,
  description,
  activeNav,
  userLabel,
  userEmail,
  children,
}: AppSidebarShellProps) {
  return (
    <div className='app-desktop-shell'>
      <aside className='app-sidebar noir-panel noir-reveal'>
        <div className='space-y-1'>
          <p className='noir-kicker'>Noir Grid Workspace</p>
          <h2 className='text-xl font-semibold'>BetterDoc</h2>
        </div>

        <nav className='mt-6 grid gap-2'>
          {navItems.map((item) => {
            const Icon = item.icon
            const active = item.key === activeNav

            return (
              <Link
                key={item.key}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'border-primary/45 bg-primary/15 text-primary'
                    : 'border-border/75 bg-transparent text-muted-foreground hover:border-border hover:bg-secondary/65 hover:text-foreground',
                )}
                to={item.to}
              >
                <Icon className='h-4 w-4' />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className='mt-auto space-y-3'>
          <div className='noir-divider' />
          <div className='rounded-lg border border-border/80 bg-background/45 px-3 py-3'>
            <p className='noir-kicker mb-1'>Signed in as</p>
            <p className='truncate text-sm font-medium text-foreground'>{userLabel}</p>
            <p className='truncate text-xs text-muted-foreground'>{userEmail ?? 'No email available'}</p>
          </div>
          <Link
            className='flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20'
            to='/logout'
          >
            <LogOut className='h-4 w-4' />
            Logout
          </Link>
        </div>
      </aside>

      <main className='app-main'>
        <header className='noir-panel noir-reveal px-5 py-4'>
          <p className='noir-kicker'>{sectionLabel}</p>
          <h1 className='mt-1 text-2xl font-semibold text-foreground'>{title}</h1>
          {description ? <p className='mt-1 text-sm text-muted-foreground'>{description}</p> : null}
        </header>

        <section className='app-content-stack'>{children}</section>
      </main>
    </div>
  )
}
