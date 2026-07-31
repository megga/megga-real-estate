-- Étape 7, tâche 3 — correctif écart 2 (30 juillet 2026) : address/city/canton/postal_code
-- rejoignent la journalisation — mais PAS le gel.
--
-- LE DÉFAUT. Le brief (volet 2) nomme 9 colonnes à traiter : les 5 d'identité légale
-- (legal_name, legal_form_id, business_registration_number, country, tva) ET 4 colonnes
-- d'adresse (address, city, canton, postal_code). 20260730130000 n'a livré ni le gel ni la
-- journalisation pour ces 4 dernières — portée volontairement réduite à l'époque (« elles ne
-- nourrissent qu'address_geocode, un signal scorable, jamais un véto »), mais le volet 3 du
-- brief dit « journaliser TOUT changement de CES colonnes », qui renvoie à la liste de 9 du
-- volet 2 tout entière. La journalisation manquait donc pour ces 4 colonnes-là.
--
-- ARBITRAGE (Thomas, 30 juillet 2026), appliqué tel quel : étendre la JOURNALISATION à ces 4
-- colonnes ; laisser le GEL à 5. Geler l'adresse fermerait un chemin légitime — un agent qui
-- s'est trompé d'un chiffre dans son code postal, ou dont l'agence déménage, doit pouvoir
-- corriger sans détour par une procédure de correction pensée pour l'identité VÉRIFIÉE
-- (raison sociale, numéro de registre, étape 7/tâche 5). address/city/canton/postal_code ne
-- nourrissent aucun véto (seulement address_geocode, un signal scorable de poids 1.50) : les
-- figer n'ajouterait aucune garantie de conformité, seulement de la friction. La
-- journalisation, elle, ne coûte rien à la correction légitime et donne la traçabilité que le
-- volet 3 réclame — être corrigeable ET tracé ne sont pas en tension, contrairement à geler
-- ET rester corrigeable.
--
-- LA CORRECTION. agencies_audit_identity_columns() (20260730130000) surveillait 5 colonnes ;
-- elle en surveille 9 désormais, MÊME trigger AFTER UPDATE, MÊME action
-- (agency_legal_identity_updated), MÊME category ('kyc'), MÊME règle de severity (warn si le
-- dossier avait déjà été soumis). Une seule ligne d'activity_events par UPDATE, quelles que
-- soient les colonnes touchées parmi les 9 — metadata.changed liste PRÉCISÉMENT lesquelles,
-- identité et adresse pouvant coexister dans la même trace si les deux changent dans le même
-- UPDATE. Le nom de l'action reste générique à dessein : en créer un second (ex.
-- agency_address_updated) n'ajouterait rien que metadata.changed ne donne déjà, pour le prix
-- d'une deuxième chose à maintenir en phase avec le trigger de gel qui, LUI, ne bouge pas.
--
-- agencies_guard_identity_columns() (le trigger BEFORE UPDATE qui gèle, 20260730130000)
-- N'EST PAS touché par cette migration : il continue de ne verrouiller QUE les 5 colonnes
-- d'identité légale. Un agent simple reste malgré tout incapable d'écrire address (RBAC de
-- 20260731170000, policy agencies_members_update réservée aux dirigeants) : la LIGNE lui est
-- fermée avant même que ce trigger AFTER UPDATE n'ait la moindre chance de s'exécuter.
--
-- Idempotente : CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS avant CREATE.

begin;

create or replace function public.agencies_audit_identity_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_changed text[] := array[]::text[];
begin
  -- Cast explicite en text sur chaque littéral, même piège que 20260730130000 : sans lui,
  -- Postgres résout le littéral en text[] (l'autre surcharge de ||) et échoue sur « malformed
  -- array literal ».
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
  -- Étape 7, tâche 3 (écart 2, 30 juillet 2026) : journalisées comme l'identité, mais jamais
  -- gelées — le trigger de gel (agencies_guard_identity_columns) ne les liste pas, et ce
  -- volontairement (voir en-tête de cette migration).
  if new.address is distinct from old.address then
    v_changed := v_changed || 'address'::text;
  end if;
  if new.city is distinct from old.city then
    v_changed := v_changed || 'city'::text;
  end if;
  if new.canton is distinct from old.canton then
    v_changed := v_changed || 'canton'::text;
  end if;
  if new.postal_code is distinct from old.postal_code then
    v_changed := v_changed || 'postal_code'::text;
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
  'Étape 7, tâche 3 : journalise dans activity_events (action=agency_legal_identity_updated, category=kyc) tout changement des 5 colonnes d''identité légale de agencies (legal_name, legal_form_id, business_registration_number, country, tva) ET, depuis le 30 juillet 2026 (correctif écart 2, migration 20260731180000), des 4 colonnes d''adresse (address, city, canton, postal_code) — journalisées au même titre, mais JAMAIS gelées (agencies_guard_identity_columns ne les liste pas : aucun véto ne les compare au registre, un agent a une raison légitime de les corriger même après soumission). actor_kind=''user'' avec actor_id quand auth.uid() existe, ''system'' avec actor_id NULL sinon. severity=''warn'' si le dossier avait déjà été soumis. metadata.changed porte la LISTE des colonnes changées parmi les 9 (jamais leurs valeurs — activity_events est append-only et conservé dix ans).';

drop trigger if exists agencies_audit_identity_columns_trg on public.agencies;
create trigger agencies_audit_identity_columns_trg
  after update on public.agencies
  for each row
  execute function public.agencies_audit_identity_columns();

commit;
