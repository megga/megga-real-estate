// supabase/functions/_shared/credits-edge.ts
//
// Les crédits, vus des edges qui PRODUISENT (`labs-image`, `labs-video`,
// `labs-video-status`) : débiter avant de payer le fournisseur, rembourser s'il
// échoue, et réveiller la recharge automatique quand le solde passe sous le seuil.
//
// ⚠ Le `supabase` reçu est le client de SERVICE que `requireAgentAuth` rend : les RPC
// `credits_*` ne sont accordées qu'à `service_role`, et un client d'agent y échouerait
// en 42501. C'est voulu — un agent ne se débite pas lui-même.
//
// ⚠ La recharge automatique n'est PAS faite ici : elle demande le SDK Stripe, que les
// edges de génération n'embarquent pas (poids au démarrage, secret hors de leur
// périmètre). Elle vit dans `credits-auto-topup`, appelée avec le secret de service
// et sans attendre sa réponse — le verrou de `credits_auto_topup_claim` garantit
// qu'un seul des appels concurrents chargera la carte.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { urlFonction } from './function-url.ts'

export interface DebitResult {
  ok: boolean
  error?: 'insufficient_credits' | 'already_debited' | 'invalid_amount' | 'rpc_failed'
  balance?: number
  needed?: number
  autoTopupDue?: boolean
}

export async function debiterCredits(
  supabase: SupabaseClient,
  p: { agencyId: string; amount: number; assetId: string; actorId: string | null; metadata?: Record<string, unknown> },
): Promise<DebitResult> {
  const { data, error } = await supabase.rpc('credits_debit', {
    p_agency: p.agencyId,
    p_amount: p.amount,
    p_ref_type: 'labs_asset',
    p_ref_id: p.assetId,
    p_metadata: p.metadata ?? {},
    p_actor: p.actorId,
  })
  if (error) {
    console.error('credits_debit:', error.message)
    return { ok: false, error: 'rpc_failed' }
  }
  const r = (data ?? {}) as { ok?: boolean; error?: DebitResult['error']; balance?: number; needed?: number; auto_topup_due?: boolean }
  if (!r.ok) return { ok: false, error: r.error ?? 'rpc_failed', balance: r.balance, needed: r.needed }
  return { ok: true, balance: r.balance, autoTopupDue: !!r.auto_topup_due }
}

/**
 * Le plan EFFECTIF de l'agence (`agency_plan_effectif`) : l'abonnement actif, en essai
 * ou en retard de paiement, sinon Starter. ⛔ Jamais `agencies.plan`, que le webhook
 * Stripe n'écrit pas : une agence qui paie Pro y resterait Starter, et un abonnement
 * résilié garderait le studio. `null` si la lecture échoue — l'appelant refuse, fermé.
 */
export async function planEffectifAgence(supabase: SupabaseClient, agencyId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('agency_plan_effectif', { p_agency: agencyId })
  if (error) {
    console.error('agency_plan_effectif:', error.message)
    return null
  }
  return typeof data === 'string' ? data : null
}

/** Rend les crédits d'une production qui n'a pas abouti. Idempotent : un second appel ne rend rien. */
export async function rembourserCredits(
  supabase: SupabaseClient,
  p: { agencyId: string; assetId: string; reason: string },
): Promise<void> {
  const { error } = await supabase.rpc('credits_refund', {
    p_agency: p.agencyId,
    p_ref_type: 'labs_asset',
    p_ref_id: p.assetId,
    p_reason: p.reason,
  })
  if (error) console.error('credits_refund:', error.message)
}

/**
 * Réveille `credits-auto-topup` sans attendre : l'edge de génération répond à l'agent,
 * la charge Stripe se fait derrière. `EdgeRuntime.waitUntil` garde l'isolat vivant le
 * temps de l'appel ; hors de Supabase (local), la promesse tourne sans garantie — la
 * recharge se rattrapera au débit suivant, le verdict `auto_topup_due` étant recalculé
 * à chaque fois.
 */
export function reveillerAutoRecharge(agencyId: string): void {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) return
  const travail = fetch(urlFonction(supabaseUrl, 'credits-auto-topup'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ agencyId }),
  }).then((r) => { if (!r.ok) console.error('credits-auto-topup:', r.status) })
    .catch((e) => console.error('credits-auto-topup fetch:', (e as Error).message))
  // @ts-expect-error EdgeRuntime is Supabase-specific Deno global
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
    // @ts-expect-error EdgeRuntime.waitUntil keeps the isolate alive until promise resolves
    EdgeRuntime.waitUntil(travail)
  }
}
