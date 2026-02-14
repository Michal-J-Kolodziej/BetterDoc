import type { useAuth } from '@workos/authkit-tanstack-react-start/client'

export function userDisplayName(user: ReturnType<typeof useAuth>['user']): string {
  if (!user) {
    return 'User'
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()

  if (fullName) {
    return fullName
  }

  if (user.email) {
    return user.email
  }

  return user.id
}
