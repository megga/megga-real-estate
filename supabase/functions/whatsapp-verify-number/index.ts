// supabase/functions/whatsapp-verify-number/index.ts
// Envoie à l'agent, SUR WHATSAPP, un code à 6 chiffres pour vérifier le numéro qu'il vient
// de saisir dans ses réglages.
//
// ── Pourquoi cette fonction existe, alors que l'appairage suffisait ──────────
// L'appairage historique va dans l'autre sens : MEGGA affiche un code, l'agent l'envoie
// depuis son WhatsApp. Il prouve DAVANTAGE (que la personne pilote ce compte) et ne coûte
// rien. Celui-ci existe pour l'agent qui préfère saisir son numéro et attendre. Les deux
// aboutissent au même état — `whatsapp_agent_links.verified` — et l'appairage reste le
// chemin par défaut.
//
// ── Pourquoi le code ne transite PAS par le client ──────────────────────────
// La RPC `start_whatsapp_number_verification` RETOURNE le code en clair, et c'est pour ça
// qu'elle n'est exécutable que par `service_role`. Cette fonction le lit, l'envoie à Meta,
// et ne le remet à personne : la réponse HTTP ne contient jamais le code. Un code qui
// ferait l'aller-retour par le navigateur ne prouverait plus rien — l'agent pourrait le
// lire sans jamais recevoir le message.
//
// ── Ce qui la garde honnête ─────────────────────────────────────────────────
//  · JWT agent obligatoire (`requireAgentAuth`) — le profil vient du jeton, jamais du corps ;
//  · la RPC borne le débit (3 envois/heure) et refuse un numéro déjà tenu par un autre ;
//  · l'envoi passe par `sendOutboundGuarded`, qui applique la SUPPRESSION par numéro : un
//    numéro qui a écrit STOP ne reçoit pas de code parce qu'un agent l'a saisi ;
//  · sans template Meta configuré, la fonction ne tente RIEN et le dit — le CRM retombe
//    alors sur l'appairage, qui lui n'a besoin de rien.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { sendOutboundGuarded } from '../_shared/whatsapp-outbound-guard.ts'
import { buildTemplateMessage } from '../_shared/whatsapp-templates.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const json = (o: unknown, status: number) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

