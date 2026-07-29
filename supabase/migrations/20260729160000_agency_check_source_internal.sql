-- Chantier LINDAS, tâche 1 — la contrainte `source` doit admettre un check CALCULÉ.
--
-- `agency_verification_checks.source` (20260729150300) n'énumère que des tiers : zefix,
-- vies, rdap, mapbox, recherche_entreprises… plus `manual`. Le contrôle de la clé du
-- numéro de registre (registry_number_format, _shared/kyb-sources.ts) ne sort pas du
-- processus : il ne demande ni réseau, ni clé, ni compte. Aucune valeur existante ne le
-- décrit, d'où `internal`.
--
-- POURQUOI PAS `manual` : il désigne une saisie HUMAINE — c'est sous ce nom que la file
-- admin et les tests posent un verdict à la main. Un relecteur qui lirait `manual` sur un
-- check calculé croirait qu'un humain l'a posé, et un véto de conformité changerait alors
-- de nature à ses yeux : « quelqu'un a regardé » au lieu de « la machine a calculé ». Sur
-- une piste d'audit LAB, cette confusion coûte plus cher que la colonne ne rapporte.
--
-- Idempotence : un CHECK est une contrainte de TABLE, `add constraint` seul échouerait au
-- second passage (42710). DROP IF EXISTS + ADD, même motif que
-- 20260729150100_agencies_kyb_columns.sql et 20260630140000_followup_kind_availability.sql
-- — le date-guard de deploy.yml rejoue toute migration datée d'aujourd'hui à CHAQUE push
-- de la journée.
--
-- UN SEUL PROPRIÉTAIRE PAR CONTRAINTE, et c'est la leçon déjà payée par 150100 : la liste
-- ci-dessous doit rester un SUR-ENSEMBLE de celle de 20260729150300. Ce fichier est
-- désormais le dernier à toucher `agency_verification_checks_source_check` ; une valeur
-- retirée ici, alors qu'une ligne réelle la porte, ferait échouer le DROP/ADD sur
-- « check constraint is violated by some row » et bloquerait tout le déploiement.
--
-- Le nom visé est celui que Postgres a généré lui-même : la contrainte est déclarée en
-- ligne dans le `create table` de 150300, donc sans nom explicite — vérifié en base
-- (pg_constraint), jamais supposé.

alter table public.agency_verification_checks
  drop constraint if exists agency_verification_checks_source_check;

alter table public.agency_verification_checks
  add constraint agency_verification_checks_source_check
  check (source in ('zefix', 'uid_register', 'vies', 'recherche_entreprises', 'insee_sirene',
                    'oera_li', 'rdap', 'gleif', 'mapbox', 'cci_immobilier', 'internal', 'manual'));

comment on column public.agency_verification_checks.source is
  'Qui a produit ce check. Tiers interrogé (zefix, vies, rdap, mapbox…), `internal` pour un contrôle calculé sans sortir du processus (clé du numéro de registre), ou `manual` pour une saisie HUMAINE. Ne jamais confondre les deux derniers : sur une piste d''audit LAB, `manual` affirme qu''une personne a tranché.';
