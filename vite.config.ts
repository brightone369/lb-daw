import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'static-spa-404-fallback',
      closeBundle() {
        const distIndexPath = resolve(__dirname, 'dist/index.html')
        const dist404Path = resolve(__dirname, 'dist/404.html')

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
