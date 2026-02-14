import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useMutation, useQuery } from 'convex/react'
import { Plus, Search, Shield } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { AppSidebarShell } from '@/components/layout/app-sidebar-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { parseDashboardSearch, stringifySearchQuery } from '@/lib/search'
import { uploadImageFiles } from '@/lib/uploads'
import { userDisplayName } from '@/utils/user-display'
import { api } from '../../convex/_generated/api.js'
import type { Id } from '../../convex/_generated/dataModel'

export const Route = createFileRoute('/dashboard')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' ? search.q : undefined,
    team: typeof search.team === 'string' ? search.team : undefined,
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
  component: DashboardPage,
})

function formatDate(value: number): string {
  return new Date(value).toLocaleString()
}

function DashboardPage() {
  const auth = useAuth()
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const user = auth.user

  const [searchInput, setSearchInput] = useState(search.q ?? '')
  const debouncedSearchInput = useDebouncedValue(searchInput, 250)
  const parsedSearch = useMemo(
    () => parseDashboardSearch(debouncedSearchInput),
    [debouncedSearchInput],
  )

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createWhere, setCreateWhere] = useState('')
  const [createWhen, setCreateWhen] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createTeamId, setCreateTeamId] = useState('')
  const [createFiles, setCreateFiles] = useState<File[]>([])
  const [createError, setCreateError] = useState<string | null>(null)
  const [createBusy, setCreateBusy] = useState(false)

  const upsertMe = useMutation(api.users.upsertMe)
  const createPost = useMutation(api.posts.createPost)
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const attachUploadedFile = useMutation(api.files.attachUploadedFile)

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

  const teams = useMemo(() => me?.teams ?? [], [me?.teams])

  const selectedTeamFromSearch = useMemo(() => {
    const explicit = search.team ?? parsedSearch.team ?? ''

    if (!explicit) {
      return null
    }

    const normalized = explicit.toLowerCase()

    return (
      teams.find(
        (team) =>
          team.slug.toLowerCase() === normalized ||
          team.name.toLowerCase() === normalized,
      ) ?? null
    )
  }, [parsedSearch.team, search.team, teams])

  useEffect(() => {
    if (!createTeamId && teams.length > 0) {
      setCreateTeamId(teams[0].teamId)
    }
  }, [createTeamId, teams])

  const posts = useQuery(
    api.posts.listPosts,
    user && me
      ? {
          actorWorkosUserId: user.id,
          teamId: selectedTeamFromSearch?.teamId,
          searchText: parsedSearch.text || undefined,
          status: parsedSearch.status,
          authorIid: parsedSearch.authorIid ?? undefined,
          hasImage: parsedSearch.hasImage ? true : undefined,
          before: parsedSearch.before ?? undefined,
          after: parsedSearch.after ?? undefined,
          limit: 80,
        }
      : 'skip',
  )

  const applyQuickStatus = (status: 'all' | 'active' | 'archived') => {
    const next = {
      ...parsedSearch,
      status,
    }
    const nextQuery = stringifySearchQuery(next)
    setSearchInput(nextQuery)

    void navigate({
      search: {
        q: nextQuery,
        team: search.team,
      },
      replace: true,
    })
  }

  const onSearchChange = (value: string) => {
    setSearchInput(value)
    void navigate({
      search: {
        q: value,
        team: search.team,
      },
      replace: true,
    })
  }

  const openTeamFilter = (teamSlug: string | '') => {
    void navigate({
      search: {
        q: searchInput,
        team: teamSlug || undefined,
      },
      replace: true,
    })
  }

  const resetCreatePostForm = () => {
    setCreateTitle('')
    setCreateWhere('')
    setCreateWhen('')
    setCreateDescription('')
    setCreateFiles([])
    setCreateError(null)
  }

  const handleCreatePost = async () => {
    if (!user || !createTeamId) {
      return
    }

    setCreateBusy(true)
    setCreateError(null)

    try {
      let imageStorageIds: Id<'_storage'>[] = []

      if (createFiles.length > 0) {
        const uploaded = await uploadImageFiles({
          files: createFiles,
          actorWorkosUserId: user.id,
          generateUploadUrl,
          attachUploadedFile,
        })
        imageStorageIds = uploaded.storageIds
      }

      const result = await createPost({
        actorWorkosUserId: user.id,
        teamId: createTeamId as Id<'teams'>,
        title: createTitle,
        occurrenceWhere: createWhere,
        occurrenceWhen: createWhen,
        description: createDescription,
        imageStorageIds,
      })

      setCreateDialogOpen(false)
      resetCreatePostForm()

      void navigate({
        to: '/posts/$postId',
        params: {
          postId: result.postId,
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create post.'
      setCreateError(message)
    } finally {
      setCreateBusy(false)
    }
  }

  if (auth.loading || !user || !me) {
    return (
      <main className='app-shell'>
        <Card className='noir-reveal'>
          <CardHeader>
            <CardTitle>Loading dashboard...</CardTitle>
          </CardHeader>
        </Card>
      </main>
    )
  }

  const hasTeams = teams.length > 0
  const currentUserLabel = userDisplayName(user)

  return (
    <AppSidebarShell
      activeNav='dashboard'
      sectionLabel='Team Board'
      title='Dashboard'
      description='Search active and archived team posts from one place.'
      userLabel={currentUserLabel}
      userEmail={user.email ?? undefined}
    >
      <Card className='noir-reveal'>
        <CardContent className='space-y-4 p-5'>
          <div className='flex items-center gap-3'>
            <div className='relative flex-1'>
              <Search className='pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground' />
              <Input
                value={searchInput}
                className='pl-9'
                placeholder='Search posts. Try: status:archived team:platform has:image author:BD-XXXXXX'
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </div>

            <Dialog
              open={createDialogOpen}
              onOpenChange={(open) => {
                setCreateDialogOpen(open)
                if (!open) {
                  resetCreatePostForm()
                }
              }}
            >
              <DialogTrigger asChild>
                <Button disabled={!hasTeams}>
                  <Plus className='h-4 w-4' />
                  New post
                </Button>
              </DialogTrigger>
              <DialogContent className='max-w-2xl'>
                <DialogHeader>
                  <DialogTitle>Create Post</DialogTitle>
                  <DialogDescription>Add a concise issue post to a team board.</DialogDescription>
                </DialogHeader>

                <div className='grid gap-3 py-1'>
                  <div className='grid gap-2'>
                    <Label htmlFor='create-team'>Team</Label>
                    <Select value={createTeamId} onValueChange={setCreateTeamId}>
                      <SelectTrigger id='create-team'>
                        <SelectValue placeholder='Select a team' />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((team) => (
                          <SelectItem key={team.teamId} value={team.teamId}>
                            {team.name} ({team.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className='grid gap-2'>
                    <Label htmlFor='create-title'>Title</Label>
                    <Input
                      id='create-title'
                      placeholder='Short title'
                      value={createTitle}
                      maxLength={120}
                      onChange={(event) => setCreateTitle(event.target.value)}
                    />
                  </div>

                  <div className='grid grid-cols-2 gap-2'>
                    <div className='grid gap-2'>
                      <Label htmlFor='create-where'>Where</Label>
                      <Input
                        id='create-where'
                        placeholder='Where the issue occurs'
                        value={createWhere}
                        maxLength={140}
                        onChange={(event) => setCreateWhere(event.target.value)}
                      />
                    </div>
                    <div className='grid gap-2'>
                      <Label htmlFor='create-when'>When</Label>
                      <Input
                        id='create-when'
                        placeholder='When it occurs'
                        value={createWhen}
                        maxLength={140}
                        onChange={(event) => setCreateWhen(event.target.value)}
                      />
                    </div>
                  </div>

                  <div className='grid gap-2'>
                    <Label htmlFor='create-description'>Description</Label>
                    <Textarea
                      id='create-description'
                      placeholder='Issue description'
                      value={createDescription}
                      maxLength={5000}
                      rows={6}
                      onChange={(event) => setCreateDescription(event.target.value)}
                    />
                  </div>

                  <div className='grid gap-2'>
                    <Label htmlFor='create-files'>Attachments</Label>
                    <Input
                      id='create-files'
                      type='file'
                      multiple
                      accept='image/jpeg,image/png,image/webp'
                      onChange={(event) => setCreateFiles(Array.from(event.target.files ?? []))}
                    />
                  </div>

                  {createError ? <p className='text-sm text-destructive'>{createError}</p> : null}
                </div>

                <DialogFooter>
                  <Button variant='outline' onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button disabled={createBusy || !createTeamId} onClick={handleCreatePost}>
                    {createBusy ? 'Creating...' : 'Create post'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <Button
              variant={parsedSearch.status === 'all' ? 'default' : 'secondary'}
              size='sm'
              onClick={() => applyQuickStatus('all')}
            >
              All
            </Button>
            <Button
              variant={parsedSearch.status === 'active' ? 'default' : 'secondary'}
              size='sm'
              onClick={() => applyQuickStatus('active')}
            >
              Active
            </Button>
            <Button
              variant={parsedSearch.status === 'archived' ? 'default' : 'secondary'}
              size='sm'
              onClick={() => applyQuickStatus('archived')}
            >
              Archived
            </Button>

            <div className='ml-auto flex min-w-[220px] items-center gap-2'>
              <Shield className='h-4 w-4 text-muted-foreground' />
              <Select
                value={selectedTeamFromSearch?.slug ?? '__all__'}
                onValueChange={(value) => openTeamFilter(value === '__all__' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder='All teams' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__all__'>All teams</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.teamId} value={team.slug}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {parsedSearch.errors.length > 0 ? (
            <div className='rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
              {parsedSearch.errors.join(' ')}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {!hasTeams ? (
        <Card className='noir-reveal'>
          <CardHeader>
            <CardTitle>Create your first team</CardTitle>
            <CardDescription>You need a team before you can create or discuss posts.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to='/teams'>Open Team Management</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section className='grid gap-2'>
        {(posts ?? []).map((post) => (
          <Card key={post.postId} className='noir-reveal overflow-hidden border-border/75 transition-colors hover:border-primary/45'>
            <CardContent className='p-0'>
              <article className='grid gap-3 px-4 py-3'>
                <div className='flex flex-wrap items-center gap-2'>
                  <Badge variant={post.status === 'active' ? 'default' : 'secondary'}>{post.status}</Badge>
                  <Badge variant='outline'>{post.teamName}</Badge>
                  <span className='ml-auto text-xs text-muted-foreground'>
                    Updated {formatDate(post.updatedAt)}
                  </span>
                </div>

                <div className='space-y-1'>
                  <Link
                    className='inline-flex text-base font-semibold text-foreground transition-colors hover:text-primary'
                    params={{ postId: post.postId }}
                    to='/posts/$postId'
                  >
                    {post.title}
                  </Link>
                  <p className='text-sm leading-6 text-muted-foreground'>{post.descriptionPreview}</p>
                </div>

                <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
                  <span className='rounded bg-secondary/70 px-2 py-1'>Where: {post.occurrenceWhere}</span>
                  <span className='rounded bg-secondary/70 px-2 py-1'>When: {post.occurrenceWhen}</span>
                </div>

                <div className='flex flex-wrap items-center gap-3 text-xs text-muted-foreground'>
                  <span>
                    {post.createdByName} ({post.createdByIid})
                  </span>
                  <span>{post.commentCount} comments</span>
                  <span>{post.imageCount} images</span>
                </div>
              </article>
            </CardContent>
          </Card>
        ))}

        {posts && posts.length === 0 ? (
          <Card className='noir-reveal'>
            <CardHeader>
              <CardTitle>No posts found</CardTitle>
              <CardDescription>
                Try broadening your search or create the first post for this team.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}
      </section>
    </AppSidebarShell>
  )
}
