// supabase/functions/send-email/index.ts
//
// L'e-mail LIBRE que l'agent rédige lui-même, souvent depuis un brouillon du copilote, et
// qu'il envoie depuis le modal de revue. Human-in-the-loop : jamais automatique.
//
// ⚠ CETTE FONCTION PORTAIT NEUF AUTRES GABARITS — estimation vendeur, lead vendeur, accès
// au portail, quatre gabarits de ticket, deux du formulaire de contact. Retirés le
// 15.08.2026, sur trois preuves concordantes :
//   1. AUCUN appelant dans le dépôt : le seul invocateur de `send-email` est
//      `useSendAgentEmail`, qui passe `agent_freeform` ;
//   2. AUCUN envoi dans l'historique Resend — 100 messages relus, du 21.07 au 15.08 :
//      que des alertes admin, des crons, l'appel d'accueil et les e-mails Supabase Auth ;
//   3. la garde `requireAgentAuth` exclut de toute façon un formulaire public : ses trois
//      exemptions historiques (vitrine, parcours vendeur) ont été retirées avant ce jour.
// `seller_portal_access` servait de surcroît un parcours supprimé en juillet 2026, tables
// comprises. Décision de Julien, prise sur ces mesures.

import { shell, p, escapeHtml } from '../_shared/email-shell.ts'
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}

interface SendEmailRequest {
  to: string
  subject: string
  template: string
  data: Record<string, unknown>
  /** Planification native Resend (ISO 8601 ou langage naturel, ≤ 30 j). Absent = envoi immédiat. */
  scheduled_at?: string
}

/**
 * La coquille commune de ce gabarit.
 *
 * ⛔ AUCUNE MENTION LÉGALE, ET C'EST UNE DÉCISION, PAS UN OUBLI (16 août 2026).
 *
 * Le passage à la coquille avait ajouté une phrase que `main` ne portait pas :
 * « Cet e-mail vous a été envoyé par MEGGA à la suite d'une demande de votre part.
 * Il ne s'agit pas d'une communication marketing […] ». Elle était fausse dès que
 * l'agent prospecte — et c'est précisément ce que fait `agent_freeform`, seul
 * gabarit vivant ici, alimenté par la modale de revue du copilote où le
 * destinataire se saisit librement. Une affirmation de conformité que le produit
 * ne peut pas étayer coûte davantage qu'une absence de mention.
 *
 * ⚠ Elle était en outre écrite en français en dur, alors que `wrapHTML` ne
 * transmet pas `lang` : un agent écrivant en allemand y gagnait un pied français.
 *
 * ⚠ Le paramètre `kind` est retiré avec elle : ses deux sites d'appel prenaient le
 * défaut, la branche `'interne'` n'était donc joignable par personne.
 */
