-- Étape 7, tâche 3 : l'identité légale d'une agence cesse d'être modifiable en silence.
--
-- LE DÉFAUT, EN TROIS FAITS QUI NE VALENT QUE MIS ENSEMBLE.
--
--   1. La policy `agencies_members_update` (20260527010000) autorise TOUT membre à écrire
--      n'importe quelle colonne de la ligne de son agence. Son propre commentaire porte un
--      « TODO RBAC : restreindre UPDATE aux rôles admin/manager une fois la table
--      agency_members + le RBAC ship. Pour l'instant la politique est ouverte à tout membre
--      car l'app n'a qu'un seul rôle effectif (agent) ». L'app en a plusieurs depuis, et
--      provision_solo_agency (20260729150500) pose role='admin' sur le fondateur.
--   2. 20260729151600 a verrouillé les colonnes DE VÉRIFICATION (verification_status, score,
--      verified_at, identity_submitted_at, sweep_attempts). Les colonnes DÉCLARATIVES,
--      celles que les vétos comparent au registre, sont restées libres — et l'écran de
--      réglages (AgencyFocusSection -> useAgencySettings) les expose sans aucun garde lié à
--      identity_submitted_at ni à verification_status.
--   3. Rien ne rejoue la vérification sur un changement déclaratif (le déclenchement est
--      câblé dans submit_agency_identity SEULEMENT, il n'existe aucun trigger
--      `after update of legal_name…`), et rien ne l'écrit au journal.
--
-- Conséquence : une agence VALIDÉE pouvait changer sa raison sociale et son numéro de
-- registre. Les checks continuaient d'attester l'identité PRÉCÉDENTE, verification_status
-- restait `validated`, les gardes LAB restaient ouverts, et la modification ne laissait
-- AUCUNE trace. C'est exactement ce qu'un audit LAB regarde, et cela contredisait la règle
-- de dépôt « activity_events pour toute action ».
--
-- POURQUOI UN TRIGGER, ET NON UN REVOKE DE COLONNE COMME 20260729151600. Le verrou voulu est
-- CONDITIONNEL, et c'est toute la différence : avant soumission, le dirigeant DOIT pouvoir
-- écrire ces colonnes — c'est le wizard d'onboarding, et il passe par useAgencySettings, donc
-- par un UPDATE direct sur la table, pas par une RPC. Après soumission, plus personne. Un
-- `revoke update (col) from authenticated` ne sait pas exprimer « avant oui, après non » : il
-- aurait cassé StepAgence. Le trigger, lui, voit old.identity_submitted_at.
--
-- PORTÉE DÉLIBÉRÉE : les 5 colonnes que les VÉTOS d'entité comparent au registre.
-- `address`, `city`, `canton`, `postal_code` en sont exclues — elles ne nourrissent
-- qu'address_geocode, un signal scorable de poids 1.50, jamais un véto, et un agent a une
-- raison légitime de corriger une adresse. Tracer un déménagement est une décision distincte,
-- pas un corollaire de celle-ci.
--
-- Idempotente : CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS avant CREATE.

begin;

-- ─── 1. Garde d'écriture (BEFORE UPDATE) ────────────────────────────────────────────
--
-- Deux refus dans une seule fonction, parce qu'ils protègent la même donnée et qu'un
-- relecteur doit les voir ensemble :
--   - un agent SIMPLE n'écrit jamais l'identité légale, à aucun moment. C'est une donnée de
--     conformité, pas un réglage. Ferme le TODO RBAC du 27 mai 2026 pour ces colonnes.
--   - un DIRIGEANT n'écrit plus l'identité légale dès que le dossier est soumis. La preuve
--     a été produite sur les valeurs d'alors ; les remplacer après coup rendrait les checks
--     menteurs sans que rien ne le dise.
--
-- `current_user = 'authenticated'` nomme le rôle, exactement comme
-- agencies_guard_verification_columns : à l'intérieur d'une fonction SECURITY DEFINER
-- appartenant à postgres, current_user devient postgres, donc les RPC de conformité passent.
-- service_role passe aussi, ce qui est voulu : les fixtures de test posent leur état de
-- départ, et le futur chemin de correction (étape 7, tâche 5) rouvrira la saisie en
-- remettant identity_submitted_at à NULL depuis une RPC, jamais en contournant ce garde.
--
-- Le gel se LÈVE de lui-même quand identity_submitted_at repasse à NULL. Ce n'est pas un
-- effet de bord heureux, c'est la charnière entre cette tâche et la tâche 5 : demander une
-- correction rouvre le gate ET dégèle la saisie, par le même fait.
create or replace function public.agencies_guard_identity_columns()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_changed boolean;
begin
  v_changed :=
    new.legal_name is distinct from old.legal_name
    or new.legal_form_id is distinct from old.legal_form_id
    or new.business_registration_number is distinct from old.business_registration_number
    or new.country is distinct from old.country
    or new.tva is distinct from old.tva;

  if not v_changed or current_user <> 'authenticated' then
    return new;
  end if;

  if not public.is_agency_admin() then
    raise exception
      'forbidden: legal identity columns require an agency admin or manager'
      using errcode = '42501';
  end if;

  if old.identity_submitted_at is not null then
    raise exception
      'forbidden: legal identity is frozen once submitted for verification (ask a reviewer for a correction)'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.agencies_guard_identity_columns() is
  'Étape 7, tâche 3 : garde d''écriture des 5 colonnes d''identité légale de agencies (legal_name, legal_form_id, business_registration_number, country, tva) — celles que les VÉTOS d''entité comparent au registre. Refuse deux cas, sous current_user=authenticated uniquement (donc jamais depuis une RPC SECURITY DEFINER ni depuis service_role, même discipline que agencies_guard_verification_columns) : (1) un agent simple, qui n''a pas à toucher une donnée de conformité — ferme le TODO RBAC de 20260527010000 pour ces colonnes ; (2) un dirigeant dont le dossier est DÉJÀ SOUMIS (identity_submitted_at non nul), parce que les checks attesteraient alors l''identité précédente, avec verification_status inchangé et les gardes LAB ouverts. Le gel se lève quand identity_submitted_at repasse à NULL : c''est la charnière avec le chemin de correction. address/city/canton/postal_code sont HORS portée (signal scorable address_geocode, jamais un véto).';

