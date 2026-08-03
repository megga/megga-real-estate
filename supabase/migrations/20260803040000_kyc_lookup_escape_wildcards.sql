-- Le diagnostic de lien KYC traitait `%` et `_` comme des JOKERS.
--
-- Mesuré sur la fonction vivante le 03.08.2026, en préparant l'écran de l'étape 19 :
-- `admin_kyc_query_normalize` retire les espaces, points, tirets et parenthèses, et
-- rien d'autre. Une requête `%%%` franchit donc le seuil des trois caractères, et
-- devient `like '%' || '%%%' || '%'` — un motif qui matche TOUT. Le seul rempart
-- restant était le plafond de trois correspondances : la recherche rendait bien un
-- refus au-delà, mais en deçà elle rendait des lignes NOMINATIVES que personne
-- n'avait cherchées. Or ce plafond existe pour empêcher de nommer des personnes,
-- pas pour tenir lieu de garde contre une recherche vide de critère.
--
-- Ce n'est pas une fuite hors du cercle autorisé — la RPC reste réservée aux
-- super-admins — mais c'est un contournement de la DISCIPLINE que tout ce geste
-- défend : on ne cherche un client final que si on sait déjà qui on cherche, et le
-- registre doit pouvoir montrer un motif qui tient. Une ligne `Requête: %%%` au
-- registre ne raconte rien de défendable.
--
-- ⚠ Pourquoi la correction n'est PAS dans `admin_kyc_query_normalize`. La même
-- fonction normalise les DEUX côtés du `like` : la requête, mais aussi la colonne
-- (`admin_kyc_query_normalize(c.email) like …`). Échapper à l'intérieur corromprait
-- les valeurs comparées — un e-mail contenant `_` cesserait de correspondre à
-- lui-même. L'échappement appartient donc au site d'usage, sur le seul motif.
--
-- `create or replace`, signature et type de retour inchangés : l'ACL mesurée est
-- conservée (pas de DROP, donc pas de réouverture à `anon` par les droits par
-- défaut), aucun risque de 42P13 au rejeu du jour, et aucune surcharge — donc pas
-- de PGRST203. Le reste du corps est repris à l'identique.

create or replace function public.admin_kyc_link_lookup(
  p_motive_agency_id uuid,
  p_motive_ref       text,
  p_query            text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_q          text;
  v_pattern    text;
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

  -- ⚠ LE CORRECTIF. Le seuil des 3 caractères porte sur la requête NORMALISÉE (`v_q`),
  -- l'échappement sur le seul MOTIF : `%%%` reste donc trois caractères — il passe le
  -- seuil — mais ne matche plus que le texte littéral « %%% », c'est-à-dire personne.
  -- L'antislash d'abord, sinon on échapperait les échappements posés juste après.
  v_pattern := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

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
     where public.admin_kyc_query_normalize(c.email) like v_pattern escape '\'
        or public.admin_kyc_query_normalize(c.phone) like v_pattern escape '\'
        or public.admin_kyc_query_normalize(coalesce(c.first_name, '') || coalesce(c.last_name, ''))
             like v_pattern escape '\'
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

-- Défensif : `create or replace` conserve l'ACL, mais l'écrire rend l'intention
-- lisible et survivrait à un futur passage par DROP (piège des droits par défaut
-- de Supabase, qui accordent EXECUTE à `anon` à chaque création de fonction).
revoke all on function public.admin_kyc_link_lookup(uuid, text, text) from public, anon;
