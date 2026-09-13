// supabase/functions/magic-link-get/index.ts
// GET /functions/v1/magic-link-get   (jeton dans l'en-tête `x-magic-link-token`)
//
// Sprint 4.7.A — Endpoint PUBLIC (sans auth) qui résout un token magique
// et retourne l'état du lien + le contexte minimal pour l'écran client.
//
// CE QUE LE PORTEUR LIT — une LISTE BLANCHE, pas une liste de colonnes (audit du
// 13.09.2026, point S10). Lien ouvert : `buildMagicLinkPublicView`
// (_shared/magic-link-public-view.ts) recopie champ par champ le prénom, le nom de
// l'agent et de l'agence, le mode, l'échéance, le statut, et pour chaque pièce son id,
// son type, son nom de fichier, sa taille et sa date. Lien soumis : seulement
// {status, confirmed_at, message}. Lien expiré : 410 {status, expires_at, message}.
//
// Ce qui ne sort PLUS, et pourquoi : `ocr_fields` (nom, numéro de pièce, date de
// naissance), le nom de famille, `custom_message` (déjà dans le courriel qui porte le
// lien), le `slug` de l'agence et `confirmed_by_client`. La page ne lisait aucun d'eux ;
// les servir ne profitait qu'à qui tient un lien transféré, pendant toute sa vie.
//
// Sécurité :
//   - Vérification HMAC stricte
//   - Jeton hors URL (en-tête) : les journaux d'accès de la plateforme
//     enregistrent l'URL complète des requêtes
//   - Au 1er hit, on incrémente `opened_at` et passe status à 'opened'
//   - Si expiré → status='expired' + AuditEvent + 410 Gone
//   - Aucune écriture de statut ne franchit un statut terminal (filtre
//     MAGIC_LINK_OPEN_STATUSES) : un dossier soumis n'est jamais réécrit

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyMagicLinkToken } from '../_shared/magic-link-token.ts'
import { buildMagicLinkPublicView } from '../_shared/magic-link-public-view.ts'
import { MAGIC_LINK_OPEN_STATUSES } from '../_shared/magic-link-limits.ts'

