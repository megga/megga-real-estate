# Onboarding KYB — étapes 0 et 1 : plan d'implémentation

> **Pour les agents :** SOUS-SKILL REQUIS — utiliser `superpowers:subagent-driven-development`
> (recommandé) ou `superpowers:executing-plans` pour exécuter ce plan tâche par tâche.
> Les étapes utilisent la syntaxe case à cocher (`- [ ]`) pour le suivi.

**Goal :** rendre la branche KYB mergeable et corriger le chemin d'inscription pour que
le dirigeant d'une agence puisse réellement saisir son identité, ce qui est impossible
aujourd'hui.

**Architecture :** tout se joue en SQL, dans des migrations Postgres idempotentes. Aucun
code frontend. Le trigger d'inscription, absent du contrôle de version, y entre ; la
fonction `handle_new_user()` et son aide `provision_solo_agency()` sont réécrites une
seule fois, en trois incréments testés ; `join_agency()` est fermée ; deux colonnes
additives préparent l'étape 2.

**Tech stack :** PostgreSQL 17, Supabase CLI 2.98, Vitest (harnais backend
`vitest.backend.config.ts`), Docker via OrbStack.

**Conception de référence :**
[spec du parcours](../specs/2026-07-26-onboarding-kyb-design.md) et
[relais KYB](../../agency-kyb-handoff.md) §6.

---

## Global Constraints

Ces règles s'appliquent à **toutes** les tâches. Elles viennent de `CLAUDE.md` et de la
section « Contraintes projet » du document de conception.

- Migrations **idempotentes et rejouables** : la CI ré-applique les migrations datées du
  jour à chaque déploiement. `ADD CONSTRAINT` seul n'est pas idempotent, donc
  `DROP CONSTRAINT IF EXISTS` d'abord. Idem `DROP TRIGGER IF EXISTS` avant `CREATE TRIGGER`.
- Nommage : `YYYYMMDDHHMMSS_nom.sql`. Le skill `supabase-migration` documente
  `YYYYMMDD_NNN_`, c'est périmé, ne pas le suivre.
- **Date du jour obligatoire** : `deploy.yml` n'applique que les migrations dont
  l'horodatage est `>= TODAY` (UTC). Toute migration de ce plan est datée du 26.07.2026.
- RLS obligatoire sur chaque table, jamais `USING (true)`.
- Index sur chaque colonne FK utilisée en `WHERE` ou `JOIN`.
- `get_my_agency_id()` et `is_agency_admin()` : helpers `SECURITY DEFINER` existants, à
  réutiliser, ne pas réécrire.
- Fonctions `SECURITY DEFINER` : `SET search_path TO 'public'` systématique, et
  `REVOKE EXECUTE ... FROM PUBLIC, anon` au minimum (discipline
  `20260711210000_secdef_execute_revoke`).
- `activity_events` : `category` dans `kyc | deal | contact | bien | doc | auth |
  settings | ai` (`'compliance'` **fait échouer** le CHECK), `severity` dans
  `info | warn | critical`, et avec `actor_kind='system'` le champ `actor_id` **doit
  être NULL** (contrainte `activity_events_actor_kind_coherence`).
- Commentaires SQL en français, expliquant le **pourquoi**. Pas de glose ligne à ligne.
- Les tests backend sont derrière `describe.skipIf(!HAS_KEYS)` : **toujours lire le
  compte de tests, jamais le code de sortie**. `16 skipped` est un échec silencieux.

### Prérequis d'environnement

OrbStack conserve des redirections de ports fantômes sur 54321 à 54327. **Redémarrer
l'application OrbStack** avant de commencer, sinon `supabase start` échoue avec
`bind: address already in use`.

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && supabase start
```

Puis créer `.env.test.local` (non versionné, lu par `vitest.backend.setup.ts`) :

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && printf 'SUPABASE_TEST_URL=http://127.0.0.1:54321\nSUPABASE_TEST_ANON_KEY=%s\nSUPABASE_TEST_SERVICE_ROLE_KEY=%s\n' "$(supabase status -o json | jq -r .ANON_KEY)" "$(supabase status -o json | jq -r .SERVICE_ROLE_KEY)" > .env.test.local
```

Vérifier qu'il est bien ignoré par git :

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && git check-ignore -v .env.test.local
```

Attendu : une ligne citant `.gitignore`. Si la commande ne renvoie rien, **ne pas
continuer** : le fichier contient des clés et partirait au commit.

---

## Structure des fichiers

| Fichier | Responsabilité | Action |
|---|---|---|
| `supabase/migrations/20260726130000_legal_forms_reference.sql` | référentiel des formes juridiques (Antoine) | Renommer depuis `120000` |
| `supabase/migrations/20260726130100_agencies_kyb_columns.sql` | colonnes KYB de `agencies` (Antoine) | Renommer depuis `120100` |
| `supabase/migrations/20260726130200_agency_related_persons.sql` | personnes de conformité (Antoine) | Renommer depuis `120200` |
| `supabase/migrations/20260726130300_agency_verification_checks.sql` | journaux de checks (Antoine) | Renommer depuis `120300` |
| `supabase/migrations/20260726140000_auth_user_created_trigger.sql` | le trigger d'inscription entre au contrôle de version | Créer |
| `supabase/migrations/20260726140100_signup_agency_provisioning.sql` | réécriture de `provision_solo_agency()` et `handle_new_user()` : rôle du fondateur, nom d'agence, invités | Créer, étendu par 3 tâches |
| `supabase/migrations/20260726140200_revoke_join_agency.sql` | fermeture de `join_agency()` | Créer |
| `supabase/migrations/20260726140300_agencies_identity_submission.sql` | `identity_submitted_at` et statut `validated` | Créer |
| `tests/backend/signup-provisioning.spec.ts` | non-régression du chemin d'inscription | Créer |
| `tests/backend/onboarding-agency-rpc.spec.ts` | tests existants de `create_agency_and_join` / `join_agency` | Modifier (tâche 7) |

Un seul fichier de migration porte la réécriture de `handle_new_user` plutôt que trois :
remplacer la même fonction dans trois migrations successives rendrait l'état final
illisible. Les trois tâches l'étendent l'une après l'autre, chacune avec son test.

---

## Task 1 : étape 0, re-dater les migrations d'Antoine

**Files:**
- Renommer : les 4 fichiers `supabase/migrations/20260726120*.sql`

**Interfaces:**
- Consomme : rien.
- Produit : des versions de migration uniques, condition de toutes les tâches suivantes.

**Pourquoi :** `main` porte déjà `20260726120000_realadvisor_shard_map_3day.sql`. La
migration `20260726120000_legal_forms_reference.sql` a la même version sur 14 chiffres.
La commande donnée dans le handoff (`$(date -u +%Y%m%d)${f:8}`) ne réécrit que les 8
chiffres de la date et **ne corrige donc rien le 26 juillet** : elle produit le même nom.
On re-date sur la composante horaire.

- [ ] **Step 1 : constater la collision**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && git ls-tree --name-only main supabase/migrations/ | grep 20260726120000
```

