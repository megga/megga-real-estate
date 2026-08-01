-- Le diagnostic de lien KYC rendait une preuve d'envoi qui n'en était pas une.
--
-- LE DÉFAUT. `admin_kyc_link_lookup` remet `sent_at` parmi ses champs, et toute l'étape 19
-- existe pour répondre à « où en est ce lien ? » quand une agence signale que sa cliente ne
-- l'a jamais reçu. Or `sent_at` est un `DEFAULT now()` posé à l'INSERT que **rien** ne met
-- jamais à jour (grep exhaustif sur supabase/ : aucun UPDATE ne le touche). Il vaut donc
-- exactement la même chose que Resend ait répondu 200, 502, ou n'ait jamais été appelé —
-- c'est le cas quand le canal choisi est `sms`, que personne ne consomme.
--
-- Mesuré : `sent_at` est `NOT NULL DEFAULT now()`, et `created_at` aussi. Les deux colonnes
-- portent la même valeur à l'insertion. `sent_at` n'apporte donc AUCUNE information que
-- `created_at` n'ait déjà — il porte seulement un nom qui promet autre chose.
--
-- POURQUOI ON NE LE CORRIGE PAS EN PLACE, et c'est le point important. Le rendre nullable
-- ou en changer le sens casserait quatre choses mesurées :
--   · la contrainte `kyc_magic_links_expires_after_sent` — CHECK (expires_at > sent_at) ;
--   · `get_admin_end_user_stats`, qui filtre `where sent_at >= v_month_start` : une cohorte
--     MENSUELLE qui perdrait des lignes en silence ;
--   · `get_admin_kyc_magic_links` et `kyc_magic_link_summary`, qui le remontent aux écrans.
-- Une correction « propre » du nom aurait donc déplacé le défaut au lieu de le fermer, et
-- elle l'aurait fait dans un tunnel vivant. On AJOUTE plutôt que de déplacer.
--
-- `email_sent_at` est écrite par `magic-link-send-email` quand Resend a RÉELLEMENT accepté
-- le message — le seul endroit du dépôt qui sache qu'un envoi a eu lieu. Elle reste NULL
-- tant que rien n'est parti, et c'est précisément la réponse que le diagnostic cherchait :
-- « créé il y a trois jours, jamais envoyé » devient lisible.

alter table public.kyc_magic_links
  add column if not exists email_sent_at timestamptz;

comment on column public.kyc_magic_links.email_sent_at is
  'Horodatage de l''ACCEPTATION du message par Resend, posé par magic-link-send-email. '
  'NULL = rien n''est parti. À ne pas confondre avec sent_at, qui est un DEFAULT now() de '
  'création (doublon de created_at) que rien ne met à jour.';

