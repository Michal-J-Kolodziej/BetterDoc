export const instructionReferenceLibraries = ['angular'] as const
export type InstructionReferenceLibrary = (typeof instructionReferenceLibraries)[number]

export const instructionTargetKinds = ['project', 'library'] as const
export type InstructionTargetKind = (typeof instructionTargetKinds)[number]

export const instructionStatuses = ['draft', 'ready'] as const
export type InstructionStatus = (typeof instructionStatuses)[number]

export const instructionAuthorshipModes = ['manual', 'agent'] as const
export type InstructionAuthorshipMode = (typeof instructionAuthorshipModes)[number]

export const instructionSectionDefinitions = [
  {
    key: 'structureNodes',
    title: 'Code Structure',
    description: 'Folder boundaries, ownership, and feature layout.',
  },
  {
    key: 'patternNodes',
    title: 'Code Patterns',
    description: 'Component, service, and dependency-injection patterns.',
  },
  {
    key: 'namingNodes',
    title: 'Naming Patterns',
    description: 'File names, identifiers, selectors, and handler names.',
  },
  {
    key: 'dataHandlingNodes',
    title: 'Data Handling',
    description: 'State ownership, async flows, and transformation rules.',
  },
  {
    key: 'libraryNodes',
    title: 'Library Usage',
    description: 'Which Angular libraries are preferred and how they are used.',
  },
  {
    key: 'guardrailNodes',
    title: 'Guardrails',
    description: 'Boundaries, anti-patterns, and review expectations.',
  },
] as const

export type InstructionSectionKey = (typeof instructionSectionDefinitions)[number]['key']

export type InstructionNode = {
  id: string
  title: string
  summary: string
  paths: string[]
  rules: string[]
  examples: string[]
  relationships: string[]
}

export type InstructionOverview = {
  goal: string
  repoContext: string
  targetContext: string
  sourceSummary: string
}

export type InstructionDocument = {
  overview: InstructionOverview
  structureNodes: InstructionNode[]
  patternNodes: InstructionNode[]
  namingNodes: InstructionNode[]
  dataHandlingNodes: InstructionNode[]
  libraryNodes: InstructionNode[]
  guardrailNodes: InstructionNode[]
  reviewChecklist: string[]
}

export type InstructionMarkdownMetadata = {
  title: string
  referenceLibrary: InstructionReferenceLibrary
  referenceVersion: string
  repoUrl: string
  targetKind: InstructionTargetKind
  targetName: string
  markdownFileName: string
  status: InstructionStatus
  authorshipMode: InstructionAuthorshipMode
}

const sectionTitleByKey = new Map<InstructionSectionKey, string>(
  instructionSectionDefinitions.map((section) => [section.key, section.title]),
)

const sectionKeyByTitle = new Map<string, InstructionSectionKey>(
  instructionSectionDefinitions.map((section) => [section.title, section.key]),
)

const overviewFieldKeys = {
  'Goal': 'goal',
  'Repo Context': 'repoContext',
  'Target Context': 'targetContext',
  'Source Summary': 'sourceSummary',
} as const

type OverviewFieldLabel = keyof typeof overviewFieldKeys
type OverviewFieldKey = (typeof overviewFieldKeys)[OverviewFieldLabel]

function slugifyInstructionToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parseLineListBlock(lines: string[], startIndex: number): { values: string[]; nextIndex: number } {
  const values: string[] = []
  let index = startIndex

  while (index < lines.length) {
    const line = lines[index]

    if (line.startsWith('#') || /^- [A-Za-z]/.test(line)) {
      break
    }

    const listMatch = line.match(/^\s{2}-\s+(.*)$/)

    if (listMatch) {
      const value = listMatch[1]?.trim()

      if (value) {
        values.push(value)
      }
    }

    index += 1
  }

  return {
    values,
    nextIndex: index,
  }
}

function serializeLineList(label: string, values: string[]): string[] {
  const lines = [`- ${label}:`]

  if (values.length === 0) {
    lines.push('  - None recorded')
    return lines
  }

  for (const value of values) {
    lines.push(`  - ${value}`)
  }

  return lines
}

