-- Étape 20 du plan Console MEGGA — relevé IA mensuel et dérives (§5.11).
-- Contrat : docs/handoff/console-admin/front/admin-copilot.jsx.
--
-- ── §5.11 DIT « TOUT EXISTE ». MESURÉ : PRESQUE. ─────────────────────────────────────
-- Ce qui existe et n'est PAS recréé ici :
--   · `get_admin_ai_costs(p_months)` — mois × agence × provider × module, sur N mois.
--     C'est la moitié « usage » de `v_ai_month`, déjà en production. Appelée avec 3, elle
--     rend exactement « le mois courant + 2 clos » que demande §5.11.
--   · `get_admin_quota_breaches()` — dépassements au seuil `alert_threshold_pct`.
--   · `admin_set_agency_quotas()` — écriture des plafonds, déjà auditée `quota_changed`.
--   · `get_whatsapp_tool_usage_stats()` — taux d'échec par outil, source de la 3ᵉ dérive.
--
-- La fonction posée ici agrège à un GRAIN DIFFÉRENT (mois × agence, avec part et médiane),
-- ce que `get_admin_ai_costs` ne fait pas : elle descend au provider et au module, donc une
-- agence y apparaît sur plusieurs lignes et sa part n'y est pas calculable sans re-agréger
-- côté écran. Ce n'est pas un doublon, c'est l'étage au-dessus.
--
-- ── AMENDEMENT MESURÉ : LA MOITIÉ « PAR COMPTE » DE §5.11 N'A AUCUNE SOURCE ──────────
-- §5.11 demande « médiane par COMPTE » et « comptes à zéro appel avec raison », et la
-- maquette porte une vue « Par compte » (CO_USER, CO_ZERO) plus une dérive « X pèse N× la
-- médiane — Y % de son agence ».
--
-- Or `ai_usage_logs` n'a AUCUNE colonne d'utilisateur : id, created_at, edge_function,
-- provider, input_tokens, output_tokens, estimated_cost_usd, was_fallback, agency_id,
-- module, latency_ms. Ce n'est pas un oubli de schéma — toute la chaîne est agence :
-- `AIUsageInput` ne porte pas non plus de profil, et son commentaire dit « Agence à
-- l'origine de l'appel (attribution des coûts) ».
--
-- Donc : rien à agréger par compte, et rien à rattraper — le passé ne contient pas
-- l'information. La rendre possible demanderait d'ajouter `profile_id` à la table ET de le
-- faire remonter par tous les appelants, dont plusieurs (weekly-digest…) n'ont aucun
-- utilisateur en contexte. C'est un chantier d'INSTRUMENTATION, comme l'étape 6, pas une
-- vue à écrire. Nommé dans `unavailable` plutôt que simulé.

-- ── 1. Dérives écartées (§4.2, 24 mois) ──────────────────────────────────────────────

create table if not exists public.ai_drift_dismissals (
  month        date        not null,
  drift_key    text        not null,
  dismissed_by uuid,
  ts           timestamptz not null default now(),
  primary key (month, drift_key)
);

comment on table public.ai_drift_dismissals is
  'Dérives IA écartées par « Rien à signaler » (§5.11). La clé primaire (mois, dérive) rend '
  'le geste idempotent PAR CONSTRUCTION : cliquer deux fois n''écarte qu''une fois, sans '
  'verrou ni lecture préalable. Le mois fait partie de la clé parce qu''une dérive écartée '
  'en juillet doit se represénter en août si elle persiste — sinon on l''enterre.';
comment on column public.ai_drift_dismissals.dismissed_by is
  'Sans clé étrangère : la suppression d''un compte super-admin ne doit ni effacer '
  'l''arbitrage ni bloquer la suppression.';

alter table public.ai_drift_dismissals enable row level security;
revoke all on table public.ai_drift_dismissals from public, anon, authenticated, service_role;
grant select on table public.ai_drift_dismissals to authenticated, service_role;

drop policy if exists ai_drift_dismissals_select_super_admin on public.ai_drift_dismissals;
create policy ai_drift_dismissals_select_super_admin on public.ai_drift_dismissals
  for select to authenticated using (public.is_super_admin());

