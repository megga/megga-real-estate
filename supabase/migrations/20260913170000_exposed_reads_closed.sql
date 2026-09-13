-- Trois lectures ouvertes à toute session se referment (audit du 13.09.2026, point S13).
--
-- ⛔ CE QUE LA BASE ACCEPTAIT, relu en production le 13.09.2026 :
--   · `compute_agent_preferences(p_agent_id)` — SECURITY DEFINER, exécutable par
--     `authenticated`, sans aucun contrôle : n'importe quel compte lisait le calibrage « Premier
--     jour » de n'importe quel agent (spécialité, zone, disponibilités, niveau d'autonomie du
--     copilote), agences confondues. Ses deux seuls appelants sont `can_auto_send` et
--     `is_within_sla_window`, SECURITY DEFINER détenues par postgres, déjà fermées aux rôles API
--     depuis 20260711210000 — elle avait été oubliée dans ce ménage. Aucun fichier de `src/` ni
--     d'edge ne l'appelle directement.
--   · `is_agency_lab_cleared(p_agency_id)` — oracle du statut de vérification LAB de TOUTE
--     agence. Elle doit rester exécutable par `authenticated` : la policy `kyc_cases_insert`
--     l'appelle (`agency_id = get_my_agency_id() AND is_agency_lab_cleared(agency_id)`). Elle
--     ne répond donc plus que pour l'agence de l'appelant (ou le super-admin, ou le service) ;
--     pour toute autre, `false`, exactement comme une agence inconnue. La policy, qui ne la
--     consulte que pour la propre agence de l'appelant, ne voit aucune différence.
--   · `agencies.stripe_customer_id` et les colonnes financières de `subscriptions`
--     (identifiants Stripe, prix, MRR, statut de la dernière facture) — lisibles par TOUT membre
--     de l'agence, pas seulement par ses administrateurs. Aucun écran membre n'en a besoin :
--     `BillingSection` n'affiche que la période en cours et l'annulation programmée, la console
--     super-admin passe par ses RPC (qui les amputent déjà), et `stripe-checkout` /
--     `stripe-portal` les lisent en service_role. Le seul lecteur navigateur était
--     `IntercomMessenger`, qui recopiait `stripe_customer_id` dans les attributs d'entreprise
--     d'Intercom — un attribut posé par le navigateur est falsifiable : une future action Fin
--     « facturation » devra résoudre le client Stripe côté serveur depuis `company_id`.
--
-- ⛔ UN GRANT DE COLONNE NE RESTREINT RIEN tant que le GRANT DE TABLE survit (le privilège de
-- table couvre toutes les colonnes). D'où `revoke select` sur la table PUIS un grant explicite
-- des colonnes lisibles — même geste que 20260913160600 pour les jetons d'agenda. Les colonnes
-- accordées sont CALCULÉES (toutes sauf les secrètes) pour que le rejeu de `deploy.yml` et une
-- base de CI donnent le même état que la production.
--
-- ⚠ CONSÉQUENCE À CONNAÎTRE : une colonne ajoutée DEMAIN à `agencies` ou `subscriptions`
-- n'est PAS lisible par `authenticated` tant qu'elle n'est pas accordée — un `select` qui la
-- nomme répond 42501. Ce n'est pas silencieux : `tests/backend/lectures-exposees.spec.ts`
-- rougit dès qu'une colonne non secrète n'est pas lisible. Accorder la nouvelle colonne
-- (`grant select (col) on … to authenticated`) dans la migration qui la crée, ou l'ajouter à
-- la liste des secrètes ci-dessous si elle doit rester serveur.
--
-- `anon` n'est pas touché : aucune policy ne lui ouvre une ligne de ces deux tables.
-- Rejouable : REVOKE/GRANT idempotents, CREATE OR REPLACE, bloc de contrôle final.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. compute_agent_preferences — plus d'appel direct par un rôle client
-- ═══════════════════════════════════════════════════════════════════════════
revoke all on function public.compute_agent_preferences(uuid) from public, anon, authenticated;
grant execute on function public.compute_agent_preferences(uuid) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. is_agency_lab_cleared — la réponse ne vaut que pour sa propre agence
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.is_agency_lab_cleared(p_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(
    (select a.verification_status in ('auto_validated', 'validated')
       from public.agencies a
      where a.id = p_agency_id
        -- Hors de sa propre agence, l'appelant apprend « non vérifiée », comme pour une
        -- agence inconnue : l'oracle se tait (audit S13, 20260913170000).
        and (a.id = public.get_my_agency_id()
             or public.is_super_admin()
             or public.is_service_role())),
    false
  )
$function$;

comment on function public.is_agency_lab_cleared(uuid) is
  'Vrai si l''agence a passé la vérification LAB (auto_validated / validated). Ne répond que '
  'pour l''agence de l''appelant, le super-admin ou le service ; false sinon (audit S13, '
  '20260913170000). Lue par la policy kyc_cases_insert.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. agencies et subscriptions — les colonnes de facturation restent au serveur
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_secretes constant jsonb := jsonb_build_object(
    'agencies', jsonb_build_array('stripe_customer_id'),
    'subscriptions', jsonb_build_array(
      'stripe_customer_id', 'stripe_subscription_id', 'stripe_price_id',
      'price', 'mrr_chf', 'last_invoice_status', 'last_stripe_event_at'));
  v_table text;
  v_cols  text;
begin
  for v_table in select jsonb_object_keys(v_secretes)
  loop
    execute format('revoke select on table public.%I from authenticated', v_table);

    select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
      into v_cols
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name = v_table
       and not (v_secretes -> v_table) ? c.column_name;

    execute format('grant select (%s) on public.%I to authenticated', v_cols, v_table);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- CONTRÔLE FINAL — la migration échoue plutôt que de laisser l'invariant faux.
-- Chaque négatif a son témoin : une mesure qui rendrait toujours « fermé » ne passerait pas.
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_fautes text;
begin
  -- 1. compute_agent_preferences : fermée aux rôles API, ouverte au service.
  if has_function_privilege('authenticated', 'public.compute_agent_preferences(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.compute_agent_preferences(uuid)', 'EXECUTE') then
    raise exception 'S13 : compute_agent_preferences reste exécutable par un rôle client';
  end if;
  if not has_function_privilege('service_role', 'public.compute_agent_preferences(uuid)', 'EXECUTE') then
    raise exception 'S13 : service_role a perdu compute_agent_preferences';
  end if;

  -- 2. is_agency_lab_cleared : toujours exécutable (la policy de kyc_cases l'appelle), et gardée.
  if not has_function_privilege('authenticated', 'public.is_agency_lab_cleared(uuid)', 'EXECUTE') then
    raise exception 'S13 : is_agency_lab_cleared n''est plus exécutable — kyc_cases_insert refuserait tout';
  end if;
  if position('get_my_agency_id()' in pg_get_functiondef('public.is_agency_lab_cleared(uuid)'::regprocedure)) = 0 then
    raise exception 'S13 : is_agency_lab_cleared ne borne pas sa réponse à l''agence de l''appelant';
  end if;

  -- 3. Aucune colonne secrète lisible par authenticated…
  select string_agg(t.tb || '.' || t.col, ', ')
    into v_fautes
    from (values
      ('agencies', 'stripe_customer_id'),
      ('subscriptions', 'stripe_customer_id'), ('subscriptions', 'stripe_subscription_id'),
      ('subscriptions', 'stripe_price_id'), ('subscriptions', 'price'),
      ('subscriptions', 'mrr_chf'), ('subscriptions', 'last_invoice_status'),
      ('subscriptions', 'last_stripe_event_at')
    ) as t(tb, col)
   where has_column_privilege('authenticated', 'public.' || t.tb, t.col, 'SELECT');
  if v_fautes is not null then
    raise exception 'S13 : colonne de facturation encore lisible par un membre : %', v_fautes;
  end if;

  -- … TÉMOINS : ce que les écrans lisent reste lisible, et le service garde tout.
  if not has_column_privilege('authenticated', 'public.agencies', 'plan', 'SELECT')
     or not has_column_privilege('authenticated', 'public.agencies', 'identity_submitted_at', 'SELECT')
     or not has_column_privilege('authenticated', 'public.agencies', 'verification_status', 'SELECT')
     or not has_column_privilege('authenticated', 'public.subscriptions', 'current_period_end', 'SELECT')
     or not has_column_privilege('authenticated', 'public.subscriptions', 'status', 'SELECT') then
    raise exception 'S13 : une colonne lue par les écrans n''est plus lisible par authenticated';
  end if;
  if not has_column_privilege('service_role', 'public.agencies', 'stripe_customer_id', 'SELECT')
     or not has_column_privilege('service_role', 'public.subscriptions', 'mrr_chf', 'SELECT') then
    raise exception 'S13 : service_role a perdu la lecture des colonnes de facturation';
  end if;
end $$;
