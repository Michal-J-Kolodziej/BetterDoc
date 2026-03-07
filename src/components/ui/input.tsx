import * as React from 'react'

import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground transition-colors duration-150 ease-out file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-secondary-foreground placeholder:text-muted-foreground hover:border-foreground/20 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50',
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
