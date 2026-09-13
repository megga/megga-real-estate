/**
 * Les Edge Functions s'exécutent dans la région de la base (Irlande), quel que soit
 * l'appelant — navigateur, autre fonction, ou tiers qui suit un lien que nous avons construit.
 *
 * ⛔ Mesuré le 13.09.2026 dans les journaux (`x_sb_edge_region`) : sans épingle, une fonction
 * s'exécute près de son appelant. Un navigateur suisse tombait à Zurich ; `whatsapp-webhook`,
 * appelé par Meta, s'exécutait aux États-Unis (142 appels en 24 h, tous), et `whatsapp-agent`
 * qu'il appelle l'y suivait (24). Le paramètre `forceFunctionRegion` épingle — vérifié :
 * `eu-west-1` et `us-east-1` rendent chacun la région demandée. Les appels de la BASE sont
 * gardés à part, sur base migrée : tests/backend/region-fonctions-base.spec.ts.
 *
 * ⚠ L'option `region` de supabase-js pose AUSSI l'en-tête `x-region`, que le préflight CORS
 * de nos fonctions ne déclare pas : elle ferait tomber tout appel du navigateur. D'où la
 * garde de comportement ci-dessous, qui regarde les en-têtes réellement envoyés.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { repoPath } from './helpers/fs-scan'
import { REGION_FONCTIONS as REGION_EDGE, urlFonction as urlEdge } from '../../supabase/functions/_shared/function-url'

const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')

function fichiers(dossier: string, filtre: (f: string) => boolean): string[] {
  const out: string[] = []
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom)
    if (statSync(chemin).isDirectory()) out.push(...fichiers(chemin, filtre))
    else if (filtre(chemin)) out.push(chemin)
  }
  return out
}

/**
 * Les lieux où une URL de fonction se CONSTRUIT (hors commentaires) — ils doivent passer par
 * urlFonction. Côté front, la base exportée `SUPABASE_FUNCTIONS_URL` en est une aussi : un
 * `${SUPABASE_FUNCTIONS_URL}/x` ne contient pas la chaîne `functions/v1`, et partirait sans épingle.
 */
function constructionsAMain(racine: string, motif: RegExp, permis: (f: string) => boolean, filtre: (f: string) => boolean): string[] {
  return fichiers(repoPath(racine), filtre)
    .map((f) => relative(repoPath('.'), f))
    .filter((f) => !permis(f))
    .filter((f) => motif.test(sansCommentaires(readFileSync(repoPath(f), 'utf8'))))
}

afterEach(() => { vi.restoreAllMocks() })

describe('région des Edge Functions — aucune URL de fonction construite à la main', () => {
  it('front : tout passe par le client ou par urlFonction', () => {
    const permis = (f: string) =>
      f === 'src/lib/supabase.ts' // le constructeur lui-même
      || f.startsWith('src/pages/dev/') // les bancs : absents du bundle, leur intercepteur reconnaît un PRÉFIXE
    expect(constructionsAMain('src', /functions\/v1|SUPABASE_FUNCTIONS_URL/, permis, (f) => /\.(ts|tsx)$/.test(f))).toEqual([])
  })

  it('edge : tout appel d’une fonction par une autre passe par _shared/function-url.ts', () => {
    const permis = (f: string) => f === 'supabase/functions/_shared/function-url.ts'
    expect(constructionsAMain('supabase/functions', /functions\/v1/, permis, (f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))).toEqual([])
  })

  it('e2e : aucune glob Playwright ne s’arrête au nom d’une fonction — l’épingle y ajoute une query', () => {
    // Une glob Playwright est ancrée sur l'URL ENTIÈRE : `**/functions/v1/x` ne voit plus
    // `…/x?forceFunctionRegion=…`, et la maquette cesse d'intercepter sans que rien ne rougisse.
    const fautives = fichiers(repoPath('tests'), (f) => /\.(ts|mjs)$/.test(f) && !f.includes(`${sep}unit${sep}`))
      .flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/\.(?:route|unroute|waitForRequest|waitForResponse)\(\s*(['"`])([^'"`]*functions\/v1\/[^'"`]*)\1/g)]
        .filter((m) => !m[2]!.endsWith('*'))
        .map((m) => `${relative(repoPath('.'), f)} : ${m[2]}`))
    expect(fautives).toEqual([])
  })

  it('la même région des deux côtés, et c’est celle de la base', async () => {
    const { REGION_FONCTIONS } = await import('@/lib/supabase')
    expect(REGION_FONCTIONS).toBe('eu-west-1')
    expect(REGION_EDGE).toBe(REGION_FONCTIONS)
    expect(new URL(urlEdge('https://x.supabase.co', 'a')).searchParams.get('forceFunctionRegion')).toBe('eu-west-1')
  })
})

describe('région des Edge Functions — ce que le navigateur envoie réellement', () => {
  it('functions.invoke part avec l’épingle, et SANS l’en-tête x-region (préflight CORS)', async () => {
    const espion = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const { supabase, SUPABASE_FUNCTIONS_URL } = await import('@/lib/supabase')
    await supabase.functions.invoke('mail-send', { body: { a: 1 } })
    expect(espion).toHaveBeenCalled()
    const [cible, init] = espion.mock.calls.at(-1)!
    const url = typeof cible === 'string' ? cible : cible instanceof URL ? cible.href : (cible as Request).url
    expect(url.startsWith(`${SUPABASE_FUNCTIONS_URL}/mail-send`)).toBe(true)
    expect(new URL(url).searchParams.get('forceFunctionRegion')).toBe('eu-west-1')
    const entetes = new Headers((init as RequestInit | undefined)?.headers)
    expect(entetes.has('x-region'), 'x-region ferait échouer le préflight CORS de nos fonctions').toBe(false)
  })

  it('les autres services (REST, auth) ne reçoivent pas l’épingle', async () => {
    const { epinglerRegion, SUPABASE_FUNCTIONS_URL } = await import('@/lib/supabase')
    const base = SUPABASE_FUNCTIONS_URL.replace(/\/functions\/v1$/, '')
    for (const autre of [`${base}/rest/v1/contacts?select=id`, `${base}/auth/v1/user`, 'https://ailleurs.test/functions/v1/x']) {
      expect(epinglerRegion(autre)).toBe(autre)
    }
    const deja = `${SUPABASE_FUNCTIONS_URL}/x?forceFunctionRegion=eu-west-1`
    expect(epinglerRegion(deja), 'idempotent').toBe(deja)
    expect(epinglerRegion(`${SUPABASE_FUNCTIONS_URL}/x?id=1`)).toBe(`${SUPABASE_FUNCTIONS_URL}/x?id=1&forceFunctionRegion=eu-west-1`)
  })

  it('urlFonction garde les paramètres et épingle', async () => {
    const { urlFonction, SUPABASE_FUNCTIONS_URL } = await import('@/lib/supabase')
    const u = new URL(urlFonction('mail-attachment', { id: 'a b' }))
    expect(u.href.startsWith(`${SUPABASE_FUNCTIONS_URL}/mail-attachment?`)).toBe(true)
    expect(u.searchParams.get('id')).toBe('a b')
    expect(u.searchParams.get('forceFunctionRegion')).toBe('eu-west-1')
  })
})
