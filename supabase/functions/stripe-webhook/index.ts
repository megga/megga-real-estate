// supabase/functions/stripe-webhook/index.ts
// Edge Function pour gérer les webhooks Stripe
// Met à jour la table subscriptions quand un événement Stripe arrive
// AUCUNE AUTH SUPABASE — validation via Stripe webhook signing secret

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'
import { reportEdgeError } from '../_shared/audit-edge-error.ts'
import {
  buildStripeIdentityRecord,
  isStripeVerificationStatus,
} from '../_shared/kyb-identity-stripe.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

function getPlanFromPriceId(priceId: string): string {
  const priceMap: Record<string, string> = {
    [Deno.env.get('STRIPE_PRICE_PRO_MONTHLY') ?? '']: 'pro',
    [Deno.env.get('STRIPE_PRICE_PRO_YEARLY') ?? '']: 'pro',
    [Deno.env.get('STRIPE_PRICE_ENTREPRISE_MONTHLY') ?? '']: 'entreprise',
    [Deno.env.get('STRIPE_PRICE_ENTREPRISE_YEARLY') ?? '']: 'entreprise',
  }
  return priceMap[priceId] || 'starter'
}

function getBillingPeriod(priceId: string): string {
  const yearlyPrices = [
    Deno.env.get('STRIPE_PRICE_PRO_YEARLY'),
    Deno.env.get('STRIPE_PRICE_ENTREPRISE_YEARLY'),
  ]
  return yearlyPrices.includes(priceId) ? 'yearly' : 'monthly'
}

/**
 * MRR mensuel d'une ligne d'abonnement, en CHF, selon la règle de comptage §4.3 de la
 * console : un essai, un impayé, un abonnement annulé et le plan Starter (0 CHF) comptent
 * ZÉRO. Le montant vient du prix Stripe, jamais d'un catalogue recopié — un écart entre le
 * prix facturé et le prix affiché serait invisible autrement.
 */
function monthlyRevenue(
  subscription: Stripe.Subscription,
  status: string,
  plan: string,
): number {
  if (status !== 'active' || plan === 'starter') return 0
  const price = subscription.items?.data?.[0]?.price
  const cents = price?.unit_amount ?? 0
  if (!cents) return 0
  // Un abonnement annuel est ramené au mois : sans cela, décembre pèserait douze fois.
  const perMonth = price?.recurring?.interval === 'year' ? cents / 12 : cents
  return Math.round(perMonth) / 100
}

/**
 * Traite un événement Stripe Identity : retrouve la personne, développe ce que Stripe a
 * vérifié, et écrit l'état + les verdicts de correspondance.
 *
 * ⚠ Rien de ce qui est écrit ici n'est une DONNÉE d'identité. Ni nom, ni prénom, ni
 * date de naissance, ni numéro : uniquement des verdicts de comparaison avec la ligne
 * déjà déclarée par le dirigeant (buildStripeIdentityRecord). Stripe garde l'original
 * de son côté et sait le supprimer sur demande. Dupliquer la PII pour dire qu'elle
 * correspond à elle-même créerait une seconde copie à protéger et à purger.
 *
 * ⚠ Rien ici ne valide un dossier. `verification_status` de l'AGENCE n'est pas touché,
 * aucun check n'est écrit : le seul verdict de la pièce reste `id_document` /
 * `pending_manual_review`, tranché par un humain. Une vérification réussie donne au
 * relecteur une preuve qu'il n'avait pas, elle ne prend pas sa décision.
 *
 * La personne est retrouvée par `metadata.related_person_id` (posé à la création) avec
 * repli sur l'identifiant de session — l'index partiel de 20260803160000 couvre le
 * second chemin. Deux chemins parce qu'une session créée à la main depuis le tableau de
 * bord Stripe n'aurait pas la metadata.
 */