Attendu : `supabase/migrations/20260726120000_realadvisor_shard_map_3day.sql`. C'est la
preuve que la collision est réelle avant de la corriger.

- [ ] **Step 2 : re-dater sur la composante horaire**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update/supabase/migrations && for f in 20260726120*_*.sql; do git mv "$f" "2026072613${f:10}"; done && ls 20260726130*
```

Attendu : les 4 fichiers en `130000`, `130100`, `130200`, `130300`.

- [ ] **Step 3 : vérifier qu'aucune version n'est plus en double**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && ls supabase/migrations/*.sql | sed 's#.*/##; s/_.*//' | sort | uniq -d
```

Attendu : **aucune sortie**. Toute ligne affichée est une version dupliquée restante.

- [ ] **Step 4 : linter d'idempotence**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && npm run lint:migrations
```

Attendu : sortie sans erreur.

- [ ] **Step 5 : la base se monte à neuf**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && supabase db reset
```

Attendu : toutes les migrations appliquées, exit 0.

- [ ] **Step 6 : les 16 tests d'Antoine passent toujours**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && npx vitest run --config=vitest.backend.config.ts tests/backend/agency-kyb-verification.spec.ts
```

Attendu : `Tests 16 passed (16)`. Si tu lis `16 skipped`, `.env.test.local` n'est pas en
place, la tâche n'est **pas** validée.

- [ ] **Step 7 : commit**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && git add -A supabase/migrations && git commit -m "fix(kyb): re-date les migrations KYB, la collision portait sur l'horodatage complet

main porte 20260726120000_realadvisor_shard_map_3day. Le re-datage documente
dans le handoff ne reecrit que la date sur 8 chiffres et laissait donc la
collision intacte le 26 juillet. Re-date sur la composante horaire."
```

---

## Task 2 : versionner le trigger d'inscription

**Files:**
- Créer : `supabase/migrations/20260726140000_auth_user_created_trigger.sql`
- Créer : `tests/backend/signup-provisioning.spec.ts`

**Interfaces:**
- Consomme : `public.handle_new_user()`, définie dans la baseline et modifiée par
  `20260718130000`.
- Produit : le trigger `on_auth_user_created` sur `auth.users`, sans lequel aucune des
  tâches 3 à 5 n'est testable.

**Pourquoi :** aucune migration ne crée ce trigger. En local l'inscription ne produit
donc ni profil ni agence, et en production il vit hors contrôle de version. Une
recherche insensible à la casse sur toutes les migrations ne trouve aucune création de
trigger sur `auth.users`.

**Avant de merger :** faire confirmer par Julien le nom exact du trigger en production.
S'il diffère de `on_auth_user_created`, la migration en créerait un second et chaque
inscription insérerait deux fois. Le `DROP TRIGGER IF EXISTS` ci-dessous ne protège que
du nom connu.

- [ ] **Step 1 : écrire le test qui échoue**

Créer `tests/backend/signup-provisioning.spec.ts` :

```ts
// Non-régression — chemin d'inscription (trigger on_auth_user_created).
//
// Le trigger qui appelle handle_new_user() n'était dans aucune migration : en local
// l'inscription ne créait ni profil ni agence, et en prod l'objet vivait hors du
// contrôle de version. Ces tests exercent une vraie inscription et cassent la CI si
// le trigger disparaît. Migration : 20260726140000_auth_user_created_trigger.

import { describe, it, expect, afterAll } from 'vitest'
import { serviceRoleClient } from './helpers/supabase'

const PW = 'Test-Password-123!'
const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('inscription — provisioning automatique', () => {
  const userIds: string[] = []

  // Inscrit un utilisateur SANS toucher à profiles : tout ce qui suit doit être
  // l'œuvre du trigger, sinon le test ne prouve rien.
  async function signUp(meta: Record<string, string>): Promise<string> {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const { data, error } = await svc.auth.admin.createUser({
      email: `signup-${stamp}@megga-test.local`,
      password: PW,
      email_confirm: true,
      user_metadata: meta,
    })
    if (error) throw new Error(`createUser: ${error.message}`)
    userIds.push(data.user!.id)
    return data.user!.id
  }

  afterAll(async () => {
    const svc = serviceRoleClient()
    for (const id of userIds) {
      const { data: prof } = await svc.from('profiles').select('agency_id').eq('id', id).maybeSingle()
      await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
      if (prof?.agency_id) await svc.from('agencies').delete().eq('id', prof.agency_id).then(() => {}, () => {})
    }
  })

  it('crée le profil sans intervention (le trigger existe)', async () => {
    const id = await signUp({ full_name: 'Alice Trigger', role: 'agent' })
    const svc = serviceRoleClient()
    const { data: prof } = await svc.from('profiles').select('id, role').eq('id', id).maybeSingle()
    expect(prof, 'aucun profil créé : le trigger on_auth_user_created est absent').not.toBeNull()
    expect(prof?.id).toBe(id)
  })
})
```

