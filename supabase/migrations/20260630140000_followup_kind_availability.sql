-- Engagements actionnables — fast-follow : capter les DISPOS CLIENT.
-- « Client: dispo samedi 14h » → suggestion de planification (kind nouveau
-- `client_availability`). On élargit le CHECK de `kind`. DROP IF EXISTS + ADD =
-- idempotent (date-guard deploy.yml ré-applique les migrations du jour).

alter table public.whatsapp_followup_suggestions
  drop constraint if exists whatsapp_followup_suggestions_kind_check;

alter table public.whatsapp_followup_suggestions
  add constraint whatsapp_followup_suggestions_kind_check
  check (kind in ('commitment', 'next_action', 'client_availability'));
