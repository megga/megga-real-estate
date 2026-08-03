-- Revue KYB — le relecteur super-admin peut enfin OUVRIR la pièce d'identité qu'il juge.
--
-- Le problème, constaté le 02.08.2026 sur un dossier réel coincé en 'manual_review' :
-- `admin_resolve_agency_id_document` (20260731121000) refuse 'unavailable' au motif
-- explicite que « Le relecteur A le document sous les yeux ». C'était faux dans le code
-- livré. Les 4 policies `documents_kyb_identity_*` (20260729150900) exigent
-- `is_agency_admin()` ET l'appartenance à l'agence ; un super-admin a `agency_id` NULL et
-- ne satisfait ni l'un ni l'autre. Le relecteur tranchait donc match/partial/mismatch à
-- l'aveugle, sur un nom de personne et trois boutons.
--
-- Pourquoi c'est un OUBLI et non une décision : 20260729150900 se déclare elle-même
-- « strictement équivalente » aux gardes du reste du dispositif KYB — or celles-ci
-- portent TOUTES `or public.is_super_admin()`. `agency_related_persons`
-- (20260729150200:120-130) l'a, et le commentaire de sa colonne `id_document_number`
-- promet noir sur blanc « Lecture restreinte aux dirigeants de l'agence et au super-admin
-- via RLS ». Autrement dit le super-admin lit DÉJÀ le NUMÉRO de la pièce ; seule l'IMAGE
-- de la même pièce restait murée. Le même motif tourne par ailleurs en production sur le
-- bucket `kyc-documents` (policy `kyc_docs_agency_select`), plus sensible encore.
--
-- ── Ce que cette migration NE fait PAS, délibérément ────────────────────────────────
--
-- 1. SELECT UNIQUEMENT. Les policies insert/update/delete du préfixe ne bougent pas. Le
--    relecteur doit VOIR, jamais remplacer ni effacer : le verdict qu'il pose est
--    append-only et daté (20260731121000), il est censé désigner un fichier qui n'a pas
--    bougé. Lui donner UPDATE ou DELETE viderait cette garantie de son sens.
--
-- 2. Elle ne touche AUCUNE des policies générales `documents_bucket_*`. Elles excluent le
--    préfixe `kyb-identity` exprès, et Postgres combine les policies PERMISSIVES d'un même
--    rôle/commande en OR : une branche posée du mauvais côté rouvrirait le préfixe à TOUT
--    membre de l'agence, ce que 20260729150900 avait précisément fermé.
--
-- 3. Elle ne donne AUCUN cycle de vie au fichier. Celui-ci n'a toujours ni ligne en base,
--    ni propriétaire, ni rétention, ni chemin de purge — il échappe à `delete-account`
--    comme aux deux triggers de rétention 10 ans, qui ne s'arment que sur
--    `kyc_case_id IS NOT NULL`. Dette écrite et datée : docs/agency-kyb-handoff.md
--    (« Dettes identifiées en revue finale ») et docs/agency-kyb-piece-identite-metadonnees.md §2.3.
--    « Le relecteur voit enfin » ne veut pas dire « le fichier est maîtrisé ».
--
-- ── Le piège de cette migration : la PARENTHÈSE ─────────────────────────────────────
--
-- `or public.is_super_admin()` doit rester IMBRIQUÉ SOUS les deux clauses de portée
-- (`bucket_id` et le test de préfixe). Posé au niveau du `using(...)`, il annulerait aussi
-- `bucket_id = 'documents'` : la branche super-admin ouvrirait alors TOUS les objets de
-- TOUS les buckets, `kyc-magic-link` et `signed-documents` compris. La forme ci-dessous
-- garde les deux conjoints de portée en facteur commun et ne fait alterner QUE le critère
-- de personne. Trois tests négatifs l'éprouvent
-- (tests/backend/kyb-identity-documents-storage.spec.ts).
--
-- `is_super_admin()` est STABLE SECURITY DEFINER et exécutable par `authenticated`
-- (20260705160000) : utilisable telle quelle dans une policy Storage. On ne l'enveloppe
-- PAS dans `(select …)` — l'InitPlan n'a aucun intérêt sur un préfixe qui compte 2 objets,
-- et les policies voisines ne le font pas : la famille doit rester homogène.
--
-- Idempotente : DROP IF EXISTS puis recréation à l'identique si rejouée.

drop policy if exists "documents_kyb_identity_select" on storage.objects;
create policy "documents_kyb_identity_select"
  on storage.objects
  for select
  to authenticated
  using (
    -- Portée : jamais franchie par aucune des deux branches ci-dessous.
    bucket_id = 'documents'
    and lower((storage.foldername(name))[2]) = 'kyb-identity'
    and (
      -- Le relecteur de conformité, quelle que soit l'agence relue.
      public.is_super_admin()
      -- Le dirigeant, sur sa propre agence — comportement d'origine, inchangé.
      or (
        (storage.foldername(name))[1] = public.get_my_agency_id()::text
        and public.is_agency_admin()
      )
    )
  );

comment on policy "documents_kyb_identity_select" on storage.objects is
  'Lecture de la pièce d''identité KYB : le dirigeant sur SA propre agence (is_agency_admin() + foldername[1]), ou le relecteur super-admin sur toute agence (is_super_admin(), rôle ET e-mail allowlisté). SELECT seul — le super-admin n''a jamais insert/update/delete sur ce préfixe, le verdict de revue étant append-only et daté. Voir 20260802200000.';
