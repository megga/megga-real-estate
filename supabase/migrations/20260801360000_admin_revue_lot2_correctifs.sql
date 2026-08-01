-- Revue du Lot 2 — correctifs mesurés (étapes 21 et 22).
--
-- Quatre défauts trouvés en relisant les fonctions VIVANTES (pg_get_functiondef), tous
-- dans deux objets : `admin_log_export` et `changelog_publish_due`.
--
--   1. L'empreinte de l'extrait dépendait du FUSEAU DE LA SESSION. Mesuré sur les lignes
--      réelles : le même registre rendait `84c3ff3e…` en UTC et `c01b7b0d…` en
--      Europe/Zurich. Le piège était pourtant connu du dépôt — `admin_log_payload_v1` s'en
--      défend explicitement (« un timestamptz nu se rend dans le fuseau de la SESSION ») —
--      et la chaîne d'empreintes y échappait. L'extrait, non.
--   2. Le plafond de 5000 lignes était évalué APRÈS l'agrégat qui devait le déclencher.
--   3. Le plafond ne bornait pas la marche de chaîne quand une famille était filtrée.
--   4. Une publication PROGRAMMÉE ne laissait aucune ligne au registre.
--
-- Rejouable le jour même : CREATE OR REPLACE seulement, aucun objet créé.

-- ═══════════════════════════════════════════════════════════════════════════════════
-- 1/2 · admin_log_export — l'empreinte redevient fonction des seules DONNÉES
-- ═══════════════════════════════════════════════════════════════════════════════════

