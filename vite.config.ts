import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  server: {
    port: 3000,
    strictPort: true,
  },
  plugins: [
    tsconfigPaths(),
    tanstackStart({
      srcDirectory: 'src',
    }),
    viteReact(),
  ],
})
