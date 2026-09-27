/**
 * La lecture « garde → effet » et « périmètre des expéditeurs » de `lint:edge-auth`, éprouvée.
 *
 * POURQUOI CE BANC. Audit du 13.09.2026, point S17 : la porte vérifiait qu'un symbole de garde
 * était PRÉSENT, pas qu'il s'exécutait AVANT ce qu'il protège, ni ce qu'il laissait passer —
 * S1 (un relais e-mail ouvert derrière une garde présente) en est né. Son nouveau lecteur
 * (`scripts/_shared/edge-guard-order.mjs`) est une lecture du TEXTE : sans banc, il ne
 * prouverait que l'absence des formes qu'il sait lire.
 *
 * Deux disciplines, reprises de `edge-secret-compare.spec.ts` :
 *   · chaque NÉGATIF partage sa source avec un positif, qui doit, lui, être vu — un lecteur
 *     qui rendrait « rien » partout échoue ici au lieu d'y paraître prudent ;
 *   · le dépôt RÉEL est lu, et une vraie garde déplacée en mémoire après une vraie écriture
 *     doit rougir : c'est la forme sous laquelle le défaut reviendrait.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { repoPath } from './helpers/fs-scan'
// @ts-expect-error — helper Node de `scripts/` : pas de types, et c'est voulu (CLAUDE.md §4).
import { lexer, lireModule, creerAnalyse, corpsGestionnaire, verdictOrdre, verdictExpediteurs, lecturesRpcInvalides, volatilitesSql, canalNommePerime, TYPES_EFFET, CANAUX_NOMMES } from '../../scripts/_shared/edge-guard-order.mjs'

// Le module n'a pas de types : on les pose ici, une fois, au lieu de laisser fuir `any`.
interface Etape { nom: string; chemin: string; ligne: number }
interface Lieu { genre: string; type: string; canal?: string; detail: string; chemin: string; ligne: number; texte: string; via: Etape[] }
interface Module { chemin: string; source: string; code: string; masque: string; fonctions: Array<{ nom: string; corps: [number, number] }> }
interface Ordre { lisible: boolean; garde: Lieu | null; effets: Lieu[] }
interface Expedition { lisible: boolean; canaux: Set<string>; premier: Lieu | null }
interface Analyse {
  ordreGestionnaire(m: Module, marqueurs?: string[]): Ordre
  effetsAuChargement(m: Module): Lieu[]
  expeditionGestionnaire(m: Module): Expedition
}
interface CanalNomme { module: string; nom: string; type: string; canal?: string; marqueur: string }
interface Regles { gardes: string[]; rpcLecture?: string[]; canauxNommes?: CanalNomme[] }
interface VerdictOrdre { lus: number; illisibles: string[]; violations: Array<{ dir: string; effets: Lieu[]; garde: Lieu | null }>; exemptees: string[]; exemptionsPerimees: string[]; gardesNonAtteintes: string[] }
interface VerdictExpediteurs {
  expediteurs: Array<{ dir: string; canaux: string[]; parPerimetre: boolean; premier: Lieu | null }>
  sansPerimetre: Array<{ dir: string; canaux: string[] }>
  superflus: string[]
  perimes: Array<{ dir: string; raison: string }>
  canauxChanges: Array<{ dir: string; declares: string[]; atteints: string[] }>
}
type Volatilites = Map<string, { volatilite: string; fichier: string }>

const lex = lexer as (source: string) => { code: string; masque: string }
const lire = lireModule as (source: string, chemin: string) => Module
const creer = creerAnalyse as (modules: Map<string, Module>, regles: Regles) => Analyse
const gestionnaire = corpsGestionnaire as (masque: string) => { debut: number; fin: number } | null
const juger = verdictOrdre as (p: { analyse: Analyse; fonctions: Map<string, Module>; marqueurs?: Record<string, string[]>; ouvertes?: string[]; exemptions?: Record<string, unknown> }) => VerdictOrdre
const inventorier = verdictExpediteurs as (p: { analyse: Analyse; fonctions: Map<string, Module>; perimetres: Record<string, { canaux: string[] }> }) => VerdictExpediteurs
const lecturesInvalides = lecturesRpcInvalides as (noms: string[], v: Volatilites, modules: Iterable<{ code: string }>) => Array<{ nom: string; raison: string }>
const volatilites = volatilitesSql as (migrations: Array<{ fichier: string; sql: string }>) => Volatilites
const canalPerime = canalNommePerime as (modules: Map<string, Module>, c: CanalNomme) => string | null
const TOUS_LES_TYPES = TYPES_EFFET as readonly string[]
const CANAUX = CANAUX_NOMMES as readonly CanalNomme[]

/** Les quatre gardes partagées de la porte. */
const GARDES = ['requireAgentAuth', 'requireSuperAdmin', 'isServiceSecret', 'verifyMagicLinkToken']

const src = (...lignes: string[]): string => lignes.join('\n')

/** Un `index.ts` minimal : deux imports, puis le gestionnaire (le corps commence ligne 4). */
const index = (...corps: string[]): string => src(
  "import { requireAgentAuth } from '../_shared/require-agent-auth.ts'",
  "import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'",
  'serve(async (req) => {',
  ...corps.map((l) => `  ${l}`),
  '})',
)

