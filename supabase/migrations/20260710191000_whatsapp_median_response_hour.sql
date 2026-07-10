-- whatsapp_median_response_hour — heure médiane de réponse d'un contact (pur SQL).
--
-- Item audit Fable « Relances au timing appris du client » : au lieu de dater les
-- suggestions de suivi à 09:00 par défaut, on apprend l'heure à laquelle le client
-- répond habituellement et on cale la relance dessus.
--
-- Signal = paires out→in : un message ENTRANT (réponse du client) qui suit
-- IMMÉDIATEMENT un message SORTANT dans l'ordre chronologique du fil. On prend
-- l'heure MURALE Europe/Zurich de cette réponse. La médiane de ces heures = le
-- créneau où le contact est le plus réactif.
--
-- Médiane linéaire (percentile_disc) : renvoie une heure RÉELLEMENT observée
-- (0–23), pas une valeur interpolée qui tomberait dans un trou. Cas circulaire
-- (23h/0h) laissé v1 : pour un humain les réponses sont cluster­ées, la médiane
-- linéaire reste dans le cluster.
--
-- Retour : (n = nb de paires, median_hour = heure 0–23, NULL si aucune paire).
-- Le repli (< 5 paires → 09:00) est décidé côté appelant (déterministe, testable).
--
-- Pur lecture, 0 LLM, 0 PII nouvelle. Appelé par le cron whatsapp-process
-- (service_role) uniquement ; pas d'exposition front.

BEGIN;

CREATE OR REPLACE FUNCTION public.whatsapp_median_response_hour(p_contact_id uuid)
RETURNS TABLE(n integer, median_hour integer)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH ordered AS (
    SELECT
      direction,
      lag(direction) OVER (ORDER BY created_at, id) AS prev_direction,
      EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Europe/Zurich'))::int AS local_hour
    FROM public.whatsapp_messages
    WHERE contact_id = p_contact_id
  ),
  responses AS (
    SELECT local_hour
    FROM ordered
    WHERE direction = 'inbound' AND prev_direction = 'outbound'
  )
  SELECT
    count(*)::int                                                    AS n,
    percentile_disc(0.5) WITHIN GROUP (ORDER BY local_hour)::int     AS median_hour
  FROM responses;
$$;

COMMENT ON FUNCTION public.whatsapp_median_response_hour(uuid) IS
  'Heure médiane (Europe/Zurich, 0-23) des réponses entrantes suivant un sortant, pour un contact. Repli <5 paires géré côté appelant (whatsapp-followups).';

-- Seul le cron (service_role) l'appelle. On révoque explicitement anon/authenticated
-- (les default privileges Supabase leur accordent EXECUTE, que REVOKE FROM PUBLIC
-- ne retire pas) — même pattern que resolve_contact_by_phone.
REVOKE ALL ON FUNCTION public.whatsapp_median_response_hour(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_median_response_hour(uuid) TO service_role;

COMMIT;
