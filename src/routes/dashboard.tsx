import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useMutation, useQuery } from 'convex/react'
import { Plus, Search, Shield } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { AppSidebarShell } from '@/components/layout/app-sidebar-shell'
import { MentionTextarea } from '@/components/mentions/mention-textarea'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { parseDashboardSearch, stringifySearchQuery } from '@/lib/search'
import {
  buildSimilarComposerInput,
  shouldShowPossibleDuplicateWarning,
  shouldShowSimilarIncidentsPanel,
} from '@/lib/similar-incidents'
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

function formatMatchScore(value: number): string {
  return `${String(Math.round(value * 100))}%`
}

function isCreateDraftEmpty(values: {
  title: string
  occurrenceWhere: string
  occurrenceWhen: string
  description: string
}): boolean {
  return (
    values.title.trim().length === 0 &&
    values.occurrenceWhere.trim().length === 0 &&
    values.occurrenceWhen.trim().length === 0 &&
    values.description.trim().length === 0
  )
}

function buildCreateDraftFingerprint(values: {
  teamId: string
  title: string
  occurrenceWhere: string
  occurrenceWhen: string
  description: string
}): string {
  return JSON.stringify(values)
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

  const [templateName, setTemplateName] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateBusy, setTemplateBusy] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [draftHydratedTeamId, setDraftHydratedTeamId] = useState<string | null>(null)
  const createDraftFingerprintRef = useRef('')

  const upsertMe = useMutation(api.users.upsertMe)
  const createPost = useMutation(api.posts.createPost)
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const attachUploadedFile = useMutation(api.files.attachUploadedFile)

  const createTemplate = useMutation(api.templates.createTemplate)
  const updateTemplate = useMutation(api.templates.updateTemplate)
  const deleteTemplate = useMutation(api.templates.deleteTemplate)

  const upsertPostDraft = useMutation(api.drafts.upsertPostDraft)
  const deletePostDraft = useMutation(api.drafts.deletePostDraft)

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

  const teamTemplates = useQuery(
    api.templates.listTeamTemplates,
    user && createDialogOpen && createTeamId
      ? {
          actorWorkosUserId: user.id,
          teamId: createTeamId as Id<'teams'>,
        }
      : 'skip',
  )

  const postDraft = useQuery(
    api.drafts.getPostDraft,
    user && createDialogOpen && createTeamId
      ? {
          actorWorkosUserId: user.id,
          teamId: createTeamId as Id<'teams'>,
          sourcePostId: null,
        }
      : 'skip',
  )

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

  const debouncedCreateTitle = useDebouncedValue(createTitle, 1500)
  const debouncedCreateWhere = useDebouncedValue(createWhere, 1500)
  const debouncedCreateWhen = useDebouncedValue(createWhen, 1500)
  const debouncedCreateDescription = useDebouncedValue(createDescription, 1500)
  const debouncedSimilarTitle = useDebouncedValue(createTitle, 350)
  const debouncedSimilarWhere = useDebouncedValue(createWhere, 350)
  const debouncedSimilarWhen = useDebouncedValue(createWhen, 350)
  const debouncedSimilarDescription = useDebouncedValue(createDescription, 350)

  const createSimilarityInput = useMemo(
    () => ({
      title: createTitle,
      occurrenceWhere: createWhere,
      occurrenceWhen: createWhen,
      description: createDescription,
    }),
    [createDescription, createTitle, createWhen, createWhere],
  )
  const shouldShowSimilarPanel = createDialogOpen && shouldShowSimilarIncidentsPanel(createSimilarityInput)

  const similarPosts = useQuery(
    api.posts.findSimilar,
    user && createDialogOpen && createTeamId && shouldShowSimilarPanel
      ? {
          actorWorkosUserId: user.id,
          teamId: createTeamId as Id<'teams'>,
          title: debouncedSimilarTitle,
          occurrenceWhere: debouncedSimilarWhere,
          occurrenceWhen: debouncedSimilarWhen,
          description: debouncedSimilarDescription,
        }
      : 'skip',
  )

  useEffect(() => {
    if (!createDialogOpen || !createTeamId) {
      return
    }

    setSelectedTemplateId('')
    setTemplateName('')
    setTemplateError(null)
    setDraftError(null)
    setDraftHydratedTeamId(null)
    createDraftFingerprintRef.current = ''
  }, [createDialogOpen, createTeamId])

  useEffect(() => {
    if (!createDialogOpen || !createTeamId) {
      return
    }

    if (postDraft === undefined || draftHydratedTeamId === createTeamId) {
      return
    }

    if (postDraft) {
      setCreateTitle(postDraft.title)
      setCreateWhere(postDraft.occurrenceWhere)
      setCreateWhen(postDraft.occurrenceWhen)
      setCreateDescription(postDraft.description)
    } else {
      setCreateTitle('')
      setCreateWhere('')
      setCreateWhen('')
      setCreateDescription('')
    }

    setCreateFiles([])
    setDraftError(null)

    createDraftFingerprintRef.current = buildCreateDraftFingerprint({
      teamId: createTeamId,
      title: postDraft?.title ?? '',
      occurrenceWhere: postDraft?.occurrenceWhere ?? '',
      occurrenceWhen: postDraft?.occurrenceWhen ?? '',
      description: postDraft?.description ?? '',
    })

    setDraftHydratedTeamId(createTeamId)
  }, [createDialogOpen, createTeamId, draftHydratedTeamId, postDraft])

  useEffect(() => {
    if (!createDialogOpen || !user || !createTeamId) {
      return
    }

    if (draftHydratedTeamId !== createTeamId) {
      return
    }

    const snapshot = {
      teamId: createTeamId,
      title: debouncedCreateTitle,
      occurrenceWhere: debouncedCreateWhere,
      occurrenceWhen: debouncedCreateWhen,
      description: debouncedCreateDescription,
    }
    const fingerprint = buildCreateDraftFingerprint(snapshot)

    if (fingerprint === createDraftFingerprintRef.current) {
      return
    }

    if (isCreateDraftEmpty(snapshot)) {
      void deletePostDraft({
        actorWorkosUserId: user.id,
        teamId: createTeamId as Id<'teams'>,
        sourcePostId: null,
      })
        .then(() => {
          createDraftFingerprintRef.current = fingerprint
          setDraftError(null)
        })
        .catch((error) => {
          setDraftError(error instanceof Error ? error.message : 'Failed to clear draft.')
        })

      return
    }

    void upsertPostDraft({
      actorWorkosUserId: user.id,
      teamId: createTeamId as Id<'teams'>,
      sourcePostId: null,
      title: snapshot.title,
      occurrenceWhere: snapshot.occurrenceWhere,
      occurrenceWhen: snapshot.occurrenceWhen,
      description: snapshot.description,
    })
      .then(() => {
        createDraftFingerprintRef.current = fingerprint
        setDraftError(null)
      })
      .catch((error) => {
        setDraftError(error instanceof Error ? error.message : 'Failed to save draft.')
      })
  }, [
    createDialogOpen,
    createTeamId,
    debouncedCreateDescription,
    debouncedCreateTitle,
    debouncedCreateWhen,
    debouncedCreateWhere,
    deletePostDraft,
    draftHydratedTeamId,
    upsertPostDraft,
    user,
  ])

  useEffect(() => {
    if (!selectedTemplateId || !teamTemplates) {
      return
    }

    const selected = teamTemplates.find((template) => template.templateId === selectedTemplateId)

    if (!selected) {
      return
    }

    setCreateTitle(selected.title)
    setCreateWhere(selected.occurrenceWhere)
    setCreateWhen(selected.occurrenceWhen)
    setCreateDescription(selected.description)
    setTemplateName(selected.name)
  }, [selectedTemplateId, teamTemplates])

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
    setTemplateName('')
    setSelectedTemplateId('')
    setCreateError(null)
    setTemplateError(null)
    setDraftError(null)
    setDraftHydratedTeamId(null)
    createDraftFingerprintRef.current = ''
  }

  const handleSaveTemplate = async () => {
    if (!user || !createTeamId) {
      return
    }

    setTemplateBusy(true)
    setTemplateError(null)

    try {
      const created = await createTemplate({
        actorWorkosUserId: user.id,
        teamId: createTeamId as Id<'teams'>,
        name: templateName,
        title: createTitle,
        occurrenceWhere: createWhere,
        occurrenceWhen: createWhen,
        description: createDescription,
      })

      setSelectedTemplateId(created.templateId)
      setTemplateName(created.name)
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : 'Failed to save template.')
    } finally {
      setTemplateBusy(false)
    }
  }

  const handleUpdateTemplate = async () => {
    if (!user || !selectedTemplateId) {
      return
    }

    setTemplateBusy(true)
    setTemplateError(null)

    try {
      const updated = await updateTemplate({
        actorWorkosUserId: user.id,
        templateId: selectedTemplateId as Id<'postTemplates'>,
        name: templateName,
        title: createTitle,
        occurrenceWhere: createWhere,
        occurrenceWhen: createWhen,
        description: createDescription,
      })

      setTemplateName(updated.name)
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : 'Failed to update template.')
    } finally {
      setTemplateBusy(false)
    }
  }

  const handleDeleteTemplate = async () => {
    if (!user || !selectedTemplateId) {
      return
    }

    setTemplateBusy(true)
    setTemplateError(null)

    try {
      await deleteTemplate({
        actorWorkosUserId: user.id,
        templateId: selectedTemplateId as Id<'postTemplates'>,
      })

      setSelectedTemplateId('')
      setTemplateName('')
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : 'Failed to delete template.')
    } finally {
      setTemplateBusy(false)
    }
  }

  const handleDiscardPostDraft = async () => {
    if (!user || !createTeamId) {
      return
    }

    try {
      await deletePostDraft({
        actorWorkosUserId: user.id,
        teamId: createTeamId as Id<'teams'>,
        sourcePostId: null,
      })
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : 'Failed to discard draft.')
      return
    }

    setCreateTitle('')
    setCreateWhere('')
    setCreateWhen('')
    setCreateDescription('')
    setCreateFiles([])
    setDraftError(null)

    createDraftFingerprintRef.current = buildCreateDraftFingerprint({
      teamId: createTeamId,
      title: '',
      occurrenceWhere: '',
      occurrenceWhen: '',
      description: '',
    })
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

      await deletePostDraft({
        actorWorkosUserId: user.id,
        teamId: createTeamId as Id<'teams'>,
        sourcePostId: null,
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
        <p className='text-sm text-muted-foreground'>Loading dashboard...</p>
      </main>
    )
  }

  const hasTeams = teams.length > 0
  const currentUserLabel = userDisplayName(user)
  const templates = teamTemplates ?? []
  const similarInputPreview = buildSimilarComposerInput(createSimilarityInput)
  const hasPossibleDuplicateWarning = shouldShowPossibleDuplicateWarning(similarPosts?.[0]?.score)

  return (
    <AppSidebarShell
      activeNav='dashboard'
      sectionLabel='Team Board'
      title='Dashboard'
      description='Search active and archived team posts from one place.'
      actorWorkosUserId={user.id}
      userLabel={currentUserLabel}
      userEmail={user.email ?? undefined}
    >
      <section className='noir-reveal space-y-4 border-b border-border/50 pb-5'>
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
                <DialogDescription>
                  Add a concise issue post to a team board. Drafts autosave every 1.5 seconds.
                </DialogDescription>
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
                  <Label htmlFor='create-template-select'>Template</Label>
                  <Select
                    value={selectedTemplateId || '__none__'}
                    onValueChange={(value) => setSelectedTemplateId(value === '__none__' ? '' : value)}
                  >
                    <SelectTrigger id='create-template-select'>
                      <SelectValue placeholder='Choose a template' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='__none__'>No template</SelectItem>
                      {templates.map((template) => (
                        <SelectItem key={template.templateId} value={template.templateId}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className='grid gap-2'>
                  <Label htmlFor='create-template-name'>Template name</Label>
                  <Input
                    id='create-template-name'
                    placeholder='Example: API incident baseline'
                    value={templateName}
                    maxLength={80}
                    onChange={(event) => setTemplateName(event.target.value)}
                  />
                </div>

                <div className='flex flex-wrap gap-2'>
                  <Button
                    variant='secondary'
                    type='button'
                    disabled={templateBusy || !createTeamId}
                    onClick={handleSaveTemplate}
                  >
                    Save as template
                  </Button>
                  <Button
                    variant='outline'
                    type='button'
                    disabled={templateBusy || !selectedTemplateId}
                    onClick={handleUpdateTemplate}
                  >
                    Update selected
                  </Button>
                  <Button
                    variant='destructive'
                    type='button'
                    disabled={templateBusy || !selectedTemplateId}
                    onClick={handleDeleteTemplate}
                  >
                    Delete selected
                  </Button>
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
                  <MentionTextarea
                    actorWorkosUserId={user.id}
                    teamId={createTeamId}
                    id='create-description'
                    placeholder='Issue description'
                    value={createDescription}
                    maxLength={5000}
                    rows={6}
                    onChange={setCreateDescription}
                  />
                </div>

                {shouldShowSimilarPanel ? (
                  <section className='grid gap-2 rounded-sm border border-border/60 bg-muted/20 px-3 py-3'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <p className='text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
                        Similar incidents
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        Input length {String(similarInputPreview.length)}
                      </p>
                      {hasPossibleDuplicateWarning ? (
                        <Badge variant='destructive' className='ml-auto'>
                          Possible duplicate
                        </Badge>
                      ) : null}
                    </div>

                    {similarPosts === undefined ? (
                      <p className='text-sm text-muted-foreground'>Checking for similar incidents...</p>
                    ) : similarPosts.length === 0 ? (
                      <p className='text-sm text-muted-foreground'>
                        No close matches found in this team yet.
                      </p>
                    ) : (
                      <div className='tape-list'>
                        {similarPosts.map((similar) => (
                          <article key={similar.postId} className='tape-list-row grid gap-1 py-2'>
                            <div className='flex flex-wrap items-center gap-2'>
                              <Link
                                className='text-sm font-semibold text-foreground transition-colors hover:text-primary'
                                params={{ postId: similar.postId }}
                                to='/posts/$postId'
                                onClick={() => setCreateDialogOpen(false)}
                              >
                                {similar.title}
                              </Link>
                              <Badge variant={similar.status === 'active' ? 'default' : 'secondary'}>
                                {similar.status}
                              </Badge>
                              <span className='ml-auto text-xs text-muted-foreground'>
                                Match {formatMatchScore(similar.score)}
                              </span>
                            </div>
                            <p className='text-xs text-muted-foreground'>
                              {similar.occurrenceWhere} | {similar.occurrenceWhen}
                            </p>
                            <p className='text-xs text-muted-foreground'>{similar.reasons.join(' | ')}</p>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                ) : null}

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

                {templateError ? <p className='text-sm text-destructive'>{templateError}</p> : null}
                {draftError ? <p className='text-sm text-destructive'>{draftError}</p> : null}
                {createError ? <p className='text-sm text-destructive'>{createError}</p> : null}
              </div>

              <DialogFooter>
                <Button variant='secondary' type='button' onClick={handleDiscardPostDraft}>
                  Discard draft
                </Button>
                <Button variant='outline' type='button' onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button disabled={createBusy || !createTeamId} type='button' onClick={handleCreatePost}>
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
          <div className='rounded-sm bg-destructive/12 px-3 py-2 text-sm text-destructive'>
            {parsedSearch.errors.join(' ')}
          </div>
        ) : null}
      </section>

      {!hasTeams ? (
        <section className='noir-reveal tape-surface px-5 py-4'>
          <p className='text-base font-semibold text-foreground'>Create your first team</p>
          <p className='mt-1 text-sm text-muted-foreground'>
            You need a team before you can create or discuss posts.
          </p>
          <Button asChild className='mt-4'>
            <Link to='/teams'>Open Team Management</Link>
          </Button>
        </section>
      ) : null}

      <section className='tape-list noir-reveal'>
        {(posts ?? []).map((post) => (
          <article key={post.postId} className='tape-list-row grid gap-3 px-4 py-4'>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge variant={post.status === 'active' ? 'default' : 'secondary'}>{post.status}</Badge>
              <Badge variant='outline'>{post.teamName}</Badge>
              <span className='ml-auto tape-meta'>Updated {formatDate(post.updatedAt)}</span>
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

            <p className='tape-meta'>
              {post.occurrenceWhere} | {post.occurrenceWhen} | {post.createdByName} ({post.createdByIid}) |{' '}
              {post.commentCount} comments | {post.imageCount} images
            </p>
          </article>
        ))}

        {posts && posts.length === 0 ? (
          <section className='px-4 py-6'>
            <p className='text-base font-semibold text-foreground'>No posts found</p>
            <p className='mt-1 text-sm text-muted-foreground'>
              Try broadening your search or create the first post for this team.
            </p>
          </section>
        ) : null}
      </section>
    </AppSidebarShell>
  )
}
