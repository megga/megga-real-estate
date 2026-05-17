import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Recharts importe `react-is` (CJS) via `import { isFragment } from 'react-is'`.
      // Rolldown échoue sur le CJS interop → alias vers le fichier resolved.
      // Fix de l'erreur "Rolldown failed to resolve import 'react-is'" qui
      // bloquait `npm run build` depuis l'introduction de recharts.
      'react-is': path.resolve(__dirname, './node_modules/react-is/index.js'),
    },
  },
  optimizeDeps: {
    include: ['react-is'],
  },
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
  build: {
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            {
              name: 'vendor-react',
              test: /[\\/]node_modules[\\/](react|react-dom|react-router)/,
            },
            {
              name: 'vendor-mapbox',
              test: /[\\/]node_modules[\\/](mapbox-gl|react-map-gl)/,
            },
            {
              name: 'vendor-ui',
              test: /[\\/]node_modules[\\/](@radix-ui|class-variance-authority|clsx|tailwind-merge)/,
            },
            {
              name: 'vendor-dnd',
              test: /[\\/]node_modules[\\/]@dnd-kit/,
            },
          ],
        },
      },
    },
  },
})