create or replace function public.admin_log_export(
  p_from timestamptz,
  p_to timestamptz,
  p_family text default null,
  p_idempotency_key text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_lignes    jsonb;
  v_n         integer;
  v_portee    integer;
  v_seq_min   bigint;
  v_seq_max   bigint;
  v_empreinte text;
  v_chaine    jsonb;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;
  if p_from is null or p_to is null then
    return public.admin_error('precondition_failed', 'Indiquez la période à extraire.');
  end if;
  if p_from >= p_to then
    return public.admin_error('precondition_failed', 'La période est vide.');
  end if;
  if coalesce(btrim(p_idempotency_key), '') = '' then
    return public.admin_error('precondition_failed', 'Clé d''idempotence manquante.');
  end if;
  if p_family is not null and not exists (
       select 1 from public.admin_log_family f where f.code = p_family) then
    return public.admin_error('precondition_failed', 'Famille inconnue : ' || p_family);
  end if;

  -- ── Le COMPTE d'abord, l'agrégat seulement si le plafond passe ─────────────────
  -- ⚠ CORRECTIF. Le compte et `jsonb_agg` vivaient dans le MÊME select : l'array complet
  -- était donc matérialisé avant que `v_n > 5000` ne puisse refuser quoi que ce soit. Le
  -- plafond existe pour éviter le statement timeout (8 s sur `authenticated`) — il ne
  -- pouvait pas l'éviter, puisque le travail coûteux le précédait. Sur une fenêtre large,
  -- l'appelant recevait un timeout, jamais `too_many`.
  select count(*)::integer, min(l.seq), max(l.seq)
    into v_n, v_seq_min, v_seq_max
    from public.admin_log l
   where l.ts >= p_from and l.ts < p_to
     and (p_family is null or l.family = p_family);

  if v_n > 5000 then
    return public.admin_error('too_many',
      'Cette période contient trop d''entrées. Restreignez-la.',
      jsonb_build_object('count', v_n));
  end if;

  -- ── Le plafond borne aussi ce que la CHAÎNE devra relire ───────────────────────
  -- ⚠ CORRECTIF. Une chaîne d'empreintes ne se vérifie que sur un intervalle CONTIGU de
  -- `seq` : pour recalculer le hash d'une ligne il faut celui de la précédente, filtrée ou
  -- non. `admin_log_verify_chain` relit donc TOUTES les familles entre les deux bornes —
  -- c'est correct, et c'est nécessaire. Ce qui ne l'était pas : le plafond ne portait que
  -- sur le compte FILTRÉ. Une famille creuse sur une fenêtre large (50 lignes ≤ 5000)
  -- passait, puis faisait un SHA-256 par ligne sur tout l'intervalle.
  --
  -- C'est la même cause que le défaut de fenêtre VIDE déjà corrigé, dont le commentaire
  -- nommait pourtant ce cas : « une famille filtrée sur une période calme ». Le sous-cas
  -- `v_n = 0` avait été traité, le cas creux non.
  if v_n = 0 then
    v_portee := 0;
  else
    select count(*)::integer into v_portee
      from public.admin_log l
     where l.seq >= v_seq_min and l.seq <= v_seq_max;
    if v_portee > 5000 then
      return public.admin_error('too_many',
        'Cette famille est trop dispersée sur la période : la vérification de chaîne '
        || 'devrait relire trop d''entrées. Restreignez la période.',
        jsonb_build_object('count', v_n, 'chain_span', v_portee));
    end if;
  end if;

  -- ── L'extrait, AVANT toute écriture ────────────────────────────────────────────
  -- L'empreinte doit porter sur ce qui est REMIS. Journaliser d'abord ferait entrer la
  -- ligne d'export dans son propre extrait selon la seconde où il tombe : le même appel
  -- rendrait deux empreintes différentes, et une empreinte non reproductible ne prouve rien.
  --
  -- ⚠ CORRECTIF — `'ts', l.ts` rendait un timestamptz NU. Le rendu jsonb d'un timestamptz
  -- utilise le fuseau de la SESSION : la même fenêtre, sur les mêmes lignes, signait
  -- `84c3ff3e…` en UTC et `c01b7b0d…` en Europe/Zurich. L'empreinte n'était donc pas
  -- fonction des seules données — exactement le défaut que le commentaire ci-dessus dit
  -- combattre, et contre lequel `admin_log_payload_v1` se défendait déjà nommément.
  --
  -- Le format est CELUI de la charge de chaîne, au caractère près. Ce n'est pas de la
  -- coquetterie : le destinataire peut désormais recalculer le hash de chaque ligne à
  -- partir du seul extrait, sans accès à la base.
  --
  -- ⚠ Le compte et les bornes sont RECALCULÉS ici, avec l'agrégat, dans un seul select.
  -- Ce n'est pas une redite du pré-compte ci-dessus : sous READ COMMITTED, deux `select`
  -- successifs voient deux instantanés. Lire `count` d'un instantané et `entries` d'un
  -- autre rendrait deux nombres qui ne décrivent pas la même population — exactement le
  -- défaut corrigé plus bas. Le pré-compte ne sert qu'à REFUSER tôt ; les valeurs rendues
  -- viennent toutes d'ici.
  select count(*)::integer, min(l.seq), max(l.seq),
         coalesce(jsonb_agg(jsonb_build_object(
           'seq', l.seq,
           'ts', to_char(l.ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
           'severity', l.severity, 'family', l.family,
           'action', l.action, 'entity_type', l.entity_type, 'entity_label', l.entity_label,
           'actor', l.actor_label, 'prev_hash', l.prev_hash, 'hash', l.hash)
           order by l.seq), '[]'::jsonb)
    into v_n, v_seq_min, v_seq_max, v_lignes
    from public.admin_log l
   where l.ts >= p_from and l.ts < p_to
     and (p_family is null or l.family = p_family);

  -- ── La clé d'idempotence, prise SEULEMENT ICI ──────────────────────────────────
  -- Un extrait est un GESTE : il laisse une trace, donc un double-clic ne doit pas en
  -- laisser deux. Mais la réserver plus haut la faisait consommer par un refus métier
  -- (`too_many`), qui est un `return` : la transaction COMMITTE, le reçu reste, non scellé.
  -- Le réessai avec la même clé — ce à quoi sert une clé d'idempotence — répondait alors
  -- `already_done`, c'est-à-dire une forme de SUCCÈS pour un extrait jamais produit.
  -- Règle : on ne réserve la clé qu'une fois engagé à écrire. Les DEUX refus de plafond
  -- ci-dessus la précèdent, pour la même raison.
  if not public.admin_receipt_try(p_idempotency_key, 'admin_log_export') then
    return public.admin_ok(jsonb_build_object('already_done', true));
  end if;

  -- Empreinte de l'extrait. `sha256` de pg_catalog, jamais `digest()` de pgcrypto :
  -- celle-ci vit dans le schéma `extensions` et lèverait 42883 sous ce search_path.
  v_empreinte := encode(sha256(convert_to(v_lignes::text, 'UTF8')), 'hex');

  -- Verdict de chaîne sur la FENÊTRE exportée, pas sur tout le registre : la preuve doit
  -- porter sur ce qu'on remet, et vérifier dix ans d'historique à chaque extrait coûterait
  -- sans rien prouver de plus sur cette période.
  --
  -- ⚠ Il FAUT les deux bornes. Avec la seule borne basse, la marche courait jusqu'à la tête
  -- du registre : le coût croissait avec l'ÂGE de la fenêtre, et `rows_checked` décrivait
  -- des lignes absentes de l'extrait. Et sur une fenêtre valide mais VIDE, `min(seq)` vaut
  -- NULL — la borne basse disparaissait et l'appel relisait le registre ENTIER, précisément
  -- ce que le plafond de 5000 lignes existe pour éviter. Une fenêtre vide n'a pas de chaîne
  -- à vérifier : on rend le verdict directement.
  if v_n = 0 then
    v_chaine := jsonb_build_object('status', 'no_rows', 'rows_checked', 0, 'bounded', true);
  else
    v_chaine := public.admin_log_verify_chain(v_seq_min, v_seq_max);
  end if;

  -- ⚠ CORRECTIF — `rows_checked` et `count` étaient rendus CÔTE À CÔTE en décrivant des
  -- populations différentes dès qu'une famille était filtrée : le premier compte tout
  -- l'intervalle contigu, le second les seules lignes remises. Deux nombres voisins qui ne
  -- parlent pas de la même chose, c'est la classe de défaut qui a déjà payé deux fois sur
  -- ce chantier. On nomme donc explicitement la population de l'extrait dans le verdict
  -- lui-même, plutôt que de laisser le lecteur supposer qu'elles coïncident.
  v_chaine := v_chaine || jsonb_build_object('extract_rows', v_n);

  -- ── L'auto-journalisation (§5.9) ───────────────────────────────────────────────
  perform public.admin_log_write(
    p_family => 'export', p_action => 'admin_log_export', p_severity => 'warn',
    p_entity_type => 'admin_log', p_entity_label => 'extrait du registre',
    p_metadata => jsonb_build_array(
      jsonb_build_object('l', 'Période', 'v',
        to_char(p_from at time zone 'Europe/Zurich', 'DD.MM.YYYY') || ' → ' ||
        to_char(p_to   at time zone 'Europe/Zurich', 'DD.MM.YYYY')),
      jsonb_build_object('l', 'Famille', 'v', coalesce(p_family, 'toutes')),
      jsonb_build_object('l', 'Entrées', 'v', v_n::text),
      jsonb_build_object('l', 'Empreinte', 'v', left(v_empreinte, 16))));

  perform public.admin_receipt_seal(p_idempotency_key,
    jsonb_build_object('digest', v_empreinte, 'count', v_n));

  return public.admin_ok(jsonb_build_object(
    'count', v_n,
    'from', p_from,
    'to', p_to,
    'family', p_family,
    'digest_sha256', v_empreinte,
    'chain', v_chaine,
    'entries', v_lignes));
end;
$function$;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- 2/2 · changelog_publish_due — une publication programmée laisse une trace
-- ═══════════════════════════════════════════════════════════════════════════════════

create or replace function public.changelog_publish_due()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_n integer := 0;
  r   record;
begin
  -- Garde élargie à `session_user` : cette fonction tourne sous pg_cron, sans JWT.
  if not (public.is_super_admin() or public.is_service_role()
          or session_user in ('postgres', 'supabase_admin')) then
    raise exception 'forbidden: super_admin or service only' using errcode = '42501';
  end if;

  -- ⚠ CORRECTIF. Ce cron rend une nouveauté visible de TOUS les agents sans écrire une
  -- seule ligne au registre, alors que le geste manuel identique
  -- (`admin_changelog_publish`) journalise en `warn`. Le seul chemin de publication qui
  -- atteignait tout le monde était donc aussi le seul invisible à l'écran Sécurité — et
  -- hors chaîne d'empreintes.
  --
  -- Le cliquet de l'étape 23 ne pouvait pas l'attraper : son périmètre s'écrivait
  -- `proname ~ '^admin_'`, une convention de NOM là où le reste du fichier définit ses
  -- périmètres par une PROPRIÉTÉ. Le périmètre est élargi dans le même passage.
  --
  -- La boucle plutôt qu'un count : une ligne de registre par nouveauté publiée, sinon le
  -- journal dirait « trois publications » sans dire lesquelles.
  for r in
    with dues as (
      update public.admin_changelog
         set status = 'published', published = true, published_at = now(),
             scheduled_for = null, updated_at = now()
       where status = 'scheduled' and scheduled_for <= now()
      returning id, title
    )
    select id, title from dues
  loop
    -- `routine` reste FAUX (défaut) : `get_admin_security_journal` filtre `not routine`.
    -- Marquer ce geste comme routinier l'écrirait pour personne — l'écran ne le montrerait
    -- pas, et on aurait remplacé une absence de trace par une trace invisible.
    --
    -- Aucun `p_actor_label` : sous pg_cron `auth.uid()` est NULL, et `admin_log_write`
    -- IMPOSE alors le libellé « Système » (22023 sur toute autre valeur).
    perform public.admin_log_write(
      p_family => 'comm', p_action => 'changelog_published', p_severity => 'warn',
      p_entity_type => 'changelog', p_entity_id => r.id, p_entity_label => r.title,
      p_metadata => jsonb_build_array(
        jsonb_build_object('l', 'Déclencheur', 'v', 'publication programmée')));
    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$function$;
