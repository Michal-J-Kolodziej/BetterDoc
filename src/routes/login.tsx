import { createFileRoute } from '@tanstack/react-router'
import { getAuthkit } from '@workos/authkit-tanstack-react-start'

export const Route = createFileRoute('/login')({
  server: {
    handlers: {
      GET: async ({ context }) => {
        const authkit = await getAuthkit()
        const signInUrl = await authkit.getSignInUrl({
          returnPathname: '/dashboard',
          redirectUri: context.redirectUri,
        })

        return Response.redirect(signInUrl, 307)
      },
    },
  },
})
