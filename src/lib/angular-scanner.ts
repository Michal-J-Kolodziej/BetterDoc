import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

export type AngularProjectType = 'application' | 'library'

export type AngularScanProject = {
  name: string
  type: AngularProjectType
  rootPath: string
  sourceRootPath: string | null
  configFilePath: string
  dependencies: string[]
}

export type AngularScanLibrary = {
  name: string
  rootPath: string
  sourceRootPath: string | null
  configFilePath: string
}

export type AngularScanComponent = {
  name: string
  className: string | null
  selector: string | null
  standalone: boolean | null
  project: string
  filePath: string
  dependencies: string[]
}

export type AngularScanDependency = {
  sourceProject: string
  targetProject: string
  viaFiles: string[]
}

export type AngularScanSnapshot = {
  schemaVersion: 1
  workspaceConfigPath: string
  projects: AngularScanProject[]
  libs: AngularScanLibrary[]
  components: AngularScanComponent[]
  dependencies: AngularScanDependency[]
}

export type AngularScannerErrorCode =
  | 'WORKSPACE_NOT_FOUND'
  | 'WORKSPACE_PARSE_ERROR'
  | 'WORKSPACE_PROJECTS_INVALID'
  | 'PROJECT_CONFIG_NOT_FOUND'
  | 'PROJECT_CONFIG_PARSE_ERROR'
  | 'PROJECT_CONFIG_INVALID'
  | 'INVALID_PATH'

export class AngularScannerError extends Error {
  readonly code: AngularScannerErrorCode
  readonly details: Record<string, string>

  constructor(
    code: AngularScannerErrorCode,
    message: string,
    details: Record<string, string> = {},
  ) {
    super(message)
    this.name = 'AngularScannerError'
    this.code = code
    this.details = details
  }
}

type WorkspaceProjectConfig = {
  root?: unknown
  sourceRoot?: unknown
  projectType?: unknown
}

type LoadedWorkspace = {
  configFilePath: string
  projects: Record<string, WorkspaceProjectConfig | string>
}

type ProjectDefinition = {
  name: string
  type: AngularProjectType
  rootPath: string
  sourceRootPath: string | null
  configFilePath: string
  absoluteRootPath: string
  absoluteScanRootPath: string
}

type AliasRule = {
  aliasBase: string
  project: string
}

const workspaceConfigCandidates = ['angular.json', 'workspace.json']

const ignoredDirectories = new Set([
  '.git',
  '.hg',
  '.idea',
  '.nx',
  '.vscode',
  'coverage',
  'dist',
  'node_modules',
  'tmp',
])

const ignoredFileSuffixes = ['.d.ts', '.spec.ts', '.stories.ts', '.test.ts']