/** Refus MÉTIER de la RPC → code HTTP. Aucun n'est une panne : le CRM doit expliquer, pas réessayer. */
const STATUS: Record<string, number> = {
  no_profile: 403,
  invalid_phone: 400,
  number_taken: 409,
  // Les quatre plafonds rendent 429 : c'est bien « trop de demandes », que la borne soit
  // celle de l'agent, du numéro visé ou de la plateforme. Le CORPS distingue lequel, pour
  // que l'écran puisse dire quoi faire — un 429 générique laisserait l'agent réessayer.
  rate_limited: 429,
  platform_rate_limited: 429,
  number_rate_limited: 429,
  too_many_numbers: 429,
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const auth = await requireAgentAuth(req, CORS)
  if (auth instanceof Response) return auth
  const { profile } = auth

  const body = (await req.json().catch(() => ({}))) as { action?: string; number?: string; lang?: string }
  const { number, lang } = body

  // ── `action: 'status'` — la capacité est-elle armée ? ──────────────────────
  //
  // ⛔ SANS CETTE SONDE, L'ÉCRAN PROPOSE CE QUI NE PEUT PAS MARCHER. Le CRM n'avait
  // aucun moyen de savoir si le template Meta est configuré : il peignait donc la saisie
  // de numéro en affordance PRIMAIRE, et l'agent ne découvrait qu'après le clic, un
  // aller-retour réseau plus tard, que la capacité n'est pas activée — pour se faire
  // renvoyer vers le bouton discret d'en dessous, celui qui fonctionne. Tant que le
  // template n'est pas approuvé par Meta, c'est le parcours de CHAQUE agent.
  //
  // La réponse est ici et nulle part ailleurs : le nom approuvé vit dans l'env de cette
  // fonction. Le dupliquer dans un drapeau `app_config` créerait deux sources de vérité
  // pour un même fait, donc une dérive de plus à surveiller.
  //
  // ⚠ Ne touche NI la base NI Meta : `buildTemplateMessage` est pur, on lit seulement
  // s'il rend quelque chose. Aucun jeton de débit consommé, aucun OTP armé.
  if (body.action === 'status') {
    const arme = buildTemplateMessage(
      'number_verification', '41000000000', { verificationCode: '000000' }, (k) => Deno.env.get(k),
    )
    return json({ ok: true, otp_available: !!arme }, 200)
  }

  if (!number || typeof number !== 'string') return json({ error: 'number required' }, 400)
  // `lang` vient du corps de requête : le valider AVANT de le passer plus loin, où il
  // atteindrait un `.trim()` et sortirait en 500 nu, sans en-têtes CORS.
  const langue = typeof lang === 'string' ? lang : undefined

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // Le template AVANT la RPC. Dans l'ordre inverse, un déploiement sans template
  // consommerait un jeton du plafond horaire et écrirait un OTP en base à chaque clic,
  // pour un envoi qui n'aura jamais lieu — l'agent verrait « trop de tentatives » sans
  // avoir rien reçu. On échoue donc là où c'est gratuit.
  //
  // ⚠ Le code réel n'est pas encore connu : on ne construit ici qu'une SONDE pour savoir
  // si le template est configuré. Le message envoyé est reconstruit plus bas avec le vrai
  // code — `buildTemplateMessage` est pur, l'appeler deux fois ne coûte rien.
  const configured = buildTemplateMessage(
    'number_verification', number, { verificationCode: '000000', lang: langue }, (k) => Deno.env.get(k),
  )
  if (!configured) {
    // 501 et non 500 : rien n'est cassé, la capacité n'est simplement pas activée. Le CRM
    // lit `fallback` et propose l'appairage, qui ne dépend d'aucun template.
    return json({ error: 'template_not_configured', fallback: 'pairing' }, 501)
  }

  const { data, error } = await admin.rpc('start_whatsapp_number_verification', {
    p_profile_id: profile.id,
    p_number: number,
  })
  if (error) {
    console.error('start_whatsapp_number_verification:', error.message.slice(0, 160))
    return json({ error: 'verification_start_failed' }, 500)
  }
  const row = (data as { ok: boolean; reason: string; code: string | null }[] | null)?.[0]
  if (!row) return json({ error: 'verification_start_failed' }, 500)
  if (!row.ok) return json({ error: row.reason }, STATUS[row.reason] ?? 400)

  const message = buildTemplateMessage(
    'number_verification', number, { verificationCode: row.code ?? '', lang: langue }, (k) => Deno.env.get(k),
  )
  if (!message) return json({ error: 'template_not_configured', fallback: 'pairing' }, 501)

  const sent = await sendOutboundGuarded({
    admin,
    to: number,
    // ⚠ Littéral, exigé par la porte CI `check-whatsapp-outbound.mjs` — et c'est ce
    // fichier, et lui seul, qui a le droit d'écrire cette finalité.
    purpose: 'number_verification',
    payload: { type: 'template', message, templateKey: 'number_verification' },
    profileId: profile.id,
    agencyId: profile.agency_id,
    // ⛔ L'ACTEUR, et pas seulement le sujet. `profileId` dit DE QUI on parle ;
    // `sentByProfileId` dit QUI a déclenché — c'est lui qui atterrit dans
    // `whatsapp_messages.sent_by_profile_id` (whatsapp-outbound-guard.ts). Les quatre
    // sites d'envoi du webhook le renseignent ; l'omettre ici serait le pire endroit,
    // puisque `number_verification` est la SEULE finalité qui écrive à un numéro que
    // l'agent vient de TAPER, donc potentiellement celui d'un tiers. Sans lui, la ligne
    // porte le destinataire et l'agence mais personne : un abus resterait anonyme.
    sentByProfileId: profile.id,
    isAutomated: true,
  })

  if (!sent.ok) {
    // ⛔ DÉFAIRE L'ARMEMENT. La RPC pose `pending_number` et `otp_expires_at` AVANT que
    // l'envoi soit tenté — c'est inévitable, il faut le code pour l'envoyer. Sans ce
    // rattrapage, un refus (kill-switch) ou une panne Meta laissait ces colonnes posées :
    // l'agent voyait l'erreur, puis au retour sur l'onglet (`refetchOnWindowFocus`) la
    // carte basculait sur « Code envoyé, il expire dans 10 minutes ». Il attendait dix
    // minutes un code jamais parti. L'abandon rend aussi le jeton de débit — rien n'est
    // parti, donc rien n'a été consommé.
    //
    // Best-effort : si CE nettoyage échoue à son tour, l'agent garde un écran menteur,
    // mais on ne transforme pas un refus explicable en 500 opaque.
    await admin.rpc('abort_whatsapp_number_verification', { p_profile_id: profile.id })
      .then(() => {}, (e: unknown) => {
        console.error('abort_whatsapp_number_verification:', String((e as Error)?.message ?? e).slice(0, 120))
      })
    // Le motif PUBLIC, jamais le précis : `publicReason` existe pour ne pas révéler à un
    // appelant qu'un numéro a dit STOP ailleurs.
    return json({ error: sent.blocked ? sent.publicReason : 'send_failed' }, sent.blocked ? 409 : 502)
  }

  // Jamais le code. La réponse ne porte que de quoi afficher l'écran de saisie.
  return json({ ok: true, expires_in_minutes: 10 }, 200)
})