function parseFrontmatter(markdown: string): { meta: Record<string, string>; body: string } | null {
  if (!markdown.startsWith('---\n')) {
    return null
  }

  const closingIndex = markdown.indexOf('\n---\n', 4)

  if (closingIndex === -1) {
    return null
  }

  const frontmatter = markdown.slice(4, closingIndex)
  const body = markdown.slice(closingIndex + 5)
  const metaEntries = frontmatter
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separatorIndex = line.indexOf(':')

      if (separatorIndex === -1) {
        return null
      }

      const key = line.slice(0, separatorIndex).trim()
      const value = line.slice(separatorIndex + 1).trim()

      return [key, value] as const
    })
    .filter((entry): entry is readonly [string, string] => Boolean(entry))

  return {
    meta: Object.fromEntries(metaEntries),
    body,
  }
}

export function buildInstructionFileName(
  title: string,
  targetKind: InstructionTargetKind,
  targetName: string,
): string {
  const titleSlug = slugifyInstructionToken(title)
  const targetSlug = slugifyInstructionToken(targetName)
  const base = [titleSlug, targetKind, targetSlug].filter(Boolean).join('-')

  return `${base || 'instruction'}.md`
}

export function createEmptyInstructionNode(): InstructionNode {
  return {
    id: '',
    title: '',
    summary: '',
    paths: [],
    rules: [],
    examples: [],
    relationships: [],
  }
}

function createNode(
  id: string,
  title: string,
  summary: string,
  options?: Partial<Omit<InstructionNode, 'id' | 'title' | 'summary'>>,
): InstructionNode {
  return {
    id,
    title,
    summary,
    paths: options?.paths ?? [],
    rules: options?.rules ?? [],
    examples: options?.examples ?? [],
    relationships: options?.relationships ?? [],
  }
}