- [ ] **Step 2 : lancer le test et le voir échouer**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && npx vitest run --config=vitest.backend.config.ts tests/backend/signup-provisioning.spec.ts
```

Attendu : `1 failed`, message « aucun profil créé : le trigger on_auth_user_created est
absent ». Un `1 skipped` signifie que les clés manquent, ce n'est pas un échec valide.

- [ ] **Step 3 : écrire la migration**

Créer `supabase/migrations/20260726140000_auth_user_created_trigger.sql` :

```sql
-- Le trigger d'inscription entre au contrôle de version.
--
-- public.handle_new_user() existe depuis la baseline et a été modifiée deux fois
-- (20260627120000 lockdown du rôle, 20260718130000 provisioning d'agence), mais le
-- TRIGGER qui l'appelle n'a jamais figuré dans aucune migration. Conséquences : en
-- local l'inscription ne crée ni profil ni agence (les tests backend contournaient en
-- posant le profil à la main), et en production le comportement de chaque signup
-- dépend d'un objet que personne ne peut relire ni restaurer.
--
-- ⚠ AVANT MERGE : confirmer le nom du trigger en production. S'il porte un autre nom,
-- celui-ci s'ajouterait au lieu de le remplacer et chaque inscription insérerait deux
-- fois. Le DROP ci-dessous ne couvre que le nom canonique.
--
-- Idempotente : DROP IF EXISTS puis CREATE.

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on function public.handle_new_user() is
  'Trigger AFTER INSERT sur auth.users (on_auth_user_created, versionné par 20260726140000) : crée le profil et provisionne l''agence des rôles agence. Best-effort sur l''agence, un échec ne bloque jamais l''inscription.';
```

- [ ] **Step 4 : appliquer et vérifier que le test passe**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && supabase db reset && npx vitest run --config=vitest.backend.config.ts tests/backend/signup-provisioning.spec.ts
```

Attendu : `Tests 1 passed (1)`.

- [ ] **Step 5 : vérifier par mutation que le test garde ce qu'il prétend**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "drop trigger on_auth_user_created on auth.users;" && npx vitest run --config=vitest.backend.config.ts tests/backend/signup-provisioning.spec.ts
```

Attendu : `1 failed`. Un test qui n'a jamais échoué ne prouve rien. Restaurer ensuite :

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && supabase db reset && npx vitest run --config=vitest.backend.config.ts tests/backend/signup-provisioning.spec.ts
```

Attendu : `Tests 1 passed (1)`.

- [ ] **Step 6 : commit**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && git add supabase/migrations/20260726140000_auth_user_created_trigger.sql tests/backend/signup-provisioning.spec.ts && git commit -m "fix(auth): versionne le trigger d'inscription, invisible jusqu'ici

handle_new_user() etait definie dans les migrations mais le trigger qui
l'appelle ne l'etait nulle part : en local l'inscription ne creait rien, en
prod le comportement dependait d'un objet non relisible et non restaurable."
```

---

## Task 3 : le fondateur devient admin de son agence

**Files:**
- Créer : `supabase/migrations/20260726140100_signup_agency_provisioning.sql`
- Modifier : `tests/backend/signup-provisioning.spec.ts`

**Interfaces:**
- Consomme : le trigger `on_auth_user_created` (tâche 2), `public.is_agency_admin()`
  définie par `20260726130200`.
- Produit : `provision_solo_agency(p_user uuid, p_display_name text) returns uuid`, qui
  pose désormais `role='admin'` sur le fondateur.

**Pourquoi :** la vitrine envoie `role:'agent'`, `handle_new_user()` fige cette valeur et
`provision_solo_agency()` ne touche pas au rôle. Or `is_agency_admin()` exige `admin` ou
`manager`. Le dirigeant échoue donc à la garde qui protège ses propres données KYB.
`create_agency_and_join` fait l'inverse depuis toujours : l'appelant devient `admin`.

- [ ] **Step 1 : écrire le test qui échoue**

Ajouter dans `tests/backend/signup-provisioning.spec.ts`, à l'intérieur du `describe` :

```ts
  it('le fondateur est admin de son agence et passe is_agency_admin()', async () => {
    const id = await signUp({ full_name: 'Bob Fondateur', role: 'agent' })
    const svc = serviceRoleClient()
    const { data: prof } = await svc
      .from('profiles')
      .select('agency_id, role')
      .eq('id', id)
      .maybeSingle()
    expect(prof?.agency_id, 'aucune agence provisionnée').toBeTruthy()
    expect(prof?.role, 'le fondateur doit diriger son agence, sinon is_agency_admin() le bloque').toBe('admin')
  })
```

- [ ] **Step 2 : lancer le test et le voir échouer**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && npx vitest run --config=vitest.backend.config.ts tests/backend/signup-provisioning.spec.ts
```

Attendu : `1 failed | 1 passed`, l'échec portant sur `expected 'agent' to be 'admin'`.

- [ ] **Step 3 : écrire la migration**

Créer `supabase/migrations/20260726140100_signup_agency_provisioning.sql` :

