/**
 * Garde-fou : les DELTAS d'Analytics sortent de l'adaptateur normalisés — et
 * l'unité qu'ils portent est celle que le SQL calcule.
 *
 * ── POURQUOI CE FICHIER EXISTE ───────────────────────────────────────────────
 * `buildAxData` n'était couvert par RIEN. C'est pourtant le seul endroit où les
 * trois payloads RPC deviennent des nombres affichables, et deux défauts y
 * vivaient côte à côte, invisibles aux gardes existantes :
 *
 *  · ⛔ L'ÉCART DE CONVERSION N'ÉTAIT PAS ARRONDI. Il s'écrivait
 *    `conversion - convPrev`, en ligne : la seule soustraction du fichier qui
 *    faisait CONFIANCE à la précision de son entrée. Mesuré à l'écran sur le
 *    banc `/dev/crm` : « +0.0500000000000000 pt ». Aucune garde de rendu ne
 *    pouvait l'attraper — la pilule était peinte correctement, c'est son
 *    CONTENU qui était faux.
 *  · ⛔ `delta_deals` EST UN POURCENTAGE, affiché comme un COMPTE. Le SQL rend
 *    `ROUND((deals − prev) * 100 / prev)` ; la tuile portait `abs: true`, qui
 *    masque le suffixe, donc « +2 » se lisait « deux deals de plus » au lieu de
 *    « +2 % ». Le commentaire de la tuile voisine portait la même méprise.
 *
 * ── CE QUE CETTE GARDE FIGE, ET CE QU'ELLE REFUSE DE SUPPOSER ────────────────
 * 1. Elle mesure l'ADAPTATEUR, pas le rendu : le défaut vivait dans un nombre,
 *    pas dans un pixel.
 * 2. Elle nourrit l'adaptateur de DÉCIMALES là où la production n'en envoie
 *    pas. Un test qui rejouerait les entiers du RPC passerait au vert sur le
 *    code défectueux — c'est exactement ce qui a laissé le défaut vivre :
 *    `ROUND(…)::int` des deux côtés le rendait invisible en production, et il
 *    n'apparaissait que sur un banc dont la fixture divergeait.
 * 3. Elle lit l'UNITÉ dans le SQL, seul oracle : côté client, « 2 » est
 *    plausible comme compte ET comme pourcentage. La clause relit donc la
 *    migration plutôt que de recopier une intention.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildAxData, type CockpitJson, type ObjectifJson, type FunnelJson } from '@/components/crm/analytics/buildAxData'
import { repoPath } from './helpers/fs-scan'

/** `t` d'identité : cette garde mesure des NOMBRES, jamais des libellés. */
const t = ((cle: string) => cle) as unknown as Parameters<typeof buildAxData>[4]

const COCKPIT: CockpitJson = {
  scope: 'me', period: 'month', velocity_source: 'stage_change',
  decomp: { signed: 84_000, compromis: 42_000, offres: 61_000, pipeline: 128_000 },
  decomp_flags: {
    signed: { n_default_pct: 0, n_missing_price: 0 },
    compromis: { n_default_pct: 0, n_missing_price: 0 },
    offres: { n_default_pct: 0, n_missing_price: 0 },
    pipeline: { n_default_pct: 0, n_missing_price: 0 },
  },
  projected: 187_450, contributors: [],
  deals: 12, n_signed: 3, volume_signed: 2_800_000,
  conversion: 26, conversion_prev: 21,
  delta_deals: 20, velocity: 34, kyc_risk: 0, kyc_urgent: 0, kyc_risk_prev: 0,
}
const OBJECTIF: ObjectifJson = {
  period: 'month', trunc: 'week', target: 250_000, target_is_set: true,
  realized: 84_000, buckets: 4, realIdx: 2,
  xLabels: ['S1', 'S2', 'S3', 'S4'],
  real: [21_000, 38_000, 84_000, 0],
  median: [25_000, 55_000, 90_000, 140_000],
  projected: 187_450, label: 'Août 2026',
}
const FUNNEL: FunnelJson = {
  funnel: { leads: 0, leads_prev: 0, qualif: 0, qualif_prev: 0, visits: 0, offers: 0, compromis: 0 },
  sources: [], forecast: { n30: 0, mid30: 0, n60: 0, mid60: 0, n90: 0, mid90: 0 },
}

const construire = (cockpit: Partial<CockpitJson> = {}, funnel: Partial<FunnelJson> = {}) =>
  buildAxData('month', { ...COCKPIT, ...cockpit }, OBJECTIF, { ...FUNNEL, ...funnel }, t)

const conversionKpi = (d: ReturnType<typeof construire>) => d.kpis.find((k) => k.pts)!
const transactionsKpi = (d: ReturnType<typeof construire>) => d.kpis[1]!

