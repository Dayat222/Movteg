import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 1500, // Matikan peringatan batas ukuran file
    rollupOptions: {
      output: {
        manualChunks: {
          // Pisahkan library besar agar loading web lebih cepat
          vendor: ['react', 'react-dom'],
          icons: ['lucide-react'],
          media: ['hls.js'],
          network: ['mqtt']
        }
      }
    }
  }
})
