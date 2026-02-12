import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  scanAngularWorkspace,
} from './angular-scanner'

describe('scanAngularWorkspace', () => {
  it('extracts projects, libs, components, dependencies, and deterministic file paths', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'betterdoc-angular-scan-'))

    try {
      await createFile(
        workspaceRoot,
        'angular.json',
        JSON.stringify(
          {
            version: 1,
            projects: {
              portal: {
                projectType: 'application',
                root: 'apps/portal',
                sourceRoot: 'apps/portal/src',
              },
              'ui-kit': {
                projectType: 'library',
                root: 'libs/ui-kit',
                sourceRoot: 'libs/ui-kit/src',
              },
              'shared-utils': {
                projectType: 'library',
                root: 'libs/shared-utils',
                sourceRoot: 'libs/shared-utils/src',
              },
            },
          },
          null,
          2,
        ),
      )

      await createFile(
        workspaceRoot,
        'tsconfig.base.json',
        JSON.stringify(
          {
            compilerOptions: {
              paths: {
                '@betterdoc/ui-kit/*': ['libs/ui-kit/src/*'],
                '@betterdoc/shared-utils': ['libs/shared-utils/src/public-api.ts'],
                '@betterdoc/shared-utils/*': ['libs/shared-utils/src/*'],
              },
            },
          },
          null,
          2,
        ),
      )

      await createFile(
        workspaceRoot,
        'apps/portal/src/app/app.component.ts',
        `import { Component } from '@angular/core'
import { ButtonComponent } from '@betterdoc/ui-kit/button/button.component'
import { formatName } from '@betterdoc/shared-utils'

@Component({
  selector: 'bd-root',
  standalone: true,
  imports: [ButtonComponent],
  template: '<bd-button></bd-button>',
})
export class AppComponent {
  label = formatName('portal')
}
`,
      )

      await createFile(
        workspaceRoot,
        'apps/portal/src/main.ts',
        `import { formatName } from '@betterdoc/shared-utils'

export const appName = formatName('portal')
`,
      )

      await createFile(
        workspaceRoot,
        'libs/ui-kit/src/button/button.component.ts',
        `import { Component } from '@angular/core'
import { formatName } from '@betterdoc/shared-utils/format-name'

@Component({
  selector: 'bd-button',
  template: '<button>{{label}}</button>',
})
export class ButtonComponent {
  label = formatName('button')
}
`,
      )

      await createFile(
        workspaceRoot,
        'libs/shared-utils/src/profile-card/profile-card.component.ts',
        `import { Component } from '@angular/core'

@Component({
  selector: 'bd-profile-card',
  template: '<div>Profile</div>',
})
export class ProfileCardComponent {}
`,
      )

      await createFile(
        workspaceRoot,
        'libs/shared-utils/src/public-api.ts',
        `export * from './format-name'
`,
      )

      await createFile(
        workspaceRoot,
        'libs/shared-utils/src/format-name.ts',
        `export function formatName(value: string): string {
  return value.toUpperCase()
}
`,
      )

      const firstScan = await scanAngularWorkspace(workspaceRoot)
      const secondScan = await scanAngularWorkspace(workspaceRoot)

      expect(secondScan).toEqual(firstScan)
      expect(firstScan).toEqual({
        schemaVersion: 1,
        workspaceConfigPath: 'angular.json',
        projects: [
          {
            name: 'portal',
            type: 'application',
            rootPath: 'apps/portal',
            sourceRootPath: 'apps/portal/src',
            configFilePath: 'angular.json',
            dependencies: ['shared-utils', 'ui-kit'],
          },
          {
            name: 'shared-utils',
            type: 'library',
            rootPath: 'libs/shared-utils',
            sourceRootPath: 'libs/shared-utils/src',
            configFilePath: 'angular.json',
            dependencies: [],
          },
          {
            name: 'ui-kit',
            type: 'library',
            rootPath: 'libs/ui-kit',
            sourceRootPath: 'libs/ui-kit/src',
            configFilePath: 'angular.json',
            dependencies: ['shared-utils'],
          },
        ],
        libs: [
          {
            name: 'shared-utils',
            rootPath: 'libs/shared-utils',
            sourceRootPath: 'libs/shared-utils/src',
            configFilePath: 'angular.json',
          },
          {
            name: 'ui-kit',
            rootPath: 'libs/ui-kit',
            sourceRootPath: 'libs/ui-kit/src',
            configFilePath: 'angular.json',
          },
        ],
        components: [
          {
            name: 'AppComponent',
            className: 'AppComponent',
            selector: 'bd-root',
            standalone: true,
            project: 'portal',
            filePath: 'apps/portal/src/app/app.component.ts',
            dependencies: ['shared-utils', 'ui-kit'],
          },
          {
            name: 'ProfileCardComponent',
            className: 'ProfileCardComponent',
            selector: 'bd-profile-card',
            standalone: null,
            project: 'shared-utils',
            filePath: 'libs/shared-utils/src/profile-card/profile-card.component.ts',
            dependencies: [],
          },
          {
            name: 'ButtonComponent',
            className: 'ButtonComponent',
            selector: 'bd-button',
            standalone: null,
            project: 'ui-kit',
            filePath: 'libs/ui-kit/src/button/button.component.ts',
            dependencies: ['shared-utils'],
          },
        ],
        dependencies: [
          {
            sourceProject: 'portal',
            targetProject: 'shared-utils',
            viaFiles: [
              'apps/portal/src/app/app.component.ts',
              'apps/portal/src/main.ts',
            ],
          },
          {
            sourceProject: 'portal',
            targetProject: 'ui-kit',
            viaFiles: ['apps/portal/src/app/app.component.ts'],
          },
          {
            sourceProject: 'ui-kit',
            targetProject: 'shared-utils',
            viaFiles: ['libs/ui-kit/src/button/button.component.ts'],
          },
        ],
      })
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true })
    }
  })

  it('loads project definitions from project.json references', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'betterdoc-angular-scan-'))

    try {
      await createFile(
        workspaceRoot,
        'angular.json',
        JSON.stringify(
          {
            version: 1,
            projects: {
              portal: 'apps/portal',
              'shared-utils': 'libs/shared-utils',
            },
          },
          null,
          2,
        ),
      )

      await createFile(
        workspaceRoot,
        'apps/portal/project.json',
        JSON.stringify(
          {
            projectType: 'application',
            root: 'apps/portal',
            sourceRoot: 'apps/portal/src',
          },
          null,
          2,
        ),
      )

      await createFile(
        workspaceRoot,
        'libs/shared-utils/project.json',
        JSON.stringify(
          {
            projectType: 'library',
            root: 'libs/shared-utils',
            sourceRoot: 'libs/shared-utils/src',
          },
          null,
          2,
        ),
      )

      await createFile(
        workspaceRoot,
        'apps/portal/src/app/app.component.ts',
        `import { Component } from '@angular/core'

@Component({
  selector: 'bd-root',
  template: '<div>Portal</div>',
})
export class AppComponent {}
`,
      )

      await createFile(
        workspaceRoot,
        'libs/shared-utils/src/public-api.ts',
        'export const value = 1\n',
      )

      const snapshot = await scanAngularWorkspace(workspaceRoot)

      expect(snapshot.projects).toEqual([
        {
          name: 'portal',
          type: 'application',
          rootPath: 'apps/portal',
          sourceRootPath: 'apps/portal/src',
          configFilePath: 'apps/portal/project.json',
          dependencies: [],
        },
        {
          name: 'shared-utils',
          type: 'library',
          rootPath: 'libs/shared-utils',
          sourceRootPath: 'libs/shared-utils/src',
          configFilePath: 'libs/shared-utils/project.json',
          dependencies: [],
        },
      ])
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true })
    }
  })

  it('throws an explicit error when workspace config is missing', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'betterdoc-angular-scan-'))

    try {
      await expect(scanAngularWorkspace(workspaceRoot)).rejects.toMatchObject({
        code: 'WORKSPACE_NOT_FOUND',
      })
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true })
    }
  })

  it('throws a parse error for invalid angular.json files', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'betterdoc-angular-scan-'))

    try {
      await createFile(workspaceRoot, 'angular.json', '{"projects":')

      await expect(scanAngularWorkspace(workspaceRoot)).rejects.toEqual(
        expect.objectContaining({
          code: 'WORKSPACE_PARSE_ERROR',
        }),
      )
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true })
    }
  })
})

async function createFile(
  workspaceRoot: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const filePath = path.join(workspaceRoot, relativePath)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, content, 'utf8')
}
