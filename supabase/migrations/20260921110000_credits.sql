-- Crédits — la monnaie du studio Labs (20.09.2026).
--
-- UN solde par agence, en crédits, composé de DEUX poches : la dotation MENSUELLE du
-- plan (`included`, remise à neuf chaque mois civil, jamais reportée — le modèle
-- Higgsfield) et les crédits ACHETÉS (`purchased`, qui ne périment pas). Chaque
-- production débite d'abord la dotation, puis les achats. Tout mouvement est une ligne
-- du grand livre `credit_ledger`, append-only : c'est lui que l'écran « Consommation »
-- lit, et lui qui rend un rejeu Stripe inoffensif (index uniques par référence).
--
-- ⚠ Le client ne fait que LIRE (RLS select sur son agence) et régler sa recharge
-- automatique (`credits_set_auto_topup`). Débits, remboursements et achats passent par
-- des RPC `security definer` réservées au rôle de service : c'est l'edge qui débite
-- AVANT d'appeler le fournisseur, et rembourse si celui-ci échoue.
--
-- ⚠ Le tarif (combien de crédits vaut une image, une seconde de vidéo) N'EST PAS en
-- base : il vit dans `_shared/credits.ts`, à côté du coût fournisseur qu'il doit couvrir,
-- et la RPC reçoit un MONTANT déjà calculé. Seule la dotation par plan est une table,
-- parce qu'elle se règle sans déploiement.
--
-- Idempotente : rejouable le jour même.

-- ── 1. Dotation mensuelle par plan ─────────────────────────────────────────────
create table if not exists public.credit_plan_allowances (
  plan            text primary key,
  monthly_credits integer not null check (monthly_credits >= 0),
  updated_at      timestamptz not null default now()
);

-- `do nothing` : un réglage fait à la main en base survit au rejeu de la migration.
insert into public.credit_plan_allowances (plan, monthly_credits) values
  ('starter', 0), ('pro', 1500), ('entreprise', 4800), ('agency', 4800)
on conflict (plan) do nothing;

alter table public.credit_plan_allowances enable row level security;
drop policy if exists credit_plan_allowances_select on public.credit_plan_allowances;
create policy credit_plan_allowances_select on public.credit_plan_allowances for select to authenticated using (true);

