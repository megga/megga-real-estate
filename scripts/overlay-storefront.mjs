// Overlay the static Property X "V3" storefront onto the Vite build output.
//
// Runs as an npm `postbuild` step, so EVERY build of this repo — the GitHub
// Actions deploy AND the git-connected Cloudflare Pages build — produces the
// same artifact: the V3 static site at the root, with the React app reachable
// from the same deploy via the preserved /app.html shell.
//
// Idempotent: app.html is only captured from the React index on the first
// pass (before the V3 index overwrites it), so re-running never clobbers the
// React shell with the V3 home.

import { existsSync, copyFileSync, cpSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const storefront = resolve(root, 'sites/property-preview');
const redirects = resolve(root, '.github/deploy/megga-redirects');

if (!existsSync(dist)) {
  console.error(`[overlay-storefront] no build output at ${dist} — skipping`);
  process.exit(0);
}

// 1. Preserve the React SPA shell so app routes (/dashboard, /auth, ...) can
//    boot it. Guarded so a second pass never overwrites it with the V3 home.
const reactIndex = resolve(dist, 'index.html');
const appShell = resolve(dist, 'app.html');
if (existsSync(reactIndex) && !existsSync(appShell)) {
  copyFileSync(reactIndex, appShell);
  console.log('[overlay-storefront] captured React shell -> dist/app.html');
}

// 2. Overlay the V3 storefront — its index.html takes over "/".
cpSync(storefront, dist, { recursive: true, force: true });
console.log('[overlay-storefront] overlaid sites/property-preview -> dist/');

// 3. Routing: reserved app paths -> React shell; everything else -> V3 files,
//    falling back to the V3 home. Overwrites the storefront's own _redirects.
copyFileSync(redirects, resolve(dist, '_redirects'));
console.log('[overlay-storefront] wrote dist/_redirects');
