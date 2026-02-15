import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { userDisplayName } from '@/utils/user-display'
import { api } from '../../convex/_generated/api.js'

type AcceptResult = {
  method: 'email' | 'link'
  result: 'accepted' | 'already_accepted'
  teamName: string
}

export const Route = createFileRoute('/join/$token')({
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
  component: JoinTeamPage,
})

function JoinTeamPage() {
  const auth = useAuth()
  const user = auth.user
  const params = Route.useParams()

  const upsertMe = useMutation(api.users.upsertMe)
  const acceptInviteToken = useMutation(api.teams.acceptInviteToken)
  const me = useQuery(api.users.getMe, user ? { workosUserId: user.id } : 'skip')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AcceptResult | null>(null)

  useEffect(() => {
    if (!user || auth.loading || me) {
      return
    }

    void upsertMe({
      workosUserId: user.id,
      name: userDisplayName(user),
      email: user.email ?? undefined,
    })
  }, [auth.loading, me, upsertMe, user])

  const handleAccept = async () => {
    if (!user) {
      return
    }

    setBusy(true)
    setError(null)

    try {
      const accepted = await acceptInviteToken({
        actorWorkosUserId: user.id,
        token: params.token,
      })

      setResult({
        method: accepted.method,
        result: accepted.result,
        teamName: accepted.teamName,
      })
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'Failed to accept invite.')
    } finally {
      setBusy(false)
    }
  }

  if (auth.loading || !user || !me) {
    return (
      <main className='app-shell'>
        <p className='text-sm text-muted-foreground'>Loading invite...</p>
      </main>
    )
  }

  return (
    <main className='app-shell p-4'>
      <section className='tape-surface noir-reveal mx-auto max-w-xl space-y-4 p-6'>
        <div>
          <p className='noir-kicker'>Team Invite</p>
          <h1 className='mt-1 text-xl font-semibold text-foreground'>Join Team</h1>
          <p className='mt-1 text-sm text-muted-foreground'>
            Accept this invite to join a team in BetterDoc.
          </p>
        </div>

        {error ? <p className='text-sm text-destructive'>{error}</p> : null}

        {result ? (
          <div className='space-y-3'>
            <p className='text-sm text-foreground'>
              {result.result === 'already_accepted' ? 'Already joined' : 'Joined'}{' '}
              <span className='font-semibold'>{result.teamName}</span> via {result.method} invite.
            </p>
            <div className='flex flex-wrap gap-2'>
              <Link to='/dashboard' search={{ q: undefined, team: undefined }}>
                <Button size='sm'>Open Dashboard</Button>
              </Link>
              <Link to='/teams'>
                <Button size='sm' variant='secondary'>Open Teams</Button>
              </Link>
            </div>
          </div>
        ) : (
          <Button disabled={busy} onClick={() => void handleAccept()}>
            {busy ? 'Joining...' : 'Accept invite'}
          </Button>
        )}

        <p className='text-xs text-muted-foreground'>
          Email invites require a matching signed-in email. Link invites enforce expiry and max uses.
        </p>
      </section>
    </main>
  )
}
