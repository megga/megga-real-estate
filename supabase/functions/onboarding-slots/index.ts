// supabase/functions/onboarding-slots/index.ts
//
// Créneaux libres pour l'appel d'accueil. Lecture seule.
//
// DEUX MODES D'AUTHENTIFICATION, et c'est voulu :
//   - une agence connectée qui sort du wizard d'identité (`requireAgentAuth`) ;
//   - le porteur d'un `manage_token` valide, qui replanifie depuis son e-mail sans
//     être connecté.
// Même forme que le `PUBLIC_TEMPLATES` de `send-email` : la garde est DANS la fonction,
// jamais à la passerelle, puisque tout le dépôt est déployé en `--no-verify-jwt`.
//
// Le calcul est intégralement serveur. Le client ne reçoit qu'une liste d'instants, et
// surtout pas l'identité de l'hôte qui prendra le rendez-vous : ce choix est arbitré à
// l'écriture, sur l'état de la charge à ce moment-là.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { loadAvailability } from '../_shared/onboarding-availability.ts'
import { unionSlotStarts } from '../_shared/onboarding-slots.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_WINDOW_DAYS = 62
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface SlotsRequest {
  from?: string
  to?: string
  manage_token?: string
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const db = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  let body: SlotsRequest = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  // ── Garde : jeton de gestion, sinon session d'agent ──
  const token = typeof body.manage_token === 'string' ? body.manage_token.trim() : ''
  if (token) {
    if (!UUID_RE.test(token)) return json({ error: 'invalid token' }, 403)
    const { data } = await db.rpc('get_onboarding_call_by_token', { p_token: token })
    if (!data) return json({ error: 'invalid token' }, 403)
  } else {
    const auth = await requireAgentAuth(req, corsHeaders)
    if (auth instanceof Response) return auth
  }

  // ── Fenêtre demandée, bornée ──
  const nowMs = Date.now()
  const fromMs = Number.isFinite(Date.parse(body.from ?? '')) ? Date.parse(body.from!) : nowMs
  const requestedTo = Number.isFinite(Date.parse(body.to ?? '')) ? Date.parse(body.to!) : fromMs + 30 * DAY_MS
  // Une fenêtre non bornée ferait lire des mois d'agenda externe à chaque ouverture
  // de la page. Le mois affiché suffit largement.
  const toMs = Math.min(requestedTo, fromMs + MAX_WINDOW_DAYS * DAY_MS)

  if (!(fromMs < toMs)) return json({ error: 'invalid window' }, 400)

  try {
    const snapshot = await loadAvailability(db, fromMs, toMs, nowMs)
    const starts = unionSlotStarts(snapshot.slots)

    return json({
      slots: starts.map((ms) => new Date(ms).toISOString()),
      // La durée est la même pour tous les hôtes en pratique ; on rend celle du
      // premier plutôt qu'une valeur inventée, et 30 s'il n'y a aucun hôte.
      duration_minutes: [...snapshot.hostsById.values()][0]?.duration_minutes ?? 30,
      // Dire pourquoi c'est vide. « Aucun créneau » sans raison se lit comme un bug.
      pool_empty: snapshot.poolEmpty,
      degraded: snapshot.degradedHostIds.length > 0,
    })
  } catch (error) {
    console.error('[onboarding-slots] failed', error)
    return json({ error: 'slot computation failed' }, 500)
  }
})