export function createAngularInstructionDocument(args: {
  title: string
  repoUrl: string
  targetKind: InstructionTargetKind
  targetName: string
}): InstructionDocument {
  const targetLabel = args.targetKind === 'project' ? 'project' : 'library'

  return {
    overview: {
      goal: `Describe how ${args.targetName} should be structured and extended as an Angular v21 ${targetLabel}.`,
      repoContext: `Source repository: ${args.repoUrl}. The document should be refined against the real workspace before it is marked ready.`,
      targetContext: `Focus area: ${args.targetKind} "${args.targetName}". Treat this as the primary boundary for architecture and naming guidance.`,
      sourceSummary:
        'Seeded from the current Angular v21 documentation and style guide, then intended for repo-specific refinement by an agent or editor.',
    },
    structureNodes: [
      createNode(
        'bootstrap-entrypoint',
        'Bootstrap from src/main.ts',
        'Keep Angular UI code inside src and treat main.ts as the stable bootstrap entry for standalone providers.',
        {
          paths: ['src/main.ts', 'src/app'],
          rules: [
            'Initialize the application from src/main.ts with standalone configuration.',
            'Keep build scripts, tooling, and workspace-level configuration outside src.',
          ],
          examples: ['bootstrapApplication(AppComponent, appConfig)'],
          relationships: ['standalone-apis', 'router-shell'],
        },
      ),
      createNode(
        'feature-first-folders',
        'Organize by feature area',
        'Group code by product behavior rather than by code type so routes, templates, and supporting logic stay discoverable together.',
        {
          paths: ['src/app/<feature>', 'libs/<domain>'],
          rules: [
            'Prefer feature directories over top-level components, services, or directives folders.',
            'Split crowded directories into smaller feature slices before they become dumping grounds.',
          ],
          examples: ['src/app/orders/order-list', 'src/app/orders/order-detail'],
          relationships: ['co-located-files', 'naming-by-feature'],
        },
      ),
      createNode(
        'co-located-files',
        'Keep related files together',
        'Store a component, template, styles, and spec beside each other so the full unit of work is visible in one place.',
        {
          paths: ['*.ts', '*.html', '*.css', '*.spec.ts'],
          rules: [
            'A component TypeScript file, template, and styles share the same base name.',
            'Unit tests live next to the source they verify instead of a global tests folder.',
          ],
          examples: [
            'user-profile.ts',
            'user-profile.html',
            'user-profile.css',
            'user-profile.spec.ts',
          ],
          relationships: ['feature-first-folders', 'hyphenated-file-names'],
        },
      ),
    ],
    patternNodes: [
      createNode(
        'standalone-apis',
        'Use standalone APIs as the default authoring model',
        'Build new features with standalone components, directives, pipes, and functional providers unless an existing area already depends on NgModules.',
        {
          rules: [
            'Prefer standalone components for new UI surfaces.',
            'Keep migrations incremental when the existing target still uses NgModules.',
          ],
          examples: ['bootstrapApplication', 'provideRouter', 'standalone: true'],
          relationships: ['bootstrap-entrypoint', 'router-shell'],
        },
      ),
      createNode(
        'inject-based-di',
        'Prefer inject() for dependency injection',
        'Use inject() for Angular dependencies so fields stay close to usage and type inference remains clear.',
        {
          rules: [
            'Group injected dependencies near the top of the class.',
            'Use constructor injection only when a legacy boundary already relies on it.',
          ],
          examples: ['private readonly http = inject(HttpClient)'],
          relationships: ['angular-core-primitives', 'http-boundary'],
        },
      ),
      createNode(
        'presentation-boundaries',
        'Keep components focused on presentation and orchestration',
        'Templates and component classes should stay readable; move reusable validation, mapping, and policy logic into dedicated helpers or services.',
        {
          rules: [
            'Refactor complex template expressions into computed state.',
            'Keep lifecycle hooks short and delegate to named methods when setup grows.',
          ],
          relationships: ['signals-first', 'template-facing-members'],
        },
      ),
    ],
    namingNodes: [
      createNode(
        'hyphenated-file-names',
        'Use hyphenated file names that match the primary symbol',
        'Match file names to the component, directive, or service they contain and avoid generic helpers buckets.',
        {
          rules: [
            'Use kebab-case file names such as user-profile.ts.',
            'Avoid catch-all names like utils.ts, helpers.ts, or common.ts when a narrower name is possible.',
          ],
          examples: ['user-profile.ts', 'payment-history.service.ts'],
          relationships: ['co-located-files'],
        },
      ),
      createNode(
        'spec-file-names',
        'Mirror the source name for tests',
        'Specs should share the source file name and add the .spec.ts suffix.',
        {
          rules: ['Keep unit tests beside the file they cover.', 'Name specs after the primary unit under test.'],
          examples: ['user-profile.spec.ts'],
          relationships: ['co-located-files'],
        },
      ),
      createNode(
        'action-named-handlers',
        'Name handlers for the action they perform',
        'Event handlers should communicate intent instead of the DOM event that triggered them.',
        {
          rules: ['Prefer names like saveProfile or commitNotes over handleClick.'],
          examples: ['saveUserData()', 'commitNotes()'],
          relationships: ['presentation-boundaries'],
        },
      ),
    ],
    dataHandlingNodes: [
      createNode(
        'signals-first',
        'Use signals for local reactive state and derived values',
        'Keep view-local state in signal primitives and derive projections with computed rather than pushing everything through imperative setters.',
        {
          rules: [
            'Use signal for writable local state.',
            'Use computed for derived state that is read by templates or other view logic.',
          ],
          examples: ['const query = signal(\'\')', 'const filtered = computed(() => items().filter(...))'],
          relationships: ['template-facing-members', 'presentation-boundaries'],
        },
      ),
      createNode(
        'http-boundary',
        'Keep async data ownership explicit',
        'Each route or feature should have a clear data owner that coordinates HTTP access, loading state, and domain mapping.',
        {
          rules: [
            'Use provideHttpClient and inject(HttpClient) for stable HTTP flows.',
            'Adopt resource or httpResource only intentionally, because Angular still describes these newer async primitives as an area where feedback is being collected.',
          ],
          examples: ['provideHttpClient()', 'httpResource(() => `/api/users/${userId()}`)'],
          relationships: ['inject-based-di', 'router-shell'],
        },
      ),
      createNode(
        'template-facing-members',
        'Protect template-only members and keep Angular-owned fields readonly',
        'Use protected for members only consumed by templates and readonly for inputs, models, outputs, and queries that Angular owns.',
        {
          rules: [
            'Mark template-facing computed helpers as protected.',
            'Mark input/model/output/query properties readonly when Angular initializes them.',
          ],
          examples: ['protected fullName = computed(...)', 'readonly userId = input()'],
          relationships: ['signals-first'],
        },
      ),
    ],
    libraryNodes: [
      createNode(
        'angular-core-primitives',
        'Prefer first-party Angular primitives before adding abstractions',
        'Reach for @angular/core primitives such as signal, computed, input, output, inject, and effect before introducing custom wrappers.',
        {
          rules: [
            'Keep custom abstractions thin and justified by repeated product needs.',
            'Avoid wrapper layers that hide standard Angular APIs without a measurable benefit.',
          ],
          examples: ['signal', 'computed', 'inject'],
          relationships: ['signals-first', 'inject-based-di'],
        },
      ),
      createNode(
        'router-shell',
        'Model feature boundaries through the Angular router',
        'Use provideRouter and feature route files to express navigation, lazy loading, and screen ownership.',
        {
          rules: [
            'Keep route configuration close to the feature it loads.',
            'Use lazy feature boundaries for meaningful product areas rather than every small component.',
          ],
          examples: ['provideRouter(routes)', "loadChildren: () => import('./admin/admin.routes').then(...)"],
          relationships: ['standalone-apis', 'http-boundary'],
        },
      ),
      createNode(
        'http-client-stack',
        'Centralize HTTP concerns with the Angular HTTP client stack',
        'Register HTTP providers once and keep interceptors, auth decoration, and response normalization in the transport layer instead of duplicating them in components.',
        {
          rules: [
            'Use provideHttpClient at bootstrap level.',
            'Keep repeated headers, auth behavior, and error normalization out of feature components.',
          ],
          examples: ['provideHttpClient(withInterceptors([...]))'],
          relationships: ['http-boundary'],
        },
      ),
    ],
    guardrailNodes: [
      createNode(
        'consistency-first',
        'Prefer consistency within the target area over abstract purity',
        'When an existing feature already follows a coherent pattern, extend that pattern before introducing a competing convention.',
        {
          rules: [
            'Do not mix multiple naming or state-management styles inside one feature without a migration plan.',
            'Capture deliberate exceptions in this instruction document instead of relying on tribal knowledge.',
          ],
        },
      ),
      createNode(
        'no-god-components',
        'Do not let feature shells become God components',
        'Break large shells apart when they start mixing rendering, orchestration, validation, and transport details in one class.',
        {
          rules: [
            'Extract reusable transformations, validators, and API adapters out of components.',
            'Keep template files readable without excessive conditional branches.',
          ],
          relationships: ['presentation-boundaries'],
        },
      ),
      createNode(
        'review-on-cross-feature-dependencies',
        'Review every new cross-feature dependency',
        'Cross-feature imports and shared-library additions should be explicit because they shape long-term ownership and coupling.',
        {
          rules: [
            'Add shared code only when at least two concrete consumers justify it.',
            'Document new shared boundaries in the relevant structure or library section.',
          ],
          relationships: ['feature-first-folders', 'router-shell'],
        },
      ),
    ],
    reviewChecklist: [
      'The document reflects the real repo paths and target boundary, not only the Angular baseline.',
      'Every section contains repo-specific examples before the instruction is marked ready.',
      'Naming rules match actual files and selectors in the target area.',
      'Async data ownership, HTTP boundaries, and state rules are explicit.',
      'Cross-feature dependencies and shared-library exceptions are documented.',
    ],
  }
}

