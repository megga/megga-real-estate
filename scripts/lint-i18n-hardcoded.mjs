#!/usr/bin/env node
// Gate CI ciblé — texte FR codé en dur sur les surfaces agent VERROUILLÉES.
//
// Pourquoi un script dédié plutôt que `npm run lint` ?
//   `eslint .` porte ~45 erreurs PRÉEXISTANTES hors-i18n (react-refresh,
//   react-hooks, no-irregular-whitespace) que `deploy.yml` masque avec `|| true`.
//   On ne veut PAS bloquer une PR là-dessus ici. Ce script n'échoue QUE sur la
//   règle `i18next/no-literal-string` au niveau ERROR, et uniquement sur les
//   familles déjà migrées + vérifiées (vagues i18n 1→3). Les surfaces différées
//   (réseau « en construction », mandat vendeur) sont en WARN dans
//   eslint.config.js → ignorées ici.
//
// ⚠ Garder cette liste synchronisée avec le bloc « verrouillées » d'eslint.config.js.
import { ESLint } from 'eslint'

const LOCKED_GLOBS = [
  'src/components/crm-mobile/**/*.{ts,tsx}',
  'src/components/crm/**/*.{ts,tsx}',
  'src/components/crm-dossiers/**/*.{ts,tsx}',
  'src/components/crm-wizard/**/*.{ts,tsx}',
  'src/components/crm-identity/**/*.{ts,tsx}',
  'src/components/matching-atelier/**/*.{ts,tsx}',
  'src/components/ai-copilot/**/*.{ts,tsx}',
  'src/components/kyc-report/**/*.{ts,tsx}',
  'src/pages/agent/**/*.{ts,tsx}',
]

const RULE = 'i18next/no-literal-string'

const eslint = new ESLint()
const results = await eslint.lintFiles(LOCKED_GLOBS)

const offenders = []
for (const r of results) {
  for (const m of r.messages) {
    if (m.severity === 2 && m.ruleId === RULE) {
      offenders.push({ file: r.filePath, line: m.line, column: m.column, message: m.message })
    }
  }
}

if (offenders.length === 0) {
  console.log(`✓ i18n garde-fou OK — 0 texte FR en dur sur les surfaces agent verrouillées (${RULE}).`)
  process.exit(0)
}

const cwd = process.cwd() + '/'
console.error(`\x1b[31m✗ ${offenders.length} texte(s) FR codé(s) en dur sur une surface agent verrouillée :\x1b[0m\n`)
for (const o of offenders) {
  console.error(`  ${o.file.replace(cwd, '')}:${o.line}:${o.column}`)
  console.error(`    ${o.message.replace(/^disallow literal string:\s*/, '').replace(/\s+/g, ' ').slice(0, 120)}`)
}
console.error(
  '\nCorriger : envelopper le texte visible dans t() (catalogue i18n).\n' +
    "Si c'est une donnée d'exemple/démo (non traduisible) ou un terme verbatim, l'isoler\n" +
    "en {'…'} ou l'ajouter à words.exclude d'eslint.config.js (faux positif structurel).",
)
process.exit(1)
