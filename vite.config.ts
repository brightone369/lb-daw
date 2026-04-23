import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'static-spa-404-fallback',
      closeBundle() {
        const distIndexPath = resolve(rootDir, 'dist/index.html')
        const dist404Path = resolve(rootDir, 'dist/404.html')

        if (existsSync(distIndexPath)) {
          copyFileSync(distIndexPath, dist404Path)
        }
      },
    },
  ],
  test: {
    environment: 'node',
  },
})
