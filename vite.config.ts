import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function normalizeId(id: string) {
  return id.replace(/\\/g, '/');
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));
  const buildVersion =
    env.VITE_APP_VERSION ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    `${pkg.version || '0.0.0'}-${Date.now()}`;
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(buildVersion),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./tests/setup.ts'],
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
