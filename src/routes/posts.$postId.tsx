import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useMutation, useQuery } from 'convex/react'
import { PencilLine, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { AppSidebarShell } from '@/components/layout/app-sidebar-shell'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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

function PostDetailPage() {
  const params = Route.useParams()
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

  const updatePost = useMutation(api.posts.updatePost)
  const archivePost = useMutation(api.posts.archivePost)
  const unarchivePost = useMutation(api.posts.unarchivePost)

  const createComment = useMutation(api.comments.createComment)
  const updateComment = useMutation(api.comments.updateComment)
  const deleteComment = useMutation(api.comments.deleteComment)

  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const attachUploadedFile = useMutation(api.files.attachUploadedFile)

  const [editingPost, setEditingPost] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editWhere, setEditWhere] = useState('')
  const [editWhen, setEditWhen] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editFiles, setEditFiles] = useState<File[]>([])
  const [editError, setEditError] = useState<string | null>(null)
  const [editBusy, setEditBusy] = useState(false)

  const [commentBody, setCommentBody] = useState('')
  const [commentFiles, setCommentFiles] = useState<File[]>([])
  const [commentError, setCommentError] = useState<string | null>(null)
  const [commentBusy, setCommentBusy] = useState(false)

  const [editingCommentId, setEditingCommentId] = useState<Id<'comments'> | null>(null)
  const [editingCommentBody, setEditingCommentBody] = useState('')
  const [editingCommentFiles, setEditingCommentFiles] = useState<File[]>([])
  const [editingCommentBusy, setEditingCommentBusy] = useState(false)
  const [editingCommentError, setEditingCommentError] = useState<string | null>(null)

  const postImages = useMemo(() => postDetail?.imageUrls ?? [], [postDetail?.imageUrls])

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

      setCommentBody('')
      setCommentFiles([])
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
        <Card className='noir-reveal'>
          <CardHeader>
            <CardTitle>Loading post...</CardTitle>
          </CardHeader>
        </Card>
      </main>
    )
  }

  return (
    <AppSidebarShell
      activeNav='dashboard'
      sectionLabel='Incident Thread'
      title='Post Detail'
      description='Post details, timeline, and team discussion in one place.'
      userLabel={userDisplayName(user)}
      userEmail={user.email ?? undefined}
    >
      <Card className='noir-reveal'>
        <CardHeader className='space-y-3'>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge variant='outline'>{postDetail.teamName}</Badge>
            <Badge variant={postDetail.status === 'active' ? 'default' : 'secondary'}>{postDetail.status}</Badge>
          </div>

          <div>
            <CardTitle>{postDetail.title}</CardTitle>
            <CardDescription>
              Where: {postDetail.occurrenceWhere} | When: {postDetail.occurrenceWhen}
            </CardDescription>
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
          </div>
        </CardHeader>

        <CardContent className='space-y-4'>
          <p className='whitespace-pre-wrap text-sm leading-6'>{postDetail.description}</p>

          {postImages.length > 0 ? (
            <div className='grid grid-cols-2 gap-2'>
              {postImages.map((url) => (
                <img
                  key={url}
                  src={url}
                  alt='Post attachment'
                  className='h-48 w-full rounded-lg border border-border/70 object-cover'
                />
              ))}
            </div>
          ) : null}

          <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
            <span className='rounded bg-secondary/70 px-2 py-1'>Author: {postDetail.createdByName}</span>
            <span className='rounded bg-secondary/70 px-2 py-1'>IID: {postDetail.createdByIid}</span>
            <span className='rounded bg-secondary/70 px-2 py-1'>Created: {formatDate(postDetail.createdAt)}</span>
            <span className='rounded bg-secondary/70 px-2 py-1'>Updated: {formatDate(postDetail.updatedAt)}</span>
          </div>

          {editingPost ? (
            <div className='rounded-lg border border-border/80 bg-background/45 p-4'>
              <div className='grid gap-3'>
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
                  <Textarea
                    id='edit-description'
                    value={editDescription}
                    rows={6}
                    onChange={(event) => setEditDescription(event.target.value)}
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

                {editError ? <p className='text-sm text-destructive'>{editError}</p> : null}

                <div className='flex items-center gap-2'>
                  <Button disabled={editBusy} onClick={handlePostEditSave}>
                    {editBusy ? 'Saving...' : 'Save'}
                  </Button>
                  <Button variant='outline' onClick={() => setEditingPost(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className='noir-reveal'>
        <CardHeader>
          <CardTitle>Discussion ({postDetail.commentCount})</CardTitle>
          <CardDescription>Team-only comments and screenshots.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <section className='rounded-lg border border-border/80 bg-background/45 p-4'>
            <div className='grid gap-3'>
              <div className='grid gap-2'>
                <Label htmlFor='comment-body'>Comment</Label>
                <Textarea
                  id='comment-body'
                  value={commentBody}
                  rows={4}
                  placeholder='Add a comment'
                  disabled={postDetail.status === 'archived'}
                  onChange={(event) => setCommentBody(event.target.value)}
                />
              </div>

              <div className='grid gap-2'>
                <Label htmlFor='comment-files'>Attachments</Label>
                <Input
                  id='comment-files'
                  type='file'
                  multiple
                  accept='image/jpeg,image/png,image/webp'
                  disabled={postDetail.status === 'archived'}
                  onChange={(event) => setCommentFiles(Array.from(event.target.files ?? []))}
                />
              </div>

              {commentError ? <p className='text-sm text-destructive'>{commentError}</p> : null}

              <Button disabled={commentBusy || postDetail.status === 'archived'} onClick={handleCreateComment}>
                {commentBusy ? 'Posting...' : 'Post comment'}
              </Button>
            </div>
          </section>

          <section className='grid gap-3'>
            {postDetail.comments.map((comment) => (
              <Card key={comment.commentId} className='border-border/75'>
                <CardContent className='space-y-3 p-4'>
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
                      <Textarea
                        value={editingCommentBody}
                        rows={4}
                        onChange={(event) => setEditingCommentBody(event.target.value)}
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
                              className='h-40 w-full rounded-lg border border-border/70 object-cover'
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
                </CardContent>
              </Card>
            ))}

            {postDetail.comments.length === 0 ? (
              <Card>
                <CardContent className='p-4 text-sm text-muted-foreground'>
                  No comments yet. Start the discussion.
                </CardContent>
              </Card>
            ) : null}
          </section>
        </CardContent>
      </Card>
    </AppSidebarShell>
  )
}
