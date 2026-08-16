/**
 * Garde-fou — les globs de la porte i18n visent-ils encore quelque chose ?
 *
 * ⛔ CE FICHIER EXISTE À CAUSE D'UNE PORTE DEVENUE MUETTE SANS QUE RIEN NE ROUGISSE.
 *
 * La porte `npm run lint:i18n` (`scripts/lint-i18n-hardcoded.mjs`) ne compte que
 * les messages de SÉVÉRITÉ 2, et la sévérité vient d'`eslint.config.js`, où la
 * famille « verrouillée » est décrite par des CHEMINS. Or un chemin ne proteste
 * pas quand il cesse d'exister : ESLint n'a aucune raison de se plaindre qu'un
 * glob ne corresponde à rien, il applique simplement la règle à l'ensemble vide.
 *
 * Mesuré le 16 août 2026. Le renommage « plus aucun Sugar dans le code » a
 * déplacé quatre dossiers — `crm-sugar` → `crm`, `crm-sugar-v3` → `crm-dossiers`,
 * `crm-sugar-wizard` → `crm-wizard`, `crm-sugar-identity` → `crm-identity` — et
 * n'a corrigé QUE `lint-i18n-hardcoded.mjs`. `eslint.config.js` est resté sur les
 * quatre anciens noms. Conséquence : la règle ne s'appliquait plus DU TOUT aux
 * héritiers (0 message sur les 25 fichiers de `crm-dossiers`, 0 sur KwStepper,
 * 0 sur WizardShell), soit 158 fichiers de composants CRM sortis de la garde —
 * et la porte imprimait toujours son « ✓ i18n garde-fou OK ».
 *
 * C'est la forme la plus coûteuse de défaut de garde : le vert d'une porte qui
 * ne regarde plus rien est indiscernable du vert d'un dépôt sain.
 *
 * ── CE QUE CE FICHIER VÉRIFIE, ET POURQUOI CES DEUX CLAUSES ───────────────────
 *
 *  1. TOUT GLOB VISE UNE CIBLE VIVANTE. Contre le mode de panne ci-dessus. On ne
 *     se contente pas de l'existence du dossier : on exige qu'il contienne au
 *     moins un fichier de l'extension visée. Un dossier vidé de son contenu mais
 *     conservé (`.gitkeep` orphelin) rendrait la garde tout aussi creuse.
 *
 *  2. LES DEUX LISTES COÏNCIDENT. La liste verrouillée est écrite DEUX FOIS — ici
 *     `eslint.config.js` décide de la sévérité, là `lint-i18n-hardcoded.mjs`
 *     décide de ce qui est lu. Leur synchronisation ne tenait qu'à un commentaire
 *     (« ⚠ Garder cette liste synchronisée »), et ce commentaire a échoué à sa
 *     première épreuve. Tant que les deux listes existent, cette clause est ce qui
 *     les tient ensemble.
 *
 * ⚠ Les DIFFÉRÉES ne sont pas comparées entre les deux fichiers : le script ne les
 * connaît pas, et c'est correct — elles sont en WARN, donc invisibles pour lui par
 * construction. Elles sont seulement soumises à la clause 1, parce qu'un glob
 * différé mort donne à lire une exemption vivante là où il n'y a plus de surface
 * (trois l'étaient : `seller-portal/**`, `NetworkSugarV2Page.tsx`, `crm-sugar/ai/**`).
 */
import { describe, expect, it } from 'vitest'
import { readFileSafely, repoPath, scanRoots } from './helpers/fs-scan'

const CONFIG = 'eslint.config.js'
const SCRIPT = 'scripts/lint-i18n-hardcoded.mjs'

function lire(chemin: string): string {
  const lu = readFileFrom(chemin)
  expect(lu, `${chemin} illisible — la garde ne peut rien conclure`).not.toBe('')
  return lu
}

function readFileFrom(chemin: string): string {
  const lu = readFileSafely(repoPath(chemin))
  return lu.status === 'ok' ? lu.value : ''
}

/**
 * Extrait les globs d'un tableau nommé.
 *
 * On lit la SOURCE plutôt que d'importer les modules : `eslint.config.js`
 * n'exporte pas ses deux listes (elles vivent dans une IIFE), et importer le
 * script exécuterait la porte entière — donc ESLint sur tout le CRM — dans un
 * test unitaire.
 */
