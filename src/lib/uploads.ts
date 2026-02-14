import type { Id } from '../../convex/_generated/dataModel'

type GenerateUploadUrlFn = (args: { actorWorkosUserId: string }) => Promise<{ uploadUrl: string }>
type AttachUploadedFileFn = (args: {
  actorWorkosUserId: string
  storageId: Id<'_storage'>
}) => Promise<{
  storageId: Id<'_storage'>
  url: string | null
}>

export async function uploadImageFiles(args: {
  files: File[]
  actorWorkosUserId: string
  generateUploadUrl: GenerateUploadUrlFn
  attachUploadedFile: AttachUploadedFileFn
}): Promise<{ storageIds: Id<'_storage'>[]; previewUrls: string[] }> {
  const storageIds: Id<'_storage'>[] = []
  const previewUrls: string[] = []

  for (const file of args.files) {
    const { uploadUrl } = await args.generateUploadUrl({
      actorWorkosUserId: args.actorWorkosUserId,
    })

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    })

    if (!uploadResponse.ok) {
      throw new Error('Image upload failed.')
    }

    const payload = (await uploadResponse.json()) as { storageId?: string }

    if (!payload.storageId) {
      throw new Error('Image upload response missing storageId.')
    }

    const attached = await args.attachUploadedFile({
      actorWorkosUserId: args.actorWorkosUserId,
      storageId: payload.storageId as Id<'_storage'>,
    })

    storageIds.push(attached.storageId)

    if (attached.url) {
      previewUrls.push(attached.url)
    }
  }

  return {
    storageIds,
    previewUrls,
  }
}
