/**
 * La boucle chez l'agent (lot B) — modèle de vue PUR des onglets « En attente » et « À conclure », des motifs
 * de refus et du signal « prix baissé ». Ni React, ni Supabase, ni traduction.
 *
 * Conception : `docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md`, §4.3 à §4.6 et §5.
 *
 * ⚠ « En attente » a UNE ligne par ACHETEUR, pas par bien : la feuille « Retours de … » liste tout ce qui
 * attend sa réponse, propositions confondues. Son échéance est la plus proche des relances qui couvrent ces
 * biens (`reminders.match_ids`, ou `match_id` pour une relance d'avant le lot B).
 *
 * ⛔ LE SIGNAL DE PRIX SE CALCULE SUR `prix_propose` SEULEMENT, posé par la base au geste « Je l'ai
 * proposé » (trigger `set_match_prix_propose`). Sans lui, pas de signal : le premier prix de l'annonce ne dit
 * rien de ce que l'acheteur a vu.
 *
 * ⚠ Lot E1 (décision 12a) : ces deux onglets GARDENT un mandat qui n'est plus en vente — une réponse en cours se
 * consigne encore — et écrivent son état (`cleEtatMandat`) ; « À proposer » ne le montre plus (`horsVente`).
 */
import { horsVente, passeFiltres, temps, type FilBien, type FilFiltres, type FilMatch } from './filModele'

/** Les trois onglets du fil, un par temps de la boucle (§5). */
export const ONGLETS = ['aProposer', 'enAttente', 'aConclure'] as const
export type FilOnglet = (typeof ONGLETS)[number]

/**
 * Les motifs d'un refus (§4.4) — un geste, une puce —, dans l'ordre de l'écran et de leurs touches (1 à 8).
 * ⚠ Les codes du CHECK `matches_reaction_motif_check` (migration 20260930140000), qui y ajoute
 * `recherche_ajustee` : un match écarté par la réévaluation d'une recherche, pas par l'acheteur.
 * ⚠ Recopiés par le copilote WhatsApp (lot D2, `_shared/whatsapp-matching.ts`), avec `signalPrix` :
 * `tests/unit/whatsapp-matching-fil.spec.ts` confronte les deux.
 */
export const MOTIFS_REFUS = ['prix', 'quartier', 'surface', 'pieces', 'type', 'equipements', 'etat', 'autre'] as const
export type MotifRefus = (typeof MOTIFS_REFUS)[number]

/**
 * La clé i18n d'un motif de refus (`fil.motifs.*`), ou `null` pour tout autre code — `recherche_ajustee` compris, qui
 * n'est pas une réponse de l'acheteur. Un motif ne s'affiche jamais en code brut (lot D1).
 */
export const cleMotif = (code: string | null | undefined): string | null =>
  (code && (MOTIFS_REFUS as readonly string[]).includes(code) ? `fil.motifs.${code}` : null)

/**
 * La clé i18n de l'état d'un mandat qui n'est plus en vente (lot E1), dans le vocabulaire de Mes biens
 * (`listings:status.*` : « Vendu », « Archivé », « Réservé », « Brouillon ») ; `null` pour un bien en vente ou une
 * annonce du marché. Pas de libellé propre au fil : l'état d'un bien se dit partout de la même façon.
 */
export const cleEtatMandat = (b: FilBien): string | null =>
  (horsVente(b) && b.statut ? `listings:status.${b.statut}` : null)

/** Une relance de proposition en cours (`reminders`), et les biens qu'elle couvre. */
export interface RelanceProposition { id: string; contactId: string; matchIds: string[]; echeance: string | null }

/** Une ligne d'« En attente » : un acheteur, ses biens proposés sans réponse, et sa relance. */
export interface FilAttente {
  acheteur: FilMatch['acheteur']
  /** Du plus récemment proposé au plus ancien. */
  matchs: FilMatch[]
  /** La plus proche des relances qui couvrent ces biens, ou `null`. */
  echeance: string | null
  /** La relance est échue. */
  due: boolean
}

/** L'identifiant d'une ligne d'« En attente » dans l'ordre du fil — distinct de tout id de match. */
export const cleAttente = (contactId: string): string => `attente:${contactId}`

/** L'onglet rangé dans l'onglet du CRM peut venir d'un schéma antérieur : tout ce qui n'en est pas un retombe sur « À proposer ». */
export const ongletValide = (v: unknown): FilOnglet =>
  ((ONGLETS as readonly unknown[]).includes(v) ? v as FilOnglet : 'aProposer')

