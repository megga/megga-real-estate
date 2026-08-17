-- Ajoute la finalité `number_verification` à la garde de consentement sortante.
--
-- Migration SÉPARÉE, et le corps entier est réécrit : `whatsapp_send_allowed` est une
-- fonction, pas une table — on ne peut pas en modifier trois lignes, il faut la
-- redéclarer. Le texte ci-dessous est donc celui de 20260815215000, PATCHÉ à un seul
-- endroit (la dérivation du sujet, étape 2). Toute autre différence serait une régression
-- involontaire : le diff de cette migration contre la précédente doit se lire en une
-- minute, et ne montrer que la branche ajoutée.
--
-- `create or replace` et non `drop`+`create` : la signature et le type de retour sont
-- identiques, et un DROP rendrait la fonction introuvable pour les appelants concurrents
-- le temps de la transaction.

begin;

create or replace function public.whatsapp_send_allowed(
  p_wa_phone   text,
  p_purpose    text default 'service',   -- service|utility|marketing|lpd_notice|opt_out_ack|number_verification
  p_contact_id uuid default null,
  p_profile_id uuid default null,
  p_agency_id  uuid default null,        -- agence de l'APPELANT (visibilité du motif)
  p_scope      text default 'all',
  -- Marge de sécurité sur la fenêtre 24 h. La VALEUR appartient à l'appelant — la garde
  -- d'envoi passe 15 — parce que c'est une politique, pas un fait : entre ce verdict et le
  -- POST à Meta il s'écoule un build, un retry et une latence réseau. Sans marge, un
  -- message décidé à 23 h 59 part après l'expiration et revient en 131047, alors que
  -- l'agent aurait pu se voir proposer le repli template. Défaut 0 : un appelant qui ne
  -- sait pas ce qu'il fait obtient le fait brut, pas une politique implicite.
  p_window_margin_minutes int default 0
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
  -- FINALITÉ `number_verification` — la seule qui écrive à un numéro NON vérifié.
  --
  -- Elle existe parce que la vérification par code envoyé est autrement impossible : le
  -- test juste en dessous refuse `agent_link_unverified` tant que le lien n'est pas
  -- vérifié, et c'est précisément l'état dans lequel se trouve un agent qui demande un
  -- code. La garde échoue FERMÉ par conception ; on ne la contourne pas, on lui donne un
  -- fait à vérifier.
  --
  -- Le fait : il existe, pour CE numéro, une vérification EN COURS que cet agent a
  -- lui-même demandée depuis son compte, et qui n'a pas expiré. Hors de cette fenêtre de
  -- dix minutes la finalité ne donne aucun droit — elle ne peut donc pas servir à écrire
  -- à un numéro quelconque, ce qui serait du démarchage sous couvert de vérification.
  --
  -- ⚠ Ce qui reste PLEINEMENT applicable : l'étape 3 (suppression par numéro), juste en
  -- dessous. Quelqu'un qui a écrit STOP ne reçoit pas de code sous prétexte qu'un agent a
  -- saisi son numéro — c'est le scénario d'abus le plus évident de ce parcours, et il est
  -- fermé par l'ordre des étapes, pas par une intention.
  if p_purpose = 'number_verification' then
    if v_profile is null or not exists (
      select 1 from public.whatsapp_agent_links l
      where l.profile_id = v_profile
        and l.otp_hash is not null
        and l.otp_expires_at > now()
        and public.normalize_phone(l.pending_number) = v_norm)
    then
      return query select false,'no_pending_verification','not_contactable',
                          false,null::text,'profile'::text; return;
    end if;
    v_kind := 'profile';
  elsif v_profile is not null then
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
        -- ⛔ Seule une demande de LA PERSONNE appelle un accusé. Une suppression
        -- 'agent_manual' est une décision de l'AGENT : répondre « votre désinscription est
        -- prise en compte » à quelqu'un qui n'a rien demandé serait un message non
        -- sollicité de plus, et un mensonge sur qui a décidé. Même frontière que
        -- whatsapp_pending_notices, qui n'exclut de l'avis LPD que stop_keyword/meta_block.
        if v_sup.reason not in ('stop_keyword','meta_block') then
          return query select false,'ack_not_requested','ack_not_requested',
                              false,null::text,v_kind; return;
        end if;
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
    bool_or(coalesce(m.wa_timestamp, m.created_at)
            > now() - interval '24 hours' + make_interval(mins => greatest(coalesce(p_window_margin_minutes, 0), 0))),
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

commit;
