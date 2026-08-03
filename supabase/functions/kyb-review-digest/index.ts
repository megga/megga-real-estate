// supabase/functions/kyb-review-digest/index.ts
//
// Envoie aux super-admins le point quotidien des dossiers KYB en attente de revue.
//
// POURQUOI CETTE FONCTION EXISTE. Audit d'onboarding du 01.08.2026 : aucun dossier ne peut
// s'auto-valider, donc chacun attend un humain -- et rien n'allait chercher cet humain. La
// console montre la file a qui l'ouvre ; ce courriel s'adresse a qui ne l'a pas ouverte.
//
// POURQUOI ELLE NE DECIDE PAS QUI ATTEND. Toute la lecture vit dans kyb_review_digest_payload()
// : une seule definition de « en attente », une seule liste de destinataires. Cette fonction
// compose et envoie, rien d'autre.
//
// Auth : Bearer == cle service-role, comparaison a temps constant, meme motif que
// agency-verification-notify et agency-verification-run. Aucun chemin utilisateur.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildReviewDigest, type PendingDossier } from '../_shared/kyb-review-digest.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

interface DigestPayload {
  recipients: string[]
  dossiers: PendingDossier[]
  total: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const provided = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!serviceRoleKey || !safeEqual(provided, serviceRoleKey)) {
    return json({ error: 'unauthorized' }, 401)
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRoleKey, {
    auth: { persistSession: false },
  })

  try {
    const { data, error } = await supabase.rpc('kyb_review_digest_payload')
    if (error) throw error
    const payload = data as DigestPayload
    // Repli defensif : un ancien schema de cache (avant le correctif de revue) ne
    // porterait pas `total`. Sans lui, dossiers.length reste la meilleure estimation
    // disponible -- exactement le comportement d'avant ce correctif.
    const total = payload.total ?? payload.dossiers.length

    const notice = buildReviewDigest({
      dossiers: payload.dossiers ?? [],
      appUrl: Deno.env.get('APP_URL') ?? 'https://app.megga.ch',
      total,
    })

    // Rien a dire = rien envoye. Un digest quotidien qui arrive tous les jours pour dire
    // « rien » se fait ignorer, puis filtrer, et n'est plus lu le jour ou il compte.
    if (!notice) return json({ ok: true, skipped: 'empty_queue', pending: total })

    const recipients = (payload.recipients ?? []).filter((e) => typeof e === 'string' && e.includes('@'))
    if (recipients.length === 0) {
      // Dit, jamais tu : une allowlist vide est un fait qu'on doit pouvoir constater.
      console.error('[kyb-review-digest] aucun destinataire dans super_admin_allowlist')
      return json({ ok: true, skipped: 'no_recipient', pending: total })
    }

    // Sans cle Resend, on ne pretend pas avoir envoye -- meme discipline que
    // agency-verification-notify.
    const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''
    if (!resendKey) {
      console.error('[kyb-review-digest] RESEND_API_KEY absente, digest non envoye')
      return json({ ok: true, skipped: 'resend_key_missing', pending: total })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: 'MEGGA Console <noreply@megga.ch>',
        to: recipients,
        subject: notice.subject,
        html: notice.html,
      }),
    })
    // Le statut seul, jamais le corps : il peut contenir un echo de la requete, donc des
    // adresses.
    if (!res.ok) throw new Error(`Resend a repondu ${res.status}`)

    // PAS d'activity_events ici, contrairement a agency-verification-notify : cet envoi ne
    // concerne AUCUNE agence (agency_id serait null) et n'est pas un acte de conformite. Le
    // journaliser dans une table append-only conservee dix ans y ajouterait du bruit
    // d'exploitation ineffacable.
    return json({ ok: true, recipients: recipients.length, pending: total })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    console.error('[kyb-review-digest]', message)
    return json({ error: message }, 500)
  }
})
