import * as React from 'react'

import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-input/75 bg-background/42 px-3 py-2 text-sm text-foreground transition-colors duration-150 ease-out file:mr-3 file:rounded-sm file:border-0 file:bg-secondary/75 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-secondary-foreground placeholder:text-muted-foreground/90 hover:border-border focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/55 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }
