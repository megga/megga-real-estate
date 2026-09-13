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
//
// ⛔ DEUX APPELANTS, DEUX GARDES, ET LE DESTINATAIRE N'EST JAMAIS LIBRE (13.09.2026).
//
//   · L'AGENT (jeton utilisateur) : `requireAgentAuth`, puis `guardOutboundEmail` — le
//     destinataire doit être connu de SON agence (contact, lead attribué, membre, adresse de
//     l'agence), ne pas s'être désinscrit, et l'agence doit avoir une place dans son quota.
//     Avant ce jour, `to` était libre : un jeton d'agent étant gratuit (l'inscription
//     provisionne une agence solo), la fonction était un relais ouvert signé DKIM par
//     getmegga.com. Voir `_shared/email-recipient.ts`.
//   · LA BASE (secret de service, rejoué par pg_cron) : `isServiceSecret`, pour les seuls
//     gabarits de `SERVICE_TEMPLATES`, dont le destinataire est lu dans `app_config` et
//     jamais dans le corps. Aujourd'hui : l'alerte RealAdvisor (`realadvisor_health_check`).
//     ⚠ Elle était REFUSÉE EN 401 depuis le 02.08.2026 : la garde d'agent rejette toute clé
//     d'API, et la fonction SQL en envoie une. Le commit qui a fermé les exemptions affirmait
//     « aucun appelant… ni dans un trigger » ; celui-ci a été manqué, et la supervision du
//     catalogue de vente n'a plus eu de canal e-mail pendant six semaines.
//
// ⛔ PLUS AUCUN DOCUMENT HTML FOURNI PAR L'APPELANT. Le repli qui acceptait un HTML complet
// « pour un onglet ouvert avant le déploiement » (échéance écrite : 15.09.2026) est retiré :
// le corps est du TEXTE, échappé et mis en forme ici, dans la coquille commune.

import { shell, p, escapeHtml } from '../_shared/email-shell.ts'
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { isServiceSecret } from '../_shared/require-service-secret.ts'
import { guardOutboundEmail } from '../_shared/email-recipient.ts'

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
 * Gabarits INTERNES, envoyés par la base avec le secret de service. Le destinataire est
 * résolu côté serveur, clé par clé dans `app_config` — le `to` du corps n'est pas lu : un
 * secret de service qui fuirait ne ferait pas de cette fonction un relais. Mêmes clés que
 * `realadvisor_health_check()` (20260625160000). Aucune adresse de repli en dur : sans
 * réglage, on refuse (400) et on le voit — un e-mail parti vers une boîte oubliée ne se
 * verrait pas.
 */
