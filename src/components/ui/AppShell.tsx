import type { ReactNode } from 'react'

import { cn } from '@/lib/classnames'

type AppShellProps = {
  children: ReactNode
  contentClassName?: string
  mobileRail?: ReactNode
  sidebar?: ReactNode
  topbar?: ReactNode
}

export function AppShell({
  children,
  contentClassName,
  mobileRail,
  sidebar,
  topbar,
}: AppShellProps) {
  return (
    <div className="relative min-h-dvh bg-app-canvas text-slate-100">
      <div className="mx-auto flex w-full max-w-[1700px] gap-4 px-3 py-4 sm:px-6 lg:px-8">
        {sidebar ? <aside className="hidden w-72 shrink-0 lg:block">{sidebar}</aside> : null}

        <div className="min-w-0 flex-1">
          {mobileRail ? <div className="mb-4 lg:hidden">{mobileRail}</div> : null}
          {topbar}
          <main className={cn('mt-4 space-y-4', contentClassName)}>{children}</main>
        </div>
      </div>
    </div>
  )
}
