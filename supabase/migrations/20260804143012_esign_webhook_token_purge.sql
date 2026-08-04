-- Efface les jetons de callback e-signature des demandes déjà closes.
--
-- CONSTAT (audit signatures webhooks du 03.08.2026, §4.3). Le `webhook_token`
-- d'`esign-webhook` voyage dans la QUERY STRING de l'URL de callback — ni
-- Skribble ni DocuSign n'acceptent d'en-tête personnalisé sur leurs URL de
-- notification, ce n'est donc pas un choix. Une URL se retrouve dans les
-- journaux d'accès du provider, de Cloudflare et de Supabase.
--
-- Le jeton n'expirait jamais et n'était jamais nettoyé après finalisation : un
-- identifiant valide à vie, disséminé dans des journaux, pour des demandes
-- signées il y a des mois.
--
-- Le correctif de code efface désormais le jeton à la clôture (esign-finalize,
-- `isRequestSettled`). Cette migration fait le rattrapage sur l'existant — sans
-- elle, tout ce qui est déjà signé garde son jeton indéfiniment.

-- Même prédicat que `isRequestSettled` côté TypeScript, et que le court-circuit
-- d'esign-webhook : PDF archivé, demande retirée, ou demande refusée. Volontai-
-- rement PLUS ÉTROIT que l'ensemble des statuts terminaux — `expired` et `error`
-- peuvent encore recevoir un callback utile, et leur retirer le jeton ferait
-- répondre 401 à un provider qui boucle sur les non-2xx.
update public.signature_requests
   set webhook_token = null
 where webhook_token is not null
   and (signed_document_path is not null or status in ('withdrawn', 'declined'));

-- Idempotente par nature : au rejeu, `webhook_token is not null` ne matche plus
-- rien. deploy.yml rejoue toute migration du jour à chaque push.