// `x-magic-link-token` DOIT figurer ici : l'appel vient d'un navigateur en
// cross-origin, et un en-tête absent de cette liste fait échouer le preflight —
// l'écran KYC n'obtient alors qu'une erreur CORS opaque.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage, x-magic-link-token',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Jeton en en-tête : les journaux d'accès de la plateforme conservent l'URL
  // complète, un `?token=` y déposerait chaque jeton KYC en clair pour toute sa
  // durée de vie. Repli sur le query param par COMPATIBILITÉ — les liens déjà
  // envoyés et les appelants hors navigateur doivent continuer de fonctionner.
  const url = new URL(req.url)
  const token = req.headers.get('x-magic-link-token')?.trim() || url.searchParams.get('token')
  if (!token) {
    return new Response(JSON.stringify({ error: 'x-magic-link-token header required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 1. Vérification HMAC (signature + expiration crypto)
  const verifyResult = await verifyMagicLinkToken(token)
  if (!verifyResult.valid || !verifyResult.payload) {
    // Le motif interne n'est PAS reporté tel quel : `no_secret` dirait à un appelant
    // anonyme que le secret HMAC manque sur ce déploiement (donc que tous les liens
    // sont morts), et `malformed` vs `invalid_signature` lui dirait quand il a touché
    // la grammaire du jeton — de quoi calibrer une tentative de forge. Le client ne
    // distingue que « expiré » du reste (KycPublicPage), c'est donc tout ce qui sort.
    const statusCode = verifyResult.reason === 'expired' ? 410 : 401
    return new Response(
      JSON.stringify({
        error: 'Invalid or expired link',
        reason: verifyResult.reason === 'expired' ? 'expired' : 'invalid',
      }),
      { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const magicLinkId = verifyResult.payload.id

  // 2. Service role pour bypasser RLS (endpoint public)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const { data: link, error: linkErr } = await supabase
    .from('kyc_magic_links')
    // Rien de plus que ce que les contrôles et la vue publique lisent : `custom_message`
    // et consorts n'ont plus rien à faire dans la mémoire d'un endpoint public.
    .select('id, token, agency_id, contact_id, mode, status, expires_at, confirmed_at, created_by')
    .eq('id', magicLinkId)
    .single()

  if (linkErr || !link) {
    return new Response(JSON.stringify({ error: 'Link not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Double-check : le token stocké en DB doit correspondre exactement
  // (défense contre attaque par révocation : si l'agent regénère un lien,
  // l'ancien token doit être invalidé).
  if (link.token !== token) {
    return new Response(
      JSON.stringify({ error: 'Token superseded', reason: 'regenerated' }),
      { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // 3. Si déjà soumis → tout est OK mais on n'expose pas les écrans de upload
  if (link.status === 'submitted') {
    return new Response(
      JSON.stringify({
        status: 'submitted',
        confirmed_at: link.confirmed_at,
        message: 'Dossier déjà soumis. Merci !',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // 4. Si expiré (côté DB) → 410
  if (link.status === 'expired' || new Date(link.expires_at) <= new Date()) {
    if (link.status !== 'expired') {
      // On marque expiré côté DB pour idempotence. Filtré sur les statuts OUVERTS : une
      // soumission concurrente, arrivée entre la lecture et cette écriture, ne doit pas
      // être réécrite en « expiré ».
      await supabase
        .from('kyc_magic_links')
        .update({ status: 'expired', expired_at: new Date().toISOString() })
        .eq('id', magicLinkId)
        .in('status', [...MAGIC_LINK_OPEN_STATUSES])
    }
    return new Response(
      JSON.stringify({
        status: 'expired',
        expires_at: link.expires_at,
        message: 'Ce lien a expiré. Demandez à votre agent de vous en envoyer un nouveau.',
      }),
      { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // 5. Premier hit (status='pending') → on log l'ouverture.
  // Guard race condition : `.eq('status', 'pending')` garantit que seul le
  // PREMIER hit pose les valeurs forensiques (IP/UA). Sans ce guard, un preview
  // Gmail + un clic utilisateur en parallèle écraseraient l'IP du premier
  // ouvreur réel.
  if (link.status === 'pending') {
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('cf-connecting-ip') ||
      null
    const clientUa = req.headers.get('user-agent')

    await supabase
      .from('kyc_magic_links')
      .update({
        status: 'opened',
        opened_at: new Date().toISOString(),
        client_ip: clientIp,
        client_user_agent: clientUa,
      })
      .eq('id', magicLinkId)
      .eq('status', 'pending')
  }

  // 6. Charge contexte UX pour l'écran client
  // (nom agent + nom agence + uploads déjà reçus). Les `select` sont réduits à la liste
  // blanche, MAIS ce n'est pas eux qui la tiennent : c'est `buildMagicLinkPublicView`, qui
  // recopie champ par champ. Un `select` élargi demain n'atteindra pas le porteur.
  const [contactRes, agencyRes, agentRes, uploadsRes] = await Promise.all([
    supabase
      .from('contacts')
      .select('first_name')
      .eq('id', link.contact_id)
      .single(),
    supabase.from('agencies').select('name').eq('id', link.agency_id).single(),
    link.created_by
      ? supabase.from('profiles').select('full_name').eq('id', link.created_by).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('kyc_magic_link_uploads')
      .select('id, type, filename, size_bytes, uploaded_at')
      .eq('magic_link_id', magicLinkId)
      .order('uploaded_at', { ascending: true }),
  ])

  return new Response(
    JSON.stringify(buildMagicLinkPublicView({
      link,
      contact: contactRes.data,
      agency: agencyRes.data,
      agent: agentRes.data,
      uploads: uploadsRes.data,
    })),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