function analyser(fichiers: Record<string, string>, regles: Partial<Regles> = {}): { modules: Map<string, Module>; analyse: Analyse } {
  const modules = new Map(Object.entries(fichiers).map(([chemin, s]) => [chemin, lire(s, chemin)]))
  return { modules, analyse: creer(modules, { gardes: GARDES, ...regles }) }
}

const F = 'supabase/functions/f/index.ts'

/** Verdict d'ordre du gestionnaire d'une seule source. */
function ordre(source: string, marqueurs: string[] = [], regles: Partial<Regles> = {}): Ordre {
  const { modules, analyse } = analyser({ [F]: source }, regles)
  return analyse.ordreGestionnaire(modules.get(F) as Module, marqueurs)
}
const vus = (o: Ordre): string[] => o.effets.map((e) => `${e.ligne}:${e.type}:${e.detail}`)

describe('lexer — les accolades ne se comptent que dans le code', () => {
  it('blanchit chaînes, gabarits, regex et commentaires ; garde le code des `${…}`', () => {
    const s = src(
      "const a = '{ pas une accolade'",
      'const b = `texte { ${ f({ x: 1 }) } texte }`',
      'const c = /[{}]\\/\\//.test(a) // { commentaire',
      'const d = amount! / surface! / 2',
      '/* { */ const e = { ok: true }',
    )
    const { code, masque } = lex(s)
    expect(masque.length).toBe(s.length)
    expect(masque.split('\n').length).toBe(s.split('\n').length)
    const compte = (c: string): number => masque.split(c).length - 1
    expect(compte('{')).toBe(compte('}'))
    expect(compte('(')).toBe(compte(')'))
    // Ce qui reste compté : le `${`, l'objet passé à `f` dans le gabarit, et l'objet final.
    expect(compte('{')).toBe(3)
    expect(masque).toContain('f({ x: 1 })')
    expect(masque).not.toContain('pas une accolade')
    expect(code).toContain("'{ pas une accolade'") // la vue `code` garde les chaînes
    expect(code).not.toContain('commentaire')
    // `amount! / surface!` est une division : lu comme une regex, il avalait la ligne.
    expect(masque.split('\n')[3]).toContain('surface!')
  })
})

describe('corpsGestionnaire — le callback de serve( / Deno.serve(', () => {
  const corps = (s: string): string | null => {
    const { masque } = lex(s)
    const g = gestionnaire(masque)
    return g ? s.slice(g.debut, g.fin).trim() : null
  }
  it('lit les formes du dépôt, et quelques voisines', () => {
    expect(corps('serve(async (req) => { return ok(req) })')).toBe('return ok(req)')
    expect(corps('Deno.serve(async (req: Request): Promise<Response> => {\n  return ok(req)\n})')).toBe('return ok(req)')
    expect(corps('Deno.serve({ port: 8000 }, async (req) => { return ok(req) })')).toBe('return ok(req)')
    expect(corps('async function traiter(req: Request) { return ok(req) }\nserve(traiter)')).toBe('return ok(req)')
  })
  it('refuse ce qu’il ne sait pas lire — aucun appel, ou deux', () => {
    expect(corps('export const x = 1')).toBeNull()
    expect(corps('serve(async (a) => { return 1 })\nserve(async (b) => { return 2 })')).toBeNull()
  })
})

