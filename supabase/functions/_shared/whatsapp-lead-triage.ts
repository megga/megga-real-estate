// Triage des numéros WhatsApp INCONNUS → leads CRM.
//
// Un message d'un numéro non résolu (resolve_contact_by_phone = null) est aujourd'hui stocké
// avec contact_id null → invisible en CRM et jamais compris (les insights sont keyés
// contact_id). Ce module crée un lead minimal à l'inbound (via la RPC ATOMIQUE
// ensure_wa_inbound_lead) pour que le prospect devienne visible + entre dans la
// compréhension / qualification / avis LPD (tout l'aval est déjà branché sur contact_id).
//
// Contrat : AUCUN envoi au client (HITL préservé — écriture interne seulement) ; 0 LLM ;
// jamais le numéro complet en log. L'atomicité/dédup/ambiguïté vit dans la RPC SQL.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Décision PURE d'affectation d'agence pour un numéro inconnu (testable sans I/O).
 * Règle (garde cross-tenant STRICTE) :
 *   - exactement 1 agence vérifiée → elle (déterministe, sûr).
 *   - ≥2 agences vérifiées → **null : on ne DEVINE JAMAIS** (une mé-attribution = lead + avis
 *     LPD sous la mauvaise identité). Le fallback est IGNORÉ dans ce cas (c'est le point clé).
 *   - 0 agence vérifiée (aucun agent encore lié) → WHATSAPP_FALLBACK_AGENCY_ID (béquille de
 *     bootstrap), sinon null.
 * Conséquence assumée : en multi-agence sur un numéro Meta partagé, les inconnus restent
 * orphelins tant qu'un routage par numéro business (wa_to→agence) n'existe pas (dette documentée).
 */
export function pickTriageAgency(distinctVerifiedAgencies: string[], fallback: string | null): string | null {
  if (distinctVerifiedAgencies.length === 1) return distinctVerifiedAgencies[0]
  if (distinctVerifiedAgencies.length >= 2) return null // ≥2 → jamais deviner (fallback ignoré)
  return (fallback ?? '').trim() || null                // 0 agence → béquille bootstrap
}

/**
 * Décision d'affectation d'agence (pure). Le routage par NUMÉRO BUSINESS
 * (wa_to → agence, résolu server-side via agency_wa_numbers) est PRIORITAIRE : il est
 * déterministe et SÛR même en multi-tenant (le message est physiquement arrivé sur ce
 * numéro → aucune devinette). À défaut (numéro non enregistré), repli sur pickTriageAgency
 * (heuristique de comptage conservatrice). C'est la levée de la dette « routage wa_to ».
 */
export function decideTriageAgency(
  waToAgency: string | null,
  distinctVerifiedAgencies: string[],
  fallback: string | null,
): string | null {
  if ((waToAgency ?? '').trim()) return (waToAgency as string).trim()
  return pickTriageAgency(distinctVerifiedAgencies, fallback)
}

/** Agence de rattachement d'un lead d'un numéro inconnu, ou null si indéterminable.
 *  Dérivée SERVER-SIDE, jamais du payload : (1) numéro Business `waTo` → agence via le
 *  registre agency_wa_numbers (déterministe, sûr multi-tenant) ; sinon (2) heuristique
 *  whatsapp_agent_links vérifiés + env. Voir decideTriageAgency / pickTriageAgency. */
export async function resolveTriageAgencyId(
  admin: SupabaseClient,
  env: (k: string) => string | undefined,
  waTo?: string | null,
): Promise<string | null> {
  // 1. Routage déterministe par numéro Business (wa_to → agence), s'il est enregistré.
  let waToAgency: string | null = null
  if ((waTo ?? '').trim()) {
    const { data } = await admin.rpc('agency_for_wa_business_number', { p_wa_to: waTo })
    if (typeof data === 'string' && data) waToAgency = data
  }
  // 2. Repli : agences vérifiées (garde cross-tenant conservatrice).
  const { data } = await admin
    .from('whatsapp_agent_links')
    .select('agency_id')
    .eq('verified', true)
    .not('agency_id', 'is', null)
  const distinct = Array.from(
    new Set((data ?? []).map((r) => (r as { agency_id: string }).agency_id)),
  )
  return decideTriageAgency(waToAgency, distinct, env('WHATSAPP_FALLBACK_AGENCY_ID') ?? null)
}

export interface TriageResult { contactId: string | null; created: boolean }

/**
 * Crée (ou récupère) un lead pour l'inbound d'un numéro inconnu. Renvoie {contactId, created}.
 * La RPC gère l'atomicité (ON CONFLICT DO NOTHING sur l'index unique partiel) et l'ambiguïté
 * (≥2 contacts même numéro dans l'agence → contactId null, on ne devine pas). Best-effort :
 * une erreur RPC → {null,false}, le message reste simplement orphelin (pas de régression).
 */
export async function ensureLeadForInboundPhone(
  admin: SupabaseClient,
  args: { agencyId: string; phone: string; firstName: string; lastName: string },
): Promise<TriageResult> {
  const { data, error } = await admin.rpc('ensure_wa_inbound_lead', {
    p_agency_id: args.agencyId,
    p_phone: args.phone,
    p_first_name: args.firstName,
    p_last_name: args.lastName,
  }).maybeSingle()
  if (error || !data) return { contactId: null, created: false }
  const row = data as { contact_id: string | null; created: boolean }
  return { contactId: row.contact_id ?? null, created: !!row.created }
}

/**
 * Nom d'affichage minimal d'un lead entrant : « Prospect <4 derniers chiffres> ».
 * Pas de PII au-delà du numéro déjà reçu ; distingue les fiches ; l'agent complète (à_compléter).
 */
export function triageLeadName(phone: string): { firstName: string; lastName: string } {
  const digits = (phone || '').replace(/\D/g, '')
  return { firstName: 'Prospect', lastName: digits.slice(-4) || 'WhatsApp' }
}

/**
 * Un inbound est-il éligible au triage-lead ? Numéro RÉEL (6–15 chiffres, exclut JID de groupe)
 * ET body texte NON VIDE (un média seul / body vide = démarchage/bruit → pas de lead).
 */
export function isTriageEligible(phone: string, body: string | null | undefined): boolean {
  const digits = (phone || '').replace(/\D/g, '')
  if (digits.length < 6 || digits.length > 15) return false
  return (body ?? '').trim().length > 0
}
