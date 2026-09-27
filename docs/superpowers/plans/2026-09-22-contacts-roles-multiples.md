# Les rôles multiples d'un contact — plan d'exécution

> **Pour un agent :** SOUS-COMPÉTENCE REQUISE — `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans`, tâche par tâche. Les étapes sont des cases à cocher.

**But :** un contact porte plusieurs rôles parmi douze, l'agent filtre par rôle, et l'ancien `contacts.type` devient un rôle parmi d'autres sans qu'aucun lecteur ne casse.

**Conception :** [2026-09-22-contacts-roles-multiples-design.md](../specs/2026-09-22-contacts-roles-multiples-design.md), validée par Julien le 22.09.2026. **Étape 3** de la [feuille de route](../feuille-de-route.md). Demande 6 du cahier des charges de Gregory (P0, taille S).

**Architecture :** une colonne liste `contacts.roles` fait foi ; un déclencheur SQL tient `contacts.type` d'accord dans les deux sens, ce qui laisse intacts les 103 emplacements qui le lisent (dont trois politiques RLS et quatre fonctions SQL). Un module pur partagé (`src/lib/contactRoles.ts`) porte le vocabulaire, l'ordre et les dérivations côté écran ; il est le miroir exact du SQL, et une spec confronte les deux. Les écrans Contacts passent aux rôles ; tout le reste du CRM continue de lire `type`.

**Pile :** PostgreSQL (migration + déclencheur), TypeScript strict, React 18, Vitest (unitaire et `tests/backend` contre une base locale), i18n react-i18next 4 langues, banc `/dev/crm`.

**Branche :** `megga/contacts-roles`, partie de `megga/matching-lot-c`.

> ⚠ **Les commits attendent le signal de Julien** (« committe ») : les étapes « Commit » de ce plan se jouent toutes à la fin, **un commit par sujet**, dans l'ordre des tâches. Pendant l'exécution, on enchaîne sans commiter.

> ⚠ **La migration se redate le jour de la fusion** (date-guard de `deploy.yml` : seules les migrations dont le préfixe `YYYYMMDD` est ≥ au jour du run sont appliquées). Elle doit aussi être **appliquée à la main avant la fusion**, comme celles de la pige et du lot C : l'écran part avant la base (`deploy-app.yml` n'attend pas `deploy.yml`), et la liste Contacts lira `roles`.

---

## Les fichiers

| Fichier | Responsabilité |
|---|---|
| `supabase/migrations/20260922180000_contacts_roles.sql` | **Créer.** La colonne, sa contrainte, l'index GIN, la fonction d'ordre, le déclencheur de synchro, le remplissage initial. |
| `src/lib/contactRoles.ts` | **Créer.** Le vocabulaire, l'ordre, les familles et les dérivations — module PUR, miroir du SQL. |
| `src/types/contact.ts` | `Contact.roles`. |
| `src/types/database.ts` | La colonne `roles` dans Row / Insert / Update de `contacts`. |
| `src/i18n/locales/{fr,de,en,it}/contacts.json` | Le bloc `roles.*` (12 clés), le retrait de 10 clés mortes, les libellés du sélecteur. |
| `src/components/crm/mockData.ts` | `CrmContact.roles`. |
| `src/lib/crmAdapters.ts` | `contactToCrm` porte les rôles. |
| `src/components/crm/contacts-pager/ContactsPager.tsx` | La sous-nav par rôle, le sélecteur « Rôle », la pastille + « +2 », les segments de la Santé. |
| `src/components/crm/search/CrmSearch.tsx` | ⌘K trouve un contact par son rôle. |
| `src/components/crm/contacts-pager/ContactDetailPager.tsx` | L'édition des rôles et l'en-tête de la fiche. |
| `src/components/crm/contacts-pager/NewContactModal.tsx` | La création à rôles multiples, et l'IA qui AJOUTE au lieu d'écraser. |
| `src/pages/agent/ContactsPage.tsx` | La règle « côté demande » à la création. |
| `src/pages/agent/ContactDetailPage.tsx` | La même règle sur la fiche. |
| `supabase/functions/automation-engine/index.ts` | R3 n'appelle pas un contact de réseau un « lead dormant ». |
| `src/pages/dev/crmFixtures.ts` | Le banc : trois rôles, aucun rôle, acquéreur-vendeur. |
| `tests/unit/contacts-roles.spec.ts` | **Créer.** Les dérivations. |
| `tests/unit/contacts-roles-vocabulaire.spec.ts` | **Créer.** SQL ↔ TypeScript ↔ 4 langues. |
| `tests/backend/contacts-roles.spec.ts` | **Créer.** Le déclencheur contre la vraie base. |
| `tests/unit/banc-contacts-roles.spec.ts` | **Créer.** Les fixtures du banc. |

---

## Tâche 1 : le vocabulaire partagé

**Fichiers :**
- Créer : `src/lib/contactRoles.ts`
- Créer : `tests/unit/contacts-roles.spec.ts`

- [ ] **Étape 1 : écrire la spec qui échoue**

`tests/unit/contacts-roles.spec.ts` :

```ts
/**
 * Le vocabulaire des rôles d'un contact et ses dérivations (étape 3).
 *
 * ⛔ CES RÈGLES SONT CELLES DU DÉCLENCHEUR SQL (`contacts_roles_sync`, migration
 * `20260922180000_contacts_roles.sql`). Deux dérivations qui divergent donneraient un écran
 * qui dit « Vendeur » sur un contact que la base compte comme acheteur.
 */
import { describe, expect, it } from 'vitest'
import {
  ROLES_CONTACT, ROLES_DEMANDE, ROLES_RESEAU, ROLES_TRANSACTION,
  estRole, porteDemande, roleDominant, rolesDeType, typeDeRoles,
} from '@/lib/contactRoles'

describe('le vocabulaire', () => {
  it('douze rôles, dans un ordre qui fait foi', () => {
    expect(ROLES_CONTACT).toEqual([
      'buyer', 'seller', 'tenant', 'landlord', 'investor',
      'family_office', 'referrer', 'private_banker', 'lawyer', 'trustee', 'broker', 'architect',
    ])
    expect(ROLES_TRANSACTION).toEqual(['buyer', 'seller', 'tenant', 'landlord', 'investor'])
    expect(ROLES_RESEAU).toHaveLength(7)
    expect(ROLES_DEMANDE).toEqual(['buyer', 'tenant', 'investor'])
  })

  it('refuse ce qui n’est pas un rôle', () => {
    expect(estRole('buyer')).toBe(true)
    expect(estRole('both')).toBe(false)
    expect(estRole('lead')).toBe(false)
    expect(estRole('')).toBe(false)
  })
})

describe('l’ancien type devient un rôle', () => {
  it('chaque type donne ses rôles, sans perte', () => {
    expect(rolesDeType('buyer')).toEqual(['buyer'])
    expect(rolesDeType('seller')).toEqual(['seller'])
    expect(rolesDeType('tenant')).toEqual(['tenant'])
    expect(rolesDeType('landlord')).toEqual(['landlord'])
    expect(rolesDeType('investor')).toEqual(['investor'])
    expect(rolesDeType('both')).toEqual(['buyer', 'seller'])
    // ⛔ « Prospect » n’est pas un rôle : c’est un stade. Un contact sans rôle est un lead.
    expect(rolesDeType('lead')).toEqual([])
  })

  it('et l’aller-retour rend le type d’origine', () => {
    for (const t of ['buyer', 'seller', 'tenant', 'landlord', 'investor', 'both', 'lead'] as const) {
      expect(typeDeRoles(rolesDeType(t)), t).toBe(t)
    }
  })
})

describe('typeDeRoles — la règle du déclencheur', () => {
  it('acquéreur ET côté offre donnent « both »', () => {
    expect(typeDeRoles(['buyer', 'seller'])).toBe('both')
    expect(typeDeRoles(['buyer', 'landlord'])).toBe('both')
  })
  it('sinon le premier rôle de transaction, dans l’ordre du vocabulaire', () => {
    expect(typeDeRoles(['investor', 'tenant'])).toBe('tenant')
    expect(typeDeRoles(['landlord', 'investor'])).toBe('landlord')
    expect(typeDeRoles(['seller', 'tenant'])).toBe('seller')
  })
  it('aucun rôle de transaction : un lead, même avec des rôles de réseau', () => {
    expect(typeDeRoles([])).toBe('lead')
    expect(typeDeRoles(['lawyer', 'private_banker'])).toBe('lead')
  })
})

describe('les dérivations d’écran', () => {
  it('le rôle dominant peint la pastille : transaction d’abord, sinon réseau', () => {
    expect(roleDominant(['lawyer', 'seller'])).toBe('seller')
    expect(roleDominant(['trustee', 'lawyer'])).toBe('lawyer')
    expect(roleDominant([])).toBeNull()
  })
  it('porteDemande dit si on écrit des critères de recherche', () => {
    expect(porteDemande(['buyer'])).toBe(true)
    expect(porteDemande(['tenant', 'lawyer'])).toBe(true)
    expect(porteDemande(['investor'])).toBe(true)
    expect(porteDemande(['seller', 'landlord'])).toBe(false)
    expect(porteDemande([])).toBe(false)
  })
})
```

