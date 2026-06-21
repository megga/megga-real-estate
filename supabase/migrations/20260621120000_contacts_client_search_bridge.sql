-- Pont matching : contacts.search_criteria → client_searches
--
-- Problème (pré-vol pilote Phase 3) : le CRM écrit les critères de recherche
-- acheteur dans `contacts.search_criteria`, mais le moteur `matching-engine`
-- lit EXCLUSIVEMENT la table `client_searches`. Aucun pont n'existait (seul le
-- pipeline WhatsApp alimentait `client_searches`). Conséquence : un acheteur
-- saisi à la main dans le CRM ne générait JAMAIS de match (boucle morte, dans
-- les deux sens : scan acheteur ET scan d'un nouveau bien interne).
--
-- Les deux structures de critères ont la MÊME forme (type, zones[], budget_min/max,
-- rooms_min/max, surface_min, features[], transaction_type) que le moteur consomme
-- déjà génériquement → simple matérialisation, aucun re-mapping.
--
-- SECURITY DEFINER : le trigger doit réussir quel que soit le contexte d'écriture
-- du contact (agent authentifié, service-role WhatsApp, insert anon d'onboarding).
-- La policy INSERT de client_searches (`agency_id = get_user_agency_id()`) rejetterait
-- un insert anon/sans agence → on bypasse via DEFINER, en n'écrivant que des données
-- de confiance issues de la ligne NEW (agency_id + contact_id du contact lui-même).
-- search_path figé (anti-hijack, advisor function_search_path_mutable).
--
-- Pas de contrainte UNIQUE(contact_id) ajoutée : l'index existant est non-unique et
-- le pipeline WhatsApp peut créer plusieurs recherches par contact. On fait donc un
-- upsert MANUEL (UPDATE puis INSERT-si-absent) plutôt qu'un ON CONFLICT.

create or replace function public.sync_contact_client_search()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
begin
  if NEW.search_criteria is not null
     and jsonb_typeof(NEW.search_criteria) = 'object'
     and NEW.search_criteria <> '{}'::jsonb
     and NEW.agency_id is not null then

    v_label := coalesce(
      nullif(btrim(coalesce(NEW.first_name, '') || ' ' || coalesce(NEW.last_name, '')), ''),
      'Recherche'
    );

    update public.client_searches
       set criteria   = NEW.search_criteria,
           agency_id  = NEW.agency_id,
           label      = v_label,
           is_active  = true,
           updated_at = now()
     where contact_id = NEW.id;

    if not found then
      insert into public.client_searches (agency_id, contact_id, label, criteria, is_active)
      values (NEW.agency_id, NEW.id, v_label, NEW.search_criteria, true);
    end if;

  else
    -- Critères vidés (ou contact sans agence) → on DÉSACTIVE la recherche associée
    -- au lieu de la supprimer, pour préserver l'historique et toute recherche créée
    -- en parallèle par le pipeline WhatsApp.
    update public.client_searches
       set is_active  = false,
           updated_at = now()
     where contact_id = NEW.id
       and is_active = true;
  end if;

  return NEW;
end;
$$;

-- Fonction de trigger : pas une surface RPC. On retire l'EXECUTE par défaut à
-- public/anon/authenticated (le trigger s'exécute indépendamment des privilèges).
revoke execute on function public.sync_contact_client_search() from public;
revoke execute on function public.sync_contact_client_search() from anon;
revoke execute on function public.sync_contact_client_search() from authenticated;

drop trigger if exists trg_sync_contact_client_search on public.contacts;
create trigger trg_sync_contact_client_search
  after insert or update of search_criteria, agency_id, first_name, last_name
  on public.contacts
  for each row
  execute function public.sync_contact_client_search();

-- Backfill idempotent : matérialise une recherche pour les contacts existants à
-- critères non vides qui n'en ont pas encore (ne touche pas celles créées par
-- WhatsApp). Re-jouable sans duplication grâce au NOT EXISTS.
insert into public.client_searches (agency_id, contact_id, label, criteria, is_active)
select c.agency_id,
       c.id,
       coalesce(nullif(btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), ''), 'Recherche'),
       c.search_criteria,
       true
from public.contacts c
where c.search_criteria is not null
  and jsonb_typeof(c.search_criteria) = 'object'
  and c.search_criteria <> '{}'::jsonb
  and c.agency_id is not null
  and not exists (
    select 1 from public.client_searches cs where cs.contact_id = c.id
  );
