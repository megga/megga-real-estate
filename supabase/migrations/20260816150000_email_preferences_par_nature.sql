-- Désinscription par NATURE d'envoi, et non plus tout-ou-rien.
--
-- AVANT : `contact_suppressions` ne savait dire que « plus aucun e-mail ». Quelqu'un que les
-- fiches de bien agacent n'avait qu'un seul geste possible : tout couper, y compris les
-- rappels qu'il attendait. Un registre qui n'offre que le refus total pousse au refus total.
--
-- ⚠ RÉTROCOMPATIBLE PAR CONSTRUCTION : `purpose IS NULL` veut dire « tout l'e-mail », ce qui
-- est exactement ce que les lignes existantes signifient et ce que `suppress_contact_email`
-- continue d'écrire. Le one-click RFC 8058 reste donc un refus TOTAL, comme l'exige la norme :
-- Gmail ne propose pas de nuance, et interpréter son clic comme un refus partiel serait
-- décider à la place de la personne.

-- ── 1. La colonne ───────────────────────────────────────────────────────────
alter table public.contact_suppressions
  add column if not exists purpose text;

comment on column public.contact_suppressions.purpose is
  'Nature d''envoi refusée. NULL = TOUT l''e-mail (refus total, ce qu''écrit le one-click). '
  'Une ligne par nature refusée ; l''absence de ligne vaut consentement.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.contact_suppressions'::regclass
       and conname = 'contact_suppressions_purpose_valid'
  ) then
    alter table public.contact_suppressions
      add constraint contact_suppressions_purpose_valid
      check (purpose is null or purpose in ('relance', 'bien', 'rappel'));
  end if;
end $$;

