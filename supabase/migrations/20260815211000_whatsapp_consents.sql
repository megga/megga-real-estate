-- Registre de consentement WhatsApp — APPEND-ONLY, preuve nLPD art. 6 al. 6.
-- Le sujet est POLYMORPHE : un contact démarché OU un agent apparié (brief, rapport KYC).
-- Une clé contact_id NOT NULL tuerait les 7 chemins agent-facing.
begin;

create table if not exists public.whatsapp_consents (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  subject_kind  text        not null check (subject_kind in ('contact','profile')),
  contact_id    uuid        null,   -- SANS FK (même raison que contact_suppressions)
  profile_id    uuid        null,   -- SANS FK
  agency_id     uuid        null,

  wa_phone      text        not null check (wa_phone ~ '^[0-9]{6,15}$'),

  event         text        not null check (event in ('opt_in','opt_out')),
  source        text        not null,
  legal_basis   text        not null default 'consent'
    check (legal_basis in ('consent','contract','legitimate_interest','legal_obligation')),
  purpose       text        not null default 'service'
    check (purpose in ('service','utility','marketing')),

  -- La déclaration PORTE SA PORTÉE. Sans ça, « je ne veux plus le brief du matin »
  -- éteignait AUSSI le PDF KYC, les résultats async, les confirmations d'appairage et
  -- les réponses du copilote : l'étape sujet-profil ne filtrait sur aucune finalité.
  scope         text        not null default 'all' check (scope in ('all','daily_brief')),

  source_ref    text        null,   -- whatsapp_messages.id, jeton HMAC, id de campagne
  proof         jsonb       null,   -- texte AFFICHÉ, horodatage, libellé. JAMAIS IP ni UA.
  ip_hash       text        null,   -- précédent maison : user_consents.ip_hash (20260705170000:30)
  recorded_by   uuid        null,

  constraint wa_consents_subject_xor check (
    (subject_kind = 'contact' and contact_id is not null and profile_id is null)
    or (subject_kind = 'profile' and profile_id is not null and contact_id is null)),

  -- C'est ICI que « un inbound ne vaut JAMAIS opt-in » est verrouillé : 'wa_inbound'
  -- n'existe pas dans le domaine, et 'web_form' sans double opt-in non plus. Une règle
  -- absente d'un CHECK est une règle qu'un appelant finira par contourner.
  --
  -- ⚠ 'brief_enabled' est un AJOUT au design d'origine, qui n'avait pas de source d'opt-in
  -- pour la RÉACTIVATION du brief : set_morning_brief_enabled écrivait 'agent_pairing',
  -- réservé au service_role par l'allow-list de record_whatsapp_consent — la réactivation
  -- échouait donc en 42501 à tous les coups. 'brief_disabled'/'brief_enabled' forment une
  -- paire, écrite par cette seule RPC.
  constraint wa_consents_event_source check (
    (event = 'opt_in'  and source in ('web_form_doubleoptin','click_to_wa','qr',
                                      'agent_manual','import_repermission','agent_pairing',
                                      'brief_enabled'))
    or (event = 'opt_out' and source in ('stop_keyword','meta_block','agent_manual',
                                         'brief_disabled'))),

  -- ⛔ Un agent ne peut pas FABRIQUER un opt-in marketing. Sans ce CHECK, toute la
  -- discipline de double opt-in tenait à un seul appel RPC de distance.
  constraint wa_consents_no_manual_marketing check (
    not (event = 'opt_in' and source = 'agent_manual' and purpose = 'marketing')),

  -- Un opt-in saisi à la main SANS trace de ce qui a été montré n'est pas une preuve.
  constraint wa_consents_manual_needs_proof check (
    not (event = 'opt_in' and source = 'agent_manual' and proof is null)),

  -- Le toggle du brief est par nature scopé : un 'brief_disabled' global éteindrait le PDF
  -- KYC, les résultats async et le copilote.
  --
  -- ⚠ Contrainte rendue UNIDIRECTIONNELLE (le design la posait en équivalence stricte,
  -- `(source='brief_disabled') = (scope='daily_brief')`). L'équivalence interdisait deux
  -- écritures que le plan prescrit par ailleurs : le bouton d'opt-out Meta sur le numéro
  -- d'un AGENT (source 'meta_block', scope 'daily_brief' — §3.1 point A) et la
  -- réactivation du brief. Elle aurait été découverte à L2/L4, sous forme de 23514.
  constraint wa_consents_brief_scope check (
    source not in ('brief_disabled','brief_enabled') or scope = 'daily_brief')
);

comment on table public.whatsapp_consents is
  'Registre append-only des déclarations de consentement WhatsApp. Conservation : durée de '
  'la relation + 10 ans (prescription). PII effaçable par redact_whatsapp_consent (DSAR '
  'art. 32 nLPD) : le numéro et la preuve partent, la ligne juridique (qui/quand/quoi/base) '
  'reste. La FENÊTRE 24 h Meta n''est PAS un consentement et n''a pas de ligne ici.';

