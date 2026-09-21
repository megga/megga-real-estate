-- Crédits — le PLAN EFFECTIF, et une dotation qui ne se redonne pas (revue post-fusion de
-- #1338, 21.09.2026).
--
-- 1. LE PLAN EFFECTIF, UNE FOIS POUR TOUTES (`agency_plan_effectif`). La dotation mensuelle
--    et les portes du studio lisaient `agencies.plan`, que le webhook Stripe n'écrit jamais :
--    une agence payant Pro par Stripe serait restée Starter (403 partout, dotation 0), et un
--    abonnement résilié aurait gardé Labs. La règle du dépôt est écrite depuis 20260914090100 —
--    « ⛔ JAMAIS `agencies.plan` » : l'abonnement actif, en essai ou en retard de paiement,
--    sinon Starter. Elle était recopiée en ligne dans deux fonctions ; elle a désormais un nom,
--    que les edges appellent aussi. `admin_set_agency_plan` écrit `subscriptions` : un plan
--    posé à la console reste donc effectif.
--
-- 2. LA DOTATION NE SE REDONNE PLUS. Une montée de plan en cours de mois donnait
--    `dot - dotation du plan PRÉCÉDENT` : Pro → Entreprise → Pro → Entreprise redonnait
--    3 300 crédits à chaque aller-retour, la descente ayant abaissé le plan de référence.
--    Le point 1 rend ce cycle accessible à un client (changement de plan par Stripe). La
--    différence se calcule désormais contre ce que le mois a DÉJÀ donné, lu dans le grand
--    livre. Au passage, `from_plan` notait le NOUVEAU plan (`returning * into w` écrasait
--    l'ancien avant l'écriture).
--
-- ⚠ HORODATAGE. `deploy.yml` n'applique que les migrations datées du jour du déploiement
-- ou après (UTC). Datée du 22.09.2026, celle-ci passe si la fusion a lieu le 21 ou le 22 ;
-- au-delà, la redater au jour de la fusion — avec ses quatre voisines 20260922100100…400.
--
-- Rejouable : CREATE OR REPLACE, et un bloc de contrôle final qui échoue plutôt que de
-- laisser un invariant faux.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Le plan effectif
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.agency_plan_effectif(p_agency uuid)
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(
    (select lower(s.plan)
       from public.subscriptions s
      where s.agency_id = p_agency
        and s.status in ('active', 'trialing', 'past_due')
      limit 1),
    'starter')
$$;

comment on function public.agency_plan_effectif(uuid) is
  'Plan effectif d''une agence : l''abonnement actif, en essai ou en retard de paiement, sinon starter. '
  'JAMAIS agencies.plan (le webhook Stripe ne l''écrit pas). Réservée au service : ouverte à '
  'authenticated, elle dirait le plan d''une agence tierce.';

revoke all on function public.agency_plan_effectif(uuid) from public, anon, authenticated;
grant execute on function public.agency_plan_effectif(uuid) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Le porte-monnaie : plan effectif, et une dotation qui ne se redonne pas
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.credits_wallet_ensure(p_agency uuid)
returns public.credit_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  w       public.credit_wallets;
  mois    text := to_char(now() at time zone 'utc', 'YYYY-MM');
  pl      text;
  ancien  text;
  dot     integer;
  donne   integer;
begin
  insert into public.credit_wallets (agency_id) values (p_agency) on conflict (agency_id) do nothing;
  select * into w from public.credit_wallets where agency_id = p_agency for update;

  pl := public.agency_plan_effectif(p_agency);
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
    -- Changement de plan en cours de mois. Une montée donne ce qui MANQUE à ce que le
    -- mois a déjà donné — jamais la différence avec le plan précédent : une descente
    -- abaisse `included_plan` sans reprendre, et l'aller-retour suivant redonnerait tout.
    ancien := w.included_plan;
    select coalesce(sum(l.amount), 0)::integer into donne
      from public.credit_ledger l
     where l.agency_id = p_agency and l.kind = 'grant_monthly' and l.ref_type = 'month' and l.ref_id = mois;
    update public.credit_wallets
      set included = included + greatest(0, dot - donne), included_plan = pl, updated_at = now()
      where agency_id = p_agency
      returning * into w;
    if dot > donne then
      insert into public.credit_ledger (agency_id, kind, amount, bucket, included_after, purchased_after, ref_type, ref_id, metadata)
        values (p_agency, 'grant_monthly', dot - donne, 'included', w.included, w.purchased, 'month', mois,
                jsonb_build_object('plan', pl, 'from_plan', ancien, 'upgrade', true));
    end if;
  end if;
  return w;
end;
$$;

revoke all on function public.credits_wallet_ensure(uuid) from public, anon, authenticated;
grant execute on function public.credits_wallet_ensure(uuid) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- CONTRÔLE FINAL
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_def text := pg_get_functiondef('public.credits_wallet_ensure(uuid)'::regprocedure);
begin
  if position('agency_plan_effectif' in v_def) = 0 or position('agencies' in v_def) > 0 then
    raise exception 'plan effectif : credits_wallet_ensure ne lit pas l''abonnement';
  end if;
  if has_function_privilege('authenticated', 'public.agency_plan_effectif(uuid)', 'EXECUTE') then
    raise exception 'plan effectif : agency_plan_effectif est appelable par un agent';
  end if;
  if not has_function_privilege('service_role', 'public.agency_plan_effectif(uuid)', 'EXECUTE') then
    raise exception 'plan effectif : le service a perdu agency_plan_effectif';
  end if;
end $$;
