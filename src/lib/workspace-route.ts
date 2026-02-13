function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input)
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
  const base64 = btoa(binary)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(input: string): string {
  const paddingLength = (4 - (input.length % 4)) % 4
  const padded = `${input}${'='.repeat(paddingLength)}`
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeWorkspaceRouteParam(workspaceId: string): string {
  const encoded = toBase64Url(workspaceId)
  return `b64-${encoded}`
}

export function decodeWorkspaceRouteParam(workspaceIdParam: string): string {
  if (workspaceIdParam.startsWith('b64-')) {
    const encoded = workspaceIdParam.slice(4)
    try {
      return fromBase64Url(encoded)
    } catch {
      return workspaceIdParam
    }
  }

  try {
    return decodeURIComponent(workspaceIdParam)
  } catch {
    return workspaceIdParam
  }
}