```sql
-- Chemin d'inscription : le fondateur dirige son agence.
--
-- La vitrine envoie role:'agent' dans raw_user_meta_data, handle_new_user() fige cette
-- valeur, et provision_solo_agency() ne touchait pas au rôle. Or is_agency_admin()
-- (20260726130200) exige admin ou manager : le dirigeant échouait donc à la garde qui
-- protège ses propres données de conformité, et le parcours KYB était bloqué avant
-- d'exister. create_agency_and_join fait l'inverse depuis la baseline : l'appelant
-- devient admin de l'agence qu'il crée. On aligne.
--
-- Idempotente : CREATE OR REPLACE.

create or replace function public.provision_solo_agency(p_user uuid, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_name text := coalesce(nullif(btrim(p_display_name), ''), 'Mon agence');
  v_slug text;
  v_id   uuid;
begin
  -- Même génération de slug que create_agency_and_join (cohérence).
  v_slug := lower(regexp_replace(btrim(v_name), '\s+', '-', 'g'));
  if exists (select 1 from agencies where slug = v_slug) then
    v_slug := v_slug || '-' || substring(gen_random_uuid()::text, 1, 6);
  end if;

  insert into agencies (name, slug, solo, plan, status, created_by)
  values (v_name, v_slug, true, 'starter', 'active', p_user)
  returning id into v_id;

  -- Le fondateur DIRIGE l'agence qu'il vient de créer : sans 'admin' il échoue à
  -- is_agency_admin() et ne peut pas saisir sa propre identité KYB. On ne rattache
  -- que si le profil n'a pas encore d'agence (idempotence backfill / double trigger).
  update profiles
     set agency_id = v_id,
         role = 'admin'
   where id = p_user and agency_id is null;

  return v_id;
end;
$$;

revoke all on function public.provision_solo_agency(uuid, text) from public, anon, authenticated;

comment on function public.provision_solo_agency(uuid, text) is
  'Interne : crée l''agence solo d''un inscrit et l''en fait l''admin. Appelée par handle_new_user uniquement. Aucun EXECUTE client.';
```

- [ ] **Step 4 : appliquer et vérifier**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && supabase db reset && npx vitest run --config=vitest.backend.config.ts tests/backend/signup-provisioning.spec.ts
```

Attendu : `Tests 2 passed (2)`.

- [ ] **Step 5 : commit**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && git add supabase/migrations/20260726140100_signup_agency_provisioning.sql tests/backend/signup-provisioning.spec.ts && git commit -m "fix(onboarding): le fondateur dirige son agence

is_agency_admin() exige admin ou manager, la vitrine envoie agent et
provision_solo_agency ne touchait pas au role : le dirigeant echouait a la
garde protegeant ses propres donnees KYB."
```

---

## Task 4 : le nom d'agence saisi à l'inscription est enfin utilisé

**Files:**
- Modifier : `supabase/migrations/20260726140100_signup_agency_provisioning.sql`
- Modifier : `tests/backend/signup-provisioning.spec.ts`

**Interfaces:**
- Consomme : `provision_solo_agency(uuid, text)` de la tâche 3.
- Produit : `handle_new_user()` lit `raw_user_meta_data->>'agency_name'` en priorité.

**Pourquoi :** la vitrine collecte le nom d'agence
([megga-auth.js:369](../../../sites/megga-vitrine/js/megga-auth.js)) et le range dans
`raw_user_meta_data.agency_name`, mais aucun consommateur n'existe en migrations, `src/`
ou edge functions : la donnée est jetée, et l'agence porte le nom de la personne.

**Attention, piège :** `uq_agencies_name_normalized` est un index UNIQUE sur
`lower(btrim(name))`. Deux personnes tapant « Régie Dupont » entrent en collision.
L'insert échoue, il est avalé par le `EXCEPTION WHEN OTHERS` de `handle_new_user`, et le
second utilisateur reste avec `agency_id` NULL, donc un CRM muet puisque toutes les
policies RLS s'y accrochent. D'où le repli en cascade ci-dessous : jamais d'utilisateur
sans agence. Le nom n'est qu'un libellé, c'est `legal_name` saisi au wizard qui porte la
valeur de conformité.

- [ ] **Step 1 : écrire les deux tests qui échouent**

Ajouter dans `tests/backend/signup-provisioning.spec.ts`, à l'intérieur du `describe` :

```ts
  it('nomme l’agence d’après agency_name saisi à l’inscription', async () => {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const agencyName = `Régie Test ${stamp}`
    const id = await signUp({ full_name: 'Carla Nom', role: 'agent', agency_name: agencyName })
    const svc = serviceRoleClient()
    const { data: prof } = await svc.from('profiles').select('agency_id').eq('id', id).maybeSingle()
    const { data: ag } = await svc.from('agencies').select('name').eq('id', prof!.agency_id!).maybeSingle()
    expect(ag?.name, 'le nom saisi à l’inscription doit servir, pas celui de la personne').toBe(agencyName)
  })

  it('en cas de collision de nom, replie sans jamais laisser l’utilisateur sans agence', async () => {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const shared = `Régie Collision ${stamp}`
    const first = await signUp({ full_name: 'Dan Premier', role: 'agent', agency_name: shared })
    const second = await signUp({ full_name: 'Eve Seconde', role: 'agent', agency_name: shared })
    const svc = serviceRoleClient()
    const { data: p1 } = await svc.from('profiles').select('agency_id').eq('id', first).maybeSingle()
    const { data: p2 } = await svc.from('profiles').select('agency_id').eq('id', second).maybeSingle()
    expect(p1?.agency_id, 'le premier doit avoir son agence').toBeTruthy()
    expect(p2?.agency_id, 'le second ne doit JAMAIS rester sans agence : CRM muet garanti').toBeTruthy()
    expect(p2?.agency_id).not.toBe(p1?.agency_id)
  })
```

- [ ] **Step 2 : lancer les tests et les voir échouer**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && npx vitest run --config=vitest.backend.config.ts tests/backend/signup-provisioning.spec.ts
```

Attendu : `2 failed | 2 passed`.

- [ ] **Step 3 : étendre la migration**

Dans `supabase/migrations/20260726140100_signup_agency_provisioning.sql`, **remplacer
intégralement** le bloc `create or replace function public.provision_solo_agency` écrit à
la tâche 3 par la version ci-dessous, puis ajouter le bloc `handle_new_user` à la suite.
Le fichier doit contenir **une seule** définition de chaque fonction : deux définitions
successives laisseraient la première morte et le fichier illisible.

```sql
-- ── Nom de l'agence : utiliser enfin ce que l'utilisateur a saisi ────────────
-- La vitrine range le nom d'agence dans raw_user_meta_data.agency_name depuis
-- toujours, et personne ne le lisait : l'agence portait le nom de la personne.
--
-- Repli en cascade obligatoire : uq_agencies_name_normalized est UNIQUE sur
-- lower(btrim(name)), donc deux « Régie Dupont » entrent en collision. Sans repli,
-- l'insert échoue, l'exception est avalée plus haut, et le second inscrit reste avec
-- agency_id NULL — c'est-à-dire un CRM entièrement muet, toutes les policies RLS
-- s'accrochant à agency_id. On préfère un nom approximatif à un compte inutilisable ;
-- le nom définitif est de toute façon saisi au wizard (agencies.legal_name).

