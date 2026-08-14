-- Le SEUL chemin d'opt-in WhatsApp : `click_to_wa`.
--
-- La personne reçoit, sur un canal DÉJÀ consenti (e-mail), un lien `wa.me?text=<jeton>`.
-- Elle clique, WhatsApp s'ouvre avec le jeton pré-rempli, elle l'envoie. C'est cet envoi —
-- depuis SON numéro, de SA main — qui vaut consentement.
--
-- ⛔ ON NE DÉMARCHE JAMAIS SUR WHATSAPP POUR OBTENIR LE CONSENTEMENT WHATSAPP. Un message
-- non sollicité demandant l'autorisation d'envoyer des messages non sollicités est
-- exactement ce que la garde existe pour empêcher.
--
-- POURQUOI UNE TABLE, et pas un contact_id signé dans le jeton :
--   · le jeton désigne une LIGNE, doctrine du module de signature (magic-link-token.ts) ;
--   · elle porte le TEXTE EXACTEMENT MONTRÉ à la personne. C'est lui la preuve exigée par
--     l'art. 6 al. 6 nLPD — « le consentement suppose une information préalable adéquate ».
--     Un opt-in sans trace de ce qui a été présenté ne prouve rien ;
--   · elle rend l'usage UNIQUE et révocable, ce qu'un contact_id signé ne permet pas.
begin;

create table if not exists public.whatsapp_optin_invites (
  id           uuid        primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),

  contact_id   uuid        not null,   -- SANS FK (même doctrine que le registre)
  agency_id    uuid        not null,
  -- Numéro visé, figé à l'envoi. La consommation exige qu'il corresponde à l'expéditeur.
  wa_phone     text        not null check (wa_phone ~ '^[0-9]{6,15}$'),

  purpose      text        not null default 'marketing'
                 check (purpose in ('marketing','utility')),
  lang         text        not null default 'fr' check (lang in ('fr','de','en','it')),
  -- LA PREUVE. Texte intégral présenté dans l'e-mail, dans la langue de la personne.
  shown_text   text        not null check (length(shown_text) >= 40),

  expires_at   timestamptz not null,
  sent_by      uuid        null,

  consumed_at         timestamptz null,
  consumed_message_id text        null,
  consent_id          uuid        null,  -- la ligne de registre produite

  constraint wa_optin_consume_coherence check (
    (consumed_at is null and consent_id is null)
    or (consumed_at is not null and consent_id is not null))
);

comment on table public.whatsapp_optin_invites is
  'Invitations d''opt-in WhatsApp (click_to_wa). Une ligne = un lien signé envoyé par '
  'e-mail. `shown_text` porte l''information préalable (art. 6 al. 6 nLPD) : sans elle, '
  'l''opt-in ne prouve rien. Usage UNIQUE (consumed_at).';

create index if not exists idx_wa_optin_invites_contact
  on public.whatsapp_optin_invites (contact_id, created_at desc);
-- Lecteur : la consommation cherche une invitation VIVANTE pour un numéro.
create index if not exists idx_wa_optin_invites_open
  on public.whatsapp_optin_invites (public.normalize_phone(wa_phone))
  where consumed_at is null;

alter table public.whatsapp_optin_invites enable row level security;
revoke all on table public.whatsapp_optin_invites from anon, authenticated;
grant select on table public.whatsapp_optin_invites to authenticated;

-- L'agence VOIT ses invitations : sans ça, l'agent ne peut pas savoir qu'une demande est
-- déjà partie, et il la renvoie.
drop policy if exists wa_optin_invites_select_agency on public.whatsapp_optin_invites;
create policy wa_optin_invites_select_agency on public.whatsapp_optin_invites
  for select to authenticated
  using (agency_id = (select public.get_my_agency_id()));

