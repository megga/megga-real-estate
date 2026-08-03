-- Vérification d'identité du dirigeant par Stripe Identity — état de la session.
--
-- Décision du 3 août 2026 : la pièce d'identité du signataire n'est plus déposée dans
-- MEGGA mais VÉRIFIÉE par un prestataire (document authentique + selfie comparé à la
-- photo). Le socle l'attendait depuis l'origine, sans que rien ne l'écrive :
--   * `verification_check_types.id_document` est libellé « Pièce d'identité ET
--     DÉTECTION DU VIVANT » -- or il n'y avait aucun contrôle du vivant ;
--   * `agency_person_verification_checks.source` autorise `id_vendor` depuis
--     `20260729150300` -- zéro ligne, zéro occurrence en code.
--
-- Effet principal, et c'est le plus important : **l'image ne transite plus par MEGGA**.
-- Le préfixe `documents/{agence}/kyb-identity/` -- sans rétention, sans purge, sans
-- propriétaire, dette écrite depuis le 26.07 -- cesse d'être alimenté pour tout dossier
-- passé par ce chemin. La question de sa purge ne se résout pas : elle disparaît.
--
-- ── ⚠ Pourquoi le dépôt manuel N'EST PAS retiré ────────────────────────────────────
--
-- `options.document.allowed_types` de Stripe ne connaît que `driving_license`,
-- `id_card` et `passport`. **Aucun titre de séjour.** À Genève, une part notable des
-- dirigeants d'agence sont des ressortissants étrangers dont la pièce suisse est un
-- livret B/C ; ils devront présenter leur passeport d'origine. S'y ajoutent trois refus
-- DÉFINITIFS de Stripe (`consent_declined`, `country_not_supported`,
-- `under_supported_age`) où insister enfermerait l'utilisateur dans une boucle.
-- Le dépôt manuel (StepPieceIdentite + kyb-id-read.ts) reste donc le chemin de SECOURS.
--
-- ── Ce que ces colonnes ne font PAS ─────────────────────────────────────────────────
--
-- Elles n'entrent dans aucun calcul. `verification_check_types` n'est pas touchée, donc
-- ni les poids, ni les vétos, ni `record_agency_verification_run` ne voient du neuf. Le
-- seul check de la pièce reste `id_document` / `pending_manual_review`, tranché par
-- `admin_resolve_agency_id_document`. Une vérification Stripe réussie ne valide pas le
-- dossier toute seule -- elle donne au relecteur une preuve qu'il n'avait pas.
-- Règle du dépôt : l'automatisation est compliance-ENABLING, jamais REPLACING.

alter table public.agency_related_persons
  add column if not exists identity_verification_session_id text,
  add column if not exists identity_verification_status text,
  add column if not exists identity_verification_error_code text,
  add column if not exists identity_verified_at timestamptz;

-- CHECK posé à part et idempotent : `add column if not exists` ne rejoue pas la
-- contrainte si la colonne existe déjà, et cette migration doit rester rejouable
-- (scripts/check-migration-idempotence.mjs).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.agency_related_persons'::regclass
      and conname = 'agency_related_persons_identity_verification_status_check'
  ) then
    alter table public.agency_related_persons
      add constraint agency_related_persons_identity_verification_status_check
      check (identity_verification_status is null or identity_verification_status in
             ('requires_input', 'processing', 'verified', 'canceled'));
  end if;
end $$;

comment on column public.agency_related_persons.identity_verification_session_id is
  'Identifiant de la VerificationSession Stripe Identity (vs_...) ouverte pour cette personne. Sert à (1) rattacher un webhook à la bonne ligne, (2) rouvrir la session côté Stripe, (3) demander la SUPPRESSION des pièces chez Stripe (endpoint redact) le jour où la rétention est tranchée. NULL = aucune vérification jamais lancée (dossier antérieur au 03.08.2026, ou parcours passé par le dépôt manuel de secours).';

comment on column public.agency_related_persons.identity_verification_status is
  'Statut de la VerificationSession : requires_input (à reprendre) | processing (Stripe traite) | verified | canceled. Recopié depuis Stripe par le webhook, jamais déduit côté client. C''est ce statut, et non la présence d''un fichier, qui complète l''étape 3 quand le parcours passe par Stripe. Écriture réservée à service_role (trigger enforce_agency_person_id_read_writer).';

comment on column public.agency_related_persons.identity_verification_error_code is
  'last_error.code de Stripe quand la session demande une reprise (document_expired, selfie_face_mismatch, consent_declined...). Conservé pour SAVOIR S''IL FAUT proposer le dépôt manuel : consent_declined, country_not_supported et under_supported_age sont définitifs chez Stripe, réessayer enfermerait l''utilisateur dans une boucle (requiresManualFallback, _shared/kyb-identity-stripe.ts).';

comment on column public.agency_related_persons.identity_verified_at is
  'Horodatage du passage en `verified`. Distinct d''agencies.identity_submitted_at, qui date la SOUMISSION du dossier par le dirigeant : une identité peut être vérifiée sans que le dossier soit soumis, et un dossier soumis peut porter une identité jamais vérifiée (chemin manuel de secours).';

-- Le verrou de 20260803150000 couvrait `id_document_read` et `id_document_expires_on`.
-- Il doit couvrir AUSSI ces quatre colonnes, et pour la même raison, plus aiguë encore :
-- `agency_related_persons` est modifiable par is_agency_admin() (c'est ce que fait
-- savePerson à l'étape 1), donc sans garde le dirigeant poserait lui-même
-- `identity_verification_status = 'verified'` sur sa propre ligne -- c'est-à-dire qu'il
-- se déclarerait vérifié. Le statut ne peut venir que du webhook Stripe (service_role).
--
-- SECURITY INVOKER (le défaut, donc pas de `security definer`) : sous DEFINER,
-- `current_user` vaudrait le PROPRIÉTAIRE de la fonction et la garde laisserait passer
-- tout le monde, en silence.
create or replace function public.enforce_agency_person_id_read_writer()
returns trigger
language plpgsql
set search_path = public
as $$
begin
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
  return new;
end;
$$;

comment on function public.enforce_agency_person_id_read_writer() is
  'Interdit au CLIENT de poser lui-même le verdict de lecture de sa propre pièce d''identité, sa date d''expiration, et l''état de sa vérification Stripe Identity. agency_related_persons est modifiable par is_agency_admin() (c''est ce que fait savePerson à l''étape 1) : sans cette garde, le dirigeant se déclarerait vérifié. Ne gêne aucun chemin existant -- buildPersonPayload n''envoie que 5 colonnes et PostgREST n''écrit que celles reçues, donc new.* = old.* pour toutes celles-ci. SECURITY INVOKER délibérément : sous SECURITY DEFINER, current_user vaudrait le propriétaire et la garde laisserait passer tout le monde. Motif : enforce_activity_events_immutability (interdiction par défaut, exception nommée).';

-- Un webhook arrive avec un `vs_...` et rien d'autre : sans index, chaque événement
-- Stripe balaierait toute la table pour retrouver sa ligne. Partiel, parce que la
-- colonne est NULL sur toute personne qui n'a jamais lancé de vérification.
create index if not exists idx_agency_related_persons_identity_session
  on public.agency_related_persons (identity_verification_session_id)
  where identity_verification_session_id is not null;