export function serializeInstructionMarkdown(args: {
  metadata: InstructionMarkdownMetadata
  document: InstructionDocument
}): string {
  const { metadata, document } = args
  const lines: string[] = [
    '---',
    'schema: betterdoc-instruction/v1',
    `title: ${metadata.title}`,
    `referenceLibrary: ${metadata.referenceLibrary}`,
    `referenceVersion: ${metadata.referenceVersion}`,
    `repoUrl: ${metadata.repoUrl}`,
    `targetKind: ${metadata.targetKind}`,
    `targetName: ${metadata.targetName}`,
    `status: ${metadata.status}`,
    `authorshipMode: ${metadata.authorshipMode}`,
    `fileName: ${metadata.markdownFileName}`,
    '---',
    '',
    '# Overview',
    `- Goal: ${document.overview.goal}`,
    `- Repo Context: ${document.overview.repoContext}`,
    `- Target Context: ${document.overview.targetContext}`,
    `- Source Summary: ${document.overview.sourceSummary}`,
    '',
  ]

  for (const section of instructionSectionDefinitions) {
    lines.push(`# ${section.title}`)
    lines.push('')

    const nodes = document[section.key]

    if (nodes.length === 0) {
      lines.push('_No entries yet._')
      lines.push('')
      continue
    }

    for (const node of nodes) {
      lines.push(`## Node: ${node.id || slugifyInstructionToken(node.title) || 'unnamed-node'}`)
      lines.push(`- Title: ${node.title}`)
      lines.push(`- Summary: ${node.summary}`)
      lines.push(...serializeLineList('Paths', node.paths))
      lines.push(...serializeLineList('Rules', node.rules))
      lines.push(...serializeLineList('Examples', node.examples))
      lines.push(...serializeLineList('Relationships', node.relationships))
      lines.push('')
    }
  }

  lines.push('# Review Checklist')
  lines.push('')

  if (document.reviewChecklist.length === 0) {
    lines.push('- Add review criteria before marking this instruction ready.')
  } else {
    for (const entry of document.reviewChecklist) {
      lines.push(`- ${entry}`)
    }
  }

  lines.push('')

  return `${lines.join('\n')}`.trimEnd()
}

