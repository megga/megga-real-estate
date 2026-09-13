/**
 * Supprimer une agence n'appartient à personne d'autre que `release_empty_solo_agency`
 * (audit du 13.09.2026, point S9).
 *
 * POURQUOI CE BANC EXISTE. `accept-team-invite` supprimait l'agence solo quittée sur trois
 * conditions, sans regarder ce qu'elle portait : 49 clés étrangères en CASCADE emportaient
 * deals, rappels et dossier KYB. Le correctif tient en deux verrous, et ce fichier garde
 * chacun contre la régression qu'aucune autre porte ne verrait :
 *
 *   1. GRANT — `20260913160200` retire DELETE sur `agencies` à `anon` et `authenticated`.
 *      Aucune policy ne l'ouvrait, mais une policy trop large écrite demain suffirait ; et un
 *      `grant all on all tables in schema public to authenticated` le rendrait sans un mot.
 *      Aucune migration POSTÉRIEURE ne peut donc le rendre. La suite backend le vérifie sur
 *      une base fraîche ; ce contrôle-ci tourne sur chaque PR, sans Docker.
 *   2. CODE — aucune edge, aucune page, aucun script ne supprime une agence directement
 *      (`.from('agencies').delete()`) : la décision « libérable ou non » vit dans la
 *      fonction SQL, qui lit les clés étrangères au moment de l'appel.
 *
 * ⚠ CE QUE LE CONTRÔLE NE VOIT PAS, écrit plutôt que supposé : un GRANT construit
 * dynamiquement (`execute format('grant %s on …')`) dans un bloc DO, et un nom de table
 * porté par une variable côté TypeScript. La preuve comportementale reste
 * tests/backend/solo-agency-release.spec.ts.
 *
 * Anti-vacuité : chaque matcher est éprouvé sur des fixtures positives ET négatives, le
 * balayage doit voir un nombre plancher de fichiers, et la migration de référence doit
 * être trouvée par le même lecteur que celui qui juge les autres.
 */
import { describe, it, expect } from 'vitest'
import { emptyRoots, readFileSafely, rel, repoPath, scanRoots } from './helpers/fs-scan'

/** La migration qui pose le verrou — le point de départ du « après ». */
const REFERENCE = '20260913160200_release_empty_solo_agency.sql'
/** L'edge qui quittait l'agence en la supprimant — elle doit passer par la fonction. */
const EDGE_REFERENCE = 'supabase/functions/accept-team-invite/index.ts'

/** Commentaires SQL retirés : un GRANT cité dans la prose ne donne rien. */
function sansCommentairesSql(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ')
}

/** Commentaires JS/TS retirés — sinon un `// .from('agencies').delete()` ferait rougir. */
function sansCommentairesTs(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
}

/** Instructions d'un fichier SQL, en minuscules et blancs normalisés. */
function instructions(sql: string): string[] {
  return sansCommentairesSql(sql)
    .split(';')
    .map((s) => s.replace(/\s+/g, ' ').trim().toLowerCase())
    .filter(Boolean)
}