describe('ordre — la première garde doit précéder le premier effet', () => {
  it('écriture AVANT la garde → rouge, à la bonne ligne', () => {
    const o = ordre(index(
      "await admin.from('journal').insert({ vu: true })",
      'const auth = await requireAgentAuth(req, cors)',
    ))
    expect(o.lisible).toBe(true)
    expect(vus(o)).toEqual(['4:ecriture:journal.insert'])
    expect(o.garde).toMatchObject({ type: 'requireAgentAuth', ligne: 5 })
  })

  it('garde AVANT l’écriture → vert — même source, lignes échangées', () => {
    const o = ordre(index(
      'const auth = await requireAgentAuth(req, cors)',
      "await admin.from('journal').insert({ vu: true })",
    ))
    expect(o.effets).toEqual([])
    expect(o.garde).toMatchObject({ type: 'requireAgentAuth', ligne: 4 })
  })

  it('un helper DÉCLARÉ au-dessus du gestionnaire qui écrit → vert ; APPELÉ avant la garde → rouge', () => {
    const avec = (appelAvant: boolean): string => src(
      'async function journaliser(db) {',
      "  await db.from('journal').insert({ vu: true })",
      '}',
      'serve(async (req) => {',
      ...(appelAvant ? ['  await journaliser(admin)'] : []),
      '  const auth = await requireAgentAuth(req, cors)',
      ...(appelAvant ? [] : ['  await journaliser(auth.supabase)']),
      '})',
    )
    const apres = avec(false)
    // Le cas est réel : dans le FICHIER, l'écriture précède la garde. Seul le gestionnaire compte.
    expect(apres.indexOf('.insert(')).toBeLessThan(apres.indexOf('requireAgentAuth('))
    expect(ordre(apres).effets).toEqual([])
    const o = ordre(avec(true))
    expect(vus(o)).toEqual(['2:ecriture:journal.insert'])
    expect(o.effets[0].via).toEqual([{ nom: 'journaliser', chemin: F, ligne: 5 }])
  })

  it('déroule un helper de `_shared/` importé — l’effet est rapporté avec son chemin', () => {
    const partage = 'supabase/functions/_shared/journal.ts'
    const fichiers = (appelAvant: boolean): Record<string, string> => ({
      [partage]: src('export async function journaliser(db) {', "  await db.from('journal').insert({})", '}'),
      [F]: src(
        "import { journaliser } from '../_shared/journal.ts'",
        'serve(async (req) => {',
        ...(appelAvant ? ['  await journaliser(admin)'] : []),
        '  const auth = await requireAgentAuth(req, cors)',
        ...(appelAvant ? [] : ['  await journaliser(auth.supabase)']),
        '})',
      ),
    })
    const { modules: m1, analyse: a1 } = analyser(fichiers(true))
    const o = a1.ordreGestionnaire(m1.get(F) as Module)
    expect(o.effets).toHaveLength(1)
    expect(o.effets[0]).toMatchObject({ type: 'ecriture', chemin: partage, ligne: 2 })
    expect(o.effets[0].via).toEqual([{ nom: 'journaliser', chemin: F, ligne: 3 }])
    const { modules: m2, analyse: a2 } = analyser(fichiers(false))
    expect(a2.ordreGestionnaire(m2.get(F) as Module).effets).toEqual([])
  })

  it('une garde portée par un helper local compte À L’APPEL — et un helper jamais appelé ne garde rien', () => {
    const o = ordre(src(
      'async function autoriser(req) { return await isServiceSecret(admin, req) }',
      'serve(async (req) => {',
      "  if (!(await autoriser(req))) return new Response('non', { status: 401 })",
      "  await admin.from('t').insert({})",
      '})',
    ))
    expect(o.effets).toEqual([])
    expect(o.garde).toMatchObject({ type: 'isServiceSecret', via: [{ nom: 'autoriser', ligne: 3 }] })

    const jamais = ordre(src(
      'async function jamaisAppelee(req) { return await requireAgentAuth(req, cors) }',
      "serve(async (req) => { return new Response('ok') })",
    ))
    expect(jamais.garde).toBeNull()
  })

  it('un appel à arguments de TYPE (`ecrire<Client>(…)`) reste un appel — pas une comparaison `a < b > (c)`', () => {
    const avec = (appelAvant: boolean): Ordre => ordre(src(
      'async function ecrire<T>(db: T): Promise<void> {',
      "  await db.from('t').insert({})",
      '}',
      'serve(async (req) => {',
      // Avant la garde : lue comme un appel d'`ecrire`, cette comparaison rougirait le cas vert.
      '  if (ecrire < limite > (seuil)) return null',
      ...(appelAvant ? ['  await ecrire<Client>(admin)'] : []),
      '  const auth = await requireAgentAuth(req, cors)',
      ...(appelAvant ? [] : ['  await ecrire<Client>(auth.supabase)']),
      '})',
    ))
    expect(avec(false).effets).toEqual([])
    const o = avec(true)
    expect(vus(o)).toEqual(['2:ecriture:t.insert'])
    expect(o.effets[0].via).toEqual([{ nom: 'ecrire', chemin: F, ligne: 6 }])
  })

  it('une fonction NOMMÉE dans le gestionnaire ne s’exécute qu’appelée ; une ANONYME passée en argument, sur place', () => {
    const nommee = (appelAvant: boolean): Ordre => ordre(index(
      "const noter = async () => { await admin.from('t').insert({}) }",
      ...(appelAvant ? ['await noter()'] : []),
      'const auth = await requireAgentAuth(req, cors)',
      ...(appelAvant ? [] : ['await noter()']),
    ))
    expect(nommee(false).effets).toEqual([])
    expect(vus(nommee(true))).toEqual(['4:ecriture:t.insert'])

    const anonyme = ordre(index(
      "await Promise.all(ids.map(async (id) => { await admin.from('t').delete().eq('id', id) }))",
      'const auth = await requireAgentAuth(req, cors)',
    ))
    expect(vus(anonyme)).toEqual(['4:ecriture:t.delete'])
  })

  it('voit chaque TYPE d’effet, et les cas couvrent les sept de TYPES_EFFET', () => {
    const cas: Array<[string, string, string]> = [
      ["await admin.from('a').insert({})", 'ecriture', 'a.insert'],
      ["await admin.from('b').upsert({})", 'ecriture', 'b.upsert'],
      ["await admin\n    .from('c')\n    .update({ x: 1 })\n    .eq('id', 1)", 'ecriture', 'c.update'],
      ["let q = admin.from('d').select('id')\n  await q.delete()", 'ecriture', 'q.delete'],
      ["await admin.storage.from('docs').upload('p', f)", 'stockage', 'storage(docs).upload'],
      ["await admin.storage.from('docs').remove(['p'])", 'stockage', 'storage(docs).remove'],
      ['await admin.auth.admin.deleteUser(id)', 'auth', 'auth.admin.deleteUser'],
      ["await admin.rpc('ecrire_quelque_chose', {})", 'rpc', 'ecrire_quelque_chose'],
      ['await admin.rpc(nomDynamique, {})', 'rpc', '(nom dynamique)'],
      ["await fetch('https://api.resend.com/emails', { method: 'POST' })", 'envoi-email', 'api.resend.com'],
      ["await admin.auth.admin.inviteUserByEmail('a@b.ch')", 'auth', 'auth.admin.inviteUserByEmail'],
      ['await fetch(`https://graph.facebook.com/v19.0/${id}/messages`, { method: \'POST\' })', 'envoi-whatsapp', 'graph.facebook.com'],
      ["await fetch(`${BASE}/functions/v1/send-email`, { method: 'POST' })", 'invocation', 'send-email'],
      ["await admin.functions.invoke('kyc-screening', { body: {} })", 'invocation', 'kyc-screening'],
    ]
    for (const [ligne, type, detail] of cas) {
      const o = ordre(index(ligne, 'const auth = await requireAgentAuth(req, cors)'))
      expect(o.effets[0], ligne).toMatchObject({ type, detail })
    }
    // Aucun type n'est muet par construction : chacun a son cas.
    expect(new Set(cas.map((c) => c[1]))).toEqual(new Set(TOUS_LES_TYPES))
  })

  it('ne voit PAS d’effet dans une lecture, un homonyme, un commentaire ou une chaîne — contrôle positif en dernière ligne', () => {
    const o = ordre(index(
      'cache.delete(cle)',
      'hash.update(octets)',
      "headers.delete('x-trace')",
      "url.searchParams.delete('token')",
      'await admin.auth.admin.getUserById(id)',
      "await admin.from('t').select('*').eq('id', 1)",
      "await admin.rpc('lire_quelque_chose', {})",
      "await fetch('https://api.stripe.com/v1/prices')",
      "// await admin.from('t').insert({})",
      "const aide = \"admin.from('t').insert({})\"",
      "await admin.from('vu').insert({})",
      'const auth = await requireAgentAuth(req, cors)',
    ), [], { rpcLecture: ['lire_quelque_chose'] })
    expect(vus(o)).toEqual(['14:ecriture:vu.insert'])
  })

  it('une RPC n’est une lecture que si la porte la nomme — la même, non nommée, est un effet', () => {
    const s = index("await admin.rpc('lire_quelque_chose', {})", 'const auth = await requireAgentAuth(req, cors)')
    expect(ordre(s, [], { rpcLecture: ['lire_quelque_chose'] }).effets).toEqual([])
    expect(vus(ordre(s))).toEqual(['4:rpc:lire_quelque_chose'])
  })

  it('une garde SUR MESURE (jeton résolu en base) est une garde là où elle est écrite', () => {
    const s = index(
      "const { data: inv } = await admin.from('team_invitations').select('id').eq('token', body.token).single()",
      "await admin.from('team_invitations').update({ status: 'expired' }).eq('id', inv.id)",
      'const { data: { user } } = await client.auth.getUser()',
    )
    expect(ordre(s, [".eq('token', body.token)", 'auth.getUser']).effets).toEqual([])
    // Sans le marqueur du jeton, l'expiration précède `auth.getUser` : rouge.
    expect(vus(ordre(s, ['auth.getUser']))).toEqual(['5:ecriture:team_invitations.update'])
  })

  it('un marqueur en forme d’identifiant est lu BORNÉ : `safeEqual` n’est pas dans `timingSafeEqual`', () => {
    const avec = (verif: string): Ordre => ordre(index(`if (!${verif}(a, b)) return refus()`, "await admin.from('t').insert({})"), ['safeEqual'])
    expect(avec('safeEqual').effets).toEqual([])
    expect(vus(avec('timingSafeEqual'))).toEqual(['5:ecriture:t.insert'])
  })

  it('une garde CITÉE (commentaire, chaîne) ne garde rien', () => {
    const o = ordre(index(
      '// const auth = await requireAgentAuth(req, cors)',
      "const note = 'requireAgentAuth(req, cors)'",
      "await admin.from('t').insert({})",
    ))
    expect(vus(o)).toEqual(['6:ecriture:t.insert'])
    expect(o.garde).toBeNull()
  })
})

