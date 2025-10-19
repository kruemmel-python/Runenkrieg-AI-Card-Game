import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        fs: {
          allow: [
            path.resolve(__dirname),
            path.resolve(__dirname, '..', 'React-Retro-Arcade-Space-Shooter'),
          ],
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          react: path.resolve(__dirname, 'node_modules/react'),
          'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
          'react/jsx-runtime': path.resolve(
            __dirname,
            'node_modules/react/jsx-runtime.js',
          ),
          'react/jsx-dev-runtime': path.resolve(
            __dirname,
            'node_modules/react/jsx-dev-runtime.js',
          ),
        },
      }
    };
});
