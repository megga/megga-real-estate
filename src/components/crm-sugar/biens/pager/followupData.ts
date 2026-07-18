// MEGGA CRM Sugar v2 — Mes biens · « À suivre » — dérivation des files d'action
// Port fidèle du handoff Claude Design (crm-screen-biens-proto.jsx, BpFollowupPage).
//
// « L'Aujourd'hui de l'inventaire » : ce que le portefeuille réclame maintenant,
// calculé depuis les VRAIES données du bien. Une ligne = un bien.
//
// Honnêteté (cf. cerveau / mandate-diffusion-reality) :
//   - mandats  : échéance de mandat réelle (`mandate_expires_at`). Le cron
//                d'auto-dépublication à l'échéance est dormant → l'échéance est
//                un signal INFORMATIF, pas une menace de retrait automatique.
//   - drafts   : `status === 'draft'` réel.
//   - diffusion: Immobilier.ch — table `property_syndications` réelle mais
//                go-live BLOQUÉ sur les accès FTP du tiers (`idx_enabled` défaut
//                false). Le bucket n'apparaît QUE si `idxEnabled` est vrai, sinon
//                il reste dormant (pas de bouton « Diffuser » qui ne peut aboutir).

import type { CrmBien } from '@/components/crm-sugar/mockData'

export type FollowBucketId = 'mandates' | 'drafts' | 'diffusion'

export interface FollowRow {
  b: CrmBien
  /** Bucket mandats : jours avant échéance (peut être négatif si déjà expiré). */
  days?: number
  /** Bucket mandats : urgence (≤ 30 j). */
  urgent?: boolean
}

export interface FollowBucket {
  id: FollowBucketId
  rows: FollowRow[]
}

/** Jours calendaires (arrondi haut) entre `now` et une date ISO. */
export function bpDaysUntil(iso: string, now: Date): number {
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000)
}

/** Nouvelle échéance = date de base + N mois, avec clamp fin-de-mois (31 août
 *  + 6 mois → 28/29 fév, pas 3 mars — évite le débordement de setMonth). */
export function bpAddMonths(from: Date, months: number): Date {
  const d = new Date(from)
  const day = d.getDate()
  d.setMonth(d.getMonth() + months)
  // setMonth a débordé sur le mois suivant (le mois cible n'a pas ce jour) → recale
  // sur le dernier jour du mois voulu.
  if (d.getDate() !== day) d.setDate(0)
  return d
}

/**
 * Clé i18n + compteur pour un délai d'échéance de mandat (jours). Distingue
 * l'échéance à venir, aujourd'hui, et dépassée — évite d'afficher « Expire dans
 * -N j » pour un mandat déjà expiré (le cron d'auto-dépublication étant dormant,
 * un bien actif peut légitimement porter une échéance passée).
 */
export function expiryLabelKey(days: number): {
  key: 'expiresIn' | 'expiredSince' | 'expiresToday'
  count: number
} {
  if (days < 0) return { key: 'expiredSince', count: -days }
  if (days === 0) return { key: 'expiresToday', count: 0 }
  return { key: 'expiresIn', count: days }
}

/** Échéance de mandat au format long FR-CH (« 22 août 2026 »). */
export function bpFmtDate(d: Date, locale = 'fr-CH'): string {
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

export interface DeriveFollowOpts {
  now: Date
  /** Diffusion Immobilier.ch active pour l'agence (agency_syndication_config.idx_enabled). */
  idxEnabled?: boolean
}

/**
 * Construit les files « À suivre » depuis les biens réels. N'inclut QUE les
 * buckets non vides (le feed est volume-adaptatif côté UI). Fenêtre mandats : 60 j.
 */
export function deriveFollowBuckets(biens: CrmBien[], opts: DeriveFollowOpts): FollowBucket[] {
  const { now, idxEnabled = false } = opts
  const out: FollowBucket[] = []

  // Mandats à renouveler — biens vivants (actif/réservé) dont l'échéance ≤ 60 j.
  const expiring = biens
    .filter(
      (b) =>
        b.mandat?.expiresAt &&
        (b.status === 'active' || b.status === 'reserved'),
    )
    .map((b) => ({ b, days: bpDaysUntil(b.mandat.expiresAt as string, now) }))
    .filter((x) => x.days <= 60)
    .sort((a, c) => a.days - c.days)
  if (expiring.length) {
    out.push({
      id: 'mandates',
      rows: expiring.map(({ b, days }) => ({ b, days, urgent: days <= 30 })),
    })
  }

  // Brouillons à finaliser.
  const drafts = biens.filter((b) => b.status === 'draft')
  if (drafts.length) out.push({ id: 'drafts', rows: drafts.map((b) => ({ b })) })

  // À diffuser sur Immobilier.ch — dormant tant que le canal n'est pas ouvert.
  if (idxEnabled) {
    const toDiffuse = biens.filter((b) => b.status === 'active' || b.status === 'reserved')
    if (toDiffuse.length) out.push({ id: 'diffusion', rows: toDiffuse.map((b) => ({ b })) })
  }

  return out
}