describe('Deltas Analytics — arrondis à la frontière, et dans l’unité du SQL', () => {
  /** Sans lui, tout le reste passerait par vacuité sur un adaptateur muet. */
  it('l’adaptateur rend bien quatre KPI, dont celui qui porte des points', () => {
    const d = construire()
    expect(d.kpis).toHaveLength(4)
    expect(d.kpis.filter((k) => k.pts), 'un seul KPI en POINTS : le taux de conversion').toHaveLength(1)
  })

  /**
   * ⛔ LE CONTRÔLE NÉGATIF DE CETTE GARDE : des DÉCIMALES en entrée. Avec les
   * entiers que rend le RPC, la clause serait verte sur le code défectueux.
   */
  it('l’écart de conversion est arrondi, même nourri de décimales', () => {
    const d = construire({ conversion: 0.26, conversion_prev: 0.21 })
    const delta = conversionKpi(d).delta
    expect(Number.isInteger(delta), `delta non arrondi : ${delta}`).toBe(true)
    expect(String(delta), 'une queue de flottant s’afficherait telle quelle dans la pilule').not.toMatch(/\./)
  })

  it('l’écart de conversion dit le bon nombre de points', () => {
    expect(conversionKpi(construire()).delta).toBe(5)
    expect(conversionKpi(construire({ conversion: 18, conversion_prev: 25 })).delta).toBe(-7)
  })

  /**
   * ⚠ `null` est le cas NORMAL, pas un cas limite : le SQL rend `NULL` quand
   * aucun deal n'est encore tranché (`n_signed + n_lost = 0`). Un `undefined`
   * qui filerait jusqu'à la pilule y afficherait « +undefined % ».
   */
  it('sans historique, l’écart vaut zéro — jamais NaN ni undefined', () => {
    for (const cas of [
      { conversion: null, conversion_prev: null },
      { conversion: 26, conversion_prev: null },
      { conversion: null, conversion_prev: 21 },
    ]) {
      const delta = conversionKpi(construire(cas)).delta
      expect(delta, `cas ${JSON.stringify(cas)}`).toBe(0)
    }
  })

  /**
   * ⛔ L'UNITÉ SE LIT DANS LE SQL, ET NULLE PART AILLEURS. Côté client, un « 2 »
   * est plausible comme écart de deals ET comme pourcentage : c'est cette
   * ambiguïté qui a fait poser `abs: true` sur la tuile, et écrire « variation
   * du NOMBRE de deals » dans le commentaire voisin. La clause relit donc la
   * migration — si quelqu'un fait rendre au RPC un écart absolu, elle rougit et
   * demande de rouvrir l'affichage en même temps.
   */
  it('« Transactions » affiche un POURCENTAGE, parce que le SQL en calcule un', () => {
    /**
     * ⚠ L'EXPRESSION TIENT SUR TROIS LIGNES (`CASE … THEN … ELSE … END`), et
     * une lecture ligne à ligne ne voit que « 'delta_deals', CASE WHEN dp.n > 0 »
     * — donc jamais le `* 100 /` qui porte l'unité. Elle rougirait sur un RPC
     * parfaitement sain. On lit donc jusqu'au `END`, comme le lit Postgres.
     */
    const sql = readFileSync(repoPath('supabase/migrations/20260614150000_analytics_rpcs.sql'), 'utf-8')
    const lignes = sql.split('\n')
    const debut = lignes.findIndex((l) => l.includes("'delta_deals'"))
    expect(debut, 'delta_deals a disparu du RPC : l’unité n’est plus mesurée').toBeGreaterThan(-1)
    const fin = lignes.slice(debut).findIndex((l) => /\bEND\b/.test(l))
    expect(fin, 'expression delta_deals non terminée : lecture douteuse').toBeGreaterThan(-1)
    const expression = lignes.slice(debut, debut + fin + 1).join(' ')
    expect(expression, `delta_deals ne calcule plus un % : ${expression.trim()}`).toMatch(/\* 100 \//)

    const kpi = transactionsKpi(construire())
    expect(kpi.abs, '`abs` masque le suffixe — sur un pourcentage, il fait mentir la tuile').toBeFalsy()
    expect(kpi.pts, 'ce n’est pas un écart en points non plus').toBeFalsy()
    expect(kpi.delta).toBe(20)
  })

  /** Les deltas de canaux passaient déjà par `deltaPct` ; la clause le fige. */
  it('les deltas de canaux sont des entiers, y compris depuis zéro', () => {
    const d = construire({}, {
      sources: [
        { source: 'site', v: 12, prev: 9, conv: 25, comm: 1000, won: 1 },
        { source: 'flatfox', v: 7, prev: 0, conv: 0, comm: 0, won: 0 },
        { source: 'recommandation', v: 3, prev: 8, conv: 33, comm: 500, won: 1 },
      ],
    })
    expect(d.sources.map((s) => s.delta)).toEqual([33, 100, -62])
    for (const s of d.sources) expect(Number.isInteger(s.delta), `${s.label} : ${s.delta}`).toBe(true)
  })
})
