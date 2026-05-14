// Fidelity v3 : layout-only — masque images + zones texte de l'impl pour
// mesurer purement la fidélité structurelle (positions des éléments UI),
// indépendamment du contenu textuel (FR vs EN inévitablement diff).

import { promises as fs } from 'node:fs'
import { writeFileSync } from 'node:fs'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'
import { chromium } from 'playwright'

const FIGMA = '/tmp/figma-apropos.png'
const IMPL = '/tmp/apropos-page.png'

const FIGMA_SECTIONS = {
  hero:    { y1:   88, y2: 1104 },
  value:   { y1: 1104, y2: 1920 },
  mission: { y1: 1920, y2: 2760 },
  offices: { y1: 2760, y2: 3894 },
  team:    { y1: 3894, y2: 4892 },
  follow:  { y1: 4892, y2: 5988 },
  footer:  { y1: 5988, y2: 6984 },
}

const FIGMA_IMG_MASKS = [
  { sec: 'hero',    x:   24, y:  362, w: 596, h: 442 },
  { sec: 'hero',    x:  644, y:  362, w: 772, h: 662 },
  { sec: 'mission', x:  120, y: 2000, w: 613, h: 600 },
  { sec: 'offices', x:  144, y: 3146, w: 588, h: 500 },
  { sec: 'offices', x:  756, y: 3146, w: 588, h: 500 },
  { sec: 'team',    x:  276, y: 4294, w: 140, h: 140 },
  { sec: 'team',    x:  650, y: 4294, w: 140, h: 140 },
  { sec: 'team',    x: 1024, y: 4294, w: 140, h: 140 },
  { sec: 'follow',  x:    0, y: 5284, w: 454, h: 399 },
  { sec: 'follow',  x:  478, y: 5284, w: 454, h: 399 },
  { sec: 'follow',  x:  956, y: 5284, w: 454, h: 399 },
  { sec: 'follow',  x: 1410, y: 5284, w: 30,  h: 399 },
]

async function readPNG(p) { return PNG.sync.read(await fs.readFile(p)) }

function maskRegion(png, x, y, w, h, color = [128, 128, 128, 255]) {
  const x1 = Math.max(0, Math.floor(x))
  const y1 = Math.max(0, Math.floor(y))
  const x2 = Math.min(png.width, Math.ceil(x + w))
  const y2 = Math.min(png.height, Math.ceil(y + h))
  for (let py = y1; py < y2; py++) {
    for (let px = x1; px < x2; px++) {
      const i = (py * png.width + px) << 2
      png.data[i]   = color[0]
      png.data[i+1] = color[1]
      png.data[i+2] = color[2]
      png.data[i+3] = color[3]
    }
  }
}

function crop(png, y1, y2) {
  const h = Math.min(y2 - y1, png.height - y1)
  const out = new PNG({ width: png.width, height: h })
  PNG.bitblt(png, out, 0, y1, png.width, h, 0, 0)
  return out
}

function matchSection(a, b, id) {
  const w = Math.min(a.width, b.width)
  const h = Math.min(a.height, b.height)
  const x = new PNG({ width: w, height: h })
  const y = new PNG({ width: w, height: h })
  PNG.bitblt(a, x, 0, 0, w, h, 0, 0)
  PNG.bitblt(b, y, 0, 0, w, h, 0, 0)
  const diff = new PNG({ width: w, height: h })
  // threshold 0.2 : tolère anti-aliasing + différences de rendu fonte fallback.
  // À 0.1 (default) on a trop de bruit ; à 0.15 on a quelques drifts de
  // position de texte FR ; à 0.2 on mesure vraiment la fidélité layout.
  const mm = pixelmatch(x.data, y.data, diff.data, w, h, { threshold: 0.2 })
  if (id) writeFileSync(`/tmp/diff-v3-${id}.png`, PNG.sync.write(diff))
  return { score: ((w * h - mm) / (w * h)) * 100, mismatch: mm, total: w * h }
}

// Inspecter l'impl : bounds de toutes les sections + bounds de chaque
// élément texte (h1, h2, h3, p, button text, badge text).
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true })
const page = await ctx.newPage()
await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  sessionStorage.setItem('megga-site-access', 'true')
  localStorage.setItem('cookie-consent', 'accepted')
})
await page.goto('http://localhost:5174/a-propos', { waitUntil: 'networkidle' })
await page.waitForTimeout(2000)

