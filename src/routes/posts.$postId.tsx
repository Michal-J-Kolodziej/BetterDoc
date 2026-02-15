import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useMutation, useQuery } from 'convex/react'
import { BookCopy, CheckCheck, PencilLine, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { AppSidebarShell } from '@/components/layout/app-sidebar-shell'
import { MentionTextarea } from '@/components/mentions/mention-textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { uploadImageFiles } from '@/lib/uploads'
import { userDisplayName } from '@/utils/user-display'
import { api } from '../../convex/_generated/api.js'
import type { Id } from '../../convex/_generated/dataModel'

export const Route = createFileRoute('/posts/$postId')({
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
  component: PostDetailPage,
})

function formatDate(value: number): string {
  return new Date(value).toLocaleString()
}

function buildCommentDraftFingerprint(values: { postId: string; body: string }): string {
  return JSON.stringify(values)
}

function PostDetailPage() {
  const params = Route.useParams()
  const navigate = Route.useNavigate()
  const auth = useAuth()
  const user = auth.user

  const postDetail = useQuery(
    api.posts.getPostDetail,
    user
      ? {
          actorWorkosUserId: user.id,
          postId: params.postId as Id<'posts'>,
        }
      : 'skip',
  )

  const commentDraft = useQuery(
    api.drafts.getCommentDraft,
    user
      ? {
          actorWorkosUserId: user.id,
          postId: params.postId as Id<'posts'>,
        }
      : 'skip',
  )

  const updatePost = useMutation(api.posts.updatePost)
  const archivePost = useMutation(api.posts.archivePost)
  const unarchivePost = useMutation(api.posts.unarchivePost)
  const resolvePost = useMutation(api.posts.resolvePost)
  const reopenPost = useMutation(api.posts.reopenPost)
  const promoteFromPost = useMutation(api.playbooks.promoteFromPost)

  const createComment = useMutation(api.comments.createComment)
  const updateComment = useMutation(api.comments.updateComment)
  const deleteComment = useMutation(api.comments.deleteComment)

  const upsertCommentDraft = useMutation(api.drafts.upsertCommentDraft)
  const deleteCommentDraft = useMutation(api.drafts.deleteCommentDraft)

  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const attachUploadedFile = useMutation(api.files.attachUploadedFile)

  const [editingPost, setEditingPost] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editWhere, setEditWhere] = useState('')
  const [editWhen, setEditWhen] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [resolutionSummary, setResolutionSummary] = useState('')
  const [resolvingPost, setResolvingPost] = useState(false)
  const [resolutionBusy, setResolutionBusy] = useState(false)
  const [promoteBusy, setPromoteBusy] = useState(false)
  const [editFiles, setEditFiles] = useState<File[]>([])
  const [editError, setEditError] = useState<string | null>(null)
  const [editBusy, setEditBusy] = useState(false)

  const [commentBody, setCommentBody] = useState('')
  const [commentFiles, setCommentFiles] = useState<File[]>([])
  const [commentError, setCommentError] = useState<string | null>(null)
  const [commentBusy, setCommentBusy] = useState(false)
  const [commentDraftError, setCommentDraftError] = useState<string | null>(null)
  const [commentDraftHydratedPostId, setCommentDraftHydratedPostId] = useState<string | null>(null)
  const commentDraftFingerprintRef = useRef('')

  const [editingCommentId, setEditingCommentId] = useState<Id<'comments'> | null>(null)
  const [editingCommentBody, setEditingCommentBody] = useState('')
  const [editingCommentFiles, setEditingCommentFiles] = useState<File[]>([])
  const [editingCommentBusy, setEditingCommentBusy] = useState(false)
  const [editingCommentError, setEditingCommentError] = useState<string | null>(null)

  const debouncedCommentBody = useDebouncedValue(commentBody, 1500)
  const postImages = useMemo(() => postDetail?.imageUrls ?? [], [postDetail?.imageUrls])

  useEffect(() => {
    if (!postDetail) {
      return
    }

    setResolutionSummary(postDetail.resolutionSummary ?? '')
  }, [postDetail])

  useEffect(() => {
    if (postDetail?.status === 'active') {
      return
    }

    setResolvingPost(false)
    setEditingCommentId(null)
  }, [postDetail?.status])

  useEffect(() => {
    setCommentDraftHydratedPostId(null)
    commentDraftFingerprintRef.current = ''
  }, [params.postId])

  useEffect(() => {
    if (commentDraft === undefined || commentDraftHydratedPostId === params.postId) {
      return
    }

    setCommentBody(commentDraft?.body ?? '')
    setCommentFiles([])
    setCommentDraftError(null)
    commentDraftFingerprintRef.current = buildCommentDraftFingerprint({
      postId: params.postId,
      body: commentDraft?.body ?? '',
    })
    setCommentDraftHydratedPostId(params.postId)
  }, [commentDraft, commentDraftHydratedPostId, params.postId])

  useEffect(() => {
    if (!user || commentDraftHydratedPostId !== params.postId) {
      return
    }

    if (postDetail?.status !== 'active') {
      return
    }

    const snapshot = buildCommentDraftFingerprint({
      postId: params.postId,
      body: debouncedCommentBody,
    })

    if (snapshot === commentDraftFingerprintRef.current) {
      return
    }

    if (debouncedCommentBody.trim().length === 0) {
      void deleteCommentDraft({
        actorWorkosUserId: user.id,
        postId: params.postId as Id<'posts'>,
      })
        .then(() => {
          commentDraftFingerprintRef.current = snapshot
          setCommentDraftError(null)
        })
        .catch((error) => {
          setCommentDraftError(error instanceof Error ? error.message : 'Failed to clear draft.')
        })

      return
    }

    void upsertCommentDraft({
      actorWorkosUserId: user.id,
      postId: params.postId as Id<'posts'>,
      body: debouncedCommentBody,
    })
      .then(() => {
        commentDraftFingerprintRef.current = snapshot
        setCommentDraftError(null)
      })
      .catch((error) => {
        setCommentDraftError(error instanceof Error ? error.message : 'Failed to save draft.')
      })
  }, [
    commentDraftHydratedPostId,
    debouncedCommentBody,
    deleteCommentDraft,
    params.postId,
    postDetail?.status,
    upsertCommentDraft,
    user,
  ])

  const beginPostEdit = () => {
    if (!postDetail) {
      return
    }

    setEditTitle(postDetail.title)
    setEditWhere(postDetail.occurrenceWhere)
    setEditWhen(postDetail.occurrenceWhen)
    setEditDescription(postDetail.description)
    setEditFiles([])
    setEditError(null)
    setEditingPost(true)
  }

  const handlePostEditSave = async () => {
    if (!user || !postDetail) {
      return
    }

    setEditBusy(true)
    setEditError(null)

    try {
      let imageStorageIds = postDetail.imageStorageIds

      if (editFiles.length > 0) {
        const uploaded = await uploadImageFiles({
          files: editFiles,
          actorWorkosUserId: user.id,
          generateUploadUrl,
          attachUploadedFile,
        })

        imageStorageIds = [...postDetail.imageStorageIds, ...uploaded.storageIds].slice(0, 6)
      }

      await updatePost({
        actorWorkosUserId: user.id,
        postId: postDetail.postId,
        title: editTitle,
        occurrenceWhere: editWhere,
        occurrenceWhen: editWhen,
        description: editDescription,
        imageStorageIds,
      })

      setEditingPost(false)
      setEditFiles([])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update post.'
      setEditError(message)
    } finally {
      setEditBusy(false)
    }
  }

  const handleArchive = async () => {
    if (!user || !postDetail) {
      return
    }

    try {
      await archivePost({
        actorWorkosUserId: user.id,
        postId: postDetail.postId,
      })
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Failed to archive post.')
    }
  }

  const handleUnarchive = async () => {
    if (!user || !postDetail) {
      return
    }

    try {
      await unarchivePost({
        actorWorkosUserId: user.id,
        postId: postDetail.postId,
      })
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Failed to unarchive post.')
    }
  }

  const handleResolve = async () => {
    if (!user || !postDetail) {
      return
    }

    setResolutionBusy(true)
    setEditError(null)

    try {
      await resolvePost({
        actorWorkosUserId: user.id,
        postId: postDetail.postId,
        resolutionSummary,
      })
      setResolvingPost(false)
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Failed to resolve post.')
    } finally {
      setResolutionBusy(false)
    }
  }

  const handleReopen = async () => {
    if (!user || !postDetail) {
      return
    }

    try {
      await reopenPost({
        actorWorkosUserId: user.id,
        postId: postDetail.postId,
      })
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Failed to reopen post.')
    }
  }

  const handlePromoteToPlaybook = async () => {
    if (!user || !postDetail) {
      return
    }

    setPromoteBusy(true)
    setEditError(null)

    try {
      const result = await promoteFromPost({
        actorWorkosUserId: user.id,
        postId: postDetail.postId,
      })

      void navigate({
        to: '/playbooks',
        search: {
          team: postDetail.teamSlug,
          playbook: result.playbook.playbookId,
        },
      })
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Failed to promote playbook.')
    } finally {
      setPromoteBusy(false)
    }
  }

  const handleDiscardCommentDraft = async () => {
    if (!user) {
      return
    }

    try {
      await deleteCommentDraft({
        actorWorkosUserId: user.id,
        postId: params.postId as Id<'posts'>,
      })
    } catch (error) {
      setCommentDraftError(error instanceof Error ? error.message : 'Failed to discard draft.')
      return
    }

    setCommentBody('')
    setCommentFiles([])
    setCommentDraftError(null)
    commentDraftFingerprintRef.current = buildCommentDraftFingerprint({
      postId: params.postId,
      body: '',
    })
  }

  const handleCreateComment = async () => {
    if (!user || !postDetail) {
      return
    }

    setCommentBusy(true)
    setCommentError(null)

    try {
      let imageStorageIds: Id<'_storage'>[] = []

      if (commentFiles.length > 0) {
        const uploaded = await uploadImageFiles({
          files: commentFiles,
          actorWorkosUserId: user.id,
          generateUploadUrl,
          attachUploadedFile,
        })
        imageStorageIds = uploaded.storageIds
      }

      await createComment({
        actorWorkosUserId: user.id,
        postId: postDetail.postId,
        body: commentBody,
        imageStorageIds,
      })

      await deleteCommentDraft({
        actorWorkosUserId: user.id,
        postId: postDetail.postId,
      })

      setCommentBody('')
      setCommentFiles([])
      setCommentDraftError(null)
      commentDraftFingerprintRef.current = buildCommentDraftFingerprint({
        postId: params.postId,
        body: '',
      })
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : 'Failed to create comment.')
    } finally {
      setCommentBusy(false)
    }
  }

  const beginCommentEdit = (commentId: Id<'comments'>, body: string) => {
    setEditingCommentId(commentId)
    setEditingCommentBody(body)
    setEditingCommentFiles([])
    setEditingCommentError(null)
  }

  const handleUpdateComment = async () => {
    if (!user || !editingCommentId) {
      return
    }

    setEditingCommentBusy(true)
    setEditingCommentError(null)

    try {
      let imageStorageIds: Id<'_storage'>[] = []

      if (editingCommentFiles.length > 0) {
        const uploaded = await uploadImageFiles({
          files: editingCommentFiles,
          actorWorkosUserId: user.id,
          generateUploadUrl,
          attachUploadedFile,
        })
        imageStorageIds = uploaded.storageIds
      }

      await updateComment({
        actorWorkosUserId: user.id,
        commentId: editingCommentId,
        body: editingCommentBody,
        imageStorageIds,
      })

      setEditingCommentId(null)
      setEditingCommentBody('')
      setEditingCommentFiles([])
    } catch (error) {
      setEditingCommentError(error instanceof Error ? error.message : 'Failed to update comment.')
    } finally {
      setEditingCommentBusy(false)
    }
  }

  const handleDeleteComment = async (commentId: Id<'comments'>) => {
    if (!user) {
      return
    }

    try {
      await deleteComment({
        actorWorkosUserId: user.id,
        commentId,
      })
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : 'Failed to delete comment.')
    }
  }

  if (auth.loading || !user || !postDetail) {
    return (
      <main className='app-shell'>
        <p className='text-sm text-muted-foreground'>Loading post...</p>
      </main>
    )
  }

  const commentsLocked = postDetail.status !== 'active'

  return (
    <AppSidebarShell
      activeNav='dashboard'
      sectionLabel='Incident Thread'
      title='Post Detail'
      description='Post details, timeline, and team discussion in one place.'
      actorWorkosUserId={user.id}
      userLabel={userDisplayName(user)}
      userEmail={user.email ?? undefined}
    >
      <section className='tape-surface noir-reveal space-y-4 p-5'>
        <div className='flex flex-wrap items-center gap-2'>
          <Badge variant='outline'>{postDetail.teamName}</Badge>
          <Badge variant={postDetail.status === 'active' ? 'default' : 'secondary'}>{postDetail.status}</Badge>
        </div>

        <div>
          <h2 className='text-2xl font-semibold text-foreground'>{postDetail.title}</h2>
          <p className='mt-1 text-sm text-muted-foreground'>
            Where: {postDetail.occurrenceWhere} | When: {postDetail.occurrenceWhen}
          </p>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          {postDetail.canEdit ? (
            <Button size='sm' variant='secondary' onClick={beginPostEdit}>
              <PencilLine className='h-4 w-4' />
              Edit post
            </Button>
          ) : null}
          {postDetail.canArchive ? (
            <Button size='sm' variant='outline' onClick={handleArchive}>
              Archive
            </Button>
          ) : null}
          {postDetail.canUnarchive ? (
            <Button size='sm' onClick={handleUnarchive}>
              Unarchive
            </Button>
          ) : null}
          {postDetail.canResolve ? (
            <Button
              size='sm'
              variant='outline'
              onClick={() => {
                setResolvingPost((current) => !current)
                setEditError(null)
              }}
            >
              <CheckCheck className='h-4 w-4' />
              Resolve
            </Button>
          ) : null}
          {postDetail.canReopen ? (
            <Button size='sm' variant='secondary' onClick={handleReopen}>
              <RotateCcw className='h-4 w-4' />
              Reopen
            </Button>
          ) : null}
          {postDetail.canPromoteToPlaybook ? (
            <Button size='sm' disabled={promoteBusy} onClick={handlePromoteToPlaybook}>
              <BookCopy className='h-4 w-4' />
              {promoteBusy ? 'Promoting...' : 'Promote to playbook'}
            </Button>
          ) : null}
          {postDetail.promotedPlaybookId ? (
            <Button asChild size='sm' variant='secondary'>
              <Link
                to='/playbooks'
                search={{
                  team: postDetail.teamSlug,
                  playbook: postDetail.promotedPlaybookId,
                }}
              >
                Open playbook
              </Link>
            </Button>
          ) : null}
        </div>

        {editError ? <p className='text-sm text-destructive'>{editError}</p> : null}

        {resolvingPost ? (
          <section className='grid gap-2 rounded-sm border border-border/60 bg-secondary/25 p-3'>
            <Label htmlFor='resolution-summary'>Resolution summary</Label>
            <Textarea
              id='resolution-summary'
              value={resolutionSummary}
              maxLength={3000}
              rows={4}
              placeholder='Describe what fixed the issue and what changed.'
              onChange={(event) => setResolutionSummary(event.target.value)}
            />
            <div className='flex items-center gap-2'>
              <Button disabled={resolutionBusy} size='sm' onClick={handleResolve}>
                {resolutionBusy ? 'Resolving...' : 'Confirm resolve'}
              </Button>
              <Button
                size='sm'
                variant='outline'
                onClick={() => {
                  setResolvingPost(false)
                  setResolutionSummary(postDetail.resolutionSummary ?? '')
                }}
              >
                Cancel
              </Button>
            </div>
          </section>
        ) : null}

        <p className='whitespace-pre-wrap text-sm leading-6'>{postDetail.description}</p>

        {postDetail.resolutionSummary ? (
          <section className='space-y-2 rounded-sm border border-border/60 bg-secondary/25 p-3'>
            <p className='text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
              Resolution summary
            </p>
            <p className='whitespace-pre-wrap text-sm leading-6'>{postDetail.resolutionSummary}</p>
            {postDetail.resolvedAt && postDetail.resolvedByName ? (
              <p className='tape-meta'>
                Resolved by {postDetail.resolvedByName} ({postDetail.resolvedByIid}) on{' '}
                {formatDate(postDetail.resolvedAt)}
              </p>
            ) : null}
          </section>
        ) : null}

        {postImages.length > 0 ? (
          <div className='grid grid-cols-2 gap-2'>
            {postImages.map((url) => (
              <img
                key={url}
                src={url}
                alt='Post attachment'
                className='h-48 w-full rounded-md border border-border/60 object-cover'
              />
            ))}
          </div>
        ) : null}

        <p className='tape-meta'>
          Author: {postDetail.createdByName} ({postDetail.createdByIid}) | Created:{' '}
          {formatDate(postDetail.createdAt)} | Updated: {formatDate(postDetail.updatedAt)}
        </p>

        {editingPost ? (
          <div className='space-y-3 bg-secondary/35 p-4'>
            <div className='grid gap-2'>
              <Label htmlFor='edit-title'>Title</Label>
              <Input id='edit-title' value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
            </div>

            <div className='grid grid-cols-2 gap-2'>
              <div className='grid gap-2'>
                <Label htmlFor='edit-where'>Where</Label>
                <Input id='edit-where' value={editWhere} onChange={(event) => setEditWhere(event.target.value)} />
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='edit-when'>When</Label>
                <Input id='edit-when' value={editWhen} onChange={(event) => setEditWhen(event.target.value)} />
              </div>
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='edit-description'>Description</Label>
              <MentionTextarea
                actorWorkosUserId={user.id}
                teamId={postDetail.teamId}
                id='edit-description'
                value={editDescription}
                rows={6}
                onChange={setEditDescription}
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='edit-files'>Add images</Label>
              <Input
                id='edit-files'
                type='file'
                multiple
                accept='image/jpeg,image/png,image/webp'
                onChange={(event) => setEditFiles(Array.from(event.target.files ?? []))}
              />
            </div>

            <div className='flex items-center gap-2'>
              <Button disabled={editBusy} onClick={handlePostEditSave}>
                {editBusy ? 'Saving...' : 'Save'}
              </Button>
              <Button variant='outline' onClick={() => setEditingPost(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <section className='tape-surface noir-reveal space-y-4 p-5'>
        <div>
          <h2 className='text-xl font-semibold text-foreground'>Discussion ({postDetail.commentCount})</h2>
          <p className='mt-1 text-sm text-muted-foreground'>
            Team-only comments and screenshots. Drafts autosave every 1.5 seconds.
          </p>
          {commentsLocked ? (
            <p className='mt-2 text-sm text-muted-foreground'>
              Comments are read-only while this post is {postDetail.status}.
            </p>
          ) : null}
        </div>

        <section className='space-y-3 border-b border-border/45 pb-4'>
          <div className='grid gap-2'>
            <Label htmlFor='comment-body'>Comment</Label>
            <MentionTextarea
              actorWorkosUserId={user.id}
              teamId={postDetail.teamId}
              id='comment-body'
              value={commentBody}
              rows={4}
              placeholder='Add a comment'
              disabled={commentsLocked}
              onChange={setCommentBody}
            />
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='comment-files'>Attachments</Label>
            <Input
              id='comment-files'
              type='file'
              multiple
              accept='image/jpeg,image/png,image/webp'
              disabled={commentsLocked}
              onChange={(event) => setCommentFiles(Array.from(event.target.files ?? []))}
            />
          </div>

          {commentError ? <p className='text-sm text-destructive'>{commentError}</p> : null}
          {commentDraftError ? <p className='text-sm text-destructive'>{commentDraftError}</p> : null}

          <div className='flex flex-wrap items-center gap-2'>
            <Button variant='secondary' disabled={commentsLocked} onClick={handleDiscardCommentDraft}>
              Discard draft
            </Button>
            <Button disabled={commentBusy || commentsLocked} onClick={handleCreateComment}>
              {commentBusy ? 'Posting...' : 'Post comment'}
            </Button>
          </div>
        </section>

        <section className='tape-list'>
          {postDetail.comments.map((comment) => (
            <article
              key={comment.commentId}
              id={`comment-${comment.commentId}`}
              className='tape-list-row space-y-3 py-4'
            >
              <div className='flex items-center gap-2'>
                <Avatar className='h-7 w-7'>
                  <AvatarImage src={undefined} alt={comment.createdByName} />
                  <AvatarFallback>{comment.createdByName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className='text-sm font-medium text-foreground'>{comment.createdByName}</span>
                <span className='text-xs text-muted-foreground'>({comment.createdByIid})</span>
                <span className='ml-auto text-xs text-muted-foreground'>{formatDate(comment.createdAt)}</span>
              </div>

              {editingCommentId === comment.commentId ? (
                <div className='space-y-2'>
                  <MentionTextarea
                    actorWorkosUserId={user.id}
                    teamId={postDetail.teamId}
                    value={editingCommentBody}
                    rows={4}
                    onChange={setEditingCommentBody}
                  />
                  <Input
                    type='file'
                    multiple
                    accept='image/jpeg,image/png,image/webp'
                    onChange={(event) => setEditingCommentFiles(Array.from(event.target.files ?? []))}
                  />
                  {editingCommentError ? (
                    <p className='text-sm text-destructive'>{editingCommentError}</p>
                  ) : null}
                  <div className='flex items-center gap-2'>
                    <Button disabled={editingCommentBusy} onClick={handleUpdateComment}>
                      {editingCommentBusy ? 'Saving...' : 'Save'}
                    </Button>
                    <Button variant='outline' onClick={() => setEditingCommentId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className='whitespace-pre-wrap text-sm leading-6'>{comment.body}</p>

                  {comment.imageUrls.length > 0 ? (
                    <div className='grid grid-cols-2 gap-2'>
                      {comment.imageUrls.map((url) => (
                        <img
                          key={url}
                          src={url}
                          alt='Comment attachment'
                          className='h-40 w-full rounded-md border border-border/60 object-cover'
                        />
                      ))}
                    </div>
                  ) : null}

                  <div className='flex items-center gap-2'>
                    {comment.canEdit ? (
                      <Button
                        variant='secondary'
                        size='sm'
                        onClick={() => beginCommentEdit(comment.commentId, comment.body)}
                      >
                        <PencilLine className='h-4 w-4' />
                        Edit
                      </Button>
                    ) : null}
                    {comment.canDelete ? (
                      <Button
                        variant='destructive'
                        size='sm'
                        onClick={() => handleDeleteComment(comment.commentId)}
                      >
                        <Trash2 className='h-4 w-4' />
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </>
              )}
            </article>
          ))}

          {postDetail.comments.length === 0 ? (
            <p className='py-4 text-sm text-muted-foreground'>No comments yet. Start the discussion.</p>
          ) : null}
        </section>
      </section>
    </AppSidebarShell>
  )
}