create or replace function public.provision_solo_agency(p_user uuid, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_base  text := coalesce(nullif(btrim(p_display_name), ''), 'Mon agence');
  v_name  text;
  v_slug  text;
  v_id    uuid;
begin
  -- 3 tentatives : le nom voulu, puis suffixé, puis suffixé autrement. Une collision
  -- de nom ne doit jamais coûter son agence à l'utilisateur.
  for i in 1..3 loop
    v_name := case when i = 1 then v_base
                   else v_base || ' ' || substring(gen_random_uuid()::text, 1, 4) end;

    if exists (select 1 from agencies where lower(btrim(name)) = lower(btrim(v_name))) then
      continue;
    end if;

    v_slug := lower(regexp_replace(btrim(v_name), '\s+', '-', 'g'));
    if exists (select 1 from agencies where slug = v_slug) then
      v_slug := v_slug || '-' || substring(gen_random_uuid()::text, 1, 6);
    end if;

    begin
      insert into agencies (name, slug, solo, plan, status, created_by)
      values (v_name, v_slug, true, 'starter', 'active', p_user)
      returning id into v_id;
    exception when unique_violation then
      -- Course entre le SELECT et l'INSERT : on retente.
      v_id := null;
      continue;
    end;

    update profiles
       set agency_id = v_id,
           role = 'admin'
     where id = p_user and agency_id is null;

    return v_id;
  end loop;

  return null;
end;
$$;

revoke all on function public.provision_solo_agency(uuid, text) from public, anon, authenticated;

-- ── handle_new_user : lire agency_name ──────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_full_name   text := coalesce(new.raw_user_meta_data ->> 'full_name',
                                 new.raw_user_meta_data ->> 'name', '');
  v_agency_name text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'agency_name', '')), '');
  v_role        text := case
    when (new.raw_user_meta_data ->> 'role') in
         ('agent', 'manager', 'admin', 'assistant', 'seller', 'buyer', 'particulier')
      then new.raw_user_meta_data ->> 'role'
    else 'buyer'
  end;
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    coalesce(new.email, ''),
    v_full_name,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', ''),
    v_role
  );

  if v_role in ('agent', 'manager', 'admin', 'assistant') then
    begin
      -- Priorité au nom d'agence saisi ; repli sur la personne puis l'e-mail.
      perform public.provision_solo_agency(
        new.id,
        coalesce(v_agency_name,
                 nullif(btrim(v_full_name), ''),
                 split_part(coalesce(new.email, ''), '@', 1))
      );
    exception when others then
      raise warning 'provision_solo_agency failed for %: %', new.id, sqlerrm;
    end;
  end if;

  return new;
end;
$$;
```

- [ ] **Step 4 : appliquer et vérifier**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && supabase db reset && npx vitest run --config=vitest.backend.config.ts tests/backend/signup-provisioning.spec.ts
```

Attendu : `Tests 4 passed (4)`.

- [ ] **Step 5 : commit**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && git add supabase/migrations/20260726140100_signup_agency_provisioning.sql tests/backend/signup-provisioning.spec.ts && git commit -m "fix(onboarding): utilise le nom d'agence saisi a l'inscription

