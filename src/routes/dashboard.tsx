import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useMutation, useQuery } from 'convex/react'
import { Filter, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { parseDashboardSearch, stringifySearchQuery } from '@/lib/search'
import { uploadImageFiles } from '@/lib/uploads'
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

function userDisplayName(user: ReturnType<typeof useAuth>['user']): string {
  if (!user) {
    return 'User'
  }

  const combined = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()

  if (combined) {
    return combined
  }

  if (user.email) {
    return user.email
  }

  return user.id
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
        team: teamSlug,
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
      <main className='mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 px-4 py-8 sm:px-6 lg:px-8'>
        <Card>
          <CardHeader>
            <CardTitle>Loading dashboard...</CardTitle>
          </CardHeader>
        </Card>
      </main>
    )
  }

  const hasTeams = teams.length > 0

  return (
    <main className='mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8'>
      <header className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='space-y-1'>
          <h1 className='text-2xl font-semibold tracking-tight'>Dashboard</h1>
          <p className='text-sm text-muted-foreground'>
            Search active and archived team posts from one place.
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Button variant='outline' asChild>
            <Link to='/teams'>Teams</Link>
          </Button>
          <Button variant='outline' asChild>
            <Link to='/profile'>Profile</Link>
          </Button>
          <Button variant='ghost' asChild>
            <Link to='/logout'>Logout</Link>
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className='space-y-3 p-4'>
          <div className='relative'>
            <Search className='pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground' />
            <Input
              value={searchInput}
              className='pl-9'
              placeholder='Search posts. Try: status:archived team:platform has:image author:BD-XXXXXX'
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <Button variant={parsedSearch.status === 'all' ? 'default' : 'secondary'} size='sm' onClick={() => applyQuickStatus('all')}>
              All
            </Button>
            <Button variant={parsedSearch.status === 'active' ? 'default' : 'secondary'} size='sm' onClick={() => applyQuickStatus('active')}>
              Active
            </Button>
            <Button variant={parsedSearch.status === 'archived' ? 'default' : 'secondary'} size='sm' onClick={() => applyQuickStatus('archived')}>
              Archived
            </Button>

            <Sheet>
              <SheetTrigger asChild>
                <Button size='sm' variant='outline'>
                  <Filter className='h-4 w-4' />
                  Team Filter
                </Button>
              </SheetTrigger>
              <SheetContent side='right'>
                <SheetHeader>
                  <SheetTitle>Team Filter</SheetTitle>
                  <SheetDescription>
                    Limit dashboard results to one team.
                  </SheetDescription>
                </SheetHeader>
                <div className='mt-6 flex flex-col gap-2'>
                  <Button
                    variant={!search.team ? 'default' : 'secondary'}
                    onClick={() => openTeamFilter('')}
                  >
                    All Teams
                  </Button>
                  {teams.map((team) => (
                    <Button
                      key={team.teamId}
                      variant={search.team === team.slug ? 'default' : 'secondary'}
                      onClick={() => openTeamFilter(team.slug)}
                    >
                      {team.name}
                    </Button>
                  ))}
                </div>
              </SheetContent>
            </Sheet>

            <div className='ml-auto'>
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
                    New Post
                  </Button>
                </DialogTrigger>
                <DialogContent className='sm:max-w-xl'>
                  <DialogHeader>
                    <DialogTitle>Create Post</DialogTitle>
                    <DialogDescription>
                      Add a concise issue post to a team board.
                    </DialogDescription>
                  </DialogHeader>

                  <div className='grid gap-3 py-1'>
                    <Select value={createTeamId} onValueChange={setCreateTeamId}>
                      <SelectTrigger>
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

                    <Input
                      placeholder='Short title'
                      value={createTitle}
                      maxLength={120}
                      onChange={(event) => setCreateTitle(event.target.value)}
                    />
                    <Input
                      placeholder='Where the issue occurs'
                      value={createWhere}
                      maxLength={140}
                      onChange={(event) => setCreateWhere(event.target.value)}
                    />
                    <Input
                      placeholder='When it occurs'
                      value={createWhen}
                      maxLength={140}
                      onChange={(event) => setCreateWhen(event.target.value)}
                    />
                    <Textarea
                      placeholder='Issue description'
                      value={createDescription}
                      maxLength={5000}
                      rows={6}
                      onChange={(event) => setCreateDescription(event.target.value)}
                    />
                    <Input
                      type='file'
                      multiple
                      accept='image/jpeg,image/png,image/webp'
                      onChange={(event) => setCreateFiles(Array.from(event.target.files ?? []))}
                    />
                    {createError ? <p className='text-sm text-destructive'>{createError}</p> : null}
                  </div>

                  <DialogFooter>
                    <Button variant='outline' onClick={() => setCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button disabled={createBusy || !createTeamId} onClick={handleCreatePost}>
                      {createBusy ? 'Creating...' : 'Create Post'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {parsedSearch.errors.length > 0 ? (
            <div className='rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
              {parsedSearch.errors.join(' ')}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {!hasTeams ? (
        <Card>
          <CardHeader>
            <CardTitle>Create your first team</CardTitle>
            <CardDescription>
              You need a team before you can create or discuss posts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to='/teams'>Open Team Management</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section className='grid gap-3'>
        {(posts ?? []).map((post) => (
          <Card key={post.postId} className='transition hover:border-primary/50'>
            <CardContent className='flex flex-col gap-3 p-4'>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant={post.status === 'active' ? 'default' : 'secondary'}>
                  {post.status}
                </Badge>
                <Badge variant='outline'>{post.teamName}</Badge>
                <span className='ml-auto text-xs text-muted-foreground'>
                  Updated {formatDate(post.updatedAt)}
                </span>
              </div>

              <div className='space-y-1'>
                <Link
                  className='text-lg font-semibold tracking-tight hover:text-primary'
                  params={{ postId: post.postId }}
                  to='/posts/$postId'
                >
                  {post.title}
                </Link>
                <p className='text-sm text-muted-foreground'>{post.descriptionPreview}</p>
              </div>

              <div className='flex flex-wrap items-center gap-2 text-sm text-muted-foreground'>
                <span>Where: {post.occurrenceWhere}</span>
                <span>When: {post.occurrenceWhen}</span>
              </div>

              <div className='flex flex-wrap items-center gap-3 text-sm'>
                <div className='flex items-center gap-2'>
                  <Avatar className='h-7 w-7'>
                    <AvatarImage src={undefined} alt={post.createdByName} />
                    <AvatarFallback>{post.createdByName.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span>
                    {post.createdByName} ({post.createdByIid})
                  </span>
                </div>
                <span className='text-muted-foreground'>{post.commentCount} comments</span>
                <span className='text-muted-foreground'>{post.imageCount} images</span>
              </div>
            </CardContent>
          </Card>
        ))}

        {posts && posts.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No posts found</CardTitle>
              <CardDescription>
                Try broadening your search or create the first post for this team.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}
      </section>
    </main>
  )
}
