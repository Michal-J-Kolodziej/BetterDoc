import { Link, createFileRoute } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  ssr: false,
  component: HomePage,
})

function HomePage() {
  return (
    <main className='app-shell'>
      <section className='noir-panel noir-reveal px-10 py-11'>
        <p className='noir-kicker'>Noir Grid Workspace</p>
        <h1 className='mt-3 text-5xl font-semibold text-foreground'>BetterDoc</h1>
        <p className='mt-4 max-w-2xl text-base leading-6 text-muted-foreground'>
          Minimal incident knowledge flow for teams. Capture a problem once, discuss with context,
          and keep a searchable history that stays readable under pressure.
        </p>

        <div className='mt-7 flex flex-wrap items-center gap-3'>
          <Button asChild size='lg'>
            <Link to='/login'>Sign in with WorkOS</Link>
          </Button>
          <Button asChild variant='outline' size='lg'>
            <Link search={{ q: undefined, team: undefined }} to='/dashboard'>
              Open dashboard
            </Link>
          </Button>
        </div>

        <div className='noir-divider my-7' />

        <div className='grid grid-cols-3 gap-3 text-xs text-muted-foreground'>
          <div className='rounded-lg border border-border/80 bg-secondary/45 p-3'>
            <p className='noir-kicker mb-2'>Capture</p>
            <p>Post issue context with images in under a minute.</p>
          </div>
          <div className='rounded-lg border border-border/80 bg-secondary/45 p-3'>
            <p className='noir-kicker mb-2'>Discuss</p>
            <p>Threaded team comments with clear ownership and timing.</p>
          </div>
          <div className='rounded-lg border border-border/80 bg-secondary/45 p-3'>
            <p className='noir-kicker mb-2'>Search</p>
            <p>Use qualifiers to find similar incidents quickly.</p>
          </div>
        </div>
      </section>
    </main>
  )
}
