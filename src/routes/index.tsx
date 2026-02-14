import { Link, createFileRoute } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/')({
  ssr: false,
  component: HomePage,
})

function HomePage() {
  return (
    <main className='mx-auto flex min-h-screen w-full max-w-4xl items-center px-4 py-12 sm:px-6 lg:px-8'>
      <Card className='w-full border-border/80 bg-card/90 backdrop-blur'>
        <CardHeader className='space-y-2'>
          <CardTitle className='text-3xl'>BetterDoc</CardTitle>
          <CardDescription>
            Team issue board for fast post-and-discuss workflows with image support and searchable history.
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col gap-3 sm:flex-row'>
          <Button asChild>
            <Link to='/login'>Sign in with WorkOS</Link>
          </Button>
          <Button asChild variant='secondary'>
            <Link search={{ q: undefined, team: undefined }} to='/dashboard'>
              Open Dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
