-- mail_contact_aliases : service_role SEUL (13.09.2026). Même régime que
-- mail_oauth_states et mail_cron_locks (20260904074500 §13).
--
-- ⛔ Le socle (20260904074500) accordait SELECT/INSERT/UPDATE/DELETE à `authenticated`
-- sous une policy `for all` dont le USING ne lit que l'agence. AUCUN client ne lit ni
-- n'écrit cette table : `matchContact` la lit et `linkThreadToContact` l'écrit, tous deux
-- en service-role (_shared/mail/ingest.ts), via mail-sync et mail-actions `link_contact`.
-- Le privilège ne servait qu'à deux fuites :
--   · LECTURE — l'adresse d'un correspondant, son contact, `learned_by` et `created_at`,
--     appris dans une boîte PERSONNELLE, étaient lisibles de toute l'agence : l'adresse
--     que le contrat `mailAuditEvent` a retirée du journal (PR #1304).
--   · ÉCRITURE — un collègue réaffectait l'alias d'un autre (le WITH CHECK n'exigeait que
--     `learned_by` NULL ou lui-même : réaffectation ANONYME) ou le supprimait ; le fil
--     suivant de cette adresse, jusque dans la boîte perso de l'apprenant, se rattachait
--     au mauvais contact, et son `email_received` est append-only.
-- Le « contact de l'agence » du WITH CHECK vit dans l'unique écrivain (`contact_not_in_agency`),
-- et l'adresse apprise doit y être celle d'un correspondant du fil (`email_not_in_thread`).
-- Un futur écran « adresses apprises » passera par une RPC, jamais par un re-GRANT de la table.
--
-- Rejouable (deploy.yml rejoue toute migration du jour à chaque push) : aucun CREATE.
revoke all on table public.mail_contact_aliases from anon, authenticated;
drop policy if exists mail_contact_aliases_agency on public.mail_contact_aliases;
alter table public.mail_contact_aliases enable row level security;
