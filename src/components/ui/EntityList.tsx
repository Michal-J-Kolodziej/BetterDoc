import type { ReactNode } from 'react'

type EntityListProps<T> = {
  empty: ReactNode
  getKey: (item: T) => string
  items: readonly T[]
  renderItem: (item: T) => ReactNode
}

export function EntityList<T>({ empty, getKey, items, renderItem }: EntityListProps<T>) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-300">{empty}</p>
  }

  return (
    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <li key={getKey(item)}>{renderItem(item)}</li>
      ))}
    </ul>
  )
}
