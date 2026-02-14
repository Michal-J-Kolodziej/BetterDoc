import type { ReactNode } from 'react'

import { StatusChip } from './StatusChip'

type MetricStripItem = {
  hint?: ReactNode
  label: string
  tone?: 'default' | 'error' | 'info' | 'success' | 'warning'
  value: ReactNode
}

type MetricStripProps = {
  items: readonly MetricStripItem[]
}

export function MetricStrip({ items }: MetricStripProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <article key={item.label} className="app-card space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            {item.label}
          </p>
          <p className="font-display text-2xl font-semibold text-white">{item.value}</p>
          {item.hint ? <StatusChip tone={item.tone}>{item.hint}</StatusChip> : null}
        </article>
      ))}
    </div>
  )
}
