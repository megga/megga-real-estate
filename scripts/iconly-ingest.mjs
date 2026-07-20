// Convertit un export Iconly Pro (style Light) en composants React thémables
// dans src/components/icons/, plus un barrel index.ts et un manifeste.
//
// Un composant par icône avec export nommé : le bundle n'embarque que ce qui
// est réellement importé, comme lucide-react. Le manifeste conserve la
// correspondance fichier source → composant, indispensable parce que les noms
// Iconly ne sont PAS uniques (~50 icônes distinctes s'appellent « Home ») :
// sans lui, un ré-export renommerait silencieusement des composants déjà
// utilisés dans le code.
//
// Lancer : node scripts/iconly-ingest.mjs <dossier-svg> [--dry]

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeIcon, toComponentName } from './_shared/iconly-svg.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = resolve(root, 'src/components/icons')
const MANIFEST = join(OUT_DIR, 'manifest.json')

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const dirs = args.filter((a) => !a.startsWith('--'))

if (!dirs.length) {
  console.error('usage : node scripts/iconly-ingest.mjs <dossier-svg…> [--dry]')
  console.error('  plusieurs dossiers acceptés ; les passages successifs cumulent')
  process.exit(1)
}

// L'app Iconly n'assemble pas une archive de plusieurs milliers de fichiers :
// le catalogue s'exporte par catégorie. Les passages successifs doivent donc
// s'ajouter aux composants déjà générés, sinon le second export viderait le
// barrel du premier et casserait tous les imports en place.
const SRCS = dirs.map((d) => resolve(process.cwd(), d))
for (const src of SRCS) {
  if (!existsSync(src)) {
    console.error(`dossier introuvable : ${src}`)
    process.exit(1)
  }
}

// ─── Lecture ───────────────────────────────────────────────────────────────

const files = SRCS.flatMap((src) =>
  readdirSync(src)
    .filter((f) => /\.svg$/i.test(f))
    .map((f) => ({ dir: src, file: f })),
).sort((a, b) => a.file.localeCompare(b.file))

if (!files.length) {
  console.error(`aucun .svg dans ${dirs.join(', ')}`)
  process.exit(1)
}

// Un manifeste existant fige les noms déjà attribués : les composants
// référencés dans le code ne doivent jamais changer d'identifiant entre deux
// exports.
const previous = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { icons: {} }
const lockedByHash = new Map(Object.entries(previous.icons).map(([name, e]) => [e.hash, name]))

// Les composants d'un export précédent restent exportés par le barrel tant que
// leur fichier est là — on ne les régénère pas, on les reconduit.
const carried = Object.entries(previous.icons).filter(([name]) =>
  existsSync(join(OUT_DIR, `${name}.tsx`)),
)

const taken = new Set(carried.map(([name]) => name))
const icons = new Map() // nom composant → { viewBox, body, strokeWidth, hash, source }
const skipped = []
const failed = []
const collided = [] // deux dessins différents réclamant le même identifiant

// ── Passe 1 : normaliser et regrouper par dessin ──
// Iconly exporte des doublons stricts sous plusieurs noms. Le représentant du
// groupe ne peut pas être « le premier rencontré » : l'ordre alphabétique fait
// gagner « Home Copy.svg » contre « Home.svg », donnant le nom canonique au
// mauvais fichier. On élit le nom le plus court, puis lexicographique.
const groups = new Map() // hash → { icon, files[] }

for (const { dir, file } of files) {
  try {
    const icon = normalizeIcon(readFileSync(join(dir, file), 'utf8'))
    const g = groups.get(icon.hash)
    if (g) g.files.push(file)
    else groups.set(icon.hash, { icon, files: [file] })
  } catch (err) {
    failed.push([file, err.message])
  }
}

const preferred = (a, b) => (a.length - b.length) || a.localeCompare(b)

// ── Passe 2 : attribuer les identifiants ──
for (const [hash, { icon, files: group }] of groups) {
  const [best, ...rest] = [...group].sort(preferred)
  for (const dup of rest) skipped.push([dup, best])

  // Nom stable si ce dessin exact a déjà été ingéré lors d'un export précédent.
  let name = lockedByHash.get(hash) ?? toComponentName(best)
  if (!lockedByHash.has(hash)) {
    const base = name
    let n = 2
    while (taken.has(name)) name = `${base}${n++}`
    if (name !== base) collided.push([best, base, name])
  }

  taken.add(name)
  icons.set(name, { ...icon, source: best })
}

// ─── Génération ────────────────────────────────────────────────────────────

const HEADER = '// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs'

// `forwardRef` n'est pas cosmétique : sans lui les composants sont de simples
// fonctions et ne satisfont pas `LucideIcon`
// (`ForwardRefExoticComponent`, qui exige `$$typeof`). Toute prop typée
// `icon: LucideIcon` — AdminKpiCard notamment — refuserait l'icône au build.
function component(name, { viewBox, body, strokeWidth, linecap, linejoin }) {
  const sw = strokeWidth ?? 1.5
  // On ne pose que ce que la source portait : forcer un linecap absent de
  // l'original modifierait le dessin.
  const caps = [
    linecap ? `      strokeLinecap="${linecap}"` : null,
    linejoin ? `      strokeLinejoin="${linejoin}"` : null,
  ].filter(Boolean)

  return `${HEADER}
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ${name} = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = ${sw}, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="${viewBox}"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
${caps.join('\n')}${caps.length ? '\n' : ''}      aria-hidden="true"
      focusable="false"
      {...props}
    >
      ${body}
    </svg>
  ),
)

${name}.displayName = '${name}'

export default ${name}
`
}

const written = [...icons.keys()].sort()

// Barrel et manifeste couvrent l'union des exports précédents et de celui-ci ;
// les entrées reconduites gardent leur hash et leur fichier source d'origine.
const entries = new Map(carried)
for (const name of written) entries.set(name, { hash: icons.get(name).hash, source: icons.get(name).source })
const names = [...entries.keys()].sort()

const barrel = `${HEADER}
// Exports nommés : le bundler ne retient que les icônes réellement importées.

${names.map((n) => `export { default as ${n} } from './${n}'`).join('\n')}
`

const manifest = {
  style: 'Light',
  count: names.length,
  icons: Object.fromEntries(names.map((n) => [n, entries.get(n)])),
}

if (!dry) {
  mkdirSync(OUT_DIR, { recursive: true })
  for (const name of written) writeFileSync(join(OUT_DIR, `${name}.tsx`), component(name, icons.get(name)))
  writeFileSync(join(OUT_DIR, 'index.ts'), barrel)
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
}

// ─── Rapport ───────────────────────────────────────────────────────────────

const fresh = written.filter((n) => !carried.some(([c]) => c === n))
console.log(`${dry ? '[dry] ' : ''}${fresh.length} nouveaux composants depuis ${files.length} fichiers`)
if (carried.length) console.log(`  ${carried.length} reconduits des exports précédents → ${names.length} au total`)
if (written.length - fresh.length) console.log(`  ${written.length - fresh.length} régénérés (déjà connus)`)
if (skipped.length) console.log(`  ${skipped.length} doublons ignorés (dessin identique)`)
if (failed.length) {
  console.log(`  ${failed.length} échecs :`)
  for (const [f, why] of failed) console.log(`    ${f} — ${why}`)
}
if (collided.length) {
  console.log(`  ${collided.length} suffixés pour collision de nom :`)
  for (const [file, base, name] of collided) console.log(`    ${file} — ${base} déjà pris → ${name}`)
}
if (failed.length) process.exit(1)