function wrapHTML(subject: string, bodyHTML: string): string {
  return shell({
    title: subject,
    // Faute de mieux : ces gabarits n'ont jamais porté de texte d'aperçu propre, et en
    // inventer un par gabarit dépasserait le rhabillage. L'objet vaut mieux que rien.
    preheader: subject,
    legalNote: null,
    headerCta: null,
    bodyHtml: bodyHTML,
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject: overrideSubject, template, data, scheduled_at }: SendEmailRequest = await req.json()

    // ── Auth ────────────────────────────────────────────────────────────────
    // Plus AUCUNE exemption. Trois templates sautaient `requireAgentAuth` au motif
    // qu'ils seraient « 100% rendus serveur » — ce qui était faux pour deux d'entre
    // eux : `ticket_confirmation` rend un bouton dont l'appelant fournit le href
    // (`data.tracking_url`) et `contact_confirmation` interpole `data.subject` et
    // `data.message` sans échappement. La fonction étant déployée --no-verify-jwt,
    // n'importe qui obtenait donc un e-mail MEGGA signé DKIM avec un lien de son
    // choix : un gabarit d'hameçonnage, pas une confirmation.
    //
    // Retirer l'exemption ne casse rien : au 02.08.2026, `contact_messages` et
    // `support_tickets` comptent 0 ligne DEPUIS TOUJOURS, aucun e-mail n'est parti
    // en 30 jours, et aucun appelant n'existe — ni dans src/, ni dans sites/
    // (vitrine), ni dans un trigger. Les deux parcours que ces templates servaient
    // n'ont jamais tourné.
    //
    // ⚠ Le jour où le formulaire de contact public sera branché, il ne devra PAS
    // rouvrir cette porte : le geste correct est un déclencheur en base qui poste
    // avec le secret de service (cf. _shared/require-service-secret.ts), ou une
    // fonction dédiée avec captcha — pas une exemption sur le template.
    const auth = await requireAgentAuth(req, corsHeaders)
    if (auth instanceof Response) return auth

    const isEmail = (s: unknown): s is string =>
      typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
    if (!isEmail(to)) {
      return new Response(
        JSON.stringify({ error: 'Invalid "to" address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Build email from template

    // ⚠ PLUS DE `switch`. Neuf gabarits nommés vivaient ici ; ils sont retirés (voir
    // l'en-tête). `template` reste dans le contrat d'entrée parce que le client le passe
    // encore (`agent_freeform`) et qu'un corps refusé pour un champ en trop casserait
    // l'envoi sans rien gagner.
    // `agent_freeform` : l'e-mail que l'agent écrit lui-même depuis le copilote. C'est
    // le SEUL chemin réellement emprunté de cette fonction.
    //
    // ⚠ IL SE COMPOSAIT DANS LE NAVIGATEUR. `useSendAgentEmail` fabriquait un document
    // HTML complet dans le bundle front et le passait en `data.html` : une QUATORZIÈME
    // coquille d'e-mail, invisible à la porte `lint:email-shell` qui ne scanne que
    // `supabase/functions/`. Elle est supprimée ; le front envoie désormais le TEXTE,
    // et la composition se fait ici, avec la coquille commune.
    const emailSubject = overrideSubject || 'MEGGA Notification'
    const corps = data.body as string | undefined
    let emailHtml: string
    if (corps) {
      // Échappé, puis structuré : double saut = paragraphe, simple = retour à la ligne.
      emailHtml = wrapHTML(
        emailSubject,
        corps.trim().split(/\n{2,}/).map((par) => p(escapeHtml(par).replace(/\n/g, '<br />'))).join(''),
      )
    } else {
      // ⛔ REPLI TRANSITOIRE, AVEC UNE ÉCHÉANCE ÉCRITE : 15 SEPTEMBRE 2026.
      //
      // Il n'existe que pour un onglet ouvert AVANT ce déploiement, qui enverrait
      // encore `data.html`. Tant qu'il vit, n'importe quel appelant muni d'un jeton
      // d'agent peut faire partir un document HTML complet, non échappé et hors
      // coquille, signé DKIM par megga.ch — et le chemin étant une donnée
      // d'exécution, `lint:email-shell` ne le verra jamais.
      //
      // ⚠ « À retirer une fois le front à jour » était une INTENTION, que rien ne
      // rappelait. La date ci-dessus est tenue par `tests/unit/email-repli-html.spec.ts`,
      // qui rougit à l'échéance si le repli est encore là. Le retirer fait aussi
      // disparaître le test : c'est le seul geste qui rende les deux verts.
      emailHtml = (data.html as string) || wrapHTML(emailSubject, p(''))
    }

    // Send via Resend
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      console.error('RESEND_API_KEY not configured')
      return new Response(JSON.stringify({ error: 'Email service not configured' }), { status: 500, headers: corsHeaders })
    }

    // La notification admin ne part JAMAIS vers un `to` fourni par l'appelant :
    // destinataire dérivé serveur (anti-relais via le template public admin).
    const recipient = template === 'contact_notification_admin'
      ? (Deno.env.get('CONTACT_NOTIFICATION_TO') ?? 'contact@megga.ch')
      : to

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'MEGGA <noreply@megga.ch>',
        to: [recipient],
        subject: emailSubject,
        html: emailHtml,
        // Planification native Resend (facultative) — absent ⇒ envoi immédiat.
        ...(typeof scheduled_at === 'string' && scheduled_at ? { scheduled_at } : {}),
      }),
    })

    const resData = await res.json()

    if (!res.ok) {
      console.error('Resend error:', resData)
      return new Response(JSON.stringify({ error: 'Failed to send email', details: resData }), { status: res.status, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ success: true, id: resData.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('send-email error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