-- ── 2. L'unicité doit inclure la nature ─────────────────────────────────────
-- ⛔ `coalesce(purpose,'*')` ET NON `purpose` NU : dans un index unique, PostgreSQL considère
-- deux NULL comme DISTINCTS. Un `purpose` nu laisserait donc insérer autant de refus totaux
-- qu'on veut sur la même adresse — l'index ne garderait plus rien pour le cas qui compte le
-- plus. (`NULLS NOT DISTINCT` existe en PG15+, mais l'expression est explicite et se lit.)
drop index if exists public.uq_contact_suppressions_active_email;
create unique index if not exists uq_contact_suppressions_active_email
  on public.contact_suppressions (lower(email), channel, coalesce(purpose, '*'))
  where lifted_at is null and email is not null;

-- ── 3. La garde lit la nature ───────────────────────────────────────────────
create or replace function public.email_send_allowed(
  p_email text,
  p_purpose text default 'relance',
  p_contact_id uuid default null
)
returns table(allowed boolean, reason text)
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_email text := lower(trim(coalesce(p_email,'')));
  v_bloque boolean;
begin
  if v_email = '' or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return query select false, 'invalid_email'; return;
  end if;

  -- DEUX chemins, parce qu'un refus peut naître de deux endroits :
  --   · l'ADRESSE — un clic « se désinscrire » dans un e-mail, où l'on ne connaît que ça ;
  --   · le CONTACT — un STOP WhatsApp écrit `channel='all'` sur le NUMÉRO ; sans ce
  --     second chemin, la personne continuerait de recevoir des relances par e-mail après
  --     avoir demandé qu'on la laisse tranquille.
  --
  -- ⚠ NOUVEAU : la clause de NATURE. `s.purpose is null` = refus total, il bloque tout ;
  -- sinon le refus ne vaut que pour sa propre nature. Écrite en premier dans le OR pour que
  -- le cas rétrocompatible reste le chemin évident à la lecture.
  select exists (
    select 1 from public.contact_suppressions s
     where s.lifted_at is null
       and s.channel in ('email','all')
       and (s.purpose is null or s.purpose = p_purpose)
       and (
         lower(s.email) = v_email
         or (s.contact_id is not null and s.contact_id in (
              select c.id from public.contacts c
               where lower(c.email) = v_email
                  or (p_contact_id is not null and c.id = p_contact_id)))
       )
  ) into v_bloque;

  if not v_bloque then return query select true, 'ok'; return; end if;

  -- ⛔ Un TRANSACTIONNEL passe outre, et ce n'est pas une échappatoire : c'est une réponse
  -- à un geste de la personne (elle a réservé une visite, demandé un lien). Le lui refuser
  -- la laisserait sans la confirmation qu'elle attend. Même règle que `ok_service_window`
  -- côté WhatsApp : le consentement est requis pour INITIER, pas pour RÉPONDRE.
  if p_purpose = 'transactional' then
    return query select true, 'ok_transactional'; return;
  end if;

  return query select false, 'unsubscribed';
end $function$;

-- ── 4. Lire les préférences d'une adresse ───────────────────────────────────
create or replace function public.email_preferences_get(p_email text)
returns table(all_blocked boolean, blocked_purposes text[])
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_email text := lower(trim(coalesce(p_email,'')));
begin
  return query
  select
    exists (select 1 from public.contact_suppressions s
             where s.lifted_at is null and s.channel in ('email','all')
               and s.purpose is null and lower(s.email) = v_email),
    coalesce((select array_agg(distinct s.purpose order by s.purpose)
                from public.contact_suppressions s
               where s.lifted_at is null and s.channel in ('email','all')
                 and s.purpose is not null and lower(s.email) = v_email), '{}'::text[]);
end $function$;

-- ── 5. Écrire les préférences ───────────────────────────────────────────────
-- Idempotente et RÉCONCILIATRICE : elle rend l'état EXACTEMENT égal à ce qu'on lui donne,
-- en levant ce qui n'y est plus. Une page de préférences doit pouvoir désinscrire ET
-- réinscrire — sans quoi elle est un piège à sens unique.
create or replace function public.email_preferences_set(
  p_email text,
  p_all boolean default false,
  p_blocked text[] default '{}',
  p_contact_id uuid default null,
  p_source_ref text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_email text := lower(trim(coalesce(p_email,'')));
begin
  -- Même garde que `suppress_contact_email` : ce geste appartient à la personne, jamais à un
  -- utilisateur connecté. L'edge l'appelle en service_role, où `auth.uid()` est NULL.
  if auth.uid() is not null then raise exception 'forbidden' using errcode='42501'; end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid_email' using errcode='22023'; end if;

  if p_all then
    -- Refus TOTAL : les refus par nature deviennent sans objet, on les lève pour ne pas
    -- laisser deux vérités dans la table.
    update public.contact_suppressions
       set lifted_at = now(), lifted_reason = 'remplace_par_refus_total'
     where lifted_at is null and channel in ('email','all')
       and purpose is not null and lower(email) = v_email;

    insert into public.contact_suppressions (channel, email, reason, source_ref, contact_id, purpose)
    values ('email', v_email, 'stop_keyword', p_source_ref, p_contact_id, null)
    on conflict do nothing;
    return;
  end if;

  -- Sortie du refus total dès qu'une préférence fine est exprimée.
  update public.contact_suppressions
     set lifted_at = now(), lifted_reason = 'preferences_affinees'
   where lifted_at is null and channel in ('email','all')
     and purpose is null and lower(email) = v_email;

  -- Ce qui n'est plus refusé est LEVÉ (réinscription).
  update public.contact_suppressions
     set lifted_at = now(), lifted_reason = 'reinscrit_par_la_personne'
   where lifted_at is null and channel in ('email','all')
     and purpose is not null and lower(email) = v_email
     and not (purpose = any(coalesce(p_blocked, '{}')));

  -- Ce qui est refusé et ne l'était pas encore est POSÉ.
  insert into public.contact_suppressions (channel, email, reason, source_ref, contact_id, purpose)
  select 'email', v_email, 'stop_keyword', p_source_ref, p_contact_id, x
    from unnest(coalesce(p_blocked, '{}')) as x
  on conflict do nothing;
end $function$;

-- ── 6. Privilèges ───────────────────────────────────────────────────────────
-- ⛔ SERVICE_ROLE SEUL. `email_preferences_get` est un ORACLE : elle dit si une adresse est
-- dans notre fichier et ce qu'elle refuse. Accordée à `authenticated`, elle laisserait
-- l'agence B interroger les adresses de l'agence A — c'est la faille déjà fermée sur
-- `email_send_allowed`. L'edge, elle, s'authentifie par jeton signé.
revoke all on function public.email_preferences_get(text) from public, anon, authenticated;
revoke all on function public.email_preferences_set(text, boolean, text[], uuid, text) from public, anon, authenticated;
grant execute on function public.email_preferences_get(text) to service_role;
grant execute on function public.email_preferences_set(text, boolean, text[], uuid, text) to service_role;
