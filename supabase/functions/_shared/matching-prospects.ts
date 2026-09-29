// Matching — les ANCIENS PROSPECTS d'un bien (lot C, « Qui pour ce bien ? »). Fonctions PURES, comme
// matching-normalize.ts : zéro I/O, zéro API Deno — réutilisées par l'edge matching-engine (modes `prospects`
// et `reactiver-prospect`) ET par les tests vitest (Node).
//
// Conception : docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md, §4.2, §10 n° 6 et §13.
//
// Un ancien prospect est un acheteur dont la recherche est CLOSE (`is_active = false`) depuis plus de 90 jours,
// ou dont un deal a été perdu dans les 24 derniers mois, et qui n'a encore RIEN sur ce bien : ni match (écarté,
// refusé ou proposé, il dit déjà ce que l'agent en pense), ni deal (perdu SUR CE BIEN, c'est ce bien-là qui n'a
// pas convenu) — l'edge les réunit dans `dejaSurCeBien`. Le moteur ne le note plus (il ne lit que les
// recherches actives) ; ce module le note À LA DEMANDE, au même barème, au même seuil, derrière le même
// pré-filtre qu'à la création : la transaction pour un mandat (`buildInternalRows`), `annonceRetenue` pour une
// annonce du marché.
//
// ⚠ Une recherche fermée il y a MOINS de 90 jours, sans deal perdu, n'en fait pas un : l'acheteur vient de
// s'arrêter (il a acheté ailleurs, ou il fait une pause), et le lui reproposer tout de suite serait du bruit.

import { calculateScoreV2, inferTransactionType, type MatchReasons, type ScoringConfig } from './matching-normalize.ts'
import { annonceRetenue } from './matching-renotation.ts'
import type { RentPosition } from './rent-reference.ts'

/** Une recherche close depuis plus de 90 jours fait un ancien prospect. */
export const JOURS_RECHERCHE_CLOSE = 90
/** Un deal perdu dans les 24 derniers mois fait un ancien prospect, quelle que soit la date de sa recherche. */
export const MOIS_DEAL_PERDU = 24
/** Les 20 meilleurs : au-delà, la liste ne se lit plus. */
export const PROSPECTS_MAX = 20

const JOUR = 86_400_000

/** Une recherche close, telle que l'edge la lit. */
export interface RechercheClose {
  id: string
  contact_id: string
  criteria: Record<string, unknown> | null
  /** Posé par le pont à la fermeture (`sync_contact_client_search`) : la date de la clôture, au mieux. */
  updated_at: string | null
}

/** Un deal perdu (`transactions.stage = 'lost'`) d'un acheteur, daté par sa dernière écriture. */
export interface DealPerdu { contact_id: string; le: string }

export type OrigineProspect = 'recherche_close' | 'deal_perdu'

/** Une recherche close retenue, et ce qui en fait un ancien prospect. */
export type CandidatProspect = RechercheClose & { origine: OrigineProspect; depuis: string | null }

/** Un ancien prospect noté contre le bien ; l'edge y joint son nom. */
export interface ProspectNote {
  contact_id: string
  client_search_id: string
  score: number
  reasons: MatchReasons
  origine: OrigineProspect
  /** La perte du deal, sinon la clôture de la recherche. */
  depuis: string | null
}

const temps = (iso: string | null): number => (iso ? Date.parse(iso) : Number.NaN)

/** Le début de la fenêtre des deals perdus : 24 mois avant `maintenant`, au jour près. */
export function debutFenetreDeal(maintenant: number): number {
  const d = new Date(maintenant)
  d.setUTCMonth(d.getUTCMonth() - MOIS_DEAL_PERDU)
  return d.getTime()
}

/**
 * Les recherches closes qui font un ANCIEN PROSPECT de ce bien, et pourquoi. Un deal perdu l'emporte sur la
 * date de la recherche : c'est le signe le plus fort. Une date illisible ne qualifie rien.
 */
export function candidatsProspects(
  recherches: readonly RechercheClose[],
  dealsPerdus: readonly DealPerdu[],
  dejaSurCeBien: ReadonlySet<string>,
  maintenant: number,
): CandidatProspect[] {
  const debutDeals = debutFenetreDeal(maintenant)
  const perdus = new Map<string, string>()
  for (const d of dealsPerdus) {
    const t = temps(d.le)
    if (!(t >= debutDeals && t <= maintenant)) continue
    const avant = perdus.get(d.contact_id)
    if (!avant || temps(avant) < t) perdus.set(d.contact_id, d.le)
  }
  const finClose = maintenant - JOURS_RECHERCHE_CLOSE * JOUR
  const candidats: CandidatProspect[] = []
  for (const r of recherches) {
    if (!r.criteria || dejaSurCeBien.has(r.contact_id)) continue
    const perdu = perdus.get(r.contact_id)
    if (perdu) candidats.push({ ...r, origine: 'deal_perdu', depuis: perdu })
    else if (temps(r.updated_at) <= finClose) candidats.push({ ...r, origine: 'recherche_close', depuis: r.updated_at })
  }
  return candidats
}

/**
 * Les candidats NOTÉS contre le bien : le pré-filtre du moteur, puis son barème et son seuil ; la meilleure
 * recherche par acheteur ; par score décroissant, {@link PROSPECTS_MAX} au plus.
 */
export function noterProspects(
  candidats: readonly CandidatProspect[],
  bien: Record<string, unknown>,
  marche: boolean,
  cfg: ScoringConfig,
  refLoyer: (annonce: Record<string, unknown>) => RentPosition | null,
  maintenant: number,
): ProspectNote[] {
  const meilleurs = new Map<string, ProspectNote>()
  for (const c of candidats) {
    if (!c.criteria) continue
    const tx = inferTransactionType(c.criteria)
    const retenu = marche
      ? annonceRetenue(bien, c.criteria, tx)
      : !(typeof bien.transaction_type === 'string' && bien.transaction_type !== tx)
    if (!retenu) continue
    const note = calculateScoreV2(bien, c.criteria, cfg, marche && tx === 'rent' ? refLoyer(bien) : null, maintenant)
    if (note.total < cfg.threshold) continue
    const avant = meilleurs.get(c.contact_id)
    if (avant && avant.score >= note.total) continue
    meilleurs.set(c.contact_id, {
      contact_id: c.contact_id, client_search_id: c.id, score: note.total, reasons: note.reasons, origine: c.origine, depuis: c.depuis,
    })
  }
  return [...meilleurs.values()]
    .sort((a, b) => b.score - a.score || a.contact_id.localeCompare(b.contact_id))
    .slice(0, PROSPECTS_MAX)
}
