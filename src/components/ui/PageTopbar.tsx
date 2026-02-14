import type { ReactNode } from 'react'

import { cn } from '@/lib/classnames'

type PageTopbarProps = {
  actions?: ReactNode
  className?: string
  description?: ReactNode
  eyebrow?: ReactNode
  title: ReactNode
}

export function PageTopbar({
  actions,
  className,
  description,
  eyebrow,
  title,
}: PageTopbarProps) {
  return (
    <header className={cn('app-panel sticky top-4 z-20', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-4xl space-y-2">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/75">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
            {title}
          </h1>
          {description ? <p className="text-sm text-slate-300 sm:text-base">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}
