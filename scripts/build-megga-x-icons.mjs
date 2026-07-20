// Extrait les glyphes d'icônes EXACTS (codepoints zone privée) utilisés par le
// style guide la vitrine MEGGA, par famille de police, et écrit
// src/components/megga-x/iconGlyphs.ts. Aucune invention : on reprend les
// codepoints réellement présents dans la source.
//
// Lancer : node scripts/build-megga-x-icons.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// Source figée du style guide Webflow d'origine. Elle vivait dans
// sites/megga-vitrine/_off/, donc copiée dans dist/ à chaque build de la vitrine
// et exposée sur megga.ch/_off/ — masquée aujourd'hui par le Basic Auth de
// pré-lancement (_worker.js), donc publique le jour de la levée. Déplacée ici le
// 2026-07-20 : c'est une donnée de script, pas une page à publier.
const SG = resolve(root, 'scripts/_data/megga-x-style-guide.html')
const OUT = resolve(root, 'src/components/megga-x/iconGlyphs.ts')

const html = readFileSync(SG, 'utf8')

const SETS = [
  { key: 'rounded', cls: 'icon-font-rounded' },
  { key: 'social', cls: 'icon-font-social-media' },
  { key: 'custom', cls: 'custom-icon-font' },
]

const result = {}
for (const { key, cls } of SETS) {
  const codes = new Set()
  // <div class="… <cls> …">GLYPH</div> (un seul caractère)
  const re = new RegExp(`class="[^"]*${cls}[^"]*">(.)</div>`, 'g')
  let m
  while ((m = re.exec(html))) {
    const cp = m[1].codePointAt(0)
    if (cp >= 0xe000 && cp <= 0xf8ff) codes.add(cp) // zone privée uniquement
  }
  result[key] = [...codes].sort((a, b) => a - b)
}

const ts = `// GÉNÉRÉ (ne pas éditer) — node scripts/build-megga-x-icons.mjs
// Codepoints d'icônes la vitrine MEGGA par famille, extraits verbatim du style guide.
// rounded → Line Rounded Icon Font Brix · social → Social Media Icon Font Brix
// · custom → Mega Custom Icons.

export type MxIconSet = 'rounded' | 'social' | 'custom'

export const MX_ICON_CLASS: Record<MxIconSet, string> = {
  rounded: 'icon-font-rounded',
  social: 'icon-font-social-media',
  custom: 'custom-icon-font',
}

export const MX_ICONS: Record<MxIconSet, number[]> = {
  rounded: [${result.rounded.map((c) => `0x${c.toString(16)}`).join(', ')}],
  social: [${result.social.map((c) => `0x${c.toString(16)}`).join(', ')}],
  custom: [${result.custom.map((c) => `0x${c.toString(16)}`).join(', ')}],
}
`
writeFileSync(OUT, ts, 'utf8')
console.log(
  `[megga-x icons] rounded=${result.rounded.length} social=${result.social.length} custom=${result.custom.length} → ${OUT}`,
)
