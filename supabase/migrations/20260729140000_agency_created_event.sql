-- `agency_created` : un producteur unique pour les trois chemins de création.
--
-- La console admin sait nommer, iconifier et colorer `agency_created` depuis des
-- mois, mais `activity_events` n'en contient aucun : sur les TROIS fonctions qui
-- créent une agence, une seule journalisait — `admin_create_agency`, qui n'a
-- jamais été appelée en production. Les deux qui tournent vraiment
-- (`provision_solo_agency` au signup, `create_agency_and_join` pour une équipe)
-- restaient muettes. Le seul signal de croissance de la plateforme n'existait pas.
--
-- Le producteur devient un TRIGGER sur la table plutôt qu'un insert recopié dans
-- chaque fonction. C'est précisément l'oubli qui a créé ce trou : trois chemins,
-- une seule émission. Un trigger couvre aussi le quatrième chemin que quelqu'un
-- écrira un jour sans penser à l'audit.
--
-- Le contexte que seule la fonction appelante connaît (note libre de l'admin,
-- création par un super-admin) transite par un réglage LOCAL à la transaction,
-- lu par le trigger. C'est ce qui permet de supprimer l'insert de
-- `admin_create_agency` sans perdre son `p_note` — un paramètre silencieusement
-- ignoré vaudrait moins qu'un paramètre supprimé.

BEGIN;

CREATE OR REPLACE FUNCTION public.audit_agency_created() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $agency$
DECLARE
  -- Réglage LOCAL (troisième argument `true` côté set_config) : il retombe à
  -- NULL en fin de transaction, donc aucune fuite d'un appel sur le suivant.
  v_ctx jsonb := COALESCE(
    NULLIF(current_setting('megga.agency_create_ctx', true), '')::jsonb,
    '{}'::jsonb
  );
BEGIN
  INSERT INTO activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id,
     category, severity, object_label, metadata)
  VALUES (
    NEW.id,
    NEW.created_by,
    -- Contrainte `activity_events_actor_kind_coherence` : un actor_id non nul
    -- impose actor_kind = 'user'. Sans créateur connu (backfill, script), c'est
    -- la plateforme qui agit.
    CASE WHEN NEW.created_by IS NULL THEN 'system' ELSE 'user' END,
    'agency_created',
    'agency',
    NEW.id,
    'settings',
    -- `info` et non `warn` : une agence qui arrive est une bonne nouvelle, pas
    -- un incident. La console la fait remonter par une règle explicite plutôt
    -- qu'en gonflant sa gravité (cf. useAdminStats).
    'info',
    NEW.name,
    jsonb_build_object(
      'plan', NEW.plan,
      'solo', NEW.solo,
      'city', NEW.city,
      'canton', NEW.canton
    ) || v_ctx
  );
  RETURN NEW;
END;
$agency$;

DROP TRIGGER IF EXISTS trg_agency_created ON public.agencies;
CREATE TRIGGER trg_agency_created
  AFTER INSERT ON public.agencies
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_agency_created();

-- `admin_create_agency` : corps repris de la définition VIVANTE, à deux gestes
-- près — son insert `activity_events` part (le trigger s'en charge, sinon
-- l'événement serait écrit deux fois), et son contexte propre passe par le
-- réglage local. Le reste (garde super_admin, anti-doublon, génération de slug)
-- est inchangé.
CREATE OR REPLACE FUNCTION public.admin_create_agency(
  p_name text,
  p_city text DEFAULT NULL::text,
  p_canton text DEFAULT NULL::text,
  p_plan text DEFAULT 'starter'::text,
  p_solo boolean DEFAULT false,
  p_note text DEFAULT NULL::text
) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $admin$
declare
  v_slug text;
  v_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden: super_admin required' using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'agency name too short';
  end if;
  if p_plan not in ('starter', 'pro', 'entreprise') then
    raise exception 'invalid plan: %', p_plan;
  end if;

  -- Anti-doublon explicite (message clair) — le unique index sur
  -- lower(btrim(name)) reste le backstop en cas de course.
  if exists (select 1 from agencies where lower(btrim(name)) = lower(btrim(p_name))) then
    raise exception 'agency name already exists' using errcode = '23505';
  end if;

  v_slug := lower(regexp_replace(btrim(p_name), '\s+', '-', 'g'));
  if exists (select 1 from agencies where slug = v_slug) then
    v_slug := v_slug || '-' || substring(gen_random_uuid()::text, 1, 6);
  end if;

  -- Contexte lu par trg_agency_created. Local à la transaction.
  perform set_config(
    'megga.agency_create_ctx',
    jsonb_build_object('admin_created', true, 'note', p_note)::text,
    true
  );

  insert into agencies (name, slug, city, canton, solo, plan, status, created_by)
  values (btrim(p_name), v_slug, nullif(btrim(coalesce(p_city, '')), ''), p_canton,
          coalesce(p_solo, false), p_plan::agency_plan, 'active', auth.uid())
  returning id into v_id;

  return v_id;
end;
$admin$;

COMMIT;
