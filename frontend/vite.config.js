import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from "path";

const backendTarget = process.env.VITE_DEV_PROXY_TARGET || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/ws': {
        target: backendTarget,
        ws: true,
      },
    },
  },
  
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        replay: resolve(__dirname, "replay.html"),
      },
    },
  },
})