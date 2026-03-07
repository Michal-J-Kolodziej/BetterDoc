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
        <section className='page-card noir-reveal space-y-2'>
          <p className='text-base font-semibold text-foreground'>Create your first team</p>
          <p className='text-sm text-muted-foreground'>
            Team analytics appears after you join or create a team.
          </p>
          <Button asChild className='mt-2'>
            <Link to='/teams'>Open Team Management</Link>
          </Button>
        </section>
      ) : (
        <>
          <section className='page-card noir-reveal'>
            <div className='page-toolbar'>
              <div className='page-toolbar-group w-full max-w-sm'>
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
              </div>

              <div className='page-toolbar-group'>
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
                  <SelectTrigger className='w-40'>
                    <SelectValue placeholder='Range' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='30'>Last 30 days</SelectItem>
                    <SelectItem value='90'>Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {!overview ? (
            <section className='page-card noir-reveal'>
              <p className='text-sm text-muted-foreground'>Loading team overview...</p>
            </section>
          ) : (
            <>
              <section className='page-grid gap-4 md:grid-cols-5'>
                <MetricCard label='Posts in range' value={overview.totals.postsInWindow} />
                <MetricCard label='Resolved' value={overview.totals.resolved} />
                <MetricCard label='Archived' value={overview.totals.archived} />
                <MetricCard label='Unresolved open' value={overview.totals.unresolvedOpen} />
                <MetricCard
                  label='Median TTR (hours)'
                  value={overview.totals.medianTimeToResolutionHours ?? 'N/A'}
                />
              </section>

              <section className='page-card noir-reveal space-y-3'>
                <div className='page-toolbar'>
                  <div className='space-y-1'>
                    <h2 className='text-lg font-semibold text-foreground'>Recurring topics</h2>
                    <p className='text-sm text-muted-foreground'>
                      Topics repeated most often since {formatDate(overview.windowStartAt)}.
                    </p>
                  </div>
                  <Badge variant='outline'>{rangeDays} day range</Badge>
                </div>
                {overview.recurringTopics.length === 0 ? (
                  <p className='text-sm text-muted-foreground'>No recurring topics detected for this range.</p>
                ) : (
                  <div className='page-pill-row'>
                    {overview.recurringTopics.map((topic) => (
                      <Badge key={topic.label} variant='secondary'>
                        {topic.label} ({topic.count})
                      </Badge>
                    ))}
                  </div>
                )}
              </section>

              <section className='page-card noir-reveal space-y-3'>
                <div className='space-y-1'>
                  <h2 className='text-lg font-semibold text-foreground'>Top contributors</h2>
                  <p className='text-sm text-muted-foreground'>
                    Users with the most post and comment activity in the selected window.
                  </p>
                </div>
                {overview.topContributors.length === 0 ? (
                  <p className='text-sm text-muted-foreground'>No contributor activity in this range.</p>
                ) : (
                  <div className='page-list'>
                    {overview.topContributors.map((contributor) => (
                      <article key={contributor.userId} className='page-list-row'>
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
    <article className='page-card page-card-compact noir-reveal page-stat'>
      <p className='page-stat-label'>{label}</p>
      <p className='page-stat-value text-foreground'>{String(value)}</p>
    </article>
  )
}