La vitrine le rangeait dans raw_user_meta_data.agency_name depuis toujours et
personne ne le lisait. Repli en cascade sur collision : uq_agencies_name_normalized
aurait sinon laisse le second inscrit sans agence, donc avec un CRM muet."
```

---

## Task 5 : pas d'agence orpheline pour les agents invités

**Files:**
- Modifier : `supabase/migrations/20260726140100_signup_agency_provisioning.sql`
- Modifier : `tests/backend/signup-provisioning.spec.ts`

**Interfaces:**
- Consomme : `handle_new_user()` de la tâche 4, table `team_invitations`
  (`agency_id`, `email`, `status`, `expires_at`, `invited_by`).
- Produit : `handle_new_user()` ne provisionne plus d'agence quand une invitation
  valide existe pour l'e-mail.

**Pourquoi :** un agent invité doit d'abord créer son compte, ce qui déclenche
`handle_new_user` et lui fabrique une agence solo, avant que `accept-team-invite` ne
réécrive son `agency_id` vers la vraie agence
([index.ts:129](../../../supabase/functions/accept-team-invite/index.ts)). Chaque agent
invité laisse donc une agence morte en base.

- [ ] **Step 1 : écrire le test qui échoue**

Ajouter dans `tests/backend/signup-provisioning.spec.ts`, à l'intérieur du `describe` :

```ts
  it('ne provisionne aucune agence quand une invitation valide attend l’e-mail', async () => {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`

    // Une agence hôte et son dirigeant, qui émettra l'invitation.
    const hostId = await signUp({ full_name: 'Hôte Agence', role: 'agent', agency_name: `Hôte ${stamp}` })
    const { data: host } = await svc.from('profiles').select('agency_id').eq('id', hostId).maybeSingle()
    const invitedEmail = `invite-${stamp}@megga-test.local`

    const { error: invErr } = await svc.from('team_invitations').insert({
      agency_id: host!.agency_id, email: invitedEmail, role: 'agent', invited_by: hostId,
    })
    expect(invErr, `insert invitation: ${invErr?.message}`).toBeNull()

    const { data: created, error } = await svc.auth.admin.createUser({
      email: invitedEmail, password: PW, email_confirm: true,
      user_metadata: { full_name: 'Invité Test', role: 'agent' },
    })
    if (error) throw new Error(`createUser invité: ${error.message}`)
    userIds.push(created.user!.id)

    const { data: prof } = await svc
      .from('profiles').select('agency_id').eq('id', created.user!.id).maybeSingle()
    expect(prof, 'le profil doit exister').not.toBeNull()
    expect(prof?.agency_id, 'un invité ne doit PAS recevoir d’agence solo : accept-team-invite la rendrait orpheline').toBeNull()
  })
```

- [ ] **Step 2 : lancer le test et le voir échouer**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && npx vitest run --config=vitest.backend.config.ts tests/backend/signup-provisioning.spec.ts
```

Attendu : `1 failed | 4 passed`, l'échec portant sur un `agency_id` non nul.

- [ ] **Step 3 : étendre la migration**

Dans `supabase/migrations/20260726140100_signup_agency_provisioning.sql`, **remplacer
intégralement** le bloc `create or replace function public.handle_new_user` écrit à la
tâche 4 par la version ci-dessous. Le fichier doit rester avec **une seule** définition
de chaque fonction.

```sql
-- ── Agent invité : ne pas fabriquer d'agence qui sera aussitôt orpheline ────
-- Un invité crée d'abord son compte (le trigger lui fabriquait une agence solo),
-- puis accept-team-invite réécrit son agency_id vers la vraie agence : l'agence solo
-- restait en base, morte, une par agent invité. On ne provisionne donc pas quand une
-- invitation valide attend cet e-mail ; accept-team-invite fait le rattachement.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_full_name   text := coalesce(new.raw_user_meta_data ->> 'full_name',
                                 new.raw_user_meta_data ->> 'name', '');
  v_agency_name text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'agency_name', '')), '');
  v_role        text := case
    when (new.raw_user_meta_data ->> 'role') in
         ('agent', 'manager', 'admin', 'assistant', 'seller', 'buyer', 'particulier')
      then new.raw_user_meta_data ->> 'role'
    else 'buyer'
  end;
  v_invited     boolean;
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    coalesce(new.email, ''),
    v_full_name,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', ''),
    v_role
  );

  select exists (
    select 1 from public.team_invitations
    where lower(email) = lower(coalesce(new.email, ''))
      and status = 'pending'
      and expires_at > now()
  ) into v_invited;

  if v_role in ('agent', 'manager', 'admin', 'assistant') and not v_invited then
    begin
      perform public.provision_solo_agency(
        new.id,
        coalesce(v_agency_name,
                 nullif(btrim(v_full_name), ''),
                 split_part(coalesce(new.email, ''), '@', 1))
      );
    exception when others then
      raise warning 'provision_solo_agency failed for %: %', new.id, sqlerrm;
    end;
  end if;

  return new;
end;
$$;
```

- [ ] **Step 4 : appliquer et vérifier**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && supabase db reset && npx vitest run --config=vitest.backend.config.ts tests/backend/signup-provisioning.spec.ts
```

Attendu : `Tests 5 passed (5)`.

- [ ] **Step 5 : commit**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && git add supabase/migrations/20260726140100_signup_agency_provisioning.sql tests/backend/signup-provisioning.spec.ts && git commit -m "fix(onboarding): plus d'agence orpheline par agent invite

L'invite creait son compte, recevait une agence solo, puis accept-team-invite
reecrivait son agency_id : l'agence restait en base, morte, une par invite."
```

---

## Task 6 : fermer `join_agency`

**Files:**
- Créer : `supabase/migrations/20260726140200_revoke_join_agency.sql`
- Modifier : `tests/backend/onboarding-agency-rpc.spec.ts`

**Interfaces:**
- Consomme : `public.join_agency(uuid)`.
- Produit : `join_agency(uuid)` n'est plus exécutable par `authenticated`.

**Pourquoi :** la fonction ne vérifie aucune invitation et reste accordée à
`authenticated`. N'importe quel compte authentifié peut s'attacher à n'importe quelle
agence par son UUID et devenir `agent` dessus, avec l'accès RLS aux contacts, deals et
dossiers KYC de cette agence. Le commentaire d'origine annonçait son remplacement par un
workflow validé, qui n'est jamais venu. `accept-team-invite` couvre le besoin avec
vérification d'expiration et de correspondance d'e-mail.

- [ ] **Step 1 : écrire le test qui échoue**

Dans `tests/backend/onboarding-agency-rpc.spec.ts`, **remplacer intégralement** le test
`un second agent rejoint une agence existante via join_agency (aucune erreur de type)`
par :

```ts
  it('join_agency n’est plus exécutable par un compte authentifié (faille cross-agence fermée)', async () => {
    const { client: owner } = await freshAgent('owner')
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const { data: agencyId, error: cErr } = await owner.rpc('create_agency_and_join', {
      p_name: `Agence Join ${stamp}`, p_city: 'Lausanne', p_canton: 'VD', p_solo: false,
    })
    expect(cErr).toBeNull()
    agencyIds.push(agencyId as string)

    const { client: intruder, id: intruderId } = await freshAgent('intrus')
    const { error: jErr } = await intruder.rpc('join_agency', { p_agency_id: agencyId })
    expect(jErr, 'join_agency doit être refusée : sans garde, tout compte rejoignait toute agence').not.toBeNull()

    const svc = serviceRoleClient()
    const { data: prof } = await svc.from('profiles').select('agency_id').eq('id', intruderId).maybeSingle()
    expect(prof?.agency_id, 'l’intrus ne doit pas avoir rejoint l’agence').not.toBe(agencyId)
  })
```

- [ ] **Step 2 : lancer le test et le voir échouer**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && npx vitest run --config=vitest.backend.config.ts tests/backend/onboarding-agency-rpc.spec.ts
```

Attendu : `1 failed`, l'échec disant que `jErr` est nul, c'est-à-dire que l'appel a
réussi. C'est la faille, constatée avant d'être fermée.