export function parseInstructionMarkdown(markdown: string): {
  metadata: InstructionMarkdownMetadata
  document: InstructionDocument
} | null {
  const parsed = parseFrontmatter(markdown)

  if (!parsed) {
    return null
  }

  const { meta, body } = parsed

  if (
    meta.schema !== 'betterdoc-instruction/v1' ||
    !meta.title ||
    !meta.referenceLibrary ||
    !meta.referenceVersion ||
    !meta.repoUrl ||
    !meta.targetKind ||
    !meta.targetName ||
    !meta.status ||
    !meta.authorshipMode ||
    !meta.fileName
  ) {
    return null
  }

  if (
    !instructionReferenceLibraries.includes(meta.referenceLibrary as InstructionReferenceLibrary) ||
    !instructionTargetKinds.includes(meta.targetKind as InstructionTargetKind) ||
    !instructionStatuses.includes(meta.status as InstructionStatus) ||
    !instructionAuthorshipModes.includes(meta.authorshipMode as InstructionAuthorshipMode)
  ) {
    return null
  }

  const lines = body.split('\n')
  const document: InstructionDocument = {
    overview: {
      goal: '',
      repoContext: '',
      targetContext: '',
      sourceSummary: '',
    },
    structureNodes: [],
    patternNodes: [],
    namingNodes: [],
    dataHandlingNodes: [],
    libraryNodes: [],
    guardrailNodes: [],
    reviewChecklist: [],
  }

  let sectionKey: InstructionSectionKey | 'overview' | 'reviewChecklist' | null = null
  let activeNode: InstructionNode | null = null
  let index = 0

  while (index < lines.length) {
    const line = lines[index]?.trimEnd() ?? ''

    if (line.startsWith('# ')) {
      const heading = line.slice(2).trim()
      sectionKey = sectionKeyByTitle.get(heading) ?? (heading === 'Overview' ? 'overview' : heading === 'Review Checklist' ? 'reviewChecklist' : null)
      activeNode = null
      index += 1
      continue
    }

    if (sectionKey === 'overview' && line.startsWith('- ')) {
      const fieldMatch = line.match(/^- ([A-Za-z ]+):\s*(.*)$/)

      if (fieldMatch) {
        const label = fieldMatch[1] as OverviewFieldLabel
        const fieldKey = overviewFieldKeys[label]

        if (fieldKey) {
          document.overview[fieldKey as OverviewFieldKey] = fieldMatch[2] ?? ''
        }
      }

      index += 1
      continue
    }

    if (sectionKey === 'reviewChecklist' && line.startsWith('- ')) {
      const value = line.slice(2).trim()

      if (value) {
        document.reviewChecklist.push(value)
      }

      index += 1
      continue
    }

    if (
      sectionKey &&
      sectionKey !== 'overview' &&
      sectionKey !== 'reviewChecklist' &&
      line.startsWith('## Node: ')
    ) {
      activeNode = createEmptyInstructionNode()
      activeNode.id = line.slice('## Node: '.length).trim()
      document[sectionKey].push(activeNode)
      index += 1
      continue
    }

    if (
      activeNode &&
      sectionKey &&
      sectionKey !== 'overview' &&
      sectionKey !== 'reviewChecklist' &&
      line.startsWith('- ')
    ) {
      const scalarMatch = line.match(/^- (Title|Summary):\s*(.*)$/)

      if (scalarMatch) {
        const value = scalarMatch[2] ?? ''

        if (scalarMatch[1] === 'Title') {
          activeNode.title = value
        } else {
          activeNode.summary = value
        }

        index += 1
        continue
      }

      const listLabelMatch = line.match(/^- (Paths|Rules|Examples|Relationships):\s*$/)

      if (listLabelMatch) {
        const { values, nextIndex } = parseLineListBlock(lines, index + 1)
        const sanitized = values.filter((value) => value !== 'None recorded')

        switch (listLabelMatch[1]) {
          case 'Paths':
            activeNode.paths = sanitized
            break
          case 'Rules':
            activeNode.rules = sanitized
            break
          case 'Examples':
            activeNode.examples = sanitized
            break
          case 'Relationships':
            activeNode.relationships = sanitized
            break
          default:
            break
        }

        index = nextIndex
        continue
      }
    }

    index += 1
  }

  return {
    metadata: {
      title: meta.title,
      referenceLibrary: meta.referenceLibrary as InstructionReferenceLibrary,
      referenceVersion: meta.referenceVersion,
      repoUrl: meta.repoUrl,
      targetKind: meta.targetKind as InstructionTargetKind,
      targetName: meta.targetName,
      markdownFileName: meta.fileName,
      status: meta.status as InstructionStatus,
      authorshipMode: meta.authorshipMode as InstructionAuthorshipMode,
    },
    document,
  }
}