- [ ] **Étape 2 : jouer la spec, vérifier qu'elle échoue**

```bash
npx vitest run tests/unit/contacts-roles.spec.ts
```

Attendu : échec — `Failed to resolve import "@/lib/contactRoles"`.

- [ ] **Étape 3 : écrire le module**

`src/lib/contactRoles.ts` :

```ts
/**
 * Les rôles d'un contact (étape 3, 22.09.2026) — vocabulaire, familles, ordre et dérivations.
 * Module PUR : ni React, ni Supabase, ni traduction.
 *
 * Un contact porte PLUSIEURS rôles. `contacts.roles` fait foi ; `contacts.type` en dérive et
 * reste écrit, parce que le reste du CRM le lit (KYC, pipeline, relances, trois politiques RLS).
 *
 * ⛔ CE MODULE EST LE MIROIR DU SQL : `contacts_roles_ordonnes` et `contacts_roles_sync`
 * (migration `20260922180000_contacts_roles.sql`) appliquent les mêmes règles, dans le même
 * ordre. `contacts-roles-vocabulaire.spec.ts` confronte les deux listes, plus les 4 langues.
 */
import type { ContactType } from '@/types/contact'

/**
 * Les douze rôles, dans l'ORDRE QUI FAIT FOI : c'est lui qui choisit le type dérivé et la
 * pastille d'une ligne. Cinq rôles de transaction d'abord, sept rôles de réseau ensuite.
 */
export const ROLES_CONTACT = [
  'buyer', 'seller', 'tenant', 'landlord', 'investor',
  'family_office', 'referrer', 'private_banker', 'lawyer', 'trustee', 'broker', 'architect',
] as const

export type RoleContact = (typeof ROLES_CONTACT)[number]

/**
 * ⚠ Le type est AFFINÉ, pas élargi : annoté `readonly RoleContact[]`, `ROLES_TRANSACTION.find()`
 * rendrait « un rôle quelconque », et `typeDeRoles` ne compilerait plus (`lawyer` n'est pas un
 * `ContactType`). L'affiner évite un cast ET la duplication de la liste dans `typeDeRoles` —
 * une seconde source de vérité est exactement ce que ce module existe pour empêcher.
 */
export type RoleTransaction = Extract<RoleContact, 'buyer' | 'seller' | 'tenant' | 'landlord' | 'investor'>

/** Ce qu'on FAIT avec cette personne : ces rôles commandent les écrans. */
export const ROLES_TRANSACTION: readonly RoleTransaction[] = ['buyer', 'seller', 'tenant', 'landlord', 'investor']
/** Qui elle EST : ces rôles décrivent, filtrent, et alimenteront les relations (étape 6). */
export const ROLES_RESEAU: readonly RoleContact[] = ['family_office', 'referrer', 'private_banker', 'lawyer', 'trustee', 'broker', 'architect']
/** Côté DEMANDE : ceux dont les critères partent dans `search_criteria`, donc dans le matching. */
export const ROLES_DEMANDE: readonly RoleContact[] = ['buyer', 'tenant', 'investor']

// ⛔ PAS de `ROLES_OFFRE` ni de `seulementReseau` : rien ne les lirait. La règle des critères
// s'écrit avec `porteDemande` et sa négation, et la garde du moteur d'automatisations tourne
// dans le runtime Deno, qui ne peut pas importer `src/lib/` — elle porte sa liste en dur
// (tâche 11), confrontée à celle-ci par la spec de vocabulaire. Un export sans lecteur fait
// rougir `npm run lint:deadcode`, et c'est justifié : il se périme sans que personne ne le voie.

export const estRole = (v: unknown): v is RoleContact =>
  typeof v === 'string' && (ROLES_CONTACT as readonly string[]).includes(v)

/** Ne garde que des rôles connus, sans doublon, dans l'ordre du vocabulaire. */
export function rolesOrdonnes(roles: readonly unknown[] | null | undefined): RoleContact[] {
  const vus = new Set(roles?.filter(estRole) ?? [])
  return ROLES_CONTACT.filter((r) => vus.has(r))
}

/** L'ancien type, en rôles. ⛔ `lead` n'est pas un rôle : un contact sans rôle est un lead. */
export function rolesDeType(type: ContactType | null | undefined): RoleContact[] {
  if (type === 'both') return ['buyer', 'seller']
  if (type === 'lead' || !type) return []
  return estRole(type) ? [type] : []
}

/**
 * Le type dérivé des rôles — la règle du déclencheur : `both` si acquéreur ET côté offre,
 * sinon le premier rôle de transaction dans l'ordre du vocabulaire, sinon `lead`.
 */
export function typeDeRoles(roles: readonly RoleContact[]): ContactType {
  const a = (r: RoleContact) => roles.includes(r)
  if (a('buyer') && (a('seller') || a('landlord'))) return 'both'
  const premier = ROLES_TRANSACTION.find(a)
  return premier ?? 'lead'
}

/** Le rôle qui peint la pastille : transaction d'abord, sinon le premier rôle de réseau. */
export function roleDominant(roles: readonly RoleContact[]): RoleContact | null {
  return ROLES_TRANSACTION.find((r) => roles.includes(r)) ?? ROLES_RESEAU.find((r) => roles.includes(r)) ?? null
}

/** Le contact cherche quelque chose : ses critères partent dans `search_criteria`. */
export const porteDemande = (roles: readonly RoleContact[]): boolean => ROLES_DEMANDE.some((r) => roles.includes(r))

```

- [ ] **Étape 4 : jouer la spec, elle passe**

```bash
npx vitest run tests/unit/contacts-roles.spec.ts
```

Attendu : `Tests  9 passed`.

⚠ `npm run lint:deadcode` est ROUGE tant que les écrans n'ont pas repris ces exports (il ne compte
que les lecteurs de `src/`, une spec n'en est pas un). Il repasse au vert à la tâche 10 ; ne pas
l'inscrire au registre d'exceptions pour le faire taire entre-temps.

---

## Tâche 2 : la base — colonne, déclencheur, remplissage

**Fichiers :**
- Créer : `supabase/migrations/20260922180000_contacts_roles.sql`
- Créer : `tests/backend/contacts-roles.spec.ts`

- [ ] **Étape 1 : écrire la migration**

`supabase/migrations/20260922180000_contacts_roles.sql` :

```sql
-- Les rôles multiples d'un contact (étape 3, 22.09.2026).
--
-- `contacts.roles` fait foi ; `contacts.type` en dérive et reste écrit, parce que 103
-- emplacements le lisent — dont trois politiques RLS et quatre fonctions SQL. Le déclencheur
-- tient les deux d'accord DANS LES DEUX SENS : écrire `roles` recalcule `type` ; écrire `type`
-- seul (l'IA d'extraction, un import, `create_lead_with_optional_deal`) AJOUTE le rôle
-- correspondant sans effacer les rôles de réseau.
--
-- ⚠ Rejouable : le date-guard de deploy.yml réapplique une migration du jour à chaque push.
set local lock_timeout = '5s';

alter table public.contacts add column if not exists roles text[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contacts_roles_valides') then
    alter table public.contacts add constraint contacts_roles_valides check (
      roles <@ array['buyer','seller','tenant','landlord','investor',
                     'family_office','referrer','private_banker','lawyer','trustee','broker','architect']::text[]
    );
  end if;
end $$;

-- Le filtre par rôle de la liste Contacts : `roles && array['private_banker']`.
create index if not exists idx_contacts_roles on public.contacts using gin (roles);

comment on column public.contacts.roles is
  'Rôles multiples (étape 3). Source de vérité ; contacts.type en dérive par trigger. Vide = lead.';

-- Dédoublonne et ORDONNE selon le vocabulaire. Un rôle inconnu en sort : le déclencheur
-- compare les longueurs et refuse, plutôt que de le laisser tomber en silence.
create or replace function public.contacts_roles_ordonnes(p_roles text[])
returns text[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(array_agg(v.role order by v.ord), '{}')
  from (values
    ('buyer', 1), ('seller', 2), ('tenant', 3), ('landlord', 4), ('investor', 5),
    ('family_office', 6), ('referrer', 7), ('private_banker', 8), ('lawyer', 9),
    ('trustee', 10), ('broker', 11), ('architect', 12)
  ) as v(role, ord)
  where v.role = any(coalesce(p_roles, '{}'));
$$;

create or replace function public.contacts_roles_sync()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_roles text[];
  v_roles_change boolean;
  v_type_change boolean;
begin
  v_roles_change := case tg_op
    when 'INSERT' then coalesce(array_length(new.roles, 1), 0) > 0
    else new.roles is distinct from old.roles
  end;
  v_type_change := case tg_op
    when 'INSERT' then new.type is distinct from 'lead'
    else new.type is distinct from old.type
  end;

  -- `type` écrit SEUL : son rôle s'ajoute. `type` ne parle pas des rôles de réseau,
  -- il ne peut donc pas en retirer un.
  if v_type_change and not v_roles_change then
    new.roles := coalesce(new.roles, '{}') || case new.type
      when 'both' then array['buyer', 'seller']
      when 'lead' then '{}'::text[]
      else array[new.type]
    end;
  end if;

  v_roles := public.contacts_roles_ordonnes(new.roles);
  if coalesce(array_length(v_roles, 1), 0)
     <> coalesce(array_length(array(select distinct unnest(coalesce(new.roles, '{}'))), 1), 0) then
    raise exception 'rôle de contact inconnu : %', new.roles using errcode = '23514';
  end if;
  new.roles := v_roles;

  -- `type` dérive TOUJOURS des rôles : une seule vérité.
  new.type := case
    when 'buyer' = any(v_roles) and ('seller' = any(v_roles) or 'landlord' = any(v_roles)) then 'both'
    when 'buyer' = any(v_roles) then 'buyer'
    when 'seller' = any(v_roles) then 'seller'
    when 'tenant' = any(v_roles) then 'tenant'
    when 'landlord' = any(v_roles) then 'landlord'
    when 'investor' = any(v_roles) then 'investor'
    else 'lead'
  end;
  return new;
end $$;

drop trigger if exists trg_contacts_roles_sync on public.contacts;
create trigger trg_contacts_roles_sync
  before insert or update of roles, type on public.contacts
  for each row execute function public.contacts_roles_sync();

-- Remplissage initial : chaque type devient son ou ses rôles. `lead` n'en donne aucun.
update public.contacts
set roles = case type
  when 'both' then array['buyer', 'seller']
  when 'lead' then '{}'::text[]
  else array[type]
end
where roles = '{}' and type <> 'lead';
```