export async function scanAngularWorkspace(
  workspaceRootInput: string,
): Promise<AngularScanSnapshot> {
  const workspaceRoot = path.resolve(workspaceRootInput)
  const workspace = await loadWorkspace(workspaceRoot)
  const projectDefinitions = await loadProjects(workspaceRoot, workspace)
  const sortedProjects = [...projectDefinitions].sort((left, right) =>
    left.name.localeCompare(right.name),
  )

  const sortedProjectsByRootLength = [...sortedProjects].sort((left, right) => {
    if (right.absoluteRootPath.length !== left.absoluteRootPath.length) {
      return right.absoluteRootPath.length - left.absoluteRootPath.length
    }

    return left.name.localeCompare(right.name)
  })

  const aliasRules = await buildAliasRules(workspaceRoot, sortedProjectsByRootLength)

  const componentEntries: AngularScanComponent[] = []
  const dependencyFilesBySourceAndTarget = new Map<string, Map<string, Set<string>>>()

  for (const project of sortedProjects) {
    if (!existsSync(project.absoluteScanRootPath)) {
      continue
    }

    const projectFiles = await listFilesRecursively(project.absoluteScanRootPath)

    for (const absoluteFilePath of projectFiles) {
      if (!absoluteFilePath.endsWith('.ts')) {
        continue
      }

      if (ignoredFileSuffixes.some((suffix) => absoluteFilePath.endsWith(suffix))) {
        continue
      }

      const relativeFilePath = toRelativePath(workspaceRoot, absoluteFilePath)
      const fileContent = await readFile(absoluteFilePath, 'utf8')

      const importSpecifiers = extractImportSpecifiers(fileContent)
      const fileDependencies = resolveProjectDependencies(
        project.name,
        importSpecifiers,
        absoluteFilePath,
        aliasRules,
        sortedProjectsByRootLength,
      )

      for (const dependency of fileDependencies) {
        registerDependency(
          dependencyFilesBySourceAndTarget,
          project.name,
          dependency,
          relativeFilePath,
        )
      }

      const componentMetadata = extractComponentMetadata(fileContent, relativeFilePath)
      if (!componentMetadata) {
        continue
      }

      componentEntries.push({
        name: componentMetadata.name,
        className: componentMetadata.className,
        selector: componentMetadata.selector,
        standalone: componentMetadata.standalone,
        project: project.name,
        filePath: relativeFilePath,
        dependencies: [...fileDependencies].sort((left, right) =>
          left.localeCompare(right),
        ),
      })
    }
  }

  const dependencies = formatDependencies(dependencyFilesBySourceAndTarget)
  const dependencyTargetsByProject = mapDependencyTargetsByProject(dependencies)

  const projects: AngularScanProject[] = sortedProjects.map((project) => ({
    name: project.name,
    type: project.type,
    rootPath: project.rootPath,
    sourceRootPath: project.sourceRootPath,
    configFilePath: project.configFilePath,
    dependencies:
      dependencyTargetsByProject.get(project.name)?.slice() ?? [],
  }))

  const libs = projects
    .filter((project) => project.type === 'library')
    .map((project) => ({
      name: project.name,
      rootPath: project.rootPath,
      sourceRootPath: project.sourceRootPath,
      configFilePath: project.configFilePath,
    }))

  const components = [...componentEntries].sort((left, right) => {
    const byProject = left.project.localeCompare(right.project)
    if (byProject !== 0) {
      return byProject
    }

    const byFilePath = left.filePath.localeCompare(right.filePath)
    if (byFilePath !== 0) {
      return byFilePath
    }

    return left.name.localeCompare(right.name)
  })

  return {
    schemaVersion: 1,
    workspaceConfigPath: workspace.configFilePath,
    projects,
    libs,
    components,
    dependencies,
  }
}

