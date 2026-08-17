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
//
// ── ⛔ POURQUOI CETTE LISTE A GAGNÉ QUATRE ENTRÉES LE 18 AOÛT 2026 ────────────
// Elle était une LISTE BLANCHE, donc tout ce qui n'y figurait pas était dehors
// SANS QUE RIEN NE LE DISE. Mesuré : trois surfaces CLIENTES — la réception
// acheteur et les deux pages de visite — n'avaient aucune traduction et
// portaient ~66 chaînes françaises en dur. Un acheteur alémanique recevait sa
// sélection de biens en français. La garde ne les voyait pas parce qu'elles
// n'étaient pas dans la liste, et rien ne signale une absence.
//
// ⚠ ET LE MÊME BALAYAGE A TROUVÉ TROIS AUTRES ZONES du même genre : le 404
// (« Page introuvable », qu'un client atteint avec un lien fautif), l'écran
// d'ouverture (« Ouverture de votre espace », que TOUT LE MONDE voit) et le
// bandeau de bundle périmé. Toutes ajoutées ici.
//
// ⛔ CE QUI RESTE VOLONTAIREMENT DEHORS, ET IL FAUT L'ÉCRIRE :
//   · `src/components/admin/**` et `src/pages/admin/**` — la console
//     super-admin. Audience d'UNE personne, francophone ; la traduire coûterait
//     ~350 entrées pour zéro lecteur. C'est une décision, pas un oubli.
//   · `src/pages/dev/**` — les bancs, absents du bundle déployé.
//   · `src/components/megga-x/**` et `propertyx/**` — le port de la vitrine et
//     les vestiges d'icônes ; leur copie vient de Webflow, pas du catalogue.
//
// ⚠ Une zone neuve de `src/components/` n'entre PAS ici toute seule : ce script
// reste une liste. La garde qui mesure la RÈGLE plutôt qu'un périmètre est
// `tests/unit/face-publique-i18n.spec.ts`, et elle dérive le sien du dossier.
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
  // Ajoutées le 18 août 2026 — voir l'en-tête.
  'src/pages/public/**/*.{ts,tsx}',
  'src/components/kyc-magic-link/**/*.{ts,tsx}',
  'src/components/layout/**/*.{ts,tsx}',
  'src/components/auth/**/*.{ts,tsx}',
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
