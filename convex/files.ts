import { ConvexError, v } from 'convex/values'

import { mutation } from './_generated/server'
import { requireUserByWorkosUserId } from './auth'
import { limits } from './model'

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

export const generateUploadUrl = mutation({
  args: {
    actorWorkosUserId: v.string(),
  },
  returns: v.object({
    uploadUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)

    const uploadUrl = await ctx.storage.generateUploadUrl()

    return {
      uploadUrl,
    }
  },
})

export const attachUploadedFile = mutation({
  args: {
    actorWorkosUserId: v.string(),
    storageId: v.id('_storage'),
  },
  returns: v.object({
    storageId: v.id('_storage'),
    contentType: v.string(),
    size: v.number(),
    url: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)

    const metadata = await ctx.storage.getMetadata(args.storageId)

    if (!metadata) {
      throw new ConvexError('Uploaded file was not found.')
    }

    const contentType = metadata.contentType ?? ''

    if (!allowedMimeTypes.has(contentType)) {
      throw new ConvexError('Only JPG, PNG, and WEBP images are supported.')
    }

    if (metadata.size > limits.maxUploadSizeBytes) {
      throw new ConvexError('Image exceeds the 10MB size limit.')
    }

    const url = await ctx.storage.getUrl(args.storageId)

    return {
      storageId: args.storageId,
      contentType,
      size: metadata.size,
      url,
    }
  },
})
