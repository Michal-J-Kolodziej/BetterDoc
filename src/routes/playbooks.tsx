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
import type { Id } from '../../convex/_generated/dataModel'

export const Route = createFileRoute('/playbooks')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    team: typeof search.team === 'string' ? search.team : undefined,
    playbook: typeof search.playbook === 'string' ? search.playbook : undefined,
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
  component: PlaybooksPage,
})

function formatDate(value: number): string {
  return new Date(value).toLocaleString()
}

function PlaybooksPage() {
  const auth = useAuth()
  const user = auth.user
  const navigate = Route.useNavigate()
  const search = Route.useSearch()

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
        playbook: search.playbook,
      },
      replace: true,
    })
  }, [navigate, search.playbook, search.team, selectedTeam])

  const playbooks = useQuery(
    api.playbooks.listTeamPlaybooks,
    user && selectedTeam
      ? {
          actorWorkosUserId: user.id,
          teamId: selectedTeam.teamId,
          limit: 80,
        }
      : 'skip',
  )

  const selectedPlaybookId = useMemo(() => {
    if (!playbooks || playbooks.length === 0) {
      return null
    }

    if (search.playbook && playbooks.some((playbook) => playbook.playbookId === search.playbook)) {
      return search.playbook as Id<'playbooks'>
    }

    return playbooks[0].playbookId
  }, [playbooks, search.playbook])

  useEffect(() => {
    if (!selectedPlaybookId || search.playbook === selectedPlaybookId) {
      return
    }

    void navigate({
      search: {
        team: selectedTeam?.slug,
        playbook: selectedPlaybookId,
      },
      replace: true,
    })
  }, [navigate, search.playbook, selectedPlaybookId, selectedTeam?.slug])

  const playbookDetail = useQuery(
    api.playbooks.getPlaybookDetail,
    user && selectedPlaybookId
      ? {
          actorWorkosUserId: user.id,
          playbookId: selectedPlaybookId,
        }
      : 'skip',
  )

  if (auth.loading || !user || !me) {
    return (
      <main className='app-shell'>
        <p className='text-sm text-muted-foreground'>Loading playbooks...</p>
      </main>
    )
  }

  const hasTeams = teams.length > 0

  return (
    <AppSidebarShell
      activeNav='playbooks'
      sectionLabel='Prevention Library'
      title='Playbooks'
      description='Resolved posts promoted into team-private prevention playbooks.'
      actorWorkosUserId={user.id}
      userLabel={userDisplayName(user)}
      userEmail={user.email ?? undefined}
    >
      {!hasTeams ? (
        <section className='noir-reveal tape-surface px-5 py-4'>
          <p className='text-base font-semibold text-foreground'>Create your first team</p>
          <p className='mt-1 text-sm text-muted-foreground'>
            Team-private playbooks appear after you join or create a team.
          </p>
          <Button asChild className='mt-4'>
            <Link to='/teams'>Open Team Management</Link>
          </Button>
        </section>
      ) : null}

      {hasTeams ? (
        <>
          <section className='tape-surface noir-reveal space-y-4 p-4'>
            <div className='max-w-sm'>
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
                      playbook: undefined,
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
          </section>

          <section className='grid gap-4 md:grid-cols-[1fr_1.3fr]'>
            <section className='tape-list noir-reveal'>
              {(playbooks ?? []).map((playbook) => (
                <button
                  key={playbook.playbookId}
                  type='button'
                  className='tape-list-row grid w-full gap-2 px-4 py-4 text-left transition-colors hover:bg-secondary/20'
                  onClick={() => {
                    void navigate({
                      search: {
                        team: selectedTeam?.slug,
                        playbook: playbook.playbookId,
                      },
                      replace: true,
                    })
                  }}
                >
                  <div className='flex items-center gap-2'>
                    <Badge variant='outline'>{playbook.occurrenceWhere}</Badge>
                    <span className='ml-auto text-xs text-muted-foreground'>
                      Updated {formatDate(playbook.updatedAt)}
                    </span>
                  </div>
                  <p className='text-base font-semibold text-foreground'>{playbook.title}</p>
                  <p className='text-sm text-muted-foreground'>{playbook.resolutionSummaryPreview}</p>
                </button>
              ))}

              {playbooks && playbooks.length === 0 ? (
                <section className='px-4 py-6'>
                  <p className='text-sm text-muted-foreground'>No playbooks in this team yet.</p>
                  <p className='mt-1 text-sm text-muted-foreground'>
                    Resolve a post, then promote it from post detail.
                  </p>
                </section>
              ) : null}
            </section>

            <section className='tape-surface noir-reveal space-y-4 p-5'>
              {!playbookDetail ? (
                <p className='text-sm text-muted-foreground'>Select a playbook to inspect details.</p>
              ) : (
                <>
                  <div className='flex flex-wrap items-center gap-2'>
                    <Badge variant='outline'>{playbookDetail.teamName}</Badge>
                    <Badge variant='secondary'>{playbookDetail.sourcePostStatus}</Badge>
                  </div>

                  <div>
                    <h2 className='text-2xl font-semibold text-foreground'>{playbookDetail.title}</h2>
                    <p className='mt-1 text-sm text-muted-foreground'>
                      Where: {playbookDetail.occurrenceWhere} | When: {playbookDetail.occurrenceWhen}
                    </p>
                  </div>

                  <section className='space-y-2'>
                    <p className='text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
                      Issue summary
                    </p>
                    <p className='whitespace-pre-wrap text-sm leading-6'>{playbookDetail.issueSummary}</p>
                  </section>

                  <section className='space-y-2'>
                    <p className='text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
                      Resolution summary
                    </p>
                    <p className='whitespace-pre-wrap text-sm leading-6'>{playbookDetail.resolutionSummary}</p>
                  </section>

                  <p className='tape-meta'>
                    Promoted by {playbookDetail.promotedByName} ({playbookDetail.promotedByIid}) on{' '}
                    {formatDate(playbookDetail.createdAt)}
                  </p>

                  <Link
                    className='inline-flex text-sm font-medium text-foreground underline-offset-2 transition-colors hover:text-primary hover:underline'
                    to='/posts/$postId'
                    params={{ postId: playbookDetail.sourcePostId }}
                  >
                    Open source post
                  </Link>
                </>
              )}
            </section>
          </section>
        </>
      ) : null}
    </AppSidebarShell>
  )
}
