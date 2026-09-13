/**
 * Le lecteur des passes « secret » de `lint:edge-auth`, éprouvé.
 *
 * POURQUOI CE BANC. Audit du 13.09.2026, point S8 : quatre edge functions comparaient la
 * clé de service par un `===` nu, et `weekly-report` acceptait le rôle super_admin sans
 * l'allowlist d'e-mail — la porte les laissait passer. Son nouveau lecteur
 * (`scripts/_shared/edge-secret-compare.mjs`) est une heuristique par motifs : sans banc,
 * il ne prouverait que l'absence des formes qu'il sait lire.
 *
 * Deux disciplines :
 *   · les cas POSITIFS reprennent mot pour mot les lignes fautives d'avant le correctif —
 *     c'est la forme sous laquelle le défaut a réellement existé ;
 *   · chaque NÉGATIF partage sa source avec un positif, qui doit, lui, être vu : un lecteur
 *     qui rendrait `[]` partout échoue ici au lieu d'y paraître prudent.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { repoPath } from './helpers/fs-scan'
// @ts-expect-error — helper Node de `scripts/` : pas de types, et c'est voulu (CLAUDE.md §4).
import { trouverComparaisonsSecretes, appelle, helpersLocauxDefinis, HELPERS_LOCAUX_TOLERES, REGLES } from '../../scripts/_shared/edge-secret-compare.mjs'

interface Hit { ligne: number; regle: string; texte: string }

// Le module n'a pas de types : on les pose ici, une fois, au lieu de laisser fuir `any`.
const trouver = trouverComparaisonsSecretes as (source: string, options?: { chemin?: string }) => Hit[]
const appel = appelle as (source: string, nom: string) => boolean
const definis = helpersLocauxDefinis as (source: string) => string[]
const TOLERES = HELPERS_LOCAUX_TOLERES as ReadonlyArray<readonly [string, string]>
const TOUTES_LES_REGLES = REGLES as readonly string[]

const src = (...lignes: string[]): string => lignes.join('\n')
const vus = (source: string, chemin?: string): string[] =>
  trouver(source, { chemin }).map((h) => `${h.ligne}:${h.regle}`)

describe('egalite-brute — `===` accolé à un secret', () => {
  it('voit les trois formes RÉELLES d’avant S8, à la bonne ligne', () => {
    const s = src(
      "const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''",
      "const authHeader = req.headers.get('authorization') || ''",
      'if (serviceRoleKey.length > 0 && authHeader === `Bearer ${serviceRoleKey}`) {', // magic-link-send-email:59
      '  return { mode: \'service_role\' }',
      '}',
      "const isServiceRole = token !== '' && token === serviceRoleKey",               // matching-engine:63
      'if (cronSecret && expectedCronSecret && cronSecret === expectedCronSecret) {', // weekly-report:26
    )
    const hits = trouver(s)
    expect(vus(s)).toEqual(expect.arrayContaining(['3:egalite-brute', '6:egalite-brute', '7:egalite-brute']))
    // Le texte rapporté est la ligne du fichier : c'est ce que la porte imprime.
    expect(hits.find((h) => h.ligne === 3)?.texte).toContain('authHeader === `Bearer ${serviceRoleKey}`')
  })

  it('voit une lecture d’environnement écrite SUR PLACE, dans les deux sens', () => {
    const s = src(
      "if (h === Deno.env.get('CRON_SECRET')) return true",
      "if (Deno.env.get('STRIPE_WEBHOOK_SECRET') !== sig) return false",
    )
    expect(vus(s)).toEqual(expect.arrayContaining(['1:egalite-brute', '2:egalite-brute']))
  })

  it('ne confond pas un TÉMOIN DE PRÉSENCE avec une comparaison — contrôle positif en ligne 1', () => {
    const s = src(
      'if (authHeader === `Bearer ${serviceRoleKey}`) return ok',  // vu : le contrôle positif
      "if (serviceRoleKey !== '') { /* clé posée */ }",
      'if (serviceRoleKey.length > 0) { /* idem */ }',
      "if (typeof serviceRoleKey === 'string') { /* type */ }",
      'if (CRON_SECRET === undefined || CRON_SECRET == null) { /* absente */ }',
    )
    expect(vus(s)).toEqual(['1:egalite-brute'])
  })

  it('ignore les commentaires et les NOMS de clé de configuration — contrôle positif en ligne 4', () => {
    const s = src(
      '// autrefois : authHeader === `Bearer ${key}` — ne plus écrire ça',
      '/* if (h === serviceRoleKey) … */',
      "const { data } = await admin.from('app_config').select('value').eq('key', 'service_role_key').maybeSingle()",
      'if (h === svcKey) return true',                                // vu
      "if (row.key === 'service_role_key') continue",                 // un NOM, pas le secret
    )
    expect(vus(s)).toEqual(['4:egalite-brute'])
  })
})

