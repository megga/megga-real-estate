// supabase/functions/_shared/booking-freebusy-cache.ts
/**
 * Occupations EXTERNES de l'agent (freeBusy Google, getSchedule Graph), servies depuis un
 * instantané court : un appel au fournisseur AU PLUS par agent et par fenêtre de
 * FREEBUSY_TTL_MS — quel que soit le nombre de liens, de requêtes ou d'adresses IP.
 *
 * ⛔ POURQUOI (audit du 13.09.2026, constat laissé hors périmètre des PR #1308/#1319).
 * `appointment-slots` est public. Chaque appel déclenchait un appel au fournisseur sur
 * l'agenda de l'agent — plus un rafraîchissement OAuth dès que le jeton d'accès avait une
 * heure, le jeton rafraîchi n'étant jamais réécrit (booking-oauth.ts). Un lien transféré
 * suffisait à marteler les deux API au nom de l'agent, sans limite.
 *
 * CE QUI EST MIS EN CACHE, ET CE QUI NE L'EST JAMAIS.
 *   · Mis en cache : le RÉSULTAT de l'appel, et lui seul — des bornes début/fin (l'API ne rend
 *     ni titre ni lieu), ou le constat « injoignable », mis en cache LUI AUSSI : sans quoi un
 *     agenda en panne se laisserait marteler exactement comme avant.
 *   · JAMAIS en cache : l'occupation INTERNE (rendez-vous confirmés, visites, absences) ni les
 *     réglages. `kyc_booking_busy_ranges` est relue à chaque requête, et la RPC de réservation
 *     revalide tout au moment de réserver : un créneau pris dans MEGGA, par n'importe quel
 *     chemin, ne peut pas ressortir d'un instantané. Seul l'agenda EXTERNE peut avoir jusqu'à
 *     FREEBUSY_TTL_MS de retard — et la réservation ne le revérifie de toute façon pas.
 *
 * POURQUOI PAR AGENT ET NON PAR LIEN. L'appel porte sur l'agenda de l'AGENT, et son résultat
 * ne dépend pas du lien qui le demande. Une clé par lien laisserait K liens d'un même agent
 * déclencher K appels par fenêtre ; la clé par agent borne chaque lien ET leur somme. C'est
 * toujours le jeton qui ouvre la porte, jamais l'IP : l'IP ne protège pas un lien transféré
 * (même raisonnement que magic-link-limits.ts).
 *
 * POURQUOI UN BAIL, ET PAS SEULEMENT UN ÂGE. « Servi s'il a moins de N secondes » laisse passer
 * une RAFALE : cent requêtes parallèles trouvent toutes l'instantané périmé et appellent toutes
 * le fournisseur. Le bail (`kyc_booking_freebusy_claim`, migration 20260914090000) est accordé
 * atomiquement à UNE requête par fenêtre ; les autres attendent son instantané au lieu
 * d'appeler, et répondent « agenda injoignable » plutôt que d'appeler si rien ne vient.
 *
 * Module PUR : les E/S sont injectées (`DependancesInstantane`), rien de Deno n'est lu —
 * importable depuis Node (vitest). Les écritures restent dans le gestionnaire de chaque
 * fonction, où la porte `lint:edge-auth` les voit.
 */

import type { BookingSettings, BusyRange, Slot } from './booking-slots.ts'
import type { ExternalBusyResult } from './booking-freebusy.ts'

/**
 * Durée de vie d'un instantané — et donc du bail : 60 s.
 *
 *   · Ce que ça BORNE : un appel au fournisseur (plus, au pire, un rafraîchissement OAuth) par
 *     agent et par minute, soit 1 440 par jour au plus, au lieu d'un par requête.
 *   · Ce que ça COÛTE : l'agenda EXTERNE peut avoir une minute de retard dans la liste. La
 *     liste affichée est déjà un instantané qui vieillit pendant que le client choisit — la
 *     page la garde 30 s (`staleTime` de useAppointmentSlots) — et la réservation ne
 *     revérifie pas l'agenda externe : une minute reste de cet ordre.
 *   · Plus court (10 s) : six fois plus d'appels sous martèlement, pour une fraîcheur que la
 *     page elle-même ne demande pas. Plus long (5 min) : un créneau que l'agent vient de
 *     bloquer dans son agenda resterait proposé cinq minutes.
 */
