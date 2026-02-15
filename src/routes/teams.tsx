import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useMemo, useState } from 'react'

import { AppSidebarShell } from '@/components/layout/app-sidebar-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { userDisplayName } from '@/utils/user-display'
import { api } from '../../convex/_generated/api.js'
import type { Id } from '../../convex/_generated/dataModel'

export const Route = createFileRoute('/teams')({
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
  component: TeamsPage,
})

type TeamRole = 'admin' | 'teamleader' | 'senior' | 'mid' | 'junior'

function canManage(role: TeamRole | undefined): boolean {
  return role === 'admin' || role === 'teamleader'
}

function TeamsPage() {
  const auth = useAuth()
  const user = auth.user

  const upsertMe = useMutation(api.users.upsertMe)
  const createTeam = useMutation(api.teams.createTeam)
  const inviteByIID = useMutation(api.teams.inviteByIID)
  const updateMemberRole = useMutation(api.teams.updateMemberRole)
  const removeMember = useMutation(api.teams.removeMember)
  const respondInvite = useMutation(api.teams.respondInvite)

  const me = useQuery(api.users.getMe, user ? { workosUserId: user.id } : 'skip')

  useEffect(() => {
    if (!user || auth.loading || me) {
      return
    }

    void upsertMe({
      workosUserId: user.id,
      name: userDisplayName(user),
    })
  }, [auth.loading, me, upsertMe, user])

  const myTeams = useQuery(
    api.teams.listMyTeams,
    user && me
      ? {
          actorWorkosUserId: user.id,
        }
      : 'skip',
  )

  const [selectedTeamId, setSelectedTeamId] = useState<Id<'teams'> | null>(null)

  useEffect(() => {
    if (!selectedTeamId && myTeams && myTeams.length > 0) {
      setSelectedTeamId(myTeams[0].teamId)
    }
  }, [myTeams, selectedTeamId])

  const selectedTeam = useMemo(
    () => (myTeams ?? []).find((team) => team.teamId === selectedTeamId) ?? null,
    [myTeams, selectedTeamId],
  )

  const members = useQuery(
    api.teams.listTeamMembers,
    user && selectedTeamId
      ? {
          actorWorkosUserId: user.id,
          teamId: selectedTeamId,
        }
      : 'skip',
  )

  const invites = useQuery(
    api.teams.listMyInvites,
    user
      ? {
          actorWorkosUserId: user.id,
        }
      : 'skip',
  )

  const [createName, setCreateName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [createBusy, setCreateBusy] = useState(false)

  const [inviteIid, setInviteIid] = useState('')
  const [inviteRole, setInviteRole] = useState<TeamRole>('junior')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  const [memberActionError, setMemberActionError] = useState<string | null>(null)

  const handleCreateTeam = async () => {
    if (!user) {
      return
    }

    setCreateBusy(true)
    setCreateError(null)

    try {
      const result = await createTeam({
        actorWorkosUserId: user.id,
        name: createName,
      })

      setCreateName('')
      setSelectedTeamId(result.teamId)
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create team.')
    } finally {
      setCreateBusy(false)
    }
  }

  const handleInvite = async () => {
    if (!user || !selectedTeamId) {
      return
    }

    setInviteBusy(true)
    setInviteError(null)

    try {
      await inviteByIID({
        actorWorkosUserId: user.id,
        teamId: selectedTeamId,
        iid: inviteIid,
        role: inviteRole,
      })

      setInviteIid('')
      setInviteRole('junior')
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Failed to send invite.')
    } finally {
      setInviteBusy(false)
    }
  }

  const handleAcceptInvite = async (inviteId: Id<'teamInvites'>) => {
    if (!user) {
      return
    }

    await respondInvite({
      actorWorkosUserId: user.id,
      inviteId,
      action: 'accept',
    })
  }

  const handleDeclineInvite = async (inviteId: Id<'teamInvites'>) => {
    if (!user) {
      return
    }

    await respondInvite({
      actorWorkosUserId: user.id,
      inviteId,
      action: 'decline',
    })
  }

  const handleChangeMemberRole = async (
    memberUserId: Id<'users'>,
    nextRole: TeamRole,
  ) => {
    if (!user || !selectedTeamId) {
      return
    }

    setMemberActionError(null)

    try {
      await updateMemberRole({
        actorWorkosUserId: user.id,
        teamId: selectedTeamId,
        memberUserId,
        role: nextRole,
      })
    } catch (error) {
      setMemberActionError(
        error instanceof Error ? error.message : 'Failed to update member role.',
      )
    }
  }

  const handleRemoveMember = async (memberUserId: Id<'users'>) => {
    if (!user || !selectedTeamId) {
      return
    }

    setMemberActionError(null)

    try {
      await removeMember({
        actorWorkosUserId: user.id,
        teamId: selectedTeamId,
        memberUserId,
      })
    } catch (error) {
      setMemberActionError(
        error instanceof Error ? error.message : 'Failed to remove member.',
      )
    }
  }

  if (auth.loading || !user || !me) {
    return (
      <main className='app-shell'>
        <p className='text-sm text-muted-foreground'>Loading teams...</p>
      </main>
    )
  }

  const manager = canManage(selectedTeam?.role)

  return (
    <AppSidebarShell
      activeNav='teams'
      sectionLabel='Organization'
      title='Teams'
      description='Create teams, invite by IID, and manage roles.'
      actorWorkosUserId={user.id}
      userLabel={userDisplayName(user)}
      userEmail={user.email ?? undefined}
    >
      <section className='grid grid-cols-2 gap-5'>
        <section className='tape-surface noir-reveal space-y-3 p-5'>
          <div>
            <p className='text-lg font-semibold text-foreground'>Create Team</p>
            <p className='mt-1 text-sm text-muted-foreground'>You become admin of teams you create.</p>
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='team-name'>Team name</Label>
            <Input
              id='team-name'
              value={createName}
              maxLength={80}
              placeholder='Platform'
              onChange={(event) => setCreateName(event.target.value)}
            />
          </div>
          {createError ? <p className='text-sm text-destructive'>{createError}</p> : null}
          <Button disabled={createBusy} onClick={handleCreateTeam}>
            {createBusy ? 'Creating...' : 'Create team'}
          </Button>
        </section>

        <section className='tape-surface noir-reveal space-y-3 p-5'>
          <div>
            <p className='text-lg font-semibold text-foreground'>My Invites</p>
            <p className='mt-1 text-sm text-muted-foreground'>Pending and recent team invites.</p>
          </div>

          {(invites ?? []).length === 0 ? (
            <p className='text-sm text-muted-foreground'>No invites.</p>
          ) : (
            <div className='tape-list'>
              {(invites ?? []).map((invite) => (
                <article key={invite.inviteId} className='tape-list-row py-3'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <p className='text-sm font-medium'>{invite.teamName}</p>
                    <Badge variant='outline'>{invite.status}</Badge>
                    <Badge variant='secondary'>{invite.role}</Badge>
                  </div>
                  <p className='mt-1 text-xs text-muted-foreground'>
                    Invited by {invite.invitedByName} ({invite.invitedByIid})
                  </p>
                  {invite.status === 'pending' ? (
                    <div className='mt-2 flex gap-2'>
                      <Button size='sm' onClick={() => handleAcceptInvite(invite.inviteId)}>
                        Accept
                      </Button>
                      <Button size='sm' variant='outline' onClick={() => handleDeclineInvite(invite.inviteId)}>
                        Decline
                      </Button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <section className='tape-surface noir-reveal space-y-4 p-5'>
        <div>
          <p className='text-lg font-semibold text-foreground'>My Teams</p>
          <p className='mt-1 text-sm text-muted-foreground'>Select a team to manage members and invites.</p>
        </div>

        <div className='flex flex-wrap gap-2'>
          {(myTeams ?? []).map((team) => (
            <Button
              key={team.teamId}
              variant={selectedTeamId === team.teamId ? 'default' : 'secondary'}
              onClick={() => setSelectedTeamId(team.teamId)}
            >
              {team.name} ({team.role})
            </Button>
          ))}
        </div>

        <Separator />

        {selectedTeam ? (
          <div className='grid grid-cols-[1.3fr_1fr] gap-5'>
            <section className='space-y-3'>
              <h2 className='noir-kicker'>Members in {selectedTeam.name}</h2>
              {memberActionError ? <p className='text-sm text-destructive'>{memberActionError}</p> : null}

              <div className='tape-list'>
                {(members ?? []).map((member) => (
                  <article key={member.userId} className='tape-list-row py-3'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <span className='text-sm font-medium'>
                        {member.name} ({member.iid})
                      </span>
                      <Badge variant='outline'>{member.role}</Badge>
                    </div>

                    {manager ? (
                      <div className='mt-2 flex flex-wrap items-center gap-2'>
                        <Select
                          value={member.role}
                          onValueChange={(nextRole) =>
                            handleChangeMemberRole(member.userId, nextRole as TeamRole)
                          }
                        >
                          <SelectTrigger className='w-44'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='teamleader'>teamleader</SelectItem>
                            <SelectItem value='senior'>senior</SelectItem>
                            <SelectItem value='mid'>mid</SelectItem>
                            <SelectItem value='junior'>junior</SelectItem>
                            {selectedTeam.role === 'admin' ? (
                              <SelectItem value='admin'>admin</SelectItem>
                            ) : null}
                          </SelectContent>
                        </Select>
                        <Button
                          size='sm'
                          variant='destructive'
                          onClick={() => handleRemoveMember(member.userId)}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>

            <section className='space-y-3'>
              <h2 className='noir-kicker'>Invite by IID</h2>

              {manager ? (
                <div className='space-y-3 bg-secondary/35 p-4'>
                  <div className='grid gap-2'>
                    <Label htmlFor='invite-iid'>User IID</Label>
                    <Input
                      id='invite-iid'
                      value={inviteIid}
                      placeholder='BD-XXXXXX'
                      onChange={(event) => setInviteIid(event.target.value.toUpperCase())}
                    />
                  </div>

                  <div className='grid gap-2'>
                    <Label htmlFor='invite-role'>Role</Label>
                    <Select
                      value={inviteRole}
                      onValueChange={(value) => setInviteRole(value as TeamRole)}
                    >
                      <SelectTrigger id='invite-role'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='teamleader'>teamleader</SelectItem>
                        <SelectItem value='senior'>senior</SelectItem>
                        <SelectItem value='mid'>mid</SelectItem>
                        <SelectItem value='junior'>junior</SelectItem>
                        {selectedTeam.role === 'admin' ? <SelectItem value='admin'>admin</SelectItem> : null}
                      </SelectContent>
                    </Select>
                  </div>

                  {inviteError ? <p className='text-sm text-destructive'>{inviteError}</p> : null}

                  <Button disabled={inviteBusy} onClick={handleInvite}>
                    {inviteBusy ? 'Sending...' : 'Send invite'}
                  </Button>
                </div>
              ) : (
                <p className='text-sm text-muted-foreground'>Only admins and teamleaders can invite users.</p>
              )}
            </section>
          </div>
        ) : (
          <p className='text-sm text-muted-foreground'>You are not in any team yet.</p>
        )}
      </section>
    </AppSidebarShell>
  )
}
