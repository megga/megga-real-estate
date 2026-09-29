-- Crédits — la recharge automatique ne réserve qu'un VRAI client Stripe (revue post-fusion
-- de #1338, 21.09.2026).
--
-- `admin_set_agency_plan` pose `manual_<agence>` dans `subscriptions.stripe_customer_id` quand
-- l'agence n'a pas d'abonnement : une valeur factice, que Stripe refuse (« No such customer »).
-- `credits_auto_topup_claim` la rendait telle quelle dès que `agencies.stripe_customer_id`
-- était vide. Elle ne rend désormais qu'un identifiant `cus_…` — l'agence d'abord : le
-- webhook et le reçu y notent le client qui a payé, donc celui qui porte la carte.
-- (Le même filtre vit côté edge, `clientStripeReel`, pour le Checkout.)
--
-- ⚠ HORODATAGE : voir 20260922100000 — à redater avec elle si la fusion glisse après le 22.09.
--
-- Rejouable : CREATE OR REPLACE, et un contrôle final.

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
  -- Un VRAI client Stripe (`cus_…`) : `admin_set_agency_plan` pose `manual_<agence>` dans
  -- `subscriptions`, que Stripe refuse. L'agence d'abord — le webhook et le reçu y notent
  -- le client qui a payé, donc celui qui porte la carte.
  select a.stripe_customer_id into cli
    from public.agencies a
   where a.id = p_agency and a.stripe_customer_id like 'cus\_%';
  if cli is null then
    select s.stripe_customer_id into cli
      from public.subscriptions s
     where s.agency_id = p_agency and s.stripe_customer_id like 'cus\_%'
     limit 1;
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

do $$
begin
  if position('cus\_%' in pg_get_functiondef('public.credits_auto_topup_claim(uuid)'::regprocedure)) = 0 then
    raise exception 'client Stripe : credits_auto_topup_claim accepte un client factice';
  end if;
end $$;
