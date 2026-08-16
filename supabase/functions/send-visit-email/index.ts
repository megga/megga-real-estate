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
import { parseLocale, DEFAULT_LOCALE } from '../_shared/recipient-language.ts'
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isServiceSecret } from '../_shared/require-service-secret.ts'
import { visitManageUrl } from '../_shared/app-url.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}

/**
 * Les trois seuls types acceptés, en VALEURS — le type TypeScript ci-dessous
 * disparaît au build et ne peut rien refuser à l'exécution.
 */
const TYPES_CONNUS = ['confirmation_buyer', 'notification_agent', 'reminder'] as const

interface RequestBody {
  type: (typeof TYPES_CONNUS)[number]
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

    // ⛔ `RequestBody` NE VALIDE RIEN — c'est une annotation posée sur un `req.json()`
    // non vérifié, effacée à l'exécution. Sans ce contrôle, le `else` plus bas traite
    // TOUT ce qui n'est pas `notification_agent` comme une confirmation acheteur : un
    // type mal orthographié n'échouait pas, il ENVOYAIT à l'acheteur un « Visite
    // confirmée » pour une visite déjà passée, et rendait 200. La version d'avant la
    // migration vers la coquille échouait, elle, en 400 (« No recipient email ») — un
    // message trompeur, mais au moins un refus. On restaure le refus, avec son motif.
    if (!TYPES_CONNUS.includes(type)) {
      return new Response(
        JSON.stringify({ error: `Unknown type: ${String(type)}`, expected: TYPES_CONNUS }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Fetch visit with relations
    const { data: visit, error: visitError } = await supabaseAdmin
      .from('visits')
      // `language` : les e-mails ACHETEUR partent dans la langue du client, et ce chemin
      // est déclenché par un cron — il n'a aucune requête d'où la lire.
      .select('*, property:properties(title, address, city, photos), contact:contacts(first_name, last_name, email, language)')
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

    // ⛔ CETTE REQUÊTE PRENAIT UN PROFIL ARBITRAIRE DE L'AGENCE. Ni `.eq('id',
    // visit.agent_id)` ni `.order()` : sur une agence de plusieurs personnes, la
    // notification (avec les coordonnées de l'acheteur) partait chez un collègue au hasard,
    // et l'ordre pouvait changer d'un appel à l'autre. `visits.agent_id` existait et n'était
    // jamais lu. Le défaut devient visible en ajoutant la langue — on aurait écrit dans
    // celle d'un tiers — mais il précède ce chantier.
    //
    // Le repli sur un profil de l'agence est conservé : `agent_id` est nullable, et mieux
    // vaut prévenir quelqu'un que personne.
    const { data: agents } = visit.agent_id
      ? await supabaseAdmin
          .from('profiles')
          .select('email, full_name, language')
          .eq('id', visit.agent_id)
          .limit(1)
      : await supabaseAdmin
          .from('profiles')
          .select('email, full_name, language')
          .eq('agency_id', agency_id)
          .order('created_at', { ascending: true })
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
        // L'AGENT lit sa propre langue (`profiles.language`), pas celle du client.
        locale: parseLocale(agent?.language) ?? DEFAULT_LOCALE,
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
        // L'ACHETEUR lit `contacts.language`. ⚠ Quand la visite vient du site public, le
        // destinataire est `visit.buyer_email` et peut n'avoir aucune fiche : la langue
        // reste alors celle du contact rattaché à la visite (`contact_id` est NOT NULL),
        // à défaut le français.
        locale: parseLocale(contact?.language) ?? DEFAULT_LOCALE,
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
