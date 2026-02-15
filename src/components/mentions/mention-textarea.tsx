import { useQuery } from 'convex/react'
import { useMemo, useRef, useState } from 'react'

import { api } from '../../../convex/_generated/api.js'
import type { Id } from '../../../convex/_generated/dataModel'
import { Textarea } from '@/components/ui/textarea'

type MentionTextareaProps = {
  actorWorkosUserId?: string
  teamId?: string | null
  id?: string
  value: string
  onChange: (value: string) => void
  rows?: number
  maxLength?: number
  placeholder?: string
  disabled?: boolean
  className?: string
}

type MentionContext = {
  query: string
  start: number
  end: number
}

function findMentionContext(value: string, cursorPosition: number): MentionContext | null {
  const beforeCursor = value.slice(0, cursorPosition)
  const atIndex = beforeCursor.lastIndexOf('@')

  if (atIndex < 0) {
    return null
  }

  if (atIndex > 0 && /\S/.test(beforeCursor[atIndex - 1])) {
    return null
  }

  const token = beforeCursor.slice(atIndex + 1)

  if (/\s/.test(token) || token.includes('@')) {
    return null
  }

  return {
    query: token,
    start: atIndex,
    end: cursorPosition,
  }
}

export function MentionTextarea({
  actorWorkosUserId,
  teamId,
  id,
  value,
  onChange,
  rows = 4,
  maxLength,
  placeholder,
  disabled,
  className,
}: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [cursorPosition, setCursorPosition] = useState(value.length)

  const mentionContext = useMemo(
    () => findMentionContext(value, cursorPosition),
    [cursorPosition, value],
  )

  const mentionCandidates = useQuery(
    api.teams.searchTeamMembers,
    actorWorkosUserId && teamId && mentionContext
      ? {
          actorWorkosUserId,
          teamId: teamId as Id<'teams'>,
          query: mentionContext.query,
          limit: 8,
        }
      : 'skip',
  )

  const showPicker = Boolean(mentionContext)

  const updateCursorPosition = () => {
    const textarea = textareaRef.current

    if (!textarea) {
      return
    }

    setCursorPosition(textarea.selectionStart ?? textarea.value.length)
  }

  const insertMention = (iid: string) => {
    if (!mentionContext) {
      return
    }

    const mentionText = `@${iid} `
    const nextValue = `${value.slice(0, mentionContext.start)}${mentionText}${value.slice(mentionContext.end)}`
    const nextCaret = mentionContext.start + mentionText.length

    onChange(nextValue)

    requestAnimationFrame(() => {
      if (!textareaRef.current) {
        return
      }

      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(nextCaret, nextCaret)
      setCursorPosition(nextCaret)
    })
  }

  return (
    <div className='relative'>
      <Textarea
        ref={textareaRef}
        id={id}
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        onChange={(event) => {
          onChange(event.target.value)
          setCursorPosition(event.target.selectionStart ?? event.target.value.length)
        }}
        onClick={updateCursorPosition}
        onKeyUp={updateCursorPosition}
        onSelect={updateCursorPosition}
      />

      {showPicker ? (
        <div className='absolute z-30 mt-1 w-full rounded-md border border-border/65 bg-popover shadow-lg'>
          {mentionCandidates === undefined ? (
            <p className='px-3 py-2 text-xs text-muted-foreground'>Searching team members...</p>
          ) : mentionCandidates.length === 0 ? (
            <p className='px-3 py-2 text-xs text-muted-foreground'>No matching team members.</p>
          ) : (
            <ul className='max-h-56 overflow-y-auto py-1'>
              {mentionCandidates.map((member) => (
                <li key={member.userId}>
                  <button
                    type='button'
                    className='flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary/75'
                    onMouseDown={(event) => {
                      event.preventDefault()
                      insertMention(member.iid)
                    }}
                  >
                    <span className='truncate text-foreground'>{member.name}</span>
                    <span className='text-xs text-muted-foreground'>{member.iid}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
