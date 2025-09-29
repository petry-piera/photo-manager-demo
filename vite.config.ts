import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'public/index.html')
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/models': resolve(__dirname, 'src/models'),
      '@/services': resolve(__dirname, 'src/services'),
      '@/components': resolve(__dirname, 'src/components'),
      '@/pages': resolve(__dirname, 'src/pages'),
      '@/utils': resolve(__dirname, 'src/utils'),
      '@/styles': resolve(__dirname, 'src/styles')
    }
  },
  server: {
    port: 5173,
    host: true,
    open: false
  },
  preview: {
    port: 4173,
    host: true
  },
  esbuild: {
    target: 'esnext',
    keepNames: true
  }
});