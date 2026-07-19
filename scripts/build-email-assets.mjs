/**
 * Rastérise les images du gabarit d'e-mail → public/email/
 *
 *   megga-logo.png   le mot-symbole, blanc sur le fond de page
 *
 * POURQUOI UN BITMAP : les clients mail ne savent pas afficher de SVG (Gmail le
 * supprime purement et simplement), et le dépôt n'a le logo qu'en vectoriel.
 *
 * POURQUOI PLAYWRIGHT : le logo contient des `path` à courbes de Bézier. Les
 * rastériseurs de fortune s'y cassent les dents — `qlmanage` rend une vignette
 * Quick Look (page blanche + bordure), pas l'image. Un vrai moteur de rendu est
 * la seule voie fidèle, et Playwright est déjà là pour les tests e2e.
 *
 * POURQUOI UN FOND OPAQUE plutôt que la transparence : le PNG se pose sur le
 * fond de page de l'e-mail, qui vaut #030303. Un fond identique évite les
 * mauvaises surprises des clients qui composent mal l'alpha (Outlook en tête).
 *
 * Le dégradé de bas de page, lui, n'est PAS une image : il est écrit en CSS
 * directement dans le gabarit. Rien à héberger, rien à charger, et il s'affiche
 * dans l'aperçu du dashboard sans attendre un déploiement.
 *
 * Usage : node scripts/build-email-assets.mjs
 */
import { chromium } from 'playwright'
import { readFileSync, mkdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = resolve(root, 'public/email')

/** Fond de page de l'e-mail — l'image s'y raccorde sans couture. */
const BACKGROUND = '#030303'
/** Rendu en 2x : les clients mail sont lus sur des écrans denses. */
const SCALE = 2

const LOGO_SVG = readFileSync(resolve(root, 'public/megga-logo.svg'), 'utf8')

const assets = [
  {
    name: 'megga-logo.png',
    width: 150,
    height: 33,
    // `fill` en CSS : les tracés source ne déclarent aucun fill, la règle
    // cascade donc jusqu'à eux. La vitrine passe, elle, par
    // `brightness(0) invert(1)` sur son logo de pied de page — à écarter ici,
    // ce filtre inverse aussi le fond de la capture.
    css: 'svg, svg * { fill: #ffffff } svg { width: 100%; height: auto; display: block }',
    body: `<div style="width:150px;height:33px;display:flex;align-items:center">${LOGO_SVG}</div>`,
  },
]

const browser = await chromium.launch()
mkdirSync(OUT_DIR, { recursive: true })

for (const a of assets) {
  const ctx = await browser.newContext({
    viewport: { width: a.width, height: a.height },
    deviceScaleFactor: SCALE,
  })
  const tab = await ctx.newPage()
  await tab.setContent(`<!DOCTYPE html><html><head><style>
    html, body { margin: 0; background: ${BACKGROUND}; }
    ${a.css}
  </style></head><body>${a.body}</body></html>`)
  const path = resolve(OUT_DIR, a.name)
  await tab.screenshot({ path })
  await ctx.close()
  const ko = (statSync(path).size / 1024).toFixed(1)
  console.log(`✓ ${a.name} — ${a.width * SCALE}×${a.height * SCALE} (affiché ${a.width}×${a.height}), ${ko} Ko`)
}

await browser.close()
