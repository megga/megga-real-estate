-- Idempotence et ordre des événements Stripe.
--
-- CONSTAT (audit signatures webhooks du 03.08.2026, §4.4). La vérification de
-- signature de `stripe-webhook` est correcte sur les six critères — le manque est
-- en aval, et il produit deux défauts distincts.
--
-- 1. AUCUN REGISTRE D'ÉVÉNEMENTS TRAITÉS. Les écritures d'état sont idempotentes
--    par construction (upserts sur agency_id avec des valeurs absolues), mais les
--    `activity_events.insert` ne le sont pas. Et ce n'est pas théorique : le
--    `catch` final de la fonction rend 500, ce qui GARANTIT un rejeu Stripe. Un
--    échec DB à mi-parcours laisse donc les inserts déjà passés en place, puis les
--    rejoue au rejeu suivant. Le journal LBA gonfle d'événements fantômes.
--
-- 2. AUCUNE GARDE D'ORDRE. Stripe ne garantit pas l'ordre de livraison, et rien
--    ne comparait `event.created` à l'état courant. Un
--    `customer.subscription.updated` arrivant APRÈS un
--    `customer.subscription.deleted` réactive un abonnement résilié et restaure
--    son `mrr_chf`. Ce chemin ne demande aucun attaquant : il suffit que Stripe
--    reprenne une livraison.

-- ── 1. Registre des événements traités ──────────────────────────────────────
--
-- `event_id` en clé primaire : c'est Stripe qui garantit son unicité (evt_…), on
-- ne fabrique donc pas d'identifiant local. Le webhook RÉSERVE l'événement avant
-- de le traiter et RETIRE sa réservation s'il échoue — sans quoi un échec
-- marquerait l'événement comme traité et le rejeu Stripe serait ignoré, ce qui
-- transformerait une panne transitoire en perte définitive.
create table if not exists public.stripe_events (
  event_id      text primary key,
  event_type    text        not null,
  -- `created` de l'événement Stripe (pas l'heure de réception) : c'est lui qui
  -- ordonne, et il survit aux rejeux.
  event_created timestamptz not null,
  received_at   timestamptz not null default now()
);

comment on table public.stripe_events is
  'Registre d''idempotence des webhooks Stripe. Une ligne = un evt_… déjà traité. '
  'Écrite uniquement par l''edge function stripe-webhook (service_role). '
  'Audit du 03.08.2026 §4.4.';

-- Table SYSTÈME : aucun client ne doit la lire ni l'écrire. RLS active SANS
-- policy = personne ne passe, sauf service_role qui la contourne par nature.
-- C'est le même verrouillage intentionnel que les 15 tables relevées par les
-- advisors, et il est ici délibéré, pas un oubli.
alter table public.stripe_events enable row level security;
revoke all on table public.stripe_events from anon;
revoke all on table public.stripe_events from authenticated;

-- Sert la purge de rétention (cf. plus bas) et l'inspection « qu'est-il arrivé
-- cette nuit ». La clé primaire couvre déjà la réservation par event_id.
create index if not exists idx_stripe_events_received_at
  on public.stripe_events (received_at desc);

-- ⚠ RÉTENTION : rien ne purge cette table aujourd'hui. Stripe ne rejoue que
-- pendant ~3 jours, donc au-delà de 30 jours une ligne ne sert plus qu'à
-- l'inspection. Le volume est faible (quelques centaines d'événements par mois)
-- et la table restera négligeable des années — un job pg_cron de purge est un
-- confort, pas une urgence, et il est laissé hors de ce correctif pour ne pas
-- mêler deux préoccupations.

-- ── 2. Garde d'ordre sur les abonnements ────────────────────────────────────
--
-- Porte le `created` du dernier événement APPLIQUÉ à cette ligne. Le webhook
-- refuse d'écrire un événement plus ancien. NULL = ligne antérieure à ce
-- correctif : le premier événement qui arrive l'adopte, sans rien rejeter.
alter table public.subscriptions
  add column if not exists last_stripe_event_at timestamptz;

comment on column public.subscriptions.last_stripe_event_at is
  'created du dernier événement Stripe appliqué. Garde d''ordre : un événement '
  'plus ancien est ignoré, sinon une livraison hors séquence réactiverait un '
  'abonnement résilié. Audit du 03.08.2026 §4.4.';
