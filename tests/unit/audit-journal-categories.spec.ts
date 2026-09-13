/**
 * Garde-fou : le journal d'audit agent (`/dashboard/audit`) connaît EXACTEMENT les
 * catégories que la base admet, et compte ses « Actions MEGGA AI » sur `actor_kind`.
 *
 * ── POURQUOI CE FICHIER EXISTE ───────────────────────────────────────────────
 * `activity_events_category_check` admet DIX familles depuis 20260815214000
 * (`onboarding` le 03.08, `messaging` le 15.08). Le front n'en connaissait que HUIT :
 * le type `AuditCategory`, les deux cartes de `crm-dossiers/tokens.ts` et les clés
 * i18n `audit.category.*` s'étaient arrêtés à la baseline. Effet mesuré le 13.09.2026 :
 * les deux lignes `onboarding` de la production s'affichaient avec leur libellé BRUT
 * (« onboarding », non traduit) sous l'icône des documents, et aucune pastille de
 * filtre ne les atteignait. `messaging` suivait à la première synchro de boîte.
 *
 * Aucune porte ne le voyait : une clé manquante dans un `Record<string, …>` n'est
 * pas une erreur, c'est un repli silencieux sur `?? { label: event.category }`.
 *
 * ── CE QUE LA GARDE FIGE ─────────────────────────────────────────────────────
 * Le domaine est LU dans les migrations — la dernière définition de la contrainte —
 * et jamais recopié ici : une liste écrite dans le test se périmerait exactement
 * comme la carte du front s'est périmée. Et la lecture ROUGIT si la dernière
 * migration qui nomme la contrainte n'est pas celle que le motif a su lire : une
 * future syntaxe (`category in (…)`) serait sinon sautée en silence, et l'ancien
 * domaine resterait la référence.
 *
 * (d) est la VRAIE garde du figeage des getters de teinte : `tokens.ts` désignait
 * `dossiers-contraste.spec.ts`, qui n'importe que `dossierPalette` et ne lit aucune
 * carte de catégories.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import i18n from '@/i18n'
import { AUDIT_CATEGORIES, AUDIT_CAT_ICONS, dossierPalette } from '@/components/crm-dossiers/tokens'
import { CRM_DARK_KEY } from '@/lib/crmDark'
import { emptyRoots, readFileSafely, rel, repoPath, scanRoots } from './helpers/fs-scan'
import { corpsDeFonction } from './helpers/ts-source'

const CONTRAINTE = 'activity_events_category_check'

/** Retire `-- …` et `/* … *\/` : plusieurs migrations CITENT la contrainte en commentaire. */
const sqlSansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ')

/**
 * Les deux formes réellement écrites dans le dépôt : la baseline
 * (`CONSTRAINT "…" CHECK (("category" = ANY (ARRAY['kyc'::"text", …])))`) et les
 * migrations (`add constraint … check (category = any (array['kyc', …]))`).
 */
const DEFINITION = new RegExp(
  `(?:add\\s+)?constraint\\s+"?${CONTRAINTE}"?\\s+check\\s*\\(+\\s*"?category"?\\s*=\\s*any\\s*\\(\\s*\\(?\\s*array\\s*\\[([^\\]]+)\\]`,
  'gi',
)

interface Domaine {
  valeurs: string[]
  /** Migration de la définition retenue (la dernière lue). */
  source: string
  /** Dernière migration qui NOMME la contrainte hors commentaire. */
  derniereMention: string
  lues: number
}

let domaineCache: Domaine | null = null

function domaineCategories(): Domaine {
  if (domaineCache) return domaineCache
  const scan = scanRoots([{
    root: 'supabase/migrations',
    // Fichiers appliqués seulement : `_archived/` est sauté par le balayage, et un
    // sous-dossier futur ne porterait pas une migration appliquée.
    keep: (n) => /^\d+_.*\.sql$/.test(n),
    keepPath: (p) => p.split('/').length === 3,
  }])
  expect(emptyRoots(scan), 'supabase/migrations introuvable').toEqual([])
  expect(scan.unreadable, `migrations illisibles : ${scan.unreadable.join(' | ')}`).toEqual([])

  // Ordre d'application : le nom de fichier, préfixé par sa version.
  const fichiers = [...scan.files].sort((a, b) => rel(a).localeCompare(rel(b)))
  let valeurs: string[] = []
  let source = ''
  let derniereMention = ''
  for (const f of fichiers) {
    const brut = readFileSafely(f)
    if (brut.status !== 'ok') continue
    const sql = sqlSansCommentaires(brut.value)
    if (!sql.toLowerCase().includes(CONTRAINTE)) continue
    derniereMention = rel(f)
    for (const m of sql.matchAll(DEFINITION)) {
      valeurs = [...m[1]!.matchAll(/'([a-z_]+)'/g)].map((v) => v[1]!)
      source = rel(f)
    }
  }
  domaineCache = { valeurs: [...new Set(valeurs)].sort(), source, derniereMention, lues: fichiers.length }
  return domaineCache
}