describe('verdictOrdre — exemptions, fonctions ouvertes, gardes non atteintes', () => {
  const fichiers = {
    'supabase/functions/fautive/index.ts': index("await admin.from('t').insert({})", 'await requireAgentAuth(req, cors)'),
    'supabase/functions/saine/index.ts': index('await requireAgentAuth(req, cors)', "await admin.from('t').insert({})"),
    'supabase/functions/ouverte/index.ts': index("await admin.from('log').insert({})"),
    'supabase/functions/sourde/index.ts': src('async function g(req) { return requireAgentAuth(req, c) }', "serve(async (req) => { return new Response('ok') })"),
  }
  const { modules, analyse } = analyser(fichiers)
  const fonctions = new Map([...modules].map(([chemin, m]) => [chemin.split('/')[2], m]))

  it('rougit la fautive et la sourde, saute l’ouverte', () => {
    const v = juger({ analyse, fonctions, ouvertes: ['ouverte'] })
    expect(v.lus).toBe(3)
    expect(v.violations.map((x) => x.dir)).toEqual(['fautive'])
    expect(v.gardesNonAtteintes).toEqual(['sourde'])
    // Contrôle positif : sans la déclaration d'ouverture, l'ouverte rougit aussi.
    expect(juger({ analyse, fonctions }).violations.map((x) => x.dir)).toEqual(['fautive', 'ouverte'])
  })

  it('une exemption TEMPORAIRE tolère sa fonction ; périmée (plus de faute, ou plus de fonction), elle rougit', () => {
    const v = juger({ analyse, fonctions, ouvertes: ['ouverte'], exemptions: { fautive: {}, saine: {}, disparue: {} } })
    expect(v.violations).toEqual([])
    expect(v.exemptees).toEqual(['fautive'])
    expect(v.exemptionsPerimees.sort()).toEqual(['disparue', 'saine'])
  })
})

