import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring/60',
  {
    variants: {
      variant: {
        default: 'bg-primary/18 text-primary',
        secondary: 'bg-secondary/70 text-secondary-foreground',
        destructive: 'bg-destructive/18 text-destructive',
        outline: 'border border-border/65 bg-transparent text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
