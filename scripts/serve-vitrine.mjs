/**
 * Serveur statique de la vitrine (sites/megga-vitrine) pour l'aperçu local.
 *
 * La vitrine est du HTML pur déposé tel quel sur Cloudflare Pages : elle n'a ni
 * Vite ni build, donc `npm run dev` (qui sert l'app CRM) ne la montre jamais.
 * Ce serveur existe uniquement pour la relire dans un navigateur — il ne rejoue
 * PAS `_worker.js` ni `_redirects`, donc les redirections et en-têtes du bord
 * ne s'y vérifient pas.
 *
 * Usage : `node scripts/serve-vitrine.mjs` (ou la configuration « vitrine »
 * de .claude/launch.json), puis http://localhost:4180/signup.html
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'sites', 'megga-vitrine');
const PORT = Number(process.env.PORT || 4180);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

createServer(async (req, res) => {
  let path = decodeURIComponent((req.url || '/').split('?')[0]);
  if (path.endsWith('/')) path += 'index.html';
  // Un `..` dans l'URL sortirait de la vitrine : on normalise avant de joindre.
  const file = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('403');
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404');
  }
}).listen(PORT, () => {
  console.log(`vitrine → http://localhost:${PORT}/`);
});