export async function writeAngularScanSnapshot(
  outputFilePath: string,
  snapshot: AngularScanSnapshot,
): Promise<void> {
  const absoluteOutputPath = path.resolve(outputFilePath)
  await mkdir(path.dirname(absoluteOutputPath), { recursive: true })
  await writeFile(absoluteOutputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
}

function mapDependencyTargetsByProject(
  dependencies: AngularScanDependency[],
): Map<string, string[]> {
  const targetsByProject = new Map<string, string[]>()

  for (const dependency of dependencies) {
    const existingTargets = targetsByProject.get(dependency.sourceProject) ?? []
    if (!existingTargets.includes(dependency.targetProject)) {
      existingTargets.push(dependency.targetProject)
      existingTargets.sort((left, right) => left.localeCompare(right))
    }

    targetsByProject.set(dependency.sourceProject, existingTargets)
  }

  return targetsByProject
}

function formatDependencies(
  dependencyFilesBySourceAndTarget: Map<string, Map<string, Set<string>>>,
): AngularScanDependency[] {
  const edges: AngularScanDependency[] = []

  for (const [sourceProject, targets] of dependencyFilesBySourceAndTarget) {
    for (const [targetProject, viaFiles] of targets) {
      edges.push({
        sourceProject,
        targetProject,
        viaFiles: [...viaFiles].sort((left, right) => left.localeCompare(right)),
      })
    }
  }

  return edges.sort((left, right) => {
    const bySource = left.sourceProject.localeCompare(right.sourceProject)
    if (bySource !== 0) {
      return bySource
    }

    return left.targetProject.localeCompare(right.targetProject)
  })
}

function registerDependency(
  dependencyFilesBySourceAndTarget: Map<string, Map<string, Set<string>>>,
  sourceProject: string,
  targetProject: string,
  filePath: string,
): void {
  const targets = dependencyFilesBySourceAndTarget.get(sourceProject) ?? new Map()
  const files = targets.get(targetProject) ?? new Set<string>()

  files.add(filePath)
  targets.set(targetProject, files)
  dependencyFilesBySourceAndTarget.set(sourceProject, targets)
}

function resolveProjectDependencies(
  sourceProject: string,
  importSpecifiers: string[],
  filePath: string,
  aliasRules: AliasRule[],
  projectsByRootLength: ProjectDefinition[],
): Set<string> {
  const dependencies = new Set<string>()

  for (const importSpecifier of importSpecifiers) {
    const targetProject = resolveImportProject(
      importSpecifier,
      filePath,
      aliasRules,
      projectsByRootLength,
    )

    if (!targetProject) {
      continue
    }

    if (targetProject === sourceProject) {
      continue
    }

    dependencies.add(targetProject)
  }

  return dependencies
}

function resolveImportProject(
  importSpecifier: string,
  filePath: string,
  aliasRules: AliasRule[],
  projectsByRootLength: ProjectDefinition[],
): string | null {
  if (importSpecifier.startsWith('.')) {
    const resolvedPath = path.resolve(path.dirname(filePath), importSpecifier)
    return findProjectByAbsolutePath(resolvedPath, projectsByRootLength)
  }

  for (const aliasRule of aliasRules) {
    if (
      importSpecifier === aliasRule.aliasBase ||
      importSpecifier.startsWith(`${aliasRule.aliasBase}/`)
    ) {
      return aliasRule.project
    }
  }

  return null
}

function findProjectByAbsolutePath(
  absolutePath: string,
  projectsByRootLength: ProjectDefinition[],
): string | null {
  const normalizedAbsolutePath = normalizeAbsolutePath(absolutePath)

  for (const project of projectsByRootLength) {
    if (
      normalizedAbsolutePath === project.absoluteRootPath ||
      normalizedAbsolutePath.startsWith(`${project.absoluteRootPath}/`)
    ) {
      return project.name
    }
  }

  return null
}

async function buildAliasRules(
  workspaceRoot: string,
  projectsByRootLength: ProjectDefinition[],
): Promise<AliasRule[]> {
  const tsConfigPaths = await loadTypeScriptPaths(workspaceRoot)
  const aliasRules: AliasRule[] = []

  for (const [alias, targets] of tsConfigPaths) {
    if (!Array.isArray(targets) || targets.length === 0) {
      continue
    }

    const aliasBase = normalizeAliasBase(alias)
    if (!aliasBase) {
      continue
    }

    const project = targets
      .map((target) => resolveTargetProject(workspaceRoot, target, projectsByRootLength))
      .find((candidate): candidate is string => candidate !== null)

    if (!project) {
      continue
    }

    aliasRules.push({ aliasBase, project })
  }

  return aliasRules
    .sort((left, right) => {
      if (right.aliasBase.length !== left.aliasBase.length) {
        return right.aliasBase.length - left.aliasBase.length
      }

      return left.aliasBase.localeCompare(right.aliasBase)
    })
    .filter((rule, index, rules) => {
      if (index === 0) {
        return true
      }

      const previousRule = rules[index - 1]
      return !(previousRule.aliasBase === rule.aliasBase && previousRule.project === rule.project)
    })
}

function resolveTargetProject(
  workspaceRoot: string,
  targetPath: unknown,
  projectsByRootLength: ProjectDefinition[],
): string | null {
  if (typeof targetPath !== 'string') {
    return null
  }

  const normalizedTargetPath = targetPath
    .replace(/\\/g, '/')
    .replace(/\/\*+$/, '')
    .replace(/\/$/, '')

  if (!normalizedTargetPath) {
    return null
  }

  const absoluteTargetPath = normalizeAbsolutePath(
    path.resolve(workspaceRoot, normalizedTargetPath),
  )

  return findProjectByAbsolutePath(absoluteTargetPath, projectsByRootLength)
}

function normalizeAliasBase(alias: string): string | null {
  if (!alias.trim()) {
    return null
  }

  return alias.endsWith('/*') ? alias.slice(0, -2) : alias
}

async function loadTypeScriptPaths(
  workspaceRoot: string,
): Promise<Map<string, unknown>> {
  const tsConfigCandidates = ['tsconfig.base.json', 'tsconfig.json']
  const paths = new Map<string, unknown>()

  for (const tsConfigCandidate of tsConfigCandidates) {
    const tsConfigFilePath = path.join(workspaceRoot, tsConfigCandidate)
    if (!existsSync(tsConfigFilePath)) {
      continue
    }

    const tsConfig = await parseJsonFile(tsConfigFilePath, 'WORKSPACE_PARSE_ERROR')
    if (!isRecord(tsConfig)) {
      continue
    }

    const compilerOptions = tsConfig.compilerOptions
    if (!isRecord(compilerOptions)) {
      continue
    }

    const candidatePaths = compilerOptions.paths
    if (!isRecord(candidatePaths)) {
      continue
    }

    for (const [alias, targets] of Object.entries(candidatePaths)) {
      paths.set(alias, targets)
    }
  }

  return paths
}

async function loadProjects(
  workspaceRoot: string,
  workspace: LoadedWorkspace,
): Promise<ProjectDefinition[]> {
  const projectDefinitions: ProjectDefinition[] = []

  for (const projectName of Object.keys(workspace.projects).sort((left, right) =>
    left.localeCompare(right),
  )) {
    const rawProjectDefinition = workspace.projects[projectName]
    const loadedProject = await loadProjectDefinition(
      workspaceRoot,
      workspace.configFilePath,
      projectName,
      rawProjectDefinition,
    )

    projectDefinitions.push(loadedProject)
  }

  return projectDefinitions
}

async function loadProjectDefinition(
  workspaceRoot: string,
  workspaceConfigPath: string,
  projectName: string,
  rawProjectDefinition: WorkspaceProjectConfig | string,
): Promise<ProjectDefinition> {
  let projectDefinition: WorkspaceProjectConfig
  let configFilePath = workspaceConfigPath
  let defaultRootPath: string | null = null

  if (typeof rawProjectDefinition === 'string') {
    const normalizedProjectConfigPath = normalizeWorkspacePath(
      rawProjectDefinition.endsWith('.json')
        ? rawProjectDefinition
        : `${rawProjectDefinition}/project.json`,
    )

    const absoluteProjectConfigPath = path.resolve(workspaceRoot, normalizedProjectConfigPath)

    if (!existsSync(absoluteProjectConfigPath)) {
      throw new AngularScannerError(
        'PROJECT_CONFIG_NOT_FOUND',
        `Project "${projectName}" references missing config file "${normalizedProjectConfigPath}".`,
        {
          project: projectName,
          configFilePath: normalizedProjectConfigPath,
        },
      )
    }

    const parsedProjectConfig = await parseJsonFile(
      absoluteProjectConfigPath,
      'PROJECT_CONFIG_PARSE_ERROR',
    )

    if (!isRecord(parsedProjectConfig)) {
      throw new AngularScannerError(
        'PROJECT_CONFIG_INVALID',
        `Project "${projectName}" config file "${normalizedProjectConfigPath}" is not a JSON object.`,
        {
          project: projectName,
          configFilePath: normalizedProjectConfigPath,
        },
      )
    }

    projectDefinition = parsedProjectConfig
    configFilePath = normalizeWorkspacePath(path.relative(workspaceRoot, absoluteProjectConfigPath))

    if (normalizedProjectConfigPath.endsWith('/project.json')) {
      defaultRootPath = normalizedProjectConfigPath.slice(0, -'/project.json'.length)
    }
  } else if (isRecord(rawProjectDefinition)) {
    projectDefinition = rawProjectDefinition
  } else {
    throw new AngularScannerError(
      'WORKSPACE_PROJECTS_INVALID',
      `Project "${projectName}" has an unsupported configuration shape.`,
      {
        project: projectName,
      },
    )
  }

  const rootValue =
    typeof projectDefinition.root === 'string'
      ? normalizeWorkspacePath(projectDefinition.root)
      : defaultRootPath

  if (!rootValue) {
    throw new AngularScannerError(
      'PROJECT_CONFIG_INVALID',
      `Project "${projectName}" is missing a "root" path.`,
      {
        project: projectName,
        configFilePath,
      },
    )
  }

  const sourceRootValue =
    typeof projectDefinition.sourceRoot === 'string' && projectDefinition.sourceRoot.trim().length > 0
      ? normalizeWorkspacePath(projectDefinition.sourceRoot)
      : null

  const projectType = inferProjectType(projectDefinition.projectType, rootValue)

  const absoluteRootPath = normalizeAbsolutePath(path.resolve(workspaceRoot, rootValue))
  const absoluteScanRootPath = normalizeAbsolutePath(
    path.resolve(workspaceRoot, sourceRootValue ?? rootValue),
  )

  assertInsideWorkspace(workspaceRoot, absoluteRootPath, projectName)
  assertInsideWorkspace(workspaceRoot, absoluteScanRootPath, projectName)

  return {
    name: projectName,
    type: projectType,
    rootPath: rootValue,
    sourceRootPath: sourceRootValue,
    configFilePath,
    absoluteRootPath,
    absoluteScanRootPath,
  }
}

function assertInsideWorkspace(
  workspaceRoot: string,
  absoluteTargetPath: string,
  projectName: string,
): void {
  const normalizedWorkspaceRoot = normalizeAbsolutePath(workspaceRoot)
  if (
    absoluteTargetPath !== normalizedWorkspaceRoot &&
    !absoluteTargetPath.startsWith(`${normalizedWorkspaceRoot}/`)
  ) {
    throw new AngularScannerError(
      'INVALID_PATH',
      `Project "${projectName}" resolved path outside workspace root.`,
      {
        project: projectName,
        targetPath: absoluteTargetPath,
      },
    )
  }
}

function inferProjectType(projectTypeValue: unknown, rootPath: string): AngularProjectType {
  if (projectTypeValue === 'application' || projectTypeValue === 'library') {
    return projectTypeValue
  }

  if (rootPath === 'libs' || rootPath.startsWith('libs/')) {
    return 'library'
  }

  return 'application'
}

async function loadWorkspace(workspaceRoot: string): Promise<LoadedWorkspace> {
  for (const candidate of workspaceConfigCandidates) {
    const absoluteCandidatePath = path.join(workspaceRoot, candidate)

    if (!existsSync(absoluteCandidatePath)) {
      continue
    }

    const parsedConfig = await parseJsonFile(
      absoluteCandidatePath,
      'WORKSPACE_PARSE_ERROR',
    )

    if (!isRecord(parsedConfig)) {
      throw new AngularScannerError(
        'WORKSPACE_PROJECTS_INVALID',
        `Workspace config "${candidate}" is not a JSON object.`,
        { workspaceConfigPath: candidate },
      )
    }

    if (!isRecord(parsedConfig.projects)) {
      throw new AngularScannerError(
        'WORKSPACE_PROJECTS_INVALID',
        `Workspace config "${candidate}" is missing a "projects" object.`,
        { workspaceConfigPath: candidate },
      )
    }

    return {
      configFilePath: candidate,
      projects: parsedConfig.projects as Record<string, WorkspaceProjectConfig | string>,
    }
  }

  throw new AngularScannerError(
    'WORKSPACE_NOT_FOUND',
    `Could not find an Angular workspace config in "${workspaceRoot}".`,
    {
      checkedFiles: workspaceConfigCandidates.join(', '),
    },
  )
}

async function parseJsonFile(
  filePath: string,
  parseErrorCode: 'WORKSPACE_PARSE_ERROR' | 'PROJECT_CONFIG_PARSE_ERROR',
): Promise<unknown> {
  const fileContent = await readFile(filePath, 'utf8')

  try {
    return JSON.parse(fileContent)
  } catch (error) {
    const parseMessage = error instanceof Error ? error.message : 'Unknown parse error'
    const normalizedFilePath = normalizeWorkspacePath(filePath)

    throw new AngularScannerError(
      parseErrorCode,
      `Failed to parse JSON file "${normalizedFilePath}": ${parseMessage}`,
      { filePath: normalizedFilePath },
    )
  }
}

async function listFilesRecursively(rootDirectoryPath: string): Promise<string[]> {
  const files: string[] = []

  async function walk(directoryPath: string): Promise<void> {
    const entries = await readdir(directoryPath, { withFileTypes: true })
    const sortedEntries = [...entries].sort((left, right) =>
      left.name.localeCompare(right.name),
    )

    for (const entry of sortedEntries) {
      const entryPath = path.join(directoryPath, entry.name)

      if (entry.isDirectory()) {
        if (ignoredDirectories.has(entry.name)) {
          continue
        }

        await walk(entryPath)
        continue
      }

      if (!entry.isFile()) {
        continue
      }

      files.push(entryPath)
    }
  }

  await walk(rootDirectoryPath)

  return files
}

function extractComponentMetadata(
  fileContent: string,
  relativeFilePath: string,
): {
  name: string
  className: string | null
  selector: string | null
  standalone: boolean | null
} | null {
  const componentDecoratorMatch = /@Component\s*\(\s*\{([\s\S]*?)\}\s*\)/m.exec(fileContent)
  if (!componentDecoratorMatch) {
    return null
  }

  const componentDecoratorBody = componentDecoratorMatch[1]
  const selectorMatch = /selector\s*:\s*['"`]([^'"`]+)['"`]/m.exec(componentDecoratorBody)
  const standaloneMatch = /standalone\s*:\s*(true|false)/m.exec(componentDecoratorBody)
  const classNameMatch = /@Component[\s\S]*?export\s+class\s+([A-Za-z_][A-Za-z0-9_]*)/m.exec(
    fileContent,
  )

  const className = classNameMatch?.[1] ?? null

  return {
    name: className ?? deriveComponentNameFromFilePath(relativeFilePath),
    className,
    selector: selectorMatch?.[1] ?? null,
    standalone: standaloneMatch
      ? standaloneMatch[1] === 'true'
      : null,
  }
}

function deriveComponentNameFromFilePath(relativeFilePath: string): string {
  const fileNameWithoutExtension = path.basename(relativeFilePath, '.ts')
  return fileNameWithoutExtension
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join('')
}

function extractImportSpecifiers(fileContent: string): string[] {
  const importSpecifiers = new Set<string>()
  const patterns = [
    /\bimport\s+(?:[^'"`]+\s+from\s+)?['"`]([^'"`]+)['"`]/g,
    /\bexport\s+[^'"`]*\s+from\s+['"`]([^'"`]+)['"`]/g,
    /\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
  ]

  for (const pattern of patterns) {
    let match: RegExpExecArray | null = pattern.exec(fileContent)

    while (match) {
      importSpecifiers.add(match[1])
      match = pattern.exec(fileContent)
    }
  }

  return [...importSpecifiers].sort((left, right) => left.localeCompare(right))
}

function normalizeWorkspacePath(rawPath: string): string {
  const withForwardSlashes = rawPath.replace(/\\/g, '/')
  const withoutLeadingDotSlash = withForwardSlashes.replace(/^\.\//, '')
  const withoutTrailingSlash = withoutLeadingDotSlash.replace(/\/$/, '')

  return withoutTrailingSlash.length > 0 ? withoutTrailingSlash : '.'
}

function normalizeAbsolutePath(absolutePath: string): string {
  return absolutePath.replace(/\\/g, '/').replace(/\/$/, '')
}

function toRelativePath(workspaceRoot: string, absolutePath: string): string {
  const relativePath = path.relative(workspaceRoot, absolutePath)
  return normalizeWorkspacePath(relativePath)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