describe('egalite-teintee — le nom ne trahit plus rien, la provenance si', () => {
  it('voit une égalité sur un alias déclaré depuis l’environnement', () => {
    const s = src(
      "const k = Deno.env.get('FOO_SECRET')",
      'if (h === k) return true',
    )
    expect(vus(s)).toEqual(['2:egalite-teintee'])
  })

  it('voit une égalité sur une valeur lue avec `service_role_key` sur sa ligne', () => {
    const s = src(
      'const attendu = cfg.service_role_key',
      'const fourni = bearer(req)',
      'if (fourni !== attendu) return refus()',
    )
    expect(vus(s)).toEqual(['3:egalite-teintee'])
  })

  it('ne voit ni présence, ni longueur, ni une variable homonyme en PROPRIÉTÉ — contrôle positif en ligne 5', () => {
    const s = src(
      "const secret = Deno.env.get('HMAC_SECRET')",
      'if (!secret) throw new Error(\'no_secret\')',
      'if (secret.length < 32) throw new Error(\'too_short\')',
      'if (link.secret !== expected) return refus()', // `link.secret` n'est pas la variable teintée
      'if (provided === secret) return ok',          // vu
    )
    expect(vus(s)).toEqual(['5:egalite-teintee'])
  })

  it('un jeton de lien magique n’est pas teinté : `link.token !== token` ne rougit pas — contrôle positif en ligne 3', () => {
    const s = src(
      'const token = url.searchParams.get(\'t\') ?? \'\'',
      'if (link.token !== token) return json({ error: \'invalid\' }, 401)',
      "if (token === Deno.env.get('LEGACY_KEY')) return ok", // vu (égalité brute, sur place)
    )
    expect(vus(s)).toEqual(['3:egalite-brute'])
  })
})

describe('sous-chaine — un préfixe du secret suffirait', () => {
  it('voit startsWith / includes / endsWith appliqués au gabarit, à un secret, ou par le secret', () => {
    const s = src(
      "const k = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!",
      'if (authHeader.startsWith(`Bearer ${serviceRoleKey}`)) return ok',
      'if (header.includes(serviceKey)) return ok',
      'if (k.endsWith(token)) return ok',
      'if (raw.indexOf(k) === 0) return ok',
    )
    expect(vus(s)).toEqual(expect.arrayContaining([
      '2:sous-chaine', '3:sous-chaine', '4:sous-chaine', '5:sous-chaine',
    ]))
  })

  it('laisse passer le préfixe de SCHÉMA `bearer ` et un contrôle de FORMAT de clé — contrôle positif en ligne 3', () => {
    const s = src(
      "const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : ''",
      "if (!svcKey.startsWith('sb_secret_')) console.warn('format de clé inattendu')",
      'if (authHeader.includes(expectedKey)) return ok', // vu
    )
    expect(vus(s)).toEqual(['3:sous-chaine'])
  })
})

