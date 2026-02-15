import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useMutation, useQuery } from 'convex/react'
import { Copy } from 'lucide-react'
import { useEffect, useState } from 'react'

import { AppSidebarShell } from '@/components/layout/app-sidebar-shell'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
      email: user.email ?? undefined,
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
      <main className='app-shell'>
        <p className='text-sm text-muted-foreground'>Loading profile...</p>
      </main>
    )
  }

  return (
    <AppSidebarShell
      activeNav='profile'
      sectionLabel='Account'
      title='Profile'
      description='Manage your name, avatar, and shareable IID.'
      actorWorkosUserId={user.id}
      userLabel={userDisplayName(user)}
      userEmail={user.email ?? undefined}
    >
      <section className='tape-surface noir-reveal grid grid-cols-[auto_1fr] gap-8 p-6'>
        <div className='space-y-3'>
          <Avatar className='h-20 w-20'>
            <AvatarImage src={me.avatarUrl ?? undefined} alt={me.name} />
            <AvatarFallback>{me.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <p className='text-sm font-medium text-foreground'>{me.name}</p>
          <p className='text-xs text-muted-foreground'>WorkOS user: {user.id}</p>
        </div>

        <div className='space-y-5'>
          <div className='border-b border-border/45 pb-4'>
            <p className='noir-kicker mb-2'>Your IID</p>
            <div className='flex flex-wrap items-center gap-2'>
              <code className='rounded-sm bg-secondary/62 px-2 py-1 text-sm'>{me.iid}</code>
              <Button variant='secondary' size='sm' onClick={copyIID}>
                <Copy className='h-4 w-4' />
                Copy
              </Button>
            </div>
          </div>

          <div className='grid gap-3'>
            <div className='grid gap-2'>
              <Label htmlFor='profile-name'>Name</Label>
              <Input id='profile-name' value={name} onChange={(event) => setName(event.target.value)} />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='profile-avatar'>Avatar (optional)</Label>
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
          </div>
        </div>
      </section>
    </AppSidebarShell>
  )
}
