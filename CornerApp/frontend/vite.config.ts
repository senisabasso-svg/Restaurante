import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0', // Permitir acceso desde la red local
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
        secure: false,
      },
      '/admin/api': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
        secure: false,
      },
      '/images': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
        secure: false,
      },
      '/hubs': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
        ws: true, // Habilitar WebSocket proxy para SignalR
        secure: false,
      },
    },
  },
})

