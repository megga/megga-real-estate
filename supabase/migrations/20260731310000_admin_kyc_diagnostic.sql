-- Étape 19 du plan Console MEGGA — diagnostic d'un lien KYC (§5.5).
-- Contrat : docs/handoff/console-admin/refs/HANDOFF_KYC_DIAGNOSTIC.md, appliqué TEL QUEL.
--
-- ── CE QUE CE FICHIER A LE DROIT DE MONTRER, ET RIEN DE PLUS ─────────────────────────
-- Le handoff ouvre par un avertissement : « les contraintes ci-dessous ne sont pas des
-- détails d'UI, elles définissent ce que la plateforme a le droit de voir des clients
-- finaux d'une agence ». Sept champs par correspondance, pas huit :
--     contact · email · phone · agency · status · mode · sent_at
-- Jamais de `token`, jamais d'URL, jamais de `documents[]`, jamais d'IP ni de user-agent —
-- ces colonnes existent pourtant sur la ligne, et un `select *` les aurait toutes sorties.
-- La projection est donc énumérée à la main, colonne par colonne.
--
-- ── AMENDEMENT MESURÉ : LA RÉGÉNÉRATION NE PEUT PAS ÉMETTRE LE LIEN EN SQL ───────────
-- Le handoff dit « en émet un nouveau ». Mesuré avant d'écrire : le jeton final est un
-- HMAC-SHA256 signé dans une Edge Function (`signMagicLinkToken`, secret ≥ 32 caractères),
-- et la création se fait en TROIS temps — insert d'un placeholder `crypto.randomUUID()`,
-- signature qui inclut l'UUID de la ligne, puis update. Aucune fonction SQL ne peut
-- produire cette signature : le secret n'est pas en base, et il n'a rien à y faire.
--
-- Donc la RPC fait ce qu'une transaction peut faire — invalider, journaliser — et DÉPOSE
-- l'émission dans l'outbox de l'étape 16. C'est exactement la règle §10.2 (« jamais d'appel
-- externe dans une transaction »), appliquée à une signature plutôt qu'à un appel HTTP.
-- La réponse reste celle du handoff : succès + horodatage, jamais le lien.

-- ── 1. Normalisation de la requête (§3, étape 2 du handoff) ──────────────────────────

create or replace function public.admin_kyc_query_normalize(p_query text)
returns text
language sql
-- STABLE et non IMMUTABLE : `public.unaccent(text)` est elle-même STABLE (mesuré :
-- provolatile = 's'), parce qu'elle dépend d'un dictionnaire modifiable. Se déclarer
-- IMMUTABLE au-dessus d'une STABLE, c'est le mensonge de volatilité que le dépôt a déjà
-- payé sur public.slugify() — il autorise un index sur une valeur qui peut changer.
stable
set search_path to 'public', 'pg_temp'
as $function$
  -- « minuscules, sans accents ni espaces/points/tirets ». Un numéro tapé « +41 79 412 08 51 »
  -- doit trouver « +41794120851 », et « Sophie Marchand » trouver « sophiemarchand ».
  select nullif(regexp_replace(lower(public.unaccent(coalesce(p_query, ''))), '[\s.\-()]', '', 'g'), '')
$function$;

comment on function public.admin_kyc_query_normalize(text) is
  'Normalise une requête de diagnostic : minuscules, sans accents, sans espaces ni '
  'ponctuation de numéro (§3 du handoff). La même normalisation s''applique aux colonnes '
  'cherchées, sans quoi un téléphone saisi avec des espaces ne trouverait jamais rien.';

revoke all on function public.admin_kyc_query_normalize(text) from public, anon;
grant execute on function public.admin_kyc_query_normalize(text) to authenticated, service_role;

-- ── 2. La recherche (§4 du handoff) ──────────────────────────────────────────────────

drop function if exists public.admin_kyc_link_lookup(uuid, text, text);
create or replace function public.admin_kyc_link_lookup(
  p_motive_agency_id uuid,
  p_motive_ref       text,
  p_query            text
)
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
    select l.id, l.status, l.mode, l.sent_at,
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
           'sent_at', c.sent_at) order by c.sent_at desc nulls last), '[]'::jsonb)
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

comment on function public.admin_kyc_link_lookup(uuid, text, text) is
  'Diagnostic d''un lien KYC (§5.5, HANDOFF_KYC_DIAGNOSTIC §4). Motif OBLIGATOIRE, requête '
  'd''au moins 3 caractères normalisés, plafond de 3 correspondances au-delà duquel seul le '
  'COMPTE sort — jamais les lignes. Sept champs par correspondance : ni jeton, ni URL, ni '
  'documents, ni IP, ni user-agent, que §2 du handoff interdit nommément. Plafond de débit '
  '10/h/acteur, compté dans admin_log lui-même pour qu''il ne puisse pas diverger du journal '
  'qui fait foi.';

revoke all on function public.admin_kyc_link_lookup(uuid, text, text) from public, anon;
grant execute on function public.admin_kyc_link_lookup(uuid, text, text) to authenticated, service_role;