- [ ] **Step 3 : écrire la migration**

Créer `supabase/migrations/20260726140200_revoke_join_agency.sql` :

```sql
-- Fermeture de join_agency(uuid).
--
-- La fonction ne vérifie aucune invitation et restait accordée à authenticated : tout
-- compte authentifié pouvait s'attacher à n'importe quelle agence par son UUID et
-- devenir agent dessus, avec l'accès RLS aux contacts, deals et dossiers KYC de cette
-- agence. Le commentaire d'origine (baseline) annonçait déjà son remplacement par un
-- workflow agency_join_requests validé par un admin, jamais écrit.
--
-- Le besoin est couvert par accept-team-invite, qui vérifie l'expiration et la
-- correspondance d'e-mail. La fonction est conservée (service_role) plutôt que
-- supprimée : elle reste utile pour un rattachement d'exploitation.
--
-- Idempotente : REVOKE est rejouable.

revoke execute on function public.join_agency(uuid) from public, anon, authenticated;

comment on function public.join_agency(uuid) is
  'Rattachement direct d''un utilisateur à une agence, SANS vérification d''invitation. Révoquée de authenticated le 26.07.2026 (faille cross-agence) : service_role uniquement. Le chemin utilisateur est accept-team-invite.';
```

- [ ] **Step 4 : appliquer et vérifier**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && supabase db reset && npx vitest run --config=vitest.backend.config.ts tests/backend/onboarding-agency-rpc.spec.ts
```

Attendu : `Tests 3 passed (3)`.

- [ ] **Step 5 : commit**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && git add supabase/migrations/20260726140200_revoke_join_agency.sql tests/backend/onboarding-agency-rpc.spec.ts && git commit -m "fix(rls): ferme join_agency, ouverte a tout compte authentifie

La fonction ne verifiait aucune invitation : tout compte authentifie pouvait
s'attacher a n'importe quelle agence par son UUID et lire ses contacts, deals
et dossiers KYC. Le chemin utilisateur est accept-team-invite."
```

---

## Task 7 : colonnes de soumission d'identité

**Files:**
- Créer : `supabase/migrations/20260726140300_agencies_identity_submission.sql`
- Modifier : `tests/backend/agency-kyb-verification.spec.ts`

**Interfaces:**
- Consomme : `agencies` avec les colonnes KYB de `20260726130100`.
- Produit : `agencies.identity_submitted_at timestamptz`, et la valeur `validated`
  acceptée par `agencies_verification_status_chk`. L'étape 2 s'appuie sur les deux.

**Pourquoi :** `verification_status` répond à « que dit la vérification » et vaut
`pending` dès la création de la ligne : il ne distingue pas « rien n'a été saisi » de
« saisi, en attente de traitement », alors que c'est cette distinction qui pilotera le
gate. Et l'énumération d'origine ne prévoit rien pour un dossier validé par un humain
après revue : `auto_validated` mentirait sur l'origine de la décision, ce qu'un audit
LAB regarde précisément.

- [ ] **Step 1 : écrire les tests qui échouent**

Ajouter dans `tests/backend/agency-kyb-verification.spec.ts`, à l'intérieur du `describe`
principal :

```ts
  it('agencies.identity_submitted_at existe et vaut NULL à la création', async () => {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const { data, error } = await svc
      .from('agencies')
      .insert({ name: `Agence Submit ${stamp}`, slug: `agence-submit-${stamp}` })
      .select('id, identity_submitted_at')
      .single()
    expect(error, `insert agence: ${error?.message}`).toBeNull()
    expect(data?.identity_submitted_at, 'une agence neuve n’a rien soumis').toBeNull()
    await svc.from('agencies').delete().eq('id', data!.id)
  })

  it('verification_status accepte "validated" et refuse une valeur inventée', async () => {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const { data: ag } = await svc
      .from('agencies')
      .insert({ name: `Agence Statut ${stamp}`, slug: `agence-statut-${stamp}` })
      .select('id')
      .single()

    const { error: okErr } = await svc
      .from('agencies').update({ verification_status: 'validated' }).eq('id', ag!.id)
    expect(okErr, 'la décision humaine doit être représentable').toBeNull()

    const { error: koErr } = await svc
      .from('agencies').update({ verification_status: 'approuve_par_moi' }).eq('id', ag!.id)
    expect(koErr, 'le CHECK doit refuser une valeur hors énumération').not.toBeNull()

    await svc.from('agencies').delete().eq('id', ag!.id)
  })
```

- [ ] **Step 2 : lancer les tests et les voir échouer**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && npx vitest run --config=vitest.backend.config.ts tests/backend/agency-kyb-verification.spec.ts
```

Attendu : `2 failed | 16 passed`.

- [ ] **Step 3 : écrire la migration**

Créer `supabase/migrations/20260726140300_agencies_identity_submission.sql` :

```sql
-- Deux ajouts additifs qui préparent le gate d'onboarding (étape 2).
--
-- 1. identity_submitted_at — verification_status répond à « que dit la vérification »
--    et vaut 'pending' dès la création de la ligne : il ne distingue pas « rien n'a
--    été saisi » de « saisi, en attente de traitement ». C'est pourtant cette
--    distinction qui décide si le gate se déclenche. Deux faits, deux colonnes.
--
-- 2. statut 'validated' — l'énumération d'origine ne prévoyait rien pour un dossier
--    validé par un humain après revue. 'auto_validated' mentirait sur l'origine de la
--    décision, et c'est exactement ce qu'un audit LAB regarde. Le moteur ne devra pas
--    plus écraser un 'validated' qu'un 'rejected'.
--
-- Idempotente : ADD COLUMN IF NOT EXISTS, DROP CONSTRAINT IF EXISTS avant ADD.

alter table public.agencies
  add column if not exists identity_submitted_at timestamptz;

comment on column public.agencies.identity_submitted_at is
  'Date à laquelle le dirigeant a terminé la saisie d''identité. NULL = gate d''onboarding actif. Distinct de verification_status, qui porte le verdict et non l''avancement de la saisie.';

