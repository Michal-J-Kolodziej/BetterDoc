import { Link } from '@tanstack/react-router'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useMemo } from 'react'

import { AppSidebarShell } from '@/components/layout/app-sidebar-shell'
import { userDisplayName } from '@/utils/user-display'
import { api } from '../../../convex/_generated/api.js'

export type VariantKey = 'v1' | 'v2' | 'v3' | 'v4' | 'v5'

type VariantPath = '/dashboard/v1' | '/dashboard/v2' | '/dashboard/v3' | '/dashboard/v4' | '/dashboard/v5'

type DashboardPost = {
  postId: string
  status: 'active' | 'resolved' | 'archived'
  teamName: string
  updatedAt: number
  title: string
  descriptionPreview: string
  occurrenceWhere: string
  occurrenceWhen: string
  createdByName: string
  createdByIid: string
  commentCount: number
  imageCount: number
}

type TeamGroup = {
  teamName: string
  posts: DashboardPost[]
}

type DayGroup = {
  dayLabel: string
  posts: DashboardPost[]
}

const variantKeys: VariantKey[] = ['v1', 'v2', 'v3', 'v4', 'v5']

const variantPathByKey: Record<VariantKey, VariantPath> = {
  v1: '/dashboard/v1',
  v2: '/dashboard/v2',
  v3: '/dashboard/v3',
  v4: '/dashboard/v4',
  v5: '/dashboard/v5',
}

const variantMeta: Record<
  VariantKey,
  {
    label: string
    summary: string
  }
> = {
  v1: {
    label: 'Tape Feed',
    summary: 'Editorial stream with clean separators and no stacked cards.',
  },
  v2: {
    label: 'Team Strips',
    summary: 'Each team gets a horizontal lane for faster cross-team scanning.',
  },
  v3: {
    label: 'Mono Ledger',
    summary: 'Terminal-like list optimized for dense reading and keyboard flow.',
  },
  v4: {
    label: 'Incident Timeline',
    summary: 'Chronological narrative grouped by day, focused on updates over chrome.',
  },
  v5: {
    label: 'Focus + Queue',
    summary: 'One hero incident with a narrow queue for quick triage decisions.',
  },
}

function formatDate(value: number): string {
  return new Date(value).toLocaleString()
}

function formatDay(value: number): string {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function DashboardVariantPage({ variant }: { variant: VariantKey }) {
  const auth = useAuth()
  const user = auth.user

  const upsertMe = useMutation(api.users.upsertMe)
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

  const postsQuery = useQuery(
    api.posts.listPosts,
    user && me
      ? {
          actorWorkosUserId: user.id,
          limit: 80,
          status: 'all',
        }
      : 'skip',
  )

  const sortedPosts = useMemo(
    () =>
      [...(((postsQuery ?? []) as DashboardPost[]).slice(0, 36))].sort(
        (left, right) => right.updatedAt - left.updatedAt,
      ),
    [postsQuery],
  )

  const activePosts = useMemo(
    () => sortedPosts.filter((post) => post.status === 'active'),
    [sortedPosts],
  )
  const archivedPosts = useMemo(
    () => sortedPosts.filter((post) => post.status === 'archived'),
    [sortedPosts],
  )
  const resolvedPosts = useMemo(
    () => sortedPosts.filter((post) => post.status === 'resolved'),
    [sortedPosts],
  )
  const teams = useMemo(
    () => Array.from(new Set(sortedPosts.map((post) => post.teamName))),
    [sortedPosts],
  )

  const teamGroups = useMemo<TeamGroup[]>(() => {
    const map = new Map<string, DashboardPost[]>()

    for (const post of sortedPosts) {
      const bucket = map.get(post.teamName)
      if (bucket) {
        bucket.push(post)
      } else {
        map.set(post.teamName, [post])
      }
    }

    return Array.from(map.entries()).map(([teamName, posts]) => ({ teamName, posts }))
  }, [sortedPosts])

  const dayGroups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, DashboardPost[]>()

    for (const post of sortedPosts) {
      const key = formatDay(post.updatedAt)
      const bucket = map.get(key)
      if (bucket) {
        bucket.push(post)
      } else {
        map.set(key, [post])
      }
    }

    return Array.from(map.entries()).map(([dayLabel, posts]) => ({ dayLabel, posts }))
  }, [sortedPosts])

  if (auth.loading || !user || !me || postsQuery === undefined) {
    return (
      <main className='app-shell'>
        <p className='text-sm text-muted-foreground'>Loading dashboard variants...</p>
      </main>
    )
  }

  const variantConfig = variantMeta[variant]
  const currentUserLabel = userDisplayName(user)

  return (
    <AppSidebarShell
      activeNav='dashboard'
      sectionLabel='Design Review'
      title={`Dashboard ${variant.toUpperCase()} - ${variantConfig.label}`}
      description='Five desktop-only dashboard options with low chrome, no glow buttons, and lighter framing.'
      actorWorkosUserId={user.id}
      userLabel={currentUserLabel}
      userEmail={user.email ?? undefined}
    >
      <section className='flex items-center justify-between border-b border-border/55 pb-3'>
        <nav className='flex items-center gap-2'>
          {variantKeys.map((item) => (
            <Link
              key={item}
              className={
                item === variant
                  ? 'rounded bg-secondary/75 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-foreground'
                  : 'rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-secondary/55 hover:text-foreground'
              }
              to={variantPathByKey[item]}
            >
              {item}
            </Link>
          ))}
        </nav>

        <Link
          className='text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground'
          search={{ q: undefined, team: undefined }}
          to='/dashboard'
        >
          Open live dashboard
        </Link>
      </section>

      <p className='text-sm text-muted-foreground'>{variantConfig.summary}</p>

      {variant === 'v1' ? (
        <VariantOne
          activeCount={activePosts.length}
          resolvedCount={resolvedPosts.length}
          archivedCount={archivedPosts.length}
          posts={sortedPosts}
          teams={teams.length}
        />
      ) : null}
      {variant === 'v2' ? <VariantTwo groups={teamGroups} /> : null}
      {variant === 'v3' ? <VariantThree posts={sortedPosts} /> : null}
      {variant === 'v4' ? <VariantFour groups={dayGroups} /> : null}
      {variant === 'v5' ? <VariantFive posts={sortedPosts} /> : null}
    </AppSidebarShell>
  )
}