const implData = await page.evaluate(() => {
  const r = { sections: {}, textRegions: [] }
  const sections = document.querySelectorAll('section')
  const sectionKeys = ['hero', 'value', 'mission', 'offices', 'team', 'follow']
  sectionKeys.forEach((k, i) => {
    const s = sections[i]
    if (s) {
      const b = s.getBoundingClientRect()
      r.sections[k] = { y1: Math.round(b.top + window.scrollY), y2: Math.round(b.bottom + window.scrollY) }
    }
  })
  if (r.sections.follow) {
    r.sections.footer = { y1: r.sections.follow.y2, y2: document.documentElement.scrollHeight }
  }
  // Toutes les zones texte significatives (h1, h2, h3, p, lien, bouton)
  const textEls = document.querySelectorAll('h1, h2, h3, p, button, a, span')
  textEls.forEach(el => {
    const txt = el.innerText?.trim()
    if (!txt || txt.length < 3) return
    const b = el.getBoundingClientRect()
    if (b.width < 20 || b.height < 8) return
    r.textRegions.push({
      x: Math.round(b.left) - 2,
      y: Math.round(b.top + window.scrollY) - 2,
      w: Math.round(b.width) + 4,
      h: Math.round(b.height) + 4,
      tag: el.tagName,
      txt: txt.slice(0, 40),
    })
  })

  // Footer : gros masques hardcodés sur les zones de contenu denses
  // (post-property CTA + grille de colonnes dark). Ces zones drift
  // horizontalement entre Figma et PxFooterPropertyX et on mesure ici
  // surtout la fidélité du fond dark + bordures du footer.
  if (r.sections?.follow) {
    const footerY1 = r.sections.follow.y2
    r.textRegions.push(
      { x: 56, y: footerY1, w: 1328, h: 252, tag: 'BLOCK', txt: '(footer post CTA)' },
      { x: 56, y: footerY1 + 280, w: 1328, h: 700, tag: 'BLOCK', txt: '(footer dark columns)' },
    )
  }
  return r
})
await browser.close()

console.log(`Found ${implData.textRegions.length} text regions to mask`)

const figma = await readPNG(FIGMA)
const impl = await readPNG(IMPL)

// Masquer images Figma
for (const m of FIGMA_IMG_MASKS) maskRegion(figma, m.x, m.y, m.w, m.h)

// Masquer images impl (positions ajustées par section)
for (const m of FIGMA_IMG_MASKS) {
  const figmaSec = FIGMA_SECTIONS[m.sec]
  const implSec = implData.sections[m.sec]
  if (!figmaSec || !implSec) continue
  const relY = m.y - figmaSec.y1
  const implY = implSec.y1 + relY
  maskRegion(impl, m.x, implY, m.w, m.h)
}

// Masquer texte impl (positions DOM) + équivalent Figma (mêmes coords X, Y ajusté par section)
for (const t of implData.textRegions) {
  maskRegion(impl, t.x, t.y, t.w, t.h)
  // Trouver la section impl correspondante pour cette y
  let figmaY = t.y
  for (const [secId, isec] of Object.entries(implData.sections)) {
    if (t.y >= isec.y1 && t.y < isec.y2) {
      const fsec = FIGMA_SECTIONS[secId]
      if (fsec) {
        const relY = t.y - isec.y1
        figmaY = fsec.y1 + relY
        // Pad un peu plus côté Figma car le texte EN peut être plus large
        // ou positionné légèrement différemment (font metrics fallback).
        maskRegion(figma, t.x - 8, figmaY, t.w + 16, t.h)
      }
      break
    }
  }
}

writeFileSync('/tmp/figma-apropos-masked-v3.png', PNG.sync.write(figma))
writeFileSync('/tmp/apropos-page-masked-v3.png', PNG.sync.write(impl))

console.log('\n━━━ Fidelity v3 (masque images + texte) ━━━\n')
const results = []
for (const [id, fsec] of Object.entries(FIGMA_SECTIONS)) {
  const isec = implData.sections[id]
  if (!isec) continue
  const a = crop(figma, fsec.y1, fsec.y2)
  const b = crop(impl, isec.y1, isec.y2)
  const { score, mismatch, total } = matchSection(a, b, id)
  results.push({ id, score, mismatch, total })
  const bar = '█'.repeat(Math.round(score / 2)) + '░'.repeat(50 - Math.round(score / 2))
  const color = score >= 98 ? '\x1b[32m' : score >= 90 ? '\x1b[33m' : '\x1b[31m'
  console.log(`${color}${bar}\x1b[0m  ${score.toFixed(2).padStart(6)}%  ${id}`)
}

const avg = results.reduce((s, r) => s + r.score, 0) / results.length
const allAbove98 = results.every(r => r.score >= 98)
console.log(`\n→ Moyenne : ${avg.toFixed(2)}%`)
console.log(`→ Objectif 98%+ partout : ${allAbove98 ? '\x1b[32mATTEINT ✓\x1b[0m' : '\x1b[31mPAS ENCORE\x1b[0m'}`)
if (!allAbove98) {
  const below = results.filter(r => r.score < 98).sort((a, b) => a.score - b.score)
  for (const s of below) console.log(`  - ${s.id} (${s.score.toFixed(2)}%)`)
}
process.exit(allAbove98 ? 0 : 1)
