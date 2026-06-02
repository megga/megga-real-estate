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
// (sites/megga-vitrine). L'ancien storefront marketplace Property X est conservé
// en sommeil dans sites/_marketplace-phase-ulterieure/ (réactivable : repointer
// `storefront` ci-dessous). Les données market_listings restent actives (CRM).

import { existsSync, cpSync } from 'node:fs';
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
// and _worker.js (Basic Auth ai/ai) ship with it.
cpSync(storefront, dist, { recursive: true, force: true });
console.log('[postbuild] storefront target — dist/ is now the static vitrine (sites/megga-vitrine)');
