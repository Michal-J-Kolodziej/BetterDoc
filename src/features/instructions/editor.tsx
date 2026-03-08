import { Network, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import type { InstructionDocument, InstructionNode, InstructionSectionKey } from './document'
import { instructionSectionDefinitions, sectionTitleForKey } from './document'

function createNodeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export function listToTextarea(values: string[]): string {
  return values.join('\n')
}

export function textareaToList(value: string): string[] {
  return value
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function createBlankNode(sectionKey: InstructionSectionKey): InstructionNode {
  return {
    id: createNodeId(sectionKey.replace('Nodes', '')),
    title: '',
    summary: '',
    paths: [],
    rules: [],
    examples: [],
    relationships: [],
  }
}

type InstructionSectionEditorProps = {
  sectionKey: InstructionSectionKey
  nodes: InstructionNode[]
  onChange: (nodes: InstructionNode[]) => void
}

export function InstructionSectionEditor({
  sectionKey,
  nodes,
  onChange,
}: InstructionSectionEditorProps) {
  const definition = instructionSectionDefinitions.find((entry) => entry.key === sectionKey)

  if (!definition) {
    return null
  }

  const updateNode = (nodeId: string, patch: Partial<InstructionNode>) => {
    onChange(nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)))
  }

  return (
    <section className='instruction-section-editor'>
      <div className='page-toolbar'>
        <div className='grid gap-1'>
          <div className='flex flex-wrap items-center gap-2'>
            <h2 className='text-base font-semibold text-foreground'>{definition.title}</h2>
            <span className='page-meta'>{nodes.length} nodes</span>
          </div>
          <p className='text-sm text-muted-foreground'>{definition.description}</p>
        </div>

        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => {
            onChange([...nodes, createBlankNode(sectionKey)])
          }}
        >
          <Plus className='h-4 w-4' />
          Add node
        </Button>
      </div>

      <div className='instruction-node-list'>
        {nodes.length === 0 ? (
          <section className='instruction-node-card instruction-node-card-empty'>
            <p className='text-sm text-muted-foreground'>
              No entries yet. Add a node to capture repo-specific guidance for this section.
            </p>
          </section>
        ) : null}

        {nodes.map((node, index) => (
          <article key={node.id} className='instruction-node-card'>
            <div className='page-toolbar'>
              <div className='flex flex-wrap items-center gap-2'>
                <span className='page-meta'>{`${index + 1}`.padStart(2, '0')}</span>
                <span className='text-sm font-medium text-foreground'>{node.id}</span>
              </div>

              <Button
                type='button'
                size='sm'
                variant='ghost'
                onClick={() => {
                  onChange(nodes.filter((entry) => entry.id !== node.id))
                }}
              >
                <Trash2 className='h-4 w-4' />
                Remove
              </Button>
            </div>

            <div className='instruction-node-fields'>
              <div className='grid gap-2'>
                <Label htmlFor={`${node.id}-title`}>Title</Label>
                <Input
                  id={`${node.id}-title`}
                  value={node.title}
                  onChange={(event) => {
                    updateNode(node.id, { title: event.target.value })
                  }}
                  placeholder={`What matters in ${definition.title.toLowerCase()}?`}
                />
              </div>

              <div className='grid gap-2'>
                <Label htmlFor={`${node.id}-summary`}>Summary</Label>
                <Textarea
                  id={`${node.id}-summary`}
                  value={node.summary}
                  onChange={(event) => {
                    updateNode(node.id, { summary: event.target.value })
                  }}
                  className='min-h-[88px]'
                  placeholder='Explain the intent behind this rule or boundary.'
                />
              </div>

              <div className='grid gap-3 xl:grid-cols-2'>
                <ListField
                  label='Paths'
                  value={node.paths}
                  placeholder='apps/portal/src/app/orders'
                  onChange={(value) => {
                    updateNode(node.id, { paths: value })
                  }}
                />
                <ListField
                  label='Relationships'
                  value={node.relationships}
                  placeholder='router-shell'
                  onChange={(value) => {
                    updateNode(node.id, { relationships: value })
                  }}
                />
              </div>

              <div className='grid gap-3 xl:grid-cols-2'>
                <ListField
                  label='Rules'
                  value={node.rules}
                  placeholder='One rule per line'
                  onChange={(value) => {
                    updateNode(node.id, { rules: value })
                  }}
                />
                <ListField
                  label='Examples'
                  value={node.examples}
                  placeholder='Named examples or snippets'
                  onChange={(value) => {
                    updateNode(node.id, { examples: value })
                  }}
                />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function ListField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string[]
  placeholder: string
  onChange: (value: string[]) => void
}) {
  return (
    <div className='grid gap-2'>
      <Label>{label}</Label>
      <Textarea
        value={listToTextarea(value)}
        onChange={(event) => {
          onChange(textareaToList(event.target.value))
        }}
        className='min-h-[96px]'
        placeholder={placeholder}
      />
      <p className='text-xs text-muted-foreground'>Use one item per line.</p>
    </div>
  )
}

export function ReviewChecklistEditor({
  reviewChecklist,
  onChange,
}: {
  reviewChecklist: string[]
  onChange: (value: string[]) => void
}) {
  return (
    <section className='instruction-section-editor'>
      <div className='page-toolbar'>
        <div className='grid gap-1'>
          <div className='flex flex-wrap items-center gap-2'>
            <h2 className='text-base font-semibold text-foreground'>Review Checklist</h2>
            <span className='page-meta'>{reviewChecklist.length} items</span>
          </div>
          <p className='text-sm text-muted-foreground'>
            These checks decide whether an instruction is still baseline-only or ready for real use.
          </p>
        </div>
      </div>

      <Textarea
        value={listToTextarea(reviewChecklist)}
        onChange={(event) => {
          onChange(textareaToList(event.target.value))
        }}
        className='min-h-[156px]'
        placeholder='Add one review checkpoint per line'
      />
    </section>
  )
}

export function InstructionMapPreview({
  document,
  compact = false,
}: {
  document: InstructionDocument
  compact?: boolean
}) {
  return (
    <section className={cn('instruction-map-shell', compact && 'instruction-map-shell-compact')}>
      <div className='page-toolbar'>
        <div className='grid gap-1'>
          <h2 className='text-base font-semibold text-foreground'>Instruction Map</h2>
          <p className='text-sm text-muted-foreground'>
            The saved Markdown is generated from these section groups and relationship tags.
          </p>
        </div>

        <div className='flex items-center gap-2 text-sm text-muted-foreground'>
          <Network className='h-4 w-4' />
          Structured output
        </div>
      </div>

      <div className='instruction-map-grid'>
        {instructionSectionDefinitions.map((section) => {
          const nodes = document[section.key]

          return (
            <section key={section.key} className='instruction-map-column'>
              <div className='instruction-map-column-header'>
                <h3 className='text-sm font-semibold text-foreground'>{sectionTitleForKey(section.key)}</h3>
                <span className='page-meta'>{nodes.length}</span>
              </div>

              <div className='instruction-map-node-stack'>
                {nodes.length === 0 ? (
                  <div className='instruction-map-node instruction-map-node-empty'>
                    <span className='text-xs text-muted-foreground'>No nodes</span>
                  </div>
                ) : null}

                {nodes.map((node) => (
                  <article
                    key={node.id}
                    className={cn(
                      'instruction-map-node',
                      node.relationships.length > 0 && 'instruction-map-node-linked',
                    )}
                  >
                    <div className='grid gap-1'>
                      <span className='text-sm font-medium text-foreground'>{node.title || node.id}</span>
                      <span className='line-clamp-3 text-xs leading-5 text-muted-foreground'>
                        {node.summary || 'Add a summary to make this node useful.'}
                      </span>
                    </div>

                    {node.relationships.length > 0 ? (
                      <p className='text-xs leading-5 text-muted-foreground'>
                        {node.relationships.join(', ')}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </section>
  )
}
