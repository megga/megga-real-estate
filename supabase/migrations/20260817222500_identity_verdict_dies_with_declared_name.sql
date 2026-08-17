-- Un VERDICT DE CORRESPONDANCE ne survit pas à la correction du champ qu'il comparait.
--
-- ── Ce qui s'est passé, le 17 août 2026 ─────────────────────────────────────────────
--
-- Un dirigeant saisit son ANCIEN nom à l'étape 1 (changement de nom légal), puis vérifie
-- son identité chez Stripe avec sa pièce au NOUVEAU nom. Le webhook compare les deux et
-- écrit fidèlement `id_document_read = {verdict: 'mismatch', lastName: 'differs'}`.
-- Jusque-là tout est juste.
--
-- Il corrige ensuite son nom à l'étape 1. Et là, plus rien ne bouge : `id_document_read`
-- est écrit UNE fois, par le webhook, contre l'état déclaré à cet instant-là. Aucun
-- chemin ne le recalcule. Le dossier porte donc un verdict `mismatch` qui compare un nom
-- qui n'existe plus — et le relecteur de conformité, qui n'a que ce verdict et la pièce,
-- refuserait un dossier devenu correct.
--
-- Le sens de la panne compte : un verdict périmé ne peut que NUIRE au dirigeant (il dit
-- « ne correspond pas » d'une correspondance désormais vraie), jamais le favoriser. Ce
-- n'est donc pas un trou de sécurité, c'est un faux négatif durable. Mais un faux négatif
-- qu'aucun geste de l'utilisateur ne peut effacer est pire qu'une erreur bruyante.
--
-- ── La règle ────────────────────────────────────────────────────────────────────────
--
-- Modifier le prénom, le nom ou la date de naissance d'une personne déjà vérifiée EFFACE
-- le verdict et remet la vérification à refaire. Le fait qu'une vérification ait eu lieu
-- ne disparaît pas pour autant : il part dans `activity_events` AVANT l'effacement, avec
-- le verdict et l'horodatage d'origine. La ligne cesse d'affirmer quelque chose de faux,
-- l'audit garde ce qui s'est réellement produit.
--
-- ⚠ CE N'EST PAS le champ `id_document_type` ni `id_document_expires_on` : ceux-là
-- décrivent le DOCUMENT (nature, échéance), pas la comparaison avec le nom déclaré, et
-- `id_document_type` peut avoir été saisi À LA MAIN par le dirigeant sur le chemin de
-- secours. Les effacer détruirait une donnée que personne n'a invalidée.
--
-- ── Pourquoi DANS la garde existante et pas dans un second trigger ──────────────────
--
-- ⛔ Un second trigger BEFORE UPDATE aurait dû s'exécuter APRÈS
-- `trg_agency_person_id_read_writer`, sans quoi la garde verrait les colonnes changer et
-- refuserait l'écriture du client (42501) — un dirigeant ne pourrait plus corriger son
-- propre nom. Or PostgreSQL ordonne les triggers de même moment PAR LE NOM, selon la
-- COLLATION de la base : sous `en_US.UTF-8` la ponctuation est ignorée au premier
-- passage, donc `trg_agency_person_identity_…` compare `identity…` à `idread…` et passe
-- AVANT la garde, à l'inverse de ce que l'ordre ASCII laisserait croire. Faire reposer
-- une autorisation sur ce détail-là, c'est écrire un bogue qui attend un changement de
-- collation. La logique vit donc dans la garde elle-même, qui a déjà pour objet le CYCLE
-- DE VIE de ces colonnes — et il n'y a plus d'ordre à garantir.
--
-- L'ordre INTERNE, lui, est le sujet : le refus du client est évalué D'ABORD, sur les
-- valeurs telles qu'il les a envoyées. L'invalidation n'écrit qu'ensuite. Un client ne
-- peut donc pas se servir de ce chemin pour poser une valeur : il ne peut que les mettre
-- toutes à NULL, en payant le prix — refaire sa vérification.

create or replace function public.enforce_agency_person_id_read_writer()
returns trigger
-- ⛔ SECURITY INVOKER, OBLIGATOIREMENT, et cette contrainte a survécu à une tentative de
-- passage en DEFINER pendant l'écriture de cette migration. Deux raisons, chacune
-- suffisante :
--   1. Sous DEFINER, `current_user` vaut le PROPRIÉTAIRE de la fonction : la garde du
--      bloc 1 laisserait alors passer TOUTE écriture cliente, en silence. C'est le piège
--      déjà documenté à la création de cette garde (20260803160000).
--   2. `session_user` n'est PAS une échappatoire. PostgREST se connecte avec le rôle
--      `authenticator` puis fait `SET ROLE authenticated|anon|service_role` : `SET ROLE`
--      déplace `current_user`, jamais `session_user`. Lire `session_user` rendrait donc
--      `authenticator` pour le client ET pour le serveur — la garde refuserait le webhook.
-- L'audit du bloc 2 n'a besoin d'aucun privilège supplémentaire : la policy `events_insert`
-- accepte `agency_id = get_my_agency_id()`, ce qu'est par construction l'agence du
-- dirigeant qui corrige sa propre ligne (et `super_admin_insert_events` couvre l'autre cas).
language plpgsql
as $$
declare
  v_actor        uuid := auth.uid();
  v_declared_changed boolean;
begin
  -- ═══ 1. LA GARDE D'ORIGINE, inchangée dans son effet ═══
  --
  -- `is distinct from` et non `<>` : l'un des deux côtés est NULL à la première
  -- écriture, et `null <> null` rend NULL, donc la garde ne se déclencherait pas.
  if (new.id_document_read is distinct from old.id_document_read
      or new.id_document_expires_on is distinct from old.id_document_expires_on
      or new.identity_verification_session_id is distinct from old.identity_verification_session_id
      or new.identity_verification_status is distinct from old.identity_verification_status
      or new.identity_verification_error_code is distinct from old.identity_verification_error_code
      or new.identity_verified_at is distinct from old.identity_verified_at)
     and current_user is distinct from 'service_role'
  then
    raise exception 'agency_person_id_read_forbidden: le verdict de lecture et l''état de la vérification d''identité sont posés par le serveur (service_role), jamais par le client'
      using errcode = '42501';
  end if;

  -- ═══ 2. L'INVALIDATION ═══

  v_declared_changed := (new.first_name, new.last_name, new.date_of_birth)
                        is distinct from (old.first_name, old.last_name, old.date_of_birth);

  -- Rien à invalider : l'identité déclarée n'a pas bougé.
  if not v_declared_changed then
    return new;
  end if;

  -- Rien à invalider non plus : aucune vérification n'a jamais eu lieu. C'est le cas de
  -- l'écrasante majorité des écritures de l'étape 1 (saisie initiale, va-et-vient dans le
  -- wizard), et il sort avant toute écriture.
  if old.id_document_read is null
     and old.identity_verification_status is null
     and old.identity_verified_at is null then
    return new;
  end if;

  -- Défensif : un appelant qui fournit un verdict FRAIS dans la MÊME instruction gagne.
  -- Aucun chemin actuel ne le fait (le webhook ne touche jamais aux noms), mais si l'un
  -- venait à le faire, effacer ce qu'il vient d'écrire serait exactement le contraire du
  -- but poursuivi ici.
  if new.id_document_read is distinct from old.id_document_read then
    return new;
  end if;

  -- L'audit AVANT l'effacement : c'est la seule trace qui restera de ce qui a eu lieu.
  -- category='kyc' (un fait de conformité, pas un réglage) et severity='warn' : une
  -- vérification qui tombe mérite un regard, sans être une alerte.
  -- ⚠ actor_kind='user' EXIGE actor_id non nul (activity_events_actor_kind_coherence) ;
  -- une invalidation venue du serveur (service_role, sans auth.uid()) est donc 'system'.
  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, category, severity, metadata)
  values (
    old.agency_id,
    v_actor,
    case when v_actor is null then 'system' else 'user' end,
    'agency_person_identity_verdict_invalidated',
    'agency_related_person',
    old.id,
    'kyc',
    'warn',
    jsonb_build_object(
      -- Ce qui a été effacé, et pourquoi. Jamais les NOMS eux-mêmes : la table est déjà
      -- la source de la PII, l'audit n'a pas à en faire une seconde copie (même règle que
      -- id_document_read, qui ne stocke que des verdicts).
      'previous_verdict', old.id_document_read -> 'verdict',
      'previous_status', old.identity_verification_status,
      'previously_verified_at', old.identity_verified_at,
      'previous_session_id', old.identity_verification_session_id,
      'changed_fields', (
        case when new.first_name is distinct from old.first_name then jsonb_build_array('first_name') else '[]'::jsonb end
        || case when new.last_name is distinct from old.last_name then jsonb_build_array('last_name') else '[]'::jsonb end
        || case when new.date_of_birth is distinct from old.date_of_birth then jsonb_build_array('date_of_birth') else '[]'::jsonb end
      )
    )
  );

  new.id_document_read := null;
  new.identity_verification_session_id := null;
  new.identity_verification_status := null;
  new.identity_verification_error_code := null;
  new.identity_verified_at := null;

  return new;
end;
$$;

comment on function public.enforce_agency_person_id_read_writer() is
  'BEFORE UPDATE sur agency_related_persons. SECURITY INVOKER obligatoire (sous DEFINER current_user vaut le proprietaire et la garde laisse tout passer). (1) Refuse au client toute ecriture des colonnes de verification d''identite. (2) Efface le verdict et l''état de vérification quand le prénom, le nom ou la date de naissance changent : un verdict de correspondance ne survit pas à la correction du champ qu''il comparait. Le fait vérifié part dans activity_events avant l''effacement.';
