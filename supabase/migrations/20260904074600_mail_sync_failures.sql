-- ============================================================================
-- Messagerie CRM — compteur d'échecs consécutifs de synchronisation.
--
-- POURQUOI. `mail_accounts.status` autorise 'error' depuis le socle
-- (20260904074500_mail_module.sql:97) mais AUCUN chemin de code ne l'écrivait :
-- seule la reconnexion (`reauth_required`) sortait une boîte du balayage. Les
-- cinq autres façons de mourir — 403 Gmail (scope réduit, quota, projet
-- suspendu), 403/429 Graph, pointeur Vault orphelin (`no_secret`), erreur
-- d'ingestion, ligne `imap` non gérée par ce build — écrivaient `last_error` et
-- repartaient pour 10 minutes, indéfiniment. Or `last_error` n'est lu par
-- personne (le lot 2 n'existe pas) : une boîte morte était rigoureusement
-- indiscernable d'une boîte saine sans courrier neuf, tout en brûlant un des 25
-- créneaux du balayage toutes les 10 minutes.
--
-- Le compteur donne à `status` de quoi le dire : `_shared/mail/sync.ts`
-- l'incrémente à chaque échec, le remet à 0 dès qu'une passe aboutit, élargit le
-- backoff en proportion, et bascule `status = 'error'` au 5e échec d'affilée.
-- ⚠ Pas de verdict sur le seul code HTTP : le 403 de Gmail couvre aussi
-- `rateLimitExceeded`, transitoire — un état terminal au premier 403 éteindrait
-- une boîte saine pendant un pic de quota.
--
-- IDEMPOTENT : la CI rejoue toute migration dont le préfixe de date est >= au
-- jour UTC courant (backend.yml « Rejouer les migrations du jour »), et
-- deploy.yml en fait autant à chaque push. `add column if not exists` ; et pour
-- la contrainte, la paire `drop … if exists` PUIS `add` — un bloc `do $$` ne rend
-- rien rejouable (un second `add constraint` lève 42710 dedans comme dehors) et
-- check-migration-idempotence.mjs blanchit les régions dollar-quotées avant de
-- scanner, donc il ne verrait rien.
-- ============================================================================

alter table public.mail_accounts
  add column if not exists sync_failures integer not null default 0;

alter table public.mail_accounts drop constraint if exists mail_accounts_sync_failures_chk;
alter table public.mail_accounts add constraint mail_accounts_sync_failures_chk
  check (sync_failures >= 0);

-- Le SELECT de `mail_accounts` est accordé COLONNE PAR COLONNE (le socle refuse
-- un SELECT de table, qui exposerait `sync_cursor`, `imap_config` et
-- `vault_secret_id`). Sans cette ligne, le lot 2 pourrait afficher `status` sans
-- jamais pouvoir dire depuis combien de passes la boîte échoue.
grant select (sync_failures) on public.mail_accounts to authenticated;

comment on column public.mail_accounts.sync_failures is
  'Échecs de synchronisation consécutifs ; remis à 0 par une passe réussie. Au 5e, _shared/mail/sync.ts bascule status=''error'' et la boîte quitte le balayage.';
