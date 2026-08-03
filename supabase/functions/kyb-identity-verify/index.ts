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
// Dans un FLUX du tableau de bord Stripe (`STRIPE_IDENTITY_FLOW_ID`), décision du
// 3 août 2026. À défaut d'identifiant, les mêmes options sont posées en clair ici —
// ce repli fait tourner le parcours sur un compte où le flux n'existe pas encore
// (mode test neuf, préversion) plutôt que d'échouer sur un identifiant vide.
// Les deux ne se combinent pas : `type` n'est exigé que sans flux.
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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

/**
 * Flux de vérification configuré dans le tableau de bord Stripe (`vf_...`).
 *
 * Vide = les options sont posées en clair à la création (cf. plus bas). Ce n'est pas
 * un secret — c'est un identifiant de configuration, du même ordre que les
 * `STRIPE_PRICE_*` déjà en place — mais il DOIT rester hors du dépôt : le mode test et
 * le mode réel en portent deux distincts, et en figer un casserait l'autre.
 *
 * ⚠ Contrepartie assumée du choix de configurer chez Stripe plutôt qu'ici : les
 * contrôles exigés (selfie, capture en direct, types de documents) deviennent
 * modifiables depuis le tableau de bord, sans relecture ni trace côté produit. Ce qui
 * reste vérifiable a posteriori, c'est la SESSION : son `vs_...` est stocké sur la
 * personne, et Stripe conserve la configuration exacte qui l'a produite.
 */
const identityFlowId = Deno.env.get('STRIPE_IDENTITY_FLOW_ID') ?? ''

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
      // Flux configuré dans le tableau de bord Stripe quand STRIPE_IDENTITY_FLOW_ID
      // est posé, options en clair sinon. Les deux ne se combinent pas : `type` n'est
      // exigé QUE si aucun flux n'est passé, et rien dans la documentation ne décrit
      // ce que produirait un mélange des deux — on ne l'essaie donc pas.
      //
      // L'identifiant vit dans une variable d'environnement et jamais dans le dépôt :
      // un flux du mode TEST et son équivalent du mode RÉEL portent deux `vf_...`
      // distincts, exactement comme les `STRIPE_PRICE_*` déjà en place.
      //
      // Le repli en clair n'est pas décoratif : il fait tourner le parcours sur un
      // compte où le flux n'a pas encore été créé (mode test tout neuf, environnement
      // de préversion) au lieu de faire échouer la création avec un identifiant vide.
      ...(identityFlowId
        ? { verification_flow: identityFlowId }
        : {
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
        }),
      // `origin` et non l'URL de retour du flux : celle du tableau de bord est une
      // valeur FIGÉE, donc juste en production et fausse partout ailleurs. Passée ici,
      // elle suit l'hôte réel — local, préversion Cloudflare, production. Vide (appel
      // hors navigateur) -> Stripe affiche son écran de fin sans bouton de retour.
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
