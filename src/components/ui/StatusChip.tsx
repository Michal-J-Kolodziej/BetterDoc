import type { ReactNode } from 'react'

import { cn } from '@/lib/classnames'

type StatusChipTone = 'default' | 'error' | 'info' | 'success' | 'warning'

type StatusChipProps = {
  children: ReactNode
  className?: string
  tone?: StatusChipTone
}

const toneClasses: Record<StatusChipTone, string> = {
  default: 'bg-white/8 text-slate-200',
  info: 'bg-cyan-400/15 text-cyan-200',
  success: 'bg-emerald-400/15 text-emerald-200',
  warning: 'bg-amber-400/20 text-amber-100',
  error: 'bg-rose-400/20 text-rose-100',
}

export function StatusChip({ children, className, tone = 'default' }: StatusChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