create or replace function public.admin_ai_drift_dismiss(p_month date, p_drift_key text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_insere boolean;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;
  if p_month is null or coalesce(btrim(p_drift_key), '') = '' then
    return public.admin_error('precondition_failed', 'Mois et dérive sont requis.');
  end if;

  -- Les dérives n'existent que sur le MOIS EN COURS (« on n'agit pas sur le passé », en
  -- tête du fichier de maquette). Écarter une dérive d'un mois clos n'aurait aucun effet
  -- visible : autant refuser que laisser croire à un geste.
  if date_trunc('month', p_month) <> date_trunc('month', current_date) then
    return public.admin_error('precondition_failed',
      'Les dérives ne se traitent que sur le mois en cours.');
  end if;

  insert into public.ai_drift_dismissals (month, drift_key, dismissed_by)
       values (date_trunc('month', p_month)::date, p_drift_key, auth.uid())
  on conflict (month, drift_key) do nothing;
  get diagnostics v_insere = row_count;

  -- Pas de reçu d'idempotence ici : la clé primaire (mois, dérive) EST la clé
  -- d'idempotence, et elle est plus juste qu'un jeton fourni par l'appelant — deux
  -- super-admins qui écartent la même dérive doivent converger, pas se doubler.
  perform public.admin_log_write(
    p_family => 'ai', p_action => 'ai_drift_dismissed', p_severity => 'info',
    p_entity_type => 'ai_drift', p_entity_label => p_drift_key,
    p_metadata => jsonb_build_array(
      jsonb_build_object('l', 'Mois', 'v', to_char(p_month, 'YYYY-MM')),
      jsonb_build_object('l', 'Déjà écartée', 'v', case when v_insere then 'non' else 'oui' end)));

  return public.admin_ok(jsonb_build_object('dismissed', true, 'was_new', v_insere));
end;
$function$;

comment on function public.admin_ai_drift_dismiss(date, text) is
  '« Rien à signaler » (§5.11) : écarte une dérive du mois EN COURS. Idempotent par la clé '
  'primaire plutôt que par un reçu — deux super-admins qui écartent la même dérive doivent '
  'converger, pas se doubler. Refuse un mois clos : les dérives ne vivent que sur le mois '
  'courant, et un geste sans effet visible vaut moins qu''un refus explicite.';

revoke all on function public.admin_ai_drift_dismiss(date, text) from public, anon;
grant execute on function public.admin_ai_drift_dismiss(date, text) to authenticated, service_role;

-- ── 2. Le relevé mensuel (§5.11) ─────────────────────────────────────────────────────

