import { useMemo } from 'react'
import type { KeyboardEvent } from 'react'

import { cn } from '@/lib/classnames'

type TabItem<T extends string> = {
  label: string
  value: T
}

type TabsProps<T extends string> = {
  ariaLabel: string
  items: readonly TabItem<T>[]
  onChange: (value: T) => void
  value: T
}

export function Tabs<T extends string>({ ariaLabel, items, onChange, value }: TabsProps<T>) {
  const selectedIndex = useMemo(
    () => items.findIndex((item) => item.value === value),
    [items, value],
  )

  const handleArrowNavigation = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') {
      return
    }

    event.preventDefault()

    if (event.key === 'Home') {
      onChange(items[0].value)
      return
    }

    if (event.key === 'End') {
      onChange(items[items.length - 1].value)
      return
    }

    const delta = event.key === 'ArrowRight' ? 1 : -1
    const nextIndex = (index + delta + items.length) % items.length
    onChange(items[nextIndex].value)
  }

  return (
    <div className="app-panel p-2">
      <div
        aria-label={ariaLabel}
        className="flex flex-wrap items-center gap-2"
        role="tablist"
      >
        {items.map((item, index) => {
          const isSelected = index === selectedIndex

          return (
            <button
              key={item.value}
              aria-selected={isSelected}
              className={cn('app-tab', isSelected && 'app-tab-active')}
              onClick={() => onChange(item.value)}
              onKeyDown={(event) => handleArrowNavigation(event, index)}
              role="tab"
              type="button"
            >
              {item.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