describe('helper-local — la copie à temps constant, et sa SOURCE de secret choisie à la main', () => {
  const copie = src(
    'function safeEqual(a: string, b: string): boolean {',
    '  if (a.length !== b.length) return false',
    '  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0',
    '}',
  )

  it('voit une définition nouvelle dans une fonction, et sous une forme fléchée', () => {
    expect(vus(copie, 'supabase/functions/nouvelle-fonction/index.ts')).toEqual(['1:helper-local'])
    const flechee = 'const timingSafeEqual = (a: string, b: string) => a.length === b.length'
    expect(vus(flechee, 'supabase/functions/autre/index.ts')).toEqual(['1:helper-local'])
  })

  it('⛔ voit une copie NOUVELLE même dans _shared/ — l’exemption est par fichier, pas par répertoire', () => {
    expect(vus(copie, 'supabase/functions/_shared/mail/nouveau.ts')).toEqual(['1:helper-local'])
  })

  it('tolère les dix couples nommés, et eux seuls — contrôle positif sur un nom voisin', () => {
    expect(vus(copie, 'supabase/functions/_shared/require-service-secret.ts')).toEqual([])
    expect(vus(copie, 'supabase/functions/weekly-digest/index.ts')).toEqual([])
    // Chemins absolus et séparateurs Windows : même fichier, même tolérance.
    expect(vus(copie, '/depot/supabase/functions/whatsapp-process/index.ts')).toEqual([])
    expect(vus(copie, 'C:\\depot\\supabase\\functions\\learn-agent-style\\index.ts')).toEqual([])
    // Le fichier toléré pour `safeEqual` ne l'est pas pour un AUTRE helper.
    const autre = 'export function constantTimeEqual(a: string, b: string) { return a === b }'
    expect(vus(autre, 'supabase/functions/_shared/require-service-secret.ts')).toEqual(['1:helper-local'])
    // Sans chemin, rien n'est toléré.
    expect(vus(copie)).toEqual(['1:helper-local'])
  })

  it('un APPEL n’est pas une définition — contrôle positif en ligne 2', () => {
    const s = src(
      'if (!safeEqual(provided, expected)) return json({ error: \'Forbidden\' }, 403)',
      'function secureCompare(a: string, b: string) { return a === b }', // vu
    )
    expect(vus(s, 'supabase/functions/x/index.ts')).toEqual(['2:helper-local'])
  })
})

describe('role-sans-allowlist — le rôle se pose en base, l’e-mail d’auth ne se choisit pas', () => {
  it('voit la garde d’avant S8 (weekly-report:37) et la requête de destinataires (weekly-report:74)', () => {
    const s = src(
      "const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()",
      "if (profile?.role !== 'super_admin') throw new Error('Forbidden')",
      "const { data: admins } = await supabaseAdmin.from('profiles').select('email').eq('role', 'super_admin')",
      "if ('super_admin' === p.role) ouvrir()",
    )
    expect(vus(s)).toEqual(['2:role-sans-allowlist', '3:role-sans-allowlist', '4:role-sans-allowlist'])
  })

  it('se tait quand la source APPELLE la garde partagée ou la RPC d’allowlist — et parle sans elles', () => {
    const avecGarde = src(
      "if (profile?.role === 'super_admin') {",
      '  const adminAuth = await requireSuperAdmin(req, corsHeaders)',
      '}',
    )
    expect(vus(avecGarde)).toEqual([])
    // Contrôle positif : la même source, garde retirée, rougit.
    expect(vus(avecGarde.replace('requireSuperAdmin(req, corsHeaders)', 'autreChose()'))).toEqual(['1:role-sans-allowlist'])

    const avecRpc = src(
      "if (profile?.role !== 'super_admin') return refus()",
      "const { data: ok } = await supabase.rpc('super_admin_allowlist_match', { p_email: email })",
    )
    expect(vus(avecRpc)).toEqual([])
    expect(vus(avecRpc.replace('super_admin_allowlist_match', 'autre_rpc'))).toEqual(['1:role-sans-allowlist'])
  })

  it('⛔ une garde CITÉE en commentaire n’exempte rien — contrôle positif de l’exemption', () => {
    const s = src(
      '// TODO : passer par requireSuperAdmin(req, corsHeaders) et super_admin_allowlist_match',
      "if (profile?.role !== 'super_admin') throw new Error('Forbidden')",
    )
    expect(vus(s)).toEqual(['2:role-sans-allowlist'])
  })
})

