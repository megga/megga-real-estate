/**
 * Garde-fou : AUCUN code applicatif ne modifie ni ne supprime une ligne de
 * `activity_events`. Le journal est append-only ; les seuls UPDATE admis sont ceux
 * qu'émettent les FK.
 *
 * ── POURQUOI CE FICHIER EXISTE ───────────────────────────────────────────────
 * L'étape 8 de `delete-account` réécrivait `actor_id = 'deleted_user'` sur chaque
 * ligne de l'agent supprimé, et le registre de conformité (activité n°1) promettait
 * cette anonymisation. Elle n'a JAMAIS eu lieu, sur aucune ligne : `actor_id` est un
 * `uuid` (22P02 avant même le trigger), le trigger `enforce_activity_events_immutability`
 * (20260801420000) refuse toute réécriture d'acteur hors de ses trois branches, et la
 * FK exige un profil existant. Trois refus indépendants — et le résultat de chaque
 * `update` était jeté, sans `{ error }` : supabase-js RÉSOUT une erreur PostgREST, il
 * ne la lève pas. La fonction répondait 200.
 *
 * Le résultat voulu existe pourtant, et mieux : à l'étape 11, `deleteUser` emporte le
 * profil (`profiles_id_fkey` ON DELETE CASCADE), et `activity_events_actor_id_fkey`
 * (ON DELETE SET NULL) détache l'acteur de TOUTES ses lignes, dans la transaction de
 * la suppression ; la branche « détachement » du trigger garde `actor_kind = 'user'`
 * et dépose `actor_detached_at / _from / _reason`.
 *
 * ⛔ LE FAUX CORRECTIF QUE CETTE GARDE EST SEULE À ATTRAPER. Les deux UPDATE que le
 * trigger ADMETTRAIT mentent l'un et l'autre : `actor_id = NULL` seul ferait écrire
 * « profile deleted (FK on delete set null) » avant que le profil soit supprimé ;
 * `actor_kind = 'system'` attribuerait à la machine le geste d'un agent. Le spec
 * backend de delete-account ne les distingue pas du bon état final — l'étape échouait
 * déjà sans rien modifier. Seule une interdiction STATIQUE les arrête.
 *
 * ── LIMITES, écrites pour qu'on ne les découvre pas en production ────────────
 * Heuristique textuelle, pas d'AST. Le blanchiment des commentaires respecte les
 * chaînes (un glob `'**\/*.ts'` n'ouvre pas de faux commentaire de bloc, une URL
 * `'https://…'` ne coupe pas la ligne), mais pas les littéraux d'expression
 * régulière : un `//` DANS une regex coupe le reste de sa ligne. Échappent au motif :
 * un `from(table)` dynamique, une requête gardée dans une variable avant son
 * `.update(`, et une écriture passée par `.rpc()` — celle-là relève du SQL, que le
 * trigger garde.
 *
 * Balayage par `tests/unit/helpers/fs-scan.ts` (racines ancrées sur le dépôt, aléas FS
 * classés) — le pourquoi est en tête de ce module.
 */
import { describe, it, expect } from 'vitest'
import { emptyRoots, readFileSafely, rel, repoPath, scanRoots, type Scan } from './helpers/fs-scan'

const RACINES = [
  { root: 'supabase/functions', keep: (n: string) => n.endsWith('.ts') && !n.includes('.test.') },
  { root: 'src', keep: (n: string) => /\.tsx?$/.test(n) },
  { root: 'scripts', keep: (n: string) => /\.(?:mjs|cjs|js|ts)$/.test(n) },
]

/** L'émetteur témoin : il écrit la trace `account_deleted`, et il était le seul fautif. */
const TEMOIN = 'supabase/functions/delete-account/index.ts'

/**
 * Écritures assumées, avec leur raison — sur le patron de `SANS_CATEGORIE_ASSUME`
 * (activity-events-category.spec.ts). VIDE, et c'est le but : y ajouter une entrée doit
 * rester un geste conscient, qu'une relecture voit passer.
 */
const ECRITURES_ASSUMEES: Record<string, string> = {}

