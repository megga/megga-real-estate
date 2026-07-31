// Decide what the Vite build output (dist/) becomes, depending on the deploy
// target. One repo, two Cloudflare Pages projects:
//
//   • megga.ch        → the static MEGGA vitrine (SaaS landing → CRM, no React).
//   • app.megga.ch    → the React app (CRM /dashboard, auth, portail, …).
//
// This runs as the npm `postbuild` hook, so it applies to every build —
// including the git-connected Cloudflare build that publishes `dist`.
//
//   MEGGA_BUILD_TARGET=app   → leave the React build untouched (app.megga.ch).
//   (default / "storefront") → replace dist/ with the static vitrine (megga.ch).
//
// NB (juin 2026): recentrage CRM-first. megga.ch sert désormais la VITRINE
// (sites/megga-vitrine). L'ancien storefront marketplace Property X a été SUPPRIMÉ
// du dépôt en juillet 2026 (il y dormait depuis le pivot) ; il reste récupérable
// via git (commit 0b321bc5 et antérieurs) si la marketplace revient un jour.
// Les données market_listings restent actives (elles nourrissent le CRM).

import { existsSync, cpSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const storefront = resolve(root, 'sites/megga-vitrine');
const target = process.env.MEGGA_BUILD_TARGET || 'storefront';

if (!existsSync(dist)) {
  console.error(`[postbuild] no build output at ${dist} — skipping`);
  process.exit(0);
}

if (target === 'app') {
  // app.megga.ch: keep the pure React SPA. public/_redirects already provides
  // the `/* /index.html 200` fallback so client-side routes resolve.
  console.log('[postbuild] MEGGA_BUILD_TARGET=app — keeping the React build for app.megga.ch');
  process.exit(0);
}

// megga.ch: publish ONLY the static vitrine. Overlay it on top of the (now
// discarded) React output; the vitrine index.html owns "/", its own _redirects
// and _worker.js (Basic Auth gate — credentials and the auth-page exemptions
// live in that file) ship with it.
cpSync(storefront, dist, { recursive: true, force: true });
console.log('[postbuild] storefront target — dist/ is now the static vitrine (sites/megga-vitrine)');

// Les langues sont GÉNÉRÉES, jamais versionnées : le dépôt ne garde que le
// français et un dictionnaire par langue. Enchaîné ici pour qu'un déploiement
// ne puisse pas publier une vitrine française sans ses traductions — ou pire,
// des traductions figées d'un build précédent.
const i18n = spawnSync(process.execPath, [resolve(root, 'scripts/vitrine-i18n.mjs'), '--build'], { stdio: 'inherit' });
if (i18n.status !== 0) {
  console.error('[postbuild] génération des langues en échec');
  process.exit(i18n.status ?? 1);
}
