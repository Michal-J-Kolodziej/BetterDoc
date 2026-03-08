import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useMutation, useQuery } from 'convex/react'
import { Copy, Download, FileCode2, RefreshCw, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { AppSidebarShell } from '@/components/layout/app-sidebar-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  InstructionMapPreview,
  InstructionSectionEditor,
  ReviewChecklistEditor,
} from '@/features/instructions/editor'
import {
  cloneInstructionDocument,
  createAngularInstructionDocument,
  serializeInstructionMarkdown,
  type InstructionAuthorshipMode,
  type InstructionDocument,
  type InstructionStatus,
  type InstructionTargetKind,
} from '@/features/instructions/document'
import { userDisplayName } from '@/utils/user-display'
import { api } from '../../convex/_generated/api.js'
import type { Id } from '../../convex/_generated/dataModel'

export const Route = createFileRoute('/instructions')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    instruction: typeof search.instruction === 'string' ? search.instruction : undefined,
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
  component: InstructionsPage,
})

type EditableInstructionState = {
  instructionId: Id<'instructionDocuments'> | null
  title: string
  repoUrl: string
  targetKind: InstructionTargetKind
  targetName: string
  status: InstructionStatus
  authorshipMode: InstructionAuthorshipMode
  document: InstructionDocument
}

type InstructionEditorPanelKey =
  | 'setup'
  | 'structure'
  | 'patterns'
  | 'naming'
  | 'data'
  | 'libraries'
  | 'guardrails'
  | 'review'
  | 'preview'

function createBlankInstructionState(): EditableInstructionState {
  return {
    instructionId: null,
    title: '',
    repoUrl: '',
    targetKind: 'project',
    targetName: '',
    status: 'draft',
    authorshipMode: 'manual',
    document: createAngularInstructionDocument({
      title: 'New Angular Instruction',
      repoUrl: 'https://github.com/example/repo',
      targetKind: 'project',
      targetName: 'app-shell',
    }),
  }
}

function toSlugPart(value: string, fallback: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback
  )
}

function buildInstructionMarkdownFileName(state: Pick<EditableInstructionState, 'title' | 'targetKind' | 'targetName'>): string {
  return `${toSlugPart(state.title, 'instruction')}-${state.targetKind}-${toSlugPart(state.targetName, 'target')}.md`
}

