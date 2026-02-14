import type { PropsWithChildren } from 'react'
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { AuthKitProvider } from '@workos/authkit-tanstack-react-start/client'

import { ConvexAppProvider } from '../lib/convex-client'
import '../styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'BetterDoc V2',
      },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <AuthKitProvider>
        <ConvexAppProvider>
          <Outlet />
        </ConvexAppProvider>
      </AuthKitProvider>
    </RootDocument>
  )
}

function RootDocument({ children }: PropsWithChildren) {
  return (
    <html lang='en'>
      <head>
        <HeadContent />
      </head>
      <body className='min-h-screen bg-background text-foreground antialiased selection:bg-primary/30 selection:text-foreground'>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
