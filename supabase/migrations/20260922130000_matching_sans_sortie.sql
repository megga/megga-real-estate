-- ══════════════════════════════════════════════════════════════════════════════
-- Le matching reste chez l'agent : rien ne sort plus vers l'acheteur (21.09.2026)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Conception : docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md.
-- Décision de Julien : « le matching doit exclusivement rester à l'agent ».
--
-- Mesuré en production le 21.09.2026 : 0 lien de réception jamais créé, 0 match
-- envoyé, 0 événement d'envoi. Retirer la table ne perd aucune donnée.
--
-- 1. La page publique de réception, ses fonctions serveur et leur table partent.
--    `record_buyer_reaction` était le seul écrivain de `matches.status` côté
--    acheteur ; l'agent consigne désormais la réponse lui-même (les triggers
--    `set_match_response_at` et `log_match_reaction` restent et le tracent).
-- 2. `sent_via` gagne 'agent' : « je l'ai proposé » est un geste de l'agent, pas
--    un envoi. Les valeurs historiques restent acceptées.
--
-- Relevé avant d'écrire (21.09.2026) : aucun autre objet SQL ne lit la table. Seules
-- trois migrations la citent — sa création (20260707120000), son retrait par l'agent
-- (20260802231604, qui redéfinit `record_buyer_reaction` et crée `revoke_reception_link`)
-- et la révocation des droits d'`anon` (20260802223756) ; 20260803090000 ne nomme
-- `record_buyer_reaction` qu'en commentaire. Aucune vue, aucune clé étrangère, aucune
-- publication Realtime, aucun job pg_cron. Et aucune fonction ne lit les VALEURS de
-- `sent_via` : 'agent' n'a besoin que du CHECK.
--
-- ⚠ `drop table` SANS `cascade`, volontairement : si la production portait un objet
-- dépendant que le dépôt ignore, la migration doit échouer en le nommant plutôt que
-- l'emporter en silence. Les deux fonctions tombent AVANT la table : leur corps PL/pgSQL
-- la cite sans en dépendre, mais les laisser survivre donnerait deux RPC qui lèvent
-- « relation does not exist » au premier appel.
--
-- ⚠ DATE-GUARD (`deploy.yml`) : appliquée seulement si son horodatage est ≥ au
-- jour UTC de la fusion. Renommer au jour de la fusion si elle a lieu plus tard.

begin;

drop function if exists public.record_buyer_reaction(uuid, uuid, text, text, text);
drop function if exists public.revoke_reception_link(uuid);
drop table if exists public.buyer_reception_links;

alter table public.matches drop constraint if exists matches_sent_via_check;
alter table public.matches add constraint matches_sent_via_check
  check (sent_via = any (array['email'::text, 'whatsapp'::text, 'both'::text, 'reception'::text, 'agent'::text]));

comment on column public.matches.sent_via is
  'Comment le bien a été proposé. ''agent'' : l''agent l''a présenté lui-même et l''a consigné (seule valeur écrite depuis le 21.09.2026). email / whatsapp / both / reception : valeurs historiques, le CRM n''envoie plus rien à l''acheteur.';

commit;
