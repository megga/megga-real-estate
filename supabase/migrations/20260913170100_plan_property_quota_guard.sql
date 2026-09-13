-- Le quota de biens actifs d'un plan se tient en base — prêt, mais INACTIF (audit du
-- 13.09.2026, point S15).
--
-- ⛔ CE QUE L'AUDIT CROYAIT, ET CE QUI ÉTAIT VRAI. Le rapport disait le plafond Starter tenu
-- « côté client seulement ». Relu le 13.09.2026 : il n'est tenu NULLE PART. `usePlanLimits`
-- n'est monté que dans `ListingFormPage`, et seulement pour `canAccess('floorPlan')` ;
-- `isAtLimit` n'a aucun appelant, et le wizard « Créer un bien » — le chemin principal — ne
-- consulte aucun quota. Un appel API direct ne « contournait » donc rien : il n'y avait rien.
--
-- Ce que cette migration pose : la règle, tenue par un trigger BEFORE INSERT OR UPDATE sur
-- `properties`, pour tous les rôles (un bien créé par le copilote ou un import compte comme un
-- autre). Seul un bien qui DEVIENT actif consomme une place — même définition que la console
-- (`get_admin_quota_breaches`, métrique `active_properties` : `status = 'active'`). Un
-- brouillon, un bien vendu ou archivé ne compte pas.
--
-- ⚠ INACTIVE PAR DÉCISION (Julien, 13.09.2026). Les 13 agences sont en Starter et aucune ne
-- peut passer Pro : 0 abonnement, prix Stripe non configurés. Activer la règle aujourd'hui
-- poserait un mur sans porte. Elle ne s'applique que si `app_config.plan_limits_enforced`
-- vaut 'true' ; la clé est créée à 'false' et JAMAIS réécrite au rejeu (`on conflict do
-- nothing`), pour qu'une activation survive aux déploiements. L'activer, le jour où la
-- facturation est en service :
--   update public.app_config set value = 'true' where key = 'plan_limits_enforced';
--
-- Plan effectif : l'abonnement actif, en essai ou en retard de paiement de l'agence (Stripe
-- relance avant d'annuler) ; sinon Starter — la même lecture que `useSubscription` côté
-- écran. Plafond : miroir de `PLAN_LIMITS[plan].maxProperties` (src/lib/plans.ts), confronté
-- par `tests/unit/plan-quota-miroir.spec.ts`. ⚠ La grille tarifaire (`PLANS`, même fichier)
-- affiche 5 biens pour Starter, `PLAN_LIMITS` en dit 10 : écart antérieur, à trancher avec la
-- facturation — la règle suit la valeur d'enforcement, pas l'affichage.
--
-- Refus : exception `plan_property_limit` (P0001), traduite par le wizard en message clair.
-- SECURITY DEFINER : la règle lit `app_config` (RLS sans policy) et compte les biens de
-- l'agence sans dépendre de la RLS de l'appelant. Verrou consultatif par agence : deux
-- créations simultanées ne voient pas toutes deux « 9 ».
--
-- Rejouable : CREATE OR REPLACE, DROP TRIGGER IF EXISTS, INSERT … ON CONFLICT DO NOTHING.

insert into public.app_config (key, value)
values ('plan_limits_enforced', 'false')
on conflict (key) do nothing;

create or replace function public.enforce_plan_property_quota()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_plan    text;
  v_cap     integer;
  v_actifs  integer;
begin
  -- Seul un bien qui DEVIENT actif consomme une place.
  if new.status is distinct from 'active' or new.agency_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'active' and old.agency_id is not distinct from new.agency_id then
    return new;
  end if;

  -- Interrupteur (voir l'en-tête) : absent ou autre que 'true' = règle inactive.
  if coalesce((select c.value from public.app_config c where c.key = 'plan_limits_enforced'), 'false') <> 'true' then
    return new;
  end if;

  select s.plan into v_plan
    from public.subscriptions s
   where s.agency_id = new.agency_id
     and s.status in ('active', 'trialing', 'past_due');
  v_plan := coalesce(v_plan, 'starter');

  -- Miroir de PLAN_LIMITS[plan].maxProperties : Starter 10, Pro et Entreprise illimités.
  v_cap := case v_plan when 'starter' then 10 else null end;
  if v_cap is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('plan_property_quota:' || new.agency_id::text));

  select count(*) into v_actifs
    from public.properties p
   where p.agency_id = new.agency_id
     and p.status = 'active'
     and p.id <> new.id;

  if v_actifs >= v_cap then
    raise exception 'plan_property_limit'
      using errcode = 'P0001',
            detail = format('plan %s : %s bien(s) actif(s) sur %s', v_plan, v_actifs, v_cap);
  end if;
  return new;
end $$;

comment on function public.enforce_plan_property_quota() is
  'BEFORE INSERT OR UPDATE sur properties : un bien qui devient actif est refusé '
  '(plan_property_limit) quand l''agence a atteint le plafond de son plan (Starter 10, miroir '
  'de PLAN_LIMITS). INACTIF tant que app_config.plan_limits_enforced ≠ ''true'' (audit S15, '
  '20260913170100).';

revoke all on function public.enforce_plan_property_quota() from public, anon, authenticated;

drop trigger if exists trg_enforce_plan_property_quota on public.properties;
create trigger trg_enforce_plan_property_quota
  before insert or update of status, agency_id on public.properties
  for each row execute function public.enforce_plan_property_quota();

-- ═══════════════════════════════════════════════════════════════════════════
-- CONTRÔLE FINAL — la forme ; le comportement est éprouvé par
-- tests/backend/plan-property-quota.spec.ts (interrupteur éteint, puis allumé).
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_type int;
begin
  select t.tgtype into v_type
    from pg_trigger t
   where t.tgrelid = 'public.properties'::regclass
     and t.tgname = 'trg_enforce_plan_property_quota'
     and t.tgenabled <> 'D';
  -- Bits de tgtype : 1 = ROW, 2 = BEFORE, 4 = INSERT, 16 = UPDATE.
  if v_type is null or (v_type & 1) = 0 or (v_type & 2) = 0 or (v_type & 4) = 0 or (v_type & 16) = 0 then
    raise exception 'S15 : trigger de quota absent, désactivé ou mal typé (tgtype %)', v_type;
  end if;
  if has_function_privilege('authenticated', 'public.enforce_plan_property_quota()', 'EXECUTE') then
    raise exception 'S15 : la fonction de quota est appelable via l''API';
  end if;
  if not exists (select 1 from public.app_config where key = 'plan_limits_enforced') then
    raise exception 'S15 : l''interrupteur plan_limits_enforced est absent';
  end if;
end $$;
