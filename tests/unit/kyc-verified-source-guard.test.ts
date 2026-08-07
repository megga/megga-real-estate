import { describe, it, expect } from 'vitest'
import { emptyRoots, readFileSafely, rel, scanRoots } from './helpers/fs-scan'

/**
 * Garde-fou « règle d'or » LBA : la SEULE ÉCRITURE de dossier_status='verified'
 * vit dans la fonction trigger auto_verify_kyc_dossier (baseline). Tout autre
 * WRITE = bug LBA. On ne flague QUE les écritures — jamais les comparaisons
 * (===, WHERE, CHECK, IS DISTINCT FROM) ni les CHECK d'enum.
 *
 * DÉTERMINISME. Le balayage passe par `tests/unit/helpers/fs-scan.ts` : racines
 * ancrées sur le dépôt (et non sur `process.cwd()`), typage des entrées par
 * `withFileTypes`, aléas FS classés en « disparu » (ignoré) vs « illisible »
 * (signalé à part). Le pourquoi de chacun de ces trois points est documenté en
 * tête de ce module.
 *
 * Ce que ça corrige ICI, mesuré : ce garde partait au rouge par intermittence
 * sous `npm run test:unit` alors qu'il passait seul, SANS JAMAIS nommer de
 * fichier — signature d'une erreur FS, pas d'une violation. Sous churn
 * concurrent, l'ancien walk échouait 10 fois sur 10 ; le walk durci passe 10
 * fois sur 10. Un garde qui crie au loup finit ignoré : le 06.08.2026 `main` a
 * été déclaré cassé à tort et une PR de sécurité retenue pour cette raison
 * (cf. PR #1177).
 */

const ROOTS = ['supabase/functions', 'supabase/migrations', 'src'] as const
const SOURCE_EXT = /\.(ts|tsx|sql)$/

// Écriture seule — mêmes motifs (et mêmes drapeaux) qu'à l'origine.
const WRITE_PATTERNS = [
  ['TS_WRITE', /dossier_status\s*:\s*['"]verified['"]/],   // .update({ dossier_status: 'verified' })
  ['SQL_SET', /set\s+dossier_status\s*=\s*'verified'/i],   // UPDATE ... SET dossier_status='verified'
  ['SQL_ASSIGN', /dossier_status\s*:=\s*'verified'/i],     // affectation plpgsql
] as const

// Le seul écrivain légitime, et la preuve que le scan fonctionne encore.
const BASELINE = 'supabase/migrations/00000000000000_baseline_remote_schema.sql'
const ALLOWLIST_TOKEN = 'auto_verify_kyc_dossier'

/**
 * Neutralise les lignes ENTIÈREMENT commentées. Règle volontairement étroite :
 * si les premiers caractères non blancs sont `//` ou `--`, la ligne est un
 * commentaire dans les DEUX langages — aucun risque de rogner une chaîne.
 *
 * Pourquoi : hors baseline, les deux seuls fichiers que le motif attrapait le
 * faisaient DEPUIS UN COMMENTAIRE (MobileKycListScreen.tsx L23, migration
 * 20260522_003 L9), et ne restaient verts que parce qu'une AUTRE ligne de
 * commentaire citait auto_verify_kyc_dossier. Reformuler l'une des deux passait
 * le guard au rouge sans qu'aucune écriture n'existe : exactement le faux
 * positif qu'on cherche à éliminer.
 */
function stripFullLineComments(src: string): string {
  return src.split('\n').map((line) => (/^\s*(\/\/|--)/.test(line) ? '' : line)).join('\n')
}

const scan = scanRoots(ROOTS.map((root) => ({ root, keep: (n: string) => SOURCE_EXT.test(n) })))

interface Verdict {
  /** Chemins qu'on n'a PAS pu lire — aléa d'environnement, à distinguer d'un coupable. */
  unreadable: string[]
  /** `chemin:ligne [MOTIF]` pour chaque écriture interdite. */
  offenders: string[]
  /** Fichiers qui écrivent mais citent le trigger légitime. */
  allowlisted: string[]
}

let cached: Verdict | null = null

/** Une seule lecture de l'arbre pour les deux tests — ils lisent le même verdict. */
function analyse(): Verdict {
  if (cached) return cached
  const unreadable = [...scan.unreadable]
  const offenders: string[] = []
  const allowlisted: string[] = []

  for (const path of scan.files) {
    const raw = readFileSafely(path)
    // Disparu entre le listing et l'ouverture (écrivain concurrent) : rien à
    // vérifier, on passe. C'était LA cause du rouge intermittent historique.
    if (raw.status === 'gone') continue
    if (raw.status === 'unreadable') {
      unreadable.push(`${rel(path)} — ${raw.error}`)
      continue
    }
    const code = stripFullLineComments(raw.value)
    const hit = WRITE_PATTERNS.find(([, re]) => re.test(code))
    if (!hit) continue
    // Allowlist : citer la fonction trigger légitime. Un writer rogue
    // (edge/app) ne référencerait jamais ce trigger SQL.
    if (code.includes(ALLOWLIST_TOKEN)) {
      allowlisted.push(rel(path))
      continue
    }
    const [name, re] = hit
    const line = code.split('\n').findIndex((l) => re.test(l)) + 1
    offenders.push(`${rel(path)}:${line} [${name}]`)
  }

  cached = { unreadable, offenders, allowlisted }
  return cached
}

describe("KYC règle d'or — dossier_status=verified", () => {
  // Passe d'abord : si le scan n'a rien vu, le test suivant serait vert POUR RIEN.
  it('scanne réellement les trois racines', () => {
    const { allowlisted } = analyse()

    const vides = emptyRoots(scan)
    expect(vides, `Racines vides (cwd ou arborescence cassée ?) : ${vides.join(', ')}`).toEqual([])

    expect(scan.files.map(rel), `${BASELINE} introuvable — le scan ne couvre plus les migrations`)
      .toContain(BASELINE)

    // Le baseline écrit 'verified' DANS auto_verify_kyc_dossier : il doit rester
    // détecté comme écriture ET couvert par l'allowlist. S'il tombe de cette
    // liste, c'est le détecteur ou l'allowlist qui a cessé de fonctionner.
    expect(allowlisted, 'Écrivain légitime perdu de vue — motifs ou allowlist cassés').toContain(BASELINE)
  })

  it("n'est écrit nulle part hors la fonction auto_verify_kyc_dossier", () => {
    const { offenders, unreadable } = analyse()

    // Distinct du verdict : un chemin illisible dit « je n'ai pas pu vérifier »,
    // pas « quelqu'un écrit verified ». Sans cette séparation, un aléa FS
    // ressemblait à une violation LBA.
    expect(unreadable, `Lecture FS impossible (aléa d'environnement, PAS une violation) : ${unreadable.join(' | ')}`).toEqual([])

    expect(offenders, `Writers verified interdits : ${offenders.join(', ')}`).toEqual([])
  })
})
