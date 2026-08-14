-- Le canal E-MAIL entre dans le registre de suppression.
--
-- ⚠ CE QUI ÉTAIT FAUX. Le plan annonçait « `contact_suppressions.channel` est prêt ; le
-- câblage ne l'est pas ». La colonne acceptait bien 'email', mais la table ne pouvait PAS
-- exprimer une suppression d'e-mail : `wa_phone` est NOT NULL, et quelqu'un qui clique
-- « se désinscrire » dans un e-mail n'a pas forcément de numéro chez nous. La contrainte
-- rendait la moitié du domaine inatteignable.
--
-- Après cette migration, une ligne est identifiée par un NUMÉRO, une ADRESSE, ou les deux.
begin;

alter table public.contact_suppressions
  alter column wa_phone drop not null;

alter table public.contact_suppressions
  add column if not exists email text null;

-- Une ligne sans aucune clé ne bloque rien et ne se retrouve pas : elle serait un déchet
-- silencieux dans un registre de conformité.
alter table public.contact_suppressions
  drop constraint if exists contact_suppressions_has_key;
alter table public.contact_suppressions
  add constraint contact_suppressions_has_key
  check (wa_phone is not null or email is not null);

-- ⚠ Le CHECK de format survit à la nullabilité : `NULL ~ '...'` vaut NULL, et un CHECK est
-- satisfait par NULL. Aucun besoin de le réécrire.
alter table public.contact_suppressions
  drop constraint if exists contact_suppressions_email_shape;
alter table public.contact_suppressions
  add constraint contact_suppressions_email_shape
  check (email is null or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');

-- Unicité de l'adresse ACTIVE par canal, en minuscules — les adresses ne sont pas sensibles
-- à la casse dans la partie domaine, et personne ne se désinscrit deux fois pour un « M »
-- majuscule. L'index du numéro reste : une ligne sans numéro y entre avec une clé NULL, que
-- btree ne fait jamais entrer en conflit.
create unique index if not exists uq_contact_suppressions_active_email
  on public.contact_suppressions (lower(email), channel)
  where lifted_at is null and email is not null;

comment on column public.contact_suppressions.email is
  'Adresse bloquée. Renseignée par un clic « se désinscrire » (List-Unsubscribe), où l''on '
  'ne connaît souvent QUE l''adresse. Un STOP WhatsApp, lui, écrit le numéro avec '
  'channel=''all'' : la garde e-mail le retrouve par le CONTACT, pas par l''adresse.';

-- ═══════════════════════════════════════════════════════════════════════════
-- DÉCISION D'ENVOI E-MAIL. Même doctrine que WhatsApp : elle vit en SQL, pas dans six
-- edge functions qui divergeraient.
-- ═══════════════════════════════════════════════════════════════════════════
drop function if exists public.email_send_allowed(text,text,uuid);

create function public.email_send_allowed(
  p_email      text,
  -- transactional : réponse à un geste de la personne (confirmation de visite, lien
  -- qu'elle a demandé). relance | digest : c'est NOUS qui initions.
  p_purpose    text default 'relance',
  p_contact_id uuid default null
) returns table (allowed boolean, reason text)
language plpgsql stable security definer
set search_path to 'public','pg_temp'
as $$
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
  --     avoir demandé qu'on la laisse tranquille. C'est le trou que cette migration ferme.
  select exists (
    select 1 from public.contact_suppressions s
     where s.lifted_at is null
       and s.channel in ('email','all')
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
end $$;

comment on function public.email_send_allowed(text,text,uuid) is
  'Autorisation d''envoi e-mail. Lit le registre de suppression par ADRESSE et par CONTACT '
  '— un STOP WhatsApp (channel=''all'') bloque donc aussi les relances par e-mail. Un '
  'purpose ''transactional'' passe : c''est une réponse, pas une sollicitation.';

revoke all on function public.email_send_allowed(text,text,uuid) from public, anon;
grant execute on function public.email_send_allowed(text,text,uuid) to authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- DÉSINSCRIPTION PAR ADRESSE — ce que le lien « se désinscrire » appelle.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.suppress_contact_email(
  p_email      text,
  p_source_ref text default null,
  p_contact_id uuid default null,
  p_agency_id  uuid default null
) returns uuid
language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_email text := lower(trim(coalesce(p_email,''))); v_id uuid;
begin
  if auth.uid() is not null then raise exception 'forbidden' using errcode='42501'; end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid_email' using errcode='22023'; end if;

  -- `channel='email'` et NON 'all' : la personne s'est désinscrite d'un e-mail. Étendre
  -- son geste à WhatsApp serait décider à sa place — l'inverse exact de ce qu'un registre
  -- de consentement doit faire.
  insert into public.contact_suppressions (channel, email, reason, source_ref, contact_id, agency_id)
  values ('email', v_email, 'stop_keyword', p_source_ref, p_contact_id, p_agency_id)
  on conflict do nothing returning id into v_id;
  return v_id;   -- NULL = déjà désinscrite (un second clic ne doit pas échouer)
end $$;
revoke all on function public.suppress_contact_email(text,text,uuid,uuid) from public, anon, authenticated;
grant execute on function public.suppress_contact_email(text,text,uuid,uuid) to service_role;

commit;
