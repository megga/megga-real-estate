-- La fenêtre 24 h de whatsapp_send_allowed filtre normalize_phone(wa_from) sur des lignes
-- contact_id IS NOT NULL. AUCUN index existant ne le couvre :
--   idx_wa_messages_agency_normphone (20260617091000:54) — agency-first ET partiel sur
--     contact_id IS NULL : il EXCLUT le cas nominal.
--   idx_wa_messages_inbound_created  (20260705200000:40) — pas d'ancre d'égalité.
--   idx_wa_messages_wafrom_created   (20260705100000:25) — sur wa_from BRUT, pas normalisé.
-- 20260705200000:27-32 explique pourquoi il n'avait PAS posé cet index (« aucune requête
-- ne filtre normalize_phone sur des lignes contact_id IS NOT NULL »). Cette migration-ci
-- invalide cette prémisse : elle pose l'index et le dit, sinon le prochain audit d'index
-- le supprimera comme poids mort.
begin;
create index if not exists idx_wa_messages_inbound_normphone
  on public.whatsapp_messages (public.normalize_phone(wa_from), created_at desc)
  where direction = 'inbound';
comment on index public.idx_wa_messages_inbound_normphone is
  'Consommateur : whatsapp_send_allowed (fenêtre 24 h + relation d''affaires 30 j). '
  'Chemin CHAUD du webhook : sans lui, seq scan par envoi → statement timeout Pro (3-8 s) '
  'dans un handler qui doit rendre 200 avant que Meta ne rejoue.';
commit;