export function cloneInstructionDocument(document: InstructionDocument): InstructionDocument {
  return {
    overview: { ...document.overview },
    structureNodes: document.structureNodes.map((node) => ({ ...node, paths: [...node.paths], rules: [...node.rules], examples: [...node.examples], relationships: [...node.relationships] })),
    patternNodes: document.patternNodes.map((node) => ({ ...node, paths: [...node.paths], rules: [...node.rules], examples: [...node.examples], relationships: [...node.relationships] })),
    namingNodes: document.namingNodes.map((node) => ({ ...node, paths: [...node.paths], rules: [...node.rules], examples: [...node.examples], relationships: [...node.relationships] })),
    dataHandlingNodes: document.dataHandlingNodes.map((node) => ({ ...node, paths: [...node.paths], rules: [...node.rules], examples: [...node.examples], relationships: [...node.relationships] })),
    libraryNodes: document.libraryNodes.map((node) => ({ ...node, paths: [...node.paths], rules: [...node.rules], examples: [...node.examples], relationships: [...node.relationships] })),
    guardrailNodes: document.guardrailNodes.map((node) => ({ ...node, paths: [...node.paths], rules: [...node.rules], examples: [...node.examples], relationships: [...node.relationships] })),
    reviewChecklist: [...document.reviewChecklist],
  }
}

export function sectionTitleForKey(key: InstructionSectionKey): string {
  return sectionTitleByKey.get(key) ?? key
}
