// supabase/functions/_shared/team-invite-guard.ts
//
// Les deux verrous de `send-team-invite`, côté edge : le PLAFOND DE SIÈGES du plan et le
// QUOTA D'ENVOI de l'agence. Leur vérité est en base
// (supabase/migrations/20260914090100_team_invite_seats_and_quota.sql) ; ce module lit leur
// verdict et le traduit en réponse HTTP.
//
// ⛔ CE QUI S'EST PASSÉ AVANT (constat du 13.09.2026). La fonction appelait
// `rpc('get_agency_member_count')`, absente de la production, IGNORAIT l'erreur, et le compte
// valait donc toujours 0 : la limite de membres ne bloquait jamais. Et aucun quota ne bornait
// l'envoi, alors que tout inscrit est admin de son agence solo. D'où la règle de ce module :
// un verdict ILLISIBLE REFUSE (503). Une invitation se reporte ; un relais ouvert ne se
// referme pas après coup.
//
// DEUX NATURES, DEUX INTERRUPTEURS :
//   · les sièges sont une LIMITE DE PLAN — inactive tant que `app_config.plan_limits_enforced`
//     ≠ 'true' (décision du 13.09.2026). La base rend `enforced`, on n'en décide pas ici ;
//   · le quota est un GARDE-FOU ANTI-ABUS — toujours actif (20 invitations et renvois par
//     agence et par 24 h, `app_config.team_invite_daily_cap`), et il compte aussi dans le
//     plafond commun des e-mails de l'agence (60/h, 300/j).
//
// Les codes d'erreur rendus sont STABLES : aucun écran ne les affiche aujourd'hui (la section
// Équipe des réglages a été retirée en #455, son recâblage est #456), mais c'est sur eux qu'il
// se branchera — `plan_limit_reached`, `invite_daily_cap`, `hourly_cap`, `daily_cap`,
// `quota_unavailable`, `seat_check_unavailable`.
//
// Module sans dépendance Deno : testé par `team-invite-guard.test.ts`.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** Texte de l'exception que lève le trigger `enforce_plan_seat_quota` (P0001). */
export const SEAT_LIMIT_EXCEPTION = 'plan_seat_limit'

/** L'état des sièges d'une agence, tel que la base le rend — ou illisible. */
export type SeatStatus =
  | { readable: true; enforced: boolean; plan: string; seatCap: number; seatsUsed: number }
  | { readable: false }

/** Un refus prêt à partir : statut HTTP et corps JSON. */
export interface GuardRefusal {
  status: 403 | 429 | 503
  body: Record<string, unknown>
}

const LIBELLE_PLAN: Readonly<Record<string, string>> = {
  starter: 'Starter',
  pro: 'Pro',
  entreprise: 'Entreprise',
}

/** Lit l'état des sièges (`team_seat_status`). Une RPC en erreur ou mal formée = illisible. */
export async function readSeatStatus(admin: SupabaseClient, agencyId: string): Promise<SeatStatus> {
  try {
    const { data, error } = await admin.rpc('team_seat_status', { p_agency_id: agencyId })
    if (error) throw new Error(error.message)
    const row = (data as Array<Record<string, unknown>> | null)?.[0]
    if (!row) throw new Error('état des sièges absent')
    const { enforced, plan, seat_cap, seats_used } = row
    if (
      typeof enforced !== 'boolean'
      || typeof plan !== 'string'
      || !Number.isInteger(seat_cap)
      || !Number.isInteger(seats_used)
    ) {
      throw new Error('état des sièges mal formé')
    }
    return { readable: true, enforced, plan, seatCap: seat_cap as number, seatsUsed: seats_used as number }
  } catch (e) {
    console.error('sièges : état illisible :', String((e as Error)?.message ?? 'error').slice(0, 120))
    return { readable: false }
  }
}

/**
 * Le refus que dicte l'état des sièges, ou `null` si l'invitation peut prendre un siège.
 * Interrupteur éteint = aucune limite, quel que soit le compte ; état illisible = 503.
 */
export function seatRefusal(s: SeatStatus): GuardRefusal | null {
  if (!s.readable) {
    return {
      status: 503,
      body: {
        error: 'seat_check_unavailable',
        message: "Le nombre de membres de l'agence n'a pas pu être vérifié. Réessayez dans un instant.",
      },
    }
  }
  if (!s.enforced || s.seatsUsed < s.seatCap) return null
  const pluriel = s.seatCap > 1 ? 's' : ''
  return {
    status: 403,
    body: {
      error: 'plan_limit_reached',
      plan: s.plan,
      seatCap: s.seatCap,
      seatsUsed: s.seatsUsed,
      message: `Votre plan ${LIBELLE_PLAN[s.plan] ?? s.plan} est limité à ${s.seatCap} membre${pluriel}, invitations en attente comprises.`,
    },
  }
}

