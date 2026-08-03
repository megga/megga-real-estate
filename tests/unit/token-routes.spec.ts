/**
 * Routes porteuses d'un capability token — la liste vit en TROIS exemplaires, dans
 * trois runtimes qui ne peuvent pas s'importer : la garde inline d'`index.html`
 * (évaluée dans <head>, avant React, pour que les mouchards ne soient même pas
 * téléchargés), `isTokenBearingPath` (module TS, consommé par Sentry, Intercom et
 * PostHog), et l'ancrage de chemin de `pii-redaction` (Deno, journaux d'edge).
 *
 * Le duplicat échoue OUVERT : étendre l'une sans l'autre laisse GTM et GA4 recevoir
 * l'URL complète — jeton compris — sur la route oubliée, sans que rien ne rougisse.
 *
 * ⚠ POURQUOI CE FICHIER A ÉTÉ RÉÉCRIT (3 août 2026). Sa première version comparait
 * les deux gardes sur une liste de chemins ÉCRITE À LA MAIN. Elle a laissé passer
 * `/rendez-vous/:token` — une route entière, ajoutée pendant le chantier, restée hors
 * des quatre garde-fous : GTM et gtag envoyaient son jeton à Google. Le test était
 * fidèle et vert. Une garde par énumération ne protège pas d'un oubli d'énumération.
 *
 * La liste est donc DÉRIVÉE du code, par deux propriétés qu'on ne peut pas oublier de
 * déclarer parce qu'elles SONT le mécanisme :
 *   1. le chemin de la route contient `:token` (5 routes aujourd'hui) ;
 *   2. le composant monté par la route lit un paramètre de recherche `token`
 *      (les 2 pages de visite, dont le jeton voyage en query).
 * Ajouter demain un parcours à jeton le fait entrer AUTOMATIQUEMENT dans le périmètre,
 * et rougir tant que les deux gardes ne le couvrent pas.
 *
 * LIMITE ASSUMÉE, énoncée plutôt que masquée : un secret qui voyage dans le FRAGMENT
 * (`/auth/callback` — flux implicite Supabase, `#access_token=…&refresh_token=…`) n'est
 * dérivable ni par le chemin ni par la query. `/auth` reste donc couvert par les gardes
 * sans être dérivé ici. Un futur parcours de cette forme échapperait à la dérivation ;
 * c'est le trou restant, et il est nommé.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isTokenBearingPath, scrubSecretUrl } from '@/lib/sentry'

const RACINE = resolve(__dirname, '../..')
const lire = (rel: string) => readFileSync(resolve(RACINE, rel), 'utf8')

/** Extrait l'expression de la garde d'`index.html` telle qu'elle est réellement publiée. */
function gardeDeIndexHtml(): RegExp {
  const m = lire('index.html').match(/MEGGA_ROUTE_TOKENISEE\s*=\s*(\/.+?\/[a-z]*)\.test\(/s)
  if (!m) throw new Error("garde MEGGA_ROUTE_TOKENISEE introuvable dans index.html — le test ne prouve plus rien")
  const [, litteral] = m
  const dernierSlash = litteral.lastIndexOf('/')
  return new RegExp(litteral.slice(1, dernierSlash), litteral.slice(dernierSlash + 1))
}

/** `const NomPage = lazy(() => import('@/pages/…'))` → nom du composant vers son fichier. */
function fichiersParComposant(app: string): Map<string, string> {
  const m = new Map<string, string>()
  for (const [, nom, chemin] of app.matchAll(
    /const\s+(\w+)\s*=\s*lazy\(\s*\(\)\s*=>\s*import\(\s*['"]@\/([^'"]+)['"]/g,
  )) m.set(nom, `src/${chemin}`)
  return m
}

/** `<Route path="…" element={<Composant …/>} />` → couples (chemin, composant). */
function routesDeclarees(app: string): { chemin: string; composant: string }[] {
  const out: { chemin: string; composant: string }[] = []
  for (const [, chemin, composant] of app.matchAll(
    /<Route\s+path="([^"]+)"\s+element=\{<(\w+)/g,
  )) out.push({ chemin, composant })
  return out
}

/** Le composant lit-il un paramètre de recherche `token` ? (jeton porté par la query) */
function litUnTokenEnQuery(fichier: string): boolean {
  let src: string
  for (const ext of ['.tsx', '.ts', '']) {
    try { src = lire(fichier + ext); break } catch { /* essai suivant */ }
  }
  // @ts-expect-error — `src` est affecté par la boucle ou le fichier n'existe pas.
  if (typeof src !== 'string') return false
  return /searchParams\.get\(\s*['"]token['"]\s*\)/.test(src)
}

/** Un chemin de route (`/kyc/:token`) → un chemin concret testable (`/kyc/JETON`). */
const concret = (chemin: string) => chemin.replace(/:\w+/g, 'JETON').replace(/\/\*$/, '/x')

const app = lire('src/App.tsx')
const fichiers = fichiersParComposant(app)
const routes = routesDeclarees(app)

/** Routes tokenisées DÉRIVÉES du code — jamais écrites à la main. */
const derivees = routes.filter(({ chemin, composant }) => {
  if (chemin.includes(':token')) return true
  const f = fichiers.get(composant)
  return f ? litUnTokenEnQuery(f) : false
})

describe('routes tokenisées — dérivées du routeur, pas énumérées', () => {
  const garde = gardeDeIndexHtml()

  it("l'extraction fonctionne (sans quoi tout ce fichier serait vert sur du vide)", () => {
    // Trois mesures indépendantes : si le format d'App.tsx change, l'une d'elles tombe
    // et on le sait, au lieu de valider un ensemble vide.
    expect(routes.length, 'routes extraites de App.tsx').toBeGreaterThan(20)
    expect(fichiers.size, 'composants lazy résolus').toBeGreaterThan(20)
    expect(derivees.length, 'routes tokenisées dérivées').toBeGreaterThanOrEqual(7)
  })

  it('les routes à `:token` et les pages à `?token=` sont TOUTES dérivées', () => {
    const chemins = derivees.map((r) => r.chemin)
    // Témoins des deux mécanismes de dérivation : un oubli de l'un ne peut pas se cacher
    // derrière l'autre.
    for (const attendu of ['/kyc/:token', '/reception/:token', '/rendez-vous/:token', '/accept-invite/:token']) {
      expect(chemins, `dérivation par le CHEMIN cassée`).toContain(attendu)
    }
    expect(
      chemins.filter((c) => c.startsWith('/visit/')),
      'dérivation par le composant (?token=) cassée',
    ).toHaveLength(2)
  })

  it.each(derivees.map((r) => r.chemin))('%s est couverte par les DEUX gardes', (chemin) => {
    const c = concret(chemin)
    expect(isTokenBearingPath(c), `isTokenBearingPath ne couvre pas ${chemin}`).toBe(true)
    expect(garde.test(c), `la garde d'index.html ne couvre pas ${chemin}`).toBe(true)
  })

  it('les routes ORDINAIRES restent mesurables (la garde ne mord pas trop large)', () => {
    // Sans ce contrôle, une garde `/.*/ ` passerait le test précédent en bloquant toute
    // l'audience du CRM.
    for (const chemin of ['/', '/dashboard', '/dashboard/contacts', '/login', '/kycology', '/visitors']) {
      expect(isTokenBearingPath(chemin), `${chemin} ne devrait pas être bloqué`).toBe(false)
      expect(garde.test(chemin), `${chemin} ne devrait pas être bloqué`).toBe(false)
    }
  })

  it('`/auth` reste couvert bien qu\'il ne soit pas dérivable (secret dans le FRAGMENT)', () => {
    for (const chemin of ['/auth/callback', '/auth/forgot-password/reset']) {
      expect(isTokenBearingPath(chemin)).toBe(true)
      expect(garde.test(chemin)).toBe(true)
    }
  })
})

describe('pii-redaction (edge) — TROISIÈME copie de la liste', () => {
  // Le catalogue serveur porte le même inventaire de segments, dans un troisième runtime
  // (Deno) qu'un test jsdom ne peut pas importer. On lit donc son SOURCE, comme pour
  // index.html : sans ce lien, un jeton non reconnu par la forme canonique — tronqué par
  // le journal qui le recopie — sortirait en clair des journaux d'edge sur la route oubliée.
  const source = lire('supabase/functions/_shared/pii-redaction.ts')
  const m = source.match(/\\\/\(\?:([a-z|-]+)\)\\\//)

  it("l'ancrage de chemin du catalogue est bien trouvé (sinon ce test est creux)", () => {
    expect(m, "ancrage de chemin introuvable dans pii-redaction.ts").not.toBeNull()
    expect(m![1].split('|').length, 'segments listés').toBeGreaterThanOrEqual(4)
  })

  it('couvre chaque route dérivée dont le jeton est dans le CHEMIN', () => {
    const segments = new Set(m![1].split('|'))
    for (const { chemin } of derivees.filter((r) => r.chemin.includes(':token'))) {
      const segment = chemin.split('/')[1]
      expect(segments, `pii-redaction ne caviarde pas /${segment}/<jeton>`).toContain(segment)
    }
  })
})

describe('scrubSecretUrl', () => {
  it('caviarde le jeton de CHAQUE route dérivée qui le porte dans le chemin', () => {
    for (const { chemin } of derivees.filter((r) => r.chemin.includes(':token'))) {
      const prefixe = chemin.slice(0, chemin.indexOf(':token'))
      const sortie = scrubSecretUrl(`https://app.megga.ch${prefixe}eyJpZCI6IjNmMmE5YzFl.c2ln`)
      expect(sortie, `${chemin} : le jeton survit à scrubSecretUrl`).not.toContain('eyJpZCI6')
      expect(sortie, `${chemin} : la route doit rester lisible`).toContain(prefixe.replace(/\/$/, ''))
    }
  })

  it('coupe la query ET le fragment — ce qui couvre les pages de visite et /auth/callback', () => {
    expect(scrubSecretUrl('https://app.megga.ch/visit/9c2/edit?token=9c2f')).toBe('https://app.megga.ch/visit/9c2/edit')
    expect(scrubSecretUrl('https://app.megga.ch/auth/callback#access_token=eyJ&refresh_token=v1')).toBe('https://app.megga.ch/auth/callback')
  })
})
