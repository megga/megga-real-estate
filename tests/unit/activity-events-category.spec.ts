// Garde-fou d'instrumentation (étape 6, spec §5.2) : toute écriture dans
// `activity_events` doit poser une `category`.
//
// POURQUOI CE TEST EXISTE. La décision PO n° 6 décrivait « category NULL sur 95 %
// d'activity_events » comme un héritage diffus et non rattrapable. Mesuré à l'étape 6, ce
// n'était pas diffus du tout : 4 616 lignes sur 4 858 venaient d'UN SEUL émetteur,
// `match_suggested` dans matching-engine, qui ne posait pas de catégorie. Le passé reste nul
// — la table refuse l'UPDATE — mais rien n'empêchait le prochain émetteur de refaire
// exactement la même chose, et personne ne l'aurait vu : un `insert` sans `category` ne lève
// aucune erreur, la colonne est simplement nullable.
//
// Une ligne sans catégorie est invisible aux puces du Live et aux filtres de la console.
// Elle n'est pas perdue, elle est muette — ce qui est pire, parce que l'écran a l'air
// complet.
//
// Le contrôle est STATIQUE (lecture des sources) et non comportemental : il n'existe pas de
// base où observer les émetteurs qui n'ont pas encore tourné.
//
// DÉTERMINISME. Le balayage passe par `tests/unit/helpers/fs-scan.ts` : racine ancrée sur le
// dépôt (et non sur `process.cwd()`), typage des entrées par `withFileTypes`, aléas FS
// classés en « disparu » (ignoré) vs « illisible » (signalé à part). Le pourquoi de chacun de
// ces trois points est documenté en tête de ce module.
//
// Ce que ça corrige ICI, mesuré : le walk d'origine visitait trois fois le même chemin
// (readdir → statSync → readFileSync) ; sous un écrivain concurrent, il partait au rouge
// 9 fois sur 10 avec un `ENOENT` anonyme — aucun fichier nommé, indiscernable d'une vraie
// infraction d'instrumentation. Le walk durci passe 10 fois sur 10 sous le même churn.
// Le walk d'origine n'avait par ailleurs aucun try/catch : sous un cwd inattendu il jetait
// `ENOENT` pendant la collecte (rouge bruyant mais tout aussi anonyme, pas un vert muet).

import { describe, it, expect } from 'vitest'
import { basename } from 'node:path'
import { emptyRoots, readFileSafely, rel, scanRoots, type Scan } from './helpers/fs-scan'

const RACINE = 'supabase/functions'

/** Émetteur historique — la preuve que le scan voit encore l'arbre des edge functions. */
const EMETTEUR_TEMOIN = 'supabase/functions/matching-engine/index.ts'

/**
 * Émetteurs autorisés à ne PAS poser de catégorie, avec leur raison. Y ajouter une entrée
 * doit rester un geste conscient : c'est tout l'intérêt d'une liste nommée plutôt que d'un
 * seuil toléré.
 */
const SANS_CATEGORIE_ASSUME: Record<string, string> = {
  // Le CHECK n'admet que des familles MÉTIER (kyc|deal|contact|bien|doc|auth|settings|ai).
  // Une panne de fonction n'en est pas une : lui en coller une la ferait apparaître dans
  // une puce à laquelle elle n'appartient pas. Précédent assumé : rls_hardening_applied.
  'audit-edge-error.ts': 'événement d\'infrastructure, sans famille métier',
}

/** Retire commentaires de ligne et de bloc — sinon un `// pas de category:` suffirait à
 * rendre ce test creux, ce qui est exactement le défaut déjà rencontré sur ce chantier. */
function sansCommentaires(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
}

/**
 * Repère les écritures dans activity_events et rend celles qui n'ont pas de `category`
 * dans leur voisinage immédiat. Heuristique textuelle assumée : il n'y a pas d'AST ici.
 *
 * ⚠ Deux formes comptent, et n'en reconnaître qu'une produit des FAUX POSITIFS mesurés :
 * la propriété explicite `category: 'contact'` ET la forme abrégée `category,` — utilisée
 * par whatsapp-webhook, où la catégorie est un paramètre du helper d'audit. Une première
 * version de ce test ne voyait que la première et a fait ajouter une propriété EN DOUBLE,
 * que seul `deno check` a rattrapée (TS1117).
 */
function ecrituresSansCategorie(source: string): number[] {
  const positions: number[] = []
  const propre = sansCommentaires(source)
  const motif = /activity_events['"]\s*\)\s*\.insert\s*\(/g
  let m: RegExpExecArray | null
  while ((m = motif.exec(propre)) !== null) {
    // La fenêtre couvre un objet d'événement complet (agency_id, actor_*, action,
    // entity_*, metadata…) mais s'arrête AU PROCHAIN ÉMETTEUR.
    //
    // ⚠ Une première version se contentait de 1 400 caractères, et la mutation l'a prise
    // en défaut : dans kyc-screening, deux inserts se suivent à moins de 1 400 caractères,
    // et la catégorie du SECOND satisfaisait la fenêtre du premier. Retirer la catégorie du
    // premier laissait le test vert — un faux négatif, c'est-à-dire exactement le défaut
    // que ce fichier est censé empêcher.
    const suivant = propre.indexOf('activity_events', m.index + 20)
    const fin = suivant === -1 ? m.index + 1400 : Math.min(m.index + 1400, suivant)
    const fenetre = propre.slice(m.index, fin)
    if (!/\bcategory\s*[:,}]/.test(fenetre)) positions.push(m.index)
  }
  return positions
}