/* ─── Contraste — recopié de dossiers-contraste.spec.ts ────────────────────── */

function canal(c: string): [number, number, number, number] | null {
  const rgb = c.match(/rgba?\(([^)]+)\)/i)
  if (rgb) {
    const p = rgb[1]!.split(/[,/]/).map((s) => parseFloat(s.trim()))
    return [p[0]!, p[1]!, p[2]!, p.length > 3 ? p[3]! : 1]
  }
  const h = c.replace('#', '')
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(h)) return null
  const p = h.length === 3 ? [...h].map((x) => x + x).join('') : h
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(p.slice(i, i + 2), 16))
  return [r!, g!, b!, 1]
}
function luminance(c: [number, number, number, number]): number {
  const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
}
function contraste(encre: string, fond: string): number | null {
  const e = canal(encre), f = canal(fond)
  if (!e || !f) return null
  const compose: [number, number, number, number] = e[3] >= 1 ? e
    : [e[0] * e[3] + f[0] * (1 - e[3]), e[1] * e[3] + f[1] * (1 - e[3]), e[2] * e[3] + f[2] * (1 - e[3]), 1]
  const [a, b] = [luminance(compose), luminance(f)].sort((x, y) => y - x)
  return (a! + 0.05) / (b! + 0.05)
}

/**
 * ⚠ IL FAUT POSER `localStorage` SOI-MÊME : sous cet environnement, `typeof
 * window.localStorage` vaut `undefined` (cf. lab-guard-banner.spec.tsx). Sans lui,
 * `readCrmDark()` retombe sur le clair et (d) mesurerait deux fois le même thème.
 */
const memoire = new Map<string, string>()
const stockageMemoire = {
  getItem: (k: string) => memoire.get(k) ?? null,
  setItem: (k: string, v: string) => { memoire.set(k, v) },
  removeItem: (k: string) => { memoire.delete(k) },
  clear: () => memoire.clear(),
  key: (i: number) => [...memoire.keys()][i] ?? null,
  get length() { return memoire.size },
} as Storage
const stockageOrigine = Object.getOwnPropertyDescriptor(window, 'localStorage')

/** Lit la carte d'une catégorie SANS supposer qu'elle existe (l'ancien code n'en avait que huit). */
const carte = (c: string) => (AUDIT_CATEGORIES as Record<string, { label: string; tone: string } | undefined>)[c]

const lireCode = (...segments: string[]) => {
  const r = readFileSafely(repoPath(...segments))
  if (r.status !== 'ok') throw new Error(`${segments.join('/')} illisible`)
  return r.value.replace(/\r\n/g, '\n')
}
const sansCommentaires = (c: string) => c.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')

