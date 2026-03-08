import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import {
  Bell,
  BookCopy,
  ChartColumn,
  FileCode2,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Users2,
} from 'lucide-react'

import { api } from '../../../convex/_generated/api.js'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type ActiveNav =
  | 'dashboard'
  | 'playbooks'
  | 'analytics'
  | 'instructions'
  | 'teams'
  | 'profile'
  | 'inbox'

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
  to:
    | '/dashboard'
    | '/playbooks'
    | '/analytics'
    | '/instructions'
    | '/teams'
    | '/profile'
    | '/inbox'
  icon: typeof LayoutDashboard
}> = [
  { key: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { key: 'playbooks', label: 'Playbooks', to: '/playbooks', icon: BookCopy },
  { key: 'analytics', label: 'Analytics', to: '/analytics', icon: ChartColumn },
  { key: 'instructions', label: 'Instructions', to: '/instructions', icon: FileCode2 },
  { key: 'inbox', label: 'Inbox', to: '/inbox', icon: Bell },
  { key: 'teams', label: 'Teams', to: '/teams', icon: Users2 },
  { key: 'profile', label: 'Profile', to: '/profile', icon: ShieldCheck },
]

function navLinkClass(active: boolean): string {
  return cn(
    'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
    active
      ? 'bg-secondary text-foreground'
      : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground',
  )
}

function NavLinks({
  activeNav,
  unreadCount,
  unreadLabel,
}: {
  activeNav: ActiveNav
  unreadCount: number | undefined
  unreadLabel: string
}) {
  return (
    <>
      {navItems.map((item) => {
        const Icon = item.icon
        const active = item.key === activeNav

        return (
          <Link key={item.key} className={navLinkClass(active)} to={item.to}>
            <Icon className='h-4 w-4' />
            <span>{item.label}</span>
            {item.key === 'inbox' && unreadCount && unreadCount > 0 ? (
              <Badge variant='default' className='ml-auto'>
                {unreadLabel}
              </Badge>
            ) : null}
          </Link>
        )
      })}
    </>
  )
}

export function AppSidebarShell({
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
    <div className='workspace-shell'>
      <aside className='workspace-sidebar noir-reveal'>
        <div className='workspace-brand'>
          <span className='workspace-brand-title'>BetterDoc</span>
          <p className='workspace-brand-copy'>
            Team incident records, discussion, and prevention notes in one workspace.
          </p>
        </div>

        <div className='workspace-mobile-nav'>
          <NavLinks activeNav={activeNav} unreadCount={unreadCount} unreadLabel={unreadLabel} />
        </div>

        <nav className='workspace-nav'>
          <NavLinks activeNav={activeNav} unreadCount={unreadCount} unreadLabel={unreadLabel} />
        </nav>

        <div className='workspace-user'>
          <div className='grid gap-1'>
            <p className='page-meta'>Signed in</p>
            <p className='truncate text-sm font-medium text-foreground'>{userLabel}</p>
            <p className='truncate text-sm text-muted-foreground'>{userEmail ?? 'No email available'}</p>
          </div>

          <a
            className='inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-destructive'
            href='/logout'
          >
            <LogOut className='h-4 w-4' />
            Logout
          </a>
        </div>
      </aside>

      <main className='workspace-main'>
        <header className='workspace-header noir-reveal'>
          <div className='workspace-header-copy'>
            <h1 className='workspace-title'>{title}</h1>
            {description ? <p className='workspace-description'>{description}</p> : null}
          </div>

          <div className='page-toolbar-group'>
            <Link
              to='/inbox'
              className='inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/55'
            >
              <Bell className='h-4 w-4' />
              Inbox
              {unreadCount && unreadCount > 0 ? <Badge variant='default'>{unreadLabel}</Badge> : null}
            </Link>
          </div>
        </header>

        <section className='workspace-content'>{children}</section>
      </main>
    </div>
  )
}
