-- La garde d'envoi journalise ses refus (whatsapp_send_blocked) et les échecs Meta
-- (whatsapp_send_failed). Aucune des 9 catégories vivantes après 20260803214105:192-198
-- ne les décrit : 'contact' parle du sujet, 'settings' mentirait. On AJOUTE, on ne tord
-- pas — un audit qui ment est pire qu'un audit absent.
--
-- Les 6 événements WhatsApp existants GARDENT category='contact' : activity_events est
-- append-only, réécrire l'histoire est pire que l'incohérence.
do $$
begin
  alter table public.activity_events drop constraint if exists activity_events_category_check;
  alter table public.activity_events add constraint activity_events_category_check
    check (category = any (array['kyc','deal','contact','bien','doc','auth','settings',
                                 'ai','onboarding','messaging']));
end $$;
