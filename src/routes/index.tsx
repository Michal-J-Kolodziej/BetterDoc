import { createFileRoute } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  ssr: false,
  component: HomePage,
})

function HomePage() {
  return (
    <main className='app-shell'>
      <section className='page-grid gap-6 py-8'>
        <div className='page-grid gap-4 md:grid-cols-[minmax(0,1.3fr)_18rem]'>
          <section className='page-card noir-reveal space-y-5'>
            <div className='space-y-3'>
              <p className='page-meta'>Incident knowledge workspace</p>
              <h1 className='text-4xl font-semibold tracking-[-0.04em] text-foreground md:text-5xl'>
                BetterDoc keeps operational context readable.
              </h1>
              <p className='max-w-2xl text-base leading-7 text-muted-foreground'>
                Capture one incident clearly, discuss it in context, and preserve the fix as a
                team reference instead of letting it disappear into chat or tickets.
              </p>
            </div>

            <div className='page-toolbar'>
              <div className='page-toolbar-group'>
                <Button asChild size='lg'>
                  <a href='/login'>Sign in with WorkOS</a>
                </Button>
                <Button asChild variant='outline' size='lg'>
                  <a href='/dashboard'>Open dashboard</a>
                </Button>
              </div>
            </div>
          </section>

          <aside className='page-card page-card-compact noir-reveal space-y-3'>
            <p className='text-sm font-medium text-foreground'>What it replaces</p>
            <ul className='grid gap-2 text-sm leading-6 text-muted-foreground'>
              <li>Scattered Slack threads</li>
              <li>Ticket comments with no reusable resolution</li>
              <li>Incident notes that are impossible to search later</li>
            </ul>
          </aside>
        </div>

        <section className='page-list noir-reveal'>
          <article className='page-list-row md:grid-cols-[12rem_1fr] md:items-start'>
            <p className='text-sm font-medium text-foreground'>Capture</p>
            <p className='text-sm leading-6 text-muted-foreground'>
              Write the issue once with where it happens, when it happens, screenshots, and the
              right people tagged immediately.
            </p>
          </article>
          <article className='page-list-row md:grid-cols-[12rem_1fr] md:items-start'>
            <p className='text-sm font-medium text-foreground'>Discuss</p>
            <p className='text-sm leading-6 text-muted-foreground'>
              Keep comments and follow-up evidence on the post instead of splitting the timeline
              across tools.
            </p>
          </article>
          <article className='page-list-row md:grid-cols-[12rem_1fr] md:items-start'>
            <p className='text-sm font-medium text-foreground'>Reuse</p>
            <p className='text-sm leading-6 text-muted-foreground'>
              Promote resolved incidents into playbooks so recurring failures have a documented
              path back to the fix.
            </p>
          </article>
        </section>
      </section>
    </main>
  )
}