async function handleIdentityVerification(
  stripeClient: Stripe,
  session: Stripe.Identity.VerificationSession,
): Promise<void> {
  // Client ouvert ICI plutôt que reçu en paramètre : `ReturnType<typeof createClient>`
  // ne se réconcilie pas avec le client réellement construit dans `serve` (les
  // paramètres de type par défaut résolvent en `never`), et le fichier a déjà ce motif
  // dans son `catch` de fin. Un client Supabase est un objet de configuration, pas une
  // connexion : en ouvrir un second ne coûte rien.
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const relatedPersonId = session.metadata?.related_person_id ?? null

  const query = supabaseAdmin
    .from('agency_related_persons')
    .select('id, first_name, last_name, date_of_birth')
  const { data: person } = relatedPersonId
    ? await query.eq('id', relatedPersonId).maybeSingle()
    : await query.eq('identity_verification_session_id', session.id).maybeSingle()

  if (!person) {
    // Une session sans ligne correspondante n'est pas une erreur de traitement : elle
    // vient d'un autre environnement (test vs live) ou d'un essai manuel. Acquitter
    // évite que Stripe la rejoue indéfiniment.
    console.log(`identity: aucune personne pour la session ${session.id}`)
    return
  }

  // Le rapport porte ce que le DOCUMENT dit (nature, pays émetteur, échéance) ; la
  // session développée porte ce que Stripe a VÉRIFIÉ (nom, prénom, naissance). Les deux
  // sont nécessaires, et le rapport n'existe qu'une fois la capture faite.
  let document: Stripe.Identity.VerificationReport.Document | null = null
  let verifiedOutputs: Stripe.Identity.VerificationSession.VerifiedOutputs | null = null
  try {
    const expanded = await stripeClient.identity.verificationSessions.retrieve(session.id, {
      expand: ['verified_outputs', 'last_verification_report'],
    })
    verifiedOutputs = expanded.verified_outputs ?? null
    const report = expanded.last_verification_report
    if (report && typeof report !== 'string') document = report.document ?? null
  } catch (e) {
    // Le statut reste écrit même si le développement échoue : savoir qu'une session est
    // `verified` sans connaître l'échéance vaut mieux que ne rien savoir du tout.
    console.error('identity: expand impossible', (e as Error)?.name)
  }

  const status = isStripeVerificationStatus(session.status) ? session.status : 'requires_input'
  const record = buildStripeIdentityRecord(
    {
      sessionId: session.id,
      status,
      firstName: verifiedOutputs?.first_name ?? null,
      lastName: verifiedOutputs?.last_name ?? null,
      dob: verifiedOutputs?.dob ?? null,
      documentType: document?.type ?? null,
      issuingCountry: document?.issuing_country ?? null,
      expirationDate: document?.expiration_date ?? null,
      errorCode: session.last_error?.code ?? null,
    },
    {
      firstName: (person.first_name as string) ?? '',
      lastName: (person.last_name as string) ?? '',
      dateOfBirth: (person.date_of_birth as string | null) ?? null,
    },
    new Date().toISOString().slice(0, 10),
  )

  await supabaseAdmin
    .from('agency_related_persons')
    .update({
      identity_verification_session_id: session.id,
      identity_verification_status: status,
      identity_verification_error_code: record.errorCode,
      // Posé UNE fois, au passage en `verified`. Une reprise ultérieure ne l'efface
      // pas : le dossier a bien été vérifié ce jour-là, et l'audit doit pouvoir le dire.
      ...(status === 'verified' ? { identity_verified_at: new Date().toISOString() } : {}),
      id_document_read: record,
      id_document_expires_on: record.expiresOn,
      // `other` est une valeur légitime du CHECK (permis de conduire chez Stripe) ;
      // null signifie « pas encore su » et ne doit pas écraser une nature déjà déclarée
      // à la main à l'étape 3.
      ...(record.documentType ? { id_document_type: record.documentType } : {}),
    })
    .eq('id', person.id as string)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startedAt = Date.now()
  try {
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')!
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

    let event: Stripe.Event
    try {
      event = await stripe.webhooks.constructEventAsync(
        body, signature, webhookSecret
      )
    } catch (err) {
      console.error('Webhook signature verification failed:', (err as Error).message)
      return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    switch (event.type) {
      // ─── Checkout completed — activate subscription ───
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const subscriptionId = session.subscription as string
        const customerId = session.customer as string

        // Retrieve full subscription from Stripe
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const priceId = subscription.items.data[0].price.id
        const agencyId = subscription.metadata.agency_id

        if (!agencyId) {
          console.error('No agency_id in subscription metadata')
          break
        }

        // UPSERT subscription in DB
        const { error } = await supabaseAdmin
          .from('subscriptions')
          .upsert({
            agency_id: agencyId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            stripe_price_id: priceId,
            plan: getPlanFromPriceId(priceId),
            billing_period: getBillingPeriod(priceId),
            status: 'active',
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            // Étape 7 (console §5.7) : les files « essais qui finissent » et « impayés »
            // lisent ces colonnes. `trial_end` vient de Stripe, jamais d'un calcul local.
            trial_end: subscription.trial_end
              ? new Date(subscription.trial_end * 1000).toISOString()
              : null,
            // Règle de comptage §4.3, appliquée À L'ÉCRITURE pour que le MRR ne soit jamais
            // recalculé côté front : essai, impayé, annulé et Starter (0 CHF) comptent ZÉRO.
            mrr_chf: monthlyRevenue(subscription, 'active', getPlanFromPriceId(priceId)),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'agency_id' })

        if (error) console.error('Failed to upsert subscription:', error)

        // Update agencies.stripe_customer_id
        await supabaseAdmin
          .from('agencies')
          .update({ stripe_customer_id: customerId })
          .eq('id', agencyId)

        // Log activity event
        await supabaseAdmin.from('activity_events').insert({
          agency_id: agencyId,
          actor_id: null,
          actor_kind: 'system',
          action: 'subscription_activated',
      // `settings` faute de mieux : le CHECK n'a pas de famille « facturation ». C'est
      // celle qu'`agency_created` utilise déjà pour les événements de niveau agence.
      category: 'settings',
          entity_type: 'agency',
          entity_id: agencyId,
          metadata: {
            plan: getPlanFromPriceId(priceId),
            stripe_customer_id: customerId,
            billing_period: getBillingPeriod(priceId),
          },
        })

        console.log(`Agency ${agencyId} subscription activated: ${getPlanFromPriceId(priceId)}`)
        break
      }

      // ─── Subscription updated (plan change, renewal, etc.) ───
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const priceId = subscription.items.data[0].price.id
        const plan = getPlanFromPriceId(priceId)
        const status = subscription.status

        // Find agency by stripe_customer_id
        const { data: sub } = await supabaseAdmin
          .from('subscriptions')
          .select('agency_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        // Fallback: check agencies table
        let agencyId = sub?.agency_id
        if (!agencyId) {
          const { data: agency } = await supabaseAdmin
            .from('agencies')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .maybeSingle()
          agencyId = agency?.id
        }

        if (!agencyId) {
          console.error('No agency found for Stripe customer:', customerId)
          break
        }

        // Update subscription
        await supabaseAdmin
          .from('subscriptions')
          .upsert({
            agency_id: agencyId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription.id,
            stripe_price_id: priceId,
            plan,
            billing_period: getBillingPeriod(priceId),
            status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            trial_end: subscription.trial_end
              ? new Date(subscription.trial_end * 1000).toISOString()
              : null,
            mrr_chf: monthlyRevenue(subscription, status, plan),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'agency_id' })

        // Log activity
        await supabaseAdmin.from('activity_events').insert({
          agency_id: agencyId,
          actor_id: null,
          actor_kind: 'system',
          action: 'subscription_changed',
      category: 'settings',
          entity_type: 'agency',
          entity_id: agencyId,
          metadata: { plan, status, billing_period: getBillingPeriod(priceId) },
        })

        console.log(`Agency ${agencyId} subscription updated: ${plan} (${status})`)
        break
      }

      // ─── Subscription deleted (cancelled) ───
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        const { data: sub } = await supabaseAdmin
          .from('subscriptions')
          .select('agency_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        let agencyId = sub?.agency_id
        if (!agencyId) {
          const { data: agency } = await supabaseAdmin
            .from('agencies')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .maybeSingle()
          agencyId = agency?.id
        }

        if (agencyId) {
          await supabaseAdmin
            .from('subscriptions')
            .update({
              status: 'canceled',
              plan: 'starter',
              updated_at: new Date().toISOString(),
            })
            .eq('agency_id', agencyId)

          await supabaseAdmin.from('activity_events').insert({
            agency_id: agencyId,
            actor_id: null,
            actor_kind: 'system',
            action: 'subscription_cancelled',
            entity_type: 'agency',
            entity_id: agencyId,
            // La gravité manquait, donc la colonne retombait sur `info` — et le
            // bento d'alertes ne lit que `warn`/`critical`. L'événement était
            // donc écrit correctement depuis toujours, mais invisible là où il
            // comptait. Une agence qui résilie mérite un regard.
            category: 'settings',
            severity: 'warn',
            metadata: { previous_customer_id: customerId },
          })

          console.log(`Agency ${agencyId} subscription cancelled → starter`)
        }
        break
      }

      // ─── Payment failed ───
      // §5.7, file « essais qui finissent ». L'événement n'était PAS traité : la colonne
      // trial_end ne se remplissait qu'au prochain subscription.updated, c'est-à-dire
      // souvent après la fin de l'essai — donc trop tard pour la file qui la lit.
      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        const { data: sub } = await supabaseAdmin
          .from('subscriptions')
          .select('agency_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        if (sub?.agency_id) {
          await supabaseAdmin
            .from('subscriptions')
            .update({
              trial_end: subscription.trial_end
                ? new Date(subscription.trial_end * 1000).toISOString()
                : null,
              updated_at: new Date().toISOString(),
            })
            .eq('agency_id', sub.agency_id)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        const { data: sub } = await supabaseAdmin
          .from('subscriptions')
          .select('agency_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        const agencyId = sub?.agency_id
        if (agencyId) {
          await supabaseAdmin
            .from('subscriptions')
            .update({
              status: 'past_due',
              last_invoice_status: 'payment_failed',
              // Un impayé sort du MRR (§4.3) : la valeur affichée ne doit pas survivre à
              // l'échec de paiement qui la rend caduque.
              mrr_chf: 0,
              updated_at: new Date().toISOString(),
            })
            .eq('agency_id', agencyId)

          await supabaseAdmin.from('activity_events').insert({
            agency_id: agencyId,
            actor_id: null,
            actor_kind: 'system',
            action: 'payment_failed',
            entity_type: 'agency',
            entity_id: agencyId,
            // Même correction de gravité : l'abonnement passe en `past_due`
            // juste au-dessus, c'est actionnable — ça n'a rien d'une info.
            category: 'settings',
            severity: 'warn',
            metadata: { invoice_id: invoice.id },
          })

          console.warn(`Payment failed for agency ${agencyId}`)
        }
        break
      }

      // ─── Payment succeeded ───
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        const { data: sub } = await supabaseAdmin
          .from('subscriptions')
          .select('agency_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        const agencyId = sub?.agency_id
        if (agencyId && invoice.lines?.data?.[0]?.period) {
          const period = invoice.lines.data[0].period
          await supabaseAdmin
            .from('subscriptions')
            .update({
              status: 'active',
              last_invoice_status: 'paid',
              current_period_start: new Date(period.start * 1000).toISOString(),
              current_period_end: new Date(period.end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('agency_id', agencyId)
        }
        break
      }

      // ─── Stripe Identity — vérification d'identité du dirigeant (KYB, étape 3) ───
      //
      // Les quatre statuts arrivent ici, pas seulement les deux terminaux : le wizard
      // affiche « en cours de traitement » sur `processing`, et une session annulée
      // doit cesser de compter comme une vérification en attente.
      //
      // Pourquoi ce webhook et pas le retour de navigation : l'utilisateur peut fermer
      // l'onglet chez Stripe. Une réponse HTTP au navigateur n'est pas une preuve ; ce
      // canal-ci est signé et rejoué par Stripe jusqu'à acquittement.
      case 'identity.verification_session.verified':
      case 'identity.verification_session.requires_input':
      case 'identity.verification_session.processing':
      case 'identity.verification_session.canceled': {
        const session = event.data.object as Stripe.Identity.VerificationSession
        await handleIdentityVerification(stripe, session)
        break
      }

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Stripe webhook error:', err)
    // Ce catch n'est atteint qu'APRÈS la vérification de signature Stripe (qui
    // sort en 400 plus haut) : un appelant qui n'a pas le secret ne peut donc
    // pas provoquer d'écriture ici. `supabaseAdmin` est déclaré dans le `try`,
    // hors de portée — on rouvre un client plutôt que de restructurer.
    await reportEdgeError(
      createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!),
      'stripe-webhook',
      err,
      { startedAt },
    )

    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