drop function if exists public.get_admin_ai_month(integer);
create or replace function public.get_admin_ai_month(p_months integer default 3)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_months  integer := least(greatest(coalesce(p_months, 3), 1), 12);
  v_depuis  date;
  v_mois    jsonb;
  v_derives jsonb;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  v_depuis := (date_trunc('month', now()) - make_interval(months => v_months - 1))::date;

  with par_agence as (
    select date_trunc('month', l.created_at)::date as mois,
           l.agency_id,
           coalesce(a.name, 'Plateforme') as agence,
           count(*)::bigint as appels,
           round(coalesce(sum(l.estimated_cost_usd), 0)::numeric, 4) as cout
      from public.ai_usage_logs l
      left join public.agencies a on a.id = l.agency_id
     where l.created_at >= v_depuis
     group by 1, 2, 3
  ),
  totaux as (
    select mois, sum(cout) as total, sum(appels) as appels,
           -- Médiane PAR AGENCE, faute de pouvoir la faire par compte (voir l'en-tête).
           percentile_cont(0.5) within group (order by cout) as mediane
      from par_agence group by mois
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'month', t.mois,
           'total_cost_usd', round(t.total, 2),
           'calls', t.appels,
           'median_agency_cost_usd', round(t.mediane::numeric, 2),
           'agencies', (
             select coalesce(jsonb_agg(jsonb_build_object(
                      'agency_id', p.agency_id, 'agency', p.agence,
                      'cost_usd', p.cout, 'calls', p.appels,
                      -- Part de la plateforme, calculée ICI : `get_admin_ai_costs` descend
                      -- au provider et au module, une agence y tient plusieurs lignes et sa
                      -- part n'y est pas calculable sans re-agréger côté écran.
                      'share_pct', case when t.total = 0 then 0
                                        else round(100 * p.cout / t.total, 1) end)
                      order by p.cout desc), '[]'::jsonb)
               from par_agence p where p.mois = t.mois)
         ) order by t.mois desc), '[]'::jsonb)
    into v_mois
    from totaux t;

  -- ── Dérives : MOIS EN COURS seulement ──────────────────────────────────────────
  -- Une seule des trois dérives de la maquette est calculable ici :
  --   d1 « agence à N % de son plafond »        → calculée ci-dessous
  --   d2 « X pèse N× la médiane, Y % de son agence » → PAR COMPTE, sans source
  --   d3 « tel outil échoue une fois sur neuf » → un RENVOI vers Monitoring, dont la
  --      source existe (get_whatsapp_tool_usage_stats) et qui n'a pas à être recopiée ici.
  --
  -- Le seuil de dérive est 95 % (§7), distinct du seuil d'ALERTE `alert_threshold_pct`
  -- (défaut 80) que sert get_admin_quota_breaches : une alerte prévient, une dérive
  -- demande un arbitrage.
  select coalesce(jsonb_agg(jsonb_build_object(
           'key', d.cle, 'severity', 'crit', 'agency_id', d.agency_id,
           'agency', d.agence, 'pct_of_cap', d.pct)), '[]'::jsonb)
    into v_derives
    from (
      select 'quota_' || q.agency_id::text as cle, q.agency_id, a.name as agence,
             round(100 * u.cout / q.ai_monthly_cost_cap_usd, 1) as pct
        from public.agency_usage_quotas q
        join public.agencies a on a.id = q.agency_id
        join lateral (
          select coalesce(sum(l.estimated_cost_usd), 0)::numeric as cout
            from public.ai_usage_logs l
           where l.agency_id = q.agency_id
             and l.created_at >= date_trunc('month', now())
        ) u on true
       where q.ai_monthly_cost_cap_usd is not null
         and q.ai_monthly_cost_cap_usd > 0
         and u.cout >= q.ai_monthly_cost_cap_usd * 0.95
         -- Écartée par « Rien à signaler » : elle ne remonte plus ce mois-ci.
         and not exists (
           select 1 from public.ai_drift_dismissals x
            where x.month = date_trunc('month', current_date)::date
              and x.drift_key = 'quota_' || q.agency_id::text)
    ) d;

  return public.admin_ok(jsonb_build_object(
    'months', v_mois,
    'drifts', v_derives,
    -- Nommé plutôt que tu, comme au poste de triage et à la Vue d'ensemble.
    'unavailable', jsonb_build_array('per_account_median', 'zero_call_accounts', 'per_account_drift')
  ));
end;
$function$;

comment on function public.get_admin_ai_month(integer) is
  'Relevé IA mensuel (§5.11) au grain mois × agence : coût, appels, PART de la plateforme et '
  'médiane par agence, plus les dérives du mois EN COURS (agence à ≥ 95 % de son plafond, '
  'seuil §7 distinct du seuil d''alerte à 80 %), moins celles écartées. Ne double PAS '
  'get_admin_ai_costs(), qui descend au provider et au module — grain différent, part non '
  'calculable à ce niveau. `unavailable` nomme la moitié « par compte » de §5.11 : '
  'ai_usage_logs ne porte aucune colonne d''utilisateur, et toute la chaîne d''écriture est '
  'agence — il n''y a rien à agréger, ni rien à rattraper dans le passé.';

revoke all on function public.get_admin_ai_month(integer) from public, anon;
grant execute on function public.get_admin_ai_month(integer) to authenticated, service_role;

-- ── 3. Rétention 24 mois (§4.2) ──────────────────────────────────────────────────────

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'admin-ai-drift-purge-monthly', '40 3 1 * *',
      $sql$delete from public.ai_drift_dismissals where month < (current_date - interval '24 months')::date;$sql$
    );
  end if;
end $$;
