/**
 * Build de la console super-admin (admin.megga.ch, projet Pages `megga-admin`).
 *
 * Entrée `index.admin.html` → `src/main.admin.tsx` : le bundle du CRM et celui
 * de la console ne se croisent jamais. Sortie dans `dist-admin/` pour que les
 * deux déploiements puissent cohabiter dans le même job CI.
 *
 * `publicDir` reste `public/` (polices Objectivity, glyphes MEIcon, logos), mais
 * `_redirects` et `robots.txt` sont RÉÉCRITS après coup : ceux du CRM portent
 * ~200 redirections marketing qui n'ont aucun sens ici.
 */
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, renameSync, writeFileSync } from 'fs'
import path from 'path'

/**
 * Après le bundle : renomme la page produite en `index.html` et pose les
 * fichiers de service propres à l'origine admin.
 *
 * L'entrée s'appelle `index.admin.html` (deux pages ne peuvent pas s'appeler
 * `index.html` à la racine du dépôt), donc Rollup écrit `dist-admin/index.admin.html`.
 * Cloudflare Pages, lui, sert `/index.html` à la racine et c'est la cible du
 * fallback SPA : sans ce renommage, le site répond 404 sur `/`.
 */
function adminStaticFiles(outDir: string): Plugin {
  return {
    name: 'megga-admin-static-files',
    apply: 'build',
    closeBundle() {
      const produced = path.resolve(outDir, 'index.admin.html')
      if (existsSync(produced)) renameSync(produced, path.resolve(outDir, 'index.html'))
      // SPA fallback seul — aucune redirection héritée du CRM.
      writeFileSync(path.resolve(outDir, '_redirects'), '/*    /index.html    200\n')
      writeFileSync(path.resolve(outDir, 'robots.txt'), 'User-agent: *\nDisallow: /\n')
    },
  }
}

/**
 * En dev, Vite sert `index.html` (le CRM) à la racine, quoi qu'on mette dans
 * `rollupOptions.input` : ce dernier ne pilote que le build. Ce middleware
 * réécrit donc toute requête de navigation vers `index.admin.html` — c'est
 * aussi ce qui donne le fallback SPA attendu par `/users`, `/agencies/:id`…
 * (Les requêtes d'assets, de modules et du HMR passent inchangées.)
 */
function adminDevEntry(): Plugin {
  return {
    name: 'megga-admin-dev-entry',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = (req.url ?? '/').split('?')[0]
        const isInternal = url.startsWith('/@') || url.startsWith('/src/') || url.startsWith('/node_modules/')
        const hasExtension = /\.[a-z0-9]+$/i.test(url)
        if (!isInternal && !hasExtension) req.url = '/index.admin.html'
        next()
      })
    },
  }
}

const OUT_DIR = path.resolve(__dirname, 'dist-admin')

export default defineConfig({
  plugins: [react(), adminDevEntry(), adminStaticFiles(OUT_DIR)],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5174,
  },
  build: {
    outDir: OUT_DIR,
    emptyOutDir: true,
    // Même politique que le CRM : les sourcemaps sont produites mais jamais
    // référencées depuis le bundle servi.
    sourcemap: 'hidden',
    rollupOptions: {
      input: path.resolve(__dirname, 'index.admin.html'),
    },
  },
})
