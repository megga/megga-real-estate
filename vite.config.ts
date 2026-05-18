import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    // Uploads sourcemaps to Sentry so prod stack traces show readable code.
    // Only active when SENTRY_AUTH_TOKEN is present (CI/local opt-in).
    // Token lives in .env.sentry-build-plugin (gitignored) or env vars.
    sentryVitePlugin({
      org: 'gauthier-ru',
      project: 'juarts',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      disable: !process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
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
    // 'hidden' generates .map files but omits the `//# sourceMappingURL` comment,
    // so browsers don't auto-fetch them from prod. Sentry's plugin can still
    // upload them via the build artifacts.
    sourcemap: 'hidden',
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
