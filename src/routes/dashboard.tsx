import { Link, createFileRoute } from '@tanstack/react-router'
import { getAuthkit } from '@workos/authkit-tanstack-react-start'

export const Route = createFileRoute('/dashboard')({
  server: {
    handlers: {
      GET: async ({ context, next, request }) => {
        const auth = context.auth()

        if (!auth.user) {
          const authkit = await getAuthkit()
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
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <main>
      <h1>Authenticated Dashboard</h1>
      <p>
        Access granted. This page is protected by WorkOS session checks in the
        server handler for the <code>/dashboard</code> route.
      </p>

      <section>
        <h2>Session</h2>
        <p>
          Session details are available in server context and can be expanded in
          BD-004 for RBAC-aware UI.
        </p>
      </section>

      <section>
        <h2>Actions</h2>
        <p>
          <Link to="/logout">Sign out</Link>
        </p>
        <p>
          <Link to="/">Back to home</Link>
        </p>
      </section>
    </main>
  )
}