- [ ] **Étape 2 : écrire la spec de base**

`tests/backend/contacts-roles.spec.ts` :

```ts
/**
 * Le déclencheur de synchronisation des rôles, contre la vraie base (étape 3).
 *
 * ⛔ Ce que le banc ne peut PAS éprouver : un trigger. C'est ici que la règle vit.
 *
 * Même gabarit que `tests/backend/matching-explique.spec.ts` : deux agences réelles, un
 * client service-role, et `describe.skipIf` quand la base locale n'est pas là — la CI la
 * fournit, une machine de développement pas toujours.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_JWT)

describe.skipIf(!HAS_KEYS)('contacts · rôles multiples — le déclencheur', () => {
  let s: TwoAgenciesSetup
  let svc: SupabaseClient
  const crees: string[] = []

  beforeAll(async () => {
    s = await setupTwoAgencies()
    svc = serviceRoleClient()
  })

  afterAll(async () => {
    if (crees.length) await svc.from('contacts').delete().in('id', crees)
    await s?.cleanup?.()
  })

  /** Crée un contact et rend ce que la base a RETENU — c'est le déclencheur qui parle. */
  const creer = async (champs: Record<string, unknown>) => {
    const { data, error } = await svc.from('contacts')
      .insert({ agency_id: s.agencyA, first_name: 'Test', last_name: 'Rôles', ...champs })
      .select('id, type, roles').single()
    if (error) throw new Error(error.message)
    crees.push((data as { id: string }).id)
    return data as { id: string; type: string; roles: string[] }
  }

  it('écrire `roles` recalcule `type`', async () => {
    expect(await creer({ roles: ['seller', 'lawyer'] })).toMatchObject({ type: 'seller', roles: ['seller', 'lawyer'] })
    expect(await creer({ roles: ['lawyer', 'buyer', 'seller'] })).toMatchObject({ type: 'both' })
    expect(await creer({ roles: ['private_banker'] })).toMatchObject({ type: 'lead', roles: ['private_banker'] })
  })

  it('écrire `type` seul AJOUTE son rôle, sans effacer les rôles de réseau', async () => {
    const { id } = await creer({ roles: ['lawyer'] })
    const { data, error } = await svc.from('contacts').update({ type: 'seller' }).eq('id', id).select('type, roles').single()
    if (error) throw new Error(error.message)
    expect(data).toMatchObject({ type: 'seller', roles: ['seller', 'lawyer'] })
  })

  it('un contact créé sans rien est un lead sans rôle (le chemin du copilote WhatsApp)', async () => {
    expect(await creer({ source: 'whatsapp_ai' })).toMatchObject({ type: 'lead', roles: [] })
  })

  it('`type = both` à l’écriture donne les deux rôles', async () => {
    expect(await creer({ type: 'both' })).toMatchObject({ type: 'both', roles: ['buyer', 'seller'] })
  })

  it('les rôles sont ordonnés et dédoublonnés', async () => {
    expect(await creer({ roles: ['lawyer', 'buyer', 'lawyer', 'tenant'] }))
      .toMatchObject({ roles: ['buyer', 'tenant', 'lawyer'] })
  })

  it('un rôle inconnu est REFUSÉ, jamais laissé tomber en silence', async () => {
    const { error } = await svc.from('contacts')
      .insert({ agency_id: s.agencyA, first_name: 'Test', last_name: 'Inconnu', roles: ['plombier'] })
      .select('id').single()
    expect(error?.message ?? '').toMatch(/rôle de contact inconnu|contacts_roles_valides/)
  })

  it('les rôles gagnent quand les deux colonnes changent ensemble', async () => {
    expect(await creer({ type: 'seller', roles: ['tenant'] })).toMatchObject({ type: 'tenant', roles: ['tenant'] })
  })
})
```

⚠ Lire `tests/backend/helpers/two-agencies.ts` avant d'écrire : les noms exacts des champs rendus (`agencyA`, `cleanup`) font foi, pas ceux d'ici. ⛔ `execSql` de `helpers/local-sql.ts` ne rend RIEN (`: void`) — il ne sert qu'à pousser du SQL, jamais à lire un résultat.

- [ ] **Étape 3 : appliquer la migration en local et jouer la spec**

```bash
npx supabase db reset --local
npx vitest run --config=vitest.backend.config.ts tests/backend/contacts-roles.spec.ts
```

⛔ **Le `--config` n'est pas facultatif** : `vitest.config.ts` n'inclut que `tests/unit/**`, et sans lui la commande rend « No test files found » — une spec introuvable se lit comme une spec absente, pas comme une erreur. `npm run test:backend` fait la même chose pour toute la suite.

Attendu : `Tests  7 passed`. Sans base locale, la spec est ignorée — c'est la CI qui la joue ; le dire dans le rapport plutôt que de la déclarer verte.

---

## Tâche 3 : les types TypeScript

**Fichiers :**
- Modifier : `src/types/contact.ts`
- Modifier : `src/types/database.ts`

- [ ] **Étape 1 : `Contact.roles`**

Dans `src/types/contact.ts`, sous `type: ContactType` :

```ts
  type: ContactType
  /**
   * Étape 3 : les rôles multiples. Source de vérité ; `type` en dérive par déclencheur.
   * Vide = un lead. Vocabulaire et dérivations : `src/lib/contactRoles.ts`.
   */
  roles: string[]
```

- [ ] **Étape 2 : la colonne dans `database.ts`**

Dans les trois blocs de `contacts` (`Row`, `Insert`, `Update`), **à sa place alphabétique** — après `residence_country`, avant `score` :

```ts
          roles: string[]        // Row
          roles?: string[]       // Insert
          roles?: string[]       // Update
```

⚠ La place alphabétique n'est pas cosmétique : `database.ts` est régénéré par `supabase gen types`, et une colonne posée ailleurs revient en conflit à la première régénération.

- [ ] **Étape 3 : vérifier que tout compile**

```bash
npx tsc -b
```

Attendu : **une seule erreur**, et c'est le signal qu'on vient d'armer —
`MobileContactDetailScreen.tsx:45`, `Property 'roles' is missing`. Le champ est VOLONTAIREMENT non
optionnel : chaque fixture qui l'oublie doit se voir à la compilation. La tâche 5 corrige les mocks
et rend `tsc` vert. ⛔ Ne pas rendre `roles` optionnel pour verdir ici : ce serait retirer la garde
qu'on vient de poser.

---

## Tâche 4 : les libellés, en quatre langues

**Fichiers :**
- Modifier : `src/i18n/locales/{fr,de,en,it}/contacts.json`
- Créer : `tests/unit/contacts-roles-vocabulaire.spec.ts`

- [ ] **Étape 1 : écrire la spec de vocabulaire**

`tests/unit/contacts-roles-vocabulaire.spec.ts` :

