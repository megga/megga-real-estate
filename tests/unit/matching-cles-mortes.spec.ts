/**
 * Le namespace `matching` ne garde que ce qu'on lit (lot E1, conception `2026-09-27-matching-lot-e1-bureau-design.md`
 * §6.3). Le retrait de l'atelier de bureau a laissé 123 clés sans lecteur ; 91 l'étaient déjà avant E1 — l'ancienne
 * page de matching (`title`, `kpi`, `filter`, `sort`, `card`, `preview`, `panel`…), 37 libellés de l'atelier et
 * quatre de la Recherche. Les 214 sont parties des quatre langues. Aucune n'était lue par une clé composée : au
 * 29.09.2026, le namespace ne composait que sous `tabs.`, `aiHint.kycPhrase.`, `mobile.settings.`, `mobile.verdict.`,
 * `firstRun.`, neuf préfixes de `fil.` et six de `recherche.`.
 *
 * Ce que cette spec refuse, dans chacune des quatre langues :
 *   · une branche ou une clé retirée, revenue au premier niveau ;
 *   · dans `atelier`, `confirm` et `panel`, une clé que l'écran mobile ne lit pas — ce qu'ils gardent, c'est lui qui
 *     le lit, jusqu'au lot E2 — et, dans l'autre sens, une clé de ces trois branches que le mobile lirait sans
 *     qu'elle y soit : elle s'afficherait brute ;
 *   · les quatre clés mortes de la Recherche ;
 *   · la perte d'une clé gardée exprès : `tabs.*`, que le mobile compose (`tabs.${f}`), `aiHint.*`, que lit
 *     `composeAiHint`, et `fil.quiPour.etat.refuse*`, que l'état d'un compatible nomme encore et auquel la copie du
 *     copilote WhatsApp est confrontée.
 *
 * Lecture des fichiers : ce qu'on refuse est un contenu — des clés —, pas un écran. Une branche NEUVE au premier
 * niveau reste permise : la spec refuse un retour, elle ne fige pas le namespace.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const R = process.cwd()
const LANGUES = ['fr', 'de', 'en', 'it'] as const
const MOBILE = 'src/components/crm-mobile/matching'

type Arbre = { [cle: string]: string | Arbre }

const lire = (langue: string): Arbre =>
  JSON.parse(readFileSync(join(R, `src/i18n/locales/${langue}/matching.json`), 'utf8')) as Arbre

/** Les chemins complets des feuilles d'une branche, triés. */
function feuilles(o: Arbre, prefixe = ''): string[] {
  return Object.entries(o)
    .flatMap(([k, v]) => (typeof v === 'string' ? [prefixe + k] : feuilles(v, `${prefixe}${k}.`)))
    .sort()
}

/** Les fichiers TypeScript d'un dossier, récursivement, commentaires blanchis. */
function sources(dossier: string): string[] {
  return readdirSync(join(R, dossier), { withFileTypes: true }).flatMap((e) => {
    const chemin = `${dossier}/${e.name}`
    if (e.isDirectory()) return sources(chemin)
    if (!/\.tsx?$/.test(e.name)) return []
    return [readFileSync(join(R, chemin), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')]
  })
}

/** Le premier niveau parti avec l'ancienne page de matching et le cockpit de l'atelier : branches et clés. */
const PARTIS_DU_PREMIER_NIVEAU = [
  'title', 'subtitle', 'runMatching', 'running', 'portfolio', 'market',
  'kpi', 'filter', 'sort', 'empty', 'card', 'preview', 'cockpit',
]

/** Ce que gardent `atelier`, `confirm` et `panel` : ce que l'écran mobile lit, et rien d'autre. */
const GARDEES_PAR_LE_MOBILE = {
  atelier: [
    'budget', 'empty.desc', 'empty.scanCta', 'empty.scanning', 'empty.title', 'error.desc', 'error.retry',
    'error.title', 'later', 'matchedListings', 'minSurface', 'perMonth', 'searchProfile', 'seeDeal', 'specRooms',
    'targetZones', 'toast.later', 'toast.sent', 'toast.skipped', 'type',
  ],
  confirm: ['sendBody', 'sendCta', 'sendQuestion', 'sendTitle'],
  panel: ['emptyTitle'],
} as const

describe('les clés mortes du namespace `matching` sont parties', () => {
  it.each(LANGUES)('%s : ni l’ancienne page de matching, ni le cockpit de l’atelier, au premier niveau', (langue) => {
    const premierNiveau = Object.keys(lire(langue))
    expect(premierNiveau, 'le namespace ne rend plus rien : la clause ne mesure rien').toContain('fil')
    expect(premierNiveau.filter((k) => PARTIS_DU_PREMIER_NIVEAU.includes(k))).toEqual([])
  })

  it.each(LANGUES)('%s : `atelier`, `confirm` et `panel` ne gardent que ce que l’écran mobile lit', (langue) => {
    const o = lire(langue)
    for (const [branche, gardees] of Object.entries(GARDEES_PAR_LE_MOBILE)) {
      expect(feuilles(o[branche] as Arbre), branche).toEqual([...gardees])
    }
  })

  it.each(LANGUES)('%s : les quatre clés mortes de la Recherche', (langue) => {
    const recherche = feuilles(lire(langue).recherche as Arbre)
    expect(recherche.length, 'la Recherche ne rend plus rien : la clause ne mesure rien').toBeGreaterThan(0)
    for (const morte of ['card.noPhoto', 'empty.seeNear', 'omni.place', 'omni.restore']) {
      expect(recherche, morte).not.toContain(morte)
    }
  })
})

describe('les clés gardées exprès', () => {
  it.each(LANGUES)('%s : `tabs.*`, `aiHint.*` et `fil.quiPour.etat.refuse*` sont là', (langue) => {
    const o = lire(langue)
    expect(feuilles(o.tabs as Arbre)).toEqual(expect.arrayContaining(['all', 'engaged', 'no-reply', 'to-send']))
    expect(feuilles(o.aiHint as Arbre)).toEqual(expect.arrayContaining([
      'aligned', 'daysAgo_one', 'daysAgo_other', 'default', 'engaged', 'engagedVisit', 'kycPhrase.none',
      'kycPhrase.pending', 'kycPhrase.stale', 'kycPhrase.verified', 'noReply', 'posNeg', 'recently', 'twoPos',
    ]))
    const etat = ((o.fil as Arbre).quiPour as Arbre).etat as Arbre
    expect(etat.refuse, 'fil.quiPour.etat.refuse').toBeTruthy()
    expect(etat.refuseSansMotif, 'fil.quiPour.etat.refuseSansMotif').toBeTruthy()
  })

  it('ce que gardent `atelier`, `confirm` et `panel`, c’est exactement ce que l’écran mobile lit', () => {
    const lues = new Set(sources(MOBILE).flatMap((code) =>
      [...code.matchAll(/['"`](atelier|confirm|panel)\.([\w.-]+)['"`]/g)].map((m) => `${m[1]}.${m[2]}`)))
    const gardees = Object.entries(GARDEES_PAR_LE_MOBILE).flatMap(([branche, cles]) => cles.map((c) => `${branche}.${c}`))
    expect([...lues].sort()).toEqual(gardees.sort())
  })
})
