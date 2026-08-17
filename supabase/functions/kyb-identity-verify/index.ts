// supabase/functions/kyb-identity-verify/index.ts
//
// Ouvre une VerificationSession Stripe Identity pour le signataire d'une agence, et
// rend l'URL de la page hébergée. Appelée par le navigateur du DIRIGEANT à l'étape 3 du
// wizard KYB.
//
// C'est Stripe qui capture la pièce et le selfie : **aucune image n'entre chez MEGGA
// par ce chemin**. Ce que MEGGA garde tient en quatre colonnes d'état
// (`identity_verification_*`, migration 20260803160000) plus, à la vérification, des
// verdicts de correspondance -- jamais un nom, une date de naissance ou un numéro lus.
//
// ── Ce que cette fonction ne fait PAS ───────────────────────────────────────────────
//
// Elle ne conclut rien. Elle crée la session et note son identifiant ; le résultat
// arrive par WEBHOOK (`identity.verification_session.*`, traité dans stripe-webhook),
// jamais par le retour de cet appel — une réponse HTTP au navigateur n'est pas une
// preuve, et l'utilisateur peut fermer l'onglet en cours de route.
//
// ── Idempotence ─────────────────────────────────────────────────────────────────────
//
// ── Où vivent les contrôles exigés ──────────────────────────────────────────────────
//
// ICI, en clair. Ils ont vécu du 3 au 17 août 2026 dans un FLUX du tableau de bord
// Stripe (`STRIPE_IDENTITY_FLOW_ID` = `vf_1U0PPiRNzm4ajaDa63xeKeL3`, « KYB dirigeant
// agence »), et ce flux est retiré parce qu'il COÛTAIT LE RETOUR DE L'UTILISATEUR.
//
// ⛔ **`verification_flow` et `return_url` NE SE COMBINENT PAS, et Stripe ne le dit
// nulle part** — ni dans la référence de l'API, qui donne `return_url` comme un
// paramètre ordinaire, ni dans le guide des flux, qui ne le mentionne pas du tout.
// Mesuré le 17 août 2026 sur la session `vs_1U5Y6HRNzm4ajaDaoMv1BMNI` (journal d'API
// Stripe, `req_WZUCE21ewpBdBS`) : le corps POST portait bien
// `return_url=https://app.megga.ch/dashboard/identite?verification=done`, la réponse
// **200 OK ne portait AUCUN champ `return_url`**. Stripe accepte le paramètre et le
// JETTE EN SILENCE dès qu'un flux est passé. Aucune erreur, aucun avertissement.
//
// Effet vécu : le dirigeant photographie sa pièce, arrive sur l'écran « Vous pouvez à
// présent fermer cet onglet » de Stripe, et **n'est jamais renvoyé** sur
// IdentityVerificationReturnScreen — donc jamais sur l'étape « Rendez-vous ». Le
// parcours s'arrête net au milieu, alors que tout a fonctionné : le webhook passe, la
// personne est `verified`. Le seul chemin de retour restant était le bouton « précédent »
// du navigateur, deux fois.
//
// ⚠ Le flux ne portait AUCUN réglage d'URL de retour à mettre à la place (relevé dans
// sa page du tableau de bord le 17.08 : Type Document, selfie exigé, capture en direct,
// passeport + carte d'identité — et rien d'autre). Il n'y avait donc pas de correctif
// côté Stripe, seulement celui-ci.
//
// Les quatre options ci-dessous sont la transcription EXACTE de ce que le flux
// configurait : ce changement ne modifie rien de ce que Stripe demande au dirigeant,
// il ne fait que rendre le retour possible. Il ramène au passage ces contrôles sous
// relecture de code, ce que l'en-tête d'origine notait déjà comme la contrepartie
// assumée du choix du tableau de bord.
//
// ── Une session déjà ouverte se REPREND ─────────────────────────────────────────────
//
// Une session déjà ouverte et REPRENABLE (`requires_input`, `processing`) est rendue
// telle quelle plutôt que doublée : deux sessions vivantes pour la même personne
// feraient arriver deux webhooks contradictoires sur la même ligne, dans un ordre que
// rien ne garantit. Une session `canceled`, ou dont l'URL a expiré (48 h chez Stripe),
// est remplacée.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { isStripeVerificationStatus } from '../_shared/kyb-identity-stripe.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Où Stripe renvoie le dirigeant après la capture. Le wizard y relit son état. */
const RETURN_PATH = '/dashboard/identite?verification=done'

