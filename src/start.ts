import { createStart } from '@tanstack/react-start'
import { authkitMiddleware } from '@workos/authkit-tanstack-react-start'

const workosRedirectUri =
  typeof import.meta.env.VITE_WORKOS_REDIRECT_URI === 'string'
    ? import.meta.env.VITE_WORKOS_REDIRECT_URI
    : undefined

export const startInstance = createStart(() => ({
  requestMiddleware: [
    authkitMiddleware({
      redirectUri: workosRedirectUri,
    }),
  ],
}))
