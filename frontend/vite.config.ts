import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      stream: path.resolve(__dirname, 'src/shims/stream.ts'),
      'node:stream': path.resolve(__dirname, 'src/shims/stream.ts'),
      util: path.resolve(__dirname, 'src/shims/util.ts'),
      'node:util': path.resolve(__dirname, 'src/shims/util.ts'),
    },
  },
})
