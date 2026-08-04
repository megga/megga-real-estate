-- Rôle DÉCLARÉ dans l'organisation, saisi à l'étape 1 du wizard d'identité KYB.
-- Remplace à l'écran la question du « pouvoir de signature » (décision client du
-- 4 août 2026 : on s'appuie désormais sur les rôles que l'agence connaît déjà).
--
-- POURQUOI UNE COLONNE PROPRE, ET PAS agency_person_roles.role.
-- Cette dernière porte la qualité de CONFORMITÉ ('signatory' | 'ubo') : celle qui
-- décide, au titre de la LBA, qui doit être identifié et blanchi. La colonne
-- ajoutée ici porte le rôle dans l'ORGANISATION (admin | manager | agent |
-- assistant), celui du CRM. Les deux vivent sur la même personne sans se
-- recouvrir — le signataire d'une agence peut être son admin comme son manager —
-- et les confondre ferait dépendre un verdict de conformité d'un réglage produit.
--
-- POURQUOI signature_power N'EST PAS SUPPRIMÉE. Elle est déjà nullable, la console
-- admin l'affiche encore pour les dossiers soumis avant ce jour, et le CHECK
-- agency_person_roles_role_attrs_chk continue de l'interdire aux UBO. Le wizard
-- cesse simplement de la renseigner : rien à migrer, aucune donnée perdue, et le
-- parcours d'avant reste relisible tel qu'il a été saisi.
--
-- Le rôle déclaré ici est appliqué à profiles.role À LA SOUMISSION seulement, par
-- submit_agency_identity() (migration 20260804170100) — jamais par le client, qui
-- n'a aucun droit d'écriture sur cette colonne depuis le verrou anti-escalade de
-- privilèges (20260627120000).
--
-- Idempotente : ADD COLUMN IF NOT EXISTS puis DROP/ADD CONSTRAINT — rejouable même
-- si la colonne existe déjà sans sa contrainte.

alter table public.agency_related_persons
  add column if not exists agency_role text;

alter table public.agency_related_persons
  drop constraint if exists agency_related_persons_agency_role_chk;

alter table public.agency_related_persons
  add constraint agency_related_persons_agency_role_chk
    check (agency_role is null or agency_role in ('admin', 'manager', 'agent', 'assistant'));

comment on column public.agency_related_persons.agency_role is
  'Rôle DÉCLARÉ dans l''organisation (admin|manager|agent|assistant), saisi à l''étape 1 du wizard KYB à la place de l''ancien pouvoir de signature. À ne PAS confondre avec agency_person_roles.role, qui porte la qualité de conformité (signatory|ubo). Appliqué à profiles.role par submit_agency_identity() à la soumission du dossier, sauf s''il retirait à l''agence son dernier administrateur.';
