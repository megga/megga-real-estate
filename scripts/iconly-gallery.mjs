// Génère une planche-contact HTML de src/components/icons/ : chaque icône avec
// son nom de composant, filtrable.
//
// Indispensable parce que les noms Iconly ne sont pas uniques : une catégorie
// rend « Store », « Store2 »… « Store20 ». Le suffixe est honnête mais illisible
// — sans un rendu visuel en face, personne ne peut choisir la bonne.
//
// Lancer : node scripts/iconly-gallery.mjs [chemin-de-sortie.html]

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ICONS_DIR = resolve(root, 'src/components/icons')
const out = resolve(process.cwd(), process.argv[2] || join(root, 'iconly-gallery.html'))

if (!existsSync(ICONS_DIR)) {
  console.error(`aucune icône générée : ${ICONS_DIR} est absent`)
  console.error('lancer d\'abord : node scripts/iconly-ingest.mjs <dossier-svg>')
  process.exit(1)
}

// Le composant généré est la source de vérité — on en ré-extrait le dessin
// plutôt que de relire les SVG d'origine, qui ne sont pas versionnés.
const VIEWBOX = /viewBox="([^"]*)"/
const BODY = /focusable="false"\s*\{\.\.\.props\}\s*>([\s\S]*?)<\/svg>/

const icons = []
for (const file of readdirSync(ICONS_DIR).filter((f) => f.endsWith('.tsx')).sort()) {
  const src = readFileSync(join(ICONS_DIR, file), 'utf8')
  const viewBox = src.match(VIEWBOX)?.[1]
  const body = src.match(BODY)?.[1]?.trim()
  if (viewBox && body) icons.push({ name: file.replace(/\.tsx$/, ''), viewBox, body })
}

if (!icons.length) {
  console.error('aucun composant exploitable trouvé')
  process.exit(1)
}

const cards = icons
  .map(
    (i) => `<figure data-name="${i.name.toLowerCase()}">
  <svg viewBox="${i.viewBox}" fill="none" stroke="currentColor" stroke-width="1.5"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${i.body}</svg>
  <figcaption>${i.name}</figcaption>
</figure>`,
  )
  .join('\n')

const html = `<!doctype html>
<meta charset="utf-8">
<title>Icônes Iconly — ${icons.length}</title>
<style>
  :root { color-scheme: light dark; --bg:#fff; --fg:#1c1c1c; --muted:#8e8e96; --line:#e5e5e5; --card:#fafafa; }
  @media (prefers-color-scheme: dark) { :root { --bg:#1c1c1c; --fg:#ececef; --muted:#8e8e96; --line:#383838; --card:#2a2a2a; } }
  * { box-sizing: border-box }
  body { margin:0; padding:24px; background:var(--bg); color:var(--fg);
         font:14px/1.4 'DM Sans', system-ui, sans-serif }
  header { position:sticky; top:0; background:var(--bg); padding-bottom:16px;
           border-bottom:1px solid var(--line); margin-bottom:20px; z-index:1 }
  h1 { font-size:18px; font-weight:600; margin:0 0 12px }
  input { width:100%; max-width:340px; padding:8px 12px; border:1px solid var(--line);
          border-radius:8px; background:var(--card); color:var(--fg); font:inherit }
  #count { color:var(--muted); margin-left:10px; font-size:13px }
  #grid { display:grid; gap:10px; grid-template-columns:repeat(auto-fill, minmax(116px, 1fr)) }
  figure { margin:0; padding:14px 8px; border:1px solid var(--line); border-radius:12px;
           background:var(--card); text-align:center; overflow:hidden }
  figure svg { width:28px; height:28px; display:block; margin:0 auto 10px }
  figcaption { font-size:11px; color:var(--muted); word-break:break-word; line-height:1.3 }
  figure[hidden] { display:none }
</style>
<header>
  <h1>Icônes Iconly <span id="count">${icons.length} composants</span></h1>
  <input id="q" type="search" placeholder="Filtrer par nom…" autofocus>
</header>
<div id="grid">
${cards}
</div>
<script>
  const q = document.getElementById('q');
  const cards = [...document.querySelectorAll('figure')];
  const count = document.getElementById('count');
  q.addEventListener('input', () => {
    const t = q.value.trim().toLowerCase();
    let n = 0;
    for (const c of cards) {
      const hit = !t || c.dataset.name.includes(t);
      c.hidden = !hit;
      if (hit) n++;
    }
    count.textContent = n + ' / ' + cards.length + ' composants';
  });
</script>
`

writeFileSync(out, html)
console.log(`${icons.length} icônes → ${out}`)