-- ── 2. Le porte-monnaie ────────────────────────────────────────────────────────
create table if not exists public.credit_wallets (
  agency_id                 uuid primary key references public.agencies(id) on delete cascade,
  included                  integer not null default 0 check (included >= 0),
  purchased                 integer not null default 0 check (purchased >= 0),
  -- '' à la création : la première lecture verra un mois « différent » et posera la
  -- dotation tout de suite, au lieu de faire attendre le 1er du mois suivant.
  included_month            text not null default '',
  included_plan             text,
  auto_topup_enabled        boolean not null default false,
  auto_topup_threshold      integer not null default 100 check (auto_topup_threshold in (50, 100, 200, 500)),
  auto_topup_pack           text not null default '500' check (auto_topup_pack in ('200', '500', '1200', '3000')),
  -- Verrou de 10 min posé par `credits_auto_topup_claim` : deux débits simultanés
  -- sous le seuil ne déclenchent qu'UNE charge.
  auto_topup_locked_until   timestamptz,
  auto_topup_last_error     text,
  auto_topup_last_error_at  timestamptz,
  -- La carte enregistrée au premier achat (Checkout, `setup_future_usage`), sans laquelle
  -- il n'y a pas de recharge automatique. Marque et 4 derniers chiffres pour l'écran.
  stripe_payment_method_id  text,
  card_brand                text,
  card_last4                text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

alter table public.credit_wallets enable row level security;
drop policy if exists credit_wallets_select on public.credit_wallets;
create policy credit_wallets_select on public.credit_wallets for select to authenticated
  using (agency_id = public.get_my_agency_id());
-- Aucune policy d'écriture : tout passe par les RPC ci-dessous.

-- ── 3. Le grand livre ──────────────────────────────────────────────────────────
create table if not exists public.credit_ledger (
  id               uuid primary key default gen_random_uuid(),
  agency_id        uuid not null references public.agencies(id) on delete cascade,
  kind             text not null check (kind in ('grant_monthly', 'purchase', 'auto_topup', 'debit', 'refund', 'adjustment')),
  -- Signé : positif crédite, négatif débite.
  amount           integer not null,
  bucket           text not null check (bucket in ('included', 'purchased', 'mixed')),
  included_after   integer not null,
  purchased_after  integer not null,
  -- 'labs_asset' | 'stripe_payment_intent' | 'month' | 'admin'
  ref_type         text,
  ref_id           text,
  -- Pour les achats : le prix payé, en francs.
  amount_chf       numeric(8, 2),
  metadata         jsonb not null default '{}'::jsonb,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists credit_ledger_agency_created_idx
  on public.credit_ledger (agency_id, created_at desc);

-- Un paiement Stripe ne crédite qu'UNE fois, quel que soit le nombre de rejeux du webhook
-- ou de chemins (synchrone + webhook) qui le voient passer.
create unique index if not exists credit_ledger_paiement_uidx
  on public.credit_ledger (ref_type, ref_id)
  where kind in ('purchase', 'auto_topup');

-- Une production n'est débitée qu'une fois, et remboursée qu'une fois.
create unique index if not exists credit_ledger_production_uidx
  on public.credit_ledger (kind, ref_type, ref_id)
  where ref_type = 'labs_asset';

alter table public.credit_ledger enable row level security;
drop policy if exists credit_ledger_select on public.credit_ledger;
create policy credit_ledger_select on public.credit_ledger for select to authenticated
  using (agency_id = public.get_my_agency_id());

-- ── 4. Ce qu'une production a coûté, en crédits ────────────────────────────────
alter table public.labs_assets add column if not exists credits integer;

-- Le trigger de garde fige les colonnes qu'un agent ne peut pas changer : `credits` en fait partie.
create or replace function public.tg_labs_assets_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    end if;
    new.created_at := now();
    return new;
  end if;
  if auth.uid() is not null then
    new.agency_id := old.agency_id;
    new.created_by := old.created_by;
    new.kind := old.kind;
    new.status := old.status;
    new.prompt := old.prompt;
    new.voiceover_text := old.voiceover_text;
    new.voiceover_voice := old.voiceover_voice;
    new.voiceover_lang := old.voiceover_lang;
    new.voiceover_url := old.voiceover_url;
    new.source_asset_id := old.source_asset_id;
    new.url := old.url;
    new.thumbnail_url := old.thumbnail_url;
    new.width := old.width;
    new.height := old.height;
    new.duration_s := old.duration_s;
    new.aspect_ratio := old.aspect_ratio;
    new.model := old.model;
    new.provider := old.provider;
    new.provider_request_id := old.provider_request_id;
    new.provider_status_url := old.provider_status_url;
    new.provider_response_url := old.provider_response_url;
    new.error_code := old.error_code;
    new.cost_chf := old.cost_chf;
    new.credits := old.credits;
    new.metadata := old.metadata;
    new.created_at := old.created_at;
    new.completed_at := old.completed_at;
  end if;
  return new;
end;
$$;

-- ── 5. RPC — interne : le porte-monnaie, à jour et VERROUILLÉ ──────────────────
--
-- Crée la ligne si elle manque, pose la dotation du mois si le mois a changé, ajoute
-- la différence de dotation si le plan a MONTÉ en cours de mois (une baisse garde ce
-- qui a été donné), et rend la ligne verrouillée `for update` : l'appelant est dans la
-- même transaction, son débit ou son achat ne peut pas être doublé.
create or replace function public.credits_wallet_ensure(p_agency uuid)
returns public.credit_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  w    public.credit_wallets;
  mois text := to_char(now() at time zone 'utc', 'YYYY-MM');
  pl   text;
  dot  integer;
  anc  integer;
begin
  insert into public.credit_wallets (agency_id) values (p_agency) on conflict (agency_id) do nothing;
  select * into w from public.credit_wallets where agency_id = p_agency for update;

  select lower(coalesce(a.plan, 'starter')) into pl from public.agencies a where a.id = p_agency;
  pl := coalesce(pl, 'starter');
  select monthly_credits into dot from public.credit_plan_allowances where plan = pl;
  dot := coalesce(dot, 0);

  if w.included_month <> mois then
    update public.credit_wallets
      set included = dot, included_month = mois, included_plan = pl, updated_at = now()
      where agency_id = p_agency
      returning * into w;
    if dot > 0 then
      insert into public.credit_ledger (agency_id, kind, amount, bucket, included_after, purchased_after, ref_type, ref_id, metadata)
        values (p_agency, 'grant_monthly', dot, 'included', w.included, w.purchased, 'month', mois, jsonb_build_object('plan', pl));
    end if;
  elsif coalesce(w.included_plan, '') <> pl then
    -- Changement de plan en cours de mois : une montée donne la différence, tout de suite.
    select monthly_credits into anc from public.credit_plan_allowances where plan = coalesce(w.included_plan, 'starter');
    anc := coalesce(anc, 0);
    update public.credit_wallets
      set included = included + greatest(0, dot - anc), included_plan = pl, updated_at = now()
      where agency_id = p_agency
      returning * into w;
    if dot > anc then
      insert into public.credit_ledger (agency_id, kind, amount, bucket, included_after, purchased_after, ref_type, ref_id, metadata)
        values (p_agency, 'grant_monthly', dot - anc, 'included', w.included, w.purchased, 'month', mois,
                jsonb_build_object('plan', pl, 'from_plan', w.included_plan, 'upgrade', true));
    end if;
  end if;
  return w;
end;
$$;

revoke all on function public.credits_wallet_ensure(uuid) from public, anon, authenticated;
grant execute on function public.credits_wallet_ensure(uuid) to service_role;

-- ── 6. RPC — le solde, pour l'agent connecté ───────────────────────────────────
create or replace function public.credits_balance()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  ag  uuid := public.get_my_agency_id();
  w   public.credit_wallets;
  dot integer;
begin
  if ag is null then
    raise exception 'no_agency' using errcode = '42501';
  end if;
  w := public.credits_wallet_ensure(ag);
  select monthly_credits into dot from public.credit_plan_allowances where plan = coalesce(w.included_plan, 'starter');
  return json_build_object(
    'included', w.included,
    'purchased', w.purchased,
    'total', w.included + w.purchased,
    'month', w.included_month,
    'plan', w.included_plan,
    'monthly_allowance', coalesce(dot, 0),
    'auto_topup_enabled', w.auto_topup_enabled,
    'auto_topup_threshold', w.auto_topup_threshold,
    'auto_topup_pack', w.auto_topup_pack,
    'auto_topup_last_error', w.auto_topup_last_error,
    'auto_topup_last_error_at', w.auto_topup_last_error_at,
    'has_card', w.stripe_payment_method_id is not null,
    'card_brand', w.card_brand,
    'card_last4', w.card_last4
  );
end;
$$;

revoke all on function public.credits_balance() from public, anon;
grant execute on function public.credits_balance() to authenticated, service_role;

-- ── 7. RPC — régler la recharge automatique (agent connecté) ───────────────────
create or replace function public.credits_set_auto_topup(p_enabled boolean, p_threshold integer, p_pack text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  ag uuid := public.get_my_agency_id();
  w  public.credit_wallets;
begin
  if ag is null then
    raise exception 'no_agency' using errcode = '42501';
  end if;
  w := public.credits_wallet_ensure(ag);
  -- Activer sans carte enregistrée : refus lisible, pas une exception.
  if p_enabled and w.stripe_payment_method_id is null then
    return json_build_object('ok', false, 'error', 'no_card');
  end if;
  update public.credit_wallets
    set auto_topup_enabled = p_enabled,
        auto_topup_threshold = coalesce(p_threshold, auto_topup_threshold),
        auto_topup_pack = coalesce(p_pack, auto_topup_pack),
        -- Un nouveau réglage repart propre : l'erreur précédente ne le décrit plus.
        auto_topup_last_error = case when p_enabled then null else auto_topup_last_error end,
        auto_topup_last_error_at = case when p_enabled then null else auto_topup_last_error_at end,
        updated_at = now()
    where agency_id = ag;
  return json_build_object('ok', true);
end;
$$;

revoke all on function public.credits_set_auto_topup(boolean, integer, text) from public, anon;
grant execute on function public.credits_set_auto_topup(boolean, integer, text) to authenticated;

-- ── 8. RPC — débiter (rôle de service) ─────────────────────────────────────────
--
-- Débite la dotation d'abord, puis les achats ; refuse en bloc si le solde ne couvre
-- pas — jamais un débit partiel. Rend `auto_topup_due` pour que l'edge déclenche la
-- recharge sans relire le porte-monnaie.
create or replace function public.credits_debit(
  p_agency uuid, p_amount integer, p_ref_type text, p_ref_id text,
  p_metadata jsonb default '{}'::jsonb, p_actor uuid default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  w        public.credit_wallets;
  de_inc   integer;
  de_pur   integer;
  poche    text;
begin
  if p_amount is null or p_amount <= 0 then
    return json_build_object('ok', false, 'error', 'invalid_amount');
  end if;
  w := public.credits_wallet_ensure(p_agency);
  if w.included + w.purchased < p_amount then
    return json_build_object('ok', false, 'error', 'insufficient_credits',
      'balance', w.included + w.purchased, 'needed', p_amount);
  end if;

  de_inc := least(w.included, p_amount);
  de_pur := p_amount - de_inc;
  update public.credit_wallets
    set included = included - de_inc, purchased = purchased - de_pur, updated_at = now()
    where agency_id = p_agency
    returning * into w;

  poche := case when de_pur = 0 then 'included' when de_inc = 0 then 'purchased' else 'mixed' end;
  insert into public.credit_ledger (agency_id, kind, amount, bucket, included_after, purchased_after, ref_type, ref_id, metadata, created_by)
    values (p_agency, 'debit', -p_amount, poche, w.included, w.purchased, p_ref_type, p_ref_id,
            coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('from_included', de_inc, 'from_purchased', de_pur), p_actor);

  return json_build_object(
    'ok', true,
    'balance', w.included + w.purchased,
    'included', w.included,
    'purchased', w.purchased,
    'auto_topup_due', w.auto_topup_enabled and w.stripe_payment_method_id is not null
                      and (w.included + w.purchased) < w.auto_topup_threshold
                      and (w.auto_topup_locked_until is null or w.auto_topup_locked_until < now())
  );
exception when unique_violation then
  return json_build_object('ok', false, 'error', 'already_debited');
end;
$$;

revoke all on function public.credits_debit(uuid, integer, text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.credits_debit(uuid, integer, text, text, jsonb, uuid) to service_role;

-- ── 9. RPC — rembourser une production qui a échoué (rôle de service) ──────────
--
-- Rend ce que le débit avait pris, poche par poche. ⚠ La part prise sur la dotation
-- n'est rendue que dans le MÊME mois : la dotation de septembre ne peut pas
-- réapparaître en octobre — elle ne se reporte jamais, échec compris.
create or replace function public.credits_refund(p_agency uuid, p_ref_type text, p_ref_id text, p_reason text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  d      public.credit_ledger;
  w      public.credit_wallets;
  de_inc integer;
  de_pur integer;
begin
  select * into d from public.credit_ledger
    where agency_id = p_agency and kind = 'debit' and ref_type = p_ref_type and ref_id = p_ref_id
    limit 1;
  if not found then
    return json_build_object('ok', false, 'error', 'no_debit');
  end if;
  if exists (select 1 from public.credit_ledger where kind = 'refund' and ref_type = p_ref_type and ref_id = p_ref_id) then
    return json_build_object('ok', false, 'error', 'already_refunded');
  end if;

  w := public.credits_wallet_ensure(p_agency);
  de_inc := coalesce((d.metadata->>'from_included')::integer, 0);
  de_pur := coalesce((d.metadata->>'from_purchased')::integer, 0);
  if to_char(d.created_at at time zone 'utc', 'YYYY-MM') <> w.included_month then
    de_inc := 0;
  end if;

  update public.credit_wallets
    set included = included + de_inc, purchased = purchased + de_pur, updated_at = now()
    where agency_id = p_agency
    returning * into w;

  insert into public.credit_ledger (agency_id, kind, amount, bucket, included_after, purchased_after, ref_type, ref_id, metadata)
    values (p_agency, 'refund', de_inc + de_pur, d.bucket, w.included, w.purchased, p_ref_type, p_ref_id,
            jsonb_build_object('reason', p_reason, 'from_included', de_inc, 'from_purchased', de_pur, 'debit_id', d.id));

  return json_build_object('ok', true, 'refunded', de_inc + de_pur, 'balance', w.included + w.purchased);
exception when unique_violation then
  return json_build_object('ok', false, 'error', 'already_refunded');
end;
$$;

revoke all on function public.credits_refund(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.credits_refund(uuid, text, text, text) to service_role;

-- ── 10. RPC — créditer un achat (rôle de service, idempotent par paiement) ──────
create or replace function public.credits_purchase(
  p_agency uuid, p_amount integer, p_kind text, p_ref_type text, p_ref_id text,
  p_amount_chf numeric, p_metadata jsonb default '{}'::jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.credit_wallets;
begin
  if p_kind not in ('purchase', 'auto_topup') then
    return json_build_object('ok', false, 'error', 'invalid_kind');
  end if;
  if p_amount is null or p_amount <= 0 then
    return json_build_object('ok', false, 'error', 'invalid_amount');
  end if;
  w := public.credits_wallet_ensure(p_agency);
  -- Le même paiement vu deux fois (webhook rejoué, chemin synchrone + webhook) : acquitté, pas recrédité.
  if exists (select 1 from public.credit_ledger where ref_type = p_ref_type and ref_id = p_ref_id and kind in ('purchase', 'auto_topup')) then
    return json_build_object('ok', true, 'duplicate', true, 'balance', w.included + w.purchased);
  end if;

  update public.credit_wallets
    set purchased = purchased + p_amount, updated_at = now()
    where agency_id = p_agency
    returning * into w;

  insert into public.credit_ledger (agency_id, kind, amount, bucket, included_after, purchased_after, ref_type, ref_id, amount_chf, metadata)
    values (p_agency, p_kind, p_amount, 'purchased', w.included, w.purchased, p_ref_type, p_ref_id, p_amount_chf, coalesce(p_metadata, '{}'::jsonb));

  return json_build_object('ok', true, 'duplicate', false, 'balance', w.included + w.purchased);
exception when unique_violation then
  return json_build_object('ok', true, 'duplicate', true);
end;
$$;

revoke all on function public.credits_purchase(uuid, integer, text, text, text, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.credits_purchase(uuid, integer, text, text, text, numeric, jsonb) to service_role;

-- ── 11. RPC — enregistrer la carte du premier achat (rôle de service) ──────────
create or replace function public.credits_set_card(p_agency uuid, p_payment_method_id text, p_brand text, p_last4 text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.credits_wallet_ensure(p_agency);
  update public.credit_wallets
    set stripe_payment_method_id = p_payment_method_id, card_brand = p_brand, card_last4 = p_last4, updated_at = now()
    where agency_id = p_agency;
end;
$$;

revoke all on function public.credits_set_card(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.credits_set_card(uuid, text, text, text) to service_role;

-- ── 12. RPC — réserver puis libérer une recharge automatique (rôle de service) ──
--
-- Le verrou est pris DANS la transaction qui lit le porte-monnaie : deux edges qui
-- débitent la même seconde sous le seuil obtiennent un seul `ok`. Le second voit le
-- verrou et n'appelle pas Stripe.
create or replace function public.credits_auto_topup_claim(p_agency uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  w   public.credit_wallets;
  cli text;
begin
  w := public.credits_wallet_ensure(p_agency);
  if not w.auto_topup_enabled or w.stripe_payment_method_id is null then
    return json_build_object('ok', false, 'error', 'not_enabled');
  end if;
  if w.included + w.purchased >= w.auto_topup_threshold then
    return json_build_object('ok', false, 'error', 'above_threshold');
  end if;
  if w.auto_topup_locked_until is not null and w.auto_topup_locked_until > now() then
    return json_build_object('ok', false, 'error', 'locked');
  end if;
  select stripe_customer_id into cli from public.agencies where id = p_agency;
  if cli is null then
    select stripe_customer_id into cli from public.subscriptions where agency_id = p_agency;
  end if;
  if cli is null then
    return json_build_object('ok', false, 'error', 'no_customer');
  end if;
  update public.credit_wallets set auto_topup_locked_until = now() + interval '10 minutes', updated_at = now()
    where agency_id = p_agency;
  return json_build_object('ok', true, 'pack', w.auto_topup_pack, 'payment_method_id', w.stripe_payment_method_id, 'customer_id', cli);
end;
$$;

revoke all on function public.credits_auto_topup_claim(uuid) from public, anon, authenticated;
grant execute on function public.credits_auto_topup_claim(uuid) to service_role;

-- Une charge refusée laisse le verrou 24 h (on ne martèle pas une carte qui refuse) et
-- écrit l'erreur, que l'écran « Consommation » montre à l'agent.
create or replace function public.credits_auto_topup_release(p_agency uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.credit_wallets
    set auto_topup_locked_until = case when p_error is null then null else now() + interval '24 hours' end,
        auto_topup_last_error = p_error,
        auto_topup_last_error_at = case when p_error is null then null else now() end,
        updated_at = now()
    where agency_id = p_agency;
end;
$$;

revoke all on function public.credits_auto_topup_release(uuid, text) from public, anon, authenticated;
grant execute on function public.credits_auto_topup_release(uuid, text) to service_role;