function InstructionsPage() {
  const auth = useAuth()
  const user = auth.user
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const upsertMe = useMutation(api.users.upsertMe)
  const createInstruction = useMutation(api.instructions.createInstruction)
  const updateInstruction = useMutation(api.instructions.updateInstruction)
  const deleteInstruction = useMutation(api.instructions.deleteInstruction)

  const me = useQuery(api.users.getMe, user ? { workosUserId: user.id } : 'skip')
  const instructions = useQuery(
    api.instructions.listMyInstructions,
    user && me
      ? {
          actorWorkosUserId: user.id,
        }
      : 'skip',
  )

  const selectedInstructionId = search.instruction as Id<'instructionDocuments'> | undefined
  const selectedInstruction = useQuery(
    api.instructions.getInstructionDetail,
    user && me && selectedInstructionId
      ? {
          actorWorkosUserId: user.id,
          instructionId: selectedInstructionId,
        }
      : 'skip',
  )

  const [createTitle, setCreateTitle] = useState('')
  const [createRepoUrl, setCreateRepoUrl] = useState('')
  const [createTargetKind, setCreateTargetKind] = useState<InstructionTargetKind>('project')
  const [createTargetName, setCreateTargetName] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [saveBusy, setSaveBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [flashMessage, setFlashMessage] = useState<string | null>(null)

  const [editorState, setEditorState] = useState<EditableInstructionState>(createBlankInstructionState)
  const [hydratedInstructionId, setHydratedInstructionId] = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<InstructionEditorPanelKey>('setup')

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

  useEffect(() => {
    if (!instructions || instructions.length === 0) {
      return
    }

    const selectedExists = selectedInstructionId
      ? instructions.some((instruction) => instruction.instructionId === selectedInstructionId)
      : false

    if (selectedInstructionId && selectedExists) {
      return
    }

    void navigate({
      search: {
        instruction: instructions[0]?.instructionId,
      },
      replace: true,
    })
  }, [instructions, navigate, selectedInstructionId])

  useEffect(() => {
    if (!selectedInstruction || hydratedInstructionId === selectedInstruction.instructionId) {
      return
    }

    setEditorState({
      instructionId: selectedInstruction.instructionId,
      title: selectedInstruction.title,
      repoUrl: selectedInstruction.repoUrl,
      targetKind: selectedInstruction.targetKind,
      targetName: selectedInstruction.targetName,
      status: selectedInstruction.status,
      authorshipMode: selectedInstruction.authorshipMode,
      document: cloneInstructionDocument(selectedInstruction.document),
    })
    setHydratedInstructionId(selectedInstruction.instructionId)
    setActivePanel('setup')
    setSaveError(null)
    setFlashMessage(null)
  }, [hydratedInstructionId, selectedInstruction])

  const markdownFileName = useMemo(
    () =>
      buildInstructionMarkdownFileName({
        title: editorState.title,
        targetKind: editorState.targetKind,
        targetName: editorState.targetName,
      }),
    [editorState.targetKind, editorState.targetName, editorState.title],
  )

  const markdownPreview = useMemo(() => {
    if (!editorState.title.trim() || !editorState.repoUrl.trim() || !editorState.targetName.trim()) {
      return 'Complete the metadata fields to preview the generated Markdown file.'
    }

    return serializeInstructionMarkdown({
      metadata: {
        title: editorState.title.trim(),
        referenceLibrary: 'angular',
        referenceVersion: '21',
        repoUrl: editorState.repoUrl.trim(),
        targetKind: editorState.targetKind,
        targetName: editorState.targetName.trim(),
        markdownFileName,
        status: editorState.status,
        authorshipMode: editorState.authorshipMode,
      },
      document: editorState.document,
    })
  }, [editorState, markdownFileName])

  const totalNodeCount =
    editorState.document.structureNodes.length +
    editorState.document.patternNodes.length +
    editorState.document.namingNodes.length +
    editorState.document.dataHandlingNodes.length +
    editorState.document.libraryNodes.length +
    editorState.document.guardrailNodes.length

  const panelItems: Array<{
    key: InstructionEditorPanelKey
    label: string
    description: string
    count?: number
  }> = [
    {
      key: 'setup',
      label: 'Setup',
      description: 'Metadata and overview',
    },
    {
      key: 'structure',
      label: 'Code Structure',
      description: 'Folder boundaries and ownership',
      count: editorState.document.structureNodes.length,
    },
    {
      key: 'patterns',
      label: 'Code Patterns',
      description: 'Component and DI patterns',
      count: editorState.document.patternNodes.length,
    },
    {
      key: 'naming',
      label: 'Naming Patterns',
      description: 'Conventions and helper naming',
      count: editorState.document.namingNodes.length,
    },
    {
      key: 'data',
      label: 'Data Handling',
      description: 'State and mapping rules',
      count: editorState.document.dataHandlingNodes.length,
    },
    {
      key: 'libraries',
      label: 'Library Usage',
      description: 'Angular and package guidance',
      count: editorState.document.libraryNodes.length,
    },
    {
      key: 'guardrails',
      label: 'Guardrails',
      description: 'Critical constraints',
      count: editorState.document.guardrailNodes.length,
    },
    {
      key: 'review',
      label: 'Review Checklist',
      description: 'Readiness checks',
      count: editorState.document.reviewChecklist.length,
    },
    {
      key: 'preview',
      label: 'Preview',
      description: 'Map and markdown output',
    },
  ]

  const activePanelItem = panelItems.find((panel) => panel.key === activePanel) ?? panelItems[0]

  const activePanelContent = (() => {
    switch (activePanel) {
      case 'setup':
        return (
          <section className='instructions-panel-section'>
            <div className='grid gap-1'>
              <h2 className='text-base font-semibold text-foreground'>Document setup</h2>
              <p className='text-sm text-muted-foreground'>
                Metadata and overview become the frontmatter and opening context of the generated Markdown file.
              </p>
            </div>

            <div className='instructions-form-grid'>
              <div className='grid gap-2'>
                <Label htmlFor='instruction-title'>Title</Label>
                <Input
                  id='instruction-title'
                  value={editorState.title}
                  onChange={(event) => {
                    setEditorState((current) => ({ ...current, title: event.target.value }))
                  }}
                />
              </div>

              <div className='grid gap-2'>
                <Label htmlFor='instruction-repo-url'>Repository URL</Label>
                <Input
                  id='instruction-repo-url'
                  value={editorState.repoUrl}
                  onChange={(event) => {
                    setEditorState((current) => ({ ...current, repoUrl: event.target.value }))
                  }}
                />
              </div>

              <div className='grid gap-2'>
                <Label>Target type</Label>
                <Select
                  value={editorState.targetKind}
                  onValueChange={(value) => {
                    setEditorState((current) => ({
                      ...current,
                      targetKind: value === 'library' ? 'library' : 'project',
                    }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Target type' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='project'>Project</SelectItem>
                    <SelectItem value='library'>Library</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='grid gap-2'>
                <Label htmlFor='instruction-target-name'>Target name</Label>
                <Input
                  id='instruction-target-name'
                  value={editorState.targetName}
                  onChange={(event) => {
                    setEditorState((current) => ({ ...current, targetName: event.target.value }))
                  }}
                />
              </div>

              <div className='grid gap-2'>
                <Label>Status</Label>
                <Select
                  value={editorState.status}
                  onValueChange={(value) => {
                    setEditorState((current) => ({
                      ...current,
                      status: value === 'ready' ? 'ready' : 'draft',
                    }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Status' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='draft'>Draft</SelectItem>
                    <SelectItem value='ready'>Ready</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='grid gap-2'>
                <Label>Last authoring mode</Label>
                <Select
                  value={editorState.authorshipMode}
                  onValueChange={(value) => {
                    setEditorState((current) => ({
                      ...current,
                      authorshipMode: value === 'agent' ? 'agent' : 'manual',
                    }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Authoring mode' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='manual'>Manual</SelectItem>
                    <SelectItem value='agent'>Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='page-divider' />

            <div className='grid gap-1'>
              <h3 className='text-base font-semibold text-foreground'>Overview</h3>
              <p className='text-sm text-muted-foreground'>
                These fields explain the repo boundary, feature scope, and source of truth behind the instruction.
              </p>
            </div>

            <div className='instructions-overview-grid'>
              <OverviewField
                label='Goal'
                value={editorState.document.overview.goal}
                onChange={(value) => {
                  setEditorState((current) => ({
                    ...current,
                    document: {
                      ...current.document,
                      overview: { ...current.document.overview, goal: value },
                    },
                  }))
                }}
              />
              <OverviewField
                label='Repo context'
                value={editorState.document.overview.repoContext}
                onChange={(value) => {
                  setEditorState((current) => ({
                    ...current,
                    document: {
                      ...current.document,
                      overview: { ...current.document.overview, repoContext: value },
                    },
                  }))
                }}
              />
              <OverviewField
                label='Target context'
                value={editorState.document.overview.targetContext}
                onChange={(value) => {
                  setEditorState((current) => ({
                    ...current,
                    document: {
                      ...current.document,
                      overview: { ...current.document.overview, targetContext: value },
                    },
                  }))
                }}
              />
              <OverviewField
                label='Source summary'
                value={editorState.document.overview.sourceSummary}
                onChange={(value) => {
                  setEditorState((current) => ({
                    ...current,
                    document: {
                      ...current.document,
                      overview: { ...current.document.overview, sourceSummary: value },
                    },
                  }))
                }}
              />
            </div>
          </section>
        )
      case 'structure':
        return (
          <InstructionSectionEditor
            sectionKey='structureNodes'
            nodes={editorState.document.structureNodes}
            onChange={(value) => {
              setEditorState((current) => ({
                ...current,
                document: { ...current.document, structureNodes: value },
              }))
            }}
          />
        )
      case 'patterns':
        return (
          <InstructionSectionEditor
            sectionKey='patternNodes'
            nodes={editorState.document.patternNodes}
            onChange={(value) => {
              setEditorState((current) => ({
                ...current,
                document: { ...current.document, patternNodes: value },
              }))
            }}
          />
        )
      case 'naming':
        return (
          <InstructionSectionEditor
            sectionKey='namingNodes'
            nodes={editorState.document.namingNodes}
            onChange={(value) => {
              setEditorState((current) => ({
                ...current,
                document: { ...current.document, namingNodes: value },
              }))
            }}
          />
        )
      case 'data':
        return (
          <InstructionSectionEditor
            sectionKey='dataHandlingNodes'
            nodes={editorState.document.dataHandlingNodes}
            onChange={(value) => {
              setEditorState((current) => ({
                ...current,
                document: { ...current.document, dataHandlingNodes: value },
              }))
            }}
          />
        )
      case 'libraries':
        return (
          <InstructionSectionEditor
            sectionKey='libraryNodes'
            nodes={editorState.document.libraryNodes}
            onChange={(value) => {
              setEditorState((current) => ({
                ...current,
                document: { ...current.document, libraryNodes: value },
              }))
            }}
          />
        )
      case 'guardrails':
        return (
          <InstructionSectionEditor
            sectionKey='guardrailNodes'
            nodes={editorState.document.guardrailNodes}
            onChange={(value) => {
              setEditorState((current) => ({
                ...current,
                document: { ...current.document, guardrailNodes: value },
              }))
            }}
          />
        )
      case 'review':
        return (
          <ReviewChecklistEditor
            reviewChecklist={editorState.document.reviewChecklist}
            onChange={(value) => {
              setEditorState((current) => ({
                ...current,
                document: { ...current.document, reviewChecklist: value },
              }))
            }}
          />
        )
      case 'preview':
        return (
          <section className='instructions-panel-section'>
            <div className='page-toolbar'>
              <div className='grid gap-1'>
                <h2 className='text-base font-semibold text-foreground'>Preview exports</h2>
                <p className='text-sm text-muted-foreground'>
                  Copy the generated Markdown directly or download the canonical file.
                </p>
              </div>

              <div className='page-toolbar-group'>
                <Button type='button' variant='outline' onClick={() => void handleCopyMarkdown()}>
                  <Copy className='h-4 w-4' />
                  Copy Markdown
                </Button>
                <Button type='button' variant='outline' onClick={handleDownloadMarkdown}>
                  <Download className='h-4 w-4' />
                  Download file
                </Button>
              </div>
            </div>

            <InstructionMapPreview document={editorState.document} compact />
            <div className='page-divider' />
            <div className='grid gap-1'>
              <h2 className='text-base font-semibold text-foreground'>Generated Markdown</h2>
              <p className='text-sm text-muted-foreground'>
                Canonical file shape used for agent and editor round-trips. File name: {markdownFileName}
              </p>
            </div>
            <pre className='instruction-markdown-preview instruction-markdown-preview-main'>
              {markdownPreview}
            </pre>
          </section>
        )
      default:
        return null
    }
  })()

  if (auth.loading || !user || !me || !instructions) {
    return (
      <main className='app-shell'>
        <p className='text-sm text-muted-foreground'>Loading instruction workspace...</p>
      </main>
    )
  }

  const handleCreateInstruction = async () => {
    if (!user) {
      return
    }

    setCreateBusy(true)
    setCreateError(null)
    setFlashMessage(null)

    try {
      const created = await createInstruction({
        actorWorkosUserId: user.id,
        title: createTitle,
        repoUrl: createRepoUrl,
        targetKind: createTargetKind,
        targetName: createTargetName,
        authorshipMode: 'manual',
      })

      setCreateTitle('')
      setCreateRepoUrl('')
      setCreateTargetKind('project')
      setCreateTargetName('')
      setHydratedInstructionId(null)
      void navigate({
        search: {
          instruction: created.instructionId,
        },
        replace: true,
      })
      setFlashMessage('Instruction created from the Angular v21 baseline.')
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create instruction.')
    } finally {
      setCreateBusy(false)
    }
  }

  const handleSaveInstruction = async () => {
    if (!user || !editorState.instructionId) {
      return
    }

    setSaveBusy(true)
    setSaveError(null)
    setFlashMessage(null)

    try {
      const updated = await updateInstruction({
        actorWorkosUserId: user.id,
        instructionId: editorState.instructionId,
        title: editorState.title,
        repoUrl: editorState.repoUrl,
        targetKind: editorState.targetKind,
        targetName: editorState.targetName,
        status: editorState.status,
        authorshipMode: editorState.authorshipMode,
        document: editorState.document,
      })

      setEditorState({
        instructionId: updated.instructionId,
        title: updated.title,
        repoUrl: updated.repoUrl,
        targetKind: updated.targetKind,
        targetName: updated.targetName,
        status: updated.status,
        authorshipMode: updated.authorshipMode,
        document: cloneInstructionDocument(updated.document),
      })
      setHydratedInstructionId(updated.instructionId)
      setFlashMessage('Instruction saved as structured Markdown.')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save instruction.')
    } finally {
      setSaveBusy(false)
    }
  }

  const handleDeleteInstruction = async () => {
    if (!user || !editorState.instructionId) {
      return
    }

    setDeleteBusy(true)
    setSaveError(null)
    setFlashMessage(null)

    try {
      const deletedId = editorState.instructionId

      await deleteInstruction({
        actorWorkosUserId: user.id,
        instructionId: deletedId,
      })

      const remaining = (instructions ?? []).filter((instruction) => instruction.instructionId !== deletedId)

      setHydratedInstructionId(null)
      setEditorState(createBlankInstructionState())
      void navigate({
        search: {
          instruction: remaining[0]?.instructionId,
        },
        replace: true,
      })
      setFlashMessage('Instruction removed.')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to delete instruction.')
    } finally {
      setDeleteBusy(false)
    }
  }

  async function handleCopyMarkdown() {
    try {
      await navigator.clipboard.writeText(markdownPreview)
      setSaveError(null)
      setFlashMessage('Markdown copied to clipboard.')
    } catch (error) {
      setFlashMessage(null)
      setSaveError(error instanceof Error ? error.message : 'Failed to copy Markdown.')
    }
  }

  function handleDownloadMarkdown() {
    try {
      const blob = new Blob([markdownPreview], { type: 'text/markdown;charset=utf-8' })
      const url = window.URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = markdownFileName
      window.document.body.append(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      setSaveError(null)
      setFlashMessage(`Downloaded ${markdownFileName}.`)
    } catch (error) {
      setFlashMessage(null)
      setSaveError(error instanceof Error ? error.message : 'Failed to download Markdown.')
    }
  }

  const hasSelection = Boolean(editorState.instructionId)

  return (
    <AppSidebarShell
      activeNav='instructions'
      sectionLabel='Engineering Guidance'
      title='Instructions'
      description='Create user-owned Angular instruction files that agents can generate and the product can still edit as structured sections.'
      actorWorkosUserId={user.id}
      userLabel={userDisplayName(user)}
      userEmail={user.email ?? undefined}
    >
      <section className='instructions-layout'>
        <aside className='instructions-left-rail'>
          <section className='page-card noir-reveal'>
            <div className='grid gap-1'>
              <p className='text-base font-semibold text-foreground'>New instruction</p>
              <p className='text-sm text-muted-foreground'>
                No team is required. Each document starts from the Angular v21 reference profile.
              </p>
            </div>

            <div className='mt-4 grid gap-3'>
              <div className='grid gap-2'>
                <Label htmlFor='create-instruction-title'>Title</Label>
                <Input
                  id='create-instruction-title'
                  value={createTitle}
                  onChange={(event) => setCreateTitle(event.target.value)}
                  placeholder='Payments portal instruction'
                />
              </div>

              <div className='grid gap-2'>
                <Label htmlFor='create-instruction-repo'>Repository URL</Label>
                <Input
                  id='create-instruction-repo'
                  value={createRepoUrl}
                  onChange={(event) => setCreateRepoUrl(event.target.value)}
                  placeholder='https://github.com/acme/platform'
                />
              </div>

              <div className='grid gap-2'>
                <Label>Base reference</Label>
                <div className='flex items-center gap-2 rounded-md border border-border bg-secondary/45 px-3 py-2 text-sm text-foreground'>
                  <Badge variant='secondary'>Angular</Badge>
                  <span>v21</span>
                </div>
              </div>

              <div className='grid gap-3 md:grid-cols-2'>
                <div className='grid gap-2'>
                  <Label>Target type</Label>
                  <Select
                    value={createTargetKind}
                    onValueChange={(value) => {
                      setCreateTargetKind(value === 'library' ? 'library' : 'project')
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Pick target type' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='project'>Project</SelectItem>
                      <SelectItem value='library'>Library</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className='grid gap-2'>
                  <Label htmlFor='create-instruction-target'>Target name</Label>
                  <Input
                    id='create-instruction-target'
                    value={createTargetName}
                    onChange={(event) => setCreateTargetName(event.target.value)}
                    placeholder={createTargetKind === 'project' ? 'portal' : 'shared-ui'}
                  />
                </div>
              </div>

              {createError ? <p className='text-sm text-destructive'>{createError}</p> : null}

              <Button type='button' onClick={handleCreateInstruction} disabled={createBusy}>
                <FileCode2 className='h-4 w-4' />
                {createBusy ? 'Creating...' : 'Create instruction'}
              </Button>
            </div>
          </section>

          <section className='page-card noir-reveal instructions-library-card'>
            <div className='page-toolbar'>
              <div className='grid gap-1'>
                <p className='text-base font-semibold text-foreground'>Your instructions</p>
                <p className='text-sm text-muted-foreground'>
                  Open an existing document or start a fresh Angular guide.
                </p>
              </div>
              <Badge variant='outline'>{instructions.length}</Badge>
            </div>

            <div className='page-list instructions-library-list'>
              {(instructions ?? []).map((instruction) => {
                const active = instruction.instructionId === editorState.instructionId

                return (
                  <button
                    key={instruction.instructionId}
                    type='button'
                    className={`page-list-row w-full text-left transition-colors ${
                      active
                        ? 'instructions-library-row-active bg-secondary/45'
                        : 'hover:bg-secondary/30'
                    }`}
                    onClick={() => {
                      setHydratedInstructionId(null)
                      setFlashMessage(null)
                      setSaveError(null)
                      void navigate({
                        search: {
                          instruction: instruction.instructionId,
                        },
                        replace: true,
                      })
                    }}
                  >
                    <div className='flex flex-wrap items-center gap-2'>
                      <Badge variant={instruction.status === 'ready' ? 'default' : 'outline'}>
                        {instruction.status}
                      </Badge>
                      <span className='page-meta ml-auto'>
                        {new Date(instruction.updatedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className='grid gap-1'>
                      <p className='text-sm font-semibold text-foreground'>{instruction.title}</p>
                      <p className='text-sm text-muted-foreground'>
                        {instruction.targetKind} {instruction.targetName}
                      </p>
                      <p className='truncate text-xs text-muted-foreground'>{instruction.repoUrl}</p>
                    </div>
                  </button>
                )
              })}

              {instructions.length === 0 ? (
                <section className='page-empty'>
                  <p className='text-sm text-muted-foreground'>
                    Create the first instruction to start building a reusable Angular guide.
                  </p>
                </section>
              ) : null}
            </div>
          </section>
        </aside>

        <section className='instructions-main-column'>
          {!hasSelection ? (
            <section className='page-card noir-reveal'>
              <p className='text-base font-semibold text-foreground'>No instruction selected</p>
              <p className='mt-2 text-sm text-muted-foreground'>
                Pick an existing instruction or create a new one from the left column.
              </p>
            </section>
          ) : (
            <>
              {flashMessage ? (
                <section className='instructions-inline-notice'>
                  <p className='text-sm text-foreground'>{flashMessage}</p>
                </section>
              ) : null}

              {saveError ? (
                <section className='instructions-inline-notice instructions-inline-notice-error'>
                  <p className='text-sm text-destructive'>{saveError}</p>
                </section>
              ) : null}

              <section className='page-card noir-reveal instructions-editor-header'>
                <div className='grid gap-2'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <p className='text-lg font-semibold text-foreground'>
                      {editorState.title || 'Untitled instruction'}
                    </p>
                    <Badge variant={editorState.status === 'ready' ? 'default' : 'outline'}>
                      {editorState.status}
                    </Badge>
                  </div>
                  <p className='text-sm text-muted-foreground'>
                    {editorState.targetKind} {editorState.targetName || 'target'} · Angular v21 · {totalNodeCount} nodes · {editorState.document.reviewChecklist.length} checklist items
                  </p>
                  <p className='text-sm text-muted-foreground'>
                    {editorState.repoUrl || 'Set a repository path or URL for this instruction.'}
                  </p>
                </div>

                <div className='page-toolbar-group'>
                  <Button type='button' onClick={handleSaveInstruction} disabled={saveBusy}>
                    <Save className='h-4 w-4' />
                    {saveBusy ? 'Saving...' : 'Save changes'}
                  </Button>

                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => {
                      setEditorState((current) => ({
                        ...current,
                        document: createAngularInstructionDocument({
                          title: current.title || 'Untitled instruction',
                          repoUrl: current.repoUrl || 'https://github.com/example/repo',
                          targetKind: current.targetKind,
                          targetName: current.targetName || 'target',
                        }),
                      }))
                    }}
                  >
                    <RefreshCw className='h-4 w-4' />
                    Reset baseline
                  </Button>

                  <Button
                    type='button'
                    variant='destructive'
                    onClick={handleDeleteInstruction}
                    disabled={deleteBusy}
                  >
                    <Trash2 className='h-4 w-4' />
                    {deleteBusy ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </section>

              <section className='page-card noir-reveal instructions-workbench'>
                <aside className='instructions-section-sidebar'>
                  <div className='grid gap-1'>
                    <p className='text-sm font-semibold text-foreground'>Document sections</p>
                    <p className='text-sm text-muted-foreground'>
                      Work through one part of the instruction at a time.
                    </p>
                  </div>

                  <nav className='instructions-section-nav'>
                    {panelItems.map((panel) => {
                      const active = panel.key === activePanel

                      return (
                        <button
                          key={panel.key}
                          type='button'
                          className={`instructions-section-link ${active ? 'instructions-section-link-active' : ''}`}
                          onClick={() => {
                            setActivePanel(panel.key)
                          }}
                        >
                          <div className='grid gap-0.5 text-left'>
                            <span className='text-sm font-medium text-foreground'>{panel.label}</span>
                            <span className='text-xs text-muted-foreground'>{panel.description}</span>
                          </div>
                          {typeof panel.count === 'number' ? (
                            <span className='page-meta'>{panel.count}</span>
                          ) : null}
                        </button>
                      )
                    })}
                  </nav>
                </aside>

                <div className='instructions-editor-body'>
                  <div className='instructions-editor-body-header'>
                    <div className='grid gap-1'>
                      <p className='text-base font-semibold text-foreground'>{activePanelItem.label}</p>
                      <p className='text-sm text-muted-foreground'>{activePanelItem.description}</p>
                    </div>
                  </div>

                  <div className='instructions-editor-panel'>{activePanelContent}</div>
                </div>
              </section>
            </>
          )}
        </section>
      </section>
    </AppSidebarShell>
  )
}

function OverviewField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className='grid gap-2'>
      <Label>{label}</Label>
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} className='min-h-[144px]' />
    </div>
  )
}
