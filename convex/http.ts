import { httpRouter } from 'convex/server'
import { ConvexError } from 'convex/values'

import { api } from './_generated/api'
import { httpAction } from './_generated/server'

const http = httpRouter()

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  })
}

function deriveErrorCodeFromMessage(message: string): string {
  const prefixedCodeMatch = message.match(/^\[([A-Z0-9_]+)\]\s/)
  if (prefixedCodeMatch) {
    return prefixedCodeMatch[1]
  }

  return 'INGESTION_REQUEST_FAILED'
}

function deriveHttpStatusFromError(error: unknown): number {
  const message =
    error instanceof Error ? error.message : 'Scanner ingestion request failed.'

  if (message.includes('Idempotency key reuse')) {
    return 409
  }

  if (message.includes('required') || message.includes('must be')) {
    return 400
  }

  if (message.includes('payload hash mismatch')) {
    return 409
  }

  return 500
}

http.route({
  path: '/scanner/ingest',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    let payload: unknown

    try {
      payload = await request.json()
    } catch {
      return jsonResponse(400, {
        errorCode: 'INVALID_JSON',
        message: 'Request body must be valid JSON.',
      })
    }

    try {
      const result = await ctx.runAction(
        api.scanIngestion.ingestScannerSnapshot,
        payload as never,
      )
      const statusCode = result.status === 'processing' ? 202 : 200

      return jsonResponse(statusCode, result)
    } catch (error) {
      if (error instanceof ConvexError || error instanceof Error) {
        return jsonResponse(deriveHttpStatusFromError(error), {
          errorCode: deriveErrorCodeFromMessage(error.message),
          message: error.message,
        })
      }

      return jsonResponse(500, {
        errorCode: 'INGESTION_REQUEST_FAILED',
        message: 'Scanner ingestion request failed.',
      })
    }
  }),
})

export default http
