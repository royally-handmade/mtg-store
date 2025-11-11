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
  }
})