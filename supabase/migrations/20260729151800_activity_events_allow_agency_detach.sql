-- Le détachement d'agence prévu par la FK devient un cas autorisé du journal
-- append-only. Trouvé en intégrant `main` dans le chantier KYB, le 29.07.2026.
--
-- DEUX GARDES DU DÉPÔT SE CONTREDISAIENT, et depuis ce matin la contradiction est
-- atteignable pour toute agence :
--
--   • `activity_events.agency_id` porte une FK **ON DELETE SET NULL**. C'est un
--     choix délibéré et ancien : un événement d'audit SURVIT à l'agence qu'il
--     concerne, il ne part pas en cascade avec elle. La suppression d'une agence
--     déclenche donc `UPDATE activity_events SET agency_id = NULL`.
--   • `enforce_activity_events_immutability()` (baseline) refuse tout UPDATE hors
--     anonymisation nLPD, et son test exige explicitement
--     `NEW.agency_id IS NOT DISTINCT FROM OLD.agency_id`. Il refuse donc
--     exactement l'écriture que la FK ci-dessus émet elle-même.
--
-- Tant qu'aucune agence ne portait d'événement, personne ne s'en apercevait. La
-- migration `20260729140000_agency_created_event.sql`, mergée sur `main` le
-- 29.07.2026, journalise désormais `agency_created` à CHAQUE création d'agence :
-- toute agence née après elle porte au moins un événement, et devient donc
-- **définitivement non supprimable**. Vérifié en base : la suppression échoue avec
-- « activity_events est append-only (LBA art. 7 al. 1 — intégrité) ».
--
-- Le chemin qui l'a révélé est celui du chantier KYB : un invité reçoit une agence
-- solo à l'inscription (sans quoi il resterait sans agence s'il ne réclamait
-- jamais), et `accept-team-invite` supprime cette agence devenue inutile au moment
-- de la réclamation. La suppression est best-effort et ne fait que journaliser son
-- échec — l'invité rejoint bien sa vraie agence — mais chaque invitation laisse
-- désormais derrière elle une agence orpheline en `verification_status='pending'`.
-- Le défaut n'appartient pas au chantier : il ne fait que l'exposer, étant le seul
-- chemin du dépôt qui supprime une agence.
--
-- POURQUOI ÉLARGIR LE GARDE PLUTÔT QUE RENONCER À SUPPRIMER : ce que la LBA (art. 7
-- al. 1 intégrité, al. 3 conservation dix ans) protège, c'est le CONTENU du
-- journal — qui a fait quoi, quand. Passer `agency_id` à NULL n'efface rien de
-- cela : l'action, l'acteur, l'horodatage, la catégorie, la sévérité et les
-- métadonnées restent intacts et le sont ici explicitement (voir les égalités
-- ci-dessous). Seul le pointeur vers une ligne qui n'existe plus est neutralisé,
-- ce qui est précisément ce que `ON DELETE SET NULL` déclare depuis toujours. Le
-- refuser ne renforce aucune conservation : ça rend une contrainte d'intégrité
-- référentielle inapplicable, et ça immortalise des lignes `agencies` vides.
--
-- Portée volontairement ÉTROITE : seul `agency_id` peut bouger, seulement vers
-- NULL, et seulement si TOUT le reste est inchangé. Une réaffectation d'un
-- événement d'une agence à une autre (NEW.agency_id non NULL) reste refusée, comme
-- avant. La suppression, elle, n'est pas touchée : les dix ans tiennent.
--
-- Idempotente : CREATE OR REPLACE, aucun changement de signature, les deux
-- triggers du baseline continuent de pointer sur cette même fonction.

create or replace function public.enforce_activity_events_immutability()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_age_years NUMERIC;
  v_is_anonymization BOOLEAN;
  v_is_agency_detach BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Cas autorisé 1 : anonymisation nLPD
    -- (actor_id passé à NULL ET actor_kind passé à 'system', tout le reste inchangé)
    v_is_anonymization :=
      (NEW.actor_id IS NULL)
      AND (NEW.actor_kind = 'system')
      AND (NEW.action = OLD.action)
      AND (NEW.entity_type = OLD.entity_type)
      AND (NEW.entity_id IS NOT DISTINCT FROM OLD.entity_id)
      AND (NEW.agency_id IS NOT DISTINCT FROM OLD.agency_id)
      AND (NEW.created_at = OLD.created_at)
      AND (NEW.severity IS NOT DISTINCT FROM OLD.severity)
      AND (NEW.category IS NOT DISTINCT FROM OLD.category);

    IF v_is_anonymization THEN
      -- Marque l'event comme anonymisé via metadata (preuve audit)
      NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'anonymized_at', NOW()::TEXT,
          'anonymized_reason', 'nLPD user deletion'
        );
      RETURN NEW;
    END IF;

    -- Cas autorisé 2 : détachement d'agence émis par la FK ON DELETE SET NULL
    -- (agency_id : une valeur -> NULL, et STRICTEMENT rien d'autre ne bouge).
    -- Le contenu du journal est intégralement préservé ; seul le pointeur vers
    -- l'agence supprimée est neutralisé. Voir l'en-tête de cette migration.
    v_is_agency_detach :=
      (OLD.agency_id IS NOT NULL)
      AND (NEW.agency_id IS NULL)
      AND (NEW.actor_id IS NOT DISTINCT FROM OLD.actor_id)
      AND (NEW.actor_kind IS NOT DISTINCT FROM OLD.actor_kind)
      AND (NEW.action = OLD.action)
      AND (NEW.entity_type = OLD.entity_type)
      AND (NEW.entity_id IS NOT DISTINCT FROM OLD.entity_id)
      AND (NEW.created_at = OLD.created_at)
      AND (NEW.severity IS NOT DISTINCT FROM OLD.severity)
      AND (NEW.category IS NOT DISTINCT FROM OLD.category)
      AND (NEW.metadata IS NOT DISTINCT FROM OLD.metadata);

    IF v_is_agency_detach THEN
      -- Trace du détachement, au même titre que l'anonymisation en pose une : un
      -- relecteur doit pouvoir expliquer pourquoi cet événement ne pointe plus
      -- vers aucune agence, sans avoir à le deviner.
      NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'agency_detached_at', NOW()::TEXT,
          'agency_detached_from', OLD.agency_id::TEXT,
          'agency_detached_reason', 'agency deleted (FK on delete set null)'
        );
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'activity_events est append-only (LBA art. 7 al. 1 — intégrité). Seules l''anonymisation nLPD (actor_id=NULL + actor_kind=system) et le détachement d''agence (agency_id -> NULL, émis par la FK ON DELETE SET NULL) sont autorisés.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_age_years := EXTRACT(EPOCH FROM (NOW() - OLD.created_at)) / (365.25 * 24 * 3600);
    IF v_age_years < 10 THEN
      RAISE EXCEPTION 'Suppression activity_events interdite pendant 10 ans (LBA art. 7 al. 3). Event % a % ans.',
        OLD.id, ROUND(v_age_years, 2);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

comment on function public.enforce_activity_events_immutability() is
  'Journal append-only (LBA art. 7). Deux UPDATE autorisés, et deux seulement : anonymisation nLPD (actor_id -> NULL + actor_kind -> system) et détachement d''agence (agency_id -> NULL, ce que la FK ON DELETE SET NULL émet quand une agence est supprimée). Toute autre modification, et toute suppression avant dix ans, restent refusées.';