export const FREEBUSY_TTL_MS = 60_000

/** La même durée, en secondes : c'est ce que reçoit le bail en base (`p_ttl_seconds`). */
export const FREEBUSY_TTL_S = FREEBUSY_TTL_MS / 1000

/**
 * Une requête qui trouve le bail pris attend l'instantané de celle qui le tient : une relecture
 * toutes les 250 ms, seize fois — 4 s au plus, largement au-delà d'un appel ordinaire au
 * fournisseur. Au-delà (fournisseur très lent, porteur du bail tombé), « agenda injoignable » :
 * jamais un créneau calculé sans l'agenda externe.
 */
export const ATTENTE_PAS_MS = 250
export const ATTENTE_ESSAIS = 16

/**
 * Écart d'horloge toléré entre l'instance edge qui a écrit l'instantané et celle qui le lit.
 * Au-delà, un `fetched_at` « dans le futur » est tenu pour illisible, pas pour frais.
 */
export const DECALAGE_TOLERE_MS = 5_000

/** Colonnes lues — exactement ce que `lireInstantane` sait valider. */
export const COLONNES_INSTANTANE = 'fetched_at, window_from, window_to, ok, provider, busy'

/** Une ligne de `kyc_booking_freebusy_cache`, telle que la lit l'edge. */
export interface LigneInstantane {
  fetched_at: string | null
  window_from: string | null
  window_to: string | null
  ok: boolean | null
  provider: string | null
  busy: unknown
}

/** Ce que l'edge écrit sous son bail. */
export interface ChampsInstantane {
  fetched_at: string
  window_from: string
  window_to: string
  ok: boolean
  provider: string | null
  busy: BusyRange[]
}

/** Le résultat utile au calcul — la forme de `ExternalBusyResult`, sans ce que personne ne lit. */
export type OccupationsExternes =
  | { ok: true; busy: BusyRange[] }
  | { ok: false; provider: string }

export interface InstantaneServi {
  occupations: OccupationsExternes
  /** Jusqu'où (ms epoch) l'agenda externe a été lu : aucun créneau ne se propose au-delà. */
  couvertJusqua: number
}

export type ReglagesFenetre = Pick<BookingSettings, 'max_advance_days' | 'slot_minutes' | 'buffer_minutes'>

/**
 * Fenêtre demandée au fournisseur : de maintenant à l'horizon de réservation, PLUS un créneau
 * et son battement (les derniers créneaux de l'horizon débordent de lui), PLUS la durée de vie
 * de l'instantané — pour qu'une requête servie à la dernière seconde voie encore son horizon
 * entier. La fenêtre ne dépend pas du `days` demandé : l'instantané sert toutes les requêtes
 * de l'agent.
 */
export function fenetreDeLecture(nowMs: number, reglages: ReglagesFenetre): { fromMs: number; toMs: number } {
  return {
    fromMs: nowMs,
    toMs: nowMs
      + reglages.max_advance_days * 86_400_000
      + (reglages.slot_minutes + reglages.buffer_minutes) * 60_000
      + FREEBUSY_TTL_MS,
  }
}

const estNombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/**
 * L'instantané servable, ou null : ligne absente, bail posé sans instantané, instantané
 * périmé ou illisible. Illisible est traité comme ABSENT, jamais comme « aucune occupation » :
 * une seule borne malformée écarte tout l'instantané, qui sera relu chez le fournisseur —
 * en retirer silencieusement une plage reviendrait à proposer un créneau pris.
 */
export function lireInstantane(ligne: LigneInstantane | null, nowMs: number): InstantaneServi | null {
  if (!ligne || typeof ligne.ok !== 'boolean') return null
  const lu = Date.parse(ligne.fetched_at ?? '')
  const de = Date.parse(ligne.window_from ?? '')
  const a = Date.parse(ligne.window_to ?? '')
  if (!estNombre(lu) || !estNombre(de) || !estNombre(a) || a <= de) return null

  const age = nowMs - lu
  if (age >= FREEBUSY_TTL_MS || age < -DECALAGE_TOLERE_MS) return null

  if (!ligne.ok) {
    return { occupations: { ok: false, provider: ligne.provider || 'unknown' }, couvertJusqua: a }
  }
  if (!Array.isArray(ligne.busy)) return null
  const busy: BusyRange[] = []
  for (const brut of ligne.busy as unknown[]) {
    const b = (brut ?? {}) as { start?: unknown; end?: unknown }
    if (!estNombre(b.start) || !estNombre(b.end) || b.end <= b.start) return null
    busy.push({ start: b.start, end: b.end })
  }
  return { occupations: { ok: true, busy }, couvertJusqua: a }
}

