import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const serverSerpApiKey = (env.SERPAPI_API_KEY || '').trim();

    return {
      server: {
        port: 5600,
        host: '0.0.0.0',
        proxy: {
          '/api/serpapi': {
            target: 'https://serpapi.com',
            changeOrigin: true,
            secure: true,
            rewrite: (requestPath) => {
              const parsed = new URL(requestPath, 'http://localhost');
              const rewrittenPathname = parsed.pathname.replace(/^\/api\/serpapi/, '');

              if (serverSerpApiKey) {
                parsed.searchParams.set('api_key', serverSerpApiKey);
              }

              const query = parsed.searchParams.toString();
              return query ? `${rewrittenPathname}?${query}` : rewrittenPathname;
            },
          },
        },
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
