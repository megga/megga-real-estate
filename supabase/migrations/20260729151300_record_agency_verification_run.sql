-- Étape 4 du chantier KYB, tâche 1 (fix revue, point 2) — rend atomique l'écriture des
-- checks produits par agency-verification-run/index.ts, l'appel du moteur de scoring et
-- la journalisation du PASSAGE de cette même fonction.
--
-- POURQUOI : avant ce correctif, l'Edge Function faisait trois allers-retours
-- PostgREST distincts — insert des checks, RPC recompute_agency_verification(), puis
-- insert de son propre activity_events — donc trois transactions Postgres distinctes.
-- Un échec sur le DERNIER (le journal) laissait le travail réel déjà committé (les
-- checks, ET la décision du moteur, ET l'événement que le moteur journalise lui-même)
-- sans que cette fonction n'ait pu journaliser son propre passage — l'appelant recevait
-- une erreur 500 alors que le dossier avait bien été mis à jour. Le rejeu est sûr (la
-- fonction est idempotente), mais c'est un trou de traçabilité dans le socle même d'un
-- dispositif LAB : un humain qui lit `activity_events` pour reconstituer ce qui s'est
-- passé sur un dossier ne doit jamais pouvoir se fier à une trace incomplète.
--
-- Le dépôt offre déjà le moyen de fermer ce trou : recompute_agency_verification
-- (20260728130000) n'est rien d'autre qu'une fonction PL/pgSQL SECURITY DEFINER qui
-- calcule ET journalise dans la MÊME transaction, précisément parce qu'un appel de
-- fonction PL/pgSQL ne peut pas committer partiellement — soit toute la fonction
-- s'exécute, soit une exception annule tout ce qu'elle a fait, y compris les appels aux
-- fonctions qu'elle invoque elle-même. Cette RPC applique exactement le même principe
-- un niveau au-dessus : elle enveloppe l'insert des checks, l'appel (interne — pas un
-- second aller-retour réseau) à recompute_agency_verification(), et l'insert de CE
-- journal dans une seule transaction. Désormais soit tout est committé — checks,
-- décision du moteur et SES DEUX événements — soit rien ne l'est : il ne peut plus
-- exister d'état intermédiaire où le travail est fait mais invisible dans le journal
-- d'audit.
--
-- Le réseau (lecture de l'agence, appel des connecteurs eux-mêmes) reste dans l'Edge
-- Function, en Deno : une transaction Postgres ne doit jamais rester ouverte en
-- attendant une réponse HTTP externe. Seule la partie 100% base de données — celle qui
-- suit déjà l'exécution des connecteurs — bascule ici.
--
-- Paramètres :
--   p_checks   tableau JSON des lignes produites par runAgencyKybSources() (Deno) —
--              {check_type, source, result, raw_response}. raw_response est désormais
--              TOUJOURS un objet (jamais absent, jamais null — voir _shared/
--              kyb-sources.ts, revue point 1). Tableau vide toléré (registre de
--              connecteurs encore vide à cette tâche) : rien n'est inséré, mais le
--              moteur tourne quand même et le passage est quand même journalisé — même
--              comportement inconditionnel qu'avant ce correctif.
--   p_severity / p_metadata : calculés côté Edge Function (tally des résultats, déjà
--              disponible en mémoire juste après runAgencyKybSources) plutôt que
--              recalculés ici en SQL à partir de p_checks — évite de dupliquer la même
--              logique de comptage dans deux langages pour un simple journal d'audit.
--              Le CHECK constraint de activity_events.severity reste le seul gardien de
--              p_severity, inchangé par cette RPC.
--
-- Idempotente : CREATE OR REPLACE FUNCTION, REVOKE/GRANT rejouables sans effet de bord.

create or replace function public.record_agency_verification_run(
  p_agency_id uuid,
  p_checks jsonb,
  p_severity text,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- 1. Checks produits par les connecteurs — APPEND-ONLY, jamais de delete/update sur
  -- des lignes existantes (même discipline qu'avant ce correctif, voir l'en-tête
  -- d'agency-verification-run/index.ts). jsonb_to_recordset ignore les clés en trop et
  -- met NULL sur les clés absentes ; les CHECK/FK existants sur agency_verification_checks
  -- (check_type, result — 20260728103000) restent le seul gardien de la donnée, inchangés.
  if jsonb_array_length(p_checks) > 0 then
    insert into public.agency_verification_checks (agency_id, check_type, source, result, raw_response)
    select p_agency_id, c.check_type, c.source, c.result, c.raw_response
    from jsonb_to_recordset(p_checks)
      as c(check_type text, source text, result text, raw_response jsonb);
  end if;

  -- 2. Le moteur — appel de FONCTION, pas un aller-retour réseau : reste dans la même
  -- transaction que l'insert ci-dessus. Inconditionnel, comme avant ce correctif : un
  -- dossier déjà vérifié manuellement doit quand même être recalculé même si aucun
  -- check n'a été écrit. recompute_agency_verification journalise déjà SON PROPRE
  -- événement (agency_verification_recomputed) — inchangé par cette RPC.
  perform public.recompute_agency_verification(p_agency_id);

  -- 3. Journal du PASSAGE de agency-verification-run — MÊME transaction que 1 et 2 :
  -- si cet insert échoue (par exemple un p_severity hors du CHECK constraint), TOUT ce
  -- qui précède est annulé avec lui — plus jamais de travail committé sans son journal.
  -- category='kyc', actor_kind='system' impose actor_id NULL
  -- (activity_events_actor_kind_coherence) — c'est cette fonction qui agit, pas un humain.
  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, category, severity, metadata)
  values (
    p_agency_id, null, 'system', 'agency_verification_run', 'agency', p_agency_id,
    'kyc', p_severity, p_metadata
  );
end;
$$;

comment on function public.record_agency_verification_run(uuid, jsonb, text, jsonb) is
  'Enveloppe atomique (étape 4/tâche 1, revue point 2) de l''écriture des checks KYB produits par agency-verification-run, de l''appel à recompute_agency_verification() et de la journalisation du passage de cette même fonction (action=agency_verification_run) — une seule transaction Postgres, jamais trois allers-retours PostgREST distincts. Un échec sur n''importe laquelle des trois étapes annule les autres : plus d''état intermédiaire où le travail est committé sans son journal. service_role uniquement.';

revoke all on function public.record_agency_verification_run(uuid, jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_agency_verification_run(uuid, jsonb, text, jsonb) to service_role;
