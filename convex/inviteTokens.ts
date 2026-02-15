const teamInviteTokenVersion = 'bdi1'

export type TeamInviteTokenKind = 'email' | 'link'

function randomTokenSecret(byteLength: number): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('base64url')
}

export function createTeamInviteToken(kind: TeamInviteTokenKind): string {
  return `${teamInviteTokenVersion}.${kind}.${randomTokenSecret(24)}`
}

export function normalizeTeamInviteToken(token: string): string {
  return token.trim()
}

export function parseTeamInviteToken(token: string): {
  version: string
  kind: TeamInviteTokenKind
  secret: string
} | null {
  const normalized = normalizeTeamInviteToken(token)

  if (!normalized) {
    return null
  }

  const [version, rawKind, secret, ...rest] = normalized.split('.')

  if (
    rest.length > 0 ||
    version !== teamInviteTokenVersion ||
    (rawKind !== 'email' && rawKind !== 'link') ||
    !secret
  ) {
    return null
  }

  return {
    version,
    kind: rawKind,
    secret,
  }
}

export async function sha256Hex(value: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function hashTeamInviteToken(token: string): Promise<string> {
  return sha256Hex(normalizeTeamInviteToken(token))
}
