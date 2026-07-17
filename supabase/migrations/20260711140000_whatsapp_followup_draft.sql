-- Brouillon de relance (WhatsApp) — dans la VOIX de l'agent.
-- Accepter un suivi (accept_followup_suggestion) crée un rappel « nu » : un todo daté,
-- sans texte prêt à envoyer (reminders.message_template = le libellé de l'action,
-- ex. « Relancer le contact »). Ici on ajoute le RÉCEPTACLE d'un brouillon de message
-- CLIENT, rédigé À L'ACCEPTATION par l'edge fn whatsapp-followup-draft en réutilisant le
-- style appris (T1), la voix (few-shot), les corrections (T2) et l'insight du fil.
--
-- La génération est GATÉE derrière la métrique T1 (learned_style.status = 'active') :
-- tant que l'agent n'a pas validé son style appris, le rappel reste nu (colonne null) —
-- on n'écrit pas un brouillon « moyen » avant d'avoir la preuve que T1 est fiable.
-- Human-in-the-loop : le brouillon est une PROPOSITION, jamais envoyée sans l'agent.
--
-- Idempotent (add column if not exists) → re-jouable, date-guard deploy.yml safe.

alter table public.reminders
  add column if not exists draft_message text;

comment on column public.reminders.draft_message is
  'Brouillon de relance client rédigé à l''acceptation d''un suivi WhatsApp (voix de l''agent : T1 + voix + corrections + insight). Gaté T1 (learned_style.status=active). null = rappel nu, aucun brouillon.';
