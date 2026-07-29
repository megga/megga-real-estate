-- Deux ajouts additifs qui préparent le gate d'onboarding (étape 2).
--
-- 1. identity_submitted_at — verification_status répond à « que dit la vérification »
--    et vaut 'pending' dès la création de la ligne : il ne distingue pas « rien n'a
--    été saisi » de « saisi, en attente de traitement ». C'est pourtant cette
--    distinction qui décide si le gate se déclenche. Deux faits, deux colonnes.
--
-- 2. statut 'validated' — l'énumération d'origine ne prévoyait rien pour un dossier
--    validé par un humain après revue. 'auto_validated' mentirait sur l'origine de la
--    décision, et c'est exactement ce qu'un audit LAB regarde. Le moteur ne devra pas
--    plus écraser un 'validated' qu'un 'rejected'.
--
-- Idempotente : ADD COLUMN IF NOT EXISTS, DROP CONSTRAINT IF EXISTS avant ADD.

alter table public.agencies
  add column if not exists identity_submitted_at timestamptz;

comment on column public.agencies.identity_submitted_at is
  'Date à laquelle le dirigeant a terminé la saisie d''identité. NULL = gate d''onboarding actif. Distinct de verification_status, qui porte le verdict et non l''avancement de la saisie.';

alter table public.agencies drop constraint if exists agencies_verification_status_chk;
alter table public.agencies
  add constraint agencies_verification_status_chk
  check (verification_status in
    ('pending', 'auto_validated', 'validated', 'manual_review', 'rejected'));

-- Vue admin des agences qui n'ont jamais soumis (relances). Le gate, lui, lit
-- l'agence par sa clé primaire et n'a besoin d'aucun index.
create index if not exists idx_agencies_identity_never_submitted
  on public.agencies (created_at)
  where identity_submitted_at is null;