describe('journal d’audit agent — les catégories sont le domaine du CHECK', () => {
  beforeAll(async () => {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: stockageMemoire })
    await i18n.changeLanguage('fr')
  })
  afterAll(() => {
    if (stockageOrigine) Object.defineProperty(window, 'localStorage', stockageOrigine)
    else delete (window as { localStorage?: Storage }).localStorage
  })

  it('le domaine est lu dans la DERNIÈRE migration qui nomme la contrainte', () => {
    const d = domaineCategories()
    expect(d.lues, 'aucune migration balayée').toBeGreaterThan(100)
    expect(
      d.source,
      `la dernière migration qui nomme ${CONTRAINTE} (${d.derniereMention}) n’a pas été LUE par le motif — ` +
        'nouvelle syntaxe, ou suppression de la contrainte : adapter DEFINITION, ne jamais garder l’ancien domaine.',
    ).toBe(d.derniereMention)
    // Contrôle POSITIF : sans lui, un motif qui ne lit plus rien rendrait (a) vert sur deux listes vides.
    expect(d.valeurs.length, `domaine trop court : ${d.valeurs.join(', ')}`).toBeGreaterThanOrEqual(10)
    expect(d.valeurs).toContain('messaging')
    expect(d.valeurs).toContain('kyc')
  })

  it('(a) AUDIT_CATEGORIES porte exactement le domaine — donc les pastilles de filtre aussi', () => {
    const { valeurs } = domaineCategories()
    const front = Object.keys(AUDIT_CATEGORIES).sort()
    expect(
      front,
      `manquent au front : ${valeurs.filter((v) => !front.includes(v)).join(', ') || '—'} · ` +
        `inconnues de la base : ${front.filter((v) => !valeurs.includes(v)).join(', ') || '—'}`,
    ).toEqual(valeurs)
  })

  it('(b) AUDIT_CAT_ICONS porte exactement le domaine', () => {
    const { valeurs } = domaineCategories()
    expect(Object.keys(AUDIT_CAT_ICONS).sort()).toEqual(valeurs)
  })

  it('(c) chaque catégorie a un libellé dans les QUATRE langues, et la carte le rend', () => {
    const { valeurs } = domaineCategories()
    const manquants: string[] = []
    for (const lang of ['fr', 'en', 'de', 'it']) {
      const json = JSON.parse(lireCode('src', 'i18n', 'locales', lang, 'common.json')) as {
        audit?: { category?: Record<string, unknown> }
      }
      for (const c of valeurs) {
        const v = json.audit?.category?.[c]
        if (typeof v !== 'string' || !v.trim()) manquants.push(`${lang}:audit.category.${c}`)
      }
    }
    expect(manquants, 'libellés de catégorie absents').toEqual([])
    expect(carte('messaging')?.label, 'la carte doit rendre le libellé traduit, pas la valeur brute').toBe('Messagerie')
    expect(carte('onboarding')?.label).toBe('Accueil')
  })

  it('(d) les teintes suivent le thème — et les deux catégories neuves passent l’AA', () => {
    const { valeurs } = domaineCategories()
    const lire = (dark: boolean) => {
      memoire.set(CRM_DARK_KEY, dark ? '1' : '0')
      return Object.fromEntries(valeurs.map((c) => [c, carte(c)?.tone]))
    }
    const tons = { clair: lire(false), sombre: lire(true) }
    const palettes = { clair: dossierPalette(false), sombre: dossierPalette(true) }

    // ⛔ LE FIGEAGE. `tone: DOSSIER_TON.muted` (sans getter) invoque l'accesseur UNE fois,
    // à l'évaluation du module, et garde la couleur du thème de démarrage. Toute teinte
    // qui vaut un RÔLE thémé en clair doit valoir le même rôle en sombre.
    const figees: string[] = []
    for (const c of valeurs) {
      for (const role of ['muted', 'ink'] as const) {
        if (tons.clair[c] === palettes.clair[role] && tons.sombre[c] !== palettes.sombre[role]) {
          figees.push(`${c} : ${role} en clair (${tons.clair[c]}), ${tons.sombre[c]} en sombre au lieu de ${palettes.sombre[role]}`)
        }
      }
    }
    expect(figees, `teinte FIGÉE au thème de démarrage — écrire \`get tone()\` :\n  ${figees.join('\n  ')}`).toEqual([])

    const faibles: string[] = []
    for (const c of ['messaging', 'onboarding']) {
      expect(carte(c), `catégorie ${c} absente de AUDIT_CATEGORIES`).toBeDefined()
      expect(tons.clair[c], `${c} : la teinte doit suivre le thème (preuve du getter)`).not.toBe(tons.sombre[c])
      for (const [theme, p] of Object.entries(palettes)) {
        const ton = tons[theme as keyof typeof tons][c]!
        for (const fond of ['card', 'cardSubtle'] as const) {
          const r = contraste(ton, p[fond])
          expect(r, `contraste non mesurable : ${c} (${ton}) sur ${fond} (${theme})`).not.toBeNull()
          if (r! < 4.5) faibles.push(`${theme} : ${c} (${ton}) sur ${fond} = ${Math.round(r! * 100) / 100}:1`)
        }
      }
    }
    expect(faibles, `teinte de catégorie sous l’AA :\n  ${faibles.join('\n  ')}`).toEqual([])
  })

  it('(e) le hook lit `actor_kind`, et la carte « Actions MEGGA AI » ne compte plus l’absence d’acteur', () => {
    const hook = corpsDeFonction(sansCommentaires(lireCode('src', 'hooks', 'useAuditLog.ts')), 'useAuditEvents')
    expect(hook, 'useAuditEvents introuvable : la garde ne mesure plus rien').not.toBeNull()
    const select = /\.select\(\s*'([^']+)'/.exec(hook!)
    expect(select, 'select de useAuditEvents introuvable').not.toBeNull()
    const colonnes = select![1]!.split(',').map((c) => c.trim())
    expect(colonnes, 'sans `actor_kind`, la page ne peut pas distinguer IA, système et agent détaché').toContain('actor_kind')

    const page = sansCommentaires(lireCode('src', 'pages', 'agent', 'AuditPage.tsx'))
    expect(page, '`!e.actor_id` compte le système et les agents détachés comme des actions IA').not.toMatch(/!\s*e\.actor_id/)
    expect(page).toContain('compterActionsIa(events)')
    // C'est cette itération qui fait de (a) la garde des pastilles de filtre.
    expect(page).toMatch(/Object\.(?:keys|entries)\(AUDIT_CATEGORIES\)/)
  })
})