const SERVICE_TEMPLATES: Record<string, { recipientKeys: string[] }> = {
  realadvisor_health_alert: {
    recipientKeys: ['realadvisor_alert_email', 'realadvisor_contact_email'],
  },
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

const isEmail = (s: unknown): s is string =>
  typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

/**
 * La phrase que la modale de revue affiche sur un échec d'envoi (`useSendAgentEmail` lit
 * `message`, puis `error`). Générique par construction : la cause réelle est au journal.
 */
const ECHEC_ENVOI = 'L’envoi a échoué. Réessayez dans un instant.'

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Le destinataire d'un gabarit interne : première clé d'app_config portant une adresse valide, sinon null. */
async function serviceRecipient(
  admin: SupabaseClient,
  spec: { recipientKeys: string[] },
): Promise<string | null> {
  for (const key of spec.recipientKeys) {
    const { data } = await admin.from('app_config').select('value').eq('key', key).maybeSingle()
    const v = (((data as { value?: string } | null)?.value) ?? '').trim()
    if (isEmail(v)) return v
  }
  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject: overrideSubject, template, data, scheduled_at }: SendEmailRequest = await req.json()

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // ── Auth, et le destinataire qui va avec ────────────────────────────────
    let recipient: string
    const serviceSpec = Object.prototype.hasOwnProperty.call(SERVICE_TEMPLATES, template)
      ? SERVICE_TEMPLATES[template]
      : null

    if (serviceSpec && await isServiceSecret(admin, req)) {
      // La base parle : destinataire résolu serveur, jamais le `to` du corps.
      const resolved = await serviceRecipient(admin, serviceSpec)
      if (!resolved) {
        return jsonResponse(400, { error: 'no_alert_recipient', message: `Aucune adresse valide dans app_config pour ${template}.` })
      }
      recipient = resolved
    } else {
      // Un agent parle. Plus AUCUNE exemption : trois templates sautaient cette garde au
      // motif qu'ils seraient « 100% rendus serveur », ce qui était faux pour deux d'entre
      // eux (bouton dont l'appelant fournissait le href, champs interpolés sans échappement).
      // ⚠ Le jour où le formulaire de contact public sera branché, il ne devra PAS rouvrir
      // cette porte : le geste correct est un déclencheur en base qui poste avec le secret
      // de service (cf. SERVICE_TEMPLATES ci-dessus), ou une fonction dédiée avec captcha.
      const auth = await requireAgentAuth(req, corsHeaders)
      if (auth instanceof Response) return auth

      if (!isEmail(to)) {
        return jsonResponse(400, { error: 'Invalid "to" address' })
      }

      // Périmètre → suppression → quota. Un e-mail libre est une SOLLICITATION que nous
      // initions (purpose 'relance') : le registre de suppression s'applique.
      const refus = await guardOutboundEmail(
        admin,
        { agencyId: auth.profile.agency_id, actorId: auth.user.id },
        { to, purpose: 'relance', sender: 'send-email' },
        corsHeaders,
      )
      if (refus) return refus

      // La notification admin ne part JAMAIS vers un `to` fourni par l'appelant :
      // destinataire dérivé serveur (anti-relais via le template public admin).
      recipient = template === 'contact_notification_admin'
        ? (Deno.env.get('CONTACT_NOTIFICATION_TO') ?? 'contact@getmegga.com')
        : to
    }

    // ── Corps ────────────────────────────────────────────────────────────────
    // ⚠ PLUS DE `switch`. Neuf gabarits nommés vivaient ici ; ils sont retirés (voir
    // l'en-tête). `template` reste dans le contrat d'entrée parce que le client le passe
    // encore (`agent_freeform`) et qu'un corps refusé pour un champ en trop casserait
    // l'envoi sans rien gagner.
    //
    // Le front envoie le TEXTE ; la composition se fait ici, avec la coquille commune. Il
    // composait autrefois un document HTML complet dans le bundle — une quatorzième
    // coquille, invisible à `lint:email-shell`. Sans corps, on refuse : il n'y a plus de
    // repli qui accepterait un HTML fourni.
    const emailSubject = overrideSubject || 'MEGGA Notification'
    const corps = typeof data?.body === 'string' ? data.body : ''
    if (!corps.trim()) {
      return jsonResponse(400, { error: 'body_required', message: 'Le corps de l’e-mail est vide.' })
    }
    // Échappé, puis structuré : double saut = paragraphe, simple = retour à la ligne.
    const emailHtml = wrapHTML(
      emailSubject,
      corps.trim().split(/\n{2,}/).map((par) => p(escapeHtml(par).replace(/\n/g, '<br />'))).join(''),
    )

    // ── Envoi via Resend ─────────────────────────────────────────────────────
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      console.error('RESEND_API_KEY not configured')
      return jsonResponse(500, { error: 'Email service not configured' })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'MEGGA <noreply@getmegga.com>',
        to: [recipient],
        subject: emailSubject,
        html: emailHtml,
        // Planification native Resend (facultative) — absent ⇒ envoi immédiat.
        ...(typeof scheduled_at === 'string' && scheduled_at ? { scheduled_at } : {}),
      }),
    })

    const resData = await res.json()

    if (!res.ok) {
      // Le corps Resend porte le destinataire : on journalise le statut, pas le corps.
      // ⛔ Et on ne le RENVOIE pas davantage (audit S14) : `details: resData` recopiait au
      // navigateur le diagnostic du fournisseur, que le commentaire ci-dessus refusait déjà
      // au journal. Le statut passe, le texte non ; la modale lit `message`.
      console.error('Resend error:', res.status, String(resData?.name ?? resData?.message ?? '').slice(0, 120))
      return jsonResponse(res.status, { error: 'send_failed', message: ECHEC_ENVOI })
    }

    return jsonResponse(200, { success: true, id: resData.id })

  } catch (err) {
    console.error('send-email error:', String((err as Error)?.message ?? err).slice(0, 200))
    return jsonResponse(500, { error: 'send_failed', message: ECHEC_ENVOI })
  }
})
