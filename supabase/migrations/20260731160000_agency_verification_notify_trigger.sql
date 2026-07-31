-- Étape 7, tâche 6 : une décision sur un dossier KYB prévient l'agence.
--
-- LE DÉFAUT. Ni une validation ni un rejet n'émettait quoi que ce soit. Resend est dans la
-- pile depuis longtemps et n'était appelé par aucun chemin KYB. L'agence découvrait la
-- décision en se reconnectant et en lisant le bandeau. Deux conséquences, et la seconde est
-- la vraie : une agence validée ignorait qu'elle pouvait désormais travailler, et une agence
-- à qui l'on demandait une CORRECTION ignorait QUOI corriger. Le motif est obligatoire côté
-- RPC précisément pour être actionnable, et il ne l'est que s'il atteint son destinataire.
--
-- POURQUOI UN TRIGGER PLUTÔT QU'UN APPEL DEPUIS L'ÉCRAN DE REVUE. Un appel depuis la console
-- admin après chaque décision serait skippable : un onglet fermé entre les deux appels, et la
-- décision est prise sans que personne ne l'apprenne. Le trigger attrape TOUTES les
-- transitions -- les quatre décisions humaines, la décision du moteur (auto_validated), et
-- toute décision future -- sans que la RPC correspondante ait à y penser. C'est aussi ce qui
-- évite de recopier trois RPC pour y ajouter le même bloc de dispatch.
--
-- POURQUOI IL N'ENVOIE PAS LE MOTIF. Deux raisons, la seconde décisive :
--   1. les RPC écrivent leur activity_events APRÈS l'UPDATE de agencies, donc au moment où ce
--      trigger part, l'événement qui porte le motif n'existe pas encore ;
--   2. le corps d'un net.http_post vit en clair dans net.http_request_queue. Y faire transiter
--      un texte qui décrit pourquoi une identité a été refusée serait une seconde copie de
--      donnée de conformité, hors du registre des traitements.
--   L'edge function relit donc le motif elle-même, après le commit -- le worker pg_net traite
--   la file de façon asynchrone, l'événement y est.
--
-- BEST-EFFORT À DEUX NIVEAUX, comme le déclenchement de agency-verification-run depuis
-- submit_agency_identity : `net.http_post` met la requête en file sans l'attendre, et le
-- `exception when others` garantit qu'un échec de dispatch ne fait jamais échouer la décision
-- elle-même. Une décision de conformité ne doit pas dépendre d'un courriel.
--
-- Idempotente : CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS avant CREATE.

begin;

create or replace function public.agencies_notify_verification_decision()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_base_url text;
  v_svc_key  text;
begin
  -- Une TRANSITION, jamais un état. Sans le `is distinct from`, toute écriture sur la ligne
  -- agencies d'une agence déjà validée renverrait le courriel -- un changement d'adresse
  -- ferait re-annoncer une validation vieille de six mois.
  if new.verification_status is not distinct from old.verification_status then
    return new;
  end if;

  -- Liste BLANCHE. 'pending' et 'manual_review' sont des états d'attente : prévenir à chaque
  -- passage du moteur ferait du bruit sans information. Un statut futur n'envoie rien tant
  -- que personne n'a écrit ce qu'il faut en dire (même liste que NOTIFIABLE_STATUSES dans
  -- _shared/agency-verification-notice.ts ; l'edge function revérifie de son côté, donc une
  -- divergence entre les deux ne peut produire qu'un appel sans effet, jamais un courriel
  -- qu'aucune des deux n'a voulu).
  if new.verification_status not in ('validated', 'auto_validated', 'rejected', 'correction_requested') then
    return new;
  end if;

  v_base_url := public.get_app_config('supabase_url');
  v_svc_key  := public.get_app_config('service_role_key');

  if v_base_url is not null and v_base_url <> '' and v_svc_key is not null and v_svc_key <> '' then
    begin
      perform net.http_post(
        url := v_base_url || '/functions/v1/agency-verification-notify',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_svc_key
        ),
        -- Le statut voyage à titre indicatif : l'edge function le RELIT en base, parce que le
        -- worker pg_net traite la file avec du retard et qu'un second relecteur a pu trancher
        -- autrement entre-temps. Notifier l'état d'avant enverrait une bonne nouvelle à une
        -- agence qui vient d'être refusée.
        body := jsonb_build_object('agency_id', new.id, 'status', new.verification_status),
        timeout_milliseconds := 15000
      );
    exception when others then
      raise warning 'agencies_notify_verification_decision: dispatch echoue pour %: %', new.id, sqlerrm;
    end;
  end if;

  return new;
end;
$$;

comment on function public.agencies_notify_verification_decision() is
  'Étape 7, tâche 6 : déclenche agency-verification-notify quand verification_status ENTRE dans un état décidé (validated, auto_validated, rejected, correction_requested). Sur la TRANSITION, jamais sur l''état : sans cela, toute écriture sur la ligne d''une agence déjà validée renverrait le courriel. Dans un trigger et non depuis l''écran de revue, parce qu''un appel côté client serait skippable (onglet fermé entre les deux appels) et qu''il faudrait le répéter dans chaque RPC de décision. N''envoie PAS le motif : les RPC écrivent leur activity_events APRÈS cet UPDATE (il n''existe pas encore), et le corps d''un net.http_post vit en clair dans net.http_request_queue -- l''edge function le relit elle-même après le commit. Best-effort à deux niveaux : net.http_post ne bloque pas, et un échec de dispatch ne fait jamais échouer la décision.';

drop trigger if exists agencies_notify_verification_decision_trg on public.agencies;
create trigger agencies_notify_verification_decision_trg
  after update of verification_status on public.agencies
  for each row
  execute function public.agencies_notify_verification_decision();

commit;
