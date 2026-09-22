import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'mirror-dist-to-root',
      closeBundle() {
        try {
          const clientDist = path.resolve('dist');
          const rootDist = path.resolve('../dist');
          if (fs.existsSync(clientDist)) {
            fs.cpSync(clientDist, rootDist, { recursive: true });
            console.log('✓ Successfully mirrored build to root dist for Vercel');
          }
        } catch (err) {
          console.error('Failed to mirror dist to root:', err);
        }
      }
    }
  ],
  build: {
    chunkSizeWarningLimit: 1500, // Matikan peringatan batas ukuran file
    rollupOptions: {
      output: {}
    }
  }
})
