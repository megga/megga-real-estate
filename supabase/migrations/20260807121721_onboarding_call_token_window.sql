-- RGPD, tâche 7 : le jeton d'appel d'accueil cesse de tout dire indéfiniment.
--
-- LE FAIT (constat F4 de l'audit RGPD/PII du 06.08.2026). `manage_token` est un uuid nu :
-- aucune échéance, aucune colonne d'expiration. `get_onboarding_call_by_token` est
-- exécutable par `anon` et rend le nom du réservant, le nom de l'agence, l'hôte, l'horaire
-- et l'URL de réunion.
--
-- Les GESTES, eux, étaient déjà bornés — des deux côtés, et indépendamment :
--   * `can_manage` / `can_reschedule` sont calculés sur `scheduled_at > now()` ;
--   * `onboarding-call-manage` refuse `call_in_past` (index.ts:129) et
--     `call_not_active` (index.ts:128) avant toute écriture.
--
-- C'est donc la seule LECTURE qui ne finissait jamais. Un lien fuité — courriel transféré,
-- historique de navigateur, capture d'écran — restait un oracle permanent sur QUI a réservé,
-- POUR QUELLE AGENCE et QUAND. Un lien de capacité qui survit à ce qu'il permet de faire
-- n'est plus une capacité : c'est une divulgation.
--
-- ── Pourquoi une FENÊTRE et pas une colonne d'expiration ────────────────────────────
--
-- Ajouter `expires_at` obligerait à la poser à la réservation, à la DÉPLACER à chaque
-- replanification (le rendez-vous bouge, le jeton reste), et à ne pas l'oublier à
-- l'annulation. Trois occasions de désynchroniser une donnée dérivable. `scheduled_at`
-- porte déjà la seule date qui compte, et suit la replanification tout seul.
--
-- SEPT JOURS APRÈS LE RENDEZ-VOUS. Assez pour qu'un lien ouvert le lendemain de l'appel ne
-- tombe pas dans le vide, et pour qu'une annulation reste consultable ; assez court pour
-- qu'un lien de l'an dernier ne dise plus rien. Au-delà, la fonction ne rend RIEN — pas
-- une erreur distincte, pas un « expiré » : exactement ce qu'elle rend déjà pour un jeton
-- inconnu (cf. L6 de tests/backend/onboarding-call-loop.spec.ts). Distinguer les deux
-- apprendrait à un tiers qu'un jeton A EXISTÉ, ce qui est déjà une information.
--
-- L'écran public dégrade proprement : `OnboardingCallManagePage` rend déjà la carte
-- `call.public.invalid.*` sur `!call.data` (ligne 125), sans distinguer le motif.
--
-- ⚠ Ceci NE remplace PAS la lecture CRM. L'agence voit son appel par RLS
-- (`onboarding_calls_select_own_agency`), qui ne dépend d'aucun jeton et n'est pas touchée :
-- l'historique reste entier côté agent, seule la porte PUBLIQUE se referme.
--
-- Idempotente : `create or replace`, signature et type de retour inchangés (pas de 42P13),
-- privilèges réaffirmés à l'identique.

create or replace function public.get_onboarding_call_by_token(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', c.id,
    'scheduled_at', c.scheduled_at,
    'duration_minutes', c.duration_minutes,
    'status', c.status,
    'host_name', c.host_display_name,
    'host_timezone', h.timezone,
    'meeting_url', case when c.status = 'confirmed' then c.meeting_url else null end,
    'attendee_name', p.full_name,
    'agency_name', a.name,
    'rescheduled_count', c.rescheduled_count,
    -- La même règle est appliquée côté serveur à l'écriture ; celle-ci ne sert qu'à
    -- ne pas proposer un geste qui sera refusé.
    'can_manage', (c.status = 'confirmed' and c.scheduled_at > now()),
    'can_reschedule', (c.status = 'confirmed' and c.scheduled_at > now() and c.rescheduled_count < 3)
  )
  from public.onboarding_calls c
  join public.onboarding_hosts h on h.id = c.host_id
  left join public.profiles p on p.id = c.booked_by
  left join public.agencies a on a.id = c.agency_id
  where p_token is not null
    and c.manage_token = p_token
    -- LA FENÊTRE. Sept jours après le rendez-vous, le jeton ne dit plus rien — même
    -- réponse vide qu'un jeton inconnu. Dérivée de `scheduled_at`, donc elle suit
    -- automatiquement une replanification.
    and c.scheduled_at > now() - interval '7 days'
$$;

comment on function public.get_onboarding_call_by_token(uuid) is
  'Lecture publique d''un appel d''accueil par jeton de capacité. BORNÉE à 7 jours après scheduled_at (tâche 7 RGPD, 07.08.2026) : au-delà, réponse vide, indistinguable d''un jeton inconnu — distinguer apprendrait qu''un jeton a existé. Les gestes étaient déjà bornés par can_manage/can_reschedule et par onboarding-call-manage ; seule la lecture ne finissait jamais.';

revoke all on function public.get_onboarding_call_by_token(uuid) from public;
grant execute on function public.get_onboarding_call_by_token(uuid) to anon, authenticated, service_role;