/**
 * Blanchit les commentaires EN GARDANT les sauts de ligne — les numéros de ligne
 * rapportés restent justes — et sans entrer dans les chaînes.
 *
 * Une chaîne simple ne franchit pas la ligne : un apostrophe de texte JSX (« l'agence »)
 * ou d'une regex n'engloutit donc que la fin de SA ligne, et seulement au sens où ses
 * commentaires n'y seraient plus reconnus — le code, lui, n'est jamais retiré. L'erreur
 * possible va vers le ROUGE, jamais vers le vert.
 */
function blanchirCommentaires(src: string): string {
  let out = ''
  let etat: 'code' | 'ligne' | 'bloc' | "'" | '"' | '`' = 'code'
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!
    const d = src[i + 1]
    if (etat === 'code') {
      if (c === '/' && d === '/') { etat = 'ligne'; out += '  '; i++; continue }
      if (c === '/' && d === '*') { etat = 'bloc'; out += '  '; i++; continue }
      if (c === "'" || c === '"' || c === '`') etat = c
      out += c
    } else if (etat === 'ligne') {
      if (c === '\n') { etat = 'code'; out += c } else out += ' '
    } else if (etat === 'bloc') {
      if (c === '*' && d === '/') { etat = 'code'; out += '  '; i++; continue }
      out += c === '\n' ? c : ' '
    } else {
      if (c === '\\') { out += c + (d ?? ''); i++; continue }
      if (c === etat || (c === '\n' && etat !== '`')) etat = 'code'
      out += c
    }
  }
  return out
}

