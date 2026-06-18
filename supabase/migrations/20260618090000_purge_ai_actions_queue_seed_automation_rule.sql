-- Assainissement Vague 2 — purge table morte + amorçage table vivante.
--
-- ai_actions_queue : table + helper can_auto_send(uuid,text) du système « Day 0 »
-- jamais livré. Vérifié en prod : 0 ligne, 0 FK entrante, 0 appelant repo/cron,
-- can_auto_send n'est référencé par aucune autre fonction. Le modèle `reminders`
-- (vivant, lu par automation-engine) a remplacé cette file. → DROP.
--
-- automation_rules : table VIVANTE (cron hourly-automation-scan → automation-engine
-- la lit) mais VIDE (0 règle) → la branche automation est du code mort faute de
-- données. On amorce UNE règle par défaut SÛRE pour la prouver vivante :
--   property_sent → create_reminder (rappel INTERNE agent, pas d'envoi client),
--   delay_days=3, auto_send=false (HITL strict). Rien n'est envoyé automatiquement.
--
-- Idempotent + CI-safe : DROP IF EXISTS ; seed gardé sur l'existence de l'agence
-- et l'absence de doublon (no-op en stack fraîche / si déjà amorcé).

drop table if exists public.ai_actions_queue cascade;
drop function if exists public.can_auto_send(uuid, text);

insert into public.automation_rules (agency_id, name, trigger_event, action, delay_days, is_active, auto_send)
select
  'ebec0ad9-e6f0-4bc6-9766-459cf7743cde'::uuid,
  'Relance J+3 après envoi de bien',
  'property_sent', 'create_reminder', 3, true, false
where exists (select 1 from public.agencies where id = 'ebec0ad9-e6f0-4bc6-9766-459cf7743cde')
  and not exists (
    select 1 from public.automation_rules
    where agency_id = 'ebec0ad9-e6f0-4bc6-9766-459cf7743cde'
      and trigger_event = 'property_sent'
      and action = 'create_reminder'
  );