comment on column public.whatsapp_consents.scope is
  'Portée de la déclaration. ''daily_brief'' ne concerne QUE le brief du matin ; ''all'' '
  'couvre tout. Lu par whatsapp_send_allowed en `scope in (''all'', p_scope)`.';

create index if not exists idx_wa_consents_contact
  on public.whatsapp_consents (contact_id, created_at desc) where contact_id is not null;
create index if not exists idx_wa_consents_profile
  on public.whatsapp_consents (profile_id, created_at desc) where profile_id is not null;
-- Lecteur RÉEL : whatsapp_send_allowed lit le registre PAR NUMÉRO autant que par sujet
-- (fiche supprimée puis recréée, ou deux fiches pour la même personne). Sans ce chemin,
-- un opt-out survivait à la suppression du contact mais son EFFET non.
create index if not exists idx_wa_consents_phone
  on public.whatsapp_consents (public.normalize_phone(wa_phone), created_at desc);
create index if not exists idx_wa_consents_agency
  on public.whatsapp_consents (agency_id, created_at desc) where agency_id is not null;

-- ── Append-only RÉEL ────────────────────────────────────────────────────────
-- L'absence de policy ne protège QUE le chemin PostgREST authentifié : service_role,
-- toute fonction SECURITY DEFINER et l'owner la traversent. On copie le niveau
-- activity_events : trigger + révocation des GRANTs.
create or replace function public.enforce_whatsapp_consents_immutability()
returns trigger language plpgsql security definer
set search_path to 'public','pg_temp' as $$
begin
  if tg_op = 'UPDATE' then
    -- Unique échappatoire : le caviardage DSAR, porté par redact_whatsapp_consent.
    -- Sans elle, le trigger rendait l'effacement TECHNIQUEMENT impossible, y compris
    -- pour une PII posée par erreur — un registre indestructible n'est pas une vertu.
    --
    -- Tout ce qui n'est pas la PII visée est ÉPINGLÉ à l'identique : sans ces égalités,
    -- l'échappatoire deviendrait une réécriture générale (re-attribuer une déclaration à
    -- un autre contact, changer sa base légale) sous couvert de conformité.
    if current_setting('megga.consent_redaction', true) = 'on'
       and new.wa_phone = '000000000' and new.proof is null and new.ip_hash is null
       and new.id = old.id and new.created_at = old.created_at
       and new.subject_kind = old.subject_kind and new.event = old.event
       and new.source = old.source and new.legal_basis = old.legal_basis
       and new.purpose = old.purpose and new.scope = old.scope
       and new.contact_id is not distinct from old.contact_id
       and new.profile_id is not distinct from old.profile_id
       and new.agency_id is not distinct from old.agency_id
       and new.source_ref is not distinct from old.source_ref
       and new.recorded_by is not distinct from old.recorded_by
    then return new; end if;
  end if;
  raise exception 'whatsapp_consents est append-only (% refusé)', tg_op using errcode = '42501';
end $$;

drop trigger if exists trg_wa_consents_immutable_update on public.whatsapp_consents;
create trigger trg_wa_consents_immutable_update before update on public.whatsapp_consents
  for each row execute function public.enforce_whatsapp_consents_immutability();

drop trigger if exists trg_wa_consents_immutable_delete on public.whatsapp_consents;
create trigger trg_wa_consents_immutable_delete before delete on public.whatsapp_consents
  for each row execute function public.enforce_whatsapp_consents_immutability();

-- ⚠ Un trigger FOR EACH ROW ne voit PAS un TRUNCATE. Or `anon` détient TRUNCATE sur 75
-- tables de ce projet par héritage de DEFAULT PRIVILEGES : sans cette ligne, le registre
-- entier s'efface en une instruction.
drop trigger if exists trg_wa_consents_immutable_truncate on public.whatsapp_consents;
create trigger trg_wa_consents_immutable_truncate before truncate on public.whatsapp_consents
  for each statement execute function public.enforce_whatsapp_consents_immutability();

alter table public.whatsapp_consents enable row level security;
revoke all on table public.whatsapp_consents from anon, authenticated;
grant select on table public.whatsapp_consents to authenticated;

-- PAS de `force row level security`, contrairement à contacts et kyc_* :
-- record_whatsapp_consent est SECURITY DEFINER, propriété de postgres ; FORCE la
-- soumettrait à RLS et son INSERT tomberait faute de policy INSERT. Le verrou ici est le
-- TRIGGER (qui, lui, s'applique à postgres aussi), pas la RLS.
drop policy if exists wa_consents_select_agency on public.whatsapp_consents;
create policy wa_consents_select_agency on public.whatsapp_consents
  for select to authenticated using (agency_id = (select public.get_my_agency_id()));

drop policy if exists wa_consents_select_self on public.whatsapp_consents;
create policy wa_consents_select_self on public.whatsapp_consents
  for select to authenticated using (profile_id = auth.uid());

drop policy if exists wa_consents_select_super on public.whatsapp_consents;
create policy wa_consents_select_super on public.whatsapp_consents
  for select to authenticated using ((select public.is_super_admin()));

commit;
