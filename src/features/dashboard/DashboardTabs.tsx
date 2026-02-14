import { Tabs } from '@/components/ui/Tabs'
import type { DashboardTab } from '@/features/dashboard/types'
import { dashboardTabs } from '@/features/dashboard/types'

type DashboardTabsProps = {
  onChange: (value: DashboardTab) => void
  value: DashboardTab
}

export function DashboardTabs({ onChange, value }: DashboardTabsProps) {
  return (
    <Tabs
      ariaLabel="Dashboard sections"
      items={dashboardTabs}
      onChange={onChange}
      value={value}
    />
  )
}
