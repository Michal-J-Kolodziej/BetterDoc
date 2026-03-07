import { useEffect, useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowRight, BookCopy, MessageSquareText, Search, ShieldCheck, TimerReset } from 'lucide-react'

import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  ssr: false,
  component: HomePage,
})

const workflow = [
  {
    icon: Search,
    title: 'Capture the exact signal',
    detail:
      'Start a post with the failure, environment, timing, and screenshots while the incident is still fresh.',
  },
  {
    icon: MessageSquareText,
    title: 'Keep discussion attached',
    detail:
      'Comments, follow-up checks, and mentions stay on the record instead of being split across chat and tickets.',
  },
  {
    icon: BookCopy,
    title: 'Promote the fix',
    detail:
      'Resolved incidents can be turned into playbooks so the next recurrence starts from a proven path back to green.',
  },
]

const queuePreview = [
  {
    state: 'Active',
    title: 'Billing callbacks timing out after deploy',
    meta: 'Platform  •  7 minutes ago',
  },
  {
    state: 'Review',
    title: 'Broken mention links in post discussion',
    meta: 'Product  •  22 minutes ago',
  },
  {
    state: 'Resolved',
    title: 'Missing screenshots on draft restore',
    meta: 'Support  •  today',
  },
]

const recordTrail = [
  { time: '07:14', label: 'Post opened', note: 'Error scope, cluster, and screenshots added immediately.' },
  { time: '07:21', label: 'Discussion narrowed', note: 'Follow-up checks and owner mentions stay on the same thread.' },
  { time: '07:38', label: 'Fix recorded', note: 'Resolution summary is promoted into a reusable playbook.' },
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function HomePage() {
  const pageRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const page = pageRef.current

    if (!page || typeof window === 'undefined') {
      return
    }

    const finePointerMedia = window.matchMedia('(pointer: fine)')
    const reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')
    const restingX = 52
    const restingY = 24
    let targetX = restingX
    let targetY = restingY
    let currentX = restingX
    let currentY = restingY
    let frame = 0

    const applyPosition = () => {
      page.style.setProperty('--front-mouse-x', `${currentX.toFixed(2)}%`)
      page.style.setProperty('--front-mouse-y', `${currentY.toFixed(2)}%`)
      page.style.setProperty('--front-shift-x', `${(((currentX - 50) / 50) * 24).toFixed(2)}px`)
      page.style.setProperty('--front-shift-y', `${(((currentY - 50) / 50) * 18).toFixed(2)}px`)
    }

    const schedule = () => {
      if (frame !== 0 || reducedMotionMedia.matches || !finePointerMedia.matches) {
        return
      }

      frame = window.requestAnimationFrame(step)
    }

    const step = () => {
      currentX += (targetX - currentX) * 0.085
      currentY += (targetY - currentY) * 0.085
      applyPosition()

      if (Math.abs(targetX - currentX) < 0.08 && Math.abs(targetY - currentY) < 0.08) {
        currentX = targetX
        currentY = targetY
        applyPosition()
        frame = 0
        return
      }

      frame = window.requestAnimationFrame(step)
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (reducedMotionMedia.matches || !finePointerMedia.matches) {
        return
      }

      const bounds = page.getBoundingClientRect()
      targetX = clamp(((event.clientX - bounds.left) / bounds.width) * 100, 0, 100)
      targetY = clamp(((event.clientY - bounds.top) / bounds.height) * 100, 0, 100)
      schedule()
    }

    const resetPointer = () => {
      targetX = restingX
      targetY = restingY
      schedule()
    }

    const handleMediaChange = () => {
      if (reducedMotionMedia.matches || !finePointerMedia.matches) {
        window.cancelAnimationFrame(frame)
        frame = 0
        targetX = restingX
        targetY = restingY
        currentX = restingX
        currentY = restingY
        applyPosition()
        return
      }

      schedule()
    }

    applyPosition()
    page.addEventListener('pointermove', handlePointerMove)
    page.addEventListener('pointerleave', resetPointer)
    finePointerMedia.addEventListener('change', handleMediaChange)
    reducedMotionMedia.addEventListener('change', handleMediaChange)

    return () => {
      window.cancelAnimationFrame(frame)
      page.removeEventListener('pointermove', handlePointerMove)
      page.removeEventListener('pointerleave', resetPointer)
      finePointerMedia.removeEventListener('change', handleMediaChange)
      reducedMotionMedia.removeEventListener('change', handleMediaChange)
    }
  }, [])

  return (
    <main className='app-shell front-page' ref={pageRef}>
      <div className='front-page-ambient' aria-hidden='true'>
        <div className='front-page-ambient-glow' />
        <div className='front-page-ambient-grid' />
        <div className='front-page-ambient-ring' />
      </div>

      <div className='front-page-orbit front-page-orbit-a' aria-hidden='true' />
      <div className='front-page-orbit front-page-orbit-b' aria-hidden='true' />

      <header className='front-header noir-reveal'>
        <div className='workspace-brand'>
          <span className='workspace-brand-title'>BetterDoc</span>
          <span className='workspace-brand-copy'>Operational memory for incident-driven teams</span>
        </div>

        <div className='front-header-actions'>
          <a className='front-header-link' href='/dashboard'>
            Workspace preview
          </a>
          <Button asChild>
            <a href='/login'>Sign in with WorkOS</a>
          </Button>
        </div>
      </header>

      <section className='front-hero noir-reveal'>
        <section className='front-copy'>
          <div className='space-y-4'>
            <p className='page-meta'>Incident knowledge workspace</p>
            <h1 className='front-title'>Operational context that still makes sense a week later.</h1>
            <p className='front-intro'>
              BetterDoc gives incidents a readable home: one post for the failure, one thread for
              the follow-up, and one playbook when the fix deserves to be reused.
            </p>
          </div>

          <div className='page-toolbar-group'>
            <Button asChild size='lg'>
              <a href='/login'>
                Start with your team
                <ArrowRight className='size-4' />
              </a>
            </Button>
            <Button asChild variant='outline' size='lg'>
              <a href='/dashboard'>Open dashboard</a>
            </Button>
          </div>

          <dl className='front-facts'>
            <div className='front-fact'>
              <dt className='page-meta'>Search</dt>
              <dd>Posts stay filterable by status, author, team, and timeframe.</dd>
            </div>
            <div className='front-fact'>
              <dt className='page-meta'>Access</dt>
              <dd>WorkOS sign-in keeps the workspace private to the right people.</dd>
            </div>
            <div className='front-fact'>
              <dt className='page-meta'>Reuse</dt>
              <dd>Resolved incidents can be promoted into team playbooks.</dd>
            </div>
          </dl>
        </section>

        <section className='front-console' aria-label='Workspace preview'>
          <div className='front-console-bar'>
            <span className='page-meta'>Today</span>
            <span className='front-console-status'>
              <ShieldCheck className='size-4' />
              Team-private workspace
            </span>
          </div>

          <div className='front-console-grid'>
            <section className='front-surface front-surface-queue'>
              <div className='front-surface-header'>
                <div>
                  <p className='page-meta'>Active queue</p>
                  <p className='front-surface-title'>Posts with useful context, not empty titles</p>
                </div>
                <span className='front-surface-badge'>3 visible</span>
              </div>

              <div className='front-queue'>
                {queuePreview.map((item, index) => (
                  <article
                    className='front-queue-row'
                    key={item.title}
                    style={{ animationDelay: `${index * 140}ms` }}
                  >
                    <div className='front-queue-state'>{item.state}</div>
                    <div className='front-queue-copy'>
                      <p className='front-queue-title'>{item.title}</p>
                      <p className='front-queue-meta'>{item.meta}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className='front-surface front-surface-thread'>
              <div className='front-surface-header'>
                <div>
                  <p className='page-meta'>Attached discussion</p>
                  <p className='front-surface-title'>Evidence stays on the record</p>
                </div>
              </div>

              <div className='front-thread'>
                <article className='front-thread-item'>
                  <TimerReset className='front-thread-icon' />
                  <div>
                    <p className='front-thread-title'>Rollback ruled out quickly</p>
                    <p className='front-thread-meta'>Logs attached to the same post thread.</p>
                  </div>
                </article>
                <article className='front-thread-item'>
                  <MessageSquareText className='front-thread-icon' />
                  <div>
                    <p className='front-thread-title'>Platform and support aligned in one place</p>
                    <p className='front-thread-meta'>No context drift into separate tools.</p>
                  </div>
                </article>
                <article className='front-thread-item'>
                  <BookCopy className='front-thread-icon' />
                  <div>
                    <p className='front-thread-title'>Resolution promoted when it is worth keeping</p>
                    <p className='front-thread-meta'>The fix becomes reference material, not folklore.</p>
                  </div>
                </article>
              </div>
            </section>
          </div>
        </section>
      </section>

      <section className='front-lower-grid noir-reveal'>
        <section className='page-list front-workflow'>
          {workflow.map((item) => {
            const Icon = item.icon

            return (
              <article className='page-list-row front-workflow-row' key={item.title}>
                <div className='front-workflow-title'>
                  <Icon className='size-4 text-primary' />
                  <p>{item.title}</p>
                </div>
                <p className='text-sm leading-6 text-muted-foreground'>{item.detail}</p>
              </article>
            )
          })}
        </section>

        <aside className='page-card front-aside'>
          <div className='front-aside-block'>
            <p className='page-meta'>What it replaces</p>
            <ul className='front-note-list'>
              <li>Slack threads that read like archaeology.</li>
              <li>Ticket comments with no final resolution trail.</li>
              <li>Repeated failures solved from memory instead of recorded evidence.</li>
            </ul>
          </div>

          <div className='page-divider' />

          <div className='front-aside-block'>
            <p className='page-meta'>Why it stays readable</p>
            <p className='front-aside-copy'>
              The layout is closer to an editorial workspace than a promo page: calmer sections,
              tighter copy, and a preview that shows how information moves from post to playbook.
            </p>
          </div>
        </aside>
      </section>

      <section className='page-card front-record noir-reveal'>
        <div className='front-record-header'>
          <div>
            <p className='page-meta'>Incident record</p>
            <h2 className='front-record-title'>Each update leaves a cleaner trail.</h2>
          </div>
          <p className='front-record-copy'>
            BetterDoc keeps the timeline narrow enough to scan but detailed enough to reuse later.
          </p>
        </div>

        <div className='front-record-list'>
          {recordTrail.map((item, index) => (
            <article className='front-record-row' key={item.time}>
              <div className='front-record-time'>{item.time}</div>
              <div className='front-record-dot' aria-hidden='true' style={{ animationDelay: `${index * 220}ms` }} />
              <div className='front-record-entry'>
                <p className='front-record-label'>{item.label}</p>
                <p className='front-record-note'>{item.note}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
