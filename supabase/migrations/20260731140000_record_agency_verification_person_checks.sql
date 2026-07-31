-- Étape 7, tâche 4 : record_agency_verification_run accepte enfin des checks de PERSONNE.
--
-- LE DÉFAUT QUE CETTE MIGRATION FERME, ET IL COMMANDAIT TOUT LE RESTE.
-- `pep_sanctions_screening` est déclaré VÉTO de personne dans le catalogue
-- (20260729150300, is_veto = true), et le moteur (20260729151200) exige que chaque
-- signataire actif passe chaque véto de personne, un résultat MANQUANT échouant exactement
-- comme un résultat défavorable :
--
--     where lpc.result is distinct from 'match'   -- capture la ligne ABSENTE (NULL)
--
-- Or aucun chemin de production n'écrivait jamais de ligne pour ce type. Les trois
-- `insert into agency_person_verification_checks` du dépôt étaient tous scopés à
-- 'id_document' (20260729151000, 20260729151400, 20260729151500),
-- admin_resolve_agency_id_document refuse explicitement tout autre type, et CETTE RPC
-- n'écrivait que dans agency_verification_checks, portée agence. La cause profonde était
-- là : les checks de personne n'avaient pas de porte.
--
-- Conséquence mesurée : `veto_failed` était TOUJOURS vrai, donc verification_status valait
-- TOUJOURS 'manual_review', quel que soit le pays, quel que soit le score, quoi qu'un humain
-- tranche sur la pièce d'identité. La branche `auto_validated` était du code mort en
-- production. Les mesures pays par pays du §7bis du handoff affichaient pourtant un
-- `auto_validated` : leur fixture posait ce véto À LA MAIN
-- (tests/backend/agency-verification-run.spec.ts, PERSON_VETO_TYPES en source='manual').
-- Un test qui seede lui-même ce qu'il prétend mesurer ne mesure pas la production.
--
-- LA SIGNATURE S'ÉLARGIT, ET L'ANCIENNE SURCHARGE DOIT DISPARAÎTRE. p_person_checks porte un
-- DÉFAUT ('[]'::jsonb) et se place en dernier, pour que l'appel à quatre arguments continue
-- de résoudre -- c'est ce que fait l'Edge Function déployée aujourd'hui, et un déploiement
-- n'est pas atomique entre la base et les fonctions.
--
-- Mais un défaut ne suffit PAS : `create or replace` ne remplace que la fonction de MÊME
-- signature, donc la version à 4 arguments survivrait à côté de celle à 5, et un appel à 4
-- arguments deviendrait AMBIGU -- PostgREST répond alors `PGRST203`, « could not choose the
-- best candidate function ». Autrement dit, ajouter un paramètre facultatif casse l'appelant
-- existant au lieu de le préserver, exactement l'inverse de l'intention. D'où le DROP
-- explicite ci-dessous, même geste que pour admin_resolve_agency_id_document (20260729151500).
-- Attrapé par le test « l'appel à 4 arguments reste valide », jamais par une relecture.

drop function if exists public.record_agency_verification_run(uuid, jsonb, text, jsonb);
--
-- L'ATOMICITÉ COUVRE LA NOUVELLE PORTÉE, et c'est le point à ne pas rater. Cette RPC existe
-- pour qu'il n'y ait jamais d'état où le travail est committé sans son journal (revue étape
-- 4/tâche 1, point 2). Écrire les checks de personne AILLEURS -- un second aller-retour
-- PostgREST depuis l'Edge Function -- aurait rouvert exactement le trou que cette RPC avait
-- fermé, avec en plus une preuve de conformité committée dont le journal n'aurait rien dit.
-- Ils entrent donc dans la même transaction, entre les checks d'agence et l'appel du moteur.
-- Vérifié par un test qui fait échouer le journal (p_severity hors CHECK) et constate que le
-- check de personne est annulé avec le reste.
--
-- Idempotente : CREATE OR REPLACE FUNCTION, REVOKE/GRANT rejouables.

