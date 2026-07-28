// supabase/functions/_shared/audit-edge-error.ts
// Producteur de l'événement `edge_function_error`.
//
// Cinq surfaces lisaient cet événement, aucune ne le recevait :
//   * le KPI « erreurs 24 h » du monitoring (get_admin_monitoring_health) ;
//   * le tableau de santé par fonction — sans lui, les ~69 fonctions
//     s'affichent toutes « sans télémétrie » ;
//   * la liste des 100 dernières erreurs ;
//   * le seuil e-mail `edge_errors_24h` de _shared/admin-alerts.ts, qui ne
//     pouvait donc jamais se déclencher ;
//   * le bento d'alertes du tableau de bord (gravité `critical`).
//
// Volume : un appel par INVOCATION EN ÉCHEC, depuis le catch de plus haut
// niveau — jamais par requête réussie. `activity_events` est la piste d'audit
// LBA, pas un puits de télémétrie ; on n'y écrit pas les invocations nominales.
// C'est aussi pour ça que `edge_function_invoked`, que le tableau de santé sait
// lire, reste volontairement non émis : une ligne par appel réussi noierait
// l'audit et ferait grossir la table sans borne.
//
// Best-effort de bout en bout : journaliser un incident ne doit jamais en
// créer un second. Toute erreur d'écriture est avalée et tracée en console.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { redactPII } from './pii-redaction.ts'

/** Au-delà, on tronque : une stack complète en jsonb n'aide personne et pèse. */
const MAX_ERROR_CHARS = 500

export interface EdgeErrorContext {
  /** Horodatage de début (`Date.now()`) pour dériver la durée. */
  startedAt?: number
  /** Agence concernée quand la fonction en sert une ; sinon événement plateforme. */
  agencyId?: string | null
}

export interface EdgeErrorEvent {
  agency_id: string | null
  actor_id: null
  actor_kind: 'system'
  action: 'edge_function_error'
  entity_type: 'edge_function'
  severity: 'critical'
  object_label: string
  metadata: Record<string, unknown>
}

/**
 * Met en forme l'événement, sans rien écrire.
 *
 * Séparé de l'écriture pour être testable, et parce que la FORME est un
 * contrat : `useAdminMonitoring` regroupe par `metadata.function_name` et lit
 * `metadata.error` puis `metadata.duration_ms`. Un renommage silencieux d'une
 * de ces clés reviendrait à éteindre le monitoring.
 */
export function buildEdgeErrorEvent(
  functionName: string,
  err: unknown,
  ctx: EdgeErrorContext = {},
): EdgeErrorEvent {
  const raw = err instanceof Error
    ? (err.message || err.name)
    : typeof err === 'string' ? err : JSON.stringify(err ?? null)

  // Un message d'erreur n'est pas du texte de confiance : il recopie souvent la
  // charge utile qui l'a provoqué (clé d'API d'un fournisseur, IBAN d'un
  // formulaire). Il finit lisible par les super-admins — on le nettoie avant.
  const { redactedText } = redactPII(raw ?? '')
  const message = redactedText.length > MAX_ERROR_CHARS
    ? `${redactedText.slice(0, MAX_ERROR_CHARS)}…`
    : redactedText

  const metadata: Record<string, unknown> = {
    function_name: functionName,
    error: message,
  }
  if (typeof ctx.startedAt === 'number') {
    metadata.duration_ms = Math.max(0, Date.now() - ctx.startedAt)
  }

  return {
    agency_id: ctx.agencyId ?? null,
    actor_id: null,
    actor_kind: 'system',
    action: 'edge_function_error',
    entity_type: 'edge_function',
    // Pas de `category` : la contrainte n'admet que des familles MÉTIER
    // (kyc, deal, contact, bien, doc, auth, settings, ai). Une panne technique
    // n'en est aucune, et la ranger dans « settings » serait un mensonge de
    // classement. Précédent : `rls_hardening_applied`, category nulle.
    severity: 'critical',
    object_label: functionName,
    metadata,
  }
}

/**
 * Écrit l'événement. À appeler depuis le catch de plus haut niveau d'une edge
 * function, avec un client service-role.
 *
 * Ne relance jamais : l'appelant doit pouvoir renvoyer sa réponse d'erreur
 * normale juste après.
 */
export async function reportEdgeError(
  admin: SupabaseClient,
  functionName: string,
  err: unknown,
  ctx: EdgeErrorContext = {},
): Promise<void> {
  try {
    const { error } = await admin
      .from('activity_events')
      .insert(buildEdgeErrorEvent(functionName, err, ctx))
    if (error) console.error('[audit-edge-error] insert failed:', error.message)
  } catch (e) {
    console.error('[audit-edge-error] unexpected:', (e as Error)?.message)
  }
}
