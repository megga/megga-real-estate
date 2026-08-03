-- Lecture assistée de la pièce d'identité KYB — deux colonnes, et le verrou qui va avec.
--
-- Décision du 03.08.2026 : la pièce déposée à l'étape 3 du wizard est LUE (Gemini,
-- edge `kyb-identity-read`) et confrontée à ce que le dirigeant a saisi à l'étape 1.
-- Deux choses en sortent, et deux seulement :
--   * `id_document_expires_on` — l'échéance, que rien ne connaissait jusqu'ici alors
--     que le sous-titre de l'écran exige « une pièce en cours de validité ». Sans elle,
--     « en cours de validité » n'était vérifiable que par l'œil d'un relecteur, une
--     seule fois, sans possibilité d'alerter le jour où la pièce périme.
--   * `id_document_read` — le VERDICT de la confrontation, jamais son contenu.
--
-- ── Ce que id_document_read ne contient PAS, et pourquoi ────────────────────────────
--
-- Ni nom, ni prénom, ni date de naissance, ni numéro de document LUS. Uniquement des
-- verdicts par champ (exact | approx | differs | unreadable) et leur synthèse. Écrire
-- le nom lu reviendrait à stocker une SECONDE copie de la même PII pour dire qu'elle
-- correspond à la première — un doublon que la LPD n'excuse pas et que personne ne
-- consomme : le relecteur qui veut la valeur exacte ouvre l'image (IdDocumentPreview).
-- Le prompt lui-même interdit au modèle de rendre le numéro (KYB_ID_PROMPT).
--
-- ── Ce que ces colonnes ne font PAS ─────────────────────────────────────────────────
--
-- Elles n'entrent dans AUCUN calcul. `verification_check_types` n'est pas touchée, donc
-- ni `verification_check_config` (poids, veto), ni `record_agency_verification_run`, ni
-- la file de revue ne voient quoi que ce soit de neuf. Le seul check de la pièce reste
-- `id_document` / `pending_manual_review`, posé par submit_agency_identity() et tranché
-- par `admin_resolve_agency_id_document`. Un verdict `mismatch` ne bloque rien tout
-- seul : il dit au relecteur où regarder. Règle du dépôt, l'IA est compliance-ENABLING.
--
-- ── Le verrou, qui est le vrai sujet de cette migration ─────────────────────────────
--
-- `agency_related_persons` est écrite par le CLIENT : la policy UPDATE laisse un
-- `is_agency_admin()` modifier la ligne, c'est ce que fait savePerson() à chaque étape 1.
-- Sans garde, le dirigeant pourrait donc poser lui-même `id_document_read` à
-- `{"verdict":"match"}` et `id_document_expires_on` à une date lointaine — c'est-à-dire
-- SIGNER LE CONSTAT QUI LE CONCERNE. Un signal de conformité écrit par le sujet du
-- contrôle ne vaut rien.
--
-- D'où un trigger qui refuse toute modification de ces deux colonnes hors `service_role`
-- (l'edge function, et elle seule). Motif copié sur enforce_activity_events_immutability :
-- interdiction par défaut, exception NOMMÉE. Il ne gêne aucun chemin existant :
-- buildPersonPayload n'envoie que 5 colonnes, et PostgREST n'écrit que celles reçues,
-- donc `new.* = old.*` pour ces deux-là et le trigger passe sans rien dire.

alter table public.agency_related_persons
  add column if not exists id_document_expires_on date,
  add column if not exists id_document_read jsonb;

comment on column public.agency_related_persons.id_document_expires_on is
  'Date d''expiration LUE sur la pièce d''identité (edge kyb-identity-read, Gemini), jamais saisie par le dirigeant. Une lecture au mois seul est ramenée au DERNIER jour du mois (normalizeExpiry) : arrondir au premier déclarerait périmée une pièce encore valable un mois. NULL = pas encore lue, ou échéance illisible -- jamais « pas d''expiration ». Écriture réservée à service_role (trigger enforce_agency_person_id_read_writer).';

comment on column public.agency_related_persons.id_document_read is
  'Verdict de la lecture assistée : {model, verdict, fields:{firstName,lastName,dateOfBirth}, documentTypeMatches, expiresOn, expired}. Aucune donnée LUE n''y figure -- ni nom, ni prénom, ni date de naissance, ni numéro : uniquement des verdicts de comparaison avec la ligne déclarée (minimisation LPD, le relecteur a l''image sous les yeux). N''entre dans AUCUN score ni véto : le seul check de la pièce reste id_document/pending_manual_review, tranché par un humain. Écriture réservée à service_role (trigger enforce_agency_person_id_read_writer).';

-- SECURITY INVOKER (le défaut, donc PAS de `security definer` ici) : c'est tout le
-- point. Sous SECURITY DEFINER, `current_user` vaut le PROPRIÉTAIRE de la fonction
-- (postgres) et non l'appelant — la garde laisserait alors passer tout le monde, en
-- silence. Ce trigger ne lit que NEW/OLD et lève : il n'a besoin d'aucun privilège
-- emprunté.
--
-- `current_user` et non un claim JWT : PostgREST bascule réellement le rôle Postgres
-- (`SET LOCAL ROLE`) d'après le jeton, donc `current_user` vaut 'anon',
-- 'authenticated' ou 'service_role' selon l'appelant. C'est le mécanisme lui-même,
-- pas une déclaration qu'on lui demanderait de faire sur son propre compte.
-- Corollaire assumé : une correction à la main depuis l'éditeur SQL (rôle `postgres`)
-- est refusée elle aussi. Un superutilisateur qui l'assume peut toujours désactiver le
-- trigger le temps du geste -- ce qui laisse au moins une trace de l'intention.
create or replace function public.enforce_agency_person_id_read_writer()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- `is distinct from` et non `<>` : l'un des deux côtés est NULL à la toute première
  -- écriture, et `null <> null` rendrait NULL, donc la garde ne se déclencherait pas.
  if (new.id_document_read is distinct from old.id_document_read
      or new.id_document_expires_on is distinct from old.id_document_expires_on)
     and current_user is distinct from 'service_role'
  then
    raise exception 'agency_person_id_read_forbidden: id_document_read et id_document_expires_on sont posées par la lecture assistée (service_role), jamais par le client'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function public.enforce_agency_person_id_read_writer() is
  'Interdit au CLIENT de poser lui-même le verdict de lecture de sa propre pièce d''identité et sa date d''expiration. agency_related_persons est modifiable par is_agency_admin() (c''est ce que fait savePerson à l''étape 1) : sans cette garde, le dirigeant signerait le constat qui le concerne. Ne gêne aucun chemin existant -- buildPersonPayload n''envoie que 5 colonnes et PostgREST n''écrit que celles reçues, donc new.* = old.* pour ces deux-là. SECURITY INVOKER délibérément : sous SECURITY DEFINER, current_user vaudrait le propriétaire et la garde laisserait passer tout le monde. Motif : enforce_activity_events_immutability (interdiction par défaut, exception nommée).';

drop trigger if exists trg_agency_person_id_read_writer on public.agency_related_persons;
create trigger trg_agency_person_id_read_writer
  before update on public.agency_related_persons
  for each row
  execute function public.enforce_agency_person_id_read_writer();