/** Un identifiant de relation désigne-t-il `public.agencies` (guillemets, schéma optionnels) ? */
function designeAgencies(cible: string): boolean {
  return cible
    .split(',')
    .map((c) => c.trim().replace(/"/g, '').replace(/^table\s+/, '').replace(/^public\./, ''))
    .some((c) => c === 'agencies' || c === 'all tables in schema public')
}

/** Le rôle visé fait-il partie de ceux qui ne doivent JAMAIS supprimer une agence ? */
function viseClientOuPublic(roles: string): boolean {
  return roles
    .split(',')
    .map((r) => r.trim().replace(/"/g, '').replace(/\s+with grant option$/, ''))
    .some((r) => r === 'anon' || r === 'authenticated' || r === 'public')
}

/** Les privilèges accordés contiennent-ils la suppression ? `all` la contient. */
function contientDelete(privileges: string): boolean {
  return privileges.split(',').map((p) => p.trim()).some((p) => p === 'delete' || p === 'all' || p === 'all privileges')
}

/**
 * Une instruction SQL rend-elle DELETE sur agencies à anon, authenticated ou PUBLIC ?
 *
 * ⚠ Pas d'ancrage en début d'instruction : dans un bloc DO, le premier GRANT suit un
 * `begin` sans point-virgule entre les deux, et un `^grant` le laisserait passer.
 */
function rendDelete(instruction: string): boolean {
  const m = instruction.match(/(?:^|\s)grant (.+?) on (?:table )?(.+?) to (.+)$/)
  return !!m && contientDelete(m[1]!) && designeAgencies(m[2]!) && viseClientOuPublic(m[3]!)
}

/** Une instruction SQL retire-t-elle DELETE sur agencies à anon ET authenticated ? */
function retireDelete(instruction: string): boolean {
  const m = instruction.match(/(?:^|\s)revoke (.+?) on (?:table )?(.+?) from (.+)$/)
  if (!m || !contientDelete(m[1]!) || !designeAgencies(m[2]!)) return false
  const roles = m[3]!.split(',').map((r) => r.trim().replace(/"/g, ''))
  return roles.includes('anon') && roles.includes('authenticated')
}

/** Un fichier TS/JS supprime-t-il une agence en direct ? Guillemets des trois sortes. */
const SUPPRESSION_DIRECTE = /\.from\(\s*(['"`])agencies\1\s*\)\s*\.delete\s*\(/

describe('les matchers voient ce qu’ils doivent voir (anti-vacuité)', () => {
  it('un GRANT qui rend DELETE à un client est reconnu, sous toutes ses graphies', () => {
    for (const sql of [
      'grant delete on public.agencies to authenticated',
      'GRANT ALL ON TABLE "public"."agencies" TO "anon"',
      'grant select, insert, update, delete on table agencies to anon, service_role',
      'grant all privileges on all tables in schema public to authenticated',
      'grant delete on public.agencies to public',
      'do $$ begin grant delete on public.agencies to authenticated; end $$',
    ]) {
      expect(instructions(sql).some(rendDelete), sql).toBe(true)
    }
  })

  it('… et ignore ce qui ne le rend pas', () => {
    for (const sql of [
      'grant delete on public.agencies to service_role',
      'grant select, update on public.agencies to authenticated',
      'grant delete on public.agency_activation to authenticated',
      'grant delete on public.agencies_archive to anon',
      '-- grant delete on public.agencies to authenticated',
      '/* grant all on public.agencies to anon */',
    ]) {
      expect(instructions(sql).some(rendDelete), sql).toBe(false)
    }
  })

  it('un REVOKE qui retire DELETE aux deux clients est reconnu, un REVOKE partiel non', () => {
    expect(instructions('revoke delete on table public.agencies from anon, authenticated').some(retireDelete)).toBe(true)
    expect(instructions('REVOKE ALL ON "public"."agencies" FROM "anon", "authenticated"').some(retireDelete)).toBe(true)
    expect(instructions('revoke delete on public.agencies from anon').some(retireDelete)).toBe(false)
    expect(instructions('revoke update on public.agencies from anon, authenticated').some(retireDelete)).toBe(false)
  })

  it('une suppression directe d’agence est reconnue, en guillemets simples, doubles ou gabarit', () => {
    expect(SUPPRESSION_DIRECTE.test("supabaseAdmin\n  .from('agencies')\n  .delete()\n  .eq('id', x)")).toBe(true)
    expect(SUPPRESSION_DIRECTE.test('db.from("agencies").delete()')).toBe(true)
    expect(SUPPRESSION_DIRECTE.test('db.from(`agencies`).delete()')).toBe(true)
    expect(SUPPRESSION_DIRECTE.test(".from('agency_activation').delete()")).toBe(false)
    expect(SUPPRESSION_DIRECTE.test(".from('agencies').select('id').eq('id', x)")).toBe(false)
    expect(SUPPRESSION_DIRECTE.test(sansCommentairesTs("// .from('agencies').delete()"))).toBe(false)
  })
})

describe('DELETE sur agencies — aucune migration postérieure ne le rend aux clients', () => {
  const scan = scanRoots([{ root: 'supabase/migrations', keep: (n) => n.endsWith('.sql') }])
  const fichiers = scan.files
    .map((abs) => ({ nom: rel(abs).split('/').pop()!, abs }))
    .sort((a, b) => a.nom.localeCompare(b.nom))

  it('le balayage voit les migrations, et la référence parmi elles', () => {
    expect(emptyRoots(scan), 'racine vide : arborescence déplacée ?').toEqual([])
    expect(scan.unreadable).toEqual([])
    expect(fichiers.length, 'trop peu de migrations lues : le chemin est-il le bon ?').toBeGreaterThan(200)
    expect(fichiers.map((f) => f.nom)).toContain(REFERENCE)
  })

  it('CONTRÔLE POSITIF — le lecteur trouve le REVOKE de la migration de référence', () => {
    const ref = fichiers.find((f) => f.nom === REFERENCE)!
    const lu = readFileSafely(ref.abs)
    expect(lu.status).toBe('ok')
    const sql = lu.status === 'ok' ? lu.value : ''
    expect(instructions(sql).some(retireDelete), `${REFERENCE} doit retirer DELETE à anon et authenticated`).toBe(true)
  })

  it('CONTRÔLE POSITIF — le même lecteur voit le GRANT ALL de la baseline (antérieur, donc permis)', () => {
    // Sans ce témoin, un matcher cassé par la graphie du dump (`"public"."agencies"`,
    // rôles entre guillemets) rendrait la clause suivante verte sur un vrai GRANT.
    const baseline = fichiers.find((f) => f.nom.startsWith('00000000000000_'))
    expect(baseline, 'baseline introuvable').toBeDefined()
    const lu = readFileSafely(baseline!.abs)
    expect(lu.status === 'ok' && instructions(lu.value).some(rendDelete)).toBe(true)
  })

  it('aucune migration postérieure à la référence ne rend DELETE sur agencies à anon, authenticated ou PUBLIC', () => {
    const fautes: string[] = []
    for (const { nom, abs } of fichiers) {
      if (nom.localeCompare(REFERENCE) <= 0) continue
      const lu = readFileSafely(abs)
      if (lu.status === 'gone') continue
      if (lu.status === 'unreadable') { fautes.push(`${nom} : illisible (${lu.error})`); continue }
      for (const i of instructions(lu.value).filter(rendDelete)) fautes.push(`${nom} : ${i}`)
    }
    expect(fautes, [
      'DELETE sur public.agencies rendu à un client après 20260913160200 :',
      ...fautes.map((f) => `  · ${f}`),
      'La seule suppression d’agence est release_empty_solo_agency, en service_role.',
    ].join('\n')).toEqual([])
  })
})

describe('aucun code ne supprime une agence en direct', () => {
  const scan = scanRoots([
    { root: 'supabase/functions', keep: (n) => /\.(ts|js|mjs)$/.test(n) && !n.includes('.test.') },
    { root: 'src', keep: (n) => /\.(ts|tsx|js|mjs)$/.test(n) },
    { root: 'scripts', keep: (n) => /\.(ts|js|mjs|cjs)$/.test(n) },
  ])

  it('le balayage voit les trois arbres, et l’edge de référence', () => {
    expect(emptyRoots(scan), 'racine vide : arborescence déplacée ?').toEqual([])
    expect(scan.unreadable).toEqual([])
    expect(scan.files.length).toBeGreaterThan(500)
    expect(scan.files.map(rel)).toContain(EDGE_REFERENCE)
  })

  it('CONTRÔLE POSITIF — l’edge de référence passe par release_empty_solo_agency', () => {
    const lu = readFileSafely(repoPath(EDGE_REFERENCE))
    expect(lu.status).toBe('ok')
    expect(lu.status === 'ok' ? sansCommentairesTs(lu.value) : '').toContain("rpc('release_empty_solo_agency'")
  })

  it('aucun `.from(agencies).delete()` dans supabase/functions, src ni scripts', () => {
    const fautes: string[] = []
    for (const abs of scan.files) {
      const lu = readFileSafely(abs)
      if (lu.status !== 'ok') continue
      if (SUPPRESSION_DIRECTE.test(sansCommentairesTs(lu.value))) fautes.push(rel(abs))
    }
    expect(fautes, `suppression directe d'agence :\n  ${fautes.join('\n  ')}`).toEqual([])
  })
})
