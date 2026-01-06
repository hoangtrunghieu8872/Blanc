import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
              if (!id.includes('node_modules')) return;
              if (id.includes('react') || id.includes('react-dom')) return 'react';
              if (id.includes('react-router')) return 'router';
              if (id.includes('recharts')) return 'charts';
              if (id.includes('lucide-react')) return 'icons';
              return 'vendor';
            },
          },
        },
      },
    };
});
