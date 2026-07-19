-- Durcit deux triggers SECURITY DEFINER qui écrivent dans le journal d'audit.
--
-- Suite de l'audit RLS anon (#889) et de l'issue #891. Le pont anon est déjà fermé :
-- depuis #889, `contact_messages` n'est insérable que par super_admin (policy
-- contact_messages_super_admin_all) ou service_role (qui contourne la RLS). Ce qui
-- suit est de la défense en profondeur — on neutralise le MÉCANISME, pas seulement
-- la porte d'entrée, pour qu'un futur producteur ne réarme pas le même piège.
--
-- Les deux fonctions sont recréées via CREATE OR REPLACE, donc rejouables : le
-- workflow de deploy réapplique toute migration horodatée >= aujourd'hui (UTC), et
-- une migration non idempotente bloque le déploiement toute la journée (leçon #894).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. notify_new_contact_message() — borner et nettoyer le texte non authentifié
-- ─────────────────────────────────────────────────────────────────────────────
-- La fonction concaténait `new.name` (jusqu'à 120 car.) et `new.subject` (jusqu'à
-- 200 car.) TELS QUELS dans object_label, et les recopiait dans metadata avec
-- l'e-mail. Ces valeurs viennent d'un formulaire public : elles peuvent contenir
-- des sauts de ligne et des caractères de contrôle qui cassent la lecture du
-- journal, et la ligne produite atterrit dans `activity_events`, table IMMUABLE
-- (triggers enforce_activity_events_immutability, rétention LBA 10 ans) — donc
-- sans chemin d'effacement par les voies normales.
--
-- Deux bornes ajoutées, appliquées à object_label ET à metadata :
--   · suppression des caractères de contrôle (sauts de ligne, tabulations, etc.)
--     et écrasement des espaces multiples ;
--   · troncature à 80 car. pour le nom et 120 pour le sujet.
-- Le libellé reste ainsi <= ~233 caractères, cohérent avec le maximum réellement
-- observé en base (235) — on ne dégrade aucun cas d'usage existant.
CREATE OR REPLACE FUNCTION public.notify_new_contact_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  -- Nettoyage : caractères de contrôle -> espace, espaces multiples écrasés,
  -- puis troncature. `left()` est sûr sur NULL (renvoie NULL).
  v_name    text := nullif(btrim(regexp_replace(regexp_replace(coalesce(new.name, ''),    '[[:cntrl:]]+', ' ', 'g'), '\s{2,}', ' ', 'g')), '');
  v_subject text := nullif(btrim(regexp_replace(regexp_replace(coalesce(new.subject, ''), '[[:cntrl:]]+', ' ', 'g'), '\s{2,}', ' ', 'g')), '');
  v_label   text;
begin
  if new.source is distinct from 'storefront' then
    return new;
  end if;

  v_name    := left(v_name, 80);
  v_subject := left(v_subject, 120);

  v_label := 'Nouveau message de contact'
    || case when v_name is not null then ' · ' || v_name else '' end
    || case when v_subject is not null then ' · ' || v_subject else '' end;

  insert into public.activity_events (
    agency_id, actor_id, actor_kind, action, entity_type, entity_id,
    category, severity, object_label, metadata
  ) values (
    null, null, 'system', 'contact_message_received', 'contact_message', new.id,
    null, 'info', v_label,
    -- metadata reçoit les mêmes valeurs assainies. `email` est borné par le CHECK
    -- de format de la table ; on le tronque quand même par prudence.
    jsonb_build_object(
      'source',  left(new.source, 60),
      'subject', v_subject,
      'email',   left(new.email::text, 160),
      'name',    v_name
    )
  );
  return new;
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. bump_contact_last_interaction() — exiger l'attribution au tenant
-- ─────────────────────────────────────────────────────────────────────────────
-- L'UPDATE portait `AND (NEW.agency_id IS NULL OR c.agency_id = NEW.agency_id)`.
-- La branche `NEW.agency_id IS NULL` DÉSACTIVE le filtre d'agence : tout événement
-- sans agence portant un `metadata->>'contact_id'` valide pouvait rafraîchir le
-- `last_interaction_at` d'un contact de N'IMPORTE QUELLE agence — donc sortir un
-- lead concurrent de sa file de relance.
--
-- Inerte aujourd'hui, et mesuré avant de resserrer : sur 10 événements à
-- agency_id NULL en base (contact_message_received, rls_hardening_applied,
-- role_changed, seller_lead_received), ZÉRO ne porte de contact_id. Exiger
-- l'attribution ne change donc aucun comportement existant.
--
-- Après ce changement, un bump exige un événement attribué à une agence. Un futur
-- producteur d'événements système qui voudra rafraîchir la recency devra poser
-- `agency_id` — ce qui est la bonne contrainte, pas une régression.
CREATE OR REPLACE FUNCTION public.bump_contact_last_interaction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_contact uuid;
  v_raw     text;
BEGIN
  IF NEW.entity_type = 'contact' THEN
    v_contact := NEW.entity_id;
  ELSE
    v_raw := NEW.metadata->>'contact_id';
    -- Garde UUID STRICTE : un cast d'une valeur malformée lèverait 22P02 et
    -- ferait rollback de l'INSERT source (même transaction). Leçon CI contact_scoring.
    IF v_raw ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
      v_contact := v_raw::uuid;
    END IF;
  END IF;

  IF v_contact IS NULL THEN
    RETURN NEW;
  END IF;

  -- Un bump doit être attribué à une agence : sans agency_id sur l'événement, on
  -- ne peut pas prouver que l'appelant a le droit de toucher ce contact.
  IF NEW.agency_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Ne PAS rafraîchir la recency sur une bascule de deal MORT / EN PAUSE : perdre,
  -- annuler ou suspendre un deal n'est pas « rester en contact » avec le lead —
  -- sinon le contact sortirait à tort de la file de relance (lead-cooling /
  -- automation-engine) pendant la fenêtre de dormance. Les AVANCÉES de pipeline
  -- restent un touch (décision « tout-touch incl. geste deal »).
  IF NEW.action = 'stage_change' AND (NEW.metadata->>'new_stage') = 'lost' THEN
    RETURN NEW;
  END IF;
  IF NEW.action = 'status_change' AND (NEW.metadata->>'new_status') IN ('cancelled', 'on_hold') THEN
    RETURN NEW;
  END IF;

  UPDATE public.contacts c
     SET last_interaction_at = GREATEST(COALESCE(c.last_interaction_at, '-infinity'::timestamptz), NEW.created_at)
   WHERE c.id = v_contact
     AND c.agency_id = NEW.agency_id;

  RETURN NEW;
END;
$function$;
