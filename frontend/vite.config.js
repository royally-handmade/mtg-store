import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from "tailwindcss";
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  css: {
    postcss: {
      plugins: [tailwindcss()]
    }
  },
  server: {
    proxy: {
      '/api': {
        //production
        target: 'https://mtg-store-api.onrender.com',
        changeOrigin: true
      }
    }
  },
  build: {
    // Ensure proper chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'ui-vendor': ['@headlessui/vue', '@heroicons/vue']
        }
      }
    }
  },
  // SSG/Prerendering will be handled by vite-ssg separately
  ssgOptions: {
    script: 'async',
    formatting: 'minify',
    format: 'esm'
  }
})