/**
 * Le même refus quand c'est le TRIGGER qui l'a prononcé à l'écriture — une invitation
 * concurrente a pris le dernier siège entre la lecture et l'insertion, ou un renvoi ranime une
 * invitation expirée. Les chiffres ne remontent pas de l'exception : le message s'en passe.
 */
export function seatLimitRefusal(): GuardRefusal {
  return {
    status: 403,
    body: {
      error: 'plan_limit_reached',
      message: 'Le nombre de membres de votre plan est atteint, invitations en attente comprises.',
    },
  }
}

/** L'erreur PostgREST d'une écriture refusée par `enforce_plan_seat_quota`. */
export function isSeatLimitError(err: { message?: string } | null | undefined): boolean {
  return err?.message === SEAT_LIMIT_EXCEPTION
}

export type InviteQuotaVerdict =
  | { allowed: true; dayCount: number; dayCap: number }
  | {
    allowed: false
    reason: 'invite_daily_cap' | 'hourly_cap' | 'daily_cap' | 'no_agency' | 'quota_unavailable'
    dayCap?: number
  }

const MOTIFS_CONNUS = ['invite_daily_cap', 'hourly_cap', 'daily_cap', 'no_agency'] as const

/**
 * Prend une place dans le quota d'invitations de l'agence (`team_invite_quota_take`).
 * La place est PRISE : appeler juste avant d'écrire l'invitation, jamais « pour voir ».
 */
export async function takeTeamInviteQuota(
  admin: SupabaseClient,
  caller: { agencyId: string; actorId: string },
  recipient: string,
): Promise<InviteQuotaVerdict> {
  try {
    const { data, error } = await admin.rpc('team_invite_quota_take', {
      p_agency_id: caller.agencyId,
      p_actor_id: caller.actorId,
      p_recipient: recipient,
    })
    if (error) throw new Error(error.message)
    const v = (data as Array<{ allowed: unknown; reason: unknown; day_count: unknown; day_cap: unknown }> | null)?.[0]
    if (!v) throw new Error('verdict absent')
    const dayCap = Number.isInteger(v.day_cap) ? (v.day_cap as number) : undefined
    if (v.allowed === true) {
      return { allowed: true, dayCount: Number(v.day_count), dayCap: dayCap ?? 0 }
    }
    // Un motif que ce module ne connaît pas est traité comme une panne : refus fermé.
    const reason = MOTIFS_CONNUS.find((m) => m === v.reason) ?? 'quota_unavailable'
    return { allowed: false, reason, dayCap }
  } catch (e) {
    console.error("quota d'invitations : verdict indisponible :", String((e as Error)?.message ?? 'error').slice(0, 120))
    return { allowed: false, reason: 'quota_unavailable' }
  }
}

/** Le refus que dicte le verdict du quota, ou `null` si l'invitation peut partir. */
export function quotaRefusal(v: InviteQuotaVerdict): GuardRefusal | null {
  if (v.allowed) return null
  switch (v.reason) {
    case 'invite_daily_cap':
      return {
        status: 429,
        body: {
          error: 'invite_daily_cap',
          ...(v.dayCap ? { dayCap: v.dayCap } : {}),
          message: v.dayCap
            ? `Plafond d'invitations atteint pour votre agence : ${v.dayCap} par 24 heures. Réessayez plus tard.`
            : "Plafond d'invitations atteint pour votre agence. Réessayez plus tard.",
        },
      }
    // Mêmes codes et mêmes phrases que `guardOutboundEmail` : c'est le même plafond commun.
    case 'hourly_cap':
      return {
        status: 429,
        body: { error: 'hourly_cap', message: "Plafond horaire d'e-mails atteint pour votre agence. Réessayez dans une heure." },
      }
    case 'daily_cap':
      return {
        status: 429,
        body: { error: 'daily_cap', message: "Plafond quotidien d'e-mails atteint pour votre agence." },
      }
    default:
      return {
        status: 503,
        body: { error: 'quota_unavailable', message: "Le quota d'envoi n'a pas pu être vérifié. Réessayez dans un instant." },
      }
  }
}
