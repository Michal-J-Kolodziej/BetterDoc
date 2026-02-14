import type { ReactNode } from 'react'

import { cn } from '@/lib/classnames'

type PanelProps = {
  actions?: ReactNode
  children: ReactNode
  className?: string
  description?: ReactNode
  id?: string
  title?: ReactNode
}

export function Panel({
  actions,
  children,
  className,
  description,
  id,
  title,
}: PanelProps) {
  return (
    <section id={id} className={cn('app-panel', className)}>
      {title || description || actions ? (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            {title ? <h2 className="font-display text-xl font-semibold text-white">{title}</h2> : null}
            {description ? <p className="max-w-3xl text-sm text-slate-300">{description}</p> : null}
          </div>
          {actions}
        </header>
      ) : null}
      {children}
    </section>
  )
}
