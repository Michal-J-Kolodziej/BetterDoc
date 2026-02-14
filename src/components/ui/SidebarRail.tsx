import type { ReactNode } from 'react'

import { cn } from '@/lib/classnames'

type SidebarRailProps = {
  brandMeta?: ReactNode
  brandTitle: ReactNode
  className?: string
  footer?: ReactNode
  navLabel: string
  navSlot: ReactNode
}

export function SidebarRail({
  brandMeta,
  brandTitle,
  className,
  footer,
  navLabel,
  navSlot,
}: SidebarRailProps) {
  return (
    <div className={cn('app-panel sticky top-4 max-h-[calc(100dvh-2rem)] overflow-y-auto', className)}>
      <div className="space-y-2 border-b border-white/10 pb-4">
        <div className="inline-flex items-center rounded-full bg-cyan-300/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
          BetterDoc
        </div>
        <p className="font-display text-xl font-semibold text-white">{brandTitle}</p>
        {brandMeta ? <p className="text-sm text-slate-300">{brandMeta}</p> : null}
      </div>

      <nav aria-label={navLabel} className="mt-4 space-y-2">
        {navSlot}
      </nav>

      {footer ? <div className="mt-4 border-t border-white/10 pt-4">{footer}</div> : null}
    </div>
  )
}

export function RailNavLink({
  active,
  children,
  className,
}: {
  active?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-cyan-300/20 text-cyan-100'
          : 'bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] hover:text-white',
        className,
      )}
    >
      {children}
    </span>
  )
}
