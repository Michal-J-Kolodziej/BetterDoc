import { describe, expect, it } from 'vitest'

import {
  buildInstructionFileName,
  createAngularInstructionDocument,
  parseInstructionMarkdown,
  serializeInstructionMarkdown,
} from './document'

describe('instruction document markdown', () => {
  it('round-trips the canonical markdown structure', () => {
    const document = createAngularInstructionDocument({
      title: 'Portal Architecture Guide',
      repoUrl: 'https://github.com/acme/platform',
      targetKind: 'project',
      targetName: 'portal',
    })

    const markdown = serializeInstructionMarkdown({
      metadata: {
        title: 'Portal Architecture Guide',
        referenceLibrary: 'angular',
        referenceVersion: '21',
        repoUrl: 'https://github.com/acme/platform',
        targetKind: 'project',
        targetName: 'portal',
        markdownFileName: buildInstructionFileName(
          'Portal Architecture Guide',
          'project',
          'portal',
        ),
        status: 'draft',
        authorshipMode: 'agent',
      },
      document,
    })

    const parsed = parseInstructionMarkdown(markdown)

    expect(parsed).not.toBeNull()
    expect(parsed?.metadata.targetName).toBe('portal')
    expect(parsed?.metadata.referenceVersion).toBe('21')
    expect(parsed?.document.structureNodes[0]?.id).toBe('bootstrap-entrypoint')
    expect(parsed?.document.namingNodes[0]?.title).toBe('Use hyphenated file names that match the primary symbol')
    expect(parsed?.document.reviewChecklist).toHaveLength(5)
  })

  it('builds deterministic file names', () => {
    expect(buildInstructionFileName('Portal Architecture Guide', 'project', 'portal')).toBe(
      'portal-architecture-guide-project-portal.md',
    )
  })
})
