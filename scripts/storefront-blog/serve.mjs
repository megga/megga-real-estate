// Minimal static file server for previewing the storefront (sites/property-preview).
// Uses an absolute root and never calls process.cwd() (the spawn cwd is restricted).
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..', 'sites/property-preview')
const PORT = 4180
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.ico': 'image/x-icon', '.gif': 'image/gif', '.webp': 'image/webp', '.txt': 'text/plain',
}

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || '/').split('?')[0])
    if (p.endsWith('/')) p += 'index.html'
    let fp = normalize(join(ROOT, p))
    if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden') }
    let s
    try { s = await stat(fp) } catch {
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' })
      return res.end('<h1>404</h1>')
    }
    if (s.isDirectory()) fp = join(fp, 'index.html')
    const buf = await readFile(fp)
    res.writeHead(200, { 'content-type': MIME[extname(fp).toLowerCase()] || 'application/octet-stream' })
    res.end(buf)
  } catch (e) {
    res.writeHead(500); res.end(String(e))
  }
}).listen(PORT, () => console.log(`storefront → http://localhost:${PORT}`))
