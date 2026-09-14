/**
 * Instantané free/busy d'un agent (audit du 13.09.2026) : fraîcheur, lecture fail-closed, et
 * surtout la PROPRIÉTÉ qui justifie tout le module — un appel au fournisseur au plus par
 * fenêtre, même sous rafale, même quand l'instantané est jeté en plein vol.
 *
 * La fausse base reproduit la règle SQL du bail (`kyc_booking_freebusy_claim`, migration
 * 20260914090000) et l'écriture gardée par le bail du gestionnaire (`.eq('lease_id', bail)`) :
 * vérifier l'une sans l'autre prouverait une propriété que la production n'a pas.
 * Chaque refus a son témoin juste en deçà — une lecture qui refuserait TOUT passerait les
 * tests de refus, pas ceux-là.
 */
import { describe, it, expect } from 'vitest'
import {
  ATTENTE_ESSAIS,
  ATTENTE_PAS_MS,
  DECALAGE_TOLERE_MS,
  FREEBUSY_TTL_MS,
  FREEBUSY_TTL_S,
  borneALaCouverture,
  champsInstantane,
  fenetreDeLecture,
  lireInstantane,
  occupationsExternes,
  type ChampsInstantane,
  type DependancesInstantane,
  type LigneInstantane,
} from './booking-freebusy-cache.ts'
import { computeSlots, type BookingSettings } from './booking-slots.ts'
import type { ExternalBusyResult } from './booking-freebusy.ts'

const T0 = Date.parse('2026-09-14T09:00:00.000Z')
const H = 3_600_000
const REGLAGES = { max_advance_days: 30, slot_minutes: 30, buffer_minutes: 15 }
const B1 = { start: T0 + 26 * H, end: T0 + 27 * H }
const LIBRE: ExternalBusyResult = { ok: true, busy: [B1], providers: ['google'] }

/** Une ligne servable écrite à `luA` — la forme que l'edge écrit, passée par jsonb. */
function ligneEcrite(res: ExternalBusyResult, luA: number): LigneInstantane {
  const champs = champsInstantane(res, fenetreDeLecture(luA, REGLAGES), luA)
  return JSON.parse(JSON.stringify(champs)) as LigneInstantane
}

describe('durée de vie', () => {
  it('60 s, et la base reçoit la même valeur en secondes', () => {
    expect(FREEBUSY_TTL_MS).toBe(60_000)
    expect(FREEBUSY_TTL_S).toBe(60)
    expect(Number.isInteger(FREEBUSY_TTL_S)).toBe(true)
  })

  it('l’attente d’un instantané tenu ailleurs reste bien en deçà de la fenêtre', () => {
    expect(ATTENTE_ESSAIS * ATTENTE_PAS_MS).toBe(4_000)
    expect(ATTENTE_ESSAIS * ATTENTE_PAS_MS).toBeLessThan(FREEBUSY_TTL_MS)
  })
})