drop trigger if exists agencies_guard_identity_columns_trg on public.agencies;
create trigger agencies_guard_identity_columns_trg
  before update on public.agencies
  for each row
  execute function public.agencies_guard_identity_columns();

-- ─── 2. Journalisation (AFTER UPDATE) ───────────────────────────────────────────────
--
-- Dans un trigger et non dans le hook React, pour trois raisons : il attrape TOUS les
-- chemins d'écriture (l'écran de réglages, le wizard, une future RPC, un correctif manuel en
-- service_role), il ne peut pas être oublié par un appelant, et il ne peut pas mentir sur ce
-- qui a réellement changé puisqu'il compare OLD et NEW.
--
-- actor_kind : 'user' avec actor_id quand auth.uid() existe, 'system' avec actor_id NULL
-- sinon. Ce n'est pas un contournement de la contrainte activity_events_actor_kind_coherence
-- (« actor_id IS NULL OR actor_kind = user ») mais sa lecture honnête : un changement écrit
-- en service_role, sans session, n'a pas d'auteur humain à nommer. Prétendre le contraire
-- serait faux ; ne rien écrire serait pire.
--
-- category='kyc' : 'compliance' n'existe pas dans activity_events_category_check et ferait
-- échouer l'insert. severity='warn' quand le dossier a déjà été soumis (un changement
-- d'identité sur un dossier en cours de vérification ou vérifié mérite un regard), 'info'
-- sinon (saisie initiale du wizard, cas nominal).
--
-- metadata.changed : la LISTE des colonnes réellement changées, pas un booléen. Un audit doit
-- pouvoir dire ce qui a bougé sans relire la ligne. Les valeurs elles-mêmes n'y sont
-- volontairement PAS : ce sont des données d'identification, et activity_events est conservé
-- dix ans sans purge possible (append-only, LBA art. 7) — y recopier une raison sociale
-- créerait une seconde rétention, hors du registre des traitements.
create or replace function public.agencies_audit_identity_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_changed text[] := array[]::text[];
begin
  -- Cast explicite en text sur chaque littéral : sans lui, `text[] || 'legal_name'` laisse
  -- Postgres résoudre le littéral en `text[]` (l'autre surcharge de `||`) et échouer sur
  -- « malformed array literal ». Attrapé par le spec de cette tâche, jamais par une relecture.
  if new.legal_name is distinct from old.legal_name then
    v_changed := v_changed || 'legal_name'::text;
  end if;
  if new.legal_form_id is distinct from old.legal_form_id then
    v_changed := v_changed || 'legal_form_id'::text;
  end if;
  if new.business_registration_number is distinct from old.business_registration_number then
    v_changed := v_changed || 'business_registration_number'::text;
  end if;
  if new.country is distinct from old.country then
    v_changed := v_changed || 'country'::text;
  end if;
  if new.tva is distinct from old.tva then
    v_changed := v_changed || 'tva'::text;
  end if;

  if array_length(v_changed, 1) is null then
    return new;
  end if;

  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id,
     category, severity, object_label, metadata)
  values (
    new.id,
    auth.uid(),
    case when auth.uid() is null then 'system' else 'user' end,
    'agency_legal_identity_updated',
    'agency',
    new.id,
    'kyc',
    case when old.identity_submitted_at is not null then 'warn' else 'info' end,
    coalesce(new.legal_name, new.name),
    jsonb_build_object(
      'changed', to_jsonb(v_changed),
      'was_submitted', old.identity_submitted_at is not null,
      'verification_status', old.verification_status
    )
  );

  return new;
end;
$$;

comment on function public.agencies_audit_identity_columns() is
  'Étape 7, tâche 3 : journalise dans activity_events (action=agency_legal_identity_updated, category=kyc) tout changement des 5 colonnes d''identité légale de agencies. Dans un TRIGGER et non dans le hook React : attrape tous les chemins d''écriture, ne peut pas être oublié par un appelant, et ne peut pas mentir sur ce qui a changé puisqu''il compare OLD et NEW. actor_kind=''user'' avec actor_id quand auth.uid() existe, ''system'' avec actor_id NULL sinon (lecture honnête de activity_events_actor_kind_coherence : un changement en service_role n''a pas d''auteur humain à nommer). severity=''warn'' si le dossier avait déjà été soumis. metadata.changed porte la LISTE des colonnes changées ; les VALEURS n''y figurent pas volontairement — activity_events est append-only et conservé dix ans, y recopier une raison sociale créerait une seconde rétention hors du registre des traitements.';

drop trigger if exists agencies_audit_identity_columns_trg on public.agencies;
create trigger agencies_audit_identity_columns_trg
  after update on public.agencies
  for each row
  execute function public.agencies_audit_identity_columns();

commit;