describe('appelle — une garde se prouve par son APPEL', () => {
  it('ni un import, ni un commentaire, ni une chaîne ; un appel, même qualifié', () => {
    expect(appel("import { requireAgentAuth } from '../_shared/require-agent-auth.ts'", 'requireAgentAuth')).toBe(false)
    expect(appel('// const auth = await requireAgentAuth(req, cors)', 'requireAgentAuth')).toBe(false)
    expect(appel("const aide = 'requireAgentAuth(req)'", 'requireAgentAuth')).toBe(false)
    expect(appel('const auth = await requireAgentAuth(req, corsHeaders)', 'requireAgentAuth')).toBe(true)
    expect(appel('if (!(await gardes.isServiceSecret(admin, req))) return refus()', 'isServiceSecret')).toBe(true)
    // Un nom plus long qui CONTIENT la garde n'en est pas l'appel.
    expect(appel('await requireAgentAuthLegacy(req)', 'requireAgentAuth')).toBe(false)
  })
})

describe('helpersLocauxDefinis — ce que le cliquet des exemptions relit', () => {
  it('rend les définitions, pas les appels ni les commentaires', () => {
    const s = src(
      '// function safeEqual(a, b) — ancienne copie, retirée',
      'if (constantTimeEqual(a, b)) return ok',
      'export function timingSafeEqual(a: string, b: string) { return a === b }',
    )
    expect(definis(s)).toEqual(['timingSafeEqual'])
  })
})