-- ── 3. La régénération (§4 du handoff) ───────────────────────────────────────────────

drop function if exists public.admin_kyc_link_regenerate(uuid, uuid, text, text);
create or replace function public.admin_kyc_link_regenerate(
  p_link_id          uuid,
  p_motive_agency_id uuid,
  p_motive_ref       text,
  -- ⚠ Quatrième argument, absent du handoff : §10.2 impose une clé d'idempotence sur TOUTE
  -- RPC mutante de la console. Sans elle, un double-clic invaliderait deux fois et
  -- déposerait deux demandes d'émission — l'agence recevrait deux liens pour un signalement.
  p_idempotency_key  text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_lien    record;
  v_premier boolean;
  v_job     uuid;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;
  if p_motive_agency_id is null or coalesce(btrim(p_motive_ref), '') = '' then
    return public.admin_error('precondition_failed',
      'Indiquez l''agence qui signale et la référence du signalement.');
  end if;
  if coalesce(btrim(p_idempotency_key), '') = '' then
    return public.admin_error('precondition_failed', 'Clé d''idempotence manquante.');
  end if;

  -- ORDRE DES VERROUS (§10.2 amendé) : entité D'ABORD, état ensuite, chaîne du journal en
  -- dernier. L'inverse produit un interblocage 40P01 dès que deux gestes touchent le même
  -- lien — et admin_log_write prend la chaîne, donc l'appeler avant serait l'erreur.
  perform public.admin_lock_entity('kyc_link', p_link_id);

  if not public.admin_receipt_try(p_idempotency_key, 'admin_kyc_link_regenerate') then
    -- Déjà fait : ce n'est pas une erreur, c'est le double-clic qu'on absorbe.
    return public.admin_ok(jsonb_build_object('already_done', true));
  end if;

  select l.id, l.status, l.agency_id, l.kyc_case_id, l.contact_id
    into v_lien
    from public.kyc_magic_links l
   where l.id = p_link_id;

  if v_lien.id is null then
    return public.admin_error('not_found', 'Ce lien est introuvable.');
  end if;
  if v_lien.status = 'submitted' then
    -- Régénérer un parcours DÉJÀ terminé n'aiderait personne et relancerait une cliente qui
    -- a fini. Le handoff décrit un lien « jamais reçu », pas un dossier complet.
    return public.admin_error('precondition_failed',
      'Ce parcours est déjà terminé : il n''y a pas de lien à réémettre.');
  end if;

  -- Invalidation de l'ancien : c'est la seule partie que la transaction peut faire.
  update public.kyc_magic_links
     set status = 'expired', expired_at = now(), updated_at = now()
   where id = p_link_id;

  -- L'ÉMISSION part dans l'outbox : la signature du jeton est un HMAC produit par une Edge
  -- Function, hors de portée du SQL. Déposée ici, elle disparaît avec la transaction si le
  -- geste échoue — ce qu'un appel direct n'aurait pas permis.
  v_job := public.admin_outbox_enqueue('notify', jsonb_build_object(
    'kind', 'kyc_link_regenerate',
    'agency_id', v_lien.agency_id,
    'kyc_case_id', v_lien.kyc_case_id,
    'contact_id', v_lien.contact_id,
    'previous_link_id', p_link_id,
    -- Le lien régénéré est REMIS À L'AGENCE (§2 du handoff) : la console n'envoie jamais
    -- rien au client final elle-même.
    'deliver_to', 'agency'));

  perform public.admin_log_write(
    p_family => 'link', p_action => 'kyc_link_regenerate', p_severity => 'warn',
    p_entity_type => 'kyc_link', p_entity_id => p_link_id, p_entity_label => 'régénération',
    p_agency_id => p_motive_agency_id,
    p_metadata => jsonb_build_array(
      jsonb_build_object('l', 'Motif', 'v', p_motive_ref),
      jsonb_build_object('l', 'Agence du lien', 'v', coalesce(v_lien.agency_id::text, '—')),
      jsonb_build_object('l', 'Remise', 'v', 'à l''agence')));

  perform public.admin_receipt_seal(p_idempotency_key, jsonb_build_object('job', v_job));

  -- §4 : « Réponse : succès + horodatage, PAS le lien lui-même. »
  return public.admin_ok(jsonb_build_object('regenerated_at', now()));
end;
$function$;

comment on function public.admin_kyc_link_regenerate(uuid, uuid, text, text) is
  'Régénère un lien KYC (§5.5, handoff §4) : invalide l''ancien, DÉPOSE l''émission du '
  'nouveau dans l''outbox, journalise. L''émission n''est pas faite ici parce qu''elle ne '
  'peut pas l''être : le jeton est un HMAC signé en Edge Function, le secret n''est pas en '
  'base et n''a rien à y faire. Le lien est remis à l''AGENCE, jamais envoyé au client final '
  'par la console. La réponse ne porte pas le lien — seulement l''horodatage.';

revoke all on function public.admin_kyc_link_regenerate(uuid, uuid, text, text) from public, anon;
grant execute on function public.admin_kyc_link_regenerate(uuid, uuid, text, text) to authenticated, service_role;
