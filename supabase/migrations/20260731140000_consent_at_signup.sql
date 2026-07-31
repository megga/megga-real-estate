-- =====================================================================
-- Consentement nLPD : la preuve s'écrit à l'INSCRIPTION
--
-- Constat : l'agent coche « J'accepte les conditions générales et la politique
-- de confidentialité » sur megga.ch/signup, mais cette case n'était vérifiée
-- que dans le navigateur — rien n'était écrit. ConsentGate, qui exige une ligne
-- (user, type, version) dans user_consents, ne trouvait donc rien et redemandait
-- la MÊME acceptation à la première session, trente secondes plus tard, par
-- dessus le wizard d'identité. Deux demandes pour un seul consentement.
--
-- Ce qui change :
--   1. `legal_document_versions` — version courante de chaque document, CÔTÉ
--      SERVEUR. C'était jusqu'ici une constante du bundle (src/lib/consents.ts),
--      donc inconnue de la base : un trigger ne pouvait pas savoir quelle
--      version il enregistrait, et un client pouvait déclarer la sienne.
--   2. `handle_new_user` écrit les preuves quand la métadonnée d'inscription
--      porte le consentement. La version vient de la table, jamais du
--      navigateur : le client déclare QU'IL a accepté, pas CE QU'IL a accepté.
--   3. `pending_consents()` — ce qui manque à l'utilisateur courant, calculé en
--      base. Le front n'a plus de liste de versions à tenir en parallèle.
--   4. `record_consent` refuse une version inconnue de la table.
--
-- Ce qui NE change pas : ConsentGate reste le filet pour les cas où la preuve
-- ne peut pas être écrite à la création — inscription par Google/Microsoft (le
-- parcours quitte megga.ch avant que le compte existe et signInWithOAuth ne
-- transporte pas de métadonnées) et bump de version sur un compte existant.
-- =====================================================================

-- ── 1. Versions courantes des documents ──────────────────────────────────────
create table if not exists public.legal_document_versions (
  consent_type text primary key check (consent_type in ('terms', 'privacy')),
  version      text not null check (length(trim(version)) > 0),
  updated_at   timestamptz not null default now()
);

comment on table public.legal_document_versions is
  'Version courante de chaque document légal (source de vérité SERVEUR). Bumper une ligne ici redemande l''acceptation à toute la base via pending_consents(). Voir 20260731140000.';

-- Aligné sur les documents publiés (megga.ch/terms, megga.ch/privacy —
-- « Dernière mise à jour : 31 juillet 2026 ») et sur les preuves déjà
-- enregistrées en '2026-07' : le stock existant reste valable, personne n'est
-- redemandé par cette migration.
insert into public.legal_document_versions (consent_type, version)
values ('terms', '2026-07'), ('privacy', '2026-07')
on conflict (consent_type) do nothing;

-- Table interne : personne ne la lit en direct, les trois fonctions ci-dessous
-- sont SECURITY DEFINER. RLS active SANS policy = tout accès direct est refusé,
-- y compris à `authenticated` — et les GRANT par défaut sur `anon` sont retirés
-- explicitement (une table sans policy mais avec un GRANT reste lisible si RLS
-- venait à être désactivée).
alter table public.legal_document_versions enable row level security;
revoke all on table public.legal_document_versions from anon, authenticated, public;