function globsDe(source: string, nomDuTableau: string): string[] {
  const debut = source.indexOf(`${nomDuTableau} = [`)
  expect(debut, `tableau \`${nomDuTableau}\` introuvable — a-t-il été renommé ?`).toBeGreaterThan(-1)
  // ⚠ Le crochet fermant se cherche à N'IMPORTE QUELLE indentation. Chercher `'\n]'`
  // ne trouve que les tableaux collés à la marge : dans `eslint.config.js`, les deux
  // listes vivent dans une IIFE et sont indentées, si bien que la découpe filait
  // jusqu'au tableau SUIVANT et faisait lire les différées comme des verrouillées.
  const relatif = source.slice(debut).search(/\n\s*\]/)
  expect(relatif, `fin du tableau \`${nomDuTableau}\` introuvable`).toBeGreaterThan(-1)
  const fin = debut + relatif
  // ⚠ Les lignes de commentaire sautent AVANT l'extraction : la prose française du
  // dépôt est pleine d'apostrophes (« n'est », « d'un »), que le lecteur de chaînes
  // apparie deux à deux en fragments de commentaire. Mesuré en écrivant ce fichier.
  // Le préfixe `src/` exigé ensuite est la seconde barrière : un glob est un chemin.
  const corps = source
    .slice(debut, fin)
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//'))
    .join('\n')
  return [...corps.matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((g) => g.startsWith('src/'))
}

/** Partie fixe d'un glob : tout ce qui précède le premier caractère joker. */
function racineDe(glob: string): string {
  const joker = glob.search(/[*?[{]/)
  const prefixe = joker === -1 ? glob : glob.slice(0, joker)
  return prefixe.replace(/\/+$/, '')
}

/** Extensions visées par le glob (`**\/*.{ts,tsx}` → ts, tsx ; un fichier nu → la sienne). */
function extensionsDe(glob: string): string[] {
  const accolade = glob.match(/\{([^}]+)\}\s*$/)
  if (accolade) return accolade[1].split(',').map((e) => e.trim())
  const simple = glob.match(/\.([A-Za-z]+)$/)
  return simple ? [simple[1]] : ['ts', 'tsx']
}

function fichiersVises(glob: string): number {
  const racine = racineDe(glob)
  const exts = extensionsDe(glob)
  // Un glob sans joker désigne UN fichier : `scanRoots` sur un fichier ne rendrait
  // rien (il liste des répertoires), donc on le teste directement.
  if (!/[*?[{]/.test(glob)) return readFileFrom(glob) === '' ? 0 : 1
  const scan = scanRoots([
    { root: racine, keep: (n) => exts.some((e) => n.endsWith(`.${e}`)) },
  ])
  return scan.files.length
}

describe('globs de la porte i18n', () => {
  const config = lire(CONFIG)
  const script = lire(SCRIPT)

  const verrouillesConfig = globsDe(config, 'lockedFamilies')
  const differesConfig = globsDe(config, 'deferredFamilies')
  const verrouillesScript = globsDe(script, 'LOCKED_GLOBS')

  // Contrôle positif : sans lui, une extraction cassée rendrait TOUTES les clauses
  // vertes sur des listes vides — le défaut même que ce fichier combat.
  it('extrait bien les trois listes', () => {
    expect(verrouillesConfig.length, `${CONFIG} › lockedFamilies`).toBeGreaterThan(5)
    expect(differesConfig.length, `${CONFIG} › deferredFamilies`).toBeGreaterThan(2)
    expect(verrouillesScript.length, `${SCRIPT} › LOCKED_GLOBS`).toBeGreaterThan(5)
  })

  it.each([
    ...verrouillesConfig.map((g) => [`${CONFIG} › verrouillées`, g] as const),
    ...differesConfig.map((g) => [`${CONFIG} › différées`, g] as const),
    ...verrouillesScript.map((g) => [`${SCRIPT} › LOCKED_GLOBS`, g] as const),
  ])('%s — « %s » vise au moins un fichier', (_origine, glob) => {
    expect(
      fichiersVises(glob),
      `glob mort : « ${glob} » ne correspond à aucun fichier. Un dossier renommé ou `
        + 'retiré laisse la règle i18next s\'appliquer à l\'ensemble vide — la porte reste '
        + 'verte en ne regardant plus rien. Corriger le chemin, ou retirer le glob si la '
        + 'surface a disparu.',
    ).toBeGreaterThan(0)
  })

  it('les deux listes verrouillées sont identiques', () => {
    expect(
      [...verrouillesScript].sort(),
      `${CONFIG} décide de la SÉVÉRITÉ, ${SCRIPT} décide de ce qui est LU : une famille `
        + 'présente d\'un seul côté est soit jamais lue, soit lue sans être bloquante. '
        + 'Les deux listes doivent rester mot pour mot les mêmes.',
    ).toEqual([...verrouillesConfig].sort())
  })
})