/** Les identifiants DOM des onglets et de leur panneau unique (`tab` ↔ `tabpanel`), tirés d'un `useId` du fil. */
export interface IdsOnglets { onglet: (o: FilOnglet) => string; panneau: string }
export const idsOnglets = (base: string): IdsOnglets => ({
  onglet: (o) => `${base}-onglet-${o}`,
  panneau: `${base}-panneau`,
})

/**
 * « En attente » (§5) : les biens PROPOSÉS sans réponse, une ligne par acheteur ; les relances échues en
 * tête, puis la plus proche, puis les lignes sans relance.
 */
export function construireAttente(
  matchs: readonly FilMatch[], relances: readonly RelanceProposition[], filtres: FilFiltres, maintenant: number,
): FilAttente[] {
  const parAcheteur = new Map<string, FilMatch[]>()
  for (const m of matchs) {
    if (m.suivi?.statut !== 'sent' || !passeFiltres(m, filtres)) continue
    parAcheteur.set(m.acheteur.id, [...(parAcheteur.get(m.acheteur.id) ?? []), m])
  }
  const lignes: FilAttente[] = []
  for (const [contactId, ms] of parAcheteur) {
    const ids = new Set(ms.map((m) => m.id))
    const echeances = relances
      .filter((r) => r.contactId === contactId && r.echeance != null && r.matchIds.some((id) => ids.has(id)))
      .map((r) => r.echeance as string)
      .sort((a, b) => temps(a) - temps(b))
    const echeance = echeances[0] ?? null
    lignes.push({
      acheteur: ms[0]!.acheteur,
      matchs: [...ms].sort((a, b) =>
        temps(b.suivi?.proposeLe ?? null) - temps(a.suivi?.proposeLe ?? null) || b.score - a.score || a.id.localeCompare(b.id)),
      echeance,
      due: echeance != null && temps(echeance) <= maintenant,
    })
  }
  const nom = (l: FilAttente): string => `${l.acheteur.prenom} ${l.acheteur.nom}`
  return lignes.sort((a, b) =>
    (a.echeance == null ? 1 : 0) - (b.echeance == null ? 1 : 0)
    || temps(a.echeance) - temps(b.echeance)
    || temps(b.matchs[0]?.suivi?.proposeLe ?? null) - temps(a.matchs[0]?.suivi?.proposeLe ?? null)
    || nom(a).localeCompare(nom(b), 'fr'))
}

/**
 * « À conclure » (§5) : les biens qui INTÉRESSENT un acheteur et n'ont pas encore de visite, la réponse la plus
 * ancienne d'abord. Une réponse NON DATÉE (d'avant `set_match_response_at`, ou du banc, qui ne joue aucun
 * trigger) passe en dernier : datée à 0, elle passerait pour la plus ancienne.
 */
export function construireAConclure(matchs: readonly FilMatch[], filtres: FilFiltres): FilMatch[] {
  const quand = (m: FilMatch): number => temps(m.suivi?.reponduLe ?? null) || Number.POSITIVE_INFINITY
  return matchs
    .filter((m) => m.suivi?.statut === 'interested' && passeFiltres(m, filtres))
    .sort((a, b) => quand(a) - quand(b) || a.id.localeCompare(b.id))
}

/**
 * La baisse du prix d'un bien depuis qu'il a été proposé (§4.6) : depuis le REFUS pour un bien refusé pour le
 * prix et revenu à proposer (trigger `match_retour_prix_*`), depuis la PROPOSITION pour un bien sans réponse.
 * `null` sans baisse mesurée.
 *
 * ⛔ Un prix nul (« prix sur demande ») n'est pas une baisse : il écrivait « Prix baissé de CHF 1'490'000 »,
 * le prix proposé tout entier. Même règle que les triggers (`match_retour_prix_*`).
 */
export function signalPrix(m: FilMatch): { baisse: number; depuis: 'refus' | 'proposition' } | null {
  const s = m.suivi
  if (!s || s.prixPropose == null || m.bien.prix == null || m.bien.prix <= 0) return null
  const baisse = s.prixPropose - m.bien.prix
  if (baisse <= 0) return null
  if (s.statut === 'suggested' && s.motif === 'prix') return { baisse, depuis: 'refus' }
  if (s.statut === 'sent') return { baisse, depuis: 'proposition' }
  return null
}
