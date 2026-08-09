// supabase/functions/onboarding-calendar-check/index.ts
//
// Diagnostic de la connexion entre le backend et l'agenda Google Workspace de MEGGA.
// Lecture seule, réservée au super-admin.
//
// POURQUOI UNE FONCTION PLUTÔT QU'UN CHAMP D'ÉCRAN. Le montage a quatre pièces qui
// peuvent chacune manquer — la clé du compte de service, l'autorisation de délégation
// dans la console Workspace, la portée exacte, l'activation de l'API Calendar — et
// TROIS d'entre elles vivent hors du dépôt, chez Google. Rien de ce que la base sait ne
// permet de dire si ça marche : la seule réponse honnête est un aller-retour réel.
//
// Sans cet écran, le premier symptôme d'une pièce manquante serait « aucun créneau
// disponible » sur l'écran de réservation d'une agence — un message qui ne désigne
// aucune des quatre causes, et qui ressemble à un agenda plein.
//
// CE QUI N'EST PAS RENDU : jamais la clé privée, jamais le JSON du compte de service.
// `client_email` en revanche N'EST PAS un secret — c'est l'adresse publique qu'il faut
// justement recopier dans la console Workspace pour accorder la délégation, et la lire
// ici évite d'aller la rechercher dans Google Cloud.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireSuperAdmin } from '../_shared/require-super-admin.ts'
import {
  probeWorkspaceCalendar,
  workspaceClientEmail,
  workspaceConfigured,
  WORKSPACE_SCOPE,
} from '../_shared/google-workspace.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}

interface CheckRequest {
  action?: 'status' | 'probe'
  mailbox?: string
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const auth = await requireSuperAdmin(req, corsHeaders)
  if (auth instanceof Response) return auth

  let body: CheckRequest = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const configured = workspaceConfigured()

  if (body.action === 'probe') {
    const mailbox = (body.mailbox ?? '').trim()
    if (!mailbox) return json({ error: 'mailbox required' }, 400)
    // Interroger Google avec une boîte non configurée dirait `invalid_grant`, ce qui se
    // lit comme « cette adresse n'existe pas » alors que le problème est ailleurs.
    if (!configured) {
      return json({ ok: false, reason: 'not_configured', configured: false })
    }

    const result = await probeWorkspaceCalendar(mailbox)
    return json({
      ok: result.ok,
      reason: result.reason,
      configured: true,
      client_email: workspaceClientEmail(),
      scope: WORKSPACE_SCOPE,
      // Le fuseau déclaré par l'agenda lui-même : l'écran s'en sert pour proposer le
      // bon fuseau d'hôte plutôt que de laisser 'Europe/Zurich' par défaut sur une
      // boîte qui vit ailleurs.
      calendar_timezone: result.timezone,
      calendar_id: result.calendarId,
    })
  }

  return json({
    configured,
    client_email: workspaceClientEmail(),
    scope: WORKSPACE_SCOPE,
  })
})
