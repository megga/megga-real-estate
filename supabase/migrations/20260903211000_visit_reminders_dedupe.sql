-- Rappels de visite : le job horaire cassé est RETIRÉ, et son seul apport est repris par j1.
--
-- Constat du 03.09.2026 (audit de santé). `visit-reminder-hourly` (15 * * * *) construit son
-- appel avec `current_setting('app.settings.supabase_url')` et
-- `current_setting('app.settings.service_role_key')`. Ces GUC N'EXISTENT PAS :
-- `pg_db_role_setting` ne porte que `app.settings.jwt_exp`, et `current_setting()` sans son
-- second argument LÈVE une exception. Le job échoue donc dès qu'une visite entre dans sa
-- fenêtre — il n'a jamais envoyé un seul rappel.
--
-- ⛔ LA CORRECTION ÉVIDENTE — remplacer les GUC par `public.get_app_config(...)` — SERAIT UNE
-- RÉGRESSION, et c'est le point de cette migration. `visit-reminders-j1` (17 * * * *) vise les
-- MÊMES visites avec un prédicat strictement plus large :
--     j1      : status IN ('planned','confirmed'), scheduled_at ∈ [+12 h, +36 h]
--     horaire : status = 'planned',                scheduled_at ∈ [+23 h, +25 h]
-- Réparer le job horaire ne restaurerait donc aucun service : il enverrait un SECOND rappel au
-- client. Les deux tournent à deux minutes d'écart (:15 et :17) et `reminder_sent` n'est posé
-- qu'APRÈS l'envoi par `send-visit-email` — la fenêtre de doublon est grande ouverte.
--
-- Le seul apport réel du job horaire est son critère de destinataire : il accepte une visite
-- dont l'e-mail vient du CONTACT lié, là où j1 exige `buyer_email IS NOT NULL`. Cet apport est
-- repris ci-dessous. C'est sans risque : `send-visit-email` résout déjà ce cas —
-- `to = visit.buyer_email || contact?.email || ''` (send-visit-email/index.ts:154) — et rend
-- 400 « No recipient email » si les deux manquent, sans rien envoyer.

-- 1) Le job cassé disparaît. Il n'a jamais rien produit ; rien ne dépend de lui.
do $$ begin perform cron.unschedule('visit-reminder-hourly'); exception when others then null; end $$;

-- 2) j1 reprend le critère de destinataire élargi. Le reste de la commande est INCHANGÉ.
do $$ begin perform cron.unschedule('visit-reminders-j1'); exception when others then null; end $$;
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('visit-reminders-j1', '17 * * * *', $cron$
  SELECT
    net.http_post(
      url := public.get_app_config('supabase_url') || '/functions/v1/send-visit-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || public.get_app_config('service_role_key')
      ),
      body := jsonb_build_object(
        'type', 'reminder',
        'visit_id', v.id::text,
        'agency_id', v.agency_id::text
      )
    )
  FROM visits v
  WHERE v.status IN ('planned', 'confirmed')
    AND v.reminder_sent = false
    AND v.scheduled_at >= (now() + interval '12 hours')
    AND v.scheduled_at <= (now() + interval '36 hours')
    AND (
      v.buyer_email IS NOT NULL
      OR EXISTS (SELECT 1 FROM contacts c WHERE c.id = v.contact_id AND c.email IS NOT NULL)
    );
$cron$);
  end if;
end $$;