create or replace function public.record_agency_verification_run(
  p_agency_id uuid,
  p_checks jsonb,
  p_severity text,
  p_metadata jsonb,
  p_person_checks jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- 1. Checks d'AGENCE produits par les connecteurs -- APPEND-ONLY, jamais de delete ni
  -- d'update sur des lignes existantes. jsonb_to_recordset ignore les clés en trop et met
  -- NULL sur les clés absentes ; les CHECK et FK de agency_verification_checks restent le
  -- seul gardien de la donnée.
  if jsonb_array_length(p_checks) > 0 then
    insert into public.agency_verification_checks (agency_id, check_type, source, result, raw_response)
    select p_agency_id, c.check_type, c.source, c.result, c.raw_response
    from jsonb_to_recordset(p_checks)
      as c(check_type text, source text, result text, raw_response jsonb);
  end if;

  -- 2. Checks de PERSONNE (étape 7, tâche 4) -- MÊME transaction, entre les checks d'agence
  -- et le moteur, pour que la garantie atomique de cette RPC couvre la nouvelle portée.
  --
  -- Aucune vérification d'appartenance de related_person_id à p_agency_id ici, et c'est
  -- DÉLIBÉRÉ : cette RPC est réservée au service_role, appelée par une seule Edge Function
  -- qui vient de lire les signataires DE CETTE agence pour composer le tableau. Ajouter une
  -- garde ici donnerait l'illusion d'une frontière de sécurité là où il n'y a pas d'appelant
  -- non fiable, et masquerait que la vraie garantie est en amont. La FK
  -- (agency_person_verification_checks.related_person_id -> agency_related_persons.id)
  -- reste le gardien de l'existence, comme pour la portée agence.
  if jsonb_array_length(p_person_checks) > 0 then
    insert into public.agency_person_verification_checks (related_person_id, check_type, source, result, raw_response)
    select pc.related_person_id, pc.check_type, pc.source, pc.result, pc.raw_response
    from jsonb_to_recordset(p_person_checks)
      as pc(related_person_id uuid, check_type text, source text, result text, raw_response jsonb);
  end if;

  -- 3. Le moteur -- appel de FONCTION, pas un aller-retour réseau : reste dans la même
  -- transaction que les deux inserts ci-dessus, et voit donc les lignes fraîches des DEUX
  -- portées. Inconditionnel : un dossier sans aucun check nouveau doit quand même être
  -- recalculé. recompute_agency_verification journalise déjà son propre événement.
  perform public.recompute_agency_verification(p_agency_id);

  -- 4. Journal du PASSAGE de agency-verification-run -- MÊME transaction que 1, 2 et 3 : si
  -- cet insert échoue (par exemple un p_severity hors du CHECK), TOUT ce qui précède est
  -- annulé avec lui, checks de personne compris. category='kyc' ; actor_kind='system' impose
  -- actor_id NULL (activity_events_actor_kind_coherence) -- c'est cette fonction qui agit.
  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, category, severity, metadata)
  values (
    p_agency_id, null, 'system', 'agency_verification_run', 'agency', p_agency_id,
    'kyc', p_severity, p_metadata
  );
end;
$$;

comment on function public.record_agency_verification_run(uuid, jsonb, text, jsonb, jsonb) is
  'Enveloppe atomique (étape 4/tâche 1, revue point 2 ; élargie à la portée personne par l''étape 7/tâche 4) de l''écriture des checks KYB produits par agency-verification-run, de l''appel à recompute_agency_verification() et de la journalisation du passage (action=agency_verification_run) -- une seule transaction Postgres. p_checks : portée AGENCE (agency_verification_checks). p_person_checks (défaut ''[]'', donc l''appel à 4 arguments reste valide) : portée PERSONNE (agency_person_verification_checks, clé related_person_id) -- c''est cette porte qui manquait, et son absence rendait `pep_sanctions_screening` structurellement inatteignable, donc `veto_failed` toujours vrai et la branche auto_validated morte en production. Aucune garde d''appartenance sur related_person_id : réservée au service_role, appelée par une seule Edge Function qui vient de lire les signataires de cette agence ; la FK reste le gardien de l''existence. Un échec sur n''importe laquelle des quatre étapes annule les autres. service_role uniquement.';

revoke all on function public.record_agency_verification_run(uuid, jsonb, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.record_agency_verification_run(uuid, jsonb, text, jsonb, jsonb) to service_role;
