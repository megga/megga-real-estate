-- Le dirigeant dont le dossier part en revue cesse d'etre laisse sans nouvelles.
--
-- LE DEFAUT. La liste blanche du trigger (20260731160000) ecartait 'manual_review' comme un
-- « etat d'attente » dont prevenir ferait du bruit. Le raisonnement tenait tant qu'on croyait
-- l'auto-validation atteignable. L'audit d'onboarding du 01.08.2026 a montre qu'elle ne l'est
-- pour AUCUN dossier, dans AUCUN pays : le veto `id_document` n'accepte que 'match', aucun
-- connecteur ne le produit, et seule admin_resolve_agency_id_document (humaine) le pose. Le
-- passage en revue n'est donc pas un cas de bord, c'est l'ISSUE NORMALE du parcours -- et
-- personne ne prevenait le dirigeant qu'il devait attendre, ni combien de temps, ni de quoi.
--
-- CE QUI NE CHANGE PAS. La detection reste sur la TRANSITION (`is distinct from`), donc une
-- reecriture de la ligne agencies ne renvoie rien ; un dossier deja en manual_review que le
-- moteur recalcule sans changer son statut n'emet rien non plus. 'pending' reste hors liste :
-- c'est l'instant entre la soumission et le premier passage du moteur, quelques centaines de
-- ms -- y notifier ferait deux courriels pour une seule soumission.
--
-- L'edge function n'a AUCUNE modification a recevoir : elle relit le statut en base et
-- appelle isNotifiableStatus, elargie du meme statut dans le meme lot.
--
-- Idempotente : create or replace seul, le trigger reste attache tel quel.

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

  -- Liste BLANCHE. 'pending' reste seul dehors (cf. l'en-tête de cette migration). Un statut
  -- futur n'envoie rien tant que personne n'a écrit ce qu'il faut en dire (même liste que
  -- NOTIFIABLE_STATUSES dans _shared/agency-verification-notice.ts ; l'edge function
  -- revérifie de son côté, donc une divergence entre les deux ne peut produire qu'un appel
  -- sans effet, jamais un courriel qu'aucune des deux n'a voulu).
  if new.verification_status not in
     ('validated', 'auto_validated', 'rejected', 'correction_requested', 'manual_review') then
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
        -- autrement entre-temps.
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
  'Déclenche agency-verification-notify sur toute TRANSITION de agencies.verification_status vers un statut notifiable : validated, auto_validated, rejected, correction_requested, et depuis le 01.08.2026 manual_review (accusé de réception, pas un verdict -- l''audit d''onboarding a montré que le passage en revue est l''issue normale de TOUT dossier, le véto id_document n''ayant aucun connecteur). ''pending'' reste hors liste : c''est l''instant entre la soumission et le premier passage du moteur. Best-effort : un dispatch en échec journalise un warning et ne bloque jamais l''écriture.';

commit;
