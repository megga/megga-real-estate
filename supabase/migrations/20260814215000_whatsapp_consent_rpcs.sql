-- Les deux RPC du registre : LECTURE (autorisation d'envoi) et ÉCRITURE (déclaration).
-- Aucun appelant à ce stade — le câblage des 12 sites d'envoi vient en L3/L4.
begin;

-- ⚠ DROP avant CREATE OR REPLACE : un changement de type de retour lève « cannot change
-- return type » (migration en échec → deploy.yml bloque la journée), et un changement de
-- signature crée une SURCHARGE, pas un remplacement → PGRST203 sur tous les appels.
drop function if exists public.whatsapp_send_allowed(text,text,uuid,uuid,uuid,text);
drop function if exists public.record_whatsapp_consent(text,text,text,text,uuid,uuid,uuid,text,text,text,jsonb,uuid,text);

-- ═══════════════════════════════════════════════════════════════════════════
-- LECTURE — autorisation d'envoi.
-- ⛔ Il n'y a PAS de paramètre `p_kind`. Le sujet est DÉRIVÉ. Un `kind` déclaré par
--    l'appelant était un laissez-passer : le site de l'avis LPD passait déjà `'phone'`,
--    et la porte CI (grep de symboles) ne regarde pas les arguments.
-- ═══════════════════════════════════════════════════════════════════════════
create function public.whatsapp_send_allowed(
  p_wa_phone   text,
  p_purpose    text default 'service',   -- service|utility|marketing|lpd_notice|opt_out_ack
  p_contact_id uuid default null,
  p_profile_id uuid default null,
  p_agency_id  uuid default null,        -- agence de l'APPELANT (visibilité du motif)
  p_scope      text default 'all'
)
returns table (allowed boolean, reason text, public_reason text,
               in_24h_window boolean, legal_basis text, subject_kind text)
language plpgsql stable security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_digits  text := regexp_replace(coalesce(p_wa_phone,''), '\D', '', 'g');
  v_norm    text;
  v_kind    text;
  v_contact uuid := p_contact_id;
  v_profile uuid := p_profile_id;
  v_agency  uuid;
  v_cnt     int;
  v_sup     public.contact_suppressions%rowtype;
  v_last    record;
  v_win     boolean := false;
  v_rel     boolean := false;
  v_vis     boolean;
begin
  -- 0. Garde de tenant. Un appelant AUTHENTIFIÉ ne peut interroger que ses sujets.
  --    ⚠ Elle ne suffit pas à fermer l'oracle : un agent peut créer un contact avec un
  --    numéro arbitraire dans SA propre agence (geste nominal du CRM) puis interroger.
  --    C'est pourquoi `public_reason` existe (cf. PR #1114) : le motif PRÉCIS n'est rendu
  --    qu'au service_role et au tenant qui voit déjà la ligne.
  if auth.uid() is not null then
    if p_contact_id is null or not exists (
      select 1 from public.contacts c
      where c.id = p_contact_id and c.agency_id = public.get_my_agency_id())
    then raise exception 'forbidden' using errcode = '42501'; end if;
  end if;

  -- 1. Numéro exploitable. Aucun contrôle E.164 n'existe sur le chemin sortant :
  --    « 022 345 67 89 » partait à Meta en « 0223456789 ». Borne HAUTE aussi : un JID de
  --    groupe ('120363…@g.us') donne 18 chiffres et ferait échouer l'insert → 500 → rejeu.
  if length(v_digits) < 6 or length(v_digits) > 15 then
    return query select false,'invalid_phone','invalid_phone',false,null::text,null::text; return;
  end if;
  v_norm := public.normalize_phone(v_digits);
  if v_norm is null or length(v_norm) < 9 then
    return query select false,'invalid_phone','invalid_phone',false,null::text,null::text; return;
  end if;

  -- 2. SUJET DÉRIVÉ (jamais déclaré).
  --
  -- ⚠ Un profil ANNONCÉ sans lien vérifié sur ce numéro est REFUSÉ, il ne retombe pas sur
  -- la dérivation par contact. Le design laissait passer : `agent_link_unverified` n'était
  -- alors atteignable par aucun chemin, et un numéro quelconque était réinterprété comme
  -- un contact. C'est exactement le trou que la garde doit fermer sur kyc-report-pdf (§4,
  -- site 12), dont le `to_phone` est un paramètre libre du corps : si ce numéro appartenait
  -- à un CLIENT dans la fenêtre 24 h, le rapport KYC d'un agent lui partait sous
  -- `ok_service_window`.
  if v_profile is not null then
    if not exists (
      select 1 from public.whatsapp_agent_links l
      where l.profile_id = v_profile and l.verified
        and public.normalize_phone(l.wa_number) = v_norm)
    then
      -- in_24h_window = false : l'étape 4 n'a pas tourné. Le refus ne dépend pas d'elle.
      return query select false,'agent_link_unverified','agent_link_unverified',
                          false,null::text,'profile'::text; return;
    end if;
    v_kind := 'profile';
  elsif v_contact is not null then
    -- Cohérence numéro↔fiche↔agence. ⛔ On ne re-résout JAMAIS via
    -- resolve_contact_by_phone : cette RPC est GLOBALE par conception (20260617091000:22,
    -- « toutes agences ») ; s'en servir ici lierait un envoi de l'agence A au contact de
    -- l'agence B, avec un audit au mauvais agency_id.
    select c.agency_id into v_agency from public.contacts c
     where c.id = v_contact and public.normalize_phone(c.phone) = v_norm
       and (p_agency_id is null or c.agency_id = p_agency_id);
    -- `found`, et non `v_agency is null` : contacts.agency_id est NULLABLE, si bien qu'une
    -- fiche sans agence aurait été refusée en `subject_mismatch` — un motif qui aurait
    -- envoyé chercher une incohérence numéro↔fiche là où il n'y en a pas.
    if not found then
      return query select false,'subject_mismatch','not_contactable',false,null::text,null::text; return;
    end if;
    v_kind := 'contact';
  else
    select count(*) into v_cnt from public.contacts c
     where c.phone is not null and public.normalize_phone(c.phone) = v_norm;
    if v_cnt = 1 then
      select c.id, c.agency_id into v_contact, v_agency from public.contacts c
       where c.phone is not null and public.normalize_phone(c.phone) = v_norm;
      v_kind := 'contact';
    elsif v_cnt = 0 and exists (select 1 from public.whatsapp_agent_links l
                                where l.verified and public.normalize_phone(l.wa_number) = v_norm) then
      select l.profile_id into v_profile from public.whatsapp_agent_links l
       where l.verified and public.normalize_phone(l.wa_number) = v_norm limit 1;
      v_kind := 'profile';
    else
      v_kind := 'phone';   -- inconnu OU ambigu (≥2 fiches) → registre lu PAR NUMÉRO
    end if;
  end if;

  -- 3. SUPPRESSION par numéro — AVANT tout consentement, toujours. Le numéro est ce que
  --    Meta connaît ; le consentement est ce que MEGGA croit. Sur un WABA mono-numéro, un
  --    opt-in valide en base ne rachète pas un STOP reçu ailleurs.
  select * into v_sup from public.contact_suppressions s
   where public.normalize_phone(s.wa_phone) = v_norm
     and s.channel in ('whatsapp','all') and s.lifted_at is null
   order by s.created_at desc limit 1;

  if found then
    -- Levée PAR SUJET, calculée : un opt-in PERSONNEL postérieur, pour CE sujet seulement.
    -- La ligne de suppression reste active pour tous les autres. C'est ce qui empêche
    -- l'opt-in obtenu par l'agence B d'effacer le STOP reçu chez l'agence A.
    if not exists (
      select 1 from public.whatsapp_consents c
      where c.event = 'opt_in'
        and c.source in ('click_to_wa','web_form_doubleoptin')
        and c.created_at > v_sup.created_at
        and ((v_kind = 'contact' and c.contact_id = v_contact)
          or (v_kind = 'profile' and c.profile_id = v_profile)))
    then
      -- Accusé de désinscription : UNE fois par suppression (l'unicité de la ligne active
      -- EST le plafond). Il porte l'avis LPD — c'est le seul message que cette personne
      -- recevra jamais si son PREMIER message est « stop ».
      if p_purpose = 'opt_out_ack' then
        if v_sup.ack_sent_at is null then
          return query select true,'ok_opt_out_ack','ok_opt_out_ack',false,
                              'legal_obligation'::text, v_kind; return;
        end if;
        return query select false,'ack_already_sent','ack_already_sent',false,null::text,v_kind; return;
      end if;
      v_vis := (v_sup.agency_id is not null and v_sup.agency_id = p_agency_id)
            or exists (select 1 from public.contacts c
                       where c.id = v_sup.contact_id and c.agency_id = p_agency_id);
      return query select false,'phone_suppressed',
        case when v_vis then 'phone_suppressed' else 'not_contactable' end,
        false,null::text,v_kind; return;
    end if;
  end if;

  if p_purpose = 'opt_out_ack' then
    return query select false,'ack_without_suppression','ack_without_suppression',
                        false,null::text,v_kind; return;
  end if;

  -- 4. Fenêtre 24 h + relation d'affaires 30 j. FAITS CALCULÉS, jamais des états stockés
  --    — donc infalsifiables. BORNÉS (24 h / 30 j) et SCOPÉS AU TENANT pour un contact :
  --    sans le scope, l'agence A « répondait » à un message que la personne avait écrit à
  --    l'agence B — du démarchage à froid habillé en réponse.
  select
    bool_or(coalesce(m.wa_timestamp, m.created_at) > now() - interval '24 hours'),
    bool_or(true)
    into v_win, v_rel
  from public.whatsapp_messages m
  where m.direction = 'inbound'
    and public.normalize_phone(m.wa_from) = v_norm
    and m.created_at > now() - interval '30 days'
    and (v_kind <> 'contact' or m.agency_id = v_agency or m.contact_id = v_contact);
  v_win := coalesce(v_win,false); v_rel := coalesce(v_rel,false);

  -- 5. Obligation d'information (art. 19 nLPD) : UN message par numéro, jamais du
  --    démarchage. Passe outre un opt-out DÉCLARATIF ('agent_manual' : la personne n'a
  --    rien demandé, l'agent a coché) mais JAMAIS une suppression active (étape 3) —
  --    dans ce cas l'accusé a déjà porté l'avis.
  if p_purpose = 'lpd_notice' then
    return query select true,'ok','ok',v_win,'legal_obligation'::text,v_kind; return;
  end if;

  -- 6. Sujet AGENT : utilisateur du service, base contractuelle. Jamais de marketing.
  --    Le lien vérifié est déjà acquis — l'étape 2 ne pose v_kind='profile' que par un
  --    chemin qui l'exige. Le re-tester ici serait du code que rien ne peut atteindre.
  if v_kind = 'profile' then
    if p_purpose = 'marketing' then
      return query select false,'marketing_requires_consent','marketing_requires_consent',
                          v_win,'contract'::text,v_kind; return;
    end if;
    -- Filtré sur le SCOPE : un opt-out 'brief_disabled' (scope daily_brief) ne coupe que
    -- le brief, pas le PDF KYC ni le copilote.
    if exists (
      select 1 from public.whatsapp_consents c
      where c.profile_id = v_profile and c.event = 'opt_out'
        and c.scope in ('all', p_scope)
        and c.created_at > coalesce((select max(c2.created_at) from public.whatsapp_consents c2
                                     where c2.profile_id = v_profile and c2.event = 'opt_in'
                                       and c2.scope in ('all', p_scope)), '-infinity'))
    then return query select false,'opted_out','opted_out',v_win,'contract'::text,v_kind; return; end if;
    return query select true,'ok','ok',v_win,'contract'::text,v_kind; return;
  end if;

  -- 7. Sujet CONTACT ou NUMÉRO. Lookup par SUJET **ET** par NUMÉRO : un opt-out survit à
  --    la suppression puis recréation de la fiche (uuid neuf) et couvre les doublons de
  --    fiche. C'est le lecteur de idx_wa_consents_phone.
  --
  -- ⚠ ASYMÉTRIQUE, et c'est le point. Le design lisait TOUT par numéro, dans les deux sens :
  -- un opt-in obtenu par l'agence B autorisait alors l'agence A à écrire, puisque seule la
  -- ligne la plus récente compte. C'est exactement ce que l'étape 3 refuse pour la levée
  -- d'une suppression (« un opt-in obtenu par l'agence B ne doit pas effacer le STOP reçu
  -- chez l'agence A ») — la même règle doit valoir ici, sinon la garde se contourne en
  -- faisant consentir la personne auprès de n'importe quel autre tenant du WABA.
  --   · opt_out  → lu GLOBALEMENT par numéro. La personne a dit non sur CE numéro.
  --   · opt_in   → lu par sujet, ou par numéro DANS LA MÊME AGENCE (doublons de fiche).
  select c.event, c.source, c.legal_basis into v_last
  from public.whatsapp_consents c
  where ((v_contact is not null and c.contact_id = v_contact)
         or (public.normalize_phone(c.wa_phone) = v_norm
             and (c.event = 'opt_out' or c.agency_id is not distinct from v_agency)))
    and c.scope in ('all', p_scope)
  order by c.created_at desc, c.id desc limit 1;

  if not found then
    -- RÈGLE DE SERVICE : le consentement est requis pour INITIER ou pour du MARKETING,
    -- pas pour RÉPONDRE. Sans elle, brancher la garde refuserait 100 % des envois agent
    -- au jour 1 (aucun contact n'a d'opt-in) — une garde qui ferme tout se fait débrancher.
    if p_purpose = 'service' and v_win then
      return query select true,'ok_service_window','ok_service_window',true,
                          'legitimate_interest'::text,v_kind; return;
    end if;
    -- Template UTILITY hors fenêtre : admis sur relation d'affaires existante (<30 j),
    -- ce qui garde vivant le repli template de send_client_message. Sinon, refus.
    if p_purpose = 'utility' and v_rel then
      return query select true,'ok_business_relationship','ok_business_relationship',
                          v_win,'legitimate_interest'::text,v_kind; return;
    end if;
    return query select false,'no_opt_in',
      case when auth.uid() is null then 'no_opt_in' else 'not_contactable' end,
      v_win,null::text,v_kind; return;
  end if;

  if v_last.event = 'opt_out' then
    return query select false,
      case when v_last.source in ('stop_keyword','meta_block') then 'do_not_contact'
           else 'opted_out' end,
      'not_contactable', v_win, v_last.legal_basis, v_kind; return;
  end if;

  -- Mapping base légale ↔ finalité : le chantier laissait passer un broadcast MARKETING
  -- sur 'legitimate_interest'.
  if p_purpose = 'marketing' and v_last.legal_basis <> 'consent' then
    return query select false,'marketing_requires_consent','marketing_requires_consent',
                        v_win, v_last.legal_basis, v_kind; return;
  end if;

  return query select true,'ok','ok',v_win,v_last.legal_basis,v_kind;
end $$;

comment on function public.whatsapp_send_allowed(text,text,uuid,uuid,uuid,text) is
  'Autorisation d''envoi WhatsApp. Le SUJET est dérivé du numéro, jamais déclaré par '
  'l''appelant. Ordre : bornage → sujet → SUPPRESSION (avant tout consentement) → fenêtre '
  '24 h / relation 30 j → avis LPD → branche sujet. `reason` est le motif précis '
  '(journalisé) ; `public_reason` est ce qu''un agent a le droit de voir — les distinguer '
  'évite de révéler à l''agence B qu''un numéro a dit STOP à l''agence A.';

revoke all on function public.whatsapp_send_allowed(text,text,uuid,uuid,uuid,text) from public, anon;
grant execute on function public.whatsapp_send_allowed(text,text,uuid,uuid,uuid,text)
  to authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- ÉCRITURE
-- ═══════════════════════════════════════════════════════════════════════════
create function public.record_whatsapp_consent(
  p_kind        text,
  p_wa_phone    text,
  p_event       text,
  p_source      text,
  p_contact_id  uuid  default null,
  p_profile_id  uuid  default null,
  p_agency_id   uuid  default null,
  p_legal_basis text  default 'consent',
  p_purpose     text  default 'service',
  p_source_ref  text  default null,
  p_proof       jsonb default null,
  p_recorded_by uuid  default null,
  p_scope       text  default 'all'
) returns uuid
language plpgsql security definer set search_path to 'public','pg_temp'
as $$
declare
  v_phone  text := regexp_replace(coalesce(p_wa_phone,''), '\D', '', 'g');
  v_agency uuid := p_agency_id;
  v_proof  jsonb := p_proof;
  v_id     uuid;
begin
  -- Allow-list de l'appelant AUTHENTIFIÉ : 2 gestes seulement, chacun sur son périmètre.
  -- Le toggle du brief EST dans la liste — il vit sur une colonne que l'agent bascule
  -- depuis le CRM, donc en `authenticated` : l'interdire rendait set_morning_brief_enabled
  -- impossible (42501 systématique).
  if auth.uid() is not null then
    if p_source = 'agent_manual' then
      if p_kind <> 'contact' or p_contact_id is null or not exists (
        select 1 from public.contacts c
        where c.id = p_contact_id and c.agency_id = public.get_my_agency_id())
      then raise exception 'forbidden' using errcode = '42501'; end if;
      v_agency := public.get_my_agency_id();
      -- La preuve est CONSTRUITE côté serveur, jamais fournie par le client.
      v_proof := jsonb_build_object('recorded_by', auth.uid(), 'at', now(),
                                    'ui_ref', coalesce(p_source_ref,'crm_contact_detail'));
    elsif p_source in ('brief_disabled','brief_enabled') then
      if p_kind <> 'profile' or p_profile_id is distinct from auth.uid() or p_scope <> 'daily_brief'
      then raise exception 'forbidden' using errcode = '42501'; end if;
    else
      raise exception 'source_reserved_to_service' using errcode = '42501';
    end if;
    p_recorded_by := auth.uid();
  end if;

  if length(v_phone) < 6 or length(v_phone) > 15 then
    raise exception 'invalid_phone' using errcode = '22023'; end if;
  if v_agency is null and p_kind = 'contact' and p_contact_id is not null then
    select c.agency_id into v_agency from public.contacts c where c.id = p_contact_id; end if;

  -- La PREUVE d'abord, l'EFFET ensuite : elle est écrite même quand l'effet est refusé.
  insert into public.whatsapp_consents (subject_kind, contact_id, profile_id, agency_id,
    wa_phone, event, source, legal_basis, purpose, scope, source_ref, proof, recorded_by)
  values (p_kind, p_contact_id, p_profile_id, v_agency, v_phone, p_event, p_source,
    p_legal_basis, p_purpose, p_scope, p_source_ref, v_proof, p_recorded_by)
  returning id into v_id;

  -- TOUT opt-out sur un sujet CONTACT écrit une suppression, quelle qu'en soit la source.
  -- Sans ça, un « ne pas contacter » saisi à la main ne survivait pas au cycle
  -- supprimer/recréer la fiche (documenté 20260617091000:69-73). Et c'est ce qui donne
  -- enfin un ÉCRIVAIN à reason='agent_manual'.
  -- ⛔ JAMAIS pour un sujet PROFILE : suspendre le numéro d'un agent éteindrait le copilote.
  if p_event = 'opt_out' and p_kind = 'contact' then
    insert into public.contact_suppressions (channel, wa_phone, reason, source_ref,
                                             contact_id, agency_id)
    values (case when p_source in ('stop_keyword','meta_block') then 'all' else 'whatsapp' end,
            v_phone,
            case when p_source in ('stop_keyword','meta_block') then p_source else 'agent_manual' end,
            p_source_ref, p_contact_id, v_agency)
    on conflict do nothing;
  end if;

  -- Coupe les automatismes en cours dans la MÊME transaction. Domaines RELUS :
  --   whatsapp_followup_suggestions.status ∈ (suggested|accepted|dismissed)  [20260630120000:17]
  --   reminders.status ∈ (pending|triggered|done|cancelled|snoozed)          [baseline:4653]
  --   reminders.channel ∈ (email|whatsapp|task|notification)                 [baseline:4652]
  -- Le chantier écrivait status='pending' sur les suggestions : 0 ligne touchée, aucune
  -- erreur, promesse creuse à 100 %.
  if p_event = 'opt_out' and p_contact_id is not null then
    update public.whatsapp_followup_suggestions
       set status = 'dismissed', updated_at = now()
     where contact_id = p_contact_id and status = 'suggested';
    update public.reminders
       set status = 'cancelled'
     where contact_id = p_contact_id and channel = 'whatsapp'
       and status in ('pending','snoozed');
    -- Une action stashée AVANT le STOP resterait proposée à l'agent après.
    delete from public.whatsapp_pending_actions
     where tool in ('send_client_message','send_template','send_listings')
       and args->>'contact_id' = p_contact_id::text;
  end if;

  if p_kind = 'contact' and p_contact_id is not null then
    update public.contacts set
      wa_opt_in     = (p_event = 'opt_in'),
      wa_consent_at = case when p_event = 'opt_in'  then now() else wa_consent_at end,
      -- ⚠ un horodatage d'opt-out ne s'EFFACE pas, il se DATE. La version `else null`
      -- faisait réapparaître un contact ayant dit STOP comme « contactable » dans l'index
      -- partiel et dans toute liste bâtie dessus.
      wa_opt_out_at = case when p_event = 'opt_out' then now() else wa_opt_out_at end,
      wa_suppressed = exists (select 1 from public.contact_suppressions s
                              where s.contact_id = p_contact_id
                                and s.channel in ('whatsapp','all') and s.lifted_at is null)
    where id = p_contact_id;
  end if;

  return v_id;
end $$;

comment on function public.record_whatsapp_consent(text,text,text,text,uuid,uuid,uuid,text,text,text,jsonb,uuid,text) is
  'Écrit UNE déclaration de consentement et applique ses effets dans la MÊME transaction : '
  'suppression du numéro (opt-out sur un contact), suggestions écartées, rappels WhatsApp '
  'annulés, action stashée supprimée, cache contacts recalculé. Un appelant authentifié n''a '
  'droit qu''à deux gestes : agent_manual sur un contact de son agence, et le toggle du brief '
  'sur son propre profil.';

revoke all on function public.record_whatsapp_consent(text,text,text,text,uuid,uuid,uuid,text,text,text,jsonb,uuid,text) from public, anon;
grant execute on function public.record_whatsapp_consent(text,text,text,text,uuid,uuid,uuid,text,text,text,jsonb,uuid,text)
  to authenticated, service_role;

-- STOP d'un numéro INCONNU du CRM : pas de sujet ⇒ pas de ligne de consentement (il n'y
-- a personne à qui attribuer la déclaration). La preuve est le message lui-même, conservé
-- (whatsapp_messages.body n'est jamais purgé — 20260602110000:44-51 ne vide que `raw`).
create or replace function public.suppress_contact_phone(
  p_wa_phone text, p_channel text, p_reason text,
  p_source_ref text default null, p_agency_id uuid default null)
returns uuid language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_phone text := regexp_replace(coalesce(p_wa_phone,''), '\D','','g'); v_id uuid;
begin
  if auth.uid() is not null then raise exception 'forbidden' using errcode='42501'; end if;
  if length(v_phone) < 6 or length(v_phone) > 15 then
    raise exception 'invalid_phone' using errcode='22023'; end if;
  insert into public.contact_suppressions (channel, wa_phone, reason, source_ref, agency_id)
  values (p_channel, v_phone, p_reason, p_source_ref, p_agency_id)
  on conflict do nothing returning id into v_id;
  return v_id;   -- NULL = une suppression active existait déjà (rejeu Meta, second STOP)
end $$;
-- ⚠ Le GRANT à service_role est EXPLICITE, et ce n'est pas redondant par principe : les
-- DEFAULT PRIVILEGES de Supabase l'accordent à la création, mais `revoke … from public`
-- retire la voie qui, elle, vaut pour tout le monde. Le jour où ces défauts changent, une
-- fonction qui ne dépend que d'eux devient injoignable pour son SEUL appelant. Précédent
-- maison : ensure_wa_inbound_lead (20260705150000:95).
revoke all on function public.suppress_contact_phone(text,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.suppress_contact_phone(text,text,text,text,uuid) to service_role;

create or replace function public.mark_suppression_ack_sent(p_wa_phone text)
returns void language sql security definer set search_path to 'public','pg_temp' as $$
  update public.contact_suppressions set ack_sent_at = now()
   where public.normalize_phone(wa_phone) = public.normalize_phone(p_wa_phone)
     and channel in ('whatsapp','all') and lifted_at is null and ack_sent_at is null;
$$;
revoke all on function public.mark_suppression_ack_sent(text) from public, anon, authenticated;
grant execute on function public.mark_suppression_ack_sent(text) to service_role;

-- Caviardage DSAR (art. 32 nLPD). Le registre est append-only ; sans cette porte, il
-- serait indestructible, y compris pour une PII posée par erreur — et le COMMENT de la
-- table promettrait une fonction qui n'existe pas. Elle n'efface QUE le numéro et la
-- preuve : la ligne juridique (qui, quand, quoi, base légale) survit, c'est elle qui rend
-- le registre opposable. Le GUC est LOCAL : il retombe au commit, il ne peut pas fuiter
-- vers une autre transaction du pool.
create or replace function public.redact_whatsapp_consent(p_wa_phone text)
returns integer language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare
  v_norm text := public.normalize_phone(regexp_replace(coalesce(p_wa_phone,''), '\D','','g'));
  v_n    integer;
begin
  if auth.uid() is not null then raise exception 'forbidden' using errcode='42501'; end if;
  if v_norm is null then raise exception 'invalid_phone' using errcode='22023'; end if;
  perform set_config('megga.consent_redaction', 'on', true);
  update public.whatsapp_consents
     set wa_phone = '000000000', proof = null, ip_hash = null
   where public.normalize_phone(wa_phone) = v_norm
     and (wa_phone <> '000000000' or proof is not null or ip_hash is not null);
  get diagnostics v_n = row_count;
  perform set_config('megga.consent_redaction', 'off', true);
  return v_n;
end $$;
revoke all on function public.redact_whatsapp_consent(text) from public, anon, authenticated;
grant execute on function public.redact_whatsapp_consent(text) to service_role;

-- Toggle du brief : colonne ET ligne de registre dans UNE transaction. Deux écritures
-- séparées divergeaient — un 'brief_disabled' orphelin aurait bloqué le brief plus tard
-- avec `opted_out`, sans qu'aucune UI ne l'explique.
--
-- ⚠ La réactivation écrit 'brief_enabled' scope 'daily_brief', et NON 'agent_pairing'
-- scope 'all' comme le prévoyait le design. Deux raisons, chacune bloquante :
--   1. 'agent_pairing' n'est pas dans l'allow-list authentifiée de record_whatsapp_consent
--      → 42501 à chaque réactivation ;
--   2. un opt-in de portée 'all' écrit par le toggle du brief aurait annulé un opt-out
--      SANS RAPPORT (un 'meta_block' sur le numéro de l'agent, par exemple), puisque
--      l'étape 6 de la lecture compare les horodatages par portée.
create or replace function public.set_morning_brief_enabled(p_enabled boolean)
returns void language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_num text;
begin
  select l.wa_number into v_num from public.whatsapp_agent_links l
   where l.profile_id = auth.uid() and l.verified limit 1;
  if v_num is null then raise exception 'no_verified_link' using errcode='42501'; end if;
  update public.whatsapp_agent_links set morning_brief_enabled = p_enabled
   where profile_id = auth.uid();
  perform public.record_whatsapp_consent(
    'profile', v_num,
    case when p_enabled then 'opt_in' else 'opt_out' end,
    case when p_enabled then 'brief_enabled' else 'brief_disabled' end,
    null, auth.uid(), null, 'contract', 'service', 'crm_settings', null, auth.uid(),
    'daily_brief');
end $$;
revoke all on function public.set_morning_brief_enabled(boolean) from public, anon;
grant execute on function public.set_morning_brief_enabled(boolean) to authenticated;

commit;
