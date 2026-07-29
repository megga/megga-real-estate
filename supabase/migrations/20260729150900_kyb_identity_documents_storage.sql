-- Étape 2 du chantier KYB, tâche 6 — préfixe Storage réservé pour la pièce d'identité
-- du signataire (bucket `documents`, le seul bucket généraliste du projet à côté de
-- property-photos et signed-documents, chacun mono-usage).
--
-- Pourquoi une migration séparée, pas une extension des policies existantes en place :
-- les 4 policies `documents_bucket_*` (20260527000000) autorisent déjà TOUT membre de
-- l'agence (elles ne vérifient que le premier segment de chemin = agency_id, jamais le
-- rôle) — c'est le bon comportement pour un mandat PDF généré, mais une pièce
-- d'identité de dirigeant est une PII de conformité bien plus sensible
-- (docs/agency-kyb-verification.md, agency_related_persons.id_document_number : « PII
-- sensible (LPD), lecture restreinte aux dirigeants »). Un agent simple n'a aucune
-- raison d'y accéder.
--
-- Layout retenu : documents/{agency_id}/kyb-identity/{related_person_id}/{recto|verso}.<ext>
-- storage.foldername(name) ne renvoie QUE les segments de DOSSIER (jamais le nom de
-- fichier final) : pour le layout plat existant {agency_id}/{document_id}.pdf, le
-- tableau ne compte qu'un élément et [2] vaut NULL — jamais 'kyb-identity'. Aucune
-- collision possible avec les chemins déjà en usage.
--
-- ⚠ Correctif revue tâche 6, point 1 (CRITIQUE, reproduit en base réelle) : les 8
-- policies ci-dessous comparent lower((storage.foldername(name))[2]) à 'kyb-identity',
-- jamais le segment brut. storage.search() — qu'appelle .list() côté client — filtre
-- sur lower(o.name) : un agent simple pouvait donc déposer sous 'KYB-IDENTITY'
-- (n'importe quelle casse), la comparaison octet-à-octet d'origine jugeant ce segment
-- DISTINCT de 'kyb-identity' et laissant la policy générale (qui ne vérifie que
-- l'agence, jamais le rôle) seule décider — c'est elle qui accordait l'insert. Le
-- dirigeant listait ensuite ce fichier étranger (recherche insensible à la casse côté
-- Storage), reconstruisait un chemin en minuscules qui ne correspondait à AUCUN objet
-- réel, et createSignedUrl échouait : plus aucun moyen de terminer l'étape 4. lower()
-- des deux côtés — sur les 4 policies générales ET les 4 kyb-identity — ferme ce
-- contournement pour toute casse, pas seulement le cas UPPERCASE reproduit.
--
-- Deux jeux de policies :
--   1. Les 4 policies générales sont réécrites pour EXCLURE ce préfixe. Indispensable :
--      Postgres combine les policies PERMISSIVES d'un même rôle/command en OR — sans
--      cette exclusion, la policy générale (qui ne regarde pas le rôle) resterait
--      seule suffisante pour qu'un agent simple accède au préfixe, quoi que les
--      nouvelles policies ci-dessous ajoutent.
--   2. 4 nouvelles policies, strictement equivalentes, scopées SUR ce préfixe et
--      exigeant is_agency_admin() (même garde que le reste du dispositif KYB —
--      agency_related_persons, agency_person_roles, agency_verification_checks,
--      20260728102000/300) en plus de l'appartenance à l'agence.
--
-- Idempotente : chaque policy est DROP IF EXISTS puis recréée à l'identique si rejouée.

-- ── 1. Policies générales du bucket documents : exclure le préfixe réservé ─────────
drop policy if exists "documents_bucket_select" on storage.objects;
create policy "documents_bucket_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.get_user_agency_id()::text
    and lower((storage.foldername(name))[2]) is distinct from 'kyb-identity'
  );

drop policy if exists "documents_bucket_insert" on storage.objects;
create policy "documents_bucket_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.get_user_agency_id()::text
    and lower((storage.foldername(name))[2]) is distinct from 'kyb-identity'
  );

drop policy if exists "documents_bucket_update" on storage.objects;
create policy "documents_bucket_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.get_user_agency_id()::text
    and lower((storage.foldername(name))[2]) is distinct from 'kyb-identity'
  );

drop policy if exists "documents_bucket_delete" on storage.objects;
create policy "documents_bucket_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.get_user_agency_id()::text
    and lower((storage.foldername(name))[2]) is distinct from 'kyb-identity'
  );

-- ── 2. Nouvelles policies : préfixe kyb-identity, dirigeant de SA propre agence seul ─
-- get_my_agency_id() (et non get_user_agency_id(), alias historique au corps
-- identique — 00000000000000_baseline_remote_schema.sql) pour rester au plus près du
-- vocabulaire des migrations KYB que ce préfixe prolonge (20260728102000/300).
drop policy if exists "documents_kyb_identity_select" on storage.objects;
create policy "documents_kyb_identity_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'documents'
    and lower((storage.foldername(name))[2]) = 'kyb-identity'
    and (storage.foldername(name))[1] = public.get_my_agency_id()::text
    and public.is_agency_admin()
  );

drop policy if exists "documents_kyb_identity_insert" on storage.objects;
create policy "documents_kyb_identity_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and lower((storage.foldername(name))[2]) = 'kyb-identity'
    and (storage.foldername(name))[1] = public.get_my_agency_id()::text
    and public.is_agency_admin()
  );

drop policy if exists "documents_kyb_identity_update" on storage.objects;
create policy "documents_kyb_identity_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'documents'
    and lower((storage.foldername(name))[2]) = 'kyb-identity'
    and (storage.foldername(name))[1] = public.get_my_agency_id()::text
    and public.is_agency_admin()
  );

drop policy if exists "documents_kyb_identity_delete" on storage.objects;
create policy "documents_kyb_identity_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and lower((storage.foldername(name))[2]) = 'kyb-identity'
    and (storage.foldername(name))[1] = public.get_my_agency_id()::text
    and public.is_agency_admin()
  );