-- ── 2. Ce qui manque à l'utilisateur courant ────────────────────────────────
create or replace function public.pending_consents()
returns table (consent_type text, version text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select v.consent_type, v.version
  from public.legal_document_versions v
  where auth.uid() is not null
    and not exists (
      select 1
      from public.user_consents c
      where c.user_id = auth.uid()
        and c.consent_type = v.consent_type
        and c.version = v.version
    )
  -- Les CGU d'abord : c'est l'ordre des cases à l'écran, et l'ordre
  -- alphabétique donnerait « confidentialité » en premier.
  order by case v.consent_type when 'terms' then 0 else 1 end;
$$;

comment on function public.pending_consents() is
  'Documents que l''utilisateur courant n''a pas encore acceptés dans leur version courante. Vide = rien à demander. Voir 20260731140000.';

revoke all on function public.pending_consents() from public, anon;
grant execute on function public.pending_consents() to authenticated;

-- ── 3. record_consent : version validée, marketing sans version ─────────────
-- Deux ajouts par rapport à 20260705170000 :
--   * la version doit exister dans legal_document_versions (le client ne peut
--     plus inventer « 1999-01 » et se déclarer à jour) ;
--   * p_version peut être NULL pour 'marketing' — l'opt-in n'a pas de document
--     à lui, il s'aligne sur la version des CGU, que le serveur connaît seul
--     depuis que le front ne tient plus la liste.
create or replace function public.record_consent(p_type text, p_version text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid     uuid := auth.uid();
  v_version text;
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

  if p_type = 'marketing' then
    -- Version demandée ou, à défaut, celle des CGU du moment.
    select v.version into v_version
    from public.legal_document_versions v
    where v.consent_type = 'terms'
      and (p_version is null or v.version = trim(p_version));
  else
    select v.version into v_version
    from public.legal_document_versions v
    where v.consent_type = p_type
      and v.version = trim(coalesce(p_version, ''));
  end if;

  if v_version is null then
    raise exception 'unknown consent version: % %', p_type, coalesce(p_version, '(null)');
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
  values (v_uid, p_type, v_version, v_ip_hash)
  on conflict (user_id, consent_type, version) do nothing;  -- ré-acceptation = no-op (idempotent)
end;
$$;

comment on function public.record_consent(text, text) is
  'Enregistre un consentement versionné pour l''utilisateur courant (nLPD). user_id + ip_hash déterminés côté serveur ; version validée contre legal_document_versions. Idempotent par (user, type, version). Voir 20260705170000 puis 20260731140000.';

revoke all on function public.record_consent(text, text) from public, anon;
grant execute on function public.record_consent(text, text) to authenticated;

-- ── 4. handle_new_user : la preuve dès la création du compte ────────────────
-- Repris de la définition VIVANTE (pg_get_functiondef, 31 juil. 2026) — le
-- fichier d'origine avait divergé. Seul le bloc « consentement » est nouveau.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_full_name   text := coalesce(new.raw_user_meta_data ->> 'full_name',
                                 new.raw_user_meta_data ->> 'name', '');
  v_agency_name text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'agency_name', '')), '');
  v_role        text := case
    when (new.raw_user_meta_data ->> 'role') in
         ('agent', 'manager', 'admin', 'assistant', 'seller', 'buyer', 'particulier')
      then new.raw_user_meta_data ->> 'role'
    else 'buyer'
  end;
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    coalesce(new.email, ''),
    v_full_name,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', ''),
    v_role
  );

  if v_role in ('agent', 'manager', 'admin', 'assistant') then
    begin
      perform public.provision_solo_agency(
        new.id,
        coalesce(v_agency_name,
                 nullif(btrim(v_full_name), ''),
                 split_part(coalesce(new.email, ''), '@', 1))
      );
    exception when others then
      raise warning 'provision_solo_agency failed for %: %', new.id, sqlerrm;
    end;
  end if;

  -- Consentement recueilli sur le formulaire d'inscription (case obligatoire de
  -- megga.ch/signup). La VERSION vient de legal_document_versions : la
  -- métadonnée dit que l'agent a coché, pas ce qu'il aurait coché.
  --
  -- Même filet que provision_solo_agency : un échec ici ne doit pas faire
  -- capoter la création du compte. Sans preuve, ConsentGate redemandera — une
  -- question de trop vaut mieux qu'une inscription perdue.
  if coalesce(new.raw_user_meta_data ->> 'legal_consent', '') in ('true', 't', '1') then
    begin
      insert into public.user_consents (user_id, consent_type, version)
      select new.id, v.consent_type, v.version
      from public.legal_document_versions v
      on conflict (user_id, consent_type, version) do nothing;

      if coalesce(new.raw_user_meta_data ->> 'marketing_consent', '') in ('true', 't', '1') then
        insert into public.user_consents (user_id, consent_type, version)
        select new.id, 'marketing', v.version
        from public.legal_document_versions v
        where v.consent_type = 'terms'
        on conflict (user_id, consent_type, version) do nothing;
      end if;
    exception when others then
      raise warning 'consent capture failed for %: %', new.id, sqlerrm;
    end;
  end if;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Trigger auth.users : profil + agence solo + preuves de consentement quand l''inscription les porte (raw_user_meta_data.legal_consent). Voir 20260731140000.';
