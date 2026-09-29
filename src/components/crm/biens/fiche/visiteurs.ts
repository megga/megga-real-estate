/**
 * « Planifier une visite » depuis la fiche d'un mandat (`PlanifierVisite`) — les règles, PURES : qui proposer comme
 * visiteur, à qui préparer un message de confirmation, ce que fait la création. Ni React, ni Supabase, ni traduction.
 *
 * Lot E1 (conception §5.6, décision 9c) : la règle du fil et du copilote WhatsApp (`wa_matching_visite`), une seule.
 *   · Un acquéreur COMPATIBLE du mandat (`useQuiPourCeBien`) sans deal ouvert dessus reste proposé, mais rien ne lui
 *     est préparé : ni message, ni rappel la veille. « Intéressé », son match passe « visite planifiée » et son deal
 *     s'ouvre ou avance, par l'écrivain du fil (`execPlanifierVisite`) ; à proposer, proposé ou déjà en visite, son match
 *     ne bouge pas — sa réponse se consigne dans le fil.
 *   · Un acheteur en deal OUVERT sur ce bien garde le message et le rappel, et sa visite rejoint son deal — SAUF s'il est
 *     un acquéreur INTÉRESSÉ du matching : il suit alors la règle du fil, comme sur WhatsApp (décision de Julien du
 *     29.09.2026) — son match passe « visite planifiée », sa visite rejoint son deal, et rien ne lui est préparé. Tant
 *     que ses compatibles ne sont pas lus, on ne sait pas s'il en est un : rien ne part.
 *   · Un mandat qui n'est plus en vente ne propose plus ses acquéreurs compatibles : seuls ses acheteurs en deal ouvert.
 * Un visiteur hors du matching (un contact du carnet sans match compatible, un visiteur créé sur place) garde le
 * message et le rappel : la règle vise ce que produit le matching, pas la confirmation d'une visite (conception §3.1).
 *
 * ⚠ « Perdu » n'est pas un statut de deal : c'est l'étape `lost` — « Marquer perdu » du Pipeline n'écrit qu'elle, le
 * statut reste `active`. Un deal ouvert se lit donc sur les deux : `dealOuvert` (`src/lib/dealOuvert.ts`), la règle des
 * gestes du matching et du copilote WhatsApp, une seule.
 */
import type { Compatible } from '@/components/matching-fil/filQuiPour'
import { dealOuvert } from '@/lib/dealOuvert'
import type { AcheteurGeste } from '@/lib/matchingGestes'
import type { Enums } from '@/types/database'

/** Un deal du bien, tel que la fiche le lit (`useTransactions`, filtré sur le bien, le plus récent d'abord). */
export interface DealDuBien {
  id: string
  contact_buyer_id: string | null
  status: Enums<'transaction_status'>
  stage: Enums<'transaction_stage'>
}

/** Ce que la fiche d'un mandat sait des gens liés au bien. */
export interface ContexteVisite {
  /** Ses deals, tout statut. */
  deals: readonly DealDuBien[]
  /**
   * Ses acquéreurs compatibles (`useQuiPourCeBien`), quel que soit l'état du mandat ; `null` tant qu'ils ne sont pas lus
   * (ou si la lecture a échoué) — on ne sait pas encore qui est un acquéreur du matching.
   */
  compatibles: readonly Compatible[] | null
  /** En vente (`active`, la règle du fil) : ses acquéreurs compatibles se proposent encore. */
  enVente: boolean
}

/** Une personne déjà liée au bien : acheteur d'un deal ouvert, ou acquéreur compatible. */
export interface VisiteurLie {
  contactId: string
  nom: string
  /** Deal OUVERT de ce contact sur ce bien : la visite s'y rattache. */
  dealId?: string | null
  /** Score du moteur, pour un acquéreur compatible. */
  score?: number | null
}

/**
 * Ce que fait la création. `fil` : l'écrivain du fil d'abord (`execPlanifierVisite`), pour un acquéreur INTÉRESSÉ — son
 * match passe « visite planifiée », son deal s'ouvre ou avance, et le rappel la veille ne part pas. Sinon, ou s'il ne
 * l'est plus quand la visite s'écrit, la visite seule (`useCreateAgentVisit`) : rattachée à `dealId`, et avec le rappel
 * la veille si `rappelVeille` — la règle du message pré-rempli (`preRemplissagePermis`).
 */