/** Le résultat du fournisseur, prêt à être écrit sous le bail. */
export function champsInstantane(
  resultat: ExternalBusyResult,
  fenetre: { fromMs: number; toMs: number },
  luA: number,
): ChampsInstantane {
  return {
    fetched_at: new Date(luA).toISOString(),
    window_from: new Date(fenetre.fromMs).toISOString(),
    window_to: new Date(fenetre.toMs).toISOString(),
    ok: resultat.ok,
    provider: resultat.ok ? null : resultat.provider,
    busy: resultat.ok ? resultat.busy.map((b) => ({ start: b.start, end: b.end })) : [],
  }
}

/**
 * Écarte les créneaux qui débordent de ce que l'agenda externe a couvert (battement compris).
 * Ne mord qu'après un allongement de l'horizon survenu dans la fenêtre : on ne propose que
 * ce qu'on a vu, jamais un créneau sur une journée que le fournisseur n'a pas décrite.
 */
export function borneALaCouverture(slots: Slot[], couvertJusqua: number, bufferMinutes: number): Slot[] {
  const bufferMs = bufferMinutes * 60_000
  return slots.filter((s) => Date.parse(s.end) + bufferMs <= couvertJusqua)
}

/** Les E/S, injectées par le gestionnaire. */
export interface DependancesInstantane {
  /** La ligne de l'agent, ou null (absente ou illisible). Ne jette pas. */
  lire: () => Promise<LigneInstantane | null>
  /** Le bail (`kyc_booking_freebusy_claim`) : son identifiant, ou null s'il est tenu ailleurs. Ne jette pas. */
  prendreBail: () => Promise<string | null>
  /** L'appel au fournisseur — `externalBusyRanges`. */
  interroger: (fromIso: string, toIso: string) => Promise<ExternalBusyResult>
  /** Écrit l'instantané SOUS le bail : sans effet si le bail a été repris ou invalidé entre-temps. */
  ecrire: (bail: string, champs: ChampsInstantane) => Promise<void>
  attendre: (ms: number) => Promise<void>
  maintenant: () => number
}

/**
 * Les occupations externes de l'agent : l'instantané s'il est frais ; sinon, sous bail, un
 * appel au fournisseur dont le résultat devient l'instantané ; sinon l'instantané qu'écrit le
 * porteur du bail. `null` quand rien n'est venu dans le temps d'attente — l'appelant répond
 * alors « agenda injoignable » (503), jamais des créneaux calculés sans l'agenda externe.
 */
export async function occupationsExternes(
  deps: DependancesInstantane,
  reglages: ReglagesFenetre,
): Promise<InstantaneServi | null> {
  for (let essai = 0; ; essai++) {
    const servi = lireInstantane(await deps.lire(), deps.maintenant())
    if (servi) return servi

    const bail = await deps.prendreBail()
    if (bail) {
      const luA = deps.maintenant()
      const fenetre = fenetreDeLecture(luA, reglages)
      let resultat: ExternalBusyResult
      try {
        resultat = await deps.interroger(new Date(fenetre.fromMs).toISOString(), new Date(fenetre.toMs).toISOString())
      } catch {
        // Une panne réseau vers le fournisseur est un fournisseur injoignable : elle se met en
        // cache comme lui, sinon chaque requête de la fenêtre la rejouerait.
        resultat = { ok: false, degraded: 'provider_unreachable', provider: 'unknown' }
      }
      try {
        await deps.ecrire(bail, champsInstantane(resultat, fenetre, luA))
      } catch {
        // L'instantané n'est qu'un cache : son écriture ratée ne prive pas CETTE requête du
        // résultat qu'elle vient de payer (`ecrire` journalise ses propres échecs).
      }
      return {
        occupations: resultat.ok ? { ok: true, busy: resultat.busy } : { ok: false, provider: resultat.provider },
        couvertJusqua: fenetre.toMs,
      }
    }

    if (essai >= ATTENTE_ESSAIS) return null
    await deps.attendre(ATTENTE_PAS_MS)
  }
}
