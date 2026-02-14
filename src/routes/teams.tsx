import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
      <main className='mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 lg:px-8'>
        <Card>
          <CardHeader>
            <CardTitle>Loading teams...</CardTitle>
          </CardHeader>
        </Card>
      </main>
    )
  }

  const manager = canManage(selectedTeam?.role)

  return (
    <main className='mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8'>
      <header className='space-y-1'>
        <h1 className='text-2xl font-semibold tracking-tight'>Teams</h1>
        <p className='text-sm text-muted-foreground'>
          Create teams, invite users by IID, and manage member roles.
        </p>
      </header>

      <div className='grid gap-4 lg:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>Create Team</CardTitle>
            <CardDescription>You become admin of teams you create.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            <Input
              value={createName}
              maxLength={80}
              placeholder='Team name'
              onChange={(event) => setCreateName(event.target.value)}
            />
            {createError ? <p className='text-sm text-destructive'>{createError}</p> : null}
            <Button disabled={createBusy} onClick={handleCreateTeam}>
              {createBusy ? 'Creating...' : 'Create Team'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My Invites</CardTitle>
            <CardDescription>Pending and recent team invites.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            {(invites ?? []).length === 0 ? (
              <p className='text-sm text-muted-foreground'>No invites.</p>
            ) : (
              (invites ?? []).map((invite) => (
                <div key={invite.inviteId} className='rounded-md border p-3'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <p className='text-sm font-medium'>{invite.teamName}</p>
                    <Badge variant='outline'>{invite.status}</Badge>
                    <Badge>{invite.role}</Badge>
                  </div>
                  <p className='mt-1 text-xs text-muted-foreground'>
                    Invited by {invite.invitedByName} ({invite.invitedByIid})
                  </p>
                  {invite.status === 'pending' ? (
                    <div className='mt-2 flex gap-2'>
                      <Button size='sm' onClick={() => handleAcceptInvite(invite.inviteId)}>
                        Accept
                      </Button>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => handleDeclineInvite(invite.inviteId)}
                      >
                        Decline
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Teams</CardTitle>
          <CardDescription>Select a team to manage members and invites.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
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
            <div className='grid gap-4 lg:grid-cols-2'>
              <div className='space-y-3'>
                <h2 className='text-sm font-semibold uppercase tracking-wide text-muted-foreground'>
                  Members in {selectedTeam.name}
                </h2>
                {memberActionError ? (
                  <p className='text-sm text-destructive'>{memberActionError}</p>
                ) : null}
                {(members ?? []).map((member) => (
                  <div key={member.userId} className='rounded-md border p-3'>
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
                  </div>
                ))}
              </div>

              <div className='space-y-3'>
                <h2 className='text-sm font-semibold uppercase tracking-wide text-muted-foreground'>
                  Invite by IID
                </h2>
                {manager ? (
                  <>
                    <Input
                      value={inviteIid}
                      placeholder='BD-XXXXXX'
                      onChange={(event) => setInviteIid(event.target.value.toUpperCase())}
                    />
                    <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as TeamRole)}>
                      <SelectTrigger>
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
                    {inviteError ? <p className='text-sm text-destructive'>{inviteError}</p> : null}
                    <Button disabled={inviteBusy} onClick={handleInvite}>
                      {inviteBusy ? 'Sending...' : 'Send Invite'}
                    </Button>
                  </>
                ) : (
                  <p className='text-sm text-muted-foreground'>
                    Only admins and teamleaders can invite users.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className='text-sm text-muted-foreground'>You are not in any team yet.</p>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