-- ── Le diagnostic remet la vraie preuve, à nombre de champs CONSTANT ───────────────
-- §4 du handoff fixe la projection ; on remplace `sent_at` par `email_sent_at` plutôt que
-- d'ajouter un champ, pour ne pas élargir ce que la console divulgue. L'ORDRE reste calculé
-- sur `sent_at`, qui est NOT NULL : trier sur une colonne majoritairement NULL rendrait le
-- classement instable sans rien apprendre.
create or replace function public.admin_kyc_link_lookup(
  p_motive_agency_id uuid,
  p_motive_ref text,
  p_query text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_q          text;
  v_total      integer;
  v_matches    jsonb;
  v_recentes   integer;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  -- ÉTAPE 1 du handoff : le motif est obligatoire, et « sans eux le RPC refuse ». C'est la
  -- raison d'être de l'étape : l'audit doit dire POURQUOI on a cherché un nom, pas seulement
  -- qui. Un motif facultatif serait un motif absent dans 90 % des cas.
  if p_motive_agency_id is null or coalesce(btrim(p_motive_ref), '') = '' then
    return public.admin_error('precondition_failed',
      'Indiquez l''agence qui signale et la référence du signalement avant de rechercher.');
  end if;
  if not exists (select 1 from public.agencies a where a.id = p_motive_agency_id) then
    return public.admin_error('not_found', 'Cette agence est introuvable.');
  end if;

  v_q := public.admin_kyc_query_normalize(p_query);
  if v_q is null or length(v_q) < 3 then
    return public.admin_error('precondition_failed',
      'La recherche demande au moins 3 caractères.');
  end if;

  -- Plafond de débit (10/h/acteur, plan étape 19). Compté DANS le registre plutôt que dans
  -- une table dédiée : chaque recherche y écrit déjà, et un compteur séparé pourrait
  -- diverger du journal — or c'est le journal qui fait foi en cas de contrôle.
  -- Les refus portent une action DIFFÉRENTE et ne comptent pas : sinon un acteur bloqué le
  -- resterait indéfiniment, chaque refus repoussant sa propre fenêtre.
  select count(*) into v_recentes
    from public.admin_log l
   where l.actor_user_id = auth.uid()
     and l.family = 'link'
     and l.action = 'kyc_link_lookup'
     and l.ts >= now() - interval '1 hour';
  if v_recentes >= 10 then
    perform public.admin_log_write(
      p_family => 'link', p_action => 'kyc_link_lookup_refused', p_severity => 'warn',
      p_entity_type => 'kyc_link', p_entity_label => 'plafond horaire atteint',
      p_agency_id => p_motive_agency_id,
      p_metadata => jsonb_build_array(
        jsonb_build_object('l', 'Motif', 'v', p_motive_ref),
        jsonb_build_object('l', 'Recherches sur 1 h', 'v', v_recentes::text)));
    return public.admin_error('rate_limited',
      'Trop de recherches sur la dernière heure. Réessayez plus tard.');
  end if;

  -- La recherche porte sur le CONTACT (nom, e-mail, téléphone) et sur rien d'autre : ni le
  -- jeton, ni l'identifiant de dossier, qui ne sont pas des choses qu'une agence « signale ».
  with candidats as (
    select l.id, l.status, l.mode, l.sent_at, l.email_sent_at,
           btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')) as contact,
           c.email, c.phone, a.name as agency
      from public.kyc_magic_links l
      left join public.contacts c on c.id = l.contact_id
      left join public.agencies a on a.id = l.agency_id
     where public.admin_kyc_query_normalize(c.email) like '%' || v_q || '%'
        or public.admin_kyc_query_normalize(c.phone) like '%' || v_q || '%'
        or public.admin_kyc_query_normalize(coalesce(c.first_name, '') || coalesce(c.last_name, ''))
             like '%' || v_q || '%'
  )
  select count(*)::integer,
         -- ⚠ La projection est ÉNUMÉRÉE. `to_jsonb(candidats)` aurait sorti l'id du lien,
         -- et un `select *` en amont aurait sorti le jeton, l'IP et le user-agent — trois
         -- choses que §2 du handoff interdit nommément.
         coalesce(jsonb_agg(jsonb_build_object(
           'link_id', c.id,
           'contact', nullif(c.contact, ''),
           'email',   c.email,
           'phone',   c.phone,
           'agency',  c.agency,
           'status',  c.status::text,
           'mode',    case c.mode::text when 'libre' then 'Autonome' else 'Assisté' end,
           -- ⚠ `email_sent_at` et NON `sent_at` : ce dernier est un DEFAULT now() de
           -- création que rien ne met à jour, donc il vaut pareil qu'un envoi ait eu lieu
           -- ou non. Un diagnostic qui répond « où en est ce lien ? » avec un champ qui ne
           -- distingue pas « envoyé » de « jamais parti » répond à côté.
           'email_sent_at', c.email_sent_at) order by c.sent_at desc nulls last), '[]'::jsonb)
    into v_total, v_matches
    from candidats c;

  -- ÉTAPE 2 du handoff : « Plafond 3 correspondances : au-delà, le RPC renvoie `too_many`
  -- + le compte, JAMAIS les lignes. » Le compte seul ne nomme personne ; les lignes, si.
  if v_total > 3 then
    perform public.admin_log_write(
      p_family => 'link', p_action => 'kyc_link_lookup', p_severity => 'info',
      p_entity_type => 'kyc_link', p_entity_label => 'recherche trop large',
      p_agency_id => p_motive_agency_id,
      p_metadata => jsonb_build_array(
        jsonb_build_object('l', 'Motif', 'v', p_motive_ref),
        jsonb_build_object('l', 'Requête', 'v', p_query),
        jsonb_build_object('l', 'Correspondances', 'v', v_total::text)));
    return public.admin_error('too_many',
      'Cette recherche renvoie trop de résultats. Précisez-la.',
      jsonb_build_object('count', v_total));
  end if;

  -- §5 : chaque recherche est journalisée, avec le MOTIF. Sans lui, l'audit dit qui a
  -- cherché un nom, jamais pourquoi.
  perform public.admin_log_write(
    p_family => 'link', p_action => 'kyc_link_lookup', p_severity => 'info',
    p_entity_type => 'kyc_link', p_entity_label => 'recherche',
    p_agency_id => p_motive_agency_id,
    p_metadata => jsonb_build_array(
      jsonb_build_object('l', 'Motif', 'v', p_motive_ref),
      jsonb_build_object('l', 'Requête', 'v', p_query),
      jsonb_build_object('l', 'Correspondances', 'v', v_total::text)));

  return public.admin_ok(jsonb_build_object('count', v_total, 'matches', v_matches));
end;
$function$;
