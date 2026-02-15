import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { Bell, LayoutDashboard, LogOut, ShieldCheck, Users2 } from 'lucide-react'

import { api } from '../../../convex/_generated/api.js'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type ActiveNav = 'dashboard' | 'teams' | 'profile' | 'inbox'

type AppSidebarShellProps = {
  sectionLabel: string
  title: string
  description?: string
  activeNav: ActiveNav
  actorWorkosUserId?: string
  userLabel: string
  userEmail?: string
  children: ReactNode
}

const navItems: Array<{
  key: ActiveNav
  label: string
  to: '/dashboard' | '/teams' | '/profile' | '/inbox'
  icon: typeof LayoutDashboard
}> = [
  { key: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { key: 'inbox', label: 'Inbox', to: '/inbox', icon: Bell },
  { key: 'teams', label: 'Teams', to: '/teams', icon: Users2 },
  { key: 'profile', label: 'Profile', to: '/profile', icon: ShieldCheck },
]

export function AppSidebarShell({
  sectionLabel,
  title,
  description,
  activeNav,
  actorWorkosUserId,
  userLabel,
  userEmail,
  children,
}: AppSidebarShellProps) {
  const unreadCount = useQuery(
    api.notifications.getUnreadCount,
    actorWorkosUserId ? { actorWorkosUserId } : 'skip',
  )
  const unreadLabel = unreadCount && unreadCount > 99 ? '99+' : String(unreadCount ?? 0)

  return (
    <div className='app-desktop-shell'>
      <aside className='app-sidebar noir-reveal'>
        <div className='space-y-1'>
          <p className='noir-kicker'>Workspace</p>
          <h2 className='text-xl font-semibold'>BetterDoc</h2>
        </div>

        <nav className='mt-6 grid gap-1'>
          {navItems.map((item) => {
            const Icon = item.icon
            const active = item.key === activeNav

            return (
              <Link
                key={item.key}
                className={cn(
                  'flex items-center gap-2 rounded-sm px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-secondary/60 text-foreground'
                    : 'text-muted-foreground hover:bg-secondary/45 hover:text-foreground',
                )}
                to={item.to}
              >
                <Icon className='h-4 w-4' />
                <span>{item.label}</span>
                {item.key === 'inbox' && unreadCount && unreadCount > 0 ? (
                  <Badge variant='destructive' className='ml-auto px-1.5 py-0 text-[10px] leading-4'>
                    {unreadLabel}
                  </Badge>
                ) : null}
              </Link>
            )
          })}
        </nav>

        <div className='mt-auto space-y-3'>
          <div className='noir-divider' />
          <div className='rounded-sm bg-secondary/45 px-3 py-3'>
            <p className='noir-kicker mb-1'>Signed in as</p>
            <p className='truncate text-sm font-medium text-foreground'>{userLabel}</p>
            <p className='truncate text-xs text-muted-foreground'>{userEmail ?? 'No email available'}</p>
          </div>
          <Link
            className='flex items-center gap-2 rounded-sm px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/14'
            to='/logout'
          >
            <LogOut className='h-4 w-4' />
            Logout
          </Link>
        </div>
      </aside>

      <main className='app-main'>
        <header className='noir-reveal border-b border-border/55 px-1 py-4'>
          <div className='flex items-start justify-between gap-3'>
            <div>
              <p className='noir-kicker'>{sectionLabel}</p>
              <h1 className='mt-1 text-2xl font-semibold text-foreground'>{title}</h1>
            </div>
            <Link
              to='/inbox'
              className='inline-flex items-center gap-2 rounded-sm border border-border/65 bg-background/70 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/60'
            >
              <Bell className='h-3.5 w-3.5' />
              Inbox
              {unreadCount && unreadCount > 0 ? (
                <Badge variant='destructive' className='px-1.5 py-0 text-[10px] leading-4'>
                  {unreadLabel}
                </Badge>
              ) : null}
            </Link>
          </div>
          {description ? <p className='mt-1 text-sm text-muted-foreground'>{description}</p> : null}
        </header>

        <section className='app-content-stack'>{children}</section>
      </main>
    </div>
  )
}