describe('lireInstantane — frais, ou absent ; jamais « aucune occupation » par défaut', () => {
  it('rien à lire : pas de ligne, ou un bail posé sans instantané', () => {
    expect(lireInstantane(null, T0)).toBeNull()
    expect(lireInstantane({ fetched_at: null, window_from: null, window_to: null, ok: null, provider: null, busy: [] }, T0)).toBeNull()
  })

  it('TÉMOIN — servi à l’âge 0 et à la dernière milliseconde de la fenêtre', () => {
    const l = ligneEcrite(LIBRE, T0)
    expect(lireInstantane(l, T0)?.occupations).toEqual({ ok: true, busy: [B1] })
    expect(lireInstantane(l, T0 + FREEBUSY_TTL_MS - 1)?.occupations).toEqual({ ok: true, busy: [B1] })
  })

  it('périmé à 60 s pile : la requête reprendra le bail au lieu de servir', () => {
    expect(lireInstantane(ligneEcrite(LIBRE, T0), T0 + FREEBUSY_TTL_MS)).toBeNull()
  })

  it('écrit « dans le futur » : toléré jusqu’à 5 s d’écart d’horloge, illisible au-delà', () => {
    const l = ligneEcrite(LIBRE, T0)
    expect(lireInstantane(l, T0 - DECALAGE_TOLERE_MS)).not.toBeNull()
    expect(lireInstantane(l, T0 - DECALAGE_TOLERE_MS - 1)).toBeNull()
  })

  it('la couverture rendue est la fenêtre lue chez le fournisseur', () => {
    expect(lireInstantane(ligneEcrite(LIBRE, T0), T0)?.couvertJusqua).toBe(fenetreDeLecture(T0, REGLAGES).toMs)
  })

  it('« injoignable » se sert comme tel — c’est lui aussi qu’on met en cache', () => {
    const l = ligneEcrite({ ok: false, degraded: 'provider_unreachable', provider: 'outlook' }, T0)
    expect(lireInstantane(l, T0)?.occupations).toEqual({ ok: false, provider: 'outlook' })
    expect(lireInstantane({ ...l, provider: null }, T0)?.occupations).toEqual({ ok: false, provider: 'unknown' })
  })

  it('une borne malformée écarte TOUT l’instantané — en retirer une plage proposerait un créneau pris', () => {
    const l = ligneEcrite(LIBRE, T0)
    const avec = (busy: unknown): LigneInstantane => ({ ...l, busy })
    expect(lireInstantane(avec('[]'), T0)).toBeNull()
    expect(lireInstantane(avec([B1, { start: String(B1.start), end: B1.end }]), T0)).toBeNull()
    expect(lireInstantane(avec([B1, { start: B1.end, end: B1.start }]), T0)).toBeNull()
    expect(lireInstantane(avec([B1, null]), T0)).toBeNull()
    expect(lireInstantane(avec([{ start: null, end: 5 }]), T0)).toBeNull()
    // Témoin : la même ligne, bornes propres, se sert.
    expect(lireInstantane(avec([B1, { start: B1.end, end: B1.end + H }]), T0)?.occupations)
      .toEqual({ ok: true, busy: [B1, { start: B1.end, end: B1.end + H }] })
  })

  it('une fenêtre illisible ou vide écarte l’instantané', () => {
    const l = ligneEcrite(LIBRE, T0)
    expect(lireInstantane({ ...l, window_to: 'pas une date' }, T0)).toBeNull()
    expect(lireInstantane({ ...l, window_to: l.window_from }, T0)).toBeNull()
    expect(lireInstantane({ ...l, fetched_at: null }, T0)).toBeNull()
  })
})

describe('fenetreDeLecture et borneALaCouverture — on ne propose que ce qu’on a vu', () => {
  const settings: BookingSettings = {
    is_open: true, timezone: 'Europe/Zurich', slot_minutes: 30, buffer_minutes: 15,
    min_notice_hours: 0, max_advance_days: 30,
    weekly_hours: Object.fromEntries(['1', '2', '3', '4', '5', '6', '7'].map((d) => [d, [['00:00', '23:30']]])) as BookingSettings['weekly_hours'],
  }

  it('l’horizon, plus un créneau et son battement, plus la durée de vie', () => {
    const f = fenetreDeLecture(T0, REGLAGES)
    expect(f.fromMs).toBe(T0)
    expect(f.toMs).toBe(T0 + 30 * 24 * H + 45 * 60_000 + FREEBUSY_TTL_MS)
  })

  it('TÉMOIN — en régime établi, aucun créneau n’est rogné, même servi à la dernière milliseconde', () => {
    const couvert = fenetreDeLecture(T0, settings).toMs
    const tard = T0 + FREEBUSY_TTL_MS - 1
    const slots = computeSlots({ settings, busy: [], nowMs: tard })
    expect(slots.length).toBeGreaterThan(1000)
    expect(borneALaCouverture(slots, couvert, settings.buffer_minutes)).toEqual(slots)
  })

  it('après un allongement de l’horizon, les jours que le fournisseur n’a pas décrits sont retirés', () => {
    const couvert = fenetreDeLecture(T0, settings).toMs // instantané pris à 30 jours
    const plusLoin = { ...settings, max_advance_days: 60 }
    const slots = computeSlots({ settings: plusLoin, busy: [], nowMs: T0 })
    const gardes = borneALaCouverture(slots, couvert, plusLoin.buffer_minutes)
    expect(gardes.length).toBeGreaterThan(0)
    expect(gardes.length).toBeLessThan(slots.length)
    for (const s of gardes) expect(Date.parse(s.end) + 15 * 60_000).toBeLessThanOrEqual(couvert)
  })
})

// ─── Le bail : un appel au fournisseur au plus par fenêtre ─────────────────────

