// MEGGA — Helpers communs aux Edge Functions d'intégration mail/calendrier.
// Centralise :
//   - CORS prod-safe (whitelist d'origines au lieu de '*')
//   - Audit trail LPD : log activity_events lors d'un connect/disconnect OAuth

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── CORS ────────────────────────────────────────────────────────────────

/**
 * Liste d'origines autorisées en production + previews + dev.
 * Comparaison exacte (pas de wildcard CSS-style); pour `*.pages.dev` on accepte
 * tout subdomain via la fonction matchAllowedOrigin.
 */
const ALLOWED_EXACT = new Set([
  'https://megga.ch',
  'https://www.megga.ch',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
])

const ALLOWED_SUFFIXES = [
  '.pages.dev',         // Cloudflare Pages previews (megga.pages.dev, *-megga.pages.dev)
  '.megga.ch',          // sous-domaines prod éventuels
] as const

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false
  if (ALLOWED_EXACT.has(origin)) return true
  try {
    const url = new URL(origin)
    // Suffix check sur le hostname uniquement (pas le port) pour éviter qu'un
    // attaquant fasse `https://megga.ch.evil.com` qui contient ".megga.ch"
    return ALLOWED_SUFFIXES.some(s => url.hostname.endsWith(s))
  } catch {
    return false
  }
}

/**
 * Retourne les headers CORS appropriés pour la requête.
 * Si l'origine n'est pas autorisée → Access-Control-Allow-Origin absent
 * → le navigateur bloquera la réponse côté client (sécurité défensive).
 */
export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = isAllowedOrigin(origin)
  return {
    ...(allowed ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

// ─── Audit trail LPD ────────────────────────────────────────────────────

export type IntegrationProvider =
  | 'google_calendar'
  | 'outlook_calendar'
  | 'gmail'
  | 'outlook_mail'

export type IntegrationAction = 'integration.connect' | 'integration.disconnect'

interface LogParams {
  db: SupabaseClient
  userId: string
  action: IntegrationAction
  provider: IntegrationProvider
  /** Email du compte connecté (optionnel mais conseillé pour traçabilité LPD) */
  email?: string | null
  /** Métadonnées supplémentaires (scopes, ip, etc.) */
  extra?: Record<string, unknown>
}

/**
 * Insère un événement dans activity_events. Best-effort : un échec d'insert
 * ne doit JAMAIS faire échouer l'opération principale (connect/disconnect).
 * On loggue silencieusement et on continue.
 */
export async function logIntegrationEvent(params: LogParams): Promise<void> {
  const { db, userId, action, provider, email, extra } = params

  // Récup agency_id du profil pour scoper l'audit à l'agence
  let agencyId: string | null = null
  try {
    const { data: profile } = await db
      .from('profiles')
      .select('agency_id')
      .eq('id', userId)
      .single()
    agencyId = profile?.agency_id ?? null
  } catch {
    // Pas grave, on logge sans agency_id
  }

  try {
    await db.from('activity_events').insert({
      agency_id: agencyId,
      actor_id: userId,
      // 'user' est la seule valeur acceptée par le check constraint existant.
      // Le rôle métier (agent vs admin vs assistant) reste lisible via metadata.role
      // ou actor_id → profiles.role join si besoin.
      actor_kind: 'user',
      action,
      entity_type: 'integration',
      entity_id: null,
      object_label: provider,
      // Le check constraint accepte : kyc, deal, contact, bien, doc, auth, settings, ai.
      // 'settings' est la catégorie la plus logique pour les OAuth d'intégration
      // (l'agent les configure dans Settings → Intégrations).
      category: 'settings',
      severity: 'info',
      metadata: {
        provider,
        email: email ?? null,
        ...extra,
      },
    })
  } catch (e) {
    // Audit insert failed — on logge côté Deno mais on n'échoue pas
    console.error('[integration-helpers] activity_events insert failed', e)
  }
}