describe('le dépôt RÉEL', () => {
  const FONCTIONS = repoPath('supabase', 'functions')

  function sources(): Array<{ chemin: string; source: string }> {
    const lus: Array<{ chemin: string; source: string }> = []
    for (const d of readdirSync(FONCTIONS).sort()) {
      if (d === '_shared') continue
      const p = join(FONCTIONS, d, 'index.ts')
      try {
        lus.push({ chemin: `supabase/functions/${d}/index.ts`, source: readFileSync(p, 'utf8') })
      } catch {
        // pas d'index.ts : pas une fonction déployable
      }
    }
    const marcher = (dir: string, relatif: string): void => {
      for (const e of readdirSync(dir).sort()) {
        const p = join(dir, e)
        const r = `${relatif}/${e}`
        if (statSync(p).isDirectory()) marcher(p, r)
        else if (e.endsWith('.ts') && !e.endsWith('.test.ts')) lus.push({ chemin: r, source: readFileSync(p, 'utf8') })
      }
    }
    marcher(join(FONCTIONS, '_shared'), 'supabase/functions/_shared')
    return lus
  }

  it('ne contient AUCUNE comparaison écrite à la main — sur 60 fichiers au moins', () => {
    const lus = sources()
    expect(lus.length, 'balayage suspect : trop peu de fichiers lus').toBeGreaterThanOrEqual(60)
    const fautes = lus.flatMap(({ chemin, source }) =>
      trouver(source, { chemin }).map((h) => `${chemin}:${h.ligne} [${h.regle}] ${h.texte}`))
    expect(fautes).toEqual([])
    // Contrôle positif : le même lecteur, sur le premier fichier lu augmenté d'une faute, parle.
    const { chemin, source } = lus[0]
    expect(trouver(`${source}\nif (h === svcKey) ok()\n`, { chemin }).map((h) => h.regle)).toContain('egalite-brute')
  })

  it('CONTRÔLE POSITIF — une mutation d’un vrai fichier est vue, pour chaque règle', () => {
    const lire = (p: string): string => readFileSync(repoPath(...p.split('/')), 'utf8')
    const mutations: Array<[string, string, string]> = [
      // [fichier, source mutée, règle attendue]
      ['supabase/functions/automation-engine/index.ts',
        lire('supabase/functions/automation-engine/index.ts') +
        '\nif (authHeader === `Bearer ${serviceRoleKey}`) ok()\n', 'egalite-brute'],
      ['supabase/functions/matching-engine/index.ts',
        lire('supabase/functions/matching-engine/index.ts') +
        "\nconst cle = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')\nif (jeton === cle) ok()\n", 'egalite-teintee'],
      ['supabase/functions/magic-link-send-email/index.ts',
        lire('supabase/functions/magic-link-send-email/index.ts') +
        '\nif (authHeader.startsWith(`Bearer ${serviceRoleKey}`)) ok()\n', 'sous-chaine'],
      ['supabase/functions/weekly-digest/index.ts',
        lire('supabase/functions/weekly-digest/index.ts') +
        '\nfunction constantTimeEqual(a: string, b: string) { return a === b }\n', 'helper-local'],
      // Les DEUX appuis de l'allowlist sont retirés : la garde partagée et la RPC — l'un
      // ou l'autre suffit à exempter le fichier.
      ['supabase/functions/weekly-report/index.ts',
        lire('supabase/functions/weekly-report/index.ts')
          .replace(/requireSuperAdmin\(/g, 'garde(')
          .replace(/super_admin_allowlist_match/g, 'autre_rpc') +
        "\nif (profile?.role !== 'super_admin') throw new Error('Forbidden')\n", 'role-sans-allowlist'],
    ]
    for (const [chemin, source, regle] of mutations) {
      expect(trouver(source, { chemin }).map((h) => h.regle), `${chemin} muté`).toContain(regle)
    }
    // Les cinq règles ont chacune leur mutation : aucune n'est muette par construction.
    expect(new Set(mutations.map((m) => m[2]))).toEqual(new Set(TOUTES_LES_REGLES))
  })

  it('chaque exemption de helper local désigne un fichier qui le définit ENCORE (cliquet)', () => {
    expect(TOLERES.length).toBe(10)
    for (const [chemin, nom] of TOLERES) {
      expect(definis(readFileSync(repoPath(...chemin.split('/')), 'utf8')), chemin).toContain(nom)
    }
  })

  it('les fonctions corrigées par S8 passent par les gardes partagées — par APPEL', () => {
    const lire = (fn: string): string => readFileSync(repoPath('supabase', 'functions', fn, 'index.ts'), 'utf8')
    expect(appel(lire('magic-link-send-email'), 'isServiceSecret')).toBe(true)
    expect(appel(lire('automation-engine'), 'isServiceSecret')).toBe(true)
    expect(appel(lire('matching-engine'), 'isServiceSecret')).toBe(true)
    expect(appel(lire('weekly-report'), 'requireSuperAdmin')).toBe(true)
    // Le chemin `x-cron-secret` est retiré du CODE, pas seulement contourné (l'en-tête en
    // garde l'histoire, d'où des motifs qui ne se lisent que dans un appel).
    expect(lire('weekly-report')).not.toMatch(/headers\.get\(\s*['"]x-cron-secret|Deno\.env\.get\(\s*['"]CRON_SECRET/)
  })

  it('la porte elle-même passe, et dit combien de fichiers elle a lus', () => {
    const sortie = execFileSync('node', ['scripts/check-edge-auth.mjs'], { cwd: repoPath(), encoding: 'utf8' })
    expect(sortie).toMatch(/✓ Comparaisons de secret : \d+ index\.ts \+ \d+ module\(s\) _shared lus/)
  })
})