/** Les écritures interdites : le client (`.update / .upsert / .delete`) et le SQL brut. */
const MOTIFS = [
  /activity_events['"`]\s*\)\s*\.(update|upsert|delete)\s*\(/g,
  /\b(update\s+(?:public\.)?activity_events\b|delete\s+from\s+(?:public\.)?activity_events\b|truncate\s+(?:table\s+)?(?:public\.)?activity_events\b)/gi,
]

/** `ligne .methode(` pour chaque écriture interdite du source — la ligne de la MÉTHODE. */
function ecrituresInterdites(source: string): string[] {
  const propre = blanchirCommentaires(source)
  const out: string[] = []
  for (const motif of MOTIFS) {
    for (const m of propre.matchAll(motif)) {
      const ligne = propre.slice(0, m.index + m[0].lastIndexOf(m[1]!)).split('\n').length
      out.push(`${ligne} ${m[1]!.includes(' ') ? m[1] : `.${m[1]}(`}`)
    }
  }
  return out
}

interface Analyse {
  scan: Scan
  lus: string[]
  emetteurs: string[]
  fautifs: string[]
}
let cache: Analyse | null = null

/** Une seule lecture de l'arbre : deux tests ne doivent pas voir deux arbres différents. */
function analyser(): Analyse {
  if (cache) return cache
  const scan = scanRoots(RACINES)
  const lus: string[] = []
  const emetteurs: string[] = []
  const fautifs: string[] = []
  for (const chemin of scan.files) {
    const brut = readFileSafely(chemin)
    if (brut.status === 'gone') continue
    if (brut.status === 'unreadable') {
      scan.unreadable.push(`${rel(chemin)} — ${brut.error}`)
      continue
    }
    const relatif = rel(chemin)
    lus.push(relatif)
    const source = brut.value.replace(/\r\n/g, '\n')
    if (!source.includes('activity_events')) continue
    if (/from\(\s*['"`]activity_events['"`]\s*\)/.test(source)) emetteurs.push(relatif)
    if (relatif in ECRITURES_ASSUMEES) continue
    for (const f of ecrituresInterdites(source)) {
      const [ligne, ...quoi] = f.split(' ')
      fautifs.push(`${relatif}:${ligne} ${quoi.join(' ')}`)
    }
  }
  cache = { scan, lus, emetteurs, fautifs }
  return cache
}

describe('activity_events est append-only — côté code applicatif', () => {
  it('le balayage porte sur un périmètre non vide, et son détecteur voit ce qu’il doit voir', () => {
    const { scan, lus, emetteurs } = analyser()
    expect(emptyRoots(scan), 'racine(s) vide(s) — arborescence déplacée ?').toEqual([])
    expect(scan.unreadable, `lecture FS impossible (aléa, PAS une infraction) : ${scan.unreadable.join(' | ')}`).toEqual([])
    expect(lus.length, 'aucun fichier balayé').toBeGreaterThan(50)
    expect(emetteurs, `${TEMOIN} introuvable parmi les émetteurs : le motif de détection ne matche plus`).toContain(TEMOIN)
    expect(emetteurs.length, 'trop peu d’émetteurs : le motif ne voit plus l’arbre').toBeGreaterThan(5)

    // Contrôle POSITIF du détecteur lui-même, sur un échantillon qui porte chacun de ses
    // pièges : sans lui, un blanchiment qui avale le code rendrait le test suivant vert.
    const echantillon = [
      "const glob = '**/*.ts'",
      "await admin.from('activity_events').update({ actor_id: null })",
      "// await admin.from('activity_events').delete()",
      "/* await admin.from('activity_events').upsert({}) */",
      "const url = 'https://x.test'; await admin.from(\"activity_events\")",
      '  .delete()',
      "await sql`UPDATE public.activity_events SET actor_id = NULL`",
    ].join('\n')
    expect(ecrituresInterdites(echantillon)).toEqual(['2 .update(', '6 .delete(', '7 UPDATE public.activity_events'])
  })

  it('aucun code applicatif ne modifie ni ne supprime une ligne du journal', () => {
    const { fautifs } = analyser()
    expect(fautifs, [
      'Écriture(s) UPDATE / UPSERT / DELETE sur activity_events :',
      ...fautifs.map((f) => `  · ${f}`),
      'Le journal est append-only (enforce_activity_events_immutability, 20260801420000) :',
      'les seuls UPDATE admis sont ceux émis par les FK. Pour dissocier un acteur supprimé,',
      'il n’y a RIEN à écrire : activity_events_actor_id_fkey (ON DELETE SET NULL) le fait',
      'quand le profil part. Une exception réelle s’inscrit dans ECRITURES_ASSUMEES, avec sa raison.',
    ].join('\n')).toEqual([])
  })

  it('les exceptions restent nommées, et rares', () => {
    expect(Object.keys(ECRITURES_ASSUMEES).length, 'trop d’exceptions : la garde ne prouve plus rien').toBeLessThanOrEqual(3)
    for (const [fichier, raison] of Object.entries(ECRITURES_ASSUMEES)) {
      expect(raison.length, `l’exception ${fichier} doit porter une raison écrite`).toBeGreaterThan(20)
    }
  })

  it('delete-account lit l’erreur de sa trace `account_deleted` AVANT toute destruction', () => {
    const r = readFileSafely(repoPath(TEMOIN))
    expect(r.status, `${TEMOIN} illisible`).toBe('ok')
    const src = blanchirCommentaires(r.status === 'ok' ? r.value.replace(/\r\n/g, '\n') : '')
    // La première destruction : l'anonymisation du profil (étape 6).
    const anonymisation = src.search(/\.from\('profiles'\)\s*\.update\(/)
    expect(anonymisation, 'anonymisation du profil introuvable : la garde ne mesure plus rien').toBeGreaterThan(-1)

    const trace = /const\s*\{\s*error:\s*(\w+)\s*\}\s*=\s*await\s+admin\s*\.from\('activity_events'\)\s*\.insert\(/.exec(src)
    expect(trace, 'le résultat de l’insert `account_deleted` est jeté : un échec passait en silence, et la ' +
      'console (useAccountDeletions) n’avait plus AUCUNE preuve de la suppression').not.toBeNull()
    const lue = src.indexOf(`if (${trace![1]})`, trace!.index)
    expect(lue, `\`${trace![1]}\` n’est jamais lu`).toBeGreaterThan(-1)
    expect(lue, 'l’erreur de la trace doit être lue AVANT l’anonymisation — rien n’est encore détruit').toBeLessThan(anonymisation)

    // Branche ADMIN : l'opérateur est inscrit au registre MEGGA (famille `lifecycle`),
    // comme dans admin-user-lifecycle — et l'échec s'y lit aussi avant toute destruction.
    const registre = /const\s*\{\s*error:\s*(\w+)\s*\}\s*=\s*await\s+admin\s*\.rpc\(\s*'admin_log_write'/.exec(src)
    expect(registre, 'la suppression par un super-admin n’est inscrite nulle part au registre').not.toBeNull()
    const lu = src.indexOf(`if (${registre![1]})`, registre!.index)
    expect(lu).toBeGreaterThan(-1)
    expect(lu, 'l’erreur du registre doit être lue AVANT l’anonymisation').toBeLessThan(anonymisation)
  })
})