-- ═══════════════════════════════════════════════════════════════════════════
-- CRÉATION — service_role seulement (l'edge function signe le jeton).
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.create_wa_optin_invite(
  p_contact_id uuid,
  p_shown_text text,
  p_lang       text default 'fr',
  p_purpose    text default 'marketing',
  p_days       int  default 14
) returns table (id uuid, wa_phone text, agency_id uuid)
language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare
  v_phone  text;
  v_agency uuid;
  v_id     uuid;
begin
  if auth.uid() is not null then raise exception 'forbidden' using errcode = '42501'; end if;

  select regexp_replace(coalesce(c.phone,''), '\D', '', 'g'), c.agency_id
    into v_phone, v_agency
    from public.contacts c where c.id = p_contact_id;
  if v_phone is null or length(v_phone) < 6 or length(v_phone) > 15 then
    raise exception 'invalid_contact_phone' using errcode = '22023';
  end if;
  if v_agency is null then raise exception 'contact_without_agency' using errcode = '22023'; end if;

  -- ⛔ On n'invite PAS un numéro bloqué. Demander « puis-je vous écrire ? » à quelqu'un qui
  -- vient de dire STOP est précisément le message qu'il a refusé — et par e-mail, donc sans
  -- que la garde WhatsApp puisse l'arrêter.
  if exists (select 1 from public.contact_suppressions s
             where public.normalize_phone(s.wa_phone) = public.normalize_phone(v_phone)
               and s.channel in ('whatsapp','all') and s.lifted_at is null) then
    raise exception 'phone_suppressed' using errcode = '42501';
  end if;

  insert into public.whatsapp_optin_invites
    (contact_id, agency_id, wa_phone, purpose, lang, shown_text, expires_at)
  values (p_contact_id, v_agency, v_phone, p_purpose, p_lang, p_shown_text,
          now() + make_interval(days => greatest(coalesce(p_days, 14), 1)))
  returning whatsapp_optin_invites.id into v_id;

  return query select v_id, v_phone, v_agency;
end $$;

revoke all on function public.create_wa_optin_invite(uuid,text,text,text,int) from public, anon, authenticated;
grant execute on function public.create_wa_optin_invite(uuid,text,text,text,int) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- CONSOMMATION — le message entrant porte le jeton, déjà vérifié côté edge.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.consume_wa_optin_invite(
  p_invite_id  uuid,
  p_wa_phone   text,
  p_message_id text default null
) returns text
language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare
  v_inv    public.whatsapp_optin_invites%rowtype;
  v_digits text := regexp_replace(coalesce(p_wa_phone,''), '\D', '', 'g');
  v_consent uuid;
begin
  if auth.uid() is not null then raise exception 'forbidden' using errcode = '42501'; end if;

  -- FOR UPDATE : deux livraisons Meta du même message ne doivent produire qu'UN opt-in.
  select * into v_inv from public.whatsapp_optin_invites
   where id = p_invite_id for update;
  if not found then return 'unknown'; end if;
  if v_inv.consumed_at is not null then return 'already_consumed'; end if;
  if v_inv.expires_at <= now() then return 'expired'; end if;

  -- ⛔ LE CŒUR DE LA SÉCURITÉ. Le jeton prouve que MEGGA a écrit au contact ; c'est
  -- l'EXPÉDITEUR qui prouve que ce numéro-là veut recevoir. Sans cette égalité, un lien
  -- intercepté permettrait à un tiers de faire naître un opt-in attribué au contact — et
  -- `whatsapp_send_allowed` autoriserait alors du marketing vers le VRAI numéro, que son
  -- titulaire n'a jamais consenti.
  if public.normalize_phone(v_digits) is distinct from public.normalize_phone(v_inv.wa_phone) then
    return 'phone_mismatch';
  end if;

  v_consent := public.record_whatsapp_consent(
    'contact', v_digits, 'opt_in', 'click_to_wa',
    v_inv.contact_id, null, v_inv.agency_id,
    'consent', v_inv.purpose, p_message_id,
    -- La preuve VOYAGE avec la déclaration : le texte montré, la langue, et l'invitation
    -- qui l'a portée. Un audit n'a alors rien à reconstituer.
    jsonb_build_object(
      'invite_id', v_inv.id, 'shown_text', v_inv.shown_text,
      'lang', v_inv.lang, 'at', now(), 'channel', 'click_to_wa'),
    null, 'all');

  update public.whatsapp_optin_invites
     set consumed_at = now(), consumed_message_id = p_message_id, consent_id = v_consent
   where id = v_inv.id;

  return 'ok';
end $$;

revoke all on function public.consume_wa_optin_invite(uuid,text,text) from public, anon, authenticated;
grant execute on function public.consume_wa_optin_invite(uuid,text,text) to service_role;

commit;
