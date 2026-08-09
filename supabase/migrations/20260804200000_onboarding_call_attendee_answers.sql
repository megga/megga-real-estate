-- Réponses du formulaire de réservation de l'appel d'accueil.
--
-- POURQUOI UNE COLONNE JSONB ET NON DES COLONNES TYPÉES. Ces réponses ne sont pas
-- encore un modèle : la liste des questions est provisoire (arbitrage produit en
-- attente), et chacune est un CHOIX déclaré par l'agent, jamais une mesure. Leur
-- donner une colonne chacune figerait un schéma que la première itération changera,
-- et imposerait une migration à chaque question ajoutée ou retirée.
--
-- Ce qui y entre : l'identité confirmée au formulaire (`first_name`, `last_name`,
-- `email` — la personne peut corriger le préremplissage) et les réponses de
-- calibration (`portfolio`, `business`, `team`, `priority`, `cantons`). Le numéro
-- WhatsApp, lui, garde sa colonne `attendee_phone` : il est utilisé par l'envoi, pas
-- seulement lu par un humain.
--
-- ⚠ Rien ici n'alimente le scoring. `attendee_answers` est une note de préparation
-- d'appel et une base de calibration à venir, pas une entrée du moteur — l'y brancher
-- se décidera, se documentera et se testera séparément.

alter table public.onboarding_calls
  add column if not exists attendee_answers jsonb;

comment on column public.onboarding_calls.attendee_answers is
  'Réponses du formulaire de réservation (identité confirmée + calibration). '
  'Déclaratif, provisoire, hors scoring. Écrit par onboarding-call-book.';
