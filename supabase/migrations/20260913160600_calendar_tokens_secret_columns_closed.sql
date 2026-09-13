-- ════════════════════════════════════════════════════════════════════════════
-- S12 — Les colonnes SECRÈTES des jetons d'agenda sortent de la portée des rôles
-- clients (google_calendar_tokens, outlook_calendar_tokens).
--
-- MESURÉ EN PRODUCTION le 13.09.2026 (SELECT seul) :
--   • anon ET authenticated tenaient SELECT/INSERT/UPDATE/DELETE au niveau de la
--     TABLE sur les deux tables — donc sur access_token et refresh_token ;
--   • les politiques « Users can insert/update own … tokens » (auth.uid() =
--     user_id, sans restriction de colonne) laissaient le titulaire d'une session
--     RÉÉCRIRE refresh_token. Le risque était donc une ÉCRITURE : brancher l'agenda
--     d'un agent sur le compte Google d'un tiers, qui recevait ensuite les
--     coordonnées des acheteurs à chaque visite synchronisée ;
--   • 0 ligne dans chaque table. Un seul lecteur SQL : get_admin_integrations_health,
--     SECURITY DEFINER (propriétaire postgres), que ce retrait ne touche pas.
--
-- ⛔ UN GRANT DE COLONNE NE RESTREINT RIEN tant que le GRANT DE TABLE survit : le
-- privilège de table couvre toutes les colonnes. D'où `revoke all` sur la table
-- PUIS un grant de colonnes explicite — même geste que pour
-- agency_profiles.claim_token (20260729130000).
--
-- Lecteurs légitimes, tous en service_role (qui ne dépend d'aucun de ces grants) :
-- google-calendar-sync, outlook-calendar-sync, _shared/booking-oauth,
-- _shared/host-freebusy. Le client ne lit que (id, user_id, *_email,
-- sync_enabled, last_sync_at) — useGoogleCalendar / useOutlookCalendar.
--
-- ⚠ CONSÉQUENCE À CONNAÎTRE : un `select('*')` client sur ces tables répond
-- désormais 42501. Toute nouvelle colonne NON secrète que l'interface doit lire
-- s'ajoute à la liste du grant ci-dessous — jamais par un grant de table.
--
-- Les politiques d'écriture « own » sont supprimées : sans grant elles sont
-- inertes, mais un futur grant général les rendrait vivantes sans que personne
-- n'ait décidé de rouvrir l'écriture. L'écriture passe par save_tokens, qui
-- vérifie désormais la PROVENANCE des jetons (_shared/calendar-token-provenance).
-- ════════════════════════════════════════════════════════════════════════════

revoke all on table public.google_calendar_tokens from anon, authenticated;
revoke all on table public.outlook_calendar_tokens from anon, authenticated;

grant select (id, user_id, google_email, sync_enabled, last_sync_at)
  on public.google_calendar_tokens to authenticated;
grant select (id, user_id, outlook_email, sync_enabled, last_sync_at)
  on public.outlook_calendar_tokens to authenticated;

drop policy if exists "Users can insert own calendar tokens" on public.google_calendar_tokens;
drop policy if exists "Users can update own calendar tokens" on public.google_calendar_tokens;
drop policy if exists "Users can delete own calendar tokens" on public.google_calendar_tokens;
drop policy if exists "Users can insert own outlook tokens" on public.outlook_calendar_tokens;
drop policy if exists "Users can update own outlook tokens" on public.outlook_calendar_tokens;
drop policy if exists "Users can delete own outlook tokens" on public.outlook_calendar_tokens;

do $$
declare
  v_fuites text;
begin
  -- Aucun rôle client ne lit ni n'écrit un jeton.
  select string_agg(r.rl || ':' || t.tb || '.' || c.col || ':' || p.pv, ', ')
    into v_fuites
    from (values ('google_calendar_tokens'), ('outlook_calendar_tokens')) t(tb)
    cross join (values ('refresh_token'), ('access_token')) c(col)
    cross join (values ('anon'), ('authenticated')) r(rl)
    cross join (values ('SELECT'), ('INSERT'), ('UPDATE')) p(pv)
   where has_column_privilege(r.rl, 'public.' || t.tb, c.col, p.pv);
  if v_fuites is not null then
    raise exception 'S12 : jeton de fournisseur encore à portée d''un rôle client : %', v_fuites;
  end if;

  -- Aucun rôle client n'écrit dans ces tables, quelle que soit la colonne.
  select string_agg(r.rl || ':' || t.tb || ':' || p.pv, ', ')
    into v_fuites
    from (values ('google_calendar_tokens'), ('outlook_calendar_tokens')) t(tb)
    cross join (values ('anon'), ('authenticated')) r(rl)
    cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) p(pv)
   where has_table_privilege(r.rl, 'public.' || t.tb, p.pv);
  if v_fuites is not null then
    raise exception 'S12 : écriture encore ouverte à un rôle client : %', v_fuites;
  end if;

  -- CONTRÔLES POSITIFS : l'état de connexion reste lisible par l'agent…
  if not has_column_privilege('authenticated', 'public.google_calendar_tokens', 'google_email', 'SELECT')
     or not has_column_privilege('authenticated', 'public.google_calendar_tokens', 'user_id', 'SELECT')
     or not has_column_privilege('authenticated', 'public.outlook_calendar_tokens', 'outlook_email', 'SELECT')
     or not has_column_privilege('authenticated', 'public.outlook_calendar_tokens', 'sync_enabled', 'SELECT') then
    raise exception 'S12 : l''état de connexion n''est plus lisible par l''agent';
  end if;
  -- … et le service_role garde tout : les edges en dépendent.
  if not has_column_privilege('service_role', 'public.google_calendar_tokens', 'refresh_token', 'SELECT')
     or not has_table_privilege('service_role', 'public.outlook_calendar_tokens', 'UPDATE') then
    raise exception 'S12 : le service_role a perdu l''accès aux jetons';
  end if;
end $$;