type LigneFausse = LigneInstantane & { lease_id: string; claimed_at: number }

/**
 * La table et le bail, en mémoire. `prendreBail` est la règle de `kyc_booking_freebusy_claim` —
 * accordé si aucune ligne, ou si le dernier bail a au moins une durée de vie ; ATOMIQUE, comme
 * l'ON CONFLICT : aucune suspension entre la lecture et l'écriture. `ecrire` ne porte que sous
 * le bail courant, comme l'`update … .eq('lease_id', bail)` du gestionnaire.
 */
function fausseBase(horloge: { t: number }) {
  let ligne: LigneFausse | null = null
  let n = 0
  const pause = () => new Promise<void>((r) => setTimeout(r, 0))
  return {
    ligne: () => ligne,
    poser: (l: LigneFausse | null) => { ligne = l },
    lire: async (): Promise<LigneInstantane | null> => {
      await pause()
      return ligne ? { ...ligne } : null
    },
    prendreBail: async (): Promise<string | null> => {
      await pause()
      if (!ligne) {
        ligne = { lease_id: `bail-${++n}`, claimed_at: horloge.t, fetched_at: null, window_from: null, window_to: null, ok: null, provider: null, busy: [] }
        return ligne.lease_id
      }
      if (ligne.claimed_at <= horloge.t - FREEBUSY_TTL_MS) {
        ligne = { ...ligne, lease_id: `bail-${++n}`, claimed_at: horloge.t }
        return ligne.lease_id
      }
      return null
    },
    ecrire: async (bail: string, champs: ChampsInstantane): Promise<void> => {
      await pause()
      if (ligne && ligne.lease_id === bail) ligne = { ...ligne, ...JSON.parse(JSON.stringify(champs)) as ChampsInstantane }
    },
    /** Ce que font appointment-book et appointment-manage après l'écho : la ligne part. */
    jeter: () => { ligne = null },
  }
}

function monter(opts: {
  horloge?: { t: number }
  reponse?: () => Promise<ExternalBusyResult>
} = {}) {
  const horloge = opts.horloge ?? { t: T0 }
  const base = fausseBase(horloge)
  const appels: Array<{ from: string; to: string }> = []
  const attentes: number[] = []
  const deps: DependancesInstantane = {
    lire: base.lire,
    prendreBail: base.prendreBail,
    interroger: async (from, to) => {
      appels.push({ from, to })
      return opts.reponse ? opts.reponse() : LIBRE
    },
    ecrire: base.ecrire,
    attendre: async (ms) => {
      attentes.push(ms)
      await new Promise((r) => setTimeout(r, 2))
    },
    maintenant: () => horloge.t,
  }
  return { horloge, base, appels, attentes, deps }
}

