import { createFileRoute } from '@tanstack/react-router'

import { DashboardVariantPage } from '@/features/dashboard-variants/page'

export const Route = createFileRoute('/dashboard_/v4')({
  ssr: false,
  server: {
    handlers: {
      GET: async ({ context, next, request }) => {
        const auth = context.auth()

        if (!auth.user) {
          const authkit = await import('@workos/authkit-tanstack-react-start').then((module) =>
            module.getAuthkit(),
          )

          const signInUrl = await authkit.getSignInUrl({
            returnPathname: new URL(request.url).pathname,
            redirectUri: context.redirectUri,
          })

          return Response.redirect(signInUrl, 307)
        }

        return next()
      },
    },
  },
  component: DashboardV4Route,
})

function DashboardV4Route() {
  return <DashboardVariantPage variant='v4' />
}
