import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useMutation, useQuery } from 'convex/react'
import { ExternalLink } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { AppSidebarShell } from '@/components/layout/app-sidebar-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { userDisplayName } from '@/utils/user-display'
import { api } from '../../convex/_generated/api.js'
import type { Id } from '../../convex/_generated/dataModel'

type InboxItem = {
  notificationId: Id<'notifications'>
  teamId: Id<'teams'>
  type: 'invite_received' | 'comment_on_post' | 'mention_in_post' | 'mention_in_comment'
  actorUserId: Id<'users'> | null
  actorName: string | null
  actorIid: string | null
  inviteId: Id<'teamInvites'> | null
  postId: Id<'posts'> | null
  commentId: Id<'comments'> | null
  title: string
  body: string
  href: string
  readAt: number | null
  createdAt: number
}

export const Route = createFileRoute('/inbox')({
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
  component: InboxPage,
})

function formatDate(value: number): string {
  return new Date(value).toLocaleString()
}

function InboxPage() {
  const auth = useAuth()
  const user = auth.user

  const upsertMe = useMutation(api.users.upsertMe)
  const markRead = useMutation(api.notifications.markRead)
  const markAllRead = useMutation(api.notifications.markAllRead)

  const me = useQuery(api.users.getMe, user ? { workosUserId: user.id } : 'skip')
  const unreadCount = useQuery(
    api.notifications.getUnreadCount,
    user
      ? {
          actorWorkosUserId: user.id,
        }
      : 'skip',
  )

  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [items, setItems] = useState<InboxItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadedCursor, setLoadedCursor] = useState<string | undefined>(undefined)
  const [markAllBusy, setMarkAllBusy] = useState(false)

  const inboxPage = useQuery(
    api.notifications.listInbox,
    user
      ? {
          actorWorkosUserId: user.id,
          cursor,
          limit: 20,
        }
      : 'skip',
  )

  useEffect(() => {
    if (!user || auth.loading || me) {
      return
    }

    void upsertMe({
      workosUserId: user.id,
      name: userDisplayName(user),
    })
  }, [auth.loading, me, upsertMe, user])

  useEffect(() => {
    if (!inboxPage) {
      return
    }

    setNextCursor(inboxPage.nextCursor)
    setLoadedCursor(cursor)

    if (!cursor) {
      setItems(inboxPage.items as InboxItem[])
      return
    }

    setItems((previous) => {
      const byId = new Map(previous.map((item) => [item.notificationId, item]))

      for (const item of inboxPage.items as InboxItem[]) {
        byId.set(item.notificationId, item)
      }

      return [...byId.values()].sort((left, right) => right.createdAt - left.createdAt)
    })
  }, [cursor, inboxPage])

  const canLoadMore = useMemo(
    () => Boolean(nextCursor) && loadedCursor === cursor,
    [cursor, loadedCursor, nextCursor],
  )

  const handleLoadMore = () => {
    if (!nextCursor || !canLoadMore) {
      return
    }

    setCursor(nextCursor)
  }

  const applyReadLocally = (notificationId: Id<'notifications'>) => {
    const now = Date.now()

    setItems((previous) =>
      previous.map((item) =>
        item.notificationId === notificationId && item.readAt === null
          ? {
              ...item,
              readAt: now,
            }
          : item,
      ),
    )
  }

  const handleMarkRead = async (notificationId: Id<'notifications'>) => {
    if (!user) {
      return
    }

    await markRead({
      actorWorkosUserId: user.id,
      notificationId,
    })

    applyReadLocally(notificationId)
  }

  const handleOpenNotification = async (item: InboxItem) => {
    if (user && item.readAt === null) {
      await markRead({
        actorWorkosUserId: user.id,
        notificationId: item.notificationId,
      })

      applyReadLocally(item.notificationId)
    }

    window.location.assign(item.href)
  }

  const handleMarkAllRead = async () => {
    if (!user) {
      return
    }

    setMarkAllBusy(true)

    try {
      await markAllRead({
        actorWorkosUserId: user.id,
      })

      const now = Date.now()
      setItems((previous) => previous.map((item) => ({ ...item, readAt: item.readAt ?? now })))
    } finally {
      setMarkAllBusy(false)
    }
  }

  if (auth.loading || !user || !me) {
    return (
      <main className='app-shell'>
        <p className='text-sm text-muted-foreground'>Loading inbox...</p>
      </main>
    )
  }

  return (
    <AppSidebarShell
      activeNav='inbox'
      sectionLabel='Activity'
      title='Inbox'
      description='Mentions and team activity notifications.'
      actorWorkosUserId={user.id}
      userLabel={userDisplayName(user)}
      userEmail={user.email ?? undefined}
    >
      <section className='tape-surface noir-reveal space-y-4 p-5'>
        <div className='flex flex-wrap items-center gap-2'>
          <Badge variant='outline'>Unread: {String(unreadCount ?? 0)}</Badge>
          <Button
            variant='secondary'
            size='sm'
            disabled={markAllBusy || (unreadCount ?? 0) === 0}
            onClick={handleMarkAllRead}
          >
            {markAllBusy ? 'Marking...' : 'Mark all read'}
          </Button>
        </div>

        {items.length === 0 ? (
          <p className='text-sm text-muted-foreground'>No notifications yet.</p>
        ) : (
          <div className='tape-list'>
            {items.map((item) => (
              <article key={item.notificationId} className='tape-list-row grid gap-2 py-3'>
                <div className='flex flex-wrap items-center gap-2'>
                  <p className='text-sm font-semibold text-foreground'>{item.title}</p>
                  <Badge variant={item.readAt === null ? 'default' : 'secondary'}>
                    {item.readAt === null ? 'Unread' : 'Read'}
                  </Badge>
                  <span className='ml-auto text-xs text-muted-foreground'>{formatDate(item.createdAt)}</span>
                </div>

                <p className='text-sm text-muted-foreground'>{item.body}</p>

                <div className='flex flex-wrap items-center gap-2'>
                  <Button variant='outline' size='sm' onClick={() => void handleOpenNotification(item)}>
                    <ExternalLink className='h-3.5 w-3.5' />
                    Open
                  </Button>
                  <Button
                    variant='secondary'
                    size='sm'
                    disabled={item.readAt !== null}
                    onClick={() => void handleMarkRead(item.notificationId)}
                  >
                    Mark read
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}

        {nextCursor ? (
          <Button variant='outline' disabled={!canLoadMore} onClick={handleLoadMore}>
            {canLoadMore ? 'Load more' : 'Loading...'}
          </Button>
        ) : null}
      </section>
    </AppSidebarShell>
  )
}
