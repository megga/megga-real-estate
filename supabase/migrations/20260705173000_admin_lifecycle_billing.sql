-- =====================================================================
-- Admin — cycle de vie des comptes + override plan + modération (P4)
--
-- Manques (gap analysis) : pas de suspension user/agence effective
-- (agencies.status='suspended' existait mais ne bloquait personne), pas
-- d'override de plan audité (comptes gratuits/partenaires), et un super-admin
-- ne pouvait pas assigner un seller_lead à une agence tierce (WITH CHECK
-- agence-scopé).
--
-- profiles.is_suspended : sûr par construction — la migration 20260627120000
-- a re-GRANT UPDATE colonne par colonne (liste figée au moment du lockdown) →
-- authenticated ne peut PAS écrire les colonnes ajoutées ensuite ; seuls
-- service_role / SECURITY DEFINER écrivent celle-ci. Le ban effectif est fait
-- côté GoTrue (auth.admin.updateUserById ban_duration) par l'edge
-- admin-user-lifecycle ; le flag sert d'état lisible (badge UI, RLS future).
-- =====================================================================

alter table public.profiles
  add column if not exists is_suspended boolean not null default false;

comment on column public.profiles.is_suspended is
  'Compte suspendu par un admin plateforme (miroir lisible du ban GoTrue posé par l''edge admin-user-lifecycle). Écriture service_role/definer uniquement (re-grant colonne 20260627120000).';

-- ── Override manuel de plan (comptes gratuits / partenaires) ─────────────────
create or replace function public.admin_set_agency_plan(
  p_agency_id uuid,
  p_plan text,
  p_status text default 'active',
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_old_plan text;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden: super_admin required' using errcode = '42501';
  end if;
  if p_plan not in ('starter', 'pro', 'entreprise') then
    raise exception 'invalid plan: %', p_plan;
  end if;
  if p_status not in ('active', 'trialing', 'past_due', 'canceled') then
    raise exception 'invalid status: %', p_status;
  end if;

  select plan into v_old_plan from public.agencies where id = p_agency_id;
  if v_old_plan is null then
    raise exception 'agency not found';
  end if;

  update public.agencies set plan = p_plan where id = p_agency_id;

  -- Upsert de la ligne subscriptions. ⚠ Limitation documentée : un webhook
  -- Stripe ultérieur pour cette agence réécrira cette ligne — l'override
  -- manuel est pensé pour les comptes SANS abonnement Stripe (comp/partenaire).
  insert into public.subscriptions (agency_id, stripe_customer_id, plan, status)
  values (p_agency_id, 'manual_' || p_agency_id, p_plan, p_status)
  on conflict (agency_id) do update
    set plan = excluded.plan,
        status = excluded.status,
        updated_at = now();

  insert into activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id,
     category, severity, object_label, metadata)
  values (
    p_agency_id, auth.uid(), 'user', 'subscription_changed', 'agency', p_agency_id,
    'settings', 'warn', p_plan,
    jsonb_build_object('old_plan', v_old_plan, 'new_plan', p_plan, 'status', p_status,
                       'note', p_note, 'manual_override', true)
  );
end;
$$;
comment on function public.admin_set_agency_plan(uuid, text, text, text) is
  'Override manuel du plan d''une agence (super-admin, audité subscription_changed). Pour comptes sans abonnement Stripe — un webhook Stripe réécrira la ligne subscriptions. Voir 20260705173000.';

revoke all on function public.admin_set_agency_plan(uuid, text, text, text) from public, anon;
grant execute on function public.admin_set_agency_plan(uuid, text, text, text) to authenticated;

-- ── Modération : le super-admin gère les seller_leads (assignation incluse) ──
-- Le WITH CHECK existant (assigned_agency_id = get_my_agency_id() OR NULL)
-- empêchait un super-admin d'assigner un lead à une agence tierce.
drop policy if exists "seller_leads_super_admin_all" on public.seller_leads;
create policy "seller_leads_super_admin_all" on public.seller_leads
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
