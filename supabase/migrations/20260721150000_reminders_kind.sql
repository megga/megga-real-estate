-- Pipeline v2 (Sugar Pure) : `kind` = nature UI de la prochaine action d'un deal
-- (icône + libellé : call/visit/kyc/match/offer/note). Distinct de `type`, qui reste
-- le concept AUTOMATION (dédup radar par (contact, type), détecteurs, templates).
-- Nullable : seules les surfaces pipeline l'écrivent ; les lignes historiques et
-- les détecteurs automation n'en posent pas — le front retombe alors sur un
-- mapping statique type→kind (REMINDER_KIND_BY_TYPE, src/lib/sugarAdapters.ts).

BEGIN;

ALTER TABLE public.reminders ADD COLUMN kind text
  CONSTRAINT reminders_kind_check
  CHECK (kind IN ('call', 'visit', 'kyc', 'match', 'offer', 'note'));

COMMENT ON COLUMN public.reminders.kind IS
  'Nature UI de la prochaine action pipeline (call/visit/kyc/match/offer/note). NULL = dérivée de type côté front.';

COMMIT;