interface Analyse {
  scan: Scan
  /** Chemins repo-relatifs des fichiers effectivement lus. */
  lus: string[]
  /** Chemins repo-relatifs des fichiers qui touchent à activity_events. */
  emetteurs: string[]
  /** `chemin:ligne` pour chaque écriture sans catégorie. */
  fautifs: string[]
}

let cache: Analyse | null = null

/**
 * Lit chaque fichier UNE fois et en tire tout ce dont les tests ont besoin.
 *
 * Une seule passe, et non une par test : chaque relecture rouvre une fenêtre de course avec
 * un écrivain concurrent, et deux tests pourraient alors ne pas voir le même arbre.
 */
function analyser(): Analyse {
  if (cache) return cache
  const scan = scanRoots([
    { root: RACINE, keep: (n) => n.endsWith('.ts') && !n.includes('.test.') },
  ])
  const lus: string[] = []
  const emetteurs: string[] = []
  const fautifs: string[] = []

  for (const chemin of scan.files) {
    const brut = readFileSafely(chemin)
    // Disparu entre le listing et l'ouverture (écrivain concurrent) : rien à vérifier.
    if (brut.status === 'gone') continue
    if (brut.status === 'unreadable') {
      scan.unreadable.push(`${rel(chemin)} — ${brut.error}`)
      continue
    }
    const relatif = rel(chemin)
    lus.push(relatif)
    const source = brut.value
    if (!source.includes('activity_events')) continue
    emetteurs.push(relatif)
    // `basename` et non `split('/')` : les chemins sont absolus et portent des `\` sous
    // Windows, où découper sur `/` renvoyait le chemin ENTIER au lieu du nom de fichier.
    // L'exception ne matchait donc jamais et ce test échouait en local — vert en CI
    // (Linux), rouge sur la machine de qui l'exécute vraiment : la pire des combinaisons.
    if (basename(chemin) in SANS_CATEGORIE_ASSUME) continue
    for (const pos of ecrituresSansCategorie(source)) {
      const ligne = source.slice(0, pos).split('\n').length
      fautifs.push(`${relatif}:${ligne}`)
    }
  }

  cache = { scan, lus, emetteurs, fautifs }
  return cache
}

describe('instrumentation activity_events (étape 6)', () => {
  it('le balayage porte sur un périmètre non vide (garde anti-test creux)', () => {
    // Sans cette assertion, un chemin de racine devenu faux rendrait le test suivant vert
    // sur zéro fichier — le motif exact du vert sans assertion.
    const { scan, lus, emetteurs } = analyser()

    const vides = emptyRoots(scan)
    expect(vides, `racine(s) vide(s) — arborescence déplacée ? : ${vides.join(', ')}`).toEqual([])

    expect(lus.length, 'aucun fichier balayé : la racine est-elle encore la bonne ?')
      .toBeGreaterThan(50)
    expect(lus, `${EMETTEUR_TEMOIN} introuvable — le scan ne descend plus dans l'arbre`)
      .toContain(EMETTEUR_TEMOIN)
    expect(emetteurs.length, 'aucun émetteur trouvé : le motif de détection ne matche plus')
      .toBeGreaterThan(5)
  })

  it('toute écriture dans activity_events pose une `category`', () => {
    const { scan, fautifs } = analyser()

    // Distinct du verdict : un chemin illisible dit « je n'ai pas pu vérifier », pas
    // « un émetteur oublie sa catégorie ». Sans cette séparation, un aléa FS ressemblait
    // à une infraction d'instrumentation.
    expect(scan.unreadable,
      `Lecture FS impossible (aléa d'environnement, PAS une infraction) : ${scan.unreadable.join(' | ')}`)
      .toEqual([])

    expect(fautifs, [
      'Écriture(s) dans activity_events sans `category` :',
      ...fautifs.map((x) => `  · ${x}`),
      'Une ligne sans catégorie est muette pour les puces du Live et les filtres de la',
      'console — elle n\'est pas perdue, elle est invisible, ce qui est pire.',
      'Valeurs admises : kyc | deal | contact | bien | doc | auth | settings | ai.',
      'Si l\'événement n\'a vraiment pas de famille métier, l\'inscrire dans',
      'SANS_CATEGORIE_ASSUME avec sa raison.',
    ].join('\n')).toEqual([])
  })

  it('les exceptions restent nommées, et rares', () => {
    // Une liste qui s'allonge sans qu'on s'en aperçoive vide le test de son sens.
    expect(Object.keys(SANS_CATEGORIE_ASSUME).length,
      'trop d\'exceptions : le garde-fou ne prouve plus grand-chose').toBeLessThanOrEqual(3)
    for (const [fichier, raison] of Object.entries(SANS_CATEGORIE_ASSUME)) {
      expect(raison.length, `l'exception ${fichier} doit porter une raison écrite`)
        .toBeGreaterThan(20)
    }
  })
})
