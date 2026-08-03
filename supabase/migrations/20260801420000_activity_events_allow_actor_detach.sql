-- Le détachement d'ACTEUR prévu par la FK devient un cas autorisé du journal
-- append-only. Jumeau exact de 20260729151800_activity_events_allow_agency_detach.sql,
-- pour l'autre FK de la table. Trouvé le 01.08.2026 dans les logs auth.
--
-- LE MÊME PIÈGE, SUR L'AUTRE COLONNE. Le 29.07 on a découvert que la FK
-- `agency_id ON DELETE SET NULL` émettait un UPDATE que le garde d'immutabilité
-- refusait, rendant toute agence ayant journalisé quoi que ce soit
-- indestructible. `actor_id` porte la MÊME clause :
--
--     activity_events.actor_id -> profiles(id)   ON DELETE SET NULL
--     profiles.id              -> auth.users(id) ON DELETE CASCADE
--
-- Supprimer un compte cascade donc sur `profiles`, ce qui déclenche
-- `UPDATE activity_events SET actor_id = NULL` — et le garde refuse. Sa branche
-- « anonymisation nLPD » exige `NEW.actor_kind = 'system'` EN PLUS de
-- `actor_id IS NULL` ; or une FK ne pose qu'une colonne, jamais deux. La
-- condition n'est donc jamais satisfaite par ce chemin-là : elle décrit une
-- écriture applicative, pas celle que la contrainte émet.
--
-- Constaté en production, cinq fois le 01.08.2026 : la suppression d'un compte
-- depuis le tableau de bord Supabase répond 500 avec « activity_events est
-- append-only » dès que ce compte a laissé une trace. Les comptes sans activité,
-- eux, se suppriment — d'où l'apparence d'un défaut intermittent. Tout agent qui
-- a travaillé une journée dans le CRM est aujourd'hui indestructible, ce qui
-- entre en collision frontale avec le droit à l'effacement de la nLPD.
--
-- POURQUOI ÉLARGIR LE GARDE : le raisonnement de la migration jumelle tient mot
-- pour mot. Ce que la LBA (art. 7 al. 1 intégrité, al. 3 conservation dix ans)
-- protège, c'est le CONTENU du journal. Passer `actor_id` à NULL n'efface ni
-- l'action, ni l'horodatage, ni l'entité concernée, ni la catégorie, ni la
-- sévérité, ni les métadonnées : la ligne reste, et reste lisible. Seul le
-- pointeur vers un profil qui n'existe plus est neutralisé — exactement ce que
-- `ON DELETE SET NULL` déclare depuis toujours. Mieux : c'est le résultat que la
-- nLPD demande d'une suppression de compte, obtenu ici par la contrainte plutôt
-- que par un geste applicatif qu'il faudrait penser à faire.
--
-- POURQUOI `actor_kind` NE BOUGE PAS. On aurait pu le forcer à 'system' pour
-- ressembler à l'anonymisation applicative. Ce serait un mensonge d'audit : ce
-- n'est pas le système qui a agi, c'est une personne dont on a perdu le nom.
-- `actor_kind='user'` avec `actor_id IS NULL` dit la vérité — « un agent, non
-- identifiable » — et les surfaces qui lisent `actor_kind` traitent déjà le cas
-- (elles n'affichent un nom que si `actor` est présent). La métadonnée déposée
-- plus bas porte la preuve du détachement, comme pour l'agence.
--
-- Portée volontairement ÉTROITE, plus étroite encore que la branche agence :
-- seul `actor_id` peut bouger, seulement vers NULL, et TOUT le reste doit être
-- inchangé — `object_label` et `ip_address` compris, que les deux branches
-- existantes ne vérifiaient pas. Réattribuer un événement à un autre acteur
-- (NEW.actor_id non NULL) reste refusé. La suppression n'est pas touchée : les
-- dix ans tiennent.
--
-- Rejeu le jour même : `create or replace` sur une fonction déjà remplacée est
-- sans effet de bord, et le corps ci-dessous est la source de vérité (relu par
-- pg_get_functiondef avant écriture, pas recopié d'un fichier de migration qui
-- aurait pu dériver).

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
  v_is_actor_detach BOOLEAN;
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

    -- Cas autorisé 3 : détachement d'ACTEUR, émis par la FK actor_id ON DELETE
    -- SET NULL quand le profil disparaît (lui-même en cascade de auth.users).
    -- Symétrique du cas 2, et volontairement plus strict : object_label et
    -- ip_address doivent eux aussi être inchangés. Une FK ne touche qu'une
    -- colonne — si quoi que ce soit d'autre bouge, ce n'est pas elle qui écrit.
    v_is_actor_detach :=
      (OLD.actor_id IS NOT NULL)
      AND (NEW.actor_id IS NULL)
      AND (NEW.actor_kind IS NOT DISTINCT FROM OLD.actor_kind)
      AND (NEW.agency_id IS NOT DISTINCT FROM OLD.agency_id)
      AND (NEW.action = OLD.action)
      AND (NEW.entity_type = OLD.entity_type)
      AND (NEW.entity_id IS NOT DISTINCT FROM OLD.entity_id)
      AND (NEW.created_at = OLD.created_at)
      AND (NEW.severity IS NOT DISTINCT FROM OLD.severity)
      AND (NEW.category IS NOT DISTINCT FROM OLD.category)
      AND (NEW.object_label IS NOT DISTINCT FROM OLD.object_label)
      AND (NEW.ip_address IS NOT DISTINCT FROM OLD.ip_address)
      AND (NEW.metadata IS NOT DISTINCT FROM OLD.metadata);

    IF v_is_actor_detach THEN
      -- La preuve que la ligne a perdu son acteur, et pourquoi. `actor_detached_from`
      -- garde l'identifiant technique du profil supprimé : il ne désigne plus
      -- personne (la ligne profiles n'existe plus, l'utilisateur auth non plus),
      -- mais il permet de recoller les événements d'une même session lors d'une
      -- revue d'audit.
      NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'actor_detached_at', NOW()::TEXT,
          'actor_detached_from', OLD.actor_id::TEXT,
          'actor_detached_reason', 'profile deleted (FK on delete set null)'
        );
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'activity_events est append-only (LBA art. 7 al. 1 — intégrité). Seules l''anonymisation nLPD (actor_id=NULL + actor_kind=system), le détachement d''agence (agency_id -> NULL) et le détachement d''acteur (actor_id -> NULL), ces deux derniers émis par les FK ON DELETE SET NULL, sont autorisés.';
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
  'Journal append-only (LBA art. 7). Trois UPDATE autorisés, et trois seulement : anonymisation nLPD (actor_id -> NULL + actor_kind -> system), détachement d''agence (agency_id -> NULL) et détachement d''acteur (actor_id -> NULL) — ces deux derniers étant ce que les FK ON DELETE SET NULL émettent quand une agence ou un profil est supprimé. Toute autre modification, et toute suppression avant dix ans, restent refusées.';