```ts
/**
 * Le vocabulaire des rôles, confronté entre ses TROIS déclarations : la contrainte SQL, le
 * module TypeScript, et les quatre langues. Un rôle ajouté d'un seul côté doit rougir ici —
 * sinon il se traduit « roles.trustee » à l'écran, ou la base refuse ce que l'écran propose.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROLES_CONTACT } from '@/lib/contactRoles'

const lire = (p: string): string => readFileSync(resolve(__dirname, '../..', p), 'utf8')
const LANGUES = ['fr', 'de', 'en', 'it'] as const

describe('les douze rôles sont déclarés pareil partout', () => {
  it('la contrainte SQL porte exactement les rôles du module', () => {
    const sql = lire('supabase/migrations/20260922180000_contacts_roles.sql')
    // ⛔ S'ancrer sur `add constraint …`, PAS sur le seul nom de la contrainte : il est cité DEUX
    // fois (la garde `pg_constraint`, puis l'ALTER), et découper sur la première occurrence rend
    // un fragment vide — une assertion qui ne mesure rien et passe au vert.
    const bloc = sql.split('add constraint contacts_roles_valides')[1]?.split(';')[0] ?? ''
    for (const r of ROLES_CONTACT) expect(bloc, r).toContain(`'${r}'`)
    // Et rien de plus : chaque chaîne citée du CHECK est un rôle connu.
    const cites = [...bloc.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!)
    expect(new Set(cites)).toEqual(new Set(ROLES_CONTACT))
  })

  it('la fonction d’ordre porte les mêmes, dans l’ordre du module', () => {
    const sql = lire('supabase/migrations/20260922180000_contacts_roles.sql')
    const bloc = sql.split('contacts_roles_ordonnes')[1]!.split('$$')[1] ?? ''
    const ordre = [...bloc.matchAll(/\('([a-z_]+)',\s*\d+\)/g)].map((m) => m[1]!)
    expect(ordre).toEqual([...ROLES_CONTACT])
  })

  it('les quatre langues nomment les douze rôles', () => {
    for (const langue of LANGUES) {
      const json = JSON.parse(lire(`src/i18n/locales/${langue}/contacts.json`)) as Record<string, unknown>
      const roles = (json.roles ?? {}) as Record<string, string>
      expect(Object.keys(roles).sort(), langue).toEqual([...ROLES_CONTACT].sort())
      for (const [cle, valeur] of Object.entries(roles)) {
        expect(valeur.trim(), `${langue}.${cle}`).not.toBe('')
      }
    }
  })

  it('les clés mortes de l’ancien type sont parties', () => {
    for (const langue of LANGUES) {
      const json = JSON.parse(lire(`src/i18n/locales/${langue}/contacts.json`)) as Record<string, unknown>
      expect(json.type, langue).toBeUndefined()
      expect((json.detail as Record<string, unknown> | undefined)?.type, langue).toBeUndefined()
    }
  })
})
```

- [ ] **Étape 2 : jouer la spec, vérifier qu'elle échoue**

```bash
npx vitest run tests/unit/contacts-roles-vocabulaire.spec.ts
```

Attendu : échec sur le bloc `roles` absent des quatre fichiers.

- [ ] **Étape 3 : poser le bloc `roles` dans les quatre langues**

