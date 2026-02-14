import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useMutation, useQuery } from 'convex/react'
import { Copy } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { userDisplayName } from '@/utils/user-display'
import { uploadImageFiles } from '@/lib/uploads'
import { api } from '../../convex/_generated/api.js'

export const Route = createFileRoute('/profile')({
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
  component: ProfilePage,
})

function ProfilePage() {
  const auth = useAuth()
  const user = auth.user

  const upsertMe = useMutation(api.users.upsertMe)
  const updateProfile = useMutation(api.users.updateProfile)
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const attachUploadedFile = useMutation(api.files.attachUploadedFile)

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

  const [name, setName] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (me) {
      setName(me.name)
    }
  }, [me])

  const copyIID = async () => {
    if (!me) {
      return
    }

    await navigator.clipboard.writeText(me.iid)
    setStatusMessage('IID copied to clipboard.')
  }

  const saveProfile = async () => {
    if (!user || !me) {
      return
    }

    setBusy(true)
    setStatusMessage(null)

    try {
      let avatarStorageId = me.avatarStorageId ?? undefined

      if (avatarFile) {
        const uploaded = await uploadImageFiles({
          files: [avatarFile],
          actorWorkosUserId: user.id,
          generateUploadUrl,
          attachUploadedFile,
        })

        avatarStorageId = uploaded.storageIds[0]
      }

      await updateProfile({
        workosUserId: user.id,
        name,
        avatarStorageId,
      })

      setAvatarFile(null)
      setStatusMessage('Profile updated.')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to update profile.')
    } finally {
      setBusy(false)
    }
  }

  if (auth.loading || !user || !me) {
    return (
      <main className='mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 px-4 py-8 sm:px-6 lg:px-8'>
        <Card>
          <CardHeader>
            <CardTitle>Loading profile...</CardTitle>
          </CardHeader>
        </Card>
      </main>
    )
  }

  return (
    <main className='mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8'>
      <div className='flex items-center gap-2'>
        <Button asChild variant='outline'>
          <Link search={{ q: undefined, team: undefined }} to='/dashboard'>
            Back to dashboard
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Manage your name, avatar, and shareable IID.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center gap-4'>
            <Avatar className='h-16 w-16'>
              <AvatarImage src={me.avatarUrl ?? undefined} alt={me.name} />
              <AvatarFallback>{me.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className='text-sm text-muted-foreground'>Your IID</p>
              <div className='mt-1 flex items-center gap-2'>
                <code className='rounded bg-muted px-2 py-1 text-sm'>{me.iid}</code>
                <Button variant='secondary' size='sm' onClick={copyIID}>
                  <Copy className='h-4 w-4' />
                  Copy
                </Button>
              </div>
            </div>
          </div>

          <div className='grid gap-2'>
            <label className='text-sm font-medium' htmlFor='profile-name'>
              Name
            </label>
            <Input id='profile-name' value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          <div className='grid gap-2'>
            <label className='text-sm font-medium' htmlFor='profile-avatar'>
              Avatar (optional)
            </label>
            <Input
              id='profile-avatar'
              type='file'
              accept='image/jpeg,image/png,image/webp'
              onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
            />
          </div>

          {statusMessage ? <p className='text-sm text-muted-foreground'>{statusMessage}</p> : null}

          <Button disabled={busy} onClick={saveProfile}>
            {busy ? 'Saving...' : 'Save profile'}
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