describe('occupationsExternes — le bail borne les appels au fournisseur', () => {
  it('sans ligne : UN appel, sur la fenêtre de l’horizon entier, et l’instantané est écrit sous le bail', async () => {
    const m = monter()
    const r = await occupationsExternes(m.deps, REGLAGES)
    expect(r?.occupations).toEqual({ ok: true, busy: [B1] })
    expect(m.appels).toEqual([{
      from: new Date(T0).toISOString(),
      to: new Date(fenetreDeLecture(T0, REGLAGES).toMs).toISOString(),
    }])
    expect(m.base.ligne()?.ok).toBe(true)
    expect(m.base.ligne()?.fetched_at).toBe(new Date(T0).toISOString())
  })

  it('dans la fenêtre : servi depuis l’instantané, sans rappeler — puis rappelé une fois la fenêtre échue', async () => {
    const m = monter()
    await occupationsExternes(m.deps, REGLAGES)
    m.horloge.t = T0 + FREEBUSY_TTL_MS - 1
    expect((await occupationsExternes(m.deps, REGLAGES))?.occupations).toEqual({ ok: true, busy: [B1] })
    expect(m.appels).toHaveLength(1)
    m.horloge.t = T0 + FREEBUSY_TTL_MS
    await occupationsExternes(m.deps, REGLAGES)
    expect(m.appels).toHaveLength(2)
  })

  it('RAFALE — vingt-cinq requêtes simultanées : UN appel, et toutes servies du même résultat', async () => {
    const m = monter({ reponse: () => new Promise((r) => setTimeout(() => r(LIBRE), 20)) })
    const rs = await Promise.all(Array.from({ length: 25 }, () => occupationsExternes(m.deps, REGLAGES)))
    expect(m.appels).toHaveLength(1)
    for (const r of rs) expect(r?.occupations).toEqual({ ok: true, busy: [B1] })
    // Témoin : les vingt-quatre autres ont bien ATTENDU l'instantané, elles ne l'ont pas trouvé d'emblée.
    expect(m.attentes.length).toBeGreaterThanOrEqual(24)
  })

  it('bail tenu ailleurs, instantané jamais écrit (porteur tombé) : « injoignable » après l’attente, sans appeler', async () => {
    const m = monter()
    m.base.poser({ lease_id: 'bail-autre', claimed_at: T0, fetched_at: null, window_from: null, window_to: null, ok: null, provider: null, busy: [] })
    expect(await occupationsExternes(m.deps, REGLAGES)).toBeNull()
    expect(m.appels).toHaveLength(0)
    expect(m.attentes).toEqual(Array(ATTENTE_ESSAIS).fill(ATTENTE_PAS_MS))
  })

  it('« injoignable » est mis en cache : la fenêtre ne rappelle pas un agenda en panne', async () => {
    const m = monter({ reponse: async () => ({ ok: false, degraded: 'provider_unreachable', provider: 'google' }) })
    expect((await occupationsExternes(m.deps, REGLAGES))?.occupations).toEqual({ ok: false, provider: 'google' })
    m.horloge.t = T0 + 30_000
    expect((await occupationsExternes(m.deps, REGLAGES))?.occupations).toEqual({ ok: false, provider: 'google' })
    expect(m.appels).toHaveLength(1)
  })

  it('une panne réseau vers le fournisseur vaut « injoignable », en cache elle aussi', async () => {
    const m = monter({ reponse: async () => { throw new TypeError('fetch failed') } })
    expect((await occupationsExternes(m.deps, REGLAGES))?.occupations).toEqual({ ok: false, provider: 'unknown' })
    await occupationsExternes(m.deps, REGLAGES)
    expect(m.appels).toHaveLength(1)
  })

  it('instantané JETÉ pendant l’appel (réservation) : le résultat d’avant ne redevient pas l’instantané', async () => {
    let liberer: (r: ExternalBusyResult) => void = () => {}
    let premier = true
    // Le premier appel reste suspendu jusqu'à `liberer` ; les suivants répondent aussitôt.
    const reponse = (): Promise<ExternalBusyResult> => {
      if (!premier) return Promise.resolve(LIBRE)
      premier = false
      return new Promise((r) => { liberer = r })
    }
    const m = monter({ reponse })
    const enVol = occupationsExternes(m.deps, REGLAGES)
    while (m.appels.length === 0) await new Promise((r) => setTimeout(r, 1))
    m.base.jeter()
    liberer(LIBRE)
    // La requête en vol garde SON résultat…
    expect((await enVol)?.occupations).toEqual({ ok: true, busy: [B1] })
    // … mais ne l'a pas réécrit : son bail est mort avec la ligne.
    expect(m.base.ligne()).toBeNull()
    // Témoin : la requête suivante relit bien l'agenda.
    await occupationsExternes(m.deps, REGLAGES)
    expect(m.appels).toHaveLength(2)
  })

  it('bail repris par une autre requête pendant l’appel : l’écriture du premier porteur ne porte pas', async () => {
    let liberer: (r: ExternalBusyResult) => void = () => {}
    const m = monter({ reponse: () => new Promise((r) => { liberer = r }) })
    const enVol = occupationsExternes(m.deps, REGLAGES)
    while (m.appels.length === 0) await new Promise((r) => setTimeout(r, 1))
    m.base.poser({ ...m.base.ligne()!, lease_id: 'bail-suivant' })
    liberer(LIBRE)
    await enVol
    expect(m.base.ligne()?.lease_id).toBe('bail-suivant')
    expect(m.base.ligne()?.ok).toBeNull()
  })

  it('une écriture ratée ne prive pas la requête du résultat qu’elle vient de payer', async () => {
    const m = monter()
    const deps: DependancesInstantane = { ...m.deps, ecrire: async () => { throw new Error('base indisponible') } }
    expect((await occupationsExternes(deps, REGLAGES))?.occupations).toEqual({ ok: true, busy: [B1] })
  })
})
