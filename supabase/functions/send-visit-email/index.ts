// supabase/functions/send-visit-email/index.ts
// Edge Function pour les emails liés aux visites :
// - confirmation_buyer : confirmation à l'acheteur
// - notification_agent : notification à l'agent
// - reminder : rappel J-1 à l'acheteur
//
// APPELANT UNIQUE : pg_cron (`visit-reminders-j1`, migration 20260617160000).
// Aucun appelant applicatif — la fonction n'est pas joignable depuis le front.
// L'accès est donc réservé au secret de service ; le destinataire et l'agence
// se déduisent de la ligne `visits`, jamais du corps de la requête.

import { buildVisitEmail } from '../_shared/visit-email.ts'
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isServiceSecret } from '../_shared/require-service-secret.ts'
import { visitManageUrl } from '../_shared/app-url.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}

interface RequestBody {
  type: 'confirmation_buyer' | 'notification_agent' | 'reminder'
  visit_id: string
}

// Les gabarits et le formatage des dates vivent dans `_shared/visit-email.ts` depuis le
// 15.08.2026 : purs, donc testables et visibles au banc de rendu.

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── Auth : appel interne uniquement (pg_cron `visit-reminders-j1`) ──
    // L'ancienne garde ne vérifiait que le PRÉFIXE de l'en-tête
    // (`authHeader.startsWith('Bearer ')`) : sous --no-verify-jwt, la chaîne
    // littérale « Bearer x » suffisait, et `confirmation_buyer` en était même
    // exempté. La fonction lisait ensuite n'importe quelle visite par son id et
    // résolvait l'agent destinataire depuis l'`agency_id` du CORPS — de quoi se
    // faire livrer les coordonnées de l'acheteur d'une autre agence.
    // L'exemption publique protégeait un flux de réservation qui n'existe pas :
    // le seul appelant du dépôt est le cron (20260617160000).
    if (!(await isServiceSecret(supabaseAdmin, req))) {
      return new Response(
        JSON.stringify({ error: 'service_role required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { type, visit_id }: RequestBody = await req.json()

    // Fetch visit with relations
    const { data: visit, error: visitError } = await supabaseAdmin
      .from('visits')
      .select('*, property:properties(title, address, city, photos), contact:contacts(first_name, last_name, email)')
      .eq('id', visit_id)
      .single()

    if (visitError || !visit) {
      return new Response(JSON.stringify({ error: 'Visit not found' }), { status: 404, headers: corsHeaders })
    }

    // L'agence vient de la VISITE, jamais du corps de la requête : c'est elle qui
    // désigne l'agent destinataire, donc la laisser à la main de l'appelant
    // revenait à choisir vers quelle boîte partent les coordonnées de l'acheteur.
    // Le cron passait déjà `v.agency_id` — comportement identique, primitif en moins.
    const agency_id = visit.agency_id as string

    const property = Array.isArray(visit.property) ? visit.property[0] : visit.property
    const contact = Array.isArray(visit.contact) ? visit.contact[0] : visit.contact
    const propertyTitle = property?.title || property?.address || 'Bien immobilier'
    const propertyAddress = `${property?.address || ''}, ${property?.city || ''}`
    const manageUrl = visitManageUrl(visit.id, visit.manage_token)
    // feedbackUrl used in post-visit reminder (sent separately via pg_cron)
    const isVideo = visit.visit_type === 'video'
    const videoLabel = visit.video_platform === 'facetime' ? 'FaceTime' : 'Google Meet'

    // Fetch agent email
    const { data: agents } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('agency_id', agency_id)
      .limit(1)
    const agent = agents?.[0]

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not set' }), { status: 500, headers: corsHeaders })
    }

    // Un seul constructeur pour les trois cas : le fuseau, l'échappement et la
    // typographie y sont tenus au même endroit (cf. l'en-tête du module).
    const commun = {
      scheduledAt: visit.scheduled_at as string,
      propertyTitle,
      propertyAddress,
      isVideo,
      videoLabel,
      videoLink: (visit.video_link as string | null) ?? null,
      manageUrl,
      buyerName: (visit.buyer_name as string | null) ?? contact?.first_name ?? null,
    }

    let to = ''
    let subject = ''
    let html = ''

    if (type === 'notification_agent') {
      to = agent?.email || ''
      const qualif = (visit.qualification ?? {}) as Record<string, unknown>
      const qualification = [
        qualif.budget ? `Budget : ${qualif.budget}` : '',
        qualif.financing ? `Financement : ${qualif.financing}` : '',
        qualif.firstVisit !== undefined ? `Première visite : ${qualif.firstVisit ? 'Oui' : 'Non'}` : '',
      ].filter(Boolean).join(' · ')
      ;({ subject, html } = buildVisitEmail({
        ...commun,
        kind: 'notification_agent',
        agentName: agent?.full_name ?? null,
        buyerEmail: (visit.buyer_email as string | null) ?? null,
        buyerPhone: (visit.buyer_phone as string | null) ?? null,
        buyerMessage: (visit.buyer_message as string | null) ?? null,
        qualification: qualification || null,
      }))
    } else {
      to = visit.buyer_email || contact?.email || ''
      ;({ subject, html } = buildVisitEmail({
        ...commun,
        kind: type === 'reminder' ? 'reminder' : 'confirmation_buyer',
      }))
      if (type === 'reminder') {
        await supabaseAdmin.from('visits').update({ reminder_sent: true }).eq('id', visit_id)
      }
    }

    if (!to) {
      return new Response(JSON.stringify({ error: 'No recipient email' }), { status: 400, headers: corsHeaders })
    }

    // Send via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'MEGGA <noreply@megga.ch>',
        to: [to],
        subject,
        html,
      }),
    })

    const resendData = await resendRes.json()

    // Log activity
    await supabaseAdmin.from('activity_events').insert({
      agency_id,
      action: `visit_email_${type}`,
      // Une visite est une étape de transaction : `deal`, comme stage_change.
      category: 'deal',
      entity_type: 'visit',
      entity_id: visit_id,
      metadata: { to, subject, email_id: resendData.id },
    })

    return new Response(JSON.stringify({ success: true, email_id: resendData.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
