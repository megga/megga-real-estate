-- Crédits — la recharge automatique se règle par un DIRIGEANT (revue post-fusion de #1338,
-- 21.09.2026).
--
-- `credits_set_auto_topup` était ouverte à tout membre : un agent simple pouvait programmer
-- des charges de CHF 109 sur la carte de l'agence, sans trace de qui l'avait fait. Tant
-- qu'aucune carte n'était gardée, c'était latent ; la carte se gardant désormais, la porte
-- devient réelle. Même garde que les autres réglages d'agence (`is_agency_admin()`,
-- 20260731170000) : un refus LISIBLE (`forbidden`), pas une exception.
--
-- Et `credit_wallets` ne se lit plus en direct : elle portait l'identifiant Stripe du moyen de
-- paiement, que 20260913170000 a fermé aux membres partout ailleurs. L'écran passe par
-- `credits_balance()`, qui rend tout ce qu'il montre (solde, réglages, marque et 4 derniers
-- chiffres) sans cet identifiant.
--
-- ⚠ HORODATAGE : voir 20260922100000 — à redater avec elle si la fusion glisse après le 22.09.
--
-- Rejouable : CREATE OR REPLACE, REVOKE, et un contrôle final.

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
  -- Un réglage qui programme des charges sur la carte de l'agence : un dirigeant seul.
  if not public.is_agency_admin() then
    return json_build_object('ok', false, 'error', 'forbidden');
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

-- Le porte-monnaie ne se lit plus en direct : `credits_balance()` rend ce que l'écran montre.
revoke select on table public.credit_wallets from authenticated;

do $$
begin
  if has_table_privilege('authenticated', 'public.credit_wallets', 'SELECT') then
    raise exception 'recharge : credit_wallets reste lisible en direct par authenticated';
  end if;
  -- Témoin : l'écran Consommation, lui, lit toujours son solde.
  if not has_function_privilege('authenticated', 'public.credits_balance()', 'EXECUTE') then
    raise exception 'recharge : credits_balance n''est plus appelable — l''écran Consommation tomberait';
  end if;
  if position('is_agency_admin()' in pg_get_functiondef('public.credits_set_auto_topup(boolean, integer, text)'::regprocedure)) = 0 then
    raise exception 'recharge : credits_set_auto_topup n''exige pas un dirigeant';
  end if;
end $$;