function VariantOne({
  posts,
  teams,
  activeCount,
  resolvedCount,
  archivedCount,
}: {
  posts: DashboardPost[]
  teams: number
  activeCount: number
  resolvedCount: number
  archivedCount: number
}) {
  return (
    <section className='space-y-5'>
      <div className='grid grid-cols-[10rem_10rem_10rem_10rem_1fr] gap-4 border-b border-border/45 pb-4'>
        <Stat label='Visible posts' value={posts.length} />
        <Stat label='Active' value={activeCount} />
        <Stat label='Resolved' value={resolvedCount} />
        <Stat label='Archived' value={archivedCount} />
        <Stat label='Teams represented' value={teams} />
      </div>

      <div className='divide-y divide-border/45 bg-black/15'>
        {posts.length === 0 ? (
          <p className='px-4 py-8 text-sm text-muted-foreground'>No posts available for preview.</p>
        ) : (
          posts.map((post) => (
            <article key={post.postId} className='grid grid-cols-[11rem_1fr] gap-6 px-4 py-4'>
              <div className='space-y-1 text-xs text-muted-foreground'>
                <p className='uppercase tracking-[0.12em]'>
                  {post.status} - {post.teamName}
                </p>
                <p>{formatDate(post.updatedAt)}</p>
                <p>{post.createdByIid}</p>
              </div>

              <div className='space-y-2'>
                <Link
                  className='inline-flex text-lg font-semibold text-foreground transition-colors hover:text-primary'
                  params={{ postId: post.postId }}
                  to='/posts/$postId'
                >
                  {post.title}
                </Link>
                <p className='text-sm text-muted-foreground'>{post.descriptionPreview}</p>
                <p className='text-xs text-muted-foreground'>
                  {post.occurrenceWhere} | {post.occurrenceWhen} | {post.commentCount} comments |{' '}
                  {post.imageCount} images
                </p>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )
}

function VariantTwo({ groups }: { groups: TeamGroup[] }) {
  return (
    <section className='space-y-8'>
      {groups.length === 0 ? (
        <p className='text-sm text-muted-foreground'>No team strips available.</p>
      ) : (
        groups.map((group) => (
          <article key={group.teamName} className='space-y-3'>
            <header className='flex items-center gap-3'>
              <h2 className='text-lg font-semibold'>{group.teamName}</h2>
              <span className='text-xs uppercase tracking-[0.12em] text-muted-foreground'>
                {group.posts.length} items
              </span>
              <div className='h-px flex-1 bg-border/55' />
            </header>

            <div className='grid grid-cols-3 gap-3'>
              {group.posts.slice(0, 6).map((post) => (
                <Link
                  key={post.postId}
                  className='block bg-secondary/30 px-3 py-3 transition-colors hover:bg-secondary/50'
                  params={{ postId: post.postId }}
                  to='/posts/$postId'
                >
                  <p className='text-[11px] uppercase tracking-[0.12em] text-muted-foreground'>
                    {post.status} - {formatDay(post.updatedAt)}
                  </p>
                  <p className='mt-1 text-sm font-semibold text-foreground'>{post.title}</p>
                  <p className='mt-2 text-xs text-muted-foreground'>{post.descriptionPreview}</p>
                </Link>
              ))}
            </div>
          </article>
        ))
      )}
    </section>
  )
}

function VariantThree({ posts }: { posts: DashboardPost[] }) {
  return (
    <section className='font-mono'>
      <div className='grid grid-cols-[7rem_1fr_9rem_9rem_8rem_8rem] gap-2 border-b border-border/70 pb-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground'>
        <span>Status</span>
        <span>Title</span>
        <span>Team</span>
        <span>Author</span>
        <span>Comments</span>
        <span>Updated</span>
      </div>

      <div className='divide-y divide-border/45 text-xs'>
        {posts.length === 0 ? (
          <p className='py-8 text-sm text-muted-foreground'>No rows to show.</p>
        ) : (
          posts.map((post) => (
            <article key={post.postId} className='grid grid-cols-[7rem_1fr_9rem_9rem_8rem_8rem] gap-2 py-3'>
              <span className='uppercase tracking-[0.1em] text-primary'>{post.status}</span>
              <Link
                className='truncate text-foreground transition-colors hover:text-primary'
                params={{ postId: post.postId }}
                to='/posts/$postId'
              >
                {post.title}
              </Link>
              <span className='truncate text-muted-foreground'>{post.teamName}</span>
              <span className='truncate text-muted-foreground'>{post.createdByIid}</span>
              <span className='text-muted-foreground'>{post.commentCount}</span>
              <span className='truncate text-muted-foreground'>{formatDay(post.updatedAt)}</span>
            </article>
          ))
        )}
      </div>
    </section>
  )
}

function VariantFour({ groups }: { groups: DayGroup[] }) {
  return (
    <section className='relative pl-7'>
      <div className='absolute bottom-0 left-2 top-0 w-px bg-border/65' />
      <div className='space-y-7'>
        {groups.length === 0 ? (
          <p className='text-sm text-muted-foreground'>No timeline events.</p>
        ) : (
          groups.map((group) => (
            <article key={group.dayLabel} className='space-y-3'>
              <div className='relative'>
                <span className='absolute -left-[1.66rem] top-1 h-2.5 w-2.5 rounded-full bg-primary' />
                <h2 className='text-base font-semibold'>{group.dayLabel}</h2>
              </div>

              <div className='space-y-2'>
                {group.posts.slice(0, 4).map((post) => (
                  <Link
                    key={post.postId}
                    className='block bg-black/15 px-4 py-3 transition-colors hover:bg-black/30'
                    params={{ postId: post.postId }}
                    to='/posts/$postId'
                  >
                    <div className='flex items-center justify-between gap-4'>
                      <p className='text-sm font-semibold text-foreground'>{post.title}</p>
                      <p className='text-xs text-muted-foreground'>{formatDate(post.updatedAt)}</p>
                    </div>
                    <p className='mt-1 text-xs text-muted-foreground'>
                      {post.teamName} | {post.occurrenceWhere} | {post.occurrenceWhen}
                    </p>
                  </Link>
                ))}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )
}

function VariantFive({ posts }: { posts: DashboardPost[] }) {
  const lead = posts[0]
  const queue = posts.slice(1, 9)

  return (
    <section className='grid grid-cols-[1.6fr_1fr] gap-8'>
      <article className='space-y-5 border-b border-border/55 pb-6'>
        <p className='noir-kicker'>Focus Incident</p>
        {lead ? (
          <>
            <p className='text-xs uppercase tracking-[0.12em] text-muted-foreground'>
              {lead.status} - {lead.teamName} - {formatDate(lead.updatedAt)}
            </p>
            <Link
              className='inline-flex text-4xl font-semibold leading-tight text-foreground transition-colors hover:text-primary'
              params={{ postId: lead.postId }}
              to='/posts/$postId'
            >
              {lead.title}
            </Link>
            <p className='max-w-3xl text-sm leading-7 text-muted-foreground'>{lead.descriptionPreview}</p>
            <p className='text-xs text-muted-foreground'>
              {lead.createdByName} ({lead.createdByIid}) | {lead.commentCount} comments | {lead.imageCount}{' '}
              images
            </p>
          </>
        ) : (
          <p className='text-sm text-muted-foreground'>No featured post available.</p>
        )}
      </article>

      <aside className='space-y-3'>
        <p className='noir-kicker'>Triage Queue</p>
        {queue.length === 0 ? (
          <p className='text-sm text-muted-foreground'>No queued posts.</p>
        ) : (
          queue.map((post, index) => (
            <Link
              key={post.postId}
              className='grid grid-cols-[2rem_1fr] gap-3 border-b border-border/40 pb-3 transition-colors hover:text-primary'
              params={{ postId: post.postId }}
              to='/posts/$postId'
            >
              <span className='text-xs text-muted-foreground'>{String(index + 1).padStart(2, '0')}</span>
              <span>
                <p className='text-sm font-semibold text-foreground'>{post.title}</p>
                <p className='text-xs text-muted-foreground'>
                  {post.teamName} | {formatDay(post.updatedAt)}
                </p>
              </span>
            </Link>
          ))
        )}
      </aside>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className='text-xs uppercase tracking-[0.12em] text-muted-foreground'>{label}</p>
      <p className='mt-1 text-2xl font-semibold text-foreground'>{value}</p>
    </div>
  )
}