/** Statuts pour lesquels une session existante se REPREND au lieu de se recréer. */
const RESUMABLE = ['requires_input', 'processing']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  if (!Deno.env.get('STRIPE_SECRET_KEY')) {
    // Échec FERMÉ : sans clé, aucune vérification n'est possible. Le dire explicitement
    // laisse l'écran proposer le dépôt manuel plutôt que d'afficher un bouton mort.
    return json({ error: 'verification_unavailable' }, 503)
  }

  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth
  const { user, profile } = auth

  // MÊME définition d'administrateur d'agence que la base : is_agency_admin() vaut
  // `role in ('admin','manager')`. Écrire ici une liste différente ferait de cette
  // fonction une porte plus large que celle qu'elle double.
  if (profile.role !== 'admin' && profile.role !== 'manager') {
    return json({ error: 'forbidden' }, 403)
  }

  let body: { related_person_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }
  const relatedPersonId = typeof body.related_person_id === 'string' ? body.related_person_id : ''
  if (!relatedPersonId) return json({ error: 'related_person_id required' }, 400)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // La personne est lue en service role, puis son agence est confrontée à celle du
  // PROFIL de l'appelant — jamais un agency_id venu du corps de la requête, qui
  // laisserait ouvrir une vérification au nom d'une autre agence.
  const { data: person, error: personError } = await supabase
    .from('agency_related_persons')
    .select('id, agency_id, identity_verification_session_id, identity_verification_status')
    .eq('id', relatedPersonId)
    .maybeSingle()
  if (personError) return json({ error: 'lookup_failed' }, 500)
  // Même réponse pour « n'existe pas » et « pas votre agence » : les distinguer dirait
  // à un appelant si un id de personne existe ailleurs.
  if (!person || person.agency_id !== profile.agency_id) return json({ error: 'forbidden' }, 403)

  const existingId = person.identity_verification_session_id as string | null
  const existingStatus = person.identity_verification_status as string | null

  if (existingId && existingStatus && RESUMABLE.includes(existingStatus)) {
    try {
      const existing = await stripe.identity.verificationSessions.retrieve(existingId)
      // `url` est absente d'une session qui n'attend plus rien de l'utilisateur
      // (processing) et expire au bout de 48 h : son absence n'est pas une erreur,
      // c'est le signal qu'il faut en ouvrir une neuve.
      if (existing.url && isStripeVerificationStatus(existing.status) && RESUMABLE.includes(existing.status)) {
        return json({ url: existing.url, session_id: existing.id, status: existing.status, resumed: true })
      }
    } catch {
      // Session introuvable côté Stripe (clé changée, mode test vs live) : on en ouvre
      // une neuve plutôt que de renvoyer une erreur à un dirigeant qui n'y peut rien.
    }
  }

  const origin = req.headers.get('origin') ?? ''
  let session: Stripe.Identity.VerificationSession
  try {
    session = await stripe.identity.verificationSessions.create({
      // ⛔ NE PAS RÉINTRODUIRE `verification_flow` ICI : il annule `return_url` en
      // silence, et avec lui tout le retour du dirigeant dans le wizard (cf. l'en-tête,
      // mesuré le 17.08.2026). Ces quatre options SONT la configuration que portait le
      // flux, transcrite à l'identique.
      type: 'document' as const,
      options: {
        document: {
          // Passeport et carte d'identité SEULEMENT. Le permis de conduire, que
          // Stripe accepte pourtant, est écarté : l'identification d'une personne
          // physique dans un dossier LAB suisse se fait sur un document officiel
          // d'IDENTITÉ, et un permis n'en est pas un. L'autoriser produirait des
          // vérifications « réussies » que l'équipe conformité refuserait ensuite —
          // le pire des deux mondes, un utilisateur qui a fait le travail pour rien.
          //
          // Le titre de séjour, lui, n'existe PAS chez Stripe : un dirigeant au
          // livret B/C passe par son passeport, ou par le dépôt manuel. Voir
          // l'en-tête de _shared/kyb-identity-stripe.ts.
          allowed_types: ['passport', 'id_card'] as Array<'passport' | 'id_card'>,
          // Le contrôle du vivant, c'est-à-dire ce que le catalogue de checks promet
          // depuis l'origine (« Pièce d'identité et détection du vivant ») et que le
          // dépôt d'un fichier ne pourra jamais offrir.
          require_matching_selfie: true,
          // Interdit le téléversement d'une image existante : la pièce doit être
          // photographiée sur place. Une capture d'écran d'un document volé ne passe pas.
          require_live_capture: true,
          // NON : le numéro de pièce est la PII que le dépôt désigne comme sensible,
          // et rien ne le consomme. Ne pas le demander, c'est ne pas avoir à le protéger.
          require_id_number: false,
        },
      },
      // Suit l'hôte RÉEL (local, préversion Cloudflare, production) plutôt qu'une valeur
      // figée. Vide (appel hors navigateur) -> Stripe affiche son écran de fin sans
      // bouton de retour, ce qui est alors le comportement juste.
      ...(origin ? { return_url: `${origin}${RETURN_PATH}` } : {}),
      provided_details: user.email ? { email: user.email } : undefined,
      metadata: {
        // Le webhook n'a que la session : ces deux clés sont son SEUL chemin de retour
        // vers la bonne ligne (avec l'index partiel sur session_id, 20260803160000).
        agency_id: person.agency_id as string,
        related_person_id: relatedPersonId,
      },
    })
  } catch (e) {
    // Jamais le message brut de Stripe au client : il arrive en anglais, et il porte
    // parfois le motif d'un refus d'activation du compte, qui ne regarde pas l'agent.
    console.error('kyb-identity-verify: création de session refusée', (e as Error)?.name)
    return json({ error: 'verification_unavailable' }, 503)
  }

  // L'identifiant est noté AVANT que l'utilisateur ne parte chez Stripe : s'il ferme
  // l'onglet en route, le webhook retrouvera quand même sa ligne. Le statut initial
  // vient de Stripe, jamais d'une supposition.
  const { error: writeError } = await supabase
    .from('agency_related_persons')
    .update({
      identity_verification_session_id: session.id,
      identity_verification_status: isStripeVerificationStatus(session.status) ? session.status : 'requires_input',
      identity_verification_error_code: null,
    })
    .eq('id', relatedPersonId)
  if (writeError) return json({ error: 'write_failed' }, 500)

  return json({ url: session.url, session_id: session.id, status: session.status, resumed: false })
})