Dans `src/i18n/locales/fr/contacts.json`, **à la place du bloc `type` qui est retiré** (il n'a aucun lecteur) :

```json
  "roles": {
    "buyer": "Acquéreur",
    "seller": "Vendeur",
    "tenant": "Locataire",
    "landlord": "Bailleur",
    "investor": "Investisseur",
    "family_office": "Family office",
    "referrer": "Prescripteur",
    "private_banker": "Private banker",
    "lawyer": "Avocat",
    "trustee": "Trustee",
    "broker": "Courtier",
    "architect": "Architecte"
  },
```

Allemand :

```json
  "roles": {
    "buyer": "Käufer",
    "seller": "Verkäufer",
    "tenant": "Mieter",
    "landlord": "Vermieter",
    "investor": "Investor",
    "family_office": "Family Office",
    "referrer": "Empfehlungsgeber",
    "private_banker": "Private Banker",
    "lawyer": "Anwalt",
    "trustee": "Trustee",
    "broker": "Makler",
    "architect": "Architekt"
  },
```

Anglais :

```json
  "roles": {
    "buyer": "Buyer",
    "seller": "Seller",
    "tenant": "Tenant",
    "landlord": "Landlord",
    "investor": "Investor",
    "family_office": "Family office",
    "referrer": "Referrer",
    "private_banker": "Private banker",
    "lawyer": "Lawyer",
    "trustee": "Trustee",
    "broker": "Broker",
    "architect": "Architect"
  },
```

Italien :

```json
  "roles": {
    "buyer": "Acquirente",
    "seller": "Venditore",
    "tenant": "Inquilino",
    "landlord": "Locatore",
    "investor": "Investitore",
    "family_office": "Family office",
    "referrer": "Segnalatore",
    "private_banker": "Private banker",
    "lawyer": "Avvocato",
    "trustee": "Trustee",
    "broker": "Intermediario",
    "architect": "Architetto"
  },
```

⚠ Le cliquet `i18n:coverage:ci` refuse un mot recopié de l'anglais en DE et IT : « Private banker », « Trustee » et « Family office » sont des termes métier employés tels quels en Suisse, comme `Off-market`. S'il rougit, les inscrire dans son registre d'exceptions plutôt que de les traduire de force.

- [ ] **Étape 4 : retirer les dix clés mortes**

Dans les quatre fichiers : supprimer le bloc `type` (7 clés) et le bloc `detail.type` (3 clés). Vérifier d'abord qu'ils n'ont aucun lecteur :

```bash
grep -rn "contactType\.\|'type\.\|detail\.type" src/ | grep -v node_modules
```

Attendu : aucune ligne ne cite `contacts:type.*` ni `contacts:detail.type.*` (les emplois de `contactType.*` restent, ils vivent dans un autre bloc).

- [ ] **Étape 5 : poser les libellés du sélecteur de rôle**

Dans les quatre langues, sous `segments` :

```json
    "role": "Rôle",
    "roleAll": "Tous les rôles",
    "roleOverlap": "Un contact peut porter plusieurs rôles : la somme des segments dépasse le total."
```

(DE : `"Rolle"`, `"Alle Rollen"`, `"Ein Kontakt kann mehrere Rollen haben: Die Summe der Segmente übersteigt das Total."` — EN : `"Role"`, `"All roles"`, `"A contact can hold several roles: the segments add up to more than the total."` — IT : `"Ruolo"`, `"Tutti i ruoli"`, `"Un contatto può avere più ruoli: la somma dei segmenti supera il totale."`)

- [ ] **Étape 6 : jouer la spec et les portes i18n**

```bash
npx vitest run tests/unit/contacts-roles-vocabulaire.spec.ts && npm run i18n:coverage:ci
```

Attendu : `Tests  4 passed`, et la porte i18n verte.

---

## Tâche 5 : les rôles arrivent jusqu'à l'écran

**Fichiers :**
- Modifier : `src/components/crm/mockData.ts`
- Modifier : `src/lib/crmAdapters.ts`

- [ ] **Étape 1 : `CrmContact` porte ses rôles**

Dans `src/components/crm/mockData.ts`, importer le type en tête (`import type { RoleContact } from '@/lib/contactRoles'`), puis, dans l'interface `CrmContact`, sous `type` :

```ts
  type: 'buyer' | 'seller' | 'tenant' | 'landlord' | 'mixed'
  /** Étape 3 : les rôles, source de vérité. `type` reste le repli des écrans non repris. */
  roles: RoleContact[]
```

⚠ Les mocks de ce fichier (8 contacts) et ceux de `crm-mobile` doivent recevoir `roles: ['buyer']` — le champ n'est pas optionnel, pour qu'un oubli se voie à la compilation.

- [ ] **Étape 2 : l'adaptateur les porte**

Dans `src/lib/crmAdapters.ts`, `contactToCrm` :

```ts
import { rolesDeType, rolesOrdonnes, typeDeRoles } from '@/lib/contactRoles'

export function contactToCrm(c: Contact, kyc: KycCase | undefined): CrmContact {
  // Étape 3. Un contact d'avant la migration n'a pas de rôles : son type en tient lieu, le
  // temps que le remplissage passe. ⛔ Ne jamais inventer un rôle de réseau ici.
  const roles = c.roles?.length ? rolesOrdonnes(c.roles) : rolesDeType(c.type)
  return {
    id: c.id,
    // Le type de l'UI dérive des RÔLES, plus de la colonne : les deux ne peuvent plus se
    // contredire à l'écran, y compris entre l'écriture et le passage du déclencheur.
    type: mapContactType(typeDeRoles(roles)),
    roles,
    // …le reste de l'objet, inchangé.
```

- [ ] **Étape 3 : compiler**

```bash
npx tsc -b
```

Attendu : sortie 0 (les mocks corrigés).

---

## Tâche 6 : la liste — sous-nav, sélecteur, pastille

**Fichiers :**
- Modifier : `src/components/crm/contacts-pager/ContactsPager.tsx`

- [ ] **Étape 1 : l'appartenance devient « porte ce rôle »**

Remplacer `audienceOf` (l. 55-59) et le modèle de filtre (l. 96-100) :

```ts
import { ROLES_CONTACT, roleDominant, type RoleContact } from '@/lib/contactRoles'

/**
 * ⛔ `audienceOf` A DISPARU (étape 3). Elle rangeait chaque contact dans UNE audience, et
 * comptait `investor`, `both` et `lead` comme des acheteurs. L'appartenance est désormais
 * « porte ce rôle » : un contact à deux rôles apparaît sous les deux, et les comptes se
 * chevauchent — c'est ce que les rôles multiples veulent dire.
 */
const porte = (c: CrmContact, role: RoleContact): boolean => c.roles.includes(role)

type Filter =
  | { type: 'audience'; value: 'all' | RoleContact; label?: string }
  | { type: 'role'; value: RoleContact; label: string }
  | { type: 'kyc'; value: 'verified' | 'pending' | 'none'; label: string }
  | { type: 'source'; value: string; label: string }
  | { type: 'stale'; value: 'stale'; label: string }
```

et, dans `matchFilter` :

```ts
  if (f.type === 'audience') return f.value === 'all' || porte(c, f.value)
  if (f.type === 'role') return porte(c, f.value)
```

- [ ] **Étape 2 : les quatre entrées comptent par rôle**

```ts
  const tabs: { id: 'all' | RoleContact; label: string; n: number }[] = [
    { id: 'all', label: t('segments.all'), n: trouves.length },
    { id: 'buyer', label: t('segments.buyer'), n: trouves.filter(c => porte(c, 'buyer')).length },
    { id: 'seller', label: t('segments.seller'), n: trouves.filter(c => porte(c, 'seller')).length },
    { id: 'tenant', label: t('segments.tenant'), n: trouves.filter(c => porte(c, 'tenant')).length },
  ]
```

- [ ] **Étape 3 : le sélecteur « Rôle »**

À poser juste après la boucle `tabs.map(...)`, avant le `{segActive && …}` : un `<select>` natif, stylé comme les pilules, qui ne liste que les rôles PRÉSENTS avec leur compte.

```tsx
  // Les rôles réellement présents, comptés sur la liste trouvée : une agence qui n'a pas
  // d'architecte ne se voit pas proposer « Architecte (0) ».
  const rolesPresents = ROLES_CONTACT
    .map((r) => ({ r, n: trouves.filter((c) => porte(c, r)).length }))
    .filter((x) => x.n > 0)
```

```tsx
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 36, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)',
          border: `1px solid ${dark ? 'rgba(255,255,255,.12)' : 'rgba(3,3,3,.1)'}`, color: sp.soft, fontSize: 'var(--crm-text-lg)', fontWeight: 600, cursor: 'pointer' }}>
          <span className="sr-only">{t('segments.role')}</span>
          <MEIcon name="users" size={16} strokeWidth={2} />
          <select
            value={filter.type === 'role' ? filter.value : ''}
            onChange={(e) => {
              const v = e.target.value
              setFilter(v === '' ? { type: 'audience', value: 'all' } : { type: 'role', value: v as RoleContact, label: t(`roles.${v}`) })
            }}
            style={{ border: 0, background: 'transparent', color: 'inherit', font: 'inherit', cursor: 'pointer', outline: 'none' }}>
            <option value="">{t('segments.roleAll')}</option>
            {rolesPresents.map(({ r, n }) => <option key={r} value={r}>{t(`roles.${r}`)} ({n})</option>)}
          </select>
        </label>
```

⚠ `segActive` vaut `filter.type !== 'audience'` : un filtre de rôle allumerait la pilule « ✕ » ET le sélecteur, deux fois la même chose. Le remplacer par `const segActive = filter.type !== 'audience' && filter.type !== 'role'`.

- [ ] **Étape 4 : la pastille + « +2 »**

Remplacer `CtpTypePill` (l. 162-171) :

```tsx
/**
 * La pastille de rôle d'une ligne : le rôle DOMINANT peint, puis « +2 » sourd pour les autres,
 * nommés au survol.
 *
 * ⛔ AUCUNE TEINTE NOUVELLE. `CTP_FN` n'en porte que trois (acquéreur, vendeur, locataire) ;
 * tout le reste — bailleur, investisseur et les sept rôles de réseau — prend le filet et
 * l'encre sourde. Inventer neuf couleurs ferait neuf décisions de direction que personne n'a
 * prises, et `ctpTokens.ts` explique que ces trois-là ont été mesurées pour porter le blanc.
 */
function CtpRolePill({ roles, label, autres, sp }: { roles: RoleContact[]; label: string; autres: string; sp: CrmPalette }) {
  const dominant = roleDominant(roles)
  if (!dominant) return <span style={{ color: sp.sub, fontSize: 'var(--crm-text-sm)' }}>—</span>
  const teinte: string | undefined = (CTP_FN as Record<string, string>)[dominant]
  const reste = roles.length - 1
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', minWidth: 0 }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 var(--crm-space-md)',
        borderRadius: 'var(--crm-radius-pill)',
        background: teinte ?? 'transparent',
        color: teinte ? encreSur(teinte) : sp.sub,
        border: teinte ? '0' : `1px solid ${sp.cardBorder}`,
        fontSize: 'var(--crm-text-sm)', fontWeight: 600, letterSpacing: 0.1, whiteSpace: 'nowrap',
      }}>{label}</span>
      {reste > 0 && <span title={autres} style={{ color: sp.sub, fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>+{reste}</span>}
    </span>
  )
}
```

⚠ `CTP_FN` porte aussi la clé `ok` (le vert du KYC) : la lecture indexée ci-dessus ne peut pas la rendre, aucun rôle ne s'appelle `ok`.

Au rendu d'une ligne, remplacer `<div><CtpTypePill aud={aud} label={audLabel[aud]} /></div>` par :

```tsx
                <div><CtpRolePill roles={c.roles} sp={sp}
                  label={roleDominant(c.roles) ? t(`roles.${roleDominant(c.roles)}`) : ''}
                  autres={c.roles.map((r) => t(`roles.${r}`)).join(' · ')} /></div>
```

et retirer `const aud = audienceOf(c)` ainsi que `audLabel`.

- [ ] **Étape 5 : compiler et regarder**

```bash
npx tsc -b && npx eslint src/components/crm/contacts-pager/ContactsPager.tsx --quiet
```

Attendu : sortie 0 des deux.

---

## Tâche 7 : la recherche trouve un rôle

Gregory demande « filtres **et recherche** par rôle » ; la feuille de route ne retenait que les
filtres. Décision de Julien le 22.09.2026 : la recherche entre dans le périmètre. Deux surfaces —
la recherche LOCALE de la liste Contacts, et ⌘K, qui cherche les contacts **au serveur**.

**Fichiers :**
- Modifier : `src/lib/contactRoles.ts`
- Modifier : `tests/unit/contacts-roles.spec.ts`
- Modifier : `src/components/crm/contacts-pager/ContactsPager.tsx`
- Modifier : `src/hooks/useContacts.ts`
- Modifier : `src/components/crm/search/CrmSearch.tsx`

- [ ] **Étape 1 : écrire la spec qui échoue**

À ajouter à `tests/unit/contacts-roles.spec.ts` :

```ts
describe('rolesDepuisTexte — taper un rôle le trouve', () => {
  // Les libellés sont injectés : le module reste PUR (aucune traduction dedans).
  const fr: Record<string, string> = {
    buyer: 'Acquéreur', seller: 'Vendeur', tenant: 'Locataire', landlord: 'Bailleur',
    investor: 'Investisseur', family_office: 'Family office', referrer: 'Prescripteur',
    private_banker: 'Private banker', lawyer: 'Avocat', trustee: 'Trustee',
    broker: 'Courtier', architect: 'Architecte',
  }
  const libelle = (r: RoleContact): string => fr[r] ?? r

  it('trouve par le libellé, accents et casse pliés', () => {
    expect(rolesDepuisTexte('private banker', libelle)).toEqual(['private_banker'])
    expect(rolesDepuisTexte('AVOCAT', libelle)).toEqual(['lawyer'])
    expect(rolesDepuisTexte('acquereur', libelle)).toEqual(['buyer'])
  })
  it('trouve par un morceau du libellé, et rend TOUS les rôles qui correspondent', () => {
    expect(rolesDepuisTexte('banker', libelle)).toEqual(['private_banker'])
    expect(rolesDepuisTexte('e', libelle)).toEqual([])        // trop court : deux lettres minimum
    expect(rolesDepuisTexte('  ', libelle)).toEqual([])
  })
  it('trouve aussi par le slug, que l’agent ne voit pas mais que les URL portent', () => {
    expect(rolesDepuisTexte('family_office', libelle)).toEqual(['family_office'])
  })
  it('ne rend rien pour un mot qui n’est pas un rôle — sinon toute recherche filtrerait', () => {
    expect(rolesDepuisTexte('Rochat', libelle)).toEqual([])
  })
})
```

⚠ Ajouter `rolesDepuisTexte` et `type RoleContact` aux imports en tête de la spec.

- [ ] **Étape 2 : jouer la spec, vérifier qu'elle échoue**

```bash
npx vitest run tests/unit/contacts-roles.spec.ts
```

Attendu : échec — `rolesDepuisTexte is not a function`.

- [ ] **Étape 3 : écrire la dérivation**

Dans `src/lib/contactRoles.ts` :

```ts
const plier = (s: string): string => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

/**
 * Les rôles qu'une recherche libre désigne : « private banker » rend `private_banker`.
 *
 * Les libellés sont INJECTÉS (`libelle`) : ce module ne connaît pas i18n, et la recherche doit
 * suivre la langue de l'agent. On compare sur le libellé ET sur le slug (les deux pliés), parce
 * qu'une URL ou un collage porte parfois le slug.
 *
 * ⛔ Deux lettres au moins : à une lettre, « e » désignerait la moitié du vocabulaire et toute
 * recherche de nom se mettrait à filtrer par rôle.
 */
export function rolesDepuisTexte(q: string, libelle: (r: RoleContact) => string): RoleContact[] {
  const m = plier(q)
  if (m.length < 2) return []
  return ROLES_CONTACT.filter((r) => plier(libelle(r)).includes(m) || plier(r.replace(/_/g, ' ')).includes(m) || r === m)
}
```

- [ ] **Étape 4 : la recherche de la liste**

Dans `ContactsPager.tsx`, `matchRecherche` (l. ~104) reçoit les rôles et les compare :

```ts
/**
 * Recherche de la liste. Chaque mot doit figurer dans le nom ou l'e-mail (sans accents :
 * « zoe » trouve Zoé). Trois chiffres ou plus cherchent AUSSI dans le téléphone, zéro de tête
 * ignoré. Depuis l'étape 3, un RÔLE se cherche comme un nom : « avocat » rend les avocats.
 */
function matchRecherche(c: CrmContact, q: string, rolesCherches: RoleContact[]): boolean {
  if (rolesCherches.length > 0 && rolesCherches.some((r) => c.roles.includes(r))) return true
  const mots = plier(q).split(/\s+/).filter(Boolean)
  if (!mots.length) return true
  const texte = plier(`${c.firstName} ${c.lastName} ${c.email || ''}`)
  if (mots.every((m) => texte.includes(m))) return true
  const chiffres = q.replace(/\D/g, '').replace(/^0+/, '')
  return chiffres.length >= 3 && (c.phone || '').replace(/\D/g, '').includes(chiffres)
}
```

et son appelant :

```ts
  // Les rôles que la frappe désigne : « avocat » trouve les avocats, en plus des noms.
  const rolesCherches = useMemo(() => rolesDepuisTexte(recherche, (r) => t(`roles.${r}`)), [recherche, t])
  const trouves = useMemo(() => contacts.filter(c => matchRecherche(c, recherche, rolesCherches)), [contacts, recherche, rolesCherches])
```

⚠ C'est un OU, pas un ET : taper « avocat » rend les avocats **et** un contact qui s'appellerait Avocat. Une recherche qui écarte un homonyme se lit comme une recherche cassée.

- [ ] **Étape 5 : ⌘K cherche au SERVEUR**

`useContacts` reçoit des rôles et les met dans le même `or` que le texte — sinon la recherche
globale rendrait les contacts dont le NOM contient « avocat » et aucun avocat.

Dans `src/hooks/useContacts.ts` :

```ts
interface ContactFilters {
  role?: RoleContact
  roles?: RoleContact[]
  score?: ContactScore
  search?: string
}
```

```ts
  if (filters?.search) {
    // Étape 3 : le texte OU un rôle désigné par ce texte. `roles.ov.{a,b}` est la forme
    // PostgREST de « les tableaux se chevauchent » ; les accolades ne se citent pas.
    const parRole = filters.roles?.length ? `,roles.ov.{${filters.roles.join(',')}}` : ''
    baseQuery = baseQuery.or(
      `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%${parRole}`
    )
  }
```

Dans `src/components/crm/search/CrmSearch.tsx`, l. ~313 :

```ts
  const rolesCherches = useMemo(() => rolesDepuisTexte(debouncedQ, (r) => t(`roles.${r}`, { ns: 'contacts' })), [debouncedQ, t])
  const { contacts } = useContacts(
    debouncedQ.trim().length >= 2 ? { search: debouncedQ.trim(), roles: rolesCherches } : undefined,
  )
```

⚠ `CrmSearch` traduit dans son propre namespace : vérifier lequel (`useTranslation(...)` en tête du composant) et viser `contacts` explicitement, sinon `roles.lawyer` sort en clé brute et aucun rôle ne matchera.

- [ ] **Étape 6 : jouer les specs et compiler**

```bash
npx tsc -b && npx vitest run tests/unit/contacts-roles.spec.ts
```

Attendu : sortie 0, `Tests  12 passed`.

- [ ] **Étape 7 : l'éprouver à l'écran**

Sur le banc, taper « private banker » dans la recherche de la liste : le contact de réseau
apparaît. Puis ⌘K, « avocat » : il apparaît dans le groupe Contacts.

---

## Tâche 8 : la page Santé

**Fichiers :**
- Modifier : `src/components/crm/contacts-pager/ContactsPager.tsx` (bloc Santé, l. ~575-620)

- [ ] **Étape 1 : les segments par rôle**

Remplacer `byAud` :

```ts
  // Étape 3 : un segment par rôle PRÉSENT, dans l'ordre du vocabulaire. Les comptes se
  // chevauchent (un vendeur-prescripteur compte deux fois) : la page le dit sous le bloc.
  const byRole = ROLES_CONTACT
    .map((r) => ({ r, n: contacts.filter((c) => c.roles.includes(r)).length }))
    .filter((x) => x.n > 0)
```

et le panneau qui le rendait (`CtpCard title={t('health.byAudience')}`, l. ~624) :

```tsx
            <CtpCard title={t('health.byRole')} sp={sp} dark={dark}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)' }}>
                {byRole.map(({ r, n: nb }) => {
                  // Les rôles sans teinte (bailleur, investisseur, réseau) prennent la sourdine :
                  // la pastille de la liste et la puce de la Santé disent la même chose.
                  const col = (CTP_FN as Record<string, string>)[r] ?? sp.sub
                  return (
                    <CtpSegRow key={r} dot={col} label={t(`roles.${r}`)} count={nb} pct={(nb / n) * 100} color={col}
                      seg={{ type: 'role', value: r, label: t(`roles.${r}`) }} sp={sp} dark={dark} onSegment={onSegment} />
                  )
                })}
              </div>
            </CtpCard>
```

⚠ La clé i18n du titre passe de `health.byAudience` à `health.byRole` (« Par rôle ») dans les quatre langues — DE « Nach Rolle », EN « By role », IT « Per ruolo » —, et `health.byAudience` part : le panneau ne range plus par audience.

- [ ] **Étape 2 : dire le chevauchement**

Sous le bloc des segments de rôle :

```tsx
          <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub }}>{t('segments.roleOverlap')}</p>
```

- [ ] **Étape 3 : la médiane de budget suit la demande**

`buyerBudgets` lisait `audienceOf(c) === 'buyer'`, donc comptait les leads et les investisseurs. Le remplacer par le rôle :

```ts
  const buyerBudgets = contacts.filter(c => c.roles.includes('buyer'))
```

- [ ] **Étape 4 : compiler**

```bash
npx tsc -b
```

Attendu : sortie 0.

---

## Tâche 9 : la fiche — éditer les rôles, et la règle des critères

**Fichiers :**
- Modifier : `src/components/crm/contacts-pager/ContactDetailPager.tsx`
- Modifier : `src/pages/agent/ContactDetailPage.tsx`

- [ ] **Étape 1 : l'en-tête montre tous les rôles**

Dans `ContactDetailPager.tsx`, remplacer la pastille unique (l. ~1669) par la suite des rôles : la même pastille pour le rôle dominant, puis les autres en pastilles sourdes (filet + encre `P.muted`), séparées par l'espacement existant. `audienceKey` reste pour le CTA et le budget d'en-tête (`isSeller`), qui lisent toujours `fiche.audience`.

```tsx
            {/* Étape 3 : tous les rôles, le dominant peint, les autres sourds. ⛔ Un contact
                SANS rôle n'affiche aucune pastille — « lead » n'est pas un rôle, et inventer
                `roles.lead` ferait entrer un stade dans le vocabulaire des rôles. */}
            {fiche.roles.map((r) => {
              const teinte: string | undefined = (CTP_FN as Record<string, string>)[r]
              const peint = r === roleDominant(fiche.roles) && !!teinte
              return (
                <span key={r} style={{
                  display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 var(--crm-space-md)',
                  borderRadius: 'var(--crm-radius-pill)',
                  background: peint ? teinte : 'transparent',
                  color: peint ? encreSur(teinte!) : P.muted,
                  border: peint ? '0' : `1px solid ${P.sp.cardBorder}`,
                  fontSize: 'var(--crm-text-sm)', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
                }}>{t(`roles.${r}`)}</span>
              )
            })}
```

⚠ `fiche.roles` n'existe pas encore sur le modèle de la fiche : l'ajouter au type que `ContactDetailPage` construit (`fiche`), rempli par `rolesOrdonnes(contact.roles)`, à côté de `fiche.audience` qui reste pour le CTA et le budget d'en-tête.

- [ ] **Étape 2 : éditer les rôles dans le bloc identité**

L'identité s'édite dans `CdIdentityModal` (`ContactDetailPager.tsx:615`), sur un brouillon `NmDraft`. Lui ajouter `roles: RoleContact[]`, le remplir depuis `rolesOrdonnes(fiche.roles)` là où `nmDraft` est initialisé, et poser les deux groupes sous les champs d'identité :

```tsx
        <div style={{ marginTop: 20 }}>
          <div style={cdLbl(P)}>{t('fiche.identity.roles')}</div>
          {([ROLES_TRANSACTION, ROLES_RESEAU] as const).map((liste, i) => (
            <div key={i} style={{ display: 'flex', gap: 'var(--crm-space-md)', flexWrap: 'wrap', marginTop: i === 0 ? 8 : 10 }}>
              {liste.map((r) => (
                <CdPickChip key={r} on={draft.roles.includes(r)} P={P}
                  onClick={() => setDraft((s) => ({
                    ...s,
                    roles: s.roles.includes(r) ? s.roles.filter((x) => x !== r) : rolesOrdonnes([...s.roles, r]),
                  }))}>
                  {t(`roles.${r}`)}
                </CdPickChip>
              ))}
            </div>
          ))}
        </div>
```

L'enregistrement (`requestSaveId` → `onSave`) envoie `roles: draft.roles` avec les autres champs d'identité ; le déclencheur pose `type`.

⚠ `CdPickChip` existe déjà (`ContactDetailPager.tsx:319`, employé par les critères du lot C) : le réutiliser tel quel, ne pas en écrire un second. Clé i18n neuve : `fiche.identity.roles` (« Rôles » · DE « Rollen » · EN « Roles » · IT « Ruoli »), dans les quatre langues.

- [ ] **Étape 3 : la règle des critères, côté fiche**

Dans `src/pages/agent/ContactDetailPage.tsx`, `onSaveCriteria` (l. 206-218) :

```ts
      onSaveCriteria={async (c) => {
        // Étape 3 : une SEULE règle décide où vont les critères — le contact porte-t-il un
        // rôle de DEMANDE (acquéreur, locataire, investisseur) ? Avant, deux règles
        // divergeaient : la création regardait buyer|tenant, la fiche tout sauf seller|landlord.
        // Un vendeur qui achète a maintenant les deux : ses critères ET son bien.
        const roles = rolesOrdonnes(contact.roles)
        if (!porteDemande(roles)) {
          await update.mutateAsync({ id, form_data: { ...fd, offer: c } })
        } else {
          await update.mutateAsync({ id, search_criteria: buildSearchCriteria(c) })
        }
        refreshList()
      }}
```

- [ ] **Étape 4 : compiler et jouer les specs de la fiche**

```bash
npx tsc -b && npx vitest run tests/unit/contact-criteres-explique.spec.ts
```

Attendu : sortie 0, et la spec du lot C toujours verte.

---

## Tâche 10 : la création — plusieurs rôles, et l'IA qui ajoute

**Fichiers :**
- Modifier : `src/components/crm/contacts-pager/NewContactModal.tsx`
- Modifier : `src/pages/agent/ContactsPage.tsx`
- Modifier : `src/hooks/useContacts.ts`

- [ ] **Étape 1 : le formulaire porte des rôles**

Dans `NewContactModal.tsx` : `NewContactData.type` devient `roles: RoleContact[]`, `TYPE_IDS` devient les deux groupes, l'état initial passe de `type: 'buyer'` à `roles: ['buyer']`, et chaque lecture de `f.type` se dérive :

```ts
const ROLE_IDS_TRANSACTION: readonly RoleContact[] = ROLES_TRANSACTION
const ROLE_IDS_RESEAU: readonly RoleContact[] = ROLES_RESEAU

// …dans le composant :
const dominant = roleDominant(f.roles)
const isBuyer = porteDemande(f.roles)            // remplace f.type === 'buyer' || f.type === 'tenant'
const estLocataire = f.roles.includes('tenant')   // budget → loyer
const estVendeur = f.roles.includes('seller') || f.roles.includes('landlord')
const tc = dominant ? C.typeColor[dominant] ?? C.typeColor.buyer : C.typeColor.buyer
const budgetKo = f.roles.includes('buyer') && bMin !== null && bMax !== null && bMin > bMax
```

Le contrôle segmenté (l. ~1650) devient un choix MULTIPLE : `aria-pressed` reste, le clic bascule au lieu de remplacer, et les rôles de réseau suivent sur une seconde rangée.

```tsx
              {([ROLE_IDS_TRANSACTION, ROLE_IDS_RESEAU] as const).map((liste, rangee) => (
                <div key={rangee} style={{ display: 'flex', gap: 'var(--crm-space-2xs)', background: C.white, padding: 'var(--crm-space-2xs)', borderRadius: 'var(--crm-radius-pill)', boxShadow: C.shadowSm, flexWrap: 'wrap' }}>
                  {liste.map((id) => {
                    const on = f.roles.includes(id)
                    const col = C.typeColor[id]
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setF((s) => ({
                          ...s,
                          roles: s.roles.includes(id) ? s.roles.filter((x) => x !== id) : rolesOrdonnes([...s.roles, id]),
                        }))}
                        style={{
                          height: 30, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit',
                          background: on ? (col ?? C.inkSoft) : 'transparent',
                          color: on ? '#fff' : C.inkSoft,
                          fontSize: 'var(--crm-text-md)', fontWeight: 600,
                        }}>
                        {t(`roles.${id}`)}
                      </button>
                    )
                  })}
                </div>
              ))}
```

⚠ `TYPE_COLOR` est typé `Record<ContactType, string>` avec quatre clés : le passer à `Partial<Record<RoleContact, string>>` et garder ses quatre teintes. Les huit rôles sans teinte s'allument en `C.inkSoft` — même règle que la liste : aucune couleur nouvelle.

⚠ `NcbTypePillM` (l. 437) est une pastille d'AFFICHAGE, employée par l'écran de succès : elle prend `type`, à remplacer par le rôle dominant (`roleDominant(f.roles)`), sinon la fiche express affiche la couleur d'un type qui n'existe plus.

- [ ] **Étape 2 : l'IA AJOUTE le rôle au lieu d'écraser la saisie**

Dans l'extraction « coller un message » (l. ~1381), remplacer :

```ts
        const type: ContactType = x.intent === 'seller' ? 'seller' : x.intent === 'tenant' ? 'tenant' : 'buyer'
        const n = { ...s, type }
```

par :

```ts
        // ⛔ L'extraction AJOUTE le rôle déduit, elle n'écrase plus le choix de l'agent :
        // coller un message remplaçait « Vendeur » par « Acquéreur » sans le dire.
        const deduit: RoleContact = x.intent === 'seller' ? 'seller' : x.intent === 'tenant' ? 'tenant' : 'buyer'
        const n = { ...s, roles: rolesOrdonnes([...s.roles, deduit]) }
```

et, plus bas, `if (type === 'seller')` devient `if (deduit === 'seller')`.

- [ ] **Étape 3 : la règle des critères, côté création**

Dans `src/pages/agent/ContactsPage.tsx` (l. 82-95) :

```ts
    // Étape 3 : la MÊME règle que la fiche — un rôle de demande écrit des critères.
    const demande = porteDemande(data.roles)
    const criteria = demande && data.criteria ? buildSearchCriteria(data.criteria) : null
    const offer: CriteriaInput | null = !demande && data.linkedBien
      ? {
          transaction: data.roles.includes('landlord') ? 'location' : 'vente',
          types: [data.linkedBien.propType],
          cantons: [],
          cities: data.linkedBien.address ? [data.linkedBien.address] : [],
        }
      : null
```

et l'insertion passe `roles: data.roles` au lieu de `type: data.type`.

- [ ] **Étape 4 : le hook accepte les rôles**

Dans `src/hooks/useContacts.ts` :

```ts
interface CreateContactInput {
  firstName: string
  lastName: string
  email: string | null
  phone?: string
  /** Étape 3 : les rôles. `type` est dérivé par le déclencheur, on ne l'écrit plus ici. */
  roles: RoleContact[]
}

interface ContactFilters {
  role?: RoleContact
  score?: ContactScore
  search?: string
}
```

```ts
  if (filters?.role) baseQuery = baseQuery.overlaps('roles', [filters.role])
```

et l'INSERT remplace `type: input.type` par `roles: input.roles`.

⚠ `select('*')` rapporte déjà `roles` une fois la colonne créée : aucune liste de colonnes à mettre à jour.

- [ ] **Étape 5 : compiler et jouer la suite unitaire des contacts**

```bash
npx tsc -b && bash -c 'npx vitest run $(grep -rl "contacts" tests/unit --include="*.spec.ts*" | tr "\n" " ")'
```

Attendu : sortie 0, aucune spec rouge.

---

## Tâche 11 : un contact de réseau n'est pas un lead dormant

**Fichiers :**
- Modifier : `supabase/functions/automation-engine/index.ts` (règle R3, l. ~286-300)

- [ ] **Étape 1 : écarter les contacts de réseau pur**

```ts
      const { data: dormantLeads } = await supabase
        .from('contacts')
        .select('id, roles')
        .eq('agency_id', agency_id)
        .in('type', ['buyer', 'lead', 'investor', 'both'])
        .lt('last_interaction_at', thirtyDaysAgo)

      // Étape 3 : un contact qui ne porte que des rôles de RÉSEAU (avocat, private banker…)
      // prend `type = 'lead'` faute de rôle de transaction. Ce n'est pas un lead dormant :
      // sans cette garde, l'avocat de l'étude arrive en relance au 31ᵉ jour.
      const dormants = (dormantLeads || []).filter((c) => {
        const roles = Array.isArray(c.roles) ? (c.roles as string[]) : []
        return roles.length === 0 || roles.some((r) => ['buyer', 'seller', 'tenant', 'landlord', 'investor'].includes(r))
      })

      for (const contact of dormants) {
```

⚠ **La liste est écrite EN DUR ici, et c'est voulu** : `supabase/functions/` est un runtime Deno, il ne peut pas importer `src/lib/contactRoles.ts` (bundle navigateur). Pour qu'elle ne dérive pas, ajouter cette assertion à `tests/unit/contacts-roles-vocabulaire.spec.ts` :

```ts
  it('la garde du moteur d’automatisations connaît les mêmes rôles de transaction', () => {
    const ts = lire('supabase/functions/automation-engine/index.ts')
    // ⛔ On relit la LIGNE qui porte la liste, jamais une fenêtre de caractères après un
    // marqueur : un commentaire déplacé d'une ligne ferait rougir une spec fondée sur une
    // distance, alors que le code serait juste.
    const ligne = ts.split('\n').find((l) => ROLES_TRANSACTION.every((r) => l.includes(`'${r}'`)))
    expect(ligne, 'la ligne de R3 qui liste les rôles de transaction').toBeDefined()
    const cites = [...ligne!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!)
    expect(new Set(cites)).toEqual(new Set(ROLES_TRANSACTION))
  })
```

(et importer `ROLES_TRANSACTION` en tête de la spec.)

- [ ] **Étape 2 : vérifier le module Deno**

```bash
deno check supabase/functions/automation-engine/index.ts
```

Attendu : aucune erreur.

---

## Tâche 12 : le banc

**Fichiers :**
- Modifier : `src/pages/dev/crmFixtures.ts`
- Créer : `tests/unit/banc-contacts-roles.spec.ts`

- [ ] **Étape 1 : les fixtures portent des rôles**

Dans le gabarit `contact(...)` de `crmFixtures.ts`, ajouter `roles: ['buyer'],` à côté de `type: 'buyer'`, puis poser les cas qui comptent :

⚠ **Les identifiants du tableau ci-dessous ont été RELEVÉS le 22.09.2026**, après que le fil de
matchs et le lot C ont rempli le banc : `c3`, `c7`, `c9` et `c11` ne désignent plus ce que ce plan
supposait. Les CAS comptent, pas les numéros — les poser sur les contacts qui SONT déjà ce qu'ils
éprouvent, et vérifier par `grep` avant d'écrire.

| Contact | `roles` | Ce qu'il éprouve |
|---|---|---|
| `c2` Théo Baumgartner (vendeur) | `['seller', 'referrer', 'trustee']` | Trois rôles : la pastille + « +2 », le survol, la fiche |
| `c8` Léa Martin (lead) | `[]` | Un contact sans rôle : aucune pastille, `type = 'lead'` |
| `c6` Olivier Mottier (`both`) | `['buyer', 'seller']` | L'acquéreur-vendeur, enfin écrivable |
| `c14` Jean-Marc Dupraz (neuf) | `['private_banker']` | Le réseau pur : présent au sélecteur, absent des quatre onglets |
| `c4`, `c5`, `c7` | `['tenant']`, `['landlord']`, `['investor']` | Leur `type` les disait déjà ; sans rôle explicite, le défaut du gabarit les contredisait |

⚠ `type` reste posé dans les fixtures, cohérent avec les rôles (le banc n'a pas de déclencheur : c'est à la fixture d'être d'accord avec elle-même, comme pour `first_seen_at` au lot C).

- [ ] **Étape 2 : la spec du banc**

`tests/unit/banc-contacts-roles.spec.ts` :

```ts
/**
 * Le banc des rôles multiples : ses fixtures disent-elles ce que l'écran montrera ?
 * ⛔ Un banc qui ment coûte plus qu'un banc absent (leçon du 21.09.2026).
 */
import { describe, expect, it } from 'vitest'
import { CONTACTS } from '@/pages/dev/crmFixtures'
import { rolesOrdonnes, typeDeRoles } from '@/lib/contactRoles'

describe('les contacts du banc', () => {
  it('chaque contact porte des rôles connus, ordonnés', () => {
    for (const c of CONTACTS) {
      const roles = (c as { roles?: unknown[] }).roles ?? []
      expect(rolesOrdonnes(roles), c.id).toEqual(roles)
    }
  })

  it('le type de chaque fixture est celui que le déclencheur poserait', () => {
    for (const c of CONTACTS) {
      const roles = rolesOrdonnes((c as { roles?: unknown[] }).roles ?? [])
      expect(typeDeRoles(roles), c.id).toBe((c as { type: string }).type)
    }
  })

  it('le banc porte les quatre cas de l’étape 3', () => {
    const par = (id: string) => rolesOrdonnes((CONTACTS.find((c) => c.id === id) as { roles?: unknown[] })?.roles ?? [])
    expect(par('c3')).toEqual(['seller', 'referrer', 'trustee'])
    expect(par('c9')).toEqual([])
    expect(par('c7')).toEqual(['buyer', 'seller'])
    expect(par('c11')).toEqual(['private_banker'])
  })
})
```

⚠ `CONTACTS` n'est peut-être pas exporté par `crmFixtures.ts` : vérifier (`grep -n "^const CONTACTS\|export" src/pages/dev/crmFixtures.ts`) et l'exporter si besoin, comme le lot C l'a fait pour ses tableaux.

- [ ] **Étape 3 : jouer la spec**

```bash
npx vitest run tests/unit/banc-contacts-roles.spec.ts
```

Attendu : `Tests  3 passed`.

- [ ] **Étape 4 : regarder le banc**

Ouvrir `http://localhost:5173/dev/crm?entree=/dashboard/contacts` et vérifier, en clair **et** en sombre :

1. les quatre onglets comptent par rôle, et la somme dépasse le total ;
2. le sélecteur « Rôle » liste les rôles présents avec leur compte, et « Private banker (1) » filtre à un contact ;
3. la ligne de `c3` montre « Vendeur +2 », les trois noms au survol ;
4. `c9` ne montre aucune pastille ;
5. la fiche de `c3` montre ses trois rôles et les laisse décocher ;
6. la fiche de `c7` (acquéreur-vendeur) montre à la fois ses critères et son bien.

---

## Tâche 13 : vérification, docs et cerveau

- [ ] **Étape 1 : les portes**

```bash
npx tsc -b && npx eslint src tests --quiet
bash -c 'for g in lint:prose lint:i18n lint:deadcode lint:deps lint:types-freshness lint:roster lint:edge-auth lint:email-shell lint:migrations lint:whatsapp-outbound lint:spec-sql i18n:parity:ci i18n:coverage:ci check:privileges; do printf "%-28s" "$g"; npm run --silent $g >/dev/null 2>&1 && echo "✓" || echo "✗"; done'
```

Attendu : sortie 0 pour `tsc` et `eslint`, et « ✓ » sur les quatorze portes. ⚠ `check:drift` et `lint:claude-md` ont besoin de `SUPABASE_ACCESS_TOKEN` : sans lui, ils ne mesurent qu'une partie et le DISENT — ne pas les compter verts pour autant.

- [ ] **Étape 2 : la suite unitaire, SEULE**

```bash
npx vitest run
```

Attendu : aucune régression. Trois échecs sont connus et hors sujet en local : `mail/imap`, `mail/mime-parse`, `safe-internal-path`.

- [ ] **Étape 3 : le build**

```bash
npm run build
```

Attendu : sortie 0.

- [ ] **Étape 4 : les docs**

- `docs/schema.md` : la colonne `roles` sous `contacts`, avec le déclencheur et la règle de dérivation.
- `docs/system-map.md` : les rôles dans la couche relationnelle (§E ou la section Contacts).
- `CLAUDE.md` §8 : une phrase sur les rôles multiples, l'étape 3, sur branche.
- `docs/superpowers/feuille-de-route.md` : l'état de l'étape 3.
- Cerveau : une entrée `megga/contacts-roles` dans `.claude-flow/knowledge/megga-memory.seed.json`, puis `npm run ruflo:seed`.

- [ ] **Étape 5 : les commits, au signal de Julien**

Un commit par sujet, dans l'ordre des tâches :

```
feat(contacts): les rôles multiples — la base, le déclencheur et le vocabulaire   (tâches 1-4)
feat(contacts): la liste filtre, compte et cherche par rôle                        (tâches 5-8)
feat(contacts): la fiche et la création portent plusieurs rôles                    (tâches 9-10)
fix(automatisations): un contact de réseau n'est pas un lead dormant               (tâche 11)
test(banc): les rôles multiples sur le banc                                        (tâche 12)
docs(contacts): les rôles multiples — spec, plan, schéma et cerveau                (tâche 13)
```

---

## Décisions prises (rappel)

1. **Douze rôles**, dont locataire et bailleur ; « prospect » n'est pas un rôle.
2. **Deux familles** : cinq rôles de transaction commandent, sept rôles de réseau décrivent.
3. **`contacts.roles` fait foi**, `type` tenu en synchro par un déclencheur bidirectionnel.
4. **Sous-nav courte + sélecteur « Rôle »**.
5. **Une pastille + « +2 »** sur une ligne.

## En attente (hors périmètre — rien n'est fait sans accord de Julien)

- `deriveKycType` et `deriveDealParty` ne s'accordent pas sur `landlord`.
- Le scoring de contact ne note que `buyer` et `lead`.
- La règle R5 des automatisations ne relance que `seller` : un bailleur négligé, jamais.
- La whitelist de R6 (`contact_nba_v1`) est tautologique.
- Le mobile compare `c.type !== seg` : son segment « Vendeurs » rate les bailleurs.
- `calendar:role.landlord` dit encore « Propriétaire ».
- `mapContactType` et `mockData` aplatissent encore sept valeurs en cinq.
- `idx_contacts_type` n'est pas composite avec `agency_id`.
- Les rôles ne sont ni datés ni justifiés : « prescripteur depuis mars » attend l'étape 6.
