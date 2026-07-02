// supabase/functions/_shared/require-service-secret.ts
// Garde d'authentification pour les fonctions cron / internes déployées
// `--no-verify-jwt` (aucune vérif de signature côté plateforme).
//
// On NE décode JAMAIS le rôle d'un JWT ici : sous --no-verify-jwt, un JWT forgé
// {"role":"service_role"} passerait (signature non vérifiée). On compare le token
// reçu, en TEMPS CONSTANT, au secret partagé `app_config.service_role_key` — la
// même valeur que pg_cron forwarde en `Authorization: Bearer <…>` (pattern déjà
// utilisé par whatsapp-agent-async / whatsapp-process). Repli sur l'env
// SUPABASE_SERVICE_ROLE_KEY si présent, pour maximiser la compatibilité runtime.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Comparaison à temps constant (anti timing-attack sur le secret).
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// `admin` doit être un client service-role (pour lire app_config, protégée par RLS).
export async function isServiceSecret(admin: SupabaseClient, req: Request): Promise<boolean> {
  const provided = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!provided) return false

  // Source primaire : app_config.service_role_key (ce que le cron forwarde).
  const { data } = await admin.from('app_config').select('value').eq('key', 'service_role_key').maybeSingle()
  const expected = ((data?.value as string | undefined) ?? '').trim()
  if (expected && safeEqual(provided, expected)) return true

  // Repli : l'env, si injecté dans le runtime EF.
  const envKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim()
  return !!envKey && safeEqual(provided, envKey)
}
