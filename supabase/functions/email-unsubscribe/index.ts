// supabase/functions/email-unsubscribe/index.ts
// Le lien « se désinscrire » de nos e-mails. PUBLIC par nécessité, et c'est assumé.
//
// AUCUNE AUTHENTIFICATION, pour deux raisons qui vont dans le même sens :
//   · la personne qui se désinscrit n'a pas de compte chez nous et n'en aura jamais ;
//   · le geste ne peut NUIRE à personne. Il ajoute un blocage, il n'en retire aucun, et il
//     n'expose aucune donnée : la réponse est identique que l'adresse existe ou non. Un
//     tiers qui déclencherait le lien de quelqu'un d'autre ne ferait que le protéger.
// Le jeton signé sert donc à porter l'adresse sans la mettre en clair dans l'URL, pas à
// autoriser — c'est la nature du geste qui autorise.
//
// POST = « one-click » (RFC 8058), ce que Gmail et Outlook appellent quand ils affichent
// leur propre bouton « Se désinscrire ». GET = la page qu'on voit en cliquant le lien du
// pied de page. Les deux font la même chose ; seul le rendu diffère.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyMagicLinkToken } from '../_shared/magic-link-token.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

/**
 * Page rendue à la personne. Volontairement close : pas de logo cliquable, pas de lien de
 * retour vers l'app. Quelqu'un qui vient de dire « ne m'écrivez plus » n'a pas à être
 * réengagé sur la page qui acte son refus.
 */
function page(titre: string, corps: string, status: number): Response {
  return new Response(
    `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex"/><title>${titre}</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#fafafa;color:#1f2937;">
  <div style="max-width:420px;padding:32px;text-align:center;">
    <div style="font-size:18px;font-weight:600;margin-bottom:10px;">${titre}</div>
    <div style="font-size:14px;line-height:1.6;color:#4b5563;">${corps}</div>
  </div>
</body></html>`,
    { status, headers: { ...CORS, 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS })
  }

  const url = new URL(req.url)
  // Le POST one-click de Gmail ne renvoie PAS la query string dans un corps : le jeton doit
  // rester dans l'URL, que les deux méthodes partagent.
  const token = url.searchParams.get('t') ?? ''
  const oneClick = req.method === 'POST'

  const v = await verifyMagicLinkToken(token)
  if (!v.valid || !v.payload || v.payload.k !== 'unsub' || !v.payload.e) {
    // ⚠ Un jeton expiré NE DOIT PAS bloquer le geste : le lien vit dans un e-mail qu'on
    // relit des mois plus tard, et répondre « lien expiré » à quelqu'un qui demande à ne
    // plus être contacté serait un refus déguisé. On accepte donc l'expiration, et on ne
    // rejette que ce qui n'est pas authentique.
    const expire = v.reason === 'expired' && v.payload?.k === 'unsub' && v.payload?.e
    if (!expire) {
      return oneClick
        ? new Response('invalid', { status: 400, headers: CORS })
        : page('Lien invalide', "Ce lien de désinscription n'est pas valide. Écrivez-nous à privacy@megga.ch et nous le ferons à la main.", 400)
    }
  }
  const email = String(v.payload?.e ?? '').trim().toLowerCase()

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
  const contactId = v.payload?.id && v.payload.id !== '-' ? v.payload.id : null

  const { error } = await admin.rpc('suppress_contact_email', {
    p_email: email,
    p_source_ref: oneClick ? 'list_unsubscribe_one_click' : 'list_unsubscribe_link',
    p_contact_id: contactId,
  })
  if (error) {
    console.error('email-unsubscribe:', error.message.slice(0, 120))
    return oneClick
      ? new Response('error', { status: 500, headers: CORS })
      : page('Une erreur est survenue', "Nous n'avons pas pu enregistrer votre demande. Écrivez-nous à privacy@megga.ch, nous la traiterons à la main.", 500)
  }

  // ⚠ Le même message que l'adresse ait été bloquée à l'instant ou qu'elle l'était déjà :
  // distinguer les deux dirait à un tiers si une adresse est dans notre fichier.
  return oneClick
    ? new Response('ok', { status: 200, headers: CORS })
    : page(
        'C’est fait',
        'Vous ne recevrez plus d’e-mails de notre part. Pour accéder à vos données, les corriger ou les supprimer : privacy@megga.ch.',
        200,
      )
})