describe('chargement — ce qui s’exécute avant toute requête', () => {
  it('voit un effet de premier niveau, direct ou par un helper ; pas le corps d’une classe ni d’un objet', () => {
    const { modules, analyse } = analyser({
      [F]: src(
        "import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'",
        "await admin.from('demarrage').insert({})",
        "async function amorcer() { await admin.from('amorce').insert({}) }",
        'await amorcer()',
        "class Journal { async ecrire() { await admin.from('j').insert({}) } }",
        "const outils = { async noter() { await admin.from('k').insert({}) } }",
        'serve(async (req) => { await requireAgentAuth(req, cors) })',
      ),
    })
    const e = analyse.effetsAuChargement(modules.get(F) as Module)
    expect(e.map((x) => `${x.ligne}:${x.detail}`)).toEqual(['2:demarrage.insert', '3:amorce.insert'])
    expect(e[1].via[0]).toMatchObject({ nom: 'amorcer', ligne: 4 })
  })

  it('⛔ une liste d’import ne passe aucune fonction par son nom (29 faux effets à la première mesure)', () => {
    const { modules, analyse } = analyser({
      'supabase/functions/_shared/x.ts': src(
        "export async function a(db) { await db.from('a').insert({}) }",
        "export async function b(db) { await db.from('b').insert({}) }",
        "export async function c(db) { await db.from('c').insert({}) }",
      ),
      [F]: src("import { a, b, c } from '../_shared/x.ts'", 'serve(async (req) => { await requireAgentAuth(req, k); await b(req) })'),
    })
    expect(analyse.effetsAuChargement(modules.get(F) as Module)).toEqual([])
    // Contrôle positif : la même fonction, PASSÉE en argument au premier niveau, s'exécute.
    const { modules: m2, analyse: a2 } = analyser({
      'supabase/functions/_shared/x.ts': src("export async function b(db) { await db.from('b').insert({}) }"),
      [F]: src("import { b } from '../_shared/x.ts'", 'await Promise.all([admin].map(b))', 'serve(async (req) => { await requireAgentAuth(req, k) })'),
    })
    expect(a2.effetsAuChargement(m2.get(F) as Module).map((x) => x.detail)).toEqual(['b.insert'])
  })
})

