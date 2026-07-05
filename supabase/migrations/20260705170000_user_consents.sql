-- =====================================================================
-- Conformité nLPD — consentements versionnés (CGU / confidentialité / marketing)
--
-- Manque constaté (audit pré-lancement) : aucune trace en DB de l'acceptation
-- des CGU / politique de confidentialité (ni version, ni horodatage). En cas de
-- contrôle ou de litige, MEGGA ne peut pas prouver QUI a accepté QUELLE version.
--
-- Modèle : 1 ligne = (user, type, version) — preuve immuable.
--   * INSERT uniquement via la RPC record_consent (SECURITY DEFINER) : le
--     client ne choisit ni user_id ni ip_hash.
--   * AUCUNE policy UPDATE/DELETE : la preuve ne se modifie pas, ne se
--     supprime pas (le cascade on delete auth.users couvre l'effacement
--     nLPD art. 32 via delete-account).
--   * IP hashée best-effort (jamais d'IP en clair — même approche que
--     log-auth-event) : salt quotidien dérivé de app_config.consent_ip_salt ;
--     clé absente → ip_hash NULL, le consentement reste valable (la preuve
--     porte sur user_id + version + horodatage).
--
-- Capture côté app : ConsentGate (monté dans ProtectedRoute) bloque la 1re
-- session tant que les versions courantes (src/lib/consents.ts) ne sont pas
-- acceptées — couvre le stock d'utilisateurs existants ET les nouveaux.
-- =====================================================================

create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  consent_type text not null check (consent_type in ('terms', 'privacy', 'marketing')),
  version text not null,
  accepted_at timestamptz not null default now(),
  ip_hash text,
  unique (user_id, consent_type, version)
);

comment on table public.user_consents is
  'Preuves de consentement versionnées (nLPD) : 1 ligne = (user, type, version). INSERT via record_consent uniquement ; jamais d''UPDATE/DELETE (immuable).';

create index if not exists idx_user_consents_user on public.user_consents (user_id);

alter table public.user_consents enable row level security;

-- Lecture : soi-même, ou super-admin (page compliance / UserDrawer).
drop policy if exists "user_consents_select_own_or_admin" on public.user_consents;
create policy "user_consents_select_own_or_admin" on public.user_consents
  for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin());

-- Pas de policy INSERT/UPDATE/DELETE : écriture via RPC SECURITY DEFINER seulement.

-- ── RPC d'enregistrement ─────────────────────────────────────────────────────
create or replace function public.record_consent(p_type text, p_version text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid     uuid := auth.uid();
  v_salt    text;
  v_ip      text;
  v_ip_hash text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_type not in ('terms', 'privacy', 'marketing') then
    raise exception 'invalid consent type: %', p_type;
  end if;
  if p_version is null or length(trim(p_version)) = 0 then
    raise exception 'consent version required';
  end if;

  -- IP hashée best-effort : SHA-256(ip | salt_du_jour), salt_du_jour =
  -- SHA-256(consent_ip_salt | YYYY-MM-DD UTC) — non traçable long terme.
  v_salt := public.get_app_config('consent_ip_salt');
  if v_salt is not null and length(v_salt) > 0 then
    v_ip := split_part(
      coalesce(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for', ''),
      ',', 1
    );
    if length(trim(v_ip)) > 0 then
      v_ip_hash := encode(sha256(convert_to(
        trim(v_ip) || '|' || encode(sha256(convert_to(
          v_salt || '|' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 'utf8')), 'hex'),
        'utf8')), 'hex');
    end if;
  end if;

  insert into public.user_consents (user_id, consent_type, version, ip_hash)
  values (v_uid, p_type, trim(p_version), v_ip_hash)
  on conflict (user_id, consent_type, version) do nothing;  -- ré-acceptation = no-op (idempotent)
end;
$$;
comment on function public.record_consent(text, text) is
  'Enregistre un consentement versionné pour l''utilisateur courant (nLPD). user_id + ip_hash déterminés côté serveur. Idempotent par (user, type, version). Voir 20260705170000.';

revoke all on function public.record_consent(text, text) from public, anon;
grant execute on function public.record_consent(text, text) to authenticated;

-- ── Stats pour la page compliance (super-admin) ──────────────────────────────
create or replace function public.get_admin_consent_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_result jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'coverage', coalesce((
      select jsonb_agg(jsonb_build_object(
        'consent_type', c.consent_type,
        'version', c.version,
        'accepted', c.accepted
      ) order by c.consent_type, c.version)
      from (
        select consent_type, version, count(*)::int as accepted
        from user_consents
        group by consent_type, version
      ) c
    ), '[]'::jsonb),
    'users_with_terms', (select count(distinct user_id)::int from user_consents where consent_type = 'terms'),
    'users_with_privacy', (select count(distinct user_id)::int from user_consents where consent_type = 'privacy'),
    'users_total', (select count(*)::int from profiles where deleted_at is null)
  ) into v_result;

  return v_result;
end;
$$;
comment on function public.get_admin_consent_stats() is
  'Couverture des consentements (par type × version + totaux) pour AdminCompliancePage. Garde is_super_admin (42501).';

revoke all on function public.get_admin_consent_stats() from public, anon;
grant execute on function public.get_admin_consent_stats() to authenticated;
