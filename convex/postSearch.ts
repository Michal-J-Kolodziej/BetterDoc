import type { Doc } from './_generated/dataModel'
import { normalizeText } from './model'

export function buildPostSearchText(args: {
  post: Pick<Doc<'posts'>, 'title' | 'occurrenceWhere' | 'occurrenceWhen' | 'description'>
  comments: Array<Pick<Doc<'comments'>, 'body' | 'deletedAt'>>
}): string {
  const commentText = args.comments
    .filter((comment) => !comment.deletedAt)
    .slice(-30)
    .map((comment) => comment.body)
    .join(' ')

  return normalizeText(
    [
      args.post.title,
      args.post.occurrenceWhere,
      args.post.occurrenceWhen,
      args.post.description,
      commentText,
    ].join(' '),
  )
}
