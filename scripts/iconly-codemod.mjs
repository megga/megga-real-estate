// Bascule les imports lucide-react vers src/components/icons selon la table
// scripts/_data/iconly-lucide-map.json.
//
// Les icônes importées sont ALIASÉES sur leur nom lucide d'origine
// (`import { TickCircle as Check }`), ce qui laisse le corps des composants
// intact : aucune réécriture de JSX, donc aucun risque de toucher une
// occurrence qui n'était pas une icône. Le diff se limite aux imports.
//
// Une entrée `null` dans la table reste sur lucide — la migration peut donc
// se faire par vagues sans jamais casser un écran.
//
// Lancer : node scripts/iconly-codemod.mjs [--write]   (défaut : simulation)

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MAP_FILE = resolve(root, 'scripts/_data/iconly-lucide-map.json')
const ICONS_INDEX = resolve(root, 'src/components/icons/index.ts')
const TARGET = '@/components/icons'

const write = process.argv.includes('--write')

const { map } = JSON.parse(readFileSync(MAP_FILE, 'utf8'))
const mapped = Object.entries(map).filter(([, v]) => v)
if (!mapped.length) {
  console.log('table de correspondance vide — rien à basculer')
  console.log(`remplir ${MAP_FILE} après la sélection dans Iconly`)
  process.exit(0)
}

// Garde-fou : un nom de composant absent de l'index générerait un import mort
// qui ne casserait qu'au build. On le détecte ici.
if (existsSync(ICONS_INDEX)) {
  const index = readFileSync(ICONS_INDEX, 'utf8')
  const missing = mapped.filter(([, target]) => !new RegExp(`\\bas ${target}\\b`).test(index))
  if (missing.length) {
    console.error('cibles absentes de src/components/icons/index.ts :')
    for (const [from, to] of missing) console.error(`  ${from} → ${to}`)
    process.exit(1)
  }
} else {
  console.warn('src/components/icons/index.ts absent — cibles non vérifiées')
}

// ─── Réécriture ────────────────────────────────────────────────────────────

// Le point-virgule optionnel se colle à la quote fermante : tout `\s*` avant lui
// mangerait le retour à la ligne et souderait l'instruction suivante à l'import.
const IMPORT = /import\s+(type\s+)?\{([\s\S]*?)\}\s*from\s*['"]lucide-react['"];?/g

/** `Check` ou `Check as Tick` → { imported, local } */
function parseSpecifier(raw) {
  const [imported, local] = raw.split(/\s+as\s+/).map((s) => s.trim())
  return { imported, local: local || imported }
}

const files = execSync('grep -rl "lucide-react" src/', { cwd: root, encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean)

let touched = 0
const moved = new Map() // nom lucide → nombre de fichiers

for (const rel of files) {
  const path = join(root, rel)
  const before = readFileSync(path, 'utf8')

  const after = before.replace(IMPORT, (full, typeOnly, body) => {
    // Un `import type` ne concerne pas les composants d'icônes.
    if (typeOnly) return full

    const specs = body
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map(parseSpecifier)

    const stay = specs.filter((s) => !map[s.imported])
    const go = specs.filter((s) => map[s.imported])
    if (!go.length) return full

    for (const s of go) moved.set(s.imported, (moved.get(s.imported) || 0) + 1)

    // L'alias préserve le nom local, donc le JSX existant continue de résoudre.
    const iconSpecs = go.map((s) => {
      const target = map[s.imported]
      return target === s.local ? target : `${target} as ${s.local}`
    })

    const lines = []
    if (stay.length) {
      lines.push(`import { ${stay.map((s) => (s.imported === s.local ? s.imported : `${s.imported} as ${s.local}`)).join(', ')} } from 'lucide-react'`)
    }
    lines.push(`import { ${iconSpecs.join(', ')} } from '${TARGET}'`)
    return lines.join('\n')
  })

  if (after !== before) {
    touched++
    if (write) writeFileSync(path, after)
  }
}

// ─── Rapport ───────────────────────────────────────────────────────────────

console.log(`${write ? '' : '[simulation] '}${touched} fichiers modifiés sur ${files.length}`)
console.log(`${moved.size} icônes basculées :`)
for (const [name, n] of [...moved.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${name} → ${map[name]} (${n} fichier${n > 1 ? 's' : ''})`)
}

const remaining = Object.entries(map).filter(([, v]) => !v).map(([k]) => k)
if (remaining.length) {
  console.log(`\n${remaining.length} encore sur lucide : ${remaining.join(', ')}`)
}
if (!write) console.log('\nrelancer avec --write pour appliquer')