describe('expéditeurs — qui envoie un e-mail, et ce qui borne le destinataire', () => {
  const relais = index('await requireAgentAuth(req, cors)', "await fetch('https://api.resend.com/emails', { method: 'POST', body: JSON.stringify({ to: body.to }) })")
  const garde = index(
    'const auth = await requireAgentAuth(req, cors)',
    'const refus = await guardOutboundEmail(admin, ctx, intent, cors)',
    'if (refus) return refus',
    "await fetch('https://api.resend.com/emails', { method: 'POST' })",
  )
  const gardeTardive = index(
    'const auth = await requireAgentAuth(req, cors)',
    "await fetch('https://api.resend.com/emails', { method: 'POST' })",
    'await guardOutboundEmail(admin, ctx, intent, cors)',
  )

  it('lit le canal et le premier de « périmètre » ou « envoi » — l’ordre compte', () => {
    const exp = (s: string): Expedition => {
      const { modules, analyse } = analyser({ [F]: s })
      return analyse.expeditionGestionnaire(modules.get(F) as Module)
    }
    expect([...exp(relais).canaux]).toEqual(['resend'])
    expect(exp(relais).premier).toMatchObject({ genre: 'effet', type: 'envoi-email' })
    expect(exp(garde).premier).toMatchObject({ genre: 'perimetre', ligne: 5 })
    expect(exp(gardeTardive).premier).toMatchObject({ genre: 'effet', ligne: 5 })
  })

  it('suit un envoi de `_shared/` dont l’URL est une CONSTANTE du module ; un import jamais appelé n’envoie rien', () => {
    const partage = 'supabase/functions/_shared/envoi.ts'
    const fichiers = (appel: string): Record<string, string> => ({
      [partage]: src(
        "const RESEND_URL = 'https://api.resend.com/emails'",
        'export async function envoyer(to) {',
        "  return fetch(RESEND_URL, { method: 'POST', body: JSON.stringify({ to }) })",
        '}',
      ),
      [F]: src("import { envoyer } from '../_shared/envoi.ts'", 'serve(async (req) => {', '  await requireAgentAuth(req, cors)', `  ${appel}`, '})'),
    })
    const { modules, analyse } = analyser(fichiers("await envoyer('a@b.ch')"))
    const e = analyse.expeditionGestionnaire(modules.get(F) as Module)
    expect([...e.canaux]).toEqual(['resend'])
    expect(e.premier).toMatchObject({ chemin: partage, ligne: 3, via: [{ nom: 'envoyer', ligne: 4 }] })
    const { modules: m2, analyse: a2 } = analyser(fichiers('// envoyer() retiré'))
    expect(a2.expeditionGestionnaire(m2.get(F) as Module).canaux.size).toBe(0)
  })

  it('un canal NOMMÉ (la boîte de l’agent) et un envoi de GoTrue sont des e-mails', () => {
    const gmail = 'supabase/functions/_shared/mail/gmail.ts'
    const canal: CanalNomme = { module: gmail, nom: 'gmailSend', type: 'envoi-email', canal: 'boite', marqueur: "'/messages/send'" }
    const { modules, analyse } = analyser({
      [gmail]: src("export async function gmailSend(token, raw) { return gcall(token, '/messages/send', { raw }) }"),
      [F]: src("import { gmailSend } from '../_shared/mail/gmail.ts'", 'serve(async (req) => {', '  await requireAgentAuth(req, cors)', '  await gmailSend(t, raw)', "  await admin.auth.admin.inviteUserByEmail('a@b.ch')", '})'),
    }, { canauxNommes: [canal] })
    expect([...analyse.expeditionGestionnaire(modules.get(F) as Module).canaux].sort()).toEqual(['auth', 'boite'])
    expect(canalPerime(modules, canal)).toBeNull()
    expect(canalPerime(modules, { ...canal, marqueur: "'/messages/envoyer'" })).toMatch(/ne porte plus/)
    expect(canalPerime(modules, { ...canal, nom: 'gmailEnvoyer' })).toMatch(/n'y est plus définie/)
  })

  describe('verdictExpediteurs — la table fermée', () => {
    const { modules, analyse } = analyser({
      'supabase/functions/relais/index.ts': relais,
      'supabase/functions/garde/index.ts': garde,
      'supabase/functions/muet/index.ts': index('await requireAgentAuth(req, cors)', "await admin.from('t').insert({})"),
    })
    const fonctions = new Map([...modules].map(([chemin, m]) => [chemin.split('/')[2], m]))
    const table = (perimetres: Record<string, { canaux: string[] }>): VerdictExpediteurs => inventorier({ analyse, fonctions, perimetres })

    it('expéditeur NON LISTÉ → rouge ; listé → vert ; celui qui passe par la garde n’a pas besoin d’entrée', () => {
      const vide = table({})
      expect(vide.expediteurs.map((x) => `${x.dir}:${x.parPerimetre}`).sort()).toEqual(['garde:true', 'relais:false'])
      expect(vide.sansPerimetre.map((x) => x.dir)).toEqual(['relais'])
      const pleine = table({ relais: { canaux: ['resend'] } })
      expect([pleine.sansPerimetre, pleine.superflus, pleine.perimes, pleine.canauxChanges]).toEqual([[], [], [], []])
    })

    it('entrée PÉRIMÉE → rouge : fonction disparue, ou qui n’envoie plus', () => {
      const v = table({ relais: { canaux: ['resend'] }, muet: { canaux: ['resend'] }, disparue: { canaux: ['resend'] } })
      expect(v.perimes).toEqual([
        { dir: 'muet', raison: "n'envoie plus aucun e-mail" },
        { dir: 'disparue', raison: "la fonction n'existe plus" },
      ])
    })

    it('entrée SUPERFLUE (la garde juge déjà) et CANAL changé → rouge', () => {
      expect(table({ relais: { canaux: ['resend'] }, garde: { canaux: ['resend'] } }).superflus).toEqual(['garde'])
      expect(table({ relais: { canaux: ['boite'] } }).canauxChanges).toEqual([{ dir: 'relais', declares: ['boite'], atteints: ['resend'] }])
    })
  })
})

describe('volatilitesSql — « cette RPC ne fait que lire » se vérifie dans le schéma', () => {
  const migrations = [
    { fichier: '0001.sql', sql: src(
      '-- create function public.leurre() returns int language sql stable as $$ select 1 $$;',
      "create or replace function public.lire(p uuid) returns jsonb language sql stable security definer set search_path = '' as $$",
      "  select jsonb_build_object('mot', 'volatile') -- un mot dans le CORPS ne compte pas",
      '$$;',
      'create function public.ecrire() returns void language plpgsql as $fn$ begin insert into t values (1); end $fn$;',
      'CREATE OR REPLACE FUNCTION "public"."vidage"("p" "uuid") RETURNS "jsonb"',
      '    LANGUAGE "sql" IMMUTABLE',
      '    AS $$ select 1 $$;',
      'create function autre_schema.lire() returns int language sql stable as $$ select 1 $$;',
    ) },
    { fichier: '0002.sql', sql: src(
      'create or replace function public.ecrire() returns void language sql stable as $$ select 1 $$;',
      'alter function public.vidage(uuid) volatile;',
      'drop function if exists public.lire(uuid), public.inexistante();',
    ) },
  ]

  it('lit la volatilité déclarée ; la dernière définition l’emporte ; alter et drop suivent', () => {
    const v = volatilites(migrations)
    expect(v.get('ecrire')).toEqual({ volatilite: 'stable', fichier: '0002.sql' })
    expect(v.get('vidage')).toEqual({ volatilite: 'volatile', fichier: '0002.sql' })
    expect(v.has('lire')).toBe(false) // détruite
    expect(v.has('leurre')).toBe(false) // commentée
    // Contrôle positif : avant la migration 0002, `lire` était STABLE malgré le mot du corps.
    const avant = volatilites([migrations[0]])
    expect(avant.get('lire')?.volatilite).toBe('stable')
    expect(avant.get('ecrire')?.volatilite).toBe('volatile') // aucune clause : défaut de Postgres
    expect(avant.get('vidage')?.volatilite).toBe('immutable')
  })

  it('lecturesRpcInvalides — introuvable, volatile, ou plus appelée : trois refus distincts', () => {
    const v = volatilites([migrations[0]])
    const code = [{ code: "await db.rpc('lire', {})\nawait db.rpc('ecrire')" }]
    expect(lecturesInvalides(['lire'], v, code)).toEqual([])
    expect(lecturesInvalides(['absente'], v, code)[0].raison).toMatch(/introuvable/)
    expect(lecturesInvalides(['ecrire'], v, code)[0].raison).toMatch(/VOLATILE/)
    expect(lecturesInvalides(['vidage'], v, code)[0].raison).toMatch(/plus aucune source/)
  })
})

describe('le dépôt RÉEL', () => {
  const FONCTIONS = repoPath('supabase', 'functions')

  function lireDepot(remplacer: Record<string, (s: string) => string> = {}): Map<string, Module> {
    const modules = new Map<string, Module>()
    const ajouter = (chemin: string, abs: string): void => {
      const brut = readFileSync(abs, 'utf8')
      modules.set(chemin, lire(remplacer[chemin] ? remplacer[chemin](brut) : brut, chemin))
    }
    for (const d of readdirSync(FONCTIONS).sort()) {
      if (d === '_shared') continue
      try { ajouter(`supabase/functions/${d}/index.ts`, join(FONCTIONS, d, 'index.ts')) } catch { /* pas d'index.ts */ }
    }
    const marcher = (dir: string, relatif: string): void => {
      for (const e of readdirSync(dir).sort()) {
        const p = join(dir, e)
        if (statSync(p).isDirectory()) marcher(p, `${relatif}/${e}`)
        else if (e.endsWith('.ts') && !e.endsWith('.test.ts')) ajouter(`${relatif}/${e}`, p)
      }
    }
    marcher(join(FONCTIONS, '_shared'), 'supabase/functions/_shared')
    return modules
  }
  const regles: Regles = { gardes: GARDES, rpcLecture: ['get_onboarding_call_by_token'], canauxNommes: [...CANAUX] }
  const reel = lireDepot()
  const analyse = creer(reel, regles)
  const indexDe = (fn: string, modules = reel): Module => modules.get(`supabase/functions/${fn}/index.ts`) as Module
  const fonctions = new Map([...reel].filter(([c]) => /^supabase\/functions\/[^_][^/]*\/index\.ts$/.test(c)).map(([c, m]) => [c.split('/')[2], m]))

  it('isole le gestionnaire de CHAQUE fonction — sur 80 au moins', () => {
    expect(fonctions.size, 'balayage suspect : trop peu de fonctions lues').toBeGreaterThanOrEqual(80)
    const illisibles = [...fonctions].filter(([, m]) => gestionnaire(m.masque) === null).map(([d]) => d)
    expect(illisibles).toEqual([])
  })

  it('CONTRÔLE POSITIF — une vraie garde déplacée en mémoire après une vraie écriture rougit', () => {
    const chemin = 'supabase/functions/admin-agency-lifecycle/index.ts'
    expect(analyse.ordreGestionnaire(indexDe('admin-agency-lifecycle')).effets).toEqual([])
    const garde = '    const auth = await requireSuperAdmin(req, corsHeaders)\n    if (auth instanceof Response) return auth\n    const { user: admin, supabase } = auth\n'
    const ancre = '    if (statusErr) throw statusErr\n'
    const mute = lireDepot({ [chemin]: (s) => {
      expect(s, 'la garde réelle a changé de forme : mettre à jour la mutation').toContain(garde)
      return s.replace(garde, '').replace(ancre, ancre + garde)
    } })
    const o = creer(mute, regles).ordreGestionnaire(indexDe('admin-agency-lifecycle', mute))
    expect(o.effets[0]).toMatchObject({ type: 'ecriture', detail: 'agencies.update', chemin })
    expect(o.garde?.type).toBe('requireSuperAdmin')
  })

  it('les deux constats de la première mesure tiennent à la garde NOMMÉE, pas à une exemption', () => {
    // accept-team-invite : le jeton d'invitation résolu en base précède l'expiration.
    const accept = indexDe('accept-team-invite')
    expect(analyse.ordreGestionnaire(accept, [".eq('token', body.token)", 'auth.getUser']).effets).toEqual([])
    expect(analyse.ordreGestionnaire(accept, ['auth.getUser']).effets.map((e) => e.detail)).toEqual(['team_invitations.update'])
    // onboarding-slots : la résolution du jeton de gestion est une RPC STABLE.
    expect(analyse.ordreGestionnaire(indexDe('onboarding-slots')).effets).toEqual([])
    const sansLecture = creer(reel, { ...regles, rpcLecture: [] })
    expect(sansLecture.ordreGestionnaire(indexDe('onboarding-slots')).effets.map((e) => e.detail)).toEqual(['get_onboarding_call_by_token'])
  })

  it('l’inventaire des expéditeurs vient du code : les deux gardés, et tous les autres sans table', () => {
    const vide = inventorier({ analyse, fonctions, perimetres: {} })
    const parGarde = vide.expediteurs.filter((x) => x.parPerimetre).map((x) => x.dir).sort()
    // Les deux expéditeurs pilotés par un agent (tests/unit/email-senders-scope.spec.ts) —
    // trois jusqu'au 21.09.2026 : `send-property-email` est parti, le matching reste chez l'agent.
    expect(parGarde).toEqual(['send-email', 'send-relance-email'])
    // Contrôle positif : sans table, chaque autre expéditeur rougit — le lecteur n'est pas muet.
    expect(vide.sansPerimetre.length).toBeGreaterThanOrEqual(15)
    const canaux = Object.fromEntries(vide.expediteurs.map((x) => [x.dir, x.canaux.join()]))
    expect(canaux['mail-send']).toBe('boite')                 // canal nommé
    expect(canaux['appointment-book']).toBe('resend')         // `fetch(RESEND_URL)` dans _shared/booking-email.ts
    expect(canaux['whatsapp-webhook']).toBe('resend')         // quatre appels de profondeur
    // La table construite sur l'inventaire est verte ; une entrée en moins rougit, une en trop aussi.
    const table = Object.fromEntries(vide.sansPerimetre.map((x) => [x.dir, { canaux: x.canaux }]))
    const pleine = inventorier({ analyse, fonctions, perimetres: table })
    expect([pleine.sansPerimetre, pleine.perimes, pleine.superflus, pleine.canauxChanges]).toEqual([[], [], [], []])
    const amputee = Object.fromEntries(Object.entries(table).filter(([d]) => d !== 'weekly-report'))
    expect(inventorier({ analyse, fonctions, perimetres: amputee }).sansPerimetre.map((x) => x.dir)).toEqual(['weekly-report'])
    expect(inventorier({ analyse, fonctions, perimetres: { ...table, 'send-visit-emails': { canaux: ['resend'] } } }).perimes.map((x) => x.dir)).toEqual(['send-visit-emails'])
  })

  it('la relance du « oui » WhatsApp est un envoi GARDÉ, vu à travers l’exécuteur', () => {
    // `whatsapp-webhook` est jugé sur son PREMIER envoi — l'invitation d'opt-in, que couvre
    // PERIMETRES_EXPEDITEURS. La relance du « oui » vient après, et elle appelait jusqu'au
    // 14.09.2026 l'edge send-relance-email (401) : une invocation, pas un envoi. Une sonde qui
    // n'appelle qu'elle montre que la porte la voit désormais, précédée de guardOutboundEmail.
    const chemin = 'supabase/functions/sonde-oui/index.ts'
    const sonde = lire(src(
      "import { executeSendClientEmail } from '../_shared/whatsapp-actions.ts'",
      "import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'",
      'serve(async (req) => {',
      '  return new Response(await executeSendClientEmail(ctx, args))',
      '})',
    ), chemin)
    const exp = creer(new Map([...reel, [chemin, sonde]]), regles).expeditionGestionnaire(sonde)
    expect([...exp.canaux]).toEqual(['resend'])
    expect(exp.premier).toMatchObject({ genre: 'perimetre', type: 'guardOutboundEmail', chemin: 'supabase/functions/_shared/relance-email-send.ts' })
    expect(exp.premier?.via.map((v) => v.nom)).toEqual(['executeSendClientEmail', 'sendRelanceEmail'])
  })

  it('aucun module ne s’exécute avec un effet au chargement', () => {
    const fautes = [...reel.values()].flatMap((m) => analyse.effetsAuChargement(m).map((e) => `${e.chemin}:${e.ligne} ${e.detail}`))
    expect(fautes).toEqual([])
  })

  it('la volatilité réelle distingue une lecture d’une écriture', () => {
    const dir = repoPath('supabase', 'migrations')
    const v = volatilites(readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => ({ fichier: f, sql: readFileSync(join(dir, f), 'utf8') })))
    expect(v.get('get_onboarding_call_by_token')?.volatilite).toBe('stable')
    expect(v.get('email_send_quota_take')?.volatilite).toBe('volatile') // elle PREND une place de quota
  })

  it('la porte elle-même passe, et dit ce qu’elle a lu', () => {
    const sortie = execFileSync('node', ['scripts/check-edge-auth.mjs'], { cwd: repoPath(), encoding: 'utf8' })
    expect(sortie).toMatch(/✓ Ordre garde → effet : \d+ gestionnaire\(s\) lus, aucun effet avant leur première garde/)
    expect(sortie).toMatch(/✓ Expéditeurs e-mail : \d+ fonction\(s\) envoient — 2 par guardOutboundEmail, \d+ au périmètre nommé/)
  })
})
