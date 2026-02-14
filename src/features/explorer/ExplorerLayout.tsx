import type { ReactNode } from 'react'

import { AppShell } from '@/components/ui/AppShell'
import { PageTopbar } from '@/components/ui/PageTopbar'
import { SidebarRail } from '@/components/ui/SidebarRail'

type ExplorerLayoutProps = {
  actions?: ReactNode
  breadcrumbs?: ReactNode
  children: ReactNode
  description?: ReactNode
  navLabel: string
  navSlot: ReactNode
  sidebarMeta?: ReactNode
  sidebarTitle: ReactNode
  title: ReactNode
}

export function ExplorerLayout({
  actions,
  breadcrumbs,
  children,
  description,
  navLabel,
  navSlot,
  sidebarMeta,
  sidebarTitle,
  title,
}: ExplorerLayoutProps) {
  const rail = (
    <SidebarRail
      brandMeta={sidebarMeta}
      brandTitle={sidebarTitle}
      navLabel={navLabel}
      navSlot={navSlot}
    />
  )

  return (
    <AppShell mobileRail={rail} sidebar={rail} topbar={<PageTopbar actions={actions} description={description} title={title} />}>
      {breadcrumbs ? <div className="app-card py-3">{breadcrumbs}</div> : null}
      {children}
    </AppShell>
  )
}
