import { createFileRoute } from '@tanstack/react-router'
import { getAuthkit } from '@workos/authkit-tanstack-react-start'

export const Route = createFileRoute('/logout')({
  server: {
    handlers: {
      GET: async ({ context }) => {
        const auth = context.auth()

        if (!auth.user || !auth.sessionId) {
          return Response.redirect('/', 307)
        }

        const authkit = await getAuthkit()
        const { headers: headersBag, logoutUrl } = await authkit.signOut(
          auth.sessionId,
          { returnTo: '/' },
        )

        const response = Response.redirect(logoutUrl, 307)

        if (headersBag) {
          for (const [key, value] of Object.entries(headersBag)) {
            if (Array.isArray(value)) {
              for (const headerValue of value) {
                response.headers.append(key, headerValue)
              }
            } else {
              response.headers.set(key, value)
            }
          }
        }

        return response
      },
    },
  },
})
