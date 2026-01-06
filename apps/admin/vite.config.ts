import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function normalizeId(id: string) {
  return id.replace(/\\/g, '/');
}

export default defineConfig(({ mode }) => {
  const base = process.env.VITE_BASE || '/';
  return {
    base,
    server: {
      port: 3001,
      host: '0.0.0.0',
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = normalizeId(id);
            if (!normalizedId.includes('node_modules')) return;

            if (
              normalizedId.includes('/node_modules/react-dom/') ||
              normalizedId.includes('/node_modules/react/') ||
              normalizedId.includes('/node_modules/scheduler/')
            ) {
              return 'react';
            }
            if (
              normalizedId.includes('/node_modules/react-router/') ||
              normalizedId.includes('/node_modules/react-router-dom/')
            ) {
              return 'router';
            }
            if (normalizedId.includes('/node_modules/recharts/')) return 'charts';
            if (normalizedId.includes('/node_modules/lucide-react/')) return 'icons';
            return 'vendor';
          },
        },
      },
    },
  };
});
