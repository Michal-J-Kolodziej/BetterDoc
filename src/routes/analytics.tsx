import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useMemo } from 'react'

import { AppSidebarShell } from '@/components/layout/app-sidebar-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { userDisplayName } from '@/utils/user-display'
import { api } from '../../convex/_generated/api.js'

export const Route = createFileRoute('/analytics')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    team: typeof search.team === 'string' ? search.team : undefined,
    range: search.range === '90' ? '90' : '30',
  }),
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
  component: AnalyticsPage,
})

function formatDate(value: number): string {
  return new Date(value).toLocaleDateString()
}

function AnalyticsPage() {
  const auth = useAuth()
  const user = auth.user
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const upsertMe = useMutation(api.users.upsertMe)
  const me = useQuery(api.users.getMe, user ? { workosUserId: user.id } : 'skip')

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

  const teams = useMemo(() => me?.teams ?? [], [me?.teams])

  const selectedTeam = useMemo(() => {
    const explicit = search.team ?? ''

    if (!explicit) {
      return teams[0] ?? null
    }

    const normalized = explicit.toLowerCase()

    return (
      teams.find(
        (team) => team.slug.toLowerCase() === normalized || team.name.toLowerCase() === normalized,
      ) ?? teams[0] ?? null
    )
  }, [search.team, teams])

  useEffect(() => {
    if (!selectedTeam || search.team === selectedTeam.slug) {
      return
    }

    void navigate({
      search: {
        team: selectedTeam.slug,
        range: search.range,
      },
      replace: true,
    })
  }, [navigate, search.range, search.team, selectedTeam])

  const rangeDays = search.range === '90' ? 90 : 30
  const overview = useQuery(
    api.analytics.getTeamOverview,
    user && selectedTeam
      ? {
          actorWorkosUserId: user.id,
          teamId: selectedTeam.teamId,
          rangeDays,
        }
      : 'skip',
  )

  if (auth.loading || !user || !me) {
    return (
      <main className='app-shell'>
        <p className='text-sm text-muted-foreground'>Loading analytics...</p>
      </main>
    )
  }

  const hasTeams = teams.length > 0

  return (
    <AppSidebarShell
      activeNav='analytics'
      sectionLabel='Team Metrics'
      title='Analytics'
      description='Team-private incident metrics with resolved/archived separation and contributor trends.'
      actorWorkosUserId={user.id}
      userLabel={userDisplayName(user)}
      userEmail={user.email ?? undefined}
    >
      {!hasTeams ? (
        <section className='noir-reveal tape-surface px-5 py-4'>
          <p className='text-base font-semibold text-foreground'>Create your first team</p>
          <p className='mt-1 text-sm text-muted-foreground'>
            Team analytics appears after you join or create a team.
          </p>
          <Button asChild className='mt-4'>
            <Link to='/teams'>Open Team Management</Link>
          </Button>
        </section>
      ) : (
        <>
          <section className='tape-surface noir-reveal grid gap-4 p-4 md:grid-cols-[1fr_180px]'>
            <Select
              value={selectedTeam?.slug ?? ''}
              onValueChange={(value) => {
                const team = teams.find((entry) => entry.slug === value)

                if (!team) {
                  return
                }

                void navigate({
                  search: {
                    team: team.slug,
                    range: search.range,
                  },
                  replace: true,
                })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder='Select a team' />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.teamId} value={team.slug}>
                    {team.name} ({team.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={String(rangeDays)}
              onValueChange={(value) => {
                void navigate({
                  search: {
                    team: selectedTeam?.slug,
                    range: value === '90' ? '90' : '30',
                  },
                  replace: true,
                })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder='Range' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='30'>Last 30 days</SelectItem>
                <SelectItem value='90'>Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </section>

          {!overview ? (
            <section className='tape-surface noir-reveal px-5 py-4'>
              <p className='text-sm text-muted-foreground'>Loading team overview...</p>
            </section>
          ) : (
            <>
              <section className='grid gap-4 md:grid-cols-5'>
                <MetricCard label='Posts in range' value={overview.totals.postsInWindow} />
                <MetricCard label='Resolved' value={overview.totals.resolved} />
                <MetricCard label='Archived' value={overview.totals.archived} />
                <MetricCard label='Unresolved open' value={overview.totals.unresolvedOpen} />
                <MetricCard
                  label='Median TTR (hours)'
                  value={overview.totals.medianTimeToResolutionHours ?? 'N/A'}
                />
              </section>

              <section className='tape-surface noir-reveal space-y-3 p-5'>
                <div className='flex flex-wrap items-center gap-2'>
                  <h2 className='text-lg font-semibold text-foreground'>Recurring topics</h2>
                  <Badge variant='outline'>Window starts {formatDate(overview.windowStartAt)}</Badge>
                </div>
                {overview.recurringTopics.length === 0 ? (
                  <p className='text-sm text-muted-foreground'>No recurring topics detected for this range.</p>
                ) : (
                  <div className='flex flex-wrap gap-2'>
                    {overview.recurringTopics.map((topic) => (
                      <Badge key={topic.label} variant='secondary'>
                        {topic.label} ({topic.count})
                      </Badge>
                    ))}
                  </div>
                )}
              </section>

              <section className='tape-surface noir-reveal space-y-3 p-5'>
                <h2 className='text-lg font-semibold text-foreground'>Top contributors</h2>
                {overview.topContributors.length === 0 ? (
                  <p className='text-sm text-muted-foreground'>No contributor activity in this range.</p>
                ) : (
                  <div className='tape-list'>
                    {overview.topContributors.map((contributor) => (
                      <article key={contributor.userId} className='tape-list-row grid gap-1 py-3'>
                        <p className='text-sm font-semibold text-foreground'>
                          {contributor.name} ({contributor.iid})
                        </p>
                        <p className='text-sm text-muted-foreground'>
                          {contributor.totalCount} total | {contributor.postCount} posts |{' '}
                          {contributor.commentCount} comments
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}
    </AppSidebarShell>
  )
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article className='tape-surface noir-reveal space-y-1 px-4 py-3'>
      <p className='text-xs uppercase tracking-[0.12em] text-muted-foreground'>{label}</p>
      <p className='text-2xl font-semibold text-foreground'>{String(value)}</p>
    </article>
  )
}
