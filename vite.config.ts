import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Read package.json version at build time (Node context)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react', 'nodemailer'],
  },
  define: {
    global: 'globalThis',
    __APP_VERSION__: JSON.stringify(pkg.version || '0.0.0'),
  },
  json: {
    namedExports: true,
  },
  build: {
    rollupOptions: {
      external: ['nodemailer'],
    },
  },
});
