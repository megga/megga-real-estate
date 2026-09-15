-- ============================================================================
-- Messagerie : la copie cachée des brouillons (14.09.2026, Julien : « comme Google » —
-- capsules, plusieurs destinataires, Cc, et la boîte d'envoi dans un déroulé).
--
-- Le composeur « Nouveau message » pose désormais Cc ET Cci. `mail_drafts` portait `to`
-- et `cc`, pas `bcc` : un brouillon refermé perdait ses copies cachées, et rouvert puis
-- envoyé, le message partait SANS elles — sans que rien ne le dise.
--
-- Même forme que `to` et `cc` : `[{name, email}]`. Aucune règle neuve : la ligne reste
-- sous `mail_drafts_own` (son auteur seul, sur une boîte qu'il voit).
--
-- IDEMPOTENT (la CI rejoue les migrations du jour) : IF NOT EXISTS.
-- ⚠ DATÉE DU LENDEMAIN : le date-guard de deploy.yml n'applique que `stamp >= jour du
-- déploiement` (UTC). Mergée après le 15.09.2026, elle doit être RENOMMÉE au jour du merge.
-- ⚠ À APPLIQUER AVANT LE DÉPLOIEMENT DE L'ÉCRAN : le composeur écrit `bcc` à chaque
-- brouillon, et PostgREST refuse une colonne qui n'existe pas.
-- ============================================================================

alter table public.mail_drafts add column if not exists bcc jsonb not null default '[]'::jsonb;