alter table public.agencies drop constraint if exists agencies_verification_status_chk;
alter table public.agencies
  add constraint agencies_verification_status_chk
  check (verification_status in
    ('pending', 'auto_validated', 'validated', 'manual_review', 'rejected'));

-- Vue admin des agences qui n'ont jamais soumis (relances). Le gate, lui, lit
-- l'agence par sa clé primaire et n'a besoin d'aucun index.
create index if not exists idx_agencies_identity_never_submitted
  on public.agencies (created_at)
  where identity_submitted_at is null;
```

- [ ] **Step 4 : appliquer et vérifier**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && supabase db reset && npx vitest run --config=vitest.backend.config.ts tests/backend/agency-kyb-verification.spec.ts
```

Attendu : `Tests 18 passed (18)`.

- [ ] **Step 5 : commit**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && git add supabase/migrations/20260726140300_agencies_identity_submission.sql tests/backend/agency-kyb-verification.spec.ts && git commit -m "feat(kyb): identity_submitted_at et statut validated

verification_status vaut pending des la creation et ne distingue pas la
non-saisie de l'attente de traitement, alors que le gate a besoin de cette
distinction. Et aucune valeur ne representait une validation humaine."
```

---

## Task 8 : vérification d'ensemble et documentation

**Files:**
- Modifier : `docs/agency-kyb-handoff.md` (tableau d'état, étapes 0 et 1 faites)
- Modifier : `.claude-flow/knowledge/megga-memory.seed.json`

**Interfaces:**
- Consomme : toutes les tâches précédentes.
- Produit : un état vérifié et un cerveau système à jour, condition posée par `CLAUDE.md`
  après toute livraison.

- [ ] **Step 1 : suite backend complète, aucune régression ailleurs**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && supabase db reset && npm run test:backend
```

Attendu : 0 échec. **Lire le compte de tests**, pas seulement le code de sortie : un
`skipped` massif signifie que `.env.test.local` a disparu.

- [ ] **Step 2 : linters et builds**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && npm run lint:migrations && npm run lint && npm run build && npm run build:admin
```

Attendu : chaque commande en succès.

- [ ] **Step 3 : mettre le handoff à jour**

Dans `docs/agency-kyb-handoff.md`, tableau « En une minute », remplacer les deux lignes :

```markdown
| Correctifs d'existant | à faire, étape 1 |
```

par :

```markdown
| Correctifs d'existant | livré, étape 1, 5 tests de non-régression |
| Trigger d'inscription versionné | livré, il n'était dans aucune migration |
```

Et dans le tableau du §6, passer les étapes 0 et 1 à « fait ».

- [ ] **Step 4 : mettre le cerveau système à jour**

Le fichier a la forme `{schema, source, namespace, entries: [{key, namespace, value}]}`.
Ajouter cette entrée à la fin du tableau `entries` de
`.claude-flow/knowledge/megga-memory.seed.json` :

```json
{
  "key": "megga/signup-provisioning",
  "namespace": "megga",
  "value": "CHEMIN D'INSCRIPTION — corrigé le 26 juil. 2026 (étape 1 de l'onboarding KYB). L'inscription se fait sur la VITRINE (sites/megga-vitrine/js/megga-auth.js), pas dans l'app : nom, e-mail, mot de passe, nom d'agence, captcha, puis data:{full_name, agency_name, role:'agent'}. Le trigger on_auth_user_created sur auth.users appelle handle_new_user() ; il n'était dans AUCUNE migration avant 20260726140000, donc absent en local et invisible en prod. handle_new_user() crée le profil puis, pour les rôles agence ET si aucune invitation valide n'attend cet e-mail, appelle provision_solo_agency(). Celle-ci nomme l'agence d'après agency_name (repli en cascade sur le nom de la personne puis un suffixe court : uq_agencies_name_normalized est UNIQUE sur lower(btrim(name)) et une collision laisserait l'utilisateur sans agence, donc avec un CRM muet) et pose role='admin' sur le fondateur — indispensable, sinon is_agency_admin() lui interdit de saisir ses propres données KYB. join_agency(uuid) est RÉVOQUÉE de authenticated depuis 20260726140200 : elle ne vérifiait aucune invitation et permettait à tout compte de rejoindre n'importe quelle agence. Le chemin utilisateur est accept-team-invite. Tests : tests/backend/signup-provisioning.spec.ts."
}
```

Puis mettre à jour l'entrée existante `megga/agency-kyb-verification`, dont le champ
`value` annonce encore « tables + référentiel + UI de saisie SEULEMENT » : y indiquer que
les étapes 0 et 1 sont livrées et que le moteur reste à écrire.

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && node -e "JSON.parse(require('fs').readFileSync('.claude-flow/knowledge/megga-memory.seed.json','utf8'))" && npm run ruflo:seed
```

Le `node -e` valide le JSON avant le seed : une virgule de trop casse silencieusement
l'indexation.

- [ ] **Step 5 : commit**

```bash
cd /Users/thomastaillefer/dev/megga-real-estate/.claude/worktrees/kyb-handoff-update && git add docs/agency-kyb-handoff.md .claude-flow/knowledge/megga-memory.seed.json && git commit -m "docs(kyb): etapes 0 et 1 livrees, cerveau systeme a jour"
```

---

## Ce qui reste ouvert à la fin de ce plan

Deux points à fermer avec un humain avant tout merge vers `main`.

1. **Nom du trigger en production** (tâche 2). S'il diffère de `on_auth_user_created`,
   la migration en ajoute un second et chaque inscription insère deux fois. Julien doit
   confirmer, je n'ai pas accès à la base de production.
2. **Roster `super_admin`** (nécessaire à l'étape 2, pas à celle-ci). L'exemption de gate
   passera par `is_super_admin()`, ce qui ne signifie « les trois développeurs » que si
   personne d'autre ne porte ce rôle.