export interface CreationVisite {
  fil: AcheteurGeste | null
  dealId: string | null
  rappelVeille: boolean
}

/** Le deal ouvert d'un contact sur ce bien, le plus récent. */
const dealOuvertDe = (contactId: string, c: ContexteVisite): DealDuBien | null =>
  c.deals.find((d) => d.contact_buyer_id === contactId && dealOuvert(d)) ?? null

/** Les acquéreurs du matching : les compatibles sans deal ouvert sur ce bien. */
const acquereurs = (c: ContexteVisite): Compatible[] =>
  (c.compatibles ?? []).filter((m) => dealOuvertDe(m.acheteur.id, c) == null)

/** Le match compatible d'un contact sur ce bien, qu'il ait un deal ouvert ou non. */
const compatibleDe = (contactId: string, c: ContexteVisite): Compatible | null =>
  c.compatibles?.find((m) => m.acheteur.id === contactId) ?? null

/** Un acquéreur INTÉRESSÉ : sa visite est celle du fil, deal ouvert ou non. */
const interesse = (m: Compatible | null): m is Compatible => m?.suivi?.statut === 'interested'

/**
 * Qui proposer d'abord : les acheteurs en deal ouvert sur ce bien, puis ses acquéreurs compatibles s'il est en vente.
 * Un contact n'y figure qu'une fois, à sa première place. `nomDe` : son nom dans le carnet, `null` s'il n'y est pas —
 * un acheteur qu'on ne peut pas nommer n'est pas proposé.
 */
export function visiteursLies(c: ContexteVisite, nomDe: (contactId: string) => string | null): VisiteurLie[] {
  const enDeal = c.deals.filter(dealOuvert).flatMap((d) => {
    const nom = d.contact_buyer_id ? nomDe(d.contact_buyer_id) : null
    return d.contact_buyer_id && nom != null ? [{ contactId: d.contact_buyer_id, nom, dealId: d.id }] : []
  })
  const compatibles = c.enVente
    ? acquereurs(c).map((m) => ({ contactId: m.acheteur.id, nom: `${m.acheteur.prenom} ${m.acheteur.nom}`.trim(), score: m.score }))
    : []
  return [...enDeal, ...compatibles].filter((l, i, tous) => tous.findIndex((x) => x.contactId === l.contactId) === i)
}

/**
 * Le message de confirmation pré-rempli : refusé à un acquéreur du matching, qu'il ait été choisi dans « Sur ce bien »
 * ou dans le carnet, sur un mandat en vente ou non — rien du matching ne part vers l'acheteur ; gardé pour un acheteur
 * en deal ouvert, sauf s'il est un acquéreur INTÉRESSÉ. `null` : un visiteur créé sur place, hors du matching.
 * ⚠ Tant que les compatibles ne sont pas lus, seul un visiteur créé sur place y a droit : on ne sait pas si un contact,
 * acheteur en deal compris, est un acquéreur du matching, et rien ne part.
 */
export function preRemplissagePermis(contactId: string | null, c: ContexteVisite): boolean {
  if (contactId == null) return true
  if (c.compatibles == null) return false
  const compatible = compatibleDe(contactId, c)
  return dealOuvertDe(contactId, c) != null ? !interesse(compatible) : compatible == null
}

/**
 * Ce que fait la création de la visite d'un contact (cf. `CreationVisite`) ; `null` : un visiteur créé sur place, qui n'a
 * ni deal ni match.
 */
export function creationVisite(contactId: string | null, c: ContexteVisite): CreationVisite {
  const deal = contactId == null ? null : dealOuvertDe(contactId, c)
  const acquereur = contactId == null ? null : compatibleDe(contactId, c)
  return {
    // L'écrivain du fil rattache la visite au deal ouvert SUR CE BIEN (`dealId`), sinon au deal ouvert le plus récent de
    // l'acheteur (`rattacherDeal`) ; `dealId` sert aussi si le match n'est plus « intéressé » quand la visite s'écrit.
    fil: interesse(acquereur)
      ? { id: acquereur.acheteur.id, matchId: acquereur.id, first: acquereur.acheteur.prenom, last: acquereur.acheteur.nom, score: acquereur.score }
      : null,
    dealId: deal?.id ?? null,
    rappelVeille: preRemplissagePermis(contactId, c),
  }
}
