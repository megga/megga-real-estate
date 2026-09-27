# Matching · lot D2 — le copilote WhatsApp · plan d'exécution

> **Pour un agent :** SOUS-COMPÉTENCE REQUISE — `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans`, tâche par tâche. Les étapes sont des cases à cocher.

**But :** le copilote WhatsApp devient le côté de la boucle que l'agent a dans la poche. Le point du matin lui dit ce qui l'attend en matching et sur le marché ; il répond à « quels biens pour Julie ? » et à « qui pour la villa de Cologny ? » ; il consigne « Julie refuse Florissant, trop cher » après un « oui » de l'agent ; il planifie une visite qui fait passer l'acheteur en « visite planifiée ». Rien ne part vers l'acheteur.

**Conception :** [2026-09-24-matching-lot-d2-whatsapp-design.md](../specs/2026-09-24-matching-lot-d2-whatsapp-design.md), validée par Julien le 24.09.2026. **Étape 4b** de la [feuille de route](../feuille-de-route.md), `get_matches` compris (ajouté par Julien le même jour).

**Architecture :** la base porte les règles. Les écritures passent par trois fonctions `security definer` réservées au rôle de service, qui posent `app.actor_kind = 'ai'` — les déclencheurs de la boucle attribuent alors tout à MEGGA AI, et chaque geste s'écrit d'un bloc. La lecture du point du matin réutilise la fonction de D1, l'agence en paramètre (`matching_actions_agence`). Côté Deno, un module PUR (`whatsapp-matching.ts`) porte la logique — il recopie cinq règles du fil, qu'une spec confronte —, et un module d'exécuteurs (`whatsapp-matching-outils.ts`) les requêtes. Le point du matin gagne une section, sans modèle de langue.

**Pile :** PostgreSQL (une migration, quatre fonctions), Deno (Edge Functions `whatsapp-agent`, `whatsapp-webhook`, `whatsapp-morning-brief`, `ai-copilot`), TypeScript strict, Vitest (unitaire ; `tests/backend` contre une base locale, en CI).

**Branche :** `megga/matching-lot-d2`, partie de `megga/matching-lot-d1`.

> ⚠ **Les commits attendent le signal de Julien** (« committe ») : ils se jouent tous à la fin (tâche 14), **un commit par sujet**, dans l'ordre des tâches. Pendant l'exécution, on enchaîne sans commiter — et on prend une PHOTO de l'arbre après chaque tâche (`git write-tree` dans un index temporaire), qui servira à bâtir chaque commit à l'identique.

> ⚠ **La migration se redate le jour de la fusion, avec un suffixe POSTÉRIEUR à `…190000_matching_surfaces`** (elle réécrit sa fonction), et s'**applique à la main avant la fusion**, comme toute la pile : les fonctions WhatsApp partent à la fusion et appellent des fonctions de base. ⚠ **La fusion attend le lot E** (D1 ne part pas sans lui).

> ⛔ **Rien ne part vers l'acheteur.** Aucun exécuteur du matching n'appelle `sendOutboundGuarded`, un modèle Meta, un e-mail ou une fonction serveur ; une visite du copilote naît avec `reminder_sent = true` (`visit-reminders-j1` écrirait au client la veille). `matching-sans-sortie.spec.ts` le garde (tâche 13).

> ⛔ **MEGGA AI signe ce qu'il écrit.** Aucune écriture de match, de relance, de deal ou de visite par un `.update()` / `.insert()` PostgREST depuis un exécuteur : chaque requête est sa propre transaction, le réglage `app.actor_kind` ne la suivrait pas, et le journal dirait `system`.

> ⚠ **Les specs de la base ne tournent pas sur cette machine** (le port 54321 est pris par un serveur Python) : `tests/backend/matching-whatsapp.spec.ts` s'écrit, se relit, et la CI la joue. Ne jamais la déclarer verte.

> ⚠ **Une spec de `_shared` absente de l'allowlist de `vitest.config.ts` ne tourne nulle part.** Les deux nouvelles y entrent (tâches 4 et 6). Et **`deno check --no-lock`** est le seul filet de type du code Deno (la CI le joue sur toutes les Edge Functions) : le lancer après chaque tâche qui y touche.

> ⚠ **La suite unitaire se joue SEULE**, jamais en parallèle de `tsc`, d'`eslint` ou de `deno check` : les délais de 5 s sautent et les faux rouges s'enchaînent. Une spec qui rougit se rejoue d'abord seule. Trois échecs locaux sont connus et hors sujet : `mail/imap`, `mail/mime-parse`, `safe-internal-path`.


## Les fichiers

| Fichier | Responsabilité |
|---|---|
| `supabase/migrations/20260924200000_matching_whatsapp.sql` | **Créer.** `matching_actions_agence` (et `matching_actions_du_jour`, son enveloppe) ; `wa_matching_consigner` ; `wa_matching_visite`, `wa_matching_visite_annuler`. |
| `src/types/database.ts` | Les quatre fonctions. |
| `tests/unit/matching-whatsapp-sql.spec.ts` | **Créer.** La migration lue : le corps de D1 recopié à l'identique, MEGGA AI qui signe, l'agence revérifiée, le suffixe. |
| `tests/backend/matching-whatsapp.spec.ts` | **Créer.** Les fonctions contre une base locale (CI). |
| `supabase/functions/_shared/whatsapp-matching.ts` | **Créer.** Le modèle PUR : état d'un acheteur, bien désigné par un texte, score expliqué, signal, réponses des outils. |
| `supabase/functions/_shared/whatsapp-matching.test.ts` | **Créer.** |
| `tests/unit/whatsapp-matching-fil.spec.ts` | **Créer.** Les cinq copies confrontées au fil. |
| `src/components/matching-fil/filQuiPour.ts`, `filBoucle.ts`, `filSignaux.ts`, `filModele.ts` | Disent qu'ils ont une copie. |
| `supabase/functions/_shared/whatsapp-matching-outils.ts` | **Créer.** Les exécuteurs : `get_matches`, `get_buyers_for_property`, `record_match_outcome` (préparer, exécuter), `schedule_visit` et son annulation. |
| `supabase/functions/_shared/whatsapp-matching-outils.test.ts` | **Créer.** Un faux client qui applique ses filtres. |
| `supabase/functions/_shared/morning-brief.ts` | `fmtCHF` exporté ; les types du matching ; la section « Matching » ; le compte du modèle ; le détail. |
| `supabase/functions/_shared/morning-brief-data.ts` | La sixième source ; une relance de proposition comptée une fois. |
| `supabase/functions/_shared/whatsapp-tools.ts` | Deux outils neufs ; `get_matches`, `schedule_visit`, `get_daily_brief` décrits à neuf. |
| `supabase/functions/_shared/whatsapp-agent-router.ts` (+ test) | Les niveaux : lecture, à confirmer. |
| `supabase/functions/_shared/whatsapp-i18n.ts` | La question [Oui] [Non], le compte rendu, les refus — en français et en anglais. |
| `supabase/functions/_shared/whatsapp-phantom-action.ts` (+ test) | La consignation simulée reconnue. |
| `supabase/functions/whatsapp-agent/index.ts` | Les exécuteurs neufs ; la préparation de `record_match_outcome`. |
| `supabase/functions/whatsapp-webhook/index.ts` | L'exécution sur « oui » ; « /annuler » d'une visite par la base. |
| `supabase/functions/ai-copilot/index.ts` | `get_matches` depuis son nouveau module. |
| `supabase/functions/_shared/whatsapp-actions.ts` | Les deux anciens exécuteurs retirés. |
| `vitest.config.ts` | Les deux nouvelles specs de `_shared`. |
| `tests/unit/matching-sans-sortie.spec.ts` | Étendue au copilote. |

---

## Tâche 1 : La base : les actions du jour d'une agence

Le point du matin et les copilotes lisent par le rôle de service, où `get_user_agency_id()` est nul : `matching_actions_du_jour` (lot D1) n'y rend rien. Son corps passe, à l'identique, dans `matching_actions_agence(p_agency, p_limite)`, et `matching_actions_du_jour` en devient l'enveloppe — une seule définition des quatre sortes d'actions pour « Aujourd'hui », le point du matin et son détail (conception §4.2).

**Fichiers :**
- Créer : `supabase/migrations/20260924200000_matching_whatsapp.sql`
- Créer : `tests/unit/matching-whatsapp-sql.spec.ts`
- Créer : `tests/backend/matching-whatsapp.spec.ts`
- Modifier : `src/types/database.ts`

- [ ] **Étape 1 : Écrire le test qui échoue**

La migration se lit dans le code : ses specs de base ne tournent qu'en CI. Le premier bloc de la spec statique confronte le corps de la fonction d'agence à celui de D1, texte contre texte.

Créer `tests/unit/matching-whatsapp-sql.spec.ts` :

```ts
/**
 * La migration du lot D2 (`…_matching_whatsapp.sql`), LUE — ses specs de base (`tests/backend/matching-whatsapp.spec.ts`)
 * ne tournent qu'en CI, contre une base locale.
 *
 * Ce que cette spec refuse, sans base :
 *   · une `matching_actions_agence` qui aurait divergé du corps de `matching_actions_du_jour` (lot D1) — deux
 *     définitions des actions du jour feraient dire deux choses au point du matin et à « Aujourd'hui » ;
 *   · une fonction d'écriture du copilote qui ne signerait pas MEGGA AI, qu'un utilisateur pourrait appeler, ou qui
 *     lirait ou écrirait hors de l'agence passée ;
 *   · une migration qui passerait AVANT celle de D1 au redatage du jour de la fusion.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const DOSSIER = join(process.cwd(), 'supabase/migrations')

function migration(suffixe: string): { nom: string; sql: string } {
  const noms = readdirSync(DOSSIER).filter((n) => n.endsWith(suffixe))
  expect(noms, suffixe).toHaveLength(1)
  return { nom: noms[0], sql: readFileSync(join(DOSSIER, noms[0]), 'utf8') }
}

/** L'en-tête et le corps d'une fonction : de sa création à `as $$`, puis jusqu'au `$$;` qui le ferme. */
function fonction(sql: string, nom: string): { entete: string; corps: string } {
  const i = sql.indexOf(`create or replace function public.${nom}(`)
  expect(i, `${nom} introuvable`).toBeGreaterThanOrEqual(0)
  const as = sql.indexOf('as $$', i)
  const fin = sql.indexOf('$$;', as + 5)
  return { entete: sql.slice(i, as), corps: sql.slice(as + 5, fin) }
}

/** Sans commentaires ni blancs superflus : deux corps se comparent sur ce qu'ils exécutent. */
const nu = (s: string) => s.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim()

describe('lot D2 — la migration : les actions du jour d’une agence', () => {
  const d1 = migration('_matching_surfaces.sql')
  const d2 = migration('_matching_whatsapp.sql')

  it('passe après la migration de D1 au redatage : son suffixe est postérieur', () => {
    // Le jour de la fusion, chaque lot garde son suffixe (HHMMSS) : c'est lui qui ordonne la pile.
    expect(d2.nom.slice(8, 14) > d1.nom.slice(8, 14)).toBe(true)
  })

  it('matching_actions_agence est le corps de D1, l’agence en paramètre — rien d’autre ne change', () => {
    const avant = nu(fonction(d1.sql, 'matching_actions_du_jour').corps)
    expect(avant).toContain('select public.get_user_agency_id() as id')
    expect(nu(fonction(d2.sql, 'matching_actions_agence').corps))
      .toBe(avant.replace('select public.get_user_agency_id() as id', 'select p_agency as id'))
    expect(fonction(d2.sql, 'matching_actions_agence').entete).toMatch(/security invoker/)
  })

  it('matching_actions_du_jour n’est plus que l’enveloppe, sur l’agence de l’appelant', () => {
    expect(nu(fonction(d2.sql, 'matching_actions_du_jour').corps))
      .toBe('select * from public.matching_actions_agence(public.get_user_agency_id(), p_limite);')
  })
})
```

```bash
npx vitest run tests/unit/matching-whatsapp-sql.spec.ts
```

Attendu : ÉCHEC : `_matching_whatsapp.sql` introuvable (`expected [] to have a length of 1`).

- [ ] **Étape 2 : Créer la migration**

L'en-tête et la section 1. ⚠ Le corps de `matching_actions_agence` est celui de `matching_actions_du_jour` dans `…_matching_surfaces.sql`, recopié caractère pour caractère, sauf `select public.get_user_agency_id() as id`, devenu `select p_agency as id`.

Créer `supabase/migrations/20260924200000_matching_whatsapp.sql` :

```sql
-- Matching · lot D2 (24.09.2026) — le copilote WhatsApp : le point du matin, `get_matches`, `get_buyers_for_property`,
-- `record_match_outcome`, `schedule_visit` → `visit_planned`.
-- Conception : docs/superpowers/specs/2026-09-24-matching-lot-d2-whatsapp-design.md (§4, §5.3, §5.4, §6).
--
-- 1. `matching_actions_agence(p_agency, p_limite)` — le corps de `matching_actions_du_jour` (lot D1), l'agence en
--    paramètre : le point du matin et les copilotes lisent par le rôle de service, où `get_user_agency_id()` est nul.
--    `matching_actions_du_jour` en devient l'enveloppe : UNE définition des quatre sortes d'actions.
-- 2. `wa_matching_consigner` — les quatre réponses de `record_match_outcome`, aux règles des gestes du fil.
-- 3. `wa_matching_visite` et `wa_matching_visite_annuler` — la visite de `schedule_visit`, et son « /annuler ».
--
-- ⛔ MEGGA AI signe ce qu'il écrit : 2 et 3 posent `app.actor_kind = 'ai'` (et `via`, `profile_id`) pour la
-- transaction, comme `wa_move_transaction_stage` ; les déclencheurs de la boucle (réponse datée, journal et motif,
-- clôture de la relance, étape du deal) l'attribuent alors à MEGGA AI. Une écriture directe par PostgREST serait
-- journalisée `system` : chaque requête est sa propre transaction, un réglage posé par l'une ne survit pas à l'autre.
-- ⛔ Rien ne part vers l'acheteur : une visite du copilote naît avec `reminder_sent = true`, comme celle du fil.
-- ⚠ Même signature et même type de retour pour `matching_actions_du_jour` : son CREATE OR REPLACE se rejoue sans erreur
-- (date-guard). Trois noms neufs pour le reste, `security definer`, réservés au rôle de service.
-- ⚠ Au redatage du jour de la fusion, garder un suffixe POSTÉRIEUR à `…190000_matching_surfaces` : cette migration
-- réécrit sa fonction, et lit les colonnes du lot B (`prix_propose`, `match_ids`, `sent_via = 'agent'`).

-- ── 1. Les actions du jour d'UNE agence ─────────────────────────────────────
-- Le corps de `matching_actions_du_jour` (migration …_matching_surfaces.sql, lot D1), À L'IDENTIQUE, l'agence en
-- paramètre : `tests/unit/matching-whatsapp-sql.spec.ts` confronte les deux textes. `security invoker` : sous un
-- jeton utilisateur, la RLS de `matches`, `reminders` et `properties` borne la lecture à SON agence, quelle que soit
-- celle qu'il passe ; le rôle de service (point du matin, copilotes) la choisit.
create or replace function public.matching_actions_agence(p_agency uuid, p_limite integer default 5)
returns table (
  genre text,
  contact_id uuid,
  prenom text,
  nom text,
  match_id uuid,
  property_id uuid,
  market_listing_id uuid,
  statut text,
  titre text,
  ville text,
  nombre integer,
  nouveaux integer,
  baisses integer,
  montant numeric,
  location boolean,
  quand timestamptz,
  total integer
)
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $$
  with agence as (
    select p_agency as id
  ),
  -- 1. Un retour dû : une relance de proposition échue dont au moins un bien attend encore sa réponse. Une ligne par
  --    acheteur, comme « En attente » dans le fil ; son échéance est la plus ancienne de ses relances échues.
  relances_dues as (
    select r.contact_id, r.trigger_at, coalesce(r.match_ids, array[r.match_id]) as ids
      from public.reminders r
      join agence a on r.agency_id = a.id
     where r.type = 'follow_up_sent_property'
       and r.status in ('pending', 'triggered', 'snoozed')
       and r.trigger_at is not null
       and r.trigger_at <= now()
       and r.contact_id is not null
  ),
  retours as (
    select 'retour'::text as genre, 1 as rang, d.contact_id,
           null::uuid as match_id, null::uuid as property_id, null::uuid as market_listing_id, null::text as statut,
           null::text as titre, null::text as ville,
           count(distinct m.id)::integer as nombre, null::integer as nouveaux, null::integer as baisses,
           null::numeric as montant, null::boolean as location, min(d.trigger_at) as quand
      from relances_dues d
      join public.matches m on m.id = any (d.ids) and m.status = 'sent'
     group by d.contact_id
  ),
  -- 2. Un prix passé sous le prix de proposition (`prix_propose`) : sur un bien proposé sans réponse, ou refusé pour le
  --    prix et revenu à proposer — le signal du lot B (`signalPrix`). Un prix nul (« prix sur demande ») n'est pas une
  --    baisse ; un match reporté attend son heure ; une annonce retirée n'est plus une occasion.
  prix as (
    select 'prix'::text, 2, m.contact_id, m.id, m.property_id, m.market_listing_id, m.status,
           coalesce(nullif(p.title, ''), nullif(ml.title, ''), p.address, ml.address),
           coalesce(p.city, ml.city),
           null::integer, null::integer, null::integer,
           m.prix_propose - x.prix,
           coalesce(p.transaction_type, ml.transaction_type) = 'rent',
           m.sent_at
      from public.matches m
      join agence a on m.agency_id = a.id
      left join public.properties p on p.id = m.property_id
      left join public.market_listings ml on ml.id = m.market_listing_id
      cross join lateral (
        select case when m.property_id is not null then p.price else coalesce(ml.current_price, ml.price) end as prix
      ) x
     where m.prix_propose is not null
       and x.prix > 0
       and x.prix < m.prix_propose
       and (m.status = 'sent'
         or (m.status = 'suggested' and m.reaction_motif = 'prix'
             and (m.snoozed_until is null or m.snoozed_until <= now())))
       and ml.status is distinct from 'removed'
       -- Un mandat vendu, retiré ou supprimé n'est plus une occasion : la règle de l'annonce retirée et de `mandats`.
       and (m.property_id is null or (p.status = 'active' and p.deleted_at is null))
  ),
  -- 3. Un nouveau mandat : signé ou mis en service il y a 7 jours au plus — la plus récente des deux dates, la règle de
  --    `signalBien` —, actif, avec au moins un acquéreur compatible. Un mandat vendu, retiré ou supprimé n'est plus une
  --    occasion.
  mandats as (
    select 'mandat'::text, 3, null::uuid, null::uuid, p.id, null::uuid, null::text,
           coalesce(nullif(p.title, ''), p.address), p.city,
           count(distinct m.contact_id)::integer, null::integer, null::integer, null::numeric,
           p.transaction_type = 'rent',
           greatest(p.mandate_signed_at, p.published_at)
      from public.properties p
      join agence a on p.agency_id = a.id
      join public.matches m on m.property_id = p.id and m.agency_id = a.id
       and m.status in ('suggested', 'sent', 'interested', 'visit_planned')
     where p.status = 'active'
       and p.deleted_at is null
       and greatest(p.mandate_signed_at, p.published_at) > now() - interval '7 days'
       and greatest(p.mandate_signed_at, p.published_at) <= now()
     group by p.id
  ),
  -- 4. Le marché : par acheteur, ses annonces nouvelles (3 jours) ou en baisse (14 jours) — les seuils de
  --    `matching_fil_marche_resume`. Une annonce en baisse ne compte pas aussi comme nouvelle. ⚠ Sans les biens déjà
  --    proposés à l'acheteur (`prix_propose` posé) : leur baisse est l'action 2, un bien ne s'annonce pas deux fois.
  signaux as (
    select m.contact_id, ml.id as annonce, coalesce(nullif(ml.title, ''), ml.address) as titre, ml.city,
           ml.transaction_type,
           coalesce(ml.price_reduced_at > now() - interval '14 days'
             and ml.price_reduced_at <= now()
             and ml.price_at_first_seen > coalesce(ml.current_price, ml.price)
             and coalesce(ml.current_price, ml.price) > 0, false) as en_baisse,
           coalesce(ml.first_seen_at > now() - interval '3 days'
             and ml.first_seen_at <= now(), false) as nouveau,
           ml.price_reduced_at, ml.first_seen_at
      from public.matches m
      join agence a on m.agency_id = a.id
      join public.market_listings ml on ml.id = m.market_listing_id
     where m.status = 'suggested'
       and m.market_listing_id is not null
       and m.prix_propose is null
       and (m.snoozed_until is null or m.snoozed_until <= now())
       and ml.status is distinct from 'removed'
  ),
  -- UNE annonce est nommée ; au-delà, on compte, pour qu'un acheteur tienne en une ligne.
  marche as (
    select 'marche'::text, 4, s.contact_id, null::uuid, null::uuid,
           case when count(*) = 1 then (array_agg(s.annonce))[1] end,
           null::text,
           case when count(*) = 1 then (array_agg(s.titre))[1] end,
           case when count(*) = 1 then (array_agg(s.city))[1] end,
           count(*)::integer,
           (count(*) filter (where s.nouveau and not s.en_baisse))::integer,
           (count(*) filter (where s.en_baisse))::integer,
           null::numeric,
           bool_or(s.transaction_type = 'rent'),
           max(case when s.en_baisse then s.price_reduced_at else s.first_seen_at end)
      from signaux s
     where s.en_baisse or s.nouveau
     group by s.contact_id
  ),
  actions as (
    select * from retours
    union all select * from prix
    union all select * from mandats
    union all select * from marche
  )
  -- L'ordre dit l'urgence : un retour dû ferme la boucle, une baisse sur un bien déjà montré est l'argument le plus fort,
  -- un nouveau mandat est une occasion, le marché un flux. Dans une sorte : la plus ancienne échéance, la plus forte
  -- baisse, le plus récent.
  select x.genre, x.contact_id, c.first_name, c.last_name, x.match_id, x.property_id, x.market_listing_id, x.statut,
         x.titre, x.ville, x.nombre, x.nouveaux, x.baisses, x.montant, x.location, x.quand,
         (count(*) over ())::integer
    from actions x
    left join public.contacts c on c.id = x.contact_id
   order by x.rang,
            case when x.rang = 1 then x.quand end asc nulls last,
            case when x.rang = 2 then x.montant end desc nulls last,
            case when x.rang in (3, 4) then x.quand end desc nulls last,
            x.contact_id nulls last, x.property_id nulls last, x.match_id nulls last
   limit least(greatest(coalesce(p_limite, 5), 1), 20);
$$;

comment on function public.matching_actions_agence(uuid, integer) is
  'Lot D2 : les actions du jour (lot D1) d''une agence donnée — le point du matin WhatsApp et les copilotes lisent par le rôle de service, où get_user_agency_id() est nul. Sous un jeton utilisateur, la RLS borne la lecture à son agence.';

revoke all on function public.matching_actions_agence(uuid, integer) from public, anon;
grant execute on function public.matching_actions_agence(uuid, integer) to authenticated, service_role;

-- `matching_actions_du_jour` devient l'enveloppe : UNE définition des quatre sortes d'actions. Même signature, même
-- type de retour : son CREATE OR REPLACE se rejoue sans erreur.
create or replace function public.matching_actions_du_jour(p_limite integer default 5)
returns table (
  genre text,
  contact_id uuid,
  prenom text,
  nom text,
  match_id uuid,
  property_id uuid,
  market_listing_id uuid,
  statut text,
  titre text,
  ville text,
  nombre integer,
  nouveaux integer,
  baisses integer,
  montant numeric,
  location boolean,
  quand timestamptz,
  total integer
)
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $$
  select * from public.matching_actions_agence(public.get_user_agency_id(), p_limite);
$$;

comment on function public.matching_actions_du_jour(integer) is
  'Lot D1 : le segment Matching d''Aujourd''hui — l''enveloppe de matching_actions_agence (lot D2) sur l''agence de l''appelant.';

revoke all on function public.matching_actions_du_jour(integer) from public, anon;
grant execute on function public.matching_actions_du_jour(integer) to authenticated;
```

- [ ] **Étape 3 : Déclarer la fonction dans les types**

Dans `src/types/database.ts`, juste avant `matching_actions_du_jour` (ordre alphabétique du générateur) :

Dans `src/types/database.ts`, remplacer :

```ts
      matching_actions_du_jour: {
        Args: { p_limite?: number }
```

par :

```ts
      matching_actions_agence: {
        Args: { p_agency: string; p_limite?: number }
        Returns: {
          baisses: number
          contact_id: string
          genre: string
          location: boolean
          market_listing_id: string
          match_id: string
          montant: number
          nom: string
          nombre: number
          nouveaux: number
          prenom: string
          property_id: string
          quand: string
          statut: string
          titre: string
          total: number
          ville: string
        }[]
      }
      matching_actions_du_jour: {
        Args: { p_limite?: number }
```

- [ ] **Étape 4 : Écrire la spec de base (W1)**

Elle ne tourne pas sur cette machine (le port 54321 est occupé) : la CI la joue. Sa mise en place est au niveau du module, pour que les tâches 2 et 3 y ajoutent leurs blocs.

Créer `tests/backend/matching-whatsapp.spec.ts` :

```ts
// Matching · lot D2 — les fonctions de base du copilote WhatsApp (migration …_matching_whatsapp.sql).
//   W1  `matching_actions_agence` rend, pour l'agence passée, ce que `matching_actions_du_jour` rend à son agent ;
//       sous un jeton utilisateur, une autre agence ne rend rien ; le rôle anonyme est refusé.
//   W2  `wa_matching_consigner` : proposé (deal, relance, journal), intéressé, pas intéressé + motif, pas encore — aux
//       règles du fil ; « déjà consigné » ne réécrit rien ; un match d'une autre agence est refusé ; tout est signé
//       MEGGA AI ; un utilisateur ne peut pas l'appeler.
//   W3  `wa_matching_visite` : un intéressé passe `visit_planned`, la visite porte le deal et n'écrit pas au client
//       (`reminder_sent`) ; une annonce du marché devient un événement d'agenda ; un proposé ne bouge pas ; « /annuler »
//       rend le match et l'étape du deal.
// Tourne contre `supabase start` (SUPABASE_TEST_*), jamais la prod. skipIf sans clés — et les crochets aussi : ils
// sont au niveau du module, pour que chaque tâche du lot ajoute son bloc sans dupliquer la mise en place.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { anonClient, serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const JOUR = 86_400_000
const ilYA = (jours: number) => new Date(Date.now() - jours * JOUR).toISOString()
const dans = (jours: number) => new Date(Date.now() + jours * JOUR).toISOString()

let s: TwoAgenciesSetup
let svc: SupabaseClient
const contacts: string[] = []
const annonces: string[] = []
const biens: string[] = []
const matchs: string[] = []
const relances: string[] = []
const visites: string[] = []
const evenements: string[] = []

const mkContact = async (agencyId: string, prenom: string) => {
  const { data, error } = await svc.from('contacts').insert({
    agency_id: agencyId, first_name: prenom, last_name: `D2 ${s.stamp}`, type: 'buyer',
  }).select('id').single()
  if (error) throw new Error(`contacts ${prenom}: ${error.message}`)
  contacts.push(data.id as string)
  return data.id as string
}
const mkAnnonce = async (tag: string, champs: Record<string, unknown> = {}) => {
  const { data, error } = await svc.from('market_listings').insert({
    source_id: `d2-${tag}-${s.stamp}`, source_portal: 'flatfox', title: `D2 ${tag} ${s.stamp}`, address: `Rue ${tag} 1`,
    city: 'Genève', canton: 'GE', type: 'apartment', transaction_type: 'buy', quality_score: 70, status: 'active',
    price: 1_200_000, current_price: 1_200_000, price_at_first_seen: 1_200_000, first_seen_at: ilYA(60), ...champs,
  }).select('id').single()
  if (error) throw new Error(`market_listings ${tag}: ${error.message}`)
  annonces.push(data.id as string)
  return data.id as string
}
const mkBien = async (agencyId: string, tag: string) => {
  const { data, error } = await svc.from('properties').insert({
    agency_id: agencyId, title: `D2 ${tag} ${s.stamp}`, address: `Chemin ${tag} 2`, type: 'apartment',
    transaction_type: 'buy', price: 1_500_000, status: 'active',
  }).select('id').single()
  if (error) throw new Error(`properties ${tag}: ${error.message}`)
  biens.push(data.id as string)
  return data.id as string
}
const mkMatch = async (agencyId: string, contactId: string, cible: { annonce?: string; bien?: string }, champs: Record<string, unknown> = {}) => {
  const { data, error } = await svc.from('matches').insert({
    agency_id: agencyId, contact_id: contactId, score: 80, status: 'suggested',
    source: cible.annonce ? 'market' : 'internal', market_listing_id: cible.annonce ?? null, property_id: cible.bien ?? null, ...champs,
  }).select('id').single()
  if (error) throw new Error(`matches: ${error.message}`)
  matchs.push(data.id as string)
  return data.id as string
}
const mkRelance = async (agencyId: string, contactId: string, ids: string[], triggerAt: string) => {
  const { data, error } = await svc.from('reminders').insert({
    agency_id: agencyId, contact_id: contactId, type: 'follow_up_sent_property', trigger_rule: 'manual', trigger_days: 3,
    trigger_at: triggerAt, status: 'pending', channel: 'task', match_id: ids[0], match_ids: ids.length > 1 ? ids : null,
    message_template: 'Retour (spec D2)',
  }).select('id').single()
  if (error) throw new Error(`reminders: ${error.message}`)
  relances.push(data.id as string)
  return data.id as string
}

let julie = '', marc = '', lea = '', chezB = ''

beforeAll(async () => {
  if (!HAS_KEYS) return
  s = await setupTwoAgencies()
  svc = serviceRoleClient()
  julie = await mkContact(s.agencyAId, 'Julie')
  marc = await mkContact(s.agencyAId, 'Marc')
  lea = await mkContact(s.agencyAId, 'Léa')
  chezB = await mkContact(s.agencyBId, 'ChezB')
})

afterAll(async () => {
  if (!HAS_KEYS || !s) return
  if (visites.length) await svc.from('visits').delete().in('id', visites)
  if (evenements.length) await svc.from('calendar_events').delete().in('id', evenements)
  // Les relances et les deals que les fonctions posent elles-mêmes : par contact.
  await svc.from('reminders').delete().in('contact_id', contacts)
  if (relances.length) await svc.from('reminders').delete().in('id', relances)
  await svc.from('transactions').delete().in('contact_buyer_id', contacts)
  if (matchs.length) await svc.from('matches').delete().in('id', matchs)
  if (annonces.length) await svc.from('market_listings').delete().in('id', annonces)
  if (biens.length) await svc.from('properties').delete().in('id', biens)
  if (contacts.length) await svc.from('contacts').delete().in('id', contacts)
  await s.cleanup()
})

describe.skipIf(!HAS_KEYS)('W1 — les actions du jour d’une agence', () => {
  it('matching_actions_agence rend ce que matching_actions_du_jour rend à l’agent, et rien d’une autre agence sous un jeton', async () => {
    const a1 = await mkMatch(s.agencyAId, julie, { annonce: await mkAnnonce('w1') }, { status: 'sent', sent_at: ilYA(5), prix_propose: 1_200_000 })
    await mkRelance(s.agencyAId, julie, [a1], ilYA(1))
    const { data: parAgent } = await s.clientA.rpc('matching_actions_du_jour', { p_limite: 20 })
    const { data: parService } = await svc.rpc('matching_actions_agence', { p_agency: s.agencyAId, p_limite: 20 })
    expect(parService).toEqual(parAgent)
    expect((parService as { genre: string; contact_id: string }[]).some((x) => x.genre === 'retour' && x.contact_id === julie)).toBe(true)
    const { data: chezLesAutres } = await s.clientB.rpc('matching_actions_agence', { p_agency: s.agencyAId, p_limite: 20 })
    expect(chezLesAutres).toEqual([])
    const { error } = await anonClient().rpc('matching_actions_agence', { p_agency: s.agencyAId, p_limite: 20 })
    expect(error).not.toBeNull()
  })
})
```

- [ ] **Étape 5 : Vérifier**

```bash
npx vitest run tests/unit/matching-whatsapp-sql.spec.ts
```

Attendu : PASS (3 tests).

```bash
node scripts/check-migration-idempotence.mjs && node scripts/check-spec-sql-blocks.mjs
```

Attendu : Les deux portes vertes.

```bash
npx tsc -b
```

Attendu : Sortie 0.

La spec de base (`npx vitest run --config=vitest.backend.config.ts tests/backend/matching-whatsapp.spec.ts`) ne peut pas tourner ici : ne pas la déclarer verte, le dire au rapport.

---

## Tâche 2 : La base : consigner une réponse (`wa_matching_consigner`)

`record_match_outcome` écrit par une fonction de base qui pose `app.actor_kind = 'ai'` : les déclencheurs de la boucle (réponse datée, journal et motif, clôture de la relance) attribuent alors l'écriture à MEGGA AI, et le geste s'écrit d'un bloc. Une écriture directe par PostgREST serait journalisée `system` (conception §4.1). Les quatre réponses suivent À L'IDENTIQUE les gestes du fil : `execProposer`, `execRepondre`, `execPasEncore` (`src/hooks/useAtelierMatching.ts`).

**Fichiers :**
- Modifier : `supabase/migrations/20260924200000_matching_whatsapp.sql`
- Modifier : `tests/unit/matching-whatsapp-sql.spec.ts`
- Modifier : `tests/backend/matching-whatsapp.spec.ts`
- Modifier : `src/types/database.ts`

- [ ] **Étape 1 : Écrire le test qui échoue**

Ajouter à la fin de la spec statique :

Ajouter à la fin de `tests/unit/matching-whatsapp-sql.spec.ts` :

```ts

/** Une fonction d'écriture du copilote : MEGGA AI signe, et le rôle de service seul l'appelle. */
function signeeEtReservee(sql: string, nom: string): void {
  const f = fonction(sql, nom)
  expect(f.entete).toMatch(/security definer/)
  expect(f.entete).toMatch(/set search_path to 'public', 'pg_temp'/)
  expect(f.corps).toMatch(/perform set_config\('app\.actor_kind', 'ai', true\);/)
  expect(f.corps).toMatch(/perform set_config\('app\.actor_via', 'whatsapp', true\);/)
  expect(sql).toMatch(new RegExp(`revoke all on function public\\.${nom}\\([^)]*\\) from public, anon, authenticated;`))
  expect(sql).toMatch(new RegExp(`grant execute on function public\\.${nom}\\([^)]*\\) to service_role;`))
}

describe('lot D2 — la migration : consigner une réponse', () => {
  const d2 = migration('_matching_whatsapp.sql')

  it('wa_matching_consigner : MEGGA AI signe, et le rôle de service seul l’appelle', () => {
    signeeEtReservee(d2.sql, 'wa_matching_consigner')
  })

  it('le match et son acheteur se lisent dans l’agence passée, jamais ailleurs', () => {
    const corps = nu(fonction(d2.sql, 'wa_matching_consigner').corps)
    expect(corps).toContain('where m.id = p_match and m.agency_id = p_agency for update')
    expect(corps).toContain('where c.id = v_match.contact_id and c.agency_id = p_agency')
  })
})
```

```bash
npx vitest run tests/unit/matching-whatsapp-sql.spec.ts
```

Attendu : ÉCHEC : `wa_matching_consigner introuvable`.

- [ ] **Étape 2 : Ajouter la section 2 à la migration**

Ajouter à la fin de `supabase/migrations/20260924200000_matching_whatsapp.sql` :

```sql

-- ── 2. Consigner une réponse (`record_match_outcome`, question Oui / Non) ────
-- Les règles des gestes du fil (`useAtelierMatching` : execProposer, execRepondre, execPasEncore), À L'IDENTIQUE,
-- chacune d'un bloc. Le statut de départ est une garde : si un collègue a consigné entre-temps, rien n'est réécrit et
-- la réponse le dit (`deja`). Rendu : { ok, deja, statut, deal_id, relance_id } ; `ok = false` quand le match ou son
-- acheteur n'est pas de l'agence passée.
create or replace function public.wa_matching_consigner(
  p_agency uuid,
  p_profile uuid,
  p_match uuid,
  p_reponse text,
  p_motif text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_match public.matches%rowtype;
  v_nom text;
  v_titre text;
  v_deal uuid;
  v_relance uuid;
  v_lignes integer;
begin
  if p_reponse is null or p_reponse not in ('propose', 'interesse', 'pas_interesse', 'pas_encore') then
    raise exception 'wa_matching_consigner : réponse inconnue (%)', p_reponse using errcode = '22023';
  end if;
  if p_reponse = 'pas_interesse' and (p_motif is null or p_motif not in
      ('prix', 'quartier', 'surface', 'pieces', 'type', 'equipements', 'etat', 'autre')) then
    raise exception 'wa_matching_consigner : un refus porte un motif (%)', p_motif using errcode = '22023';
  end if;

  -- MEGGA AI signe : les déclencheurs de la boucle lisent ces réglages de transaction.
  perform set_config('app.actor_kind', 'ai', true);
  perform set_config('app.actor_via', 'whatsapp', true);
  if p_profile is not null then
    perform set_config('app.actor_profile_id', p_profile::text, true);
  end if;

  select * into v_match from public.matches m where m.id = p_match and m.agency_id = p_agency for update;
  if not found then
    return jsonb_build_object('ok', false);
  end if;
  select nullif(btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), '') into v_nom
    from public.contacts c
   where c.id = v_match.contact_id and c.agency_id = p_agency;
  if not found then
    return jsonb_build_object('ok', false);
  end if;
  v_titre := coalesce(
    (select coalesce(nullif(p.title, ''), p.address) from public.properties p where p.id = v_match.property_id),
    (select coalesce(nullif(ml.title, ''), ml.address, ml.city) from public.market_listings ml
      where ml.id = v_match.market_listing_id),
    'bien');

  if p_reponse = 'propose' then
    -- « Je l'ai proposé » : `set_match_prix_propose` pose le prix du moment et efface la réponse d'avant.
    update public.matches set status = 'sent', sent_via = 'agent', sent_at = now()
     where id = p_match and status = 'suggested';
    get diagnostics v_lignes = row_count;
    if v_lignes = 0 then
      return jsonb_build_object('ok', true, 'deja', true, 'statut', v_match.status);
    end if;
    -- Le deal : l'actif le plus récent de l'acheteur (un mandat y est rattaché s'il n'en porte aucun, jamais
    -- écrasé), sinon un `new_lead` sur ce bien — `rattacherDeal` du fil.
    select t.id into v_deal from public.transactions t
     where t.agency_id = p_agency and t.contact_buyer_id = v_match.contact_id and t.status = 'active'
     order by t.created_at desc
     limit 1;
    if v_deal is null then
      insert into public.transactions (agency_id, contact_buyer_id, assigned_to, stage, status, property_id, market_listing_id)
      values (p_agency, v_match.contact_id, p_profile, 'new_lead', 'active', v_match.property_id,
              case when v_match.property_id is null then v_match.market_listing_id end)
      returning id into v_deal;
    elsif v_match.property_id is not null then
      update public.transactions set property_id = v_match.property_id where id = v_deal and property_id is null;
    end if;
    -- UNE relance interne à +3 jours (canal `task`) : l'agent consignera la réponse — `poserRelance` du fil.
    insert into public.reminders (agency_id, contact_id, property_id, transaction_id, match_id, type, trigger_rule,
                                  trigger_days, trigger_at, status, channel, message_template)
    values (p_agency, v_match.contact_id, v_match.property_id, v_deal, p_match, 'follow_up_sent_property', 'manual',
            3, now() + interval '3 days', 'pending', 'task',
            'Retour de ' || coalesce(v_nom, 'l''acheteur') || ' sur ' || v_titre)
    returning id into v_relance;
    insert into public.activity_events (agency_id, actor_id, actor_kind, action, entity_type, entity_id, object_label,
                                        category, severity, metadata)
    values (p_agency, null, 'ai', 'match_propose', 'contact', v_match.contact_id,
            left(coalesce(v_nom, '—') || ' · ' || v_titre, 500), 'deal', 'info',
            jsonb_build_object('match_ids', jsonb_build_array(p_match), 'deal_id', v_deal, 'nombre', 1,
                               'score', v_match.score, 'via', 'whatsapp', 'profile_id', p_profile));
    return jsonb_build_object('ok', true, 'deja', false, 'deal_id', v_deal, 'relance_id', v_relance);
  end if;

  if p_reponse = 'pas_encore' then
    -- « Pas encore » : rien sur le match ; la relance qui COUVRE ce bien (`match_ids`, ou `match_id` pour une
    -- proposition d'un seul bien) est repoussée de trois jours, sinon posée — `execPasEncore` du fil.
    if v_match.status <> 'sent' then
      return jsonb_build_object('ok', true, 'deja', true, 'statut', v_match.status);
    end if;
    select r.id into v_relance from public.reminders r
     where r.agency_id = p_agency and r.contact_id = v_match.contact_id and r.type = 'follow_up_sent_property'
       and r.status in ('pending', 'triggered', 'snoozed')
       and p_match = any (coalesce(r.match_ids, array[r.match_id]))
     order by r.created_at desc
     limit 1
     for update;
    if v_relance is not null then
      update public.reminders set trigger_at = now() + interval '3 days', status = 'pending' where id = v_relance;
    else
      insert into public.reminders (agency_id, contact_id, property_id, match_id, type, trigger_rule, trigger_days,
                                    trigger_at, status, channel, message_template)
      values (p_agency, v_match.contact_id, v_match.property_id, p_match, 'follow_up_sent_property', 'manual', 3,
              now() + interval '3 days', 'pending', 'task',
              'Retour : ' || coalesce(v_nom, 'acheteur') || ' sur ' || v_titre)
      returning id into v_relance;
    end if;
    insert into public.activity_events (agency_id, actor_id, actor_kind, action, entity_type, entity_id, object_label,
                                        category, severity, metadata)
    values (p_agency, null, 'ai', 'match_pas_encore', 'contact', v_match.contact_id,
            left(coalesce(v_nom, '—') || ' · ' || v_titre, 500), 'deal', 'info',
            jsonb_build_object('match_id', p_match, 'relance_id', v_relance, 'via', 'whatsapp', 'profile_id', p_profile));
    return jsonb_build_object('ok', true, 'deja', false, 'relance_id', v_relance);
  end if;

  -- « Intéressé » répond à un bien PROPOSÉ ; « Pas intéressé » aussi, ou revient sur un intérêt. Les déclencheurs
  -- datent la réponse, la journalisent (motif compris) et closent la relance quand plus aucun bien n'attend.
  if p_reponse = 'interesse' then
    update public.matches
       set status = 'interested', reaction_motif = null, reaction_note = null, apprentissage_at = null
     where id = p_match and status = 'sent';
  else
    update public.matches
       set status = 'rejected', reaction_motif = p_motif,
           reaction_note = nullif(btrim(coalesce(p_note, '')), ''), apprentissage_at = null
     where id = p_match and status in ('sent', 'interested');
  end if;
  get diagnostics v_lignes = row_count;
  return jsonb_build_object('ok', true, 'deja', v_lignes = 0, 'statut', v_match.status);
end;
$$;

comment on function public.wa_matching_consigner(uuid, uuid, uuid, text, text, text) is
  'Lot D2 : la réponse d''un acheteur consignée par le copilote WhatsApp (après le « oui » de l''agent) — proposé, intéressé, pas intéressé + motif, pas encore — aux règles des gestes du fil, attribuée à MEGGA AI (app.actor_kind). N''écrit jamais à l''acheteur.';

revoke all on function public.wa_matching_consigner(uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.wa_matching_consigner(uuid, uuid, uuid, text, text, text) to service_role;
```

- [ ] **Étape 3 : Déclarer la fonction dans les types**

Dans `src/types/database.ts`, juste avant `wa_move_transaction_stage` :

Dans `src/types/database.ts`, remplacer :

```ts
      wa_move_transaction_stage: {
```

par :

```ts
      wa_matching_consigner: {
        Args: {
          p_agency: string
          p_match: string
          p_motif?: string
          p_note?: string
          p_profile: string
          p_reponse: string
        }
        Returns: Json
      }
      wa_move_transaction_stage: {
```

- [ ] **Étape 4 : Ajouter les cas de base (W2)**

Ajouter à la fin de `tests/backend/matching-whatsapp.spec.ts` :

```ts

const consigner = async (match: string, reponse: string, motif: string | null = null, note: string | null = null) => {
  const { data, error } = await svc.rpc('wa_matching_consigner', {
    p_agency: s.agencyAId, p_profile: s.agentAId, p_match: match, p_reponse: reponse, p_motif: motif, p_note: note,
  })
  if (error) throw new Error(error.message)
  return data as { ok: boolean; deja?: boolean; deal_id?: string; relance_id?: string }
}
const lireMatch = async (id: string) =>
  (await svc.from('matches').select('status, sent_via, prix_propose, reaction_motif, reaction_note').eq('id', id).single()).data as Record<string, unknown>
const journal = async (contactId: string, action: string) =>
  ((await svc.from('activity_events').select('actor_kind, actor_id, metadata').eq('entity_id', contactId).eq('action', action)).data ?? []) as {
    actor_kind: string; actor_id: string | null; metadata: Record<string, unknown>
  }[]

describe.skipIf(!HAS_KEYS)('W2 — consigner une réponse', () => {
  it('« proposé » : le match, un deal new_lead, UNE relance à +3 jours, le journal signé MEGGA AI', async () => {
    const m = await mkMatch(s.agencyAId, marc, { annonce: await mkAnnonce('w2p') })
    const r = await consigner(m, 'propose')
    expect(r).toMatchObject({ ok: true, deja: false })
    const apres = await lireMatch(m)
    expect(apres).toMatchObject({ status: 'sent', sent_via: 'agent' })
    expect(Number(apres.prix_propose)).toBe(1_200_000)
    const { data: deal } = await svc.from('transactions').select('stage, status, contact_buyer_id').eq('id', r.deal_id!).single()
    expect(deal).toMatchObject({ stage: 'new_lead', status: 'active', contact_buyer_id: marc })
    const { data: relance } = await svc.from('reminders').select('type, channel, status, match_id, trigger_at').eq('id', r.relance_id!).single()
    expect(relance).toMatchObject({ type: 'follow_up_sent_property', channel: 'task', status: 'pending', match_id: m })
    expect(Date.parse((relance as { trigger_at: string }).trigger_at)).toBeGreaterThan(Date.now() + 2.9 * JOUR)
    expect(await journal(marc, 'match_propose')).toEqual([expect.objectContaining({ actor_kind: 'ai', actor_id: null })])
    // Deux fois le même geste : rien de réécrit.
    expect(await consigner(m, 'propose')).toMatchObject({ ok: true, deja: true })
  })

  it('« intéressé » puis « pas intéressé » : les déclencheurs datent, journalisent (ai) et closent la relance', async () => {
    const m1 = await mkMatch(s.agencyAId, julie, { annonce: await mkAnnonce('w2i1') }, { status: 'sent', sent_at: ilYA(4), prix_propose: 1_200_000 })
    const m2 = await mkMatch(s.agencyAId, julie, { annonce: await mkAnnonce('w2i2') }, { status: 'sent', sent_at: ilYA(4), prix_propose: 1_200_000 })
    const rel = await mkRelance(s.agencyAId, julie, [m1, m2], ilYA(1))
    expect(await consigner(m1, 'interesse')).toMatchObject({ ok: true, deja: false })
    expect((await svc.from('reminders').select('status').eq('id', rel).single()).data).toMatchObject({ status: 'pending' })
    expect(await consigner(m2, 'pas_interesse', 'prix', '  trop cher  ')).toMatchObject({ ok: true, deja: false })
    expect(await lireMatch(m2)).toMatchObject({ status: 'rejected', reaction_motif: 'prix', reaction_note: 'trop cher' })
    expect((await svc.from('reminders').select('status').eq('id', rel).single()).data).toMatchObject({ status: 'done' })
    const reactions = await journal(julie, 'match_reaction')
    expect(reactions.length).toBeGreaterThanOrEqual(2)
    expect(reactions.every((e) => e.actor_kind === 'ai' && e.metadata.via === 'whatsapp')).toBe(true)
    // « Pas intéressé » revient aussi sur un intérêt ; « intéressé » ne répond qu'à un bien proposé.
    expect(await consigner(m1, 'pas_interesse', 'quartier')).toMatchObject({ ok: true, deja: false })
    expect(await consigner(m1, 'interesse')).toMatchObject({ ok: true, deja: true })
  })

  it('« pas encore » repousse la relance qui couvre le bien ; un refus sans motif est une erreur', async () => {
    const m = await mkMatch(s.agencyAId, lea, { annonce: await mkAnnonce('w2e') }, { status: 'sent', sent_at: ilYA(4), prix_propose: 1_200_000 })
    const rel = await mkRelance(s.agencyAId, lea, [m], ilYA(1))
    expect(await consigner(m, 'pas_encore')).toMatchObject({ ok: true, deja: false, relance_id: rel })
    const { data } = await svc.from('reminders').select('trigger_at').eq('id', rel).single()
    expect(Date.parse((data as { trigger_at: string }).trigger_at)).toBeGreaterThan(Date.now() + 2.9 * JOUR)
    expect(await lireMatch(m)).toMatchObject({ status: 'sent' })
    expect(await journal(lea, 'match_pas_encore')).toEqual([expect.objectContaining({ actor_kind: 'ai' })])
    await expect(consigner(m, 'pas_interesse')).rejects.toThrow(/motif/)
  })

  it('un match d’une autre agence est refusé ; un utilisateur ne peut pas appeler la fonction', async () => {
    const m = await mkMatch(s.agencyBId, chezB, { annonce: await mkAnnonce('w2b') }, { status: 'sent', sent_at: ilYA(4) })
    expect(await consigner(m, 'interesse')).toEqual({ ok: false })
    expect(await lireMatch(m)).toMatchObject({ status: 'sent' })
    const { error } = await s.clientA.rpc('wa_matching_consigner', { p_agency: s.agencyAId, p_profile: s.agentAId, p_match: m, p_reponse: 'interesse' })
    expect(error).not.toBeNull()
  })
})
```

- [ ] **Étape 5 : Vérifier**

```bash
npx vitest run tests/unit/matching-whatsapp-sql.spec.ts
```

Attendu : PASS (5 tests).

```bash
node scripts/check-migration-idempotence.mjs && node scripts/check-spec-sql-blocks.mjs
```

Attendu : Vertes.

```bash
npx tsc -b
```

Attendu : Sortie 0.

---

## Tâche 3 : La base : la visite du copilote (`wa_matching_visite`, `wa_matching_visite_annuler`)

La règle de « Planifier une visite » (`execPlanifierVisite` du fil) : un acheteur « intéressé » passe `visit_planned`, son deal avance ; un mandat reçoit une ligne `visits`, une annonce du marché un événement d'agenda. ⛔ `reminder_sent = true` à la création : `visit-reminders-j1` écrit au client la veille de toute visite dont le rappel n'est pas parti, alors que l'outil promet de ne RIEN lui envoyer (conception §2, §5.4). Son annulation (« /annuler ») rend d'un bloc ce que la visite a posé.

**Fichiers :**
- Modifier : `supabase/migrations/20260924200000_matching_whatsapp.sql`
- Modifier : `tests/unit/matching-whatsapp-sql.spec.ts`
- Modifier : `tests/backend/matching-whatsapp.spec.ts`
- Modifier : `src/types/database.ts`

- [ ] **Étape 1 : Écrire le test qui échoue**

Ajouter à la fin de `tests/unit/matching-whatsapp-sql.spec.ts` :

```ts

describe('lot D2 — la migration : la visite du copilote', () => {
  const d2 = migration('_matching_whatsapp.sql')

  it.each(['wa_matching_visite', 'wa_matching_visite_annuler'])('%s : MEGGA AI signe, et le rôle de service seul l’appelle', (nom) => {
    signeeEtReservee(d2.sql, nom)
  })

  it('la visite lit le contact et le mandat dans l’agence ; l’annulation ne touche que l’agence passée', () => {
    const visite = nu(fonction(d2.sql, 'wa_matching_visite').corps)
    expect(visite).toContain('where c.id = p_contact and c.agency_id = p_agency')
    expect(visite).toContain('where p.id = p_property and p.agency_id = p_agency and p.deleted_at is null')
    const annuler = nu(fonction(d2.sql, 'wa_matching_visite_annuler').corps)
    for (const table of ['visits', 'calendar_events', 'matches', 'transactions']) {
      expect(annuler, table).toMatch(new RegExp(`(?:from|update) public\\.${table} (?:set .*? )?where id = v_\\w+ and agency_id = p_agency`))
    }
  })
})
```

```bash
npx vitest run tests/unit/matching-whatsapp-sql.spec.ts
```

Attendu : ÉCHEC : `wa_matching_visite introuvable`.

- [ ] **Étape 2 : Ajouter la section 3 à la migration**

Ajouter à la fin de `supabase/migrations/20260924200000_matching_whatsapp.sql` :

```sql

-- ── 3. La visite de `schedule_visit`, et son « /annuler » ───────────────────
-- La règle de « Planifier une visite » (`execPlanifierVisite` du fil) : si l'acheteur est INTÉRESSÉ par ce bien, son
-- match passe `visit_planned` et son deal (l'actif, sinon un `new_lead`) avance à `visit_planned` s'il était avant,
-- jamais en arrière. Un mandat reçoit une ligne `visits` ; une annonce du marché, que l'agence ne détient pas
-- (`visits.property_id` n'accepte qu'un mandat), un événement `visite` de l'agenda, qui se journalise lui-même.
-- ⛔ `reminder_sent = true` : `visit-reminders-j1` écrit au client la veille de toute visite `planned` dont le rappel
-- n'est pas parti ; le copilote promet de ne RIEN lui envoyer.
-- Rendu : ce que `/annuler` défera (`wa_matching_visite_annuler`) — la visite ou l'événement, le match s'il a bougé,
-- l'étape du deal d'avant s'il a avancé.
create or replace function public.wa_matching_visite(
  p_agency uuid,
  p_profile uuid,
  p_contact uuid,
  p_property uuid,
  p_market_listing uuid,
  p_debut timestamptz,
  p_duree integer default 45,
  p_type text default 'sur_place'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_nom text;
  v_titre text;
  v_lieu text;
  v_match uuid;
  v_statut text;
  v_deal uuid;
  v_etape text;
  v_etape_avant text;
  v_visite uuid;
  v_evenement uuid;
  v_duree integer := least(greatest(coalesce(p_duree, 45), 5), 480);
begin
  if (p_property is null) = (p_market_listing is null) then
    raise exception 'wa_matching_visite : un bien, et un seul (un mandat OU une annonce)' using errcode = '22023';
  end if;
  if p_debut is null then
    raise exception 'wa_matching_visite : la date est requise' using errcode = '22023';
  end if;

  perform set_config('app.actor_kind', 'ai', true);
  perform set_config('app.actor_via', 'whatsapp', true);
  if p_profile is not null then
    perform set_config('app.actor_profile_id', p_profile::text, true);
  end if;

  select nullif(btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), '') into v_nom
    from public.contacts c
   where c.id = p_contact and c.agency_id = p_agency;
  if not found then
    return jsonb_build_object('ok', false, 'raison', 'contact');
  end if;
  if p_property is not null then
    select coalesce(nullif(p.title, ''), p.address, 'bien'), p.address into v_titre, v_lieu
      from public.properties p
     where p.id = p_property and p.agency_id = p_agency and p.deleted_at is null;
  else
    select coalesce(nullif(ml.title, ''), ml.address, ml.city, 'annonce'), ml.address into v_titre, v_lieu
      from public.market_listings ml
     where ml.id = p_market_listing;
  end if;
  if not found then
    return jsonb_build_object('ok', false, 'raison', 'bien');
  end if;

  -- Le match de CET acheteur sur CE bien : une paire au plus (index uniques par contact et bien).
  select m.id, m.status::text into v_match, v_statut
    from public.matches m
   where m.agency_id = p_agency and m.contact_id = p_contact
     and ((p_property is not null and m.property_id = p_property)
       or (p_market_listing is not null and m.market_listing_id = p_market_listing))
   limit 1
   for update;

  if v_statut = 'interested' then
    update public.matches set status = 'visit_planned' where id = v_match and status = 'interested';
    select t.id, t.stage::text into v_deal, v_etape
      from public.transactions t
     where t.agency_id = p_agency and t.contact_buyer_id = p_contact and t.status = 'active'
     order by t.created_at desc
     limit 1
     for update;
    if v_deal is null then
      insert into public.transactions (agency_id, contact_buyer_id, assigned_to, stage, status, property_id, market_listing_id)
      values (p_agency, p_contact, p_profile, 'new_lead', 'active', p_property, p_market_listing)
      returning id into v_deal;
      v_etape := 'new_lead';
    elsif p_property is not null then
      update public.transactions set property_id = p_property where id = v_deal and property_id is null;
    end if;
  end if;

  if p_property is not null then
    insert into public.visits (agency_id, agent_id, property_id, contact_id, transaction_id, scheduled_at,
                               duration_minutes, status, visit_type, buyer_name, reminder_sent, video_platform)
    values (p_agency, p_profile, p_property, p_contact, v_deal, p_debut, v_duree, 'planned',
            case when p_type = 'video' then 'video' else 'sur_place' end, v_nom,
            true,
            case when p_type = 'video' then 'google_meet' end)
    returning id into v_visite;
    insert into public.activity_events (agency_id, actor_id, actor_kind, action, entity_type, entity_id, object_label,
                                        category, severity, metadata)
    values (p_agency, null, 'ai', 'visit_scheduled', 'contact', p_contact,
            left(v_titre || ' — ' || to_char(p_debut at time zone 'Europe/Zurich', 'DD.MM.YYYY HH24:MI'), 500),
            'contact', 'info',
            jsonb_build_object('via', 'whatsapp', 'profile_id', p_profile, 'visit_id', v_visite, 'match_id', v_match,
                               'deal_id', v_deal, 'scheduled_at', p_debut));
  else
    insert into public.calendar_events (agency_id, created_by, type, title, starts_at, ends_at, contact_id, location)
    values (p_agency, p_profile, 'visite', left('Visite · ' || v_titre, 200), p_debut,
            p_debut + make_interval(mins => v_duree), p_contact, v_lieu)
    returning id into v_evenement;
  end if;

  if v_deal is not null and v_etape in ('new_lead', 'to_qualify', 'active_search', 'to_recontact') then
    update public.transactions set stage = 'visit_planned' where id = v_deal;
    v_etape_avant := v_etape;
  end if;

  return jsonb_build_object(
    'ok', true,
    'genre', case when p_property is not null then 'mandat' else 'annonce' end,
    'titre', v_titre,
    'visite_id', v_visite,
    'evenement_id', v_evenement,
    'match_id', v_match,
    'statut_match', v_statut,
    'match_avant', case when v_statut = 'interested' then 'interested' end,
    'deal_id', v_deal,
    'etape_avant', v_etape_avant);
end;
$$;

comment on function public.wa_matching_visite(uuid, uuid, uuid, uuid, uuid, timestamptz, integer, text) is
  'Lot D2 : la visite planifiée par le copilote WhatsApp — visits (mandat, sans rappel J-1 au client) ou événement d''agenda (annonce) ; un acheteur intéressé passe visit_planned et son deal avance. Attribuée à MEGGA AI.';

revoke all on function public.wa_matching_visite(uuid, uuid, uuid, uuid, uuid, timestamptz, integer, text) from public, anon, authenticated;
grant execute on function public.wa_matching_visite(uuid, uuid, uuid, uuid, uuid, timestamptz, integer, text) to service_role;

-- « /annuler » d'une visite du copilote : rend ce que `wa_matching_visite` a écrit, d'un bloc. Accepte aussi l'ancien
-- `visit_id` (payload d'avant le lot D2, dans sa fenêtre de 30 s). `ok = false` : rien n'a été défait.
create or replace function public.wa_matching_visite_annuler(p_agency uuid, p_profile uuid, p_retour jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_visite uuid := nullif(coalesce(p_retour ->> 'visite_id', p_retour ->> 'visit_id'), '')::uuid;
  v_evenement uuid := nullif(p_retour ->> 'evenement_id', '')::uuid;
  v_match uuid := nullif(p_retour ->> 'match_id', '')::uuid;
  v_deal uuid := nullif(p_retour ->> 'deal_id', '')::uuid;
  v_etape text := nullif(p_retour ->> 'etape_avant', '');
  v_lignes integer := 0;
begin
  perform set_config('app.actor_kind', 'ai', true);
  perform set_config('app.actor_via', 'whatsapp', true);
  if p_profile is not null then
    perform set_config('app.actor_profile_id', p_profile::text, true);
  end if;

  if v_visite is not null then
    delete from public.visits where id = v_visite and agency_id = p_agency;
    get diagnostics v_lignes = row_count;
  elsif v_evenement is not null then
    delete from public.calendar_events where id = v_evenement and agency_id = p_agency;
    get diagnostics v_lignes = row_count;
  end if;
  if v_lignes = 0 then
    return jsonb_build_object('ok', false);
  end if;
  -- Seulement ce que la visite avait posé, et seulement s'il n'a pas bougé depuis.
  if v_match is not null then
    update public.matches set status = 'interested'
     where id = v_match and agency_id = p_agency and status = 'visit_planned';
  end if;
  if v_deal is not null and v_etape is not null then
    update public.transactions set stage = v_etape::public.transaction_stage
     where id = v_deal and agency_id = p_agency and stage = 'visit_planned';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.wa_matching_visite_annuler(uuid, uuid, jsonb) is
  'Lot D2 : « /annuler » d''une visite du copilote WhatsApp — la visite ou l''événement, le match revenu à interested, le deal à son étape d''avant ; attribué à MEGGA AI.';

revoke all on function public.wa_matching_visite_annuler(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.wa_matching_visite_annuler(uuid, uuid, jsonb) to service_role;
```

- [ ] **Étape 3 : Déclarer les deux fonctions dans les types**

Dans `src/types/database.ts`, juste avant `wa_move_transaction_stage` (donc après `wa_matching_consigner`) :

Dans `src/types/database.ts`, remplacer :

```ts
      wa_move_transaction_stage: {
```

par :

```ts
      wa_matching_visite: {
        Args: {
          p_agency: string
          p_contact: string
          p_debut: string
          p_duree?: number
          p_market_listing: string
          p_profile: string
          p_property: string
          p_type?: string
        }
        Returns: Json
      }
      wa_matching_visite_annuler: {
        Args: { p_agency: string; p_profile: string; p_retour: Json }
        Returns: Json
      }
      wa_move_transaction_stage: {
```

- [ ] **Étape 4 : Ajouter les cas de base (W3)**

Ajouter à la fin de `tests/backend/matching-whatsapp.spec.ts` :

```ts

const planifier = async (contact: string, cible: { bien?: string; annonce?: string }, debut: string) => {
  const { data, error } = await svc.rpc('wa_matching_visite', {
    p_agency: s.agencyAId, p_profile: s.agentAId, p_contact: contact, p_property: cible.bien ?? null,
    p_market_listing: cible.annonce ?? null, p_debut: debut, p_duree: 45, p_type: 'sur_place',
  })
  if (error) throw new Error(error.message)
  return data as {
    ok: boolean; raison?: string; visite_id: string | null; evenement_id: string | null; deal_id: string | null
    etape_avant: string | null; statut_match: string | null; match_avant: string | null
  }
}
const statutMatch = async (id: string) => ((await svc.from('matches').select('status').eq('id', id).single()).data as { status: string }).status

describe.skipIf(!HAS_KEYS)('W3 — la visite du copilote', () => {
  it('un intéressé passe visit_planned, la visite porte le deal, aucun rappel au client ; « /annuler » rend tout', async () => {
    const bien = await mkBien(s.agencyAId, 'w3m')
    const m = await mkMatch(s.agencyAId, julie, { bien }, { status: 'interested', sent_at: ilYA(6) })
    const r = await planifier(julie, { bien }, dans(5))
    if (r.visite_id) visites.push(r.visite_id)
    expect(r).toMatchObject({ ok: true, match_avant: 'interested', etape_avant: 'new_lead' })
    expect(await statutMatch(m)).toBe('visit_planned')
    const { data: v } = await svc.from('visits').select('reminder_sent, transaction_id, status').eq('id', r.visite_id!).single()
    expect(v).toEqual({ reminder_sent: true, transaction_id: r.deal_id, status: 'planned' })
    expect((await svc.from('transactions').select('stage').eq('id', r.deal_id!).single()).data).toEqual({ stage: 'visit_planned' })

    const { data: annule } = await svc.rpc('wa_matching_visite_annuler', {
      p_agency: s.agencyAId, p_profile: s.agentAId,
      p_retour: { visite_id: r.visite_id, match_id: m, deal_id: r.deal_id, etape_avant: r.etape_avant },
    })
    expect(annule).toEqual({ ok: true })
    expect((await svc.from('visits').select('id').eq('id', r.visite_id!)).data).toEqual([])
    expect(await statutMatch(m)).toBe('interested')
    expect((await svc.from('transactions').select('stage').eq('id', r.deal_id!).single()).data).toEqual({ stage: 'new_lead' })
  })

  it('une annonce du marché devient un événement d’agenda ; un bien seulement proposé ne bouge pas', async () => {
    const annonce = await mkAnnonce('w3a')
    const m = await mkMatch(s.agencyAId, marc, { annonce }, { status: 'sent', sent_at: ilYA(3), prix_propose: 1_200_000 })
    const r = await planifier(marc, { annonce }, dans(4))
    if (r.evenement_id) evenements.push(r.evenement_id)
    expect(r).toMatchObject({ ok: true, visite_id: null, statut_match: 'sent', match_avant: null })
    const { data: e } = await svc.from('calendar_events').select('type, contact_id').eq('id', r.evenement_id!).single()
    expect(e).toEqual({ type: 'visite', contact_id: marc })
    expect(await statutMatch(m)).toBe('sent')
  })

  it('un contact d’une autre agence n’a pas de visite ; un utilisateur ne peut pas appeler la fonction', async () => {
    const bien = await mkBien(s.agencyAId, 'w3b')
    expect(await planifier(chezB, { bien }, dans(4))).toEqual({ ok: false, raison: 'contact' })
    const { error } = await s.clientA.rpc('wa_matching_visite', {
      p_agency: s.agencyAId, p_profile: s.agentAId, p_contact: julie, p_property: bien, p_market_listing: null, p_debut: dans(4),
    })
    expect(error).not.toBeNull()
  })
})
```

- [ ] **Étape 5 : Vérifier**

```bash
npx vitest run tests/unit/matching-whatsapp-sql.spec.ts
```

Attendu : PASS (8 tests).

```bash
node scripts/check-migration-idempotence.mjs && node scripts/check-spec-sql-blocks.mjs
```

Attendu : Vertes.

```bash
npx tsc -b && npx eslint tests/backend/matching-whatsapp.spec.ts tests/unit/matching-whatsapp-sql.spec.ts --quiet
```

Attendu : Sortie 0.

---

## Tâche 4 : Le modèle pur du copilote : états, biens désignés, score expliqué, signaux

Toute la logique des outils vit dans un module PUR, testé sous Vitest : l'état d'un acheteur, le bien qu'un texte désigne (le copilote ne choisit jamais entre plusieurs), le score expliqué critère par critère, le signal « pourquoi maintenant », et la forme des réponses. Il recopie cinq règles du fil — il ne peut pas importer `src/` —, que la tâche 5 confronte. Les exécuteurs (tâches 6 à 9) n'y ajoutent que les requêtes.

**Fichiers :**
- Créer : `supabase/functions/_shared/whatsapp-matching.ts`
- Créer : `supabase/functions/_shared/whatsapp-matching.test.ts`
- Modifier : `vitest.config.ts`
- Modifier : `supabase/functions/_shared/morning-brief.ts`

- [ ] **Étape 1 : Inscrire le test dans Vitest**

Une spec de `_shared` absente de l'allowlist ne tourne NULLE PART (commentaire de `vitest.config.ts`). Dans `include` :

Dans `vitest.config.ts`, remplacer :

```ts
'supabase/functions/_shared/message-sans-bien.test.ts'],
```

par :

```ts
'supabase/functions/_shared/message-sans-bien.test.ts', 'supabase/functions/_shared/whatsapp-matching.test.ts'],
```

- [ ] **Étape 2 : Écrire le test qui échoue**

Créer `supabase/functions/_shared/whatsapp-matching.test.ts` :

```ts
/**
 * Le modèle PUR du matching dans le copilote WhatsApp (lot D2), éprouvé sans base.
 *
 * Ce que ces tests refusent : un bien choisi parmi plusieurs candidats, un refusé ou un reporté rendu par
 * `get_matches`, un état faux, un signal inventé, plus de huit biens ou de dix acheteurs, une annulation de visite qui
 * défairait ce que la visite n'a pas posé. La confrontation aux règles du fil vit dans
 * `tests/unit/whatsapp-matching-fil.spec.ts`.
 */
import { describe, it, expect } from 'vitest'
import {
  bienDAnnonce, bienDeMandat, candidats, etatMatch, expliquer, motsDe, retourDeVisite, signalMatch, vueAcheteurs,
  vueGetMatches, MAX_BIENS, MAX_ACHETEURS, type BienWa, type LigneAnnonce, type LigneMandat, type LigneMatch,
} from './whatsapp-matching'

const MAINTENANT = Date.parse('2026-09-24T08:00:00Z')
const ilYA = (jours: number) => new Date(MAINTENANT - jours * 86_400_000).toISOString()
const dans = (jours: number) => new Date(MAINTENANT + jours * 86_400_000).toISOString()

const annonce = (o: Partial<LigneAnnonce> = {}): LigneAnnonce => ({
  id: 'a1', title: 'Attique 4 p. Florissant', type: 'apartment', transaction_type: 'buy', price: 1_500_000,
  current_price: null, rooms: 4, surface_m2: 120, bedrooms: 3, address: 'Route de Florissant 12', city: 'Genève',
  canton: 'GE', features: ['Terrasse', 'Ascenseur'], year_built: 2019, year_renovated: null, first_seen_at: ilYA(60),
  price_at_first_seen: 1_500_000, price_reduced_at: null, status: 'active', ...o,
})
const mandat = (o: Partial<LigneMandat> = {}): LigneMandat => ({
  id: 'p1', title: 'Villa contemporaine', type: 'house', transaction_type: 'buy', price: 4_200_000, rooms: 7,
  surface_m2: 280, bedrooms: 5, address: 'Chemin des Hauts 3', city: 'Cologny', canton: 'GE', features: { piscine: true },
  condition: 'renovated', year_built: 1995, off_market: true, mandate_signed_at: null, published_at: ilYA(40), status: 'active', ...o,
})
const match = (o: Partial<LigneMatch> = {}): LigneMatch => ({
  id: 'm1', contact_id: 'c1', status: 'suggested', score: 80, reasons: null, client_search_id: null,
  property_id: null, market_listing_id: 'a1', snoozed_until: null, sent_at: null, response_at: null,
  reaction_motif: null, reaction_note: null, prix_propose: null, ...o,
})

describe('etatMatch — où en est un acheteur', () => {
  it('à proposer, reporté (le report ne vaut que pour un match à proposer), revenu', () => {
    expect(etatMatch(match(), MAINTENANT)).toEqual({ code: 'a_proposer' })
    expect(etatMatch(match({ snoozed_until: dans(3) }), MAINTENANT)).toEqual({ code: 'reporte', jusqua: '27.09.2026' })
    // Un report échu ne compte plus.
    expect(etatMatch(match({ snoozed_until: ilYA(1) }), MAINTENANT)).toEqual({ code: 'a_proposer' })
    expect(etatMatch(match({ reaction_motif: 'prix', prix_propose: 1_700_000 }), MAINTENANT)).toEqual({ code: 'revenu', refuse_a: "CHF 1'700'000" })
    // Revenu pour un autre motif que le prix : rien ne le distingue d'un match à proposer.
    expect(etatMatch(match({ reaction_motif: 'quartier', prix_propose: 1_700_000 }), MAINTENANT)).toEqual({ code: 'a_proposer' })
  })

  it('proposé (avec sa date), intéressé, visite, refusé avec ou sans motif lisible', () => {
    expect(etatMatch(match({ status: 'sent', sent_at: ilYA(2), snoozed_until: dans(3) }), MAINTENANT)).toEqual({ code: 'propose', le: '22.09.2026' })
    expect(etatMatch(match({ status: 'interested' }), MAINTENANT)).toEqual({ code: 'interesse' })
    expect(etatMatch(match({ status: 'visit_planned' }), MAINTENANT)).toEqual({ code: 'visite' })
    expect(etatMatch(match({ status: 'rejected', reaction_motif: 'prix' }), MAINTENANT)).toEqual({ code: 'refuse', motif: 'prix' })
    expect(etatMatch(match({ status: 'rejected', reaction_motif: 'recherche_ajustee' }), MAINTENANT)).toEqual({ code: 'refuse', motif: null })
  })
})

describe('candidats — le copilote ne choisit jamais entre plusieurs biens', () => {
  const biens = [
    { id: '11111111-1111-4111-8111-111111111111', titre: 'Attique 4 p.', adresse: 'Route de Florissant 12', ville: 'Genève' },
    { id: '22222222-2222-4222-8222-222222222222', titre: 'Appartement 3 p.', adresse: 'Route de Florissant 40', ville: 'Genève' },
    { id: '33333333-3333-4333-8333-333333333333', titre: 'Villa contemporaine', adresse: 'Chemin des Hauts 3', ville: 'Cologny' },
  ]

  it('tous les mots du texte, accents et casse ignorés ; un début de mot à partir de quatre lettres', () => {
    expect(candidats(biens, "l'attique de Florissant").map((b) => b.titre)).toEqual(['Attique 4 p.'])
    expect(candidats(biens, 'la villa de COLOGNY').map((b) => b.titre)).toEqual(['Villa contemporaine'])
    expect(candidats(biens, 'attiq').map((b) => b.titre)).toEqual(['Attique 4 p.'])
  })

  it('plusieurs biens répondent : tous sont rendus, aucun n’est choisi', () => {
    expect(candidats(biens, 'Florissant')).toHaveLength(2)
  })

  it('un identifiant désigne son bien seul ; un texte sans mot utile ne désigne rien', () => {
    expect(candidats(biens, '33333333-3333-4333-8333-333333333333').map((b) => b.titre)).toEqual(['Villa contemporaine'])
    expect(candidats(biens, 'le bien')).toEqual([])
    expect(motsDe("L'attique de la Route")).toEqual(['attique', 'route'])
  })
})

describe('signalMatch — pourquoi maintenant', () => {
  it('la baisse depuis la proposition, ou depuis le refus pour le prix, passe avant celle du bien', () => {
    const bien = bienDAnnonce(annonce({ price: 1_400_000, price_at_first_seen: 1_600_000, price_reduced_at: ilYA(2) }))
    expect(signalMatch(match({ status: 'sent', prix_propose: 1_500_000 }), bien, MAINTENANT)).toEqual({ genre: 'baisse_depuis_proposition', montant: 100_000 })
    expect(signalMatch(match({ reaction_motif: 'prix', prix_propose: 1_550_000 }), bien, MAINTENANT)).toEqual({ genre: 'baisse_depuis_refus', montant: 150_000 })
    expect(signalMatch(match(), bien, MAINTENANT)).toEqual({ genre: 'baisse', montant: 200_000, le: ilYA(2) })
  })

  it('nouveau sur le marché (3 jours), nouveau mandat (7 jours) ; rien au-delà, rien sur un prix nul', () => {
    expect(signalMatch(match(), bienDAnnonce(annonce({ first_seen_at: ilYA(1) })), MAINTENANT)).toEqual({ genre: 'nouveau', le: ilYA(1) })
    expect(signalMatch(match(), bienDAnnonce(annonce({ first_seen_at: ilYA(4) })), MAINTENANT)).toBeNull()
    expect(signalMatch(match(), bienDeMandat(mandat({ published_at: ilYA(2) })), MAINTENANT)).toEqual({ genre: 'nouveau_mandat', le: ilYA(2) })
    expect(signalMatch(match(), bienDeMandat(mandat()), MAINTENANT)).toBeNull()
    expect(signalMatch(match({ status: 'sent', prix_propose: 1_500_000 }), bienDAnnonce(annonce({ price: 0 })), MAINTENANT)).toBeNull()
  })
})

describe('expliquer — le score, critère par critère', () => {
  it('le verdict du moteur pour le budget, un fait pour les pièces ; aucun verdict sans raison du moteur', () => {
    const bien = bienDAnnonce(annonce())
    const lignes = expliquer(
      { budget_max: 1_400_000, rooms_min: 3, zones: ['Genève'] },
      { budget: { match: false, score: 20, detail: '7 % au-dessus du budget' } },
      bien, MAINTENANT,
    )
    expect(lignes.map((l) => [l.critere, l.tenu, l.ecart])).toEqual([
      ['budget', false, '7 % au-dessus du budget'],
      ['zone', null, null],
      ['pieces', true, null],
    ])
    expect(lignes[0].voulu).toBe("≤ CHF 1'400'000")
    expect(lignes[0].bien).toBe("CHF 1'500'000")
  })

  it('l’état se lit par la règle du moteur ; l’off-market sur l’interrupteur du mandat', () => {
    const villa = bienDeMandat(mandat())
    const lignes = expliquer({ condition_min: 'renovated', off_market_only: true }, null, villa, MAINTENANT)
    expect(lignes.map((l) => [l.critere, l.tenu, l.bien])).toEqual([['etat', true, 'renovated'], ['offMarket', true, 'off-market']])
    // Pas de critère dans la recherche : pas de ligne.
    expect(expliquer(null, null, villa, MAINTENANT)).toEqual([])
  })
})

describe('vueGetMatches — les biens vivants d’un acheteur', () => {
  const entree = (m: Partial<LigneMatch>, b: BienWa = bienDAnnonce(annonce())) => ({ match: match(m), bien: b, criteres: null })

  it('en cours d’abord (intéressé, visite, proposé), puis à proposer ; un reporté n’y est pas', () => {
    const vue = vueGetMatches([
      entree({ id: 'm-s', score: 99 }),
      entree({ id: 'm-p', status: 'sent', sent_at: ilYA(3) }),
      entree({ id: 'm-i', status: 'interested', sent_at: ilYA(9) }),
      entree({ id: 'm-r', score: 100, snoozed_until: dans(2) }),
    ], MAINTENANT, false)
    expect(vue.biens.map((b) => b.etat.code)).toEqual(['interesse', 'propose', 'a_proposer'])
    expect(vue.total).toEqual({ en_cours: 2, a_proposer: '1', reportes: 1 })
  })

  it('à score égal, un signal passe devant ; huit au plus ; « N+ » quand la lecture a atteint sa limite', () => {
    const neuve = bienDAnnonce(annonce({ id: 'a2', first_seen_at: ilYA(1) }))
    const vue = vueGetMatches([entree({ id: 'm-a', score: 80 }), entree({ id: 'm-b', score: 80, market_listing_id: 'a2' }, neuve)], MAINTENANT, true)
    expect(vue.biens.map((b) => b.id)).toEqual(['a2', 'a1'])
    expect(vue.total.a_proposer).toBe('2+')
    const beaucoup = Array.from({ length: 12 }, (_, i) => entree({ id: `m${String(i).padStart(2, '0')}`, score: 60 + i }))
    expect(vueGetMatches(beaucoup, MAINTENANT, false).biens).toHaveLength(MAX_BIENS)
  })
})

describe('vueAcheteurs — qui pour ce bien', () => {
  it('par score, dix au plus avec le total ; les anciens prospects restent sur la fiche d’un mandat actif', () => {
    const lignes = Array.from({ length: 12 }, (_, i) => ({
      id: `m${i}`, contact_id: `c${i}`, status: 'suggested', score: 50 + i, snoozed_until: null, sent_at: null,
      reaction_motif: null, prix_propose: null, nom: `Acheteur ${i}`,
    }))
    const vue = vueAcheteurs(bienDeMandat(mandat()), lignes, MAINTENANT, false)
    expect(vue.acheteurs).toHaveLength(MAX_ACHETEURS)
    expect(vue.acheteurs[0]).toMatchObject({ nom: 'Acheteur 11', score: 61, etat: { code: 'a_proposer' } })
    expect(vue.total).toBe('12')
    expect(vue.anciens_prospects).toBeTruthy()
    expect(vueAcheteurs(bienDAnnonce(annonce({ status: 'removed' })), [], MAINTENANT, false)).toMatchObject({ bien: { retire: true } })
    expect('anciens_prospects' in vueAcheteurs(bienDAnnonce(annonce()), [], MAINTENANT, false)).toBe(false)
  })
})

describe('retourDeVisite — « /annuler » ne défait que ce que la visite a posé', () => {
  it('le match seulement s’il a bougé, le deal seulement s’il a avancé', () => {
    expect(retourDeVisite({ ok: true, visite_id: 'v1', match_id: 'm1', match_avant: 'interested', deal_id: 'd1', etape_avant: 'new_lead' }))
      .toEqual({ visite_id: 'v1', evenement_id: null, match_id: 'm1', deal_id: 'd1', etape_avant: 'new_lead' })
    expect(retourDeVisite({ ok: true, evenement_id: 'e1', match_id: 'm1', statut_match: 'sent', deal_id: null }))
      .toEqual({ visite_id: null, evenement_id: 'e1', match_id: null, deal_id: null, etape_avant: null })
  })
})
```

```bash
npx vitest run supabase/functions/_shared/whatsapp-matching.test.ts
```

Attendu : ÉCHEC : `./whatsapp-matching` introuvable.

- [ ] **Étape 3 : Exporter le format CHF du point du matin**

Le module écrit ses montants comme le point du matin. Dans `supabase/functions/_shared/morning-brief.ts` :

Dans `supabase/functions/_shared/morning-brief.ts`, remplacer :

```ts
/** Montant en CHF suisse (apostrophe). Dupliqué de whatsapp-actions.ts : l'importer
 *  tirerait ses imports https: Deno dans le run Vitest. */
function fmtCHF(n: number): string {
```

par :

```ts
/** Montant en CHF suisse (apostrophe). Dupliqué de whatsapp-actions.ts : l'importer
 *  tirerait ses imports https: Deno dans le run Vitest. Exporté pour le copilote du matching
 *  (`whatsapp-matching.ts`, lot D2), qui écrit ses montants comme ce point du matin. */
export function fmtCHF(n: number): string {
```

- [ ] **Étape 4 : Écrire le module**

Créer `supabase/functions/_shared/whatsapp-matching.ts` :

```ts
// Le matching dans le copilote WhatsApp (lot D2, étape 4b) — modèle PUR : ni Supabase, ni réseau, ni API Deno.
//
// Conception : docs/superpowers/specs/2026-09-24-matching-lot-d2-whatsapp-design.md (§3, §5).
// Testé sous Vitest (`whatsapp-matching.test.ts`, dans l'allowlist de vitest.config.ts) et CONFRONTÉ aux règles du
// CRM par `tests/unit/whatsapp-matching-fil.spec.ts` : les statuts « compatibles », les motifs de refus, les seuils
// des signaux, l'état d'un acheteur et l'explication du score existent déjà dans le fil (`src/components/matching-fil/`).
// Ce module ne peut pas les importer — le bundle Vite et le runtime Deno ne partagent pas `@/` — : il les recopie, et
// la spec rougit au premier écart.
//
// ⛔ Rien ici n'écrit à l'acheteur : ces fonctions rangent, désignent et décrivent ce que l'agent consigne.

import { ETATS_BIEN, etatDuBien, slugify, type EtatBien } from './matching-normalize.ts'
import { fmtCHF } from './morning-brief.ts'

/** Les statuts d'un acquéreur COMPATIBLE, ceux qu'un refus n'a pas écartés. ⚠ Copie de `STATUTS_COMPATIBLES` (filQuiPour.ts). */
export const STATUTS_COMPATIBLES = ['suggested', 'sent', 'interested', 'visit_planned'] as const
/** Les biens EN COURS pour un acheteur : proposés, intéressés, en visite. */
export const STATUTS_EN_COURS = ['sent', 'interested', 'visit_planned'] as const
/**
 * Les motifs d'un refus, dans l'ordre du fil. ⚠ Copie de `MOTIFS_REFUS` (filBoucle.ts) ; sans `recherche_ajustee`,
 * qui n'est pas une réponse de l'acheteur.
 */
export const MOTIFS_REFUS = ['prix', 'quartier', 'surface', 'pieces', 'type', 'equipements', 'etat', 'autre'] as const
export type MotifRefus = (typeof MOTIFS_REFUS)[number]
/** Les seuils des signaux, en jours. ⚠ Ceux de `filSignaux.ts`, et du SQL des lots C et D1. */
export const JOURS_NOUVEAU = 3
export const JOURS_BAISSE = 14
export const JOURS_MANDAT = 7
const JOUR = 86_400_000

/** Les réponses que `record_match_outcome` consigne (conception §5.3). */
export const REPONSES = ['propose', 'interesse', 'pas_interesse', 'pas_encore'] as const
export type Reponse = (typeof REPONSES)[number]
/** Le statut que chaque réponse suppose : le bien se cherche parmi ces matchs, et la base le revérifie à l'écriture. */
export const STATUTS_DE_DEPART: Readonly<Record<Reponse, readonly string[]>> = {
  propose: ['suggested'],
  interesse: ['sent'],
  pas_interesse: ['sent', 'interested'],
  pas_encore: ['sent'],
}

export const estReponse = (v: unknown): v is Reponse => typeof v === 'string' && (REPONSES as readonly string[]).includes(v)
export const estMotif = (v: unknown): v is MotifRefus => typeof v === 'string' && (MOTIFS_REFUS as readonly string[]).includes(v)

/** Un nombre lu en base (`numeric` arrive en chaîne) ; `null` s'il n'en est pas un. */
export function nombreOuNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

/** Horodatage d'une date ISO ; absente ou illisible, 0 — pour que les tris restent totaux. */
const temps = (iso: string | null | undefined): number => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isFinite(t) ? t : 0
}

/** Les chaînes non vides d'un tableau jsonb : une zone ou un équipement mal saisi n'existe pas. */
const chaines = (v: unknown): string[] =>
  (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [])

/** Les équipements d'un bien : un tableau de chaînes, ou un objet `{ equipement: vrai }`. */
function listeEquipements(brut: unknown): string[] {
  if (Array.isArray(brut)) return brut.filter((f): f is string => typeof f === 'string')
  if (brut && typeof brut === 'object') {
    return Object.entries(brut as Record<string, unknown>).filter(([, v]) => Boolean(v)).map(([k]) => k)
  }
  return []
}

/** Une date en clair, à la suisse (jour.mois.année), fuseau de Zurich. */
export function dateSuisse(iso: string | null | undefined): string | null {
  if (!iso || !Number.isFinite(Date.parse(iso))) return null
  return new Intl.DateTimeFormat('fr-CH', { timeZone: 'Europe/Zurich', day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date(iso))
}

// ── Les lignes lues ─────────────────────────────────────────────────────────

/** Les colonnes d'un match que le copilote lit. */
export const COLONNES_MATCH =
  'id, contact_id, status, score, reasons, client_search_id, property_id, market_listing_id, snoozed_until, sent_at, response_at, reaction_motif, reaction_note, prix_propose'
export interface LigneMatch {
  id: string
  contact_id: string
  status: string
  score: number | string | null
  reasons: unknown
  client_search_id: string | null
  property_id: string | null
  market_listing_id: string | null
  snoozed_until: string | null
  sent_at: string | null
  response_at: string | null
  reaction_motif: string | null
  reaction_note: string | null
  prix_propose: number | string | null
}

/** Les colonnes d'un mandat. ⚠ `properties` n'a ni `year_renovated` ni colonne de référence. */
export const COLONNES_MANDAT =
  'id, title, type, transaction_type, price, rooms, surface_m2, bedrooms, address, city, canton, features, condition, year_built, off_market, mandate_signed_at, published_at, status'
export interface LigneMandat {
  id: string
  title: string | null
  type: string | null
  transaction_type: string | null
  price: number | string | null
  rooms: number | string | null
  surface_m2: number | string | null
  bedrooms: number | string | null
  address: string | null
  city: string | null
  canton: string | null
  features: unknown
  condition: string | null
  year_built: number | string | null
  off_market: boolean | null
  mandate_signed_at: string | null
  published_at: string | null
  status: string | null
}

/** Les colonnes d'une annonce du marché. */
export const COLONNES_ANNONCE =
  'id, title, type, transaction_type, price, current_price, rooms, surface_m2, bedrooms, address, city, canton, features, year_built, year_renovated, first_seen_at, price_at_first_seen, price_reduced_at, status'
export interface LigneAnnonce {
  id: string
  title: string | null
  type: string | null
  transaction_type: string | null
  price: number | string | null
  current_price: number | string | null
  rooms: number | string | null
  surface_m2: number | string | null
  bedrooms: number | string | null
  address: string | null
  city: string | null
  canton: string | null
  features: unknown
  year_built: number | string | null
  year_renovated: number | string | null
  first_seen_at: string | null
  price_at_first_seen: number | string | null
  price_reduced_at: string | null
  status: string | null
}

/** Un bien, tel que le copilote le lit : un mandat de l'agence ou une annonce du marché. */
export interface BienWa {
  id: string
  genre: 'mandat' | 'annonce'
  titre: string
  prix: number | null
  location: boolean
  type: string | null
  pieces: number | null
  surface: number | null
  chambres: number | null
  ville: string | null
  canton: string | null
  adresse: string | null
  equipements: string[]
  offMarket: boolean
  /** Ce que lit `etatDuBien` du moteur : l'état saisi (mandat) et les années. */
  brutEtat: Record<string, unknown>
  /** Plus en service : une annonce retirée du marché, un mandat qui n'est plus actif. */
  retire: boolean
  /** Les signaux : apparition et baisse d'une annonce, signature ou mise en service d'un mandat. */
  vuLe: string | null
  prixInitial: number | null
  baisseLe: string | null
  mandatLe: string | null
}

/** La plus récente de deux dates ISO ; l'une absente, l'autre. */
const plusRecente = (a: string | null, b: string | null): string | null => {
  if (!a || !b) return a ?? b
  return Date.parse(a) >= Date.parse(b) ? a : b
}

/** Un mandat, dans la forme du copilote — la règle de `versBien` (useMatchingFil.ts). */
export function bienDeMandat(l: LigneMandat): BienWa {
  return {
    id: l.id, genre: 'mandat', titre: l.title?.trim() || l.address?.trim() || l.city?.trim() || 'Bien',
    prix: nombreOuNull(l.price), location: l.transaction_type === 'rent', type: l.type,
    pieces: nombreOuNull(l.rooms), surface: nombreOuNull(l.surface_m2), chambres: nombreOuNull(l.bedrooms),
    ville: l.city, canton: l.canton, adresse: l.address, equipements: listeEquipements(l.features),
    offMarket: l.off_market === true,
    brutEtat: { condition: l.condition, year_built: l.year_built },
    retire: l.status != null && l.status !== 'active',
    vuLe: null, prixInitial: null, baisseLe: null,
    // `mandate_signed_at` n'est posé que par « Nouveau bien » : la mise en service date aussi un nouveau mandat.
    mandatLe: plusRecente(l.mandate_signed_at, l.published_at),
  }
}

/** Une annonce du marché, dans la forme du copilote — la règle de `versBienMarche` (useMatchingFil.ts). */
export function bienDAnnonce(l: LigneAnnonce): BienWa {
  return {
    id: l.id, genre: 'annonce', titre: l.title?.trim() || l.address?.trim() || l.city?.trim() || 'Annonce',
    prix: nombreOuNull(l.current_price) ?? nombreOuNull(l.price), location: l.transaction_type === 'rent', type: l.type,
    pieces: nombreOuNull(l.rooms), surface: nombreOuNull(l.surface_m2), chambres: nombreOuNull(l.bedrooms),
    ville: l.city, canton: l.canton, adresse: l.address, equipements: listeEquipements(l.features),
    // Une annonce du marché est publique par définition.
    offMarket: false,
    brutEtat: { year_built: l.year_built, year_renovated: l.year_renovated },
    retire: l.status === 'removed',
    vuLe: l.first_seen_at, prixInitial: nombreOuNull(l.price_at_first_seen), baisseLe: l.price_reduced_at, mandatLe: null,
  }
}

/** Le prix d'un bien en clair : CHF à apostrophe, « /mois » pour une location ; `null` pour un prix sur demande. */
export function prixEnClair(b: Pick<BienWa, 'prix' | 'location'>): string | null {
  return b.prix != null && b.prix > 0 ? `${fmtCHF(b.prix)}${b.location ? '/mois' : ''}` : null
}

// ── Où en est un acheteur ───────────────────────────────────────────────────

/** L'état d'un match, pour le copilote. Les dates et les prix sont déjà écrits : le modèle n'a rien à convertir. */
export type EtatAcheteur =
  | { code: 'reporte'; jusqua: string | null }
  | { code: 'a_proposer' }
  | { code: 'revenu'; refuse_a: string }
  | { code: 'propose'; le: string | null }
  | { code: 'interesse' }
  | { code: 'visite' }
  | { code: 'refuse'; motif: MotifRefus | null }

/**
 * Où en est un match, à l'heure de la lecture — la règle de `etatCompatible` (filQuiPour.ts), confrontée.
 * ⚠ Le report ne vaut que pour un match À PROPOSER (`versCompatible`) : `snoozed_until` s'écrit sans regarder le statut.
 */
export function etatMatch(
  m: Pick<LigneMatch, 'status' | 'snoozed_until' | 'sent_at' | 'reaction_motif' | 'prix_propose'>,
  maintenant: number,
): EtatAcheteur {
  if (m.status === 'suggested' && m.snoozed_until && temps(m.snoozed_until) > maintenant) {
    return { code: 'reporte', jusqua: dateSuisse(m.snoozed_until) }
  }
  const prixPropose = nombreOuNull(m.prix_propose)
  if (m.status === 'suggested') {
    // Un bien refusé pour le prix et revenu par une baisse garde son motif et son prix de proposition (lot B).
    return m.reaction_motif === 'prix' && prixPropose != null ? { code: 'revenu', refuse_a: fmtCHF(prixPropose) } : { code: 'a_proposer' }
  }
  if (m.status === 'sent') return { code: 'propose', le: dateSuisse(m.sent_at) }
  if (m.status === 'interested') return { code: 'interesse' }
  if (m.status === 'visit_planned') return { code: 'visite' }
  return { code: 'refuse', motif: estMotif(m.reaction_motif) ? m.reaction_motif : null }
}

// ── Un bien désigné par un message ──────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MOTS_VIDES = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'au', 'aux', 'en', 'et', 'ou', 'pour', 'sur', 'avec', 'chez',
  'the', 'an', 'of', 'in', 'at', 'on', 'for', 'with', 'to', 'bien', 'biens', 'property', 'properties',
])

/** Les mots qui désignent un bien dans un message : sans accents, sans mots vides, deux signes au moins. */
export function motsDe(texte: string): string[] {
  return slugify(texte).split('-').filter((m) => m.length >= 2 && !MOTS_VIDES.has(m))
}

/** Ce qu'un message peut dire d'un bien. */
export interface Designable { id: string; titre: string; adresse: string | null; ville: string | null }

/**
 * Les biens qu'un texte désigne. Un identifiant désigne son bien seul ; sinon TOUS les mots du texte doivent se
 * retrouver dans le titre, l'adresse ou la ville — entiers, ou en début de mot à partir de quatre lettres (« attiq »
 * pour « attique »). Aucun mot utile : aucun bien. Le copilote ne choisit jamais entre plusieurs (conception §3).
 */
export function candidats<T extends Designable>(biens: readonly T[], texte: string): T[] {
  const t = texte.trim()
  if (UUID.test(t)) return biens.filter((b) => b.id.toLowerCase() === t.toLowerCase())
  const mots = motsDe(t)
  if (mots.length === 0) return []
  return biens.filter((b) => {
    const siens = slugify([b.titre, b.adresse, b.ville].filter(Boolean).join(' ')).split('-').filter(Boolean)
    return mots.every((m) => siens.some((s) => s === m || (m.length >= 4 && s.startsWith(m))))
  })
}

// ── Le score expliqué ───────────────────────────────────────────────────────

/** Les critères d'une recherche (`client_searches.criteria`), tels que le moteur les lit. */
export interface Criteres {
  type?: string
  budget_min?: number
  budget_max?: number
  zones?: unknown
  rooms_min?: number
  rooms_max?: number
  surface_min?: number
  features?: unknown
  bedrooms_min?: number
  condition_min?: string
  off_market_only?: boolean
}

export type CleCritere = 'budget' | 'zone' | 'type' | 'pieces' | 'chambres' | 'surface' | 'etat' | 'equipements' | 'offMarket'
/** Un critère de la recherche face au bien : `tenu` nul quand rien ne permet de trancher. */
export interface CritereExplique { critere: CleCritere; tenu: boolean | null; ecart: string | null; voulu: string; bien: string | null }

type AxeMoteur = 'budget' | 'zone' | 'type' | 'rooms' | 'features'
/** Détails que le moteur écrit pour un axe INACTIF (aucun critère de son côté) : pas un verdict. */
const INACTIF = new Set(['—', 'Aucun critère'])
/** L'état MINIMUM qu'une recherche peut poser : « à rénover » n'en est pas un (règle du moteur). */
const MINIMUMS: ReadonlySet<string> = new Set(['good', 'renovated', 'new'])
const estEtat = (v: unknown): v is EtatBien => typeof v === 'string' && (ETATS_BIEN as readonly string[]).includes(v)

function bornes(min: number | null | undefined, max: number | null | undefined, f: (n: number) => string): string {
  if (min != null && max != null) return `${f(min)} – ${f(max)}`
  if (max != null) return `≤ ${f(max)}`
  return `≥ ${f(min as number)}`
}

/**
 * Le score expliqué, critère par critère — la règle de `lignesCriteres` (filModele.ts), confrontée par
 * whatsapp-matching-fil.spec.ts : le verdict du MOTEUR (`matches.reasons`) pour le budget, la zone, le type et les
 * équipements ; un FAIT comparé à ses bornes pour les pièces, les chambres, la surface, l'état (`etatDuBien`, la
 * règle du moteur) et l'off-market.
 * ⛔ Sans raison du moteur, ou sur un axe qu'il n'a pas évalué, AUCUN verdict : un « tenu » sans preuve serait une
 * invention. Et l'écart ne s'écrit que là où le `detail` du moteur DÉCRIT un écart (budget, zone, équipements).
 */
export function expliquer(criteres: Criteres | null, raisons: unknown, bien: BienWa, maintenant: number): CritereExplique[] {
  const c = criteres
  if (!c) return []
  const r = (raisons && typeof raisons === 'object' ? raisons : {}) as Partial<Record<AxeMoteur, { match?: unknown; detail?: unknown }>>
  const verdict = (axe: AxeMoteur, decritEcart: boolean): { tenu: boolean | null; ecart: string | null } => {
    const x = r[axe]
    const detail = typeof x?.detail === 'string' ? x.detail.trim() : ''
    if (!x || typeof x.match !== 'boolean' || (!x.match && INACTIF.has(detail))) return { tenu: null, ecart: null }
    return { tenu: x.match, ecart: decritEcart && !x.match && detail ? detail : null }
  }
  const out: CritereExplique[] = []
  if (c.budget_min != null || c.budget_max != null) {
    out.push({ critere: 'budget', ...verdict('budget', true), voulu: bornes(c.budget_min, c.budget_max, fmtCHF), bien: prixEnClair(bien) })
  }
  const zones = chaines(c.zones)
  if (zones.length > 0) {
    out.push({ critere: 'zone', ...verdict('zone', true), voulu: zones.join(', '), bien: [bien.ville, bien.canton].filter(Boolean).join(', ') || null })
  }
  if (c.type) out.push({ critere: 'type', ...verdict('type', false), voulu: c.type, bien: bien.type })
  // ⛔ Pièces et surface : un FAIT, pas la note du moteur, qui les a fusionnées en un axe (règle du fil).
  if (c.rooms_min != null || c.rooms_max != null) {
    const p = bien.pieces
    out.push({
      critere: 'pieces', ecart: null, voulu: bornes(c.rooms_min, c.rooms_max, String), bien: p == null ? null : String(p),
      tenu: p == null ? null : (c.rooms_min == null || p >= c.rooms_min) && (c.rooms_max == null || p <= c.rooms_max),
    })
  }
  // Lot C : 0 chambre n'est pas une valeur, et un critère que le bien ne renseigne pas n'a pas de verdict.
  if (typeof c.bedrooms_min === 'number' && c.bedrooms_min > 0) {
    const n = bien.chambres != null && bien.chambres > 0 ? bien.chambres : null
    out.push({ critere: 'chambres', ecart: null, voulu: `≥ ${c.bedrooms_min}`, bien: n == null ? null : String(n), tenu: n == null ? null : n >= c.bedrooms_min })
  }
  if (c.surface_min != null) {
    const s = bien.surface
    out.push({ critere: 'surface', ecart: null, voulu: `≥ ${c.surface_min} m²`, bien: s == null ? null : `${s} m²`, tenu: s == null ? null : s >= c.surface_min })
  }
  if (estEtat(c.condition_min) && MINIMUMS.has(c.condition_min)) {
    const voulu = c.condition_min
    const e = etatDuBien(bien.brutEtat, new Date(maintenant).getUTCFullYear())
    out.push({
      critere: 'etat', ecart: null, voulu, bien: e?.etat ?? null,
      tenu: e == null ? null : ETATS_BIEN.indexOf(e.etat) >= ETATS_BIEN.indexOf(voulu),
    })
  }
  // Un équipement dont le slug est vide n'existe pas pour le moteur : il n'existe pas ici.
  const voulus = chaines(c.features).filter((v) => slugify(v) !== '')
  if (voulus.length > 0) {
    const offerts = bien.equipements.map(slugify).filter(Boolean)
    const presents = voulus.filter((v) => {
      const w = slugify(v)
      return offerts.some((h) => h === w || h.includes(w) || w.includes(h))
    })
    out.push({ critere: 'equipements', ...verdict('features', true), voulu: voulus.join(', '), bien: presents.length ? presents.join(', ') : null })
  }
  // Off-market : toujours évalué — un mandat porte son interrupteur, une annonce du marché est publique.
  if (c.off_market_only === true) {
    out.push({ critere: 'offMarket', ecart: null, voulu: 'off-market', bien: bien.offMarket ? 'off-market' : 'publié', tenu: bien.offMarket })
  }
  return out
}

// ── Pourquoi maintenant ─────────────────────────────────────────────────────

/** Le signal d'un match : la baisse depuis la proposition ou le refus (lot B), sinon celui de son bien (lot C). */
export type Signal =
  | { genre: 'baisse_depuis_proposition'; montant: number }
  | { genre: 'baisse_depuis_refus'; montant: number }
  | { genre: 'baisse'; montant: number; le: string }
  | { genre: 'nouveau'; le: string }
  | { genre: 'nouveau_mandat'; le: string }

/** Une date des `jours` derniers jours ; une date future est une saisie fautive, pas un signal. */
function recente(iso: string | null, jours: number, maintenant: number): iso is string {
  const t = temps(iso)
  return t > 0 && t <= maintenant && maintenant - t <= jours * JOUR
}

/**
 * Le signal « pourquoi maintenant » d'un match — `signalPrix` (filBoucle.ts) d'abord, parce qu'il parle de CET
 * acheteur, puis `signalBien` (filSignaux.ts). ⛔ Un prix nul (« prix sur demande ») n'est ni une baisse ni une hausse.
 */
export function signalMatch(
  m: Pick<LigneMatch, 'status' | 'reaction_motif' | 'prix_propose'>,
  bien: BienWa,
  maintenant: number,
): Signal | null {
  const prixPropose = nombreOuNull(m.prix_propose)
  if (prixPropose != null && bien.prix != null && bien.prix > 0) {
    const baisse = prixPropose - bien.prix
    if (baisse > 0 && m.status === 'suggested' && m.reaction_motif === 'prix') return { genre: 'baisse_depuis_refus', montant: baisse }
    if (baisse > 0 && m.status === 'sent') return { genre: 'baisse_depuis_proposition', montant: baisse }
  }
  if (bien.genre === 'annonce') {
    const { prix, prixInitial } = bien
    if (prix != null && prix > 0 && prixInitial != null && prixInitial > prix && recente(bien.baisseLe, JOURS_BAISSE, maintenant)) {
      return { genre: 'baisse', montant: prixInitial - prix, le: bien.baisseLe }
    }
    return recente(bien.vuLe, JOURS_NOUVEAU, maintenant) ? { genre: 'nouveau', le: bien.vuLe } : null
  }
  return recente(bien.mandatLe, JOURS_MANDAT, maintenant) ? { genre: 'nouveau_mandat', le: bien.mandatLe } : null
}

/** Un signal en clair : montant en CHF, date à la suisse. */
export function signalEnClair(s: Signal | null): { genre: Signal['genre']; montant?: string; le?: string } | null {
  if (!s) return null
  return {
    genre: s.genre,
    ...('montant' in s ? { montant: fmtCHF(s.montant) } : {}),
    ...('le' in s ? { le: dateSuisse(s.le) ?? undefined } : {}),
  }
}

// ── Les réponses des outils ─────────────────────────────────────────────────

/** Un bien en clair, pour le modèle : ce qu'il peut en dire, et l'identifiant dont les autres outils ont besoin. */
export function bienEnClair(b: BienWa): { id: string; genre: BienWa['genre']; titre: string; ville: string | null; prix: string | null; retire?: true } {
  return { id: b.id, genre: b.genre, titre: b.titre, ville: b.ville, prix: prixEnClair(b), ...(b.retire ? { retire: true as const } : {}) }
}

/** Un match et ce qu'on sait de lui : son bien, et les critères de la recherche qui l'a produit. */
export interface EntreeMatch { match: LigneMatch; bien: BienWa; criteres: Criteres | null }

export const MAX_BIENS = 8
const RANG_EN_COURS: Readonly<Record<string, number>> = { interesse: 0, visite: 1, propose: 2 }

/**
 * La réponse de `get_matches` : les biens EN COURS d'abord — intéressé, visite, puis proposé, le plus récent d'abord —,
 * puis les meilleurs À PROPOSER, revenus compris, à score égal ceux qui portent un signal (la règle du fil). Huit au
 * plus. Un match reporté n'y est pas tant que son report court ; les refusés et écartés ne sont pas lus.
 * `aProposerALaLimite` : la lecture des matchs à proposer a atteint sa limite, leur total réel est inconnu (« N+ »).
 */
export function vueGetMatches(entrees: readonly EntreeMatch[], maintenant: number, aProposerALaLimite: boolean) {
  const vus = entrees.map((e) => ({
    e, etat: etatMatch(e.match, maintenant), signal: signalMatch(e.match, e.bien, maintenant), score: nombreOuNull(e.match.score) ?? 0,
  }))
  const enCours = vus.filter((v) => v.etat.code in RANG_EN_COURS).sort((a, b) =>
    RANG_EN_COURS[a.etat.code] - RANG_EN_COURS[b.etat.code]
    || temps(b.e.match.sent_at) - temps(a.e.match.sent_at)
    || a.e.match.id.localeCompare(b.e.match.id))
  const aProposer = vus.filter((v) => v.etat.code === 'a_proposer' || v.etat.code === 'revenu').sort((a, b) =>
    b.score - a.score || Number(b.signal != null) - Number(a.signal != null) || a.e.match.id.localeCompare(b.e.match.id))
  return {
    total: {
      en_cours: enCours.length,
      a_proposer: aProposerALaLimite ? `${aProposer.length}+` : String(aProposer.length),
      reportes: vus.filter((v) => v.etat.code === 'reporte').length,
    },
    biens: [...enCours, ...aProposer].slice(0, MAX_BIENS).map((v) => ({
      ...bienEnClair(v.e.bien),
      etat: v.etat,
      score: v.score,
      criteres: expliquer(v.e.criteres, v.e.match.reasons, v.e.bien, maintenant),
      signal: signalEnClair(v.signal),
    })),
    note: 'Le score est une estimation du moteur de matching : présente-le comme tel.',
  }
}

export const MAX_ACHETEURS = 10

/** Un acheteur compatible, tel que la fiche le lit : son match, et son nom. */
export type LigneAcheteur = Pick<LigneMatch, 'id' | 'contact_id' | 'status' | 'score' | 'snoozed_until' | 'sent_at' | 'reaction_motif' | 'prix_propose'> & { nom: string }

/**
 * La réponse de `get_buyers_for_property` : les acquéreurs compatibles du bien, à la définition des fiches, par score
 * (l'id départage) — dix au plus, avec le total. Les anciens prospects restent sur la fiche d'un mandat actif : ils se
 * réactivent d'un geste dans le CRM.
 */
export function vueAcheteurs(bien: BienWa, lignes: readonly LigneAcheteur[], maintenant: number, totalALaLimite: boolean) {
  const tries = [...lignes].sort((a, b) => (nombreOuNull(b.score) ?? 0) - (nombreOuNull(a.score) ?? 0) || a.id.localeCompare(b.id))
  return {
    bien: bienEnClair(bien),
    total: totalALaLimite ? `${tries.length}+` : String(tries.length),
    acheteurs: tries.slice(0, MAX_ACHETEURS).map((l) => ({
      contact_id: l.contact_id, nom: l.nom, score: nombreOuNull(l.score) ?? 0, etat: etatMatch(l, maintenant),
    })),
    ...(bien.genre === 'mandat' && !bien.retire
      ? { anciens_prospects: 'Sur la fiche du mandat, dans le CRM (« Qui pour ce bien ? ») : ils se réactivent de là.' }
      : {}),
  }
}

/** Les candidats d'un texte ambigu, cinq au plus : le copilote demande lequel. */
export const vueCandidats = (biens: readonly BienWa[]) => biens.slice(0, 5).map(bienEnClair)

/** Ce que `wa_matching_visite` rend. */
export interface VisitePlanifiee {
  ok: boolean
  raison?: 'contact' | 'bien'
  genre?: 'mandat' | 'annonce'
  titre?: string
  visite_id?: string | null
  evenement_id?: string | null
  match_id?: string | null
  statut_match?: string | null
  match_avant?: string | null
  deal_id?: string | null
  etape_avant?: string | null
}

/** Ce que « /annuler » défera : la visite ou l'événement, le match s'il a bougé, l'étape du deal s'il a avancé. */
export function retourDeVisite(r: VisitePlanifiee): Record<string, unknown> {
  return {
    visite_id: r.visite_id ?? null,
    evenement_id: r.evenement_id ?? null,
    match_id: r.match_avant ? r.match_id ?? null : null,
    deal_id: r.etape_avant ? r.deal_id ?? null : null,
    etape_avant: r.etape_avant ?? null,
  }
}
```

- [ ] **Étape 5 : Vérifier**

```bash
npx vitest run supabase/functions/_shared/whatsapp-matching.test.ts supabase/functions/_shared/morning-brief.test.ts
```

Attendu : PASS.

```bash
deno check --no-lock supabase/functions/_shared/whatsapp-matching.ts
```

Attendu : Sortie 0.

---

## Tâche 5 : Les copies confrontées au fil

Recopiées, les règles dérivent en silence : le copilote dirait « intéressé » où la fiche dit « revenu », « budget tenu » où le fil montre un écart. Une spec confronte chaque copie à l'original, sur les mêmes fixtures, et les quatre originaux disent qu'ils ont une copie (conception §3, « une règle, une source »).

**Fichiers :**
- Créer : `tests/unit/whatsapp-matching-fil.spec.ts`
- Modifier : `src/components/matching-fil/filQuiPour.ts`
- Modifier : `src/components/matching-fil/filBoucle.ts`
- Modifier : `src/components/matching-fil/filSignaux.ts`
- Modifier : `src/components/matching-fil/filModele.ts`

- [ ] **Étape 1 : Écrire la spec de confrontation**

Créer `tests/unit/whatsapp-matching-fil.spec.ts` :

```ts
/**
 * Les copies du copilote WhatsApp (lot D2), confrontées aux règles du fil.
 *
 * POURQUOI. `supabase/functions/_shared/whatsapp-matching.ts` tourne sous Deno et ne peut pas importer `src/` : il
 * RECOPIE cinq règles du CRM — les statuts « compatibles », les motifs de refus, les seuils des signaux, l'état d'un
 * acheteur et l'explication du score. Recopiées, elles dérivent en silence : le copilote dirait « intéressée » là où
 * la fiche dit « revenu », ou « budget tenu » là où le fil montre un écart. Cette spec rougit au premier écart.
 * Conception : docs/superpowers/specs/2026-09-24-matching-lot-d2-whatsapp-design.md, §3 (« une règle, une source »).
 */
import { describe, it, expect } from 'vitest'
import type { SearchCriteria } from '@/types/contact'
import { STATUTS_COMPATIBLES as COMPATIBLES_FIL, etatCompatible, versCompatible, type LigneCompatible } from '@/components/matching-fil/filQuiPour'
import { MOTIFS_REFUS as MOTIFS_FIL, signalPrix } from '@/components/matching-fil/filBoucle'
import { JOURS_BAISSE as BAISSE_FIL, JOURS_MANDAT as MANDAT_FIL, JOURS_NOUVEAU as NOUVEAU_FIL, signalBien } from '@/components/matching-fil/filSignaux'
import { lignesCriteres, type FilBien, type FilMatch, type RaisonsMoteur } from '@/components/matching-fil/filModele'
import * as wa from '../../supabase/functions/_shared/whatsapp-matching'

const MAINTENANT = Date.parse('2026-09-24T08:00:00Z')
const ilYA = (jours: number) => new Date(MAINTENANT - jours * 86_400_000).toISOString()
const dans = (jours: number) => new Date(MAINTENANT + jours * 86_400_000).toISOString()

describe('les listes et les seuils recopiés', () => {
  it('statuts compatibles, motifs de refus, seuils des signaux : ceux du fil', () => {
    expect([...wa.STATUTS_COMPATIBLES]).toEqual([...COMPATIBLES_FIL])
    expect([...wa.MOTIFS_REFUS]).toEqual([...MOTIFS_FIL])
    expect([wa.JOURS_NOUVEAU, wa.JOURS_BAISSE, wa.JOURS_MANDAT]).toEqual([NOUVEAU_FIL, BAISSE_FIL, MANDAT_FIL])
  })
})

describe('l’état d’un acheteur : celui des fiches (`etatCompatible`)', () => {
  const VERS_FIL: Record<string, string> = {
    reporte: 'reporte', aProposer: 'a_proposer', revenu: 'revenu', propose: 'propose', proposeSansDate: 'propose',
    interesse: 'interesse', visite: 'visite', refuse: 'refuse', refuseSansMotif: 'refuse',
  }
  const ligne = (o: Partial<LigneCompatible>): LigneCompatible => ({
    id: 'm', contact_id: 'c', score: 80, status: 'suggested', snoozed_until: null, sent_at: null, response_at: null,
    reaction_motif: null, reaction_note: null, prix_propose: null, ...o,
  })
  const CAS: LigneCompatible[] = [
    ligne({}),
    ligne({ snoozed_until: dans(2) }),
    ligne({ snoozed_until: ilYA(2) }),
    ligne({ reaction_motif: 'prix', prix_propose: 1_700_000 }),
    ligne({ reaction_motif: 'quartier', prix_propose: 1_700_000 }),
    ligne({ status: 'sent', sent_at: ilYA(3) }),
    ligne({ status: 'sent', sent_at: null, snoozed_until: dans(4) }),
    ligne({ status: 'interested' }),
    ligne({ status: 'visit_planned' }),
    ligne({ status: 'rejected', reaction_motif: 'surface' }),
    ligne({ status: 'rejected', reaction_motif: 'recherche_ajustee' }),
  ]

  it.each(CAS.map((c, i) => [i, c] as const))('cas %i', (_i, c) => {
    const fil = etatCompatible(versCompatible(c, { first_name: 'A', last_name: 'B' })!, MAINTENANT)
    const copie = wa.etatMatch(c, MAINTENANT)
    expect(copie.code).toBe(VERS_FIL[fil.cle])
    if (fil.cle === 'refuse') expect(copie).toEqual({ code: 'refuse', motif: fil.motif.replace('fil.motifs.', '') })
  })
})

/** Un même bien, dans les deux formes : celle du fil (`versBienMarche` / `versBien`, useMatchingFil.ts) et celle du copilote. */
function deuxFormes(genre: 'annonce' | 'mandat', o: Partial<wa.LigneAnnonce & wa.LigneMandat> = {}): { fil: FilBien; copie: wa.BienWa } {
  const brut = {
    id: 'b1', title: 'Bien', type: 'apartment', transaction_type: 'buy', price: 1_500_000, current_price: null, rooms: 4,
    surface_m2: 120, bedrooms: 3, address: 'Rue 1', city: 'Genève', canton: 'GE', features: ['Terrasse', 'Ascenseur'],
    condition: null, year_built: 2019, year_renovated: null, off_market: false, mandate_signed_at: null, published_at: ilYA(40),
    first_seen_at: ilYA(60), price_at_first_seen: 1_500_000, price_reduced_at: null, status: 'active', ...o,
  }
  const n = (v: unknown) => (v == null ? null : Number(v))
  const fil: FilBien = {
    id: brut.id, titre: brut.title ?? '', prix: n(brut.current_price) ?? n(brut.price), location: brut.transaction_type === 'rent',
    type: brut.type, pieces: n(brut.rooms), surface: n(brut.surface_m2), ville: brut.city, canton: brut.canton, adresse: brut.address,
    equipements: Array.isArray(brut.features) ? (brut.features as string[]) : Object.keys(brut.features ?? {}), photo: null,
    chambres: n(brut.bedrooms), anneeConstruction: n(brut.year_built),
    ...(genre === 'annonce'
      ? { marche: { ref: 'x', sourceUrl: null }, anneeRenovation: n(brut.year_renovated), offMarket: false, vuLe: brut.first_seen_at, prixInitial: n(brut.price_at_first_seen), baisseLe: brut.price_reduced_at }
      : { etatSaisi: brut.condition, offMarket: brut.off_market === true, mandatLe: brut.published_at }),
  }
  const copie = genre === 'annonce' ? wa.bienDAnnonce(brut as wa.LigneAnnonce) : wa.bienDeMandat(brut as wa.LigneMandat)
  return { fil, copie }
}

const filMatch = (bien: FilBien, criteres: SearchCriteria | null, raisons: RaisonsMoteur | null): FilMatch => ({
  id: 'm', score: 80, raisons, criteres, creeLe: null, reporteJusquau: null, bien,
  acheteur: { id: 'c', prenom: 'A', nom: 'B', telephone: null, email: null, kyc: 'none' },
})

describe('le score expliqué : celui du fil (`lignesCriteres`)', () => {
  const TOUT: SearchCriteria = {
    budget_max: 1_400_000, zones: ['Genève', 'GE'], type: 'apartment', rooms_min: 3, rooms_max: 4, bedrooms_min: 4,
    surface_min: 100, condition_min: 'new', features: ['terrasse', 'piscine'], off_market_only: true,
  }
  const RAISONS: RaisonsMoteur = {
    budget: { match: false, score: 20, detail: '7 % au-dessus du budget' },
    zone: { match: true, score: 100, detail: 'Genève' },
    type: { match: true, score: 100, detail: 'Appartement' },
    features: { match: false, score: 50, detail: '1 sur 2' },
  }
  const CAS: [string, 'annonce' | 'mandat', Partial<wa.LigneAnnonce & wa.LigneMandat>, SearchCriteria | null, RaisonsMoteur | null][] = [
    ['annonce, tous les critères', 'annonce', {}, TOUT, RAISONS],
    ['annonce, sans raison du moteur', 'annonce', {}, TOUT, null],
    // Aux bornes : pièces, surface et chambres ÉGALES aux minimums — une comparaison stricte y rougirait.
    ['annonce aux bornes', 'annonce', { rooms: 3, surface_m2: 100, bedrooms: 4 }, TOUT, RAISONS],
    ['annonce rénovée, surface et chambres inconnues', 'annonce', { year_built: 1970, year_renovated: 2020, surface_m2: null, bedrooms: 0 }, TOUT, RAISONS],
    ['mandat saisi rénové, off-market', 'mandat', { condition: 'renovated', off_market: true, features: { piscine: true } }, { ...TOUT, condition_min: 'good' }, { features: { match: false, score: 0, detail: '—' } }],
    ['location, budget minimum seul', 'annonce', { transaction_type: 'rent', price: 3_200 }, { budget_min: 2_500 }, { budget: { match: true, score: 100, detail: 'Dans le budget' } }],
    ['aucune recherche', 'annonce', {}, null, RAISONS],
  ]

  it.each(CAS)('%s', (_nom, genre, o, criteres, raisons) => {
    const { fil, copie } = deuxFormes(genre, o)
    const attendu = lignesCriteres(filMatch(fil, criteres, raisons), MAINTENANT).map((l) => [l.cle, l.ok, l.ecart])
    const obtenu = wa.expliquer(criteres as wa.Criteres | null, raisons, copie, MAINTENANT).map((l) => [l.critere, l.tenu, l.ecart])
    expect(obtenu).toEqual(attendu)
  })
})

describe('le signal : celui du fil (`signalPrix`, puis `signalBien`)', () => {
  const VERS_FIL = (m: FilMatch): string | null => {
    const p = signalPrix(m)
    if (p) return p.depuis === 'refus' ? 'baisse_depuis_refus' : 'baisse_depuis_proposition'
    const b = signalBien(m.bien, MAINTENANT)
    return b ? (b.genre === 'mandat' ? 'nouveau_mandat' : b.genre) : null
  }
  const CAS: [string, 'annonce' | 'mandat', Partial<wa.LigneAnnonce & wa.LigneMandat>, Partial<wa.LigneMatch>][] = [
    ['proposé, prix baissé depuis', 'annonce', { price: 1_400_000 }, { status: 'sent', prix_propose: 1_500_000 }],
    ['refusé pour le prix, revenu', 'annonce', { price: 1_400_000 }, { reaction_motif: 'prix', prix_propose: 1_550_000 }],
    ['annonce en baisse récente', 'annonce', { price: 1_400_000, price_at_first_seen: 1_600_000, price_reduced_at: ilYA(3) }, {}],
    ['annonce en baisse ancienne', 'annonce', { price: 1_400_000, price_at_first_seen: 1_600_000, price_reduced_at: ilYA(20) }, {}],
    ['annonce nouvelle', 'annonce', { first_seen_at: ilYA(2) }, {}],
    ['prix nul', 'annonce', { price: 0 }, { status: 'sent', prix_propose: 1_500_000 }],
    ['nouveau mandat', 'mandat', { published_at: ilYA(3) }, {}],
    ['mandat ancien', 'mandat', {}, {}],
  ]

  it.each(CAS)('%s', (_nom, genre, o, mo) => {
    const { fil, copie } = deuxFormes(genre, o)
    const ligne: wa.LigneMatch = {
      id: 'm', contact_id: 'c', status: 'suggested', score: 80, reasons: null, client_search_id: null, property_id: null,
      market_listing_id: null, snoozed_until: null, sent_at: null, response_at: null, reaction_motif: null, reaction_note: null,
      prix_propose: null, ...mo,
    }
    const prixPropose = ligne.prix_propose == null ? null : Number(ligne.prix_propose)
    const jamaisPropose = ligne.status === 'suggested' && prixPropose == null && ligne.reaction_motif == null
    const m: FilMatch = {
      ...filMatch(fil, null, null),
      suivi: jamaisPropose ? undefined : {
        statut: ligne.status as 'suggested', proposeLe: null, reponduLe: null, motif: ligne.reaction_motif, note: null, prixPropose, apprisLe: null,
      },
    }
    expect(wa.signalMatch(ligne, copie, MAINTENANT)?.genre ?? null).toBe(VERS_FIL(m))
  })
})
```

```bash
npx vitest run tests/unit/whatsapp-matching-fil.spec.ts
```

Attendu : PASS, 27 tests : les copies de la tâche 4 sont fidèles.

- [ ] **Étape 2 : Prouver qu'elle peut rougir**

Une garde qui ne rougit jamais ne garde rien. Dans `whatsapp-matching.ts`, passer `JOURS_NOUVEAU` à `4`, puis la condition des `pieces` à `p > c.rooms_min` : la spec doit ÉCHOUER à chaque fois (« les listes et les seuils recopiés », puis « annonce aux bornes »). Remettre les deux, et vérifier que la spec repasse (27 tests).

- [ ] **Étape 3 : Dire, dans les originaux, qu’ils ont une copie**

Dans `src/components/matching-fil/filQuiPour.ts` :

Dans `src/components/matching-fil/filQuiPour.ts`, remplacer :

```ts
 * ⚠ La base compte les mêmes, en dur, dans la migration du lot D1 (`…_matching_surfaces.sql`) :
 * `pige_acheteurs_compatibles` (« Ce qui a bougé ») et le CTE `mandats` de `matching_actions_du_jour`
 * (« Aujourd'hui »). Changer l'une sans les autres ferait dire deux comptes différents au même bien.
 */
```

par :

```ts
 * ⚠ La base compte les mêmes, en dur, dans la migration du lot D1 (`…_matching_surfaces.sql`) :
 * `pige_acheteurs_compatibles` (« Ce qui a bougé ») et le CTE `mandats` de `matching_actions_du_jour`
 * (« Aujourd'hui »). Changer l'une sans les autres ferait dire deux comptes différents au même bien.
 * ⚠ Le copilote WhatsApp (lot D2) la RECOPIE dans `supabase/functions/_shared/whatsapp-matching.ts`, avec
 * `etatCompatible` : `tests/unit/whatsapp-matching-fil.spec.ts` confronte les deux.
 */
```

Dans `src/components/matching-fil/filBoucle.ts` :

Dans `src/components/matching-fil/filBoucle.ts`, remplacer :

```ts
 * `recherche_ajustee` : un match écarté par la réévaluation d'une recherche, pas par l'acheteur.
 */
export const MOTIFS_REFUS
```

par :

```ts
 * `recherche_ajustee` : un match écarté par la réévaluation d'une recherche, pas par l'acheteur.
 * ⚠ Recopiés par le copilote WhatsApp (lot D2, `_shared/whatsapp-matching.ts`), avec `signalPrix` :
 * `tests/unit/whatsapp-matching-fil.spec.ts` confronte les deux.
 */
export const MOTIFS_REFUS
```

Dans `src/components/matching-fil/filSignaux.ts` :

Dans `src/components/matching-fil/filSignaux.ts`, remplacer :

```ts
 * compte les annonces nouvelles et en baisse de la ligne « Marché » avec les mêmes ; `matching-fil-signaux.spec.ts`
 * lit la migration pour les confronter.
 */
```

par :

```ts
 * compte les annonces nouvelles et en baisse de la ligne « Marché » avec les mêmes ; `matching-fil-signaux.spec.ts`
 * lit la migration pour les confronter.
 * ⚠ Le copilote WhatsApp (lot D2) les recopie, avec `signalBien` : `_shared/whatsapp-matching.ts`, confronté par
 * `tests/unit/whatsapp-matching-fil.spec.ts`.
 */
```

Dans `src/components/matching-fil/filModele.ts` :

Dans `src/components/matching-fil/filModele.ts`, remplacer :

```ts
/** Les lignes « Recherché / Ce bien » : une par critère que la recherche a posé (§4.4). */
```

par :

```ts
/**
 * Les lignes « Recherché / Ce bien » : une par critère que la recherche a posé (§4.4).
 * ⚠ Recopiée par le copilote WhatsApp (lot D2, `expliquer` dans `_shared/whatsapp-matching.ts`), confrontée par
 * `tests/unit/whatsapp-matching-fil.spec.ts`.
 */
```

- [ ] **Étape 4 : Vérifier**

```bash
npx vitest run tests/unit/whatsapp-matching-fil.spec.ts tests/unit/matching-fil-modele.spec.ts tests/unit/matching-fil-signaux.spec.ts
```

Attendu : PASS.

```bash
npx tsc -b && npx eslint tests/unit/whatsapp-matching-fil.spec.ts src/components/matching-fil --quiet
```

Attendu : Sortie 0.

---

## Tâche 6 : `get_matches` : les biens vivants, leur état, leur score expliqué

« Quels biens pour Julie ? » rendait les cinq meilleurs scores, tous statuts confondus : un bien refusé revenait, sans état ni explication. Il rend désormais ses biens VIVANTS — en cours d'abord, puis les meilleurs à proposer —, chacun avec son état, son score expliqué et son signal (conception §5.1 ; ajouté à la ligne 4b par Julien le 24.09.2026). Le copilote web partage l'outil : il gagne la même réponse.

**Fichiers :**
- Créer : `supabase/functions/_shared/whatsapp-matching-outils.ts`
- Créer : `supabase/functions/_shared/whatsapp-matching-outils.test.ts`
- Modifier : `vitest.config.ts`
- Modifier : `supabase/functions/_shared/whatsapp-tools.ts`
- Modifier : `supabase/functions/whatsapp-agent/index.ts`
- Modifier : `supabase/functions/ai-copilot/index.ts`
- Modifier : `supabase/functions/_shared/whatsapp-actions.ts`

- [ ] **Étape 1 : Inscrire le test dans Vitest**

Dans `vitest.config.ts`, remplacer :

```ts
'supabase/functions/_shared/message-sans-bien.test.ts', 'supabase/functions/_shared/whatsapp-matching.test.ts'],
```

par :

```ts
'supabase/functions/_shared/message-sans-bien.test.ts', 'supabase/functions/_shared/whatsapp-matching.test.ts', 'supabase/functions/_shared/whatsapp-matching-outils.test.ts'],
```

- [ ] **Étape 2 : Écrire le test qui échoue**

Le faux client APPLIQUE les filtres qu'on lui passe : un `.eq('agency_id', …)` oublié laisse passer la ligne d'une autre agence, et le test le voit.

Créer `supabase/functions/_shared/whatsapp-matching-outils.test.ts` :

```ts
/**
 * Les outils du matching du copilote WhatsApp (lot D2), éprouvés sans base ni réseau.
 *
 * POURQUOI CE BANC. Les exécuteurs lisent par le client service-role : la RLS est contournée, et le
 * `.eq('agency_id', …)` de chaque lecture est la seule garde de tenant. Le faux client ci-dessous APPLIQUE les filtres
 * qu'on lui passe à des lignes en mémoire — un filtre oublié laisse passer la ligne d'une autre agence, et le test le
 * voit. Les écritures passent par des fonctions de base (`rpc`) : on éprouve ce qu'on leur envoie, leur SQL est
 * éprouvé par `tests/backend/matching-whatsapp.spec.ts` (CI).
 */
import { describe, it, expect } from 'vitest'
import { execGetMatches } from './whatsapp-matching-outils'
import type { ActionCtx } from './whatsapp-actions'

const A = 'a0000000-0000-4000-8000-00000000000a'
const B = 'b0000000-0000-4000-8000-00000000000b'
const JULIE = 'c0000000-0000-4000-8000-000000000001'
const AUTRE = 'c0000000-0000-4000-8000-000000000002'
const ATTIQUE = 'd0000000-0000-4000-8000-000000000001'
const STUDIO = 'd0000000-0000-4000-8000-000000000002'
const VILLA = 'e0000000-0000-4000-8000-000000000001'

type Ligne = Record<string, unknown>
type Appel = { rpc: string; args: Record<string, unknown> }

/** Un faux client supabase-js : `.eq` / `.in` / `.is` / `.not(… is null)` filtrent, `.order` trie, `.limit` coupe. */
function fauxClient(tables: Record<string, Ligne[]>, rpc: Record<string, unknown> = {}) {
  const appels: Appel[] = []
  const inserts: { table: string; row: unknown }[] = []
  const from = (table: string) => {
    let lignes = [...(tables[table] ?? [])]
    const self: Record<string, unknown> = {}
    self.select = () => self
    self.eq = (c: string, v: unknown) => { lignes = lignes.filter((l) => l[c] === v); return self }
    self.in = (c: string, vs: unknown[]) => { lignes = lignes.filter((l) => vs.includes(l[c])); return self }
    self.is = (c: string, v: unknown) => { lignes = lignes.filter((l) => (l[c] ?? null) === v); return self }
    self.not = (c: string, op: string, v: unknown) => { if (op === 'is' && v === null) lignes = lignes.filter((l) => l[c] != null); return self }
    self.order = (c: string, o?: { ascending?: boolean }) => {
      const asc = o?.ascending !== false
      lignes.sort((x, y) => (x[c] === y[c] ? 0 : ((x[c] as never) > (y[c] as never) ? 1 : -1) * (asc ? 1 : -1)))
      return self
    }
    self.limit = (n: number) => { lignes = lignes.slice(0, n); return self }
    self.maybeSingle = async () => ({ data: lignes[0] ?? null, error: null })
    self.insert = (row: unknown) => { inserts.push({ table, row }); return { error: null } }
    // `touchHotContact` (le « contact chaud » de l'agent) : sans effet ici.
    self.upsert = () => Promise.resolve({ error: null })
    self.then = (resolve: (r: unknown) => void) => resolve({ data: lignes, error: null })
    return self
  }
  const client = {
    from,
    rpc: async (nom: string, args: Record<string, unknown>) => { appels.push({ rpc: nom, args }); return { data: rpc[nom] ?? null, error: null } },
  }
  return { client, appels, inserts }
}

const ctx = (client: unknown, lang: 'fr' | 'en' = 'fr'): ActionCtx => ({ supabase: client as never, profileId: 'p-agent', agencyId: A, lang })

const contacts: Ligne[] = [
  { id: JULIE, agency_id: A, first_name: 'Julie', last_name: 'Martin' },
  { id: AUTRE, agency_id: B, first_name: 'Hors', last_name: 'Agence' },
]
const annonces: Ligne[] = [
  { id: ATTIQUE, title: 'Attique 4 p.', address: 'Route de Florissant 12', city: 'Genève', price: 1_500_000, transaction_type: 'buy', status: 'active' },
  { id: STUDIO, title: 'Studio', address: 'Rue du Lac 2', city: 'Genève', price: 450_000, transaction_type: 'buy', status: 'active' },
]
const mandats: Ligne[] = [
  { id: VILLA, agency_id: A, deleted_at: null, title: 'Villa contemporaine', address: 'Chemin des Hauts 3', city: 'Cologny', price: 4_200_000, transaction_type: 'buy', status: 'active', off_market: false },
]
const m = (o: Ligne): Ligne => ({
  agency_id: A, contact_id: JULIE, status: 'suggested', score: 80, reasons: null, client_search_id: null, property_id: null,
  market_listing_id: null, snoozed_until: null, sent_at: null, response_at: null, reaction_motif: null, reaction_note: null,
  prix_propose: null, ...o,
})

describe('execGetMatches — les biens vivants d’un acheteur de l’agence', () => {
  it('rend les biens en cours puis à proposer, jamais un refusé ; la lecture est filtrée par agence', async () => {
    const { client } = fauxClient({
      contacts, market_listings: annonces, properties: mandats, client_searches: [],
      matches: [
        m({ id: 'm1', status: 'sent', sent_at: '2026-09-20T10:00:00Z', market_listing_id: ATTIQUE }),
        m({ id: 'm2', status: 'rejected', market_listing_id: STUDIO }),
        m({ id: 'm3', property_id: VILLA, score: 91 }),
        m({ id: 'm4', agency_id: B, market_listing_id: STUDIO }),
      ],
    })
    const r = JSON.parse(await execGetMatches(ctx(client), { contact_id: JULIE }))
    expect(r.contact).toBe('Julie Martin')
    expect(r.biens.map((b: { id: string; etat: { code: string } }) => [b.id, b.etat.code])).toEqual([[ATTIQUE, 'propose'], [VILLA, 'a_proposer']])
  })

  it('refuse un contact d’une autre agence, et un nom passé en guise d’identifiant', async () => {
    const { client } = fauxClient({ contacts, matches: [] })
    expect(await execGetMatches(ctx(client), { contact_id: AUTRE })).toMatch(/introuvable/)
    expect(await execGetMatches(ctx(client), { contact_id: 'Julie Martin' })).toMatch(/introuvable/)
  })
})
```

```bash
npx vitest run supabase/functions/_shared/whatsapp-matching-outils.test.ts
```

Attendu : ÉCHEC : `./whatsapp-matching-outils` introuvable.

- [ ] **Étape 3 : Écrire l'exécuteur**

Les sections suivantes (tâches 7 à 9) s'ajouteront à la fin de ce fichier.

Créer `supabase/functions/_shared/whatsapp-matching-outils.ts` :

```ts
// Les outils du matching dans le copilote WhatsApp (lot D2, étape 4b) : leurs lectures et leurs écritures, par le
// client service-role de l'agent. Toute la logique vit dans `whatsapp-matching.ts` (pur, testé) ; ici, les requêtes.
//
// Conception : docs/superpowers/specs/2026-09-24-matching-lot-d2-whatsapp-design.md (§5).
//
// SÉCURITÉ. Le client contourne la RLS : chaque lecture porte `.eq('agency_id', …)`, et chaque écriture passe par une
// fonction de base qui revérifie l'agence et signe MEGGA AI (`wa_matching_consigner`, `wa_matching_visite`,
// migration `…_matching_whatsapp.sql`). ⛔ Aucune n'écrit à l'acheteur (`tests/unit/matching-sans-sortie.spec.ts`).

import type { ActionCtx } from './whatsapp-actions.ts'
import { touchHotContact } from './contact-memory.ts'
import {
  COLONNES_MATCH, COLONNES_MANDAT, COLONNES_ANNONCE, STATUTS_EN_COURS, bienDeMandat, bienDAnnonce, vueGetMatches,
  type BienWa, type Criteres, type EntreeMatch, type LigneAnnonce, type LigneMandat, type LigneMatch,
} from './whatsapp-matching.ts'

type Args = Record<string, unknown>
const s = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SANS_AGENCE = 'Erreur: ton compte n’est rattaché à aucune agence. Contacte un administrateur.'
const LECTURE_IMPOSSIBLE = 'Erreur: lecture du CRM momentanément impossible, réessaie dans un instant.'
const aUneAgence = (ctx: ActionCtx): boolean => typeof ctx.agencyId === 'string' && ctx.agencyId.length > 0

/** Un contact de l'agence (garde SQL), ou `null`. Pose le « contact chaud » de l'agent, comme `contactInAgency`. */
async function contactDeLAgence(ctx: ActionCtx, id: string): Promise<{ id: string; nom: string } | null> {
  // Un nom passé en guise d'identifiant ne désigne aucune fiche ; Postgres le rejetterait en 22P02.
  if (!UUID.test(id)) return null
  const { data } = await ctx.supabase
    .from('contacts').select('id, first_name, last_name').eq('id', id).eq('agency_id', ctx.agencyId).maybeSingle()
  if (!data) return null
  const c = data as { id: string; first_name: string | null; last_name: string | null }
  touchHotContact(ctx.supabase, ctx.profileId, ctx.agencyId, c.id)
  return { id: c.id, nom: `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'ce contact' }
}

const idBien = (m: Pick<LigneMatch, 'property_id' | 'market_listing_id'>): string => m.property_id ?? m.market_listing_id ?? ''

/**
 * Les biens de ces matchs : les mandats de l'agence — un mandat supprimé n'a pas de ligne, sa ligne de match tombe —
 * et les annonces du marché. `null` : une lecture a échoué.
 */
async function lireBiens(ctx: ActionCtx, lignes: readonly Pick<LigneMatch, 'property_id' | 'market_listing_id'>[]): Promise<Map<string, BienWa> | null> {
  const mandats = [...new Set(lignes.map((l) => l.property_id).filter((x): x is string => !!x))]
  const annonces = [...new Set(lignes.map((l) => l.market_listing_id).filter((x): x is string => !!x))]
  const [m, a] = await Promise.all([
    mandats.length
      ? ctx.supabase.from('properties').select(COLONNES_MANDAT).in('id', mandats).eq('agency_id', ctx.agencyId).is('deleted_at', null)
      : Promise.resolve({ data: [], error: null }),
    annonces.length
      ? ctx.supabase.from('market_listings').select(COLONNES_ANNONCE).in('id', annonces)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (m.error || a.error) return null
  const biens = new Map<string, BienWa>()
  for (const l of (m.data ?? []) as LigneMandat[]) biens.set(l.id, bienDeMandat(l))
  for (const l of (a.data ?? []) as LigneAnnonce[]) biens.set(l.id, bienDAnnonce(l))
  return biens
}

/** Les critères des recherches qui ont produit ces matchs — ceux de la RECHERCHE, jamais ceux de la fiche (règle du fil). */
async function lireCriteres(ctx: ActionCtx, lignes: readonly Pick<LigneMatch, 'client_search_id'>[]): Promise<Map<string, Criteres | null> | null> {
  const ids = [...new Set(lignes.map((l) => l.client_search_id).filter((x): x is string => !!x))]
  if (!ids.length) return new Map()
  const { data, error } = await ctx.supabase.from('client_searches').select('id, criteria').in('id', ids).eq('agency_id', ctx.agencyId)
  if (error) return null
  return new Map(((data ?? []) as { id: string; criteria: Criteres | null }[]).map((r) => [r.id, r.criteria]))
}

// ── get_matches ─────────────────────────────────────────────────────────────

/** Les limites des lectures : bornées, jamais « tout pour en garder huit » (CLAUDE.md §7). */
const LIMITE_EN_COURS = 30
const LIMITE_A_PROPOSER = 40

/**
 * « Quels biens pour Julie ? » — ses biens VIVANTS : en cours d'abord, puis les meilleurs à proposer, chacun avec son
 * état, son score expliqué et son signal (conception §5.1). Partagé avec le copilote web (`ai-copilot`).
 */
export async function execGetMatches(ctx: ActionCtx, a: Args): Promise<string> {
  if (!aUneAgence(ctx)) return SANS_AGENCE
  const contactId = s(a.contact_id)
  if (!contactId) return 'Erreur: contact_id requis (via search_contacts).'
  const contact = await contactDeLAgence(ctx, contactId)
  if (!contact) return 'Erreur: contact introuvable dans votre agence.'
  const base = () => ctx.supabase.from('matches').select(COLONNES_MATCH).eq('agency_id', ctx.agencyId).eq('contact_id', contactId)
  const [enCours, aProposer] = await Promise.all([
    base().in('status', [...STATUTS_EN_COURS]).order('sent_at', { ascending: false, nullsFirst: false }).order('id').limit(LIMITE_EN_COURS),
    base().eq('status', 'suggested').order('score', { ascending: false }).order('id').limit(LIMITE_A_PROPOSER),
  ])
  if (enCours.error || aProposer.error) return LECTURE_IMPOSSIBLE
  const lignes = [...(enCours.data ?? []), ...(aProposer.data ?? [])] as LigneMatch[]
  if (!lignes.length) {
    return JSON.stringify({ contact: contact.nom, biens: [], note: 'Aucun bien vivant pour ce contact : sa recherche n’a peut-être pas encore tourné.' })
  }
  const [biens, criteres] = await Promise.all([lireBiens(ctx, lignes), lireCriteres(ctx, lignes)])
  if (!biens || !criteres) return LECTURE_IMPOSSIBLE
  const entrees: EntreeMatch[] = lignes.flatMap((m) => {
    const bien = biens.get(idBien(m))
    return bien ? [{ match: m, bien, criteres: m.client_search_id ? criteres.get(m.client_search_id) ?? null : null }] : []
  })
  const aLaLimite = (aProposer.data?.length ?? 0) >= LIMITE_A_PROPOSER
  return JSON.stringify({ contact: contact.nom, ...vueGetMatches(entrees, Date.now(), aLaLimite) })
}
```

- [ ] **Étape 4 : Brancher l'outil**

Dans `supabase/functions/_shared/whatsapp-tools.ts`, la description de `get_matches` :

Dans `supabase/functions/_shared/whatsapp-tools.ts`, remplacer :

```ts
      description: "Biens correspondant à un contact (moteur de matching). Pour « quels biens pour Sarah ? ». contact_id via search_contacts.",
```

par :

```ts
      description: "Biens VIVANTS d'un acheteur (moteur de matching) : en cours d'abord (intéressé, visite, proposé), puis les meilleurs à proposer ; pour chacun son état, son score — une ESTIMATION, à présenter comme telle — expliqué critère par critère, et son signal (nouveau, prix baissé). Refusés et écartés exclus. Pour « quels biens pour Sarah ? ». contact_id via search_contacts. L'id de chaque bien sert à schedule_visit (property_id d'un mandat, market_listing_id d'une annonce) et à get_buyers_for_property. N'envoie jamais un bien au client.",
```

Dans `supabase/functions/whatsapp-agent/index.ts`, l'import des exécuteurs, puis le nouvel import (le `case 'get_matches'` de `runTool` ne change pas : il appelle désormais celui-ci) :

Dans `supabase/functions/whatsapp-agent/index.ts`, remplacer :

```ts
  execGetContactBrief, execListFollowups, execGetMatches, execGetDailyBrief,
```

par :

```ts
  execGetContactBrief, execListFollowups, execGetDailyBrief,
```

Dans `supabase/functions/whatsapp-agent/index.ts`, remplacer :

```ts
  type ActionCtx,
} from '../_shared/whatsapp-actions.ts'
```

par :

```ts
  type ActionCtx,
} from '../_shared/whatsapp-actions.ts'
import { execGetMatches } from '../_shared/whatsapp-matching-outils.ts'
```

Dans `supabase/functions/ai-copilot/index.ts`, de même :

Dans `supabase/functions/ai-copilot/index.ts`, remplacer :

```ts
  execGetMatches, execGetDailyBrief, execSearchListings, execGetKycStatus,
```

par :

```ts
  execGetDailyBrief, execSearchListings, execGetKycStatus,
```

Dans `supabase/functions/ai-copilot/index.ts`, remplacer :

```ts
} from '../_shared/whatsapp-actions.ts'
import { fetchHotContactBlock, distillCrmTurn } from '../_shared/contact-memory.ts'
```

par :

```ts
} from '../_shared/whatsapp-actions.ts'
// `get_matches` (lot D2) : les biens vivants, leur état et leur score expliqué — partagé avec le copilote WhatsApp.
import { execGetMatches } from '../_shared/whatsapp-matching-outils.ts'
import { fetchHotContactBlock, distillCrmTurn } from '../_shared/contact-memory.ts'
```

- [ ] **Étape 5 : Retirer l'ancien exécuteur**

Dans `supabase/functions/_shared/whatsapp-actions.ts`, supprimer `execGetMatches` (plus aucun appelant) :

Supprimer, dans `supabase/functions/_shared/whatsapp-actions.ts` :

```ts
/** Biens correspondant à un contact (moteur de matching). */
export async function execGetMatches(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const contactId = s(a.contact_id)
  if (!contactId) return 'Erreur: contact_id requis.'
  const { data, error } = await ctx.supabase
    .from('matches').select('score, status, market_listing_id, property_id')
    .eq('contact_id', contactId).eq('agency_id', ctx.agencyId)
    .order('score', { ascending: false }).limit(5)
  if (error) return `Erreur: ${error.message}`
  if (!data?.length) return 'Aucun bien correspondant (recherche peut-être pas encore lancée).'
  // Enrichi (titre/montant/ville/pièces réels) : l'id reste l'UUID du bien (clé pour schedule_visit),
  // mais il n'est plus SEUL — accompagné des vraies données, le modèle n'a plus à inventer un bien.
  // Un bien non résolu ne porte que id/score/statut (jamais de titre/ville inventés).
  const biens = await resolveMatchListings(ctx, data as MatchListingInput[])
  return JSON.stringify({ biens })
}
```

…et les trois commentaires qui le citaient :

Dans `supabase/functions/_shared/whatsapp-actions.ts`, remplacer :

```ts
// prioritaire sur market_listing. Partagé par execGetMatches ET execPrepareMeeting.
```

par :

```ts
// prioritaire sur market_listing. Sert execPrepareMeeting ; `get_matches` a son propre exécuteur depuis le
// lot D2 (`whatsapp-matching-outils.ts`), qui lit aussi l'état et l'explication de chaque bien.
```

Dans `supabase/functions/_shared/whatsapp-actions.ts`, remplacer :

```ts
// actives + timeline + compréhension), execGetMatches (biens) et execGetDailyBrief (table visits),
```

par :

```ts
// actives + timeline + compréhension), l'ancien execGetMatches (biens) et execGetDailyBrief (table visits),
```

Dans `supabase/functions/_shared/whatsapp-actions.ts`, remplacer :

```ts
  // 3. Biens correspondants (matches top 5) — mêmes requête/scope que execGetMatches, enrichis
```

par :

```ts
  // 3. Biens correspondants (matches top 5) — la requête de l'ancien execGetMatches (avant le lot D2), enrichis
```

- [ ] **Étape 6 : Vérifier**

```bash
npx vitest run supabase/functions/_shared/whatsapp-matching-outils.test.ts supabase/functions/_shared/whatsapp-actions.test.ts supabase/functions/_shared/copilot-tools.test.ts
```

Attendu : PASS.

```bash
deno check --no-lock supabase/functions/whatsapp-agent/index.ts supabase/functions/ai-copilot/index.ts
```

Attendu : Sortie 0.

---

## Tâche 7 : `get_buyers_for_property` : qui pour ce bien

Le matching inversé du copilote : les acquéreurs compatibles d'un bien, à la définition des fiches, dix au plus avec le total. Le bien se désigne par un texte ; plusieurs candidats, l'outil les rend sans choisir (conception §5.2). Les anciens prospects restent sur la fiche : ils se réactivent d'un geste dans le CRM.

**Fichiers :**
- Modifier : `supabase/functions/_shared/whatsapp-matching-outils.ts`
- Modifier : `supabase/functions/_shared/whatsapp-matching-outils.test.ts`
- Modifier : `supabase/functions/_shared/whatsapp-tools.ts`
- Modifier : `supabase/functions/_shared/whatsapp-agent-router.ts`
- Modifier : `supabase/functions/whatsapp-agent/index.ts`

- [ ] **Étape 1 : Écrire le test qui échoue**

Dans le test, l'import :

Dans `supabase/functions/_shared/whatsapp-matching-outils.test.ts`, remplacer :

```ts
import { execGetMatches } from './whatsapp-matching-outils'
```

par :

```ts
import { execGetMatches, execGetBuyersForProperty } from './whatsapp-matching-outils'
```

…et, à la fin du fichier :

Ajouter à la fin de `supabase/functions/_shared/whatsapp-matching-outils.test.ts` :

```ts
describe('execGetBuyersForProperty — qui pour ce bien', () => {
  const tables = {
    contacts, market_listings: annonces, properties: mandats,
    matches: [
      m({ id: 'b1', property_id: VILLA, score: 88 }),
      m({ id: 'b2', property_id: VILLA, status: 'rejected' }),
      m({ id: 'b3', market_listing_id: ATTIQUE, status: 'sent' }),
    ],
  }

  it('un mandat désigné par son nom : ses compatibles, sans les refus', async () => {
    const { client } = fauxClient(tables)
    const r = JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: 'la villa de Cologny' }))
    expect(r.bien).toMatchObject({ id: VILLA, genre: 'mandat' })
    expect(r.total).toBe('1')
    expect(r.acheteurs).toEqual([{ contact_id: JULIE, nom: 'Julie Martin', score: 88, etat: { code: 'a_proposer' } }])
  })

  it('sinon, une annonce suivie par l’agence ; plusieurs candidats : aucun choix', async () => {
    const { client } = fauxClient(tables)
    const r = JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: 'attique Florissant' }))
    expect(r.bien).toMatchObject({ id: ATTIQUE, genre: 'annonce' })
    const { client: c2 } = fauxClient({ ...tables, matches: [...tables.matches, m({ id: 'b4', market_listing_id: STUDIO })] })
    const ambigu = JSON.parse(await execGetBuyersForProperty(ctx(c2), { bien: 'Genève' }))
    expect(ambigu.candidats).toHaveLength(2)
    expect(ambigu.acheteurs).toBeUndefined()
  })
})
```

```bash
npx vitest run supabase/functions/_shared/whatsapp-matching-outils.test.ts
```

Attendu : ÉCHEC : `execGetBuyersForProperty` n'est pas exporté.

- [ ] **Étape 2 : Écrire l'exécuteur**

Dans `whatsapp-matching-outils.ts`, le bloc d'import :

Dans `supabase/functions/_shared/whatsapp-matching-outils.ts`, remplacer :

```ts
import type { ActionCtx } from './whatsapp-actions.ts'
import { touchHotContact } from './contact-memory.ts'
import {
  COLONNES_MATCH, COLONNES_MANDAT, COLONNES_ANNONCE, STATUTS_EN_COURS, bienDeMandat, bienDAnnonce, vueGetMatches,
  type BienWa, type Criteres, type EntreeMatch, type LigneAnnonce, type LigneMandat, type LigneMatch,
} from './whatsapp-matching.ts'
```

par :

```ts
import type { ActionCtx } from './whatsapp-actions.ts'
import { touchHotContact } from './contact-memory.ts'
import {
  COLONNES_MATCH, COLONNES_MANDAT, COLONNES_ANNONCE, STATUTS_COMPATIBLES, STATUTS_EN_COURS, bienDeMandat, bienDAnnonce,
  candidats, vueAcheteurs, vueCandidats, vueGetMatches,
  type BienWa, type Criteres, type EntreeMatch, type LigneAcheteur, type LigneAnnonce, type LigneMandat, type LigneMatch,
} from './whatsapp-matching.ts'
```

…et, à la fin du fichier :

Ajouter à la fin de `supabase/functions/_shared/whatsapp-matching-outils.ts` :

```ts
// ── get_buyers_for_property ─────────────────────────────────────────────────

const LIMITE_COMPATIBLES = 200
const LIMITE_MANDATS = 500
const LIMITE_MATCHS_MARCHE = 1000

const decouper = <T>(xs: readonly T[], n: number): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))

/**
 * Le bien qu'un texte — ou un identifiant — désigne : un mandat de l'agence d'abord, sinon une annonce du marché où
 * l'agence a un match compatible. Les candidats se lisent bornés, puis se filtrent par `candidats` (pur). `null` : une
 * lecture a échoué.
 */
async function designerBien(ctx: ActionCtx, texte: string): Promise<BienWa[] | null> {
  if (UUID.test(texte)) {
    const [m, a] = await Promise.all([
      ctx.supabase.from('properties').select(COLONNES_MANDAT).eq('id', texte).eq('agency_id', ctx.agencyId).is('deleted_at', null).maybeSingle(),
      ctx.supabase.from('market_listings').select(COLONNES_ANNONCE).eq('id', texte).maybeSingle(),
    ])
    if (m.error || a.error) return null
    if (m.data) return [bienDeMandat(m.data as LigneMandat)]
    return a.data ? [bienDAnnonce(a.data as LigneAnnonce)] : []
  }
  const { data: mandats, error } = await ctx.supabase
    .from('properties').select(COLONNES_MANDAT).eq('agency_id', ctx.agencyId).is('deleted_at', null).limit(LIMITE_MANDATS)
  if (error) return null
  const parmiMandats = candidats(((mandats ?? []) as LigneMandat[]).map(bienDeMandat), texte)
  if (parmiMandats.length) return parmiMandats
  const { data: matchs, error: mErr } = await ctx.supabase
    .from('matches').select('market_listing_id').eq('agency_id', ctx.agencyId).in('status', [...STATUTS_COMPATIBLES])
    .not('market_listing_id', 'is', null).limit(LIMITE_MATCHS_MARCHE)
  if (mErr) return null
  const ids = [...new Set(((matchs ?? []) as { market_listing_id: string }[]).map((m) => m.market_listing_id))]
  if (!ids.length) return []
  // Par lots de cent identifiants : une URL de requête a une longueur.
  const lots = await Promise.all(decouper(ids, 100).map((lot) =>
    ctx.supabase.from('market_listings').select('id, title, address, city').in('id', lot)))
  if (lots.some((r) => r.error)) return null
  const designables = lots.flatMap((r) => (r.data ?? []) as { id: string; title: string | null; address: string | null; city: string | null }[])
    .map((l) => ({ id: l.id, titre: l.title?.trim() || l.address?.trim() || l.city?.trim() || 'Annonce', adresse: l.address, ville: l.city }))
  const trouves = candidats(designables, texte).slice(0, 5)
  if (!trouves.length) return []
  const { data: annonces, error: aErr } = await ctx.supabase
    .from('market_listings').select(COLONNES_ANNONCE).in('id', trouves.map((t) => t.id))
  if (aErr) return null
  return ((annonces ?? []) as LigneAnnonce[]).map(bienDAnnonce)
}

/** « Qui pour la villa de Cologny ? » — les acquéreurs compatibles d'un bien (conception §5.2). */
export async function execGetBuyersForProperty(ctx: ActionCtx, a: Args): Promise<string> {
  if (!aUneAgence(ctx)) return SANS_AGENCE
  const texte = s(a.bien)
  if (!texte) return 'Erreur: quel bien ? Son nom, son adresse ou sa ville — ou son identifiant, via get_matches.'
  const trouves = await designerBien(ctx, texte)
  if (trouves === null) return LECTURE_IMPOSSIBLE
  if (trouves.length === 0) {
    return JSON.stringify({ introuvable: true, note: `Aucun mandat de l’agence ni aucune annonce suivie ne correspond à « ${texte} ».` })
  }
  if (trouves.length > 1) {
    return JSON.stringify({ candidats: vueCandidats(trouves), question: 'Plusieurs biens correspondent : demande à l’agent lequel, sans choisir.' })
  }
  const bien = trouves[0]
  const { data, error } = await ctx.supabase
    .from('matches').select('id, contact_id, status, score, snoozed_until, sent_at, reaction_motif, prix_propose')
    .eq('agency_id', ctx.agencyId).eq(bien.genre === 'mandat' ? 'property_id' : 'market_listing_id', bien.id)
    .in('status', [...STATUTS_COMPATIBLES]).order('score', { ascending: false }).order('id').limit(LIMITE_COMPATIBLES)
  if (error) return LECTURE_IMPOSSIBLE
  const lignes = (data ?? []) as Omit<LigneAcheteur, 'nom'>[]
  // Les noms des dix premiers seulement : les autres ne sont que comptés.
  const tete = [...new Set(lignes.slice(0, 10).map((l) => l.contact_id))]
  const { data: contacts, error: cErr } = tete.length
    ? await ctx.supabase.from('contacts').select('id, first_name, last_name').in('id', tete).eq('agency_id', ctx.agencyId)
    : { data: [], error: null }
  if (cErr) return LECTURE_IMPOSSIBLE
  const noms = new Map(((contacts ?? []) as { id: string; first_name: string | null; last_name: string | null }[])
    .map((c) => [c.id, `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || '—']))
  const acheteurs: LigneAcheteur[] = lignes.map((l) => ({ ...l, nom: noms.get(l.contact_id) ?? '—' }))
  return JSON.stringify(vueAcheteurs(bien, acheteurs, Date.now(), lignes.length >= LIMITE_COMPATIBLES))
}
```

- [ ] **Étape 3 : Brancher l'outil**

Dans `whatsapp-tools.ts`, avant l'entrée de `get_daily_brief` :

Dans `supabase/functions/_shared/whatsapp-tools.ts`, remplacer :

```ts
  {
    type: 'function',
    function: {
      name: 'get_daily_brief',
```

par :

```ts
  {
    type: 'function',
    function: {
      name: 'get_buyers_for_property',
      description: "Matching INVERSÉ : les acheteurs compatibles d'un bien — un mandat de l'agence ou une annonce du marché suivie —, par score, avec l'état de chacun (à proposer, proposé, intéressé, visite). Pour « qui pour la villa de Cologny ? », « quels acheteurs pour ce bien ? ». Le bien : son nom, son adresse ou sa ville, ou son id (via get_matches). Si plusieurs biens correspondent, l'outil les liste : demande à l'agent lequel. Lecture seule, n'écrit à personne.",
      parameters: {
        type: 'object',
        properties: { bien: { type: 'string', description: 'Le bien : un nom, une adresse, une ville, ou son id.' } },
        required: ['bien'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_daily_brief',
```

Dans `whatsapp-agent-router.ts`, le niveau :

Dans `supabase/functions/_shared/whatsapp-agent-router.ts`, remplacer :

```ts
  get_matches: 'read',
```

par :

```ts
  get_matches: 'read',
  // get_buyers_for_property : lecture seule (lot D2) — le matching inversé d'un bien, rendu à l'agent seul.
  get_buyers_for_property: 'read',
```

Dans `whatsapp-agent/index.ts`, l'import et `runTool` :

Dans `supabase/functions/whatsapp-agent/index.ts`, remplacer :

```ts
import { execGetMatches } from '../_shared/whatsapp-matching-outils.ts'
```

par :

```ts
import { execGetMatches, execGetBuyersForProperty } from '../_shared/whatsapp-matching-outils.ts'
```

Dans `supabase/functions/whatsapp-agent/index.ts`, remplacer :

```ts
    case 'get_matches': return execGetMatches(ctx, args)
```

par :

```ts
    case 'get_matches': return execGetMatches(ctx, args)
    case 'get_buyers_for_property': return execGetBuyersForProperty(ctx, args)
```

- [ ] **Étape 4 : Vérifier**

```bash
npx vitest run supabase/functions/_shared/whatsapp-matching-outils.test.ts supabase/functions/_shared/whatsapp-agent-router.test.ts
```

Attendu : PASS.

```bash
deno check --no-lock supabase/functions/whatsapp-agent/index.ts
```

Attendu : Sortie 0.

---

## Tâche 8 : `record_match_outcome` : consigner une réponse, après le « oui » de l'agent

« Julie refuse Florissant, trop cher » : le copilote cherche le bien parmi les matchs de Julie au statut que la réponse suppose, montre ce qu'il écrira et pose [Oui] [Non] (décision de Julien, 24.09.2026) ; sur « oui », `wa_matching_consigner` écrit d'un bloc. Aucun bien, ou plusieurs : un refus qui les nomme, rendu au modèle — aucune question, aucun bouton. Quatre réponses : proposé, intéressé, pas intéressé + motif, pas encore (conception §5.3).

**Fichiers :**
- Modifier : `supabase/functions/_shared/whatsapp-i18n.ts`
- Modifier : `supabase/functions/_shared/whatsapp-matching-outils.ts`
- Modifier : `supabase/functions/_shared/whatsapp-matching-outils.test.ts`
- Modifier : `supabase/functions/_shared/whatsapp-tools.ts`
- Modifier : `supabase/functions/_shared/whatsapp-agent-router.ts`
- Modifier : `supabase/functions/_shared/whatsapp-agent-router.test.ts`
- Modifier : `supabase/functions/whatsapp-agent/index.ts`
- Modifier : `supabase/functions/whatsapp-webhook/index.ts`

- [ ] **Étape 1 : Écrire les phrases verbatim**

La question et le compte rendu partent TELS QUELS à l'agent (sans DeepSeek) : ils vivent dans `whatsapp-i18n.ts`, en français et en anglais. À la fin du fichier :

Ajouter à la fin de `supabase/functions/_shared/whatsapp-i18n.ts` :

```ts

// ── Matching (lot D2) : `record_match_outcome` ──────────────────────────────
// Rendus VERBATIM à l'agent : la question [Oui] [Non], puis le compte rendu de l'exécuteur. « pour Julie », jamais
// « de Julie » : une interpolation ne sait pas élider (« d'Emma »). ⚠ Les comptes rendus commencent par « ✅ Consigné »
// / « ✅ Recorded » : la garde des confirmations simulées (whatsapp-phantom-action.ts) sait que SEUL l'exécuteur les écrit.

/** Les motifs d'un refus, en toutes lettres — ceux du fil (`fil.motifs.*` de matching.json). */
const MOTIFS: Record<WaLang, Record<string, string>> = {
  fr: { prix: 'prix', quartier: 'quartier', surface: 'surface', pieces: 'pièces', type: 'type de bien', equipements: 'équipements', etat: 'état du bien', autre: 'autre' },
  en: { prix: 'price', quartier: 'neighbourhood', surface: 'floor area', pieces: 'rooms', type: 'property type', equipements: 'features', etat: 'condition', autre: 'other' },
}
export function motifLabel(lang: WaLang, motif: string | null | undefined): string {
  return (motif && MOTIFS[lang][motif]) || (lang === 'en' ? 'other' : 'autre')
}

/** Ce qui sera consigné : l'acheteur, le bien retrouvé, la réponse. */
export interface Consignation {
  reponse: 'propose' | 'interesse' | 'pas_interesse' | 'pas_encore'
  nom: string
  bien: string
  motif?: string | null
  note?: string | null
}

/** La question [Oui] [Non] : ce qui s'écrira, bien retrouvé compris — c'est là qu'un bien mal retrouvé se voit. */
export function confirmConsigner(lang: WaLang, c: Consignation): string {
  const note = c.note ? ` (« ${c.note} »)` : ''
  if (lang === 'en') {
    switch (c.reponse) {
      case 'propose': return `I'll record that you proposed « ${c.bien} » to ${c.nom}, with a follow-up in 3 days. Confirm? ("yes" / "no")`
      case 'interesse': return `I'll record for ${c.nom}: « ${c.bien} » — interested. Confirm? ("yes" / "no")`
      case 'pas_interesse': return `I'll record for ${c.nom}: « ${c.bien} » — not interested, reason: ${motifLabel('en', c.motif)}${note}. Confirm? ("yes" / "no")`
      case 'pas_encore': return `I'll record that ${c.nom} hasn't answered yet about « ${c.bien} »: the follow-up moves 3 days later. Confirm? ("yes" / "no")`
    }
  }
  switch (c.reponse) {
    case 'propose': return `Je note que tu as proposé « ${c.bien} » à ${c.nom}, avec une relance dans 3 jours. Tu confirmes ? (« oui » / « non »)`
    case 'interesse': return `Je consigne pour ${c.nom} : « ${c.bien} » — intéressé·e. Tu confirmes ? (« oui » / « non »)`
    case 'pas_interesse': return `Je consigne pour ${c.nom} : « ${c.bien} » — pas intéressé·e, motif ${motifLabel('fr', c.motif)}${note}. Tu confirmes ? (« oui » / « non »)`
    case 'pas_encore': return `Je note que ${c.nom} n'a pas encore répondu pour « ${c.bien} » : la relance est repoussée de 3 jours. Tu confirmes ? (« oui » / « non »)`
  }
}

/** Le compte rendu, après le « oui » : ce qui A été écrit. */
export function consigne(lang: WaLang, c: Consignation): string {
  if (lang === 'en') {
    switch (c.reponse) {
      case 'propose': return `✅ Recorded: « ${c.bien} » proposed to ${c.nom}, follow-up in 3 days.`
      case 'interesse': return `✅ Recorded for ${c.nom}: « ${c.bien} » — interested.`
      case 'pas_interesse': return `✅ Recorded for ${c.nom}: « ${c.bien} » — not interested (${motifLabel('en', c.motif)}).`
      case 'pas_encore': return `✅ Recorded: ${c.nom} hasn't answered about « ${c.bien} » yet — follow-up in 3 days.`
    }
  }
  switch (c.reponse) {
    case 'propose': return `✅ Consigné : « ${c.bien} » proposé à ${c.nom}, relance dans 3 jours.`
    case 'interesse': return `✅ Consigné pour ${c.nom} : « ${c.bien} » — intéressé·e.`
    case 'pas_interesse': return `✅ Consigné pour ${c.nom} : « ${c.bien} » — pas intéressé·e (${motifLabel('fr', c.motif)}).`
    case 'pas_encore': return `✅ Consigné : ${c.nom} n'a pas encore répondu pour « ${c.bien} » — relance dans 3 jours.`
  }
}

/** Un collègue a consigné entre le « oui » et l'écriture : rien n'est réécrit. */
export function consignationDeja(lang: WaLang, nom: string, bien: string): string {
  return lang === 'en'
    ? `Nothing was written: ${nom}'s answer about « ${bien} » was already recorded in the meantime.`
    : `Rien n'a été écrit : la réponse pour ${nom} sur « ${bien} » a déjà été consignée entre-temps.`
}

/** Le match n'est plus dans l'agence (supprimé, ou jamais le sien). */
export function consignationImpossible(lang: WaLang): string {
  return lang === 'en'
    ? 'Nothing was written: this property is no longer in your agency’s loop.'
    : "Rien n'a été écrit : ce bien n'est plus dans la boucle de ton agence."
}

/** L'écriture a échoué : rien n'est écrit, l'agent peut réessayer. */
export function consignationEchec(lang: WaLang): string {
  return lang === 'en'
    ? 'Recording failed — nothing was written. Try again in a moment.'
    : "La consignation a échoué — rien n'a été écrit. Réessaie dans un instant."
}

/** Un refus sans motif ne se consigne pas : le motif nourrit « Apprendre ». */
export function consignerMotifManquant(lang: WaLang): string {
  return lang === 'en'
    ? 'To record "not interested", I need the reason: price, neighbourhood, floor area, rooms, property type, features, condition or other.'
    : 'Pour « pas intéressé », il me faut le motif : prix, quartier, surface, pièces, type de bien, équipements, état du bien ou autre.'
}

/** Ce que la réponse suppose du bien, pour dire où on l'a cherché. */
function ouCherche(lang: WaLang, reponse: Consignation['reponse']): string {
  if (lang === 'en') return reponse === 'propose' ? 'to propose' : reponse === 'pas_interesse' ? 'proposed or interested' : 'proposed and awaiting an answer'
  return reponse === 'propose' ? 'à proposer' : reponse === 'pas_interesse' ? 'proposé ou intéressé' : 'proposé en attente de réponse'
}

/** Aucun bien ne répond au texte : le copilote nomme ceux qu'il a regardés, sans rien écrire. */
export function consignerAucunBien(lang: WaLang, reponse: Consignation['reponse'], nom: string, titres: readonly string[]): string {
  const liste = titres.slice(0, 5).map((t) => `« ${t} »`).join(', ')
  if (lang === 'en') {
    return titres.length
      ? `No property ${ouCherche('en', reponse)} for ${nom} matches. Those I found: ${liste}. Which one?`
      : `${nom} has no property ${ouCherche('en', reponse)}.`
  }
  return titres.length
    ? `Aucun bien ${ouCherche('fr', reponse)} pour ${nom} ne correspond. Ceux que je vois : ${liste}. Lequel ?`
    : `${nom} n'a aucun bien ${ouCherche('fr', reponse)}.`
}

/** Plusieurs biens répondent au texte : le copilote ne choisit pas. */
export function consignerPlusieursBiens(lang: WaLang, nom: string, titres: readonly string[]): string {
  const liste = titres.slice(0, 5).map((t) => `« ${t} »`).join(', ')
  return lang === 'en'
    ? `Several properties for ${nom} match: ${liste}. Which one?`
    : `Plusieurs biens pour ${nom} correspondent : ${liste}. Lequel ?`
}
```

- [ ] **Étape 2 : Écrire le test qui échoue**

Dans `supabase/functions/_shared/whatsapp-matching-outils.test.ts`, remplacer :

```ts
import { execGetMatches, execGetBuyersForProperty } from './whatsapp-matching-outils'
```

par :

```ts
import {
  execGetMatches, execGetBuyersForProperty, prepareRecordMatchOutcome, executeRecordMatchOutcome,
} from './whatsapp-matching-outils'
```

Ajouter à la fin de `supabase/functions/_shared/whatsapp-matching-outils.test.ts` :

```ts
describe('prepareRecordMatchOutcome — la question Oui / Non, ou un refus qui nomme les biens', () => {
  const tables = {
    contacts, market_listings: annonces, properties: mandats,
    matches: [
      m({ id: 'r1', status: 'sent', market_listing_id: ATTIQUE }),
      m({ id: 'r2', status: 'sent', market_listing_id: STUDIO }),
    ],
  }

  it('un seul bien répond : la question dit tout ce qui s’écrira, la charge porte le match', async () => {
    const { client } = fauxClient(tables)
    const p = await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: 'attique', reponse: 'pas_interesse', motif: 'prix', note: 'trop cher' })
    expect(p).toEqual({
      ok: true,
      prompt: 'Je consigne pour Julie Martin : « Attique 4 p. » — pas intéressé·e, motif prix (« trop cher »). Tu confirmes ? (« oui » / « non »)',
      payload: { match_id: 'r1', reponse: 'pas_interesse', motif: 'prix', note: 'trop cher', nom: 'Julie Martin', bien: 'Attique 4 p.' },
    })
  })

  it('plusieurs biens, aucun bien, pas de motif : un refus, jamais une question', async () => {
    const { client } = fauxClient(tables)
    expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, reponse: 'interesse' }))
      .toEqual({ ok: false, error: 'Plusieurs biens pour Julie Martin correspondent : « Attique 4 p. », « Studio ». Lequel ?' })
    expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: 'villa', reponse: 'interesse' }))
      .toEqual({ ok: false, error: 'Aucun bien proposé en attente de réponse pour Julie Martin ne correspond. Ceux que je vois : « Attique 4 p. », « Studio ». Lequel ?' })
    const sansMotif = await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: 'attique', reponse: 'pas_interesse' })
    expect(sansMotif.ok).toBe(false)
  })

  it('un acheteur d’une autre agence n’est pas consigné', async () => {
    const { client } = fauxClient(tables)
    const p = await prepareRecordMatchOutcome(ctx(client), { contact_id: AUTRE, bien: 'attique', reponse: 'interesse' })
    expect(p.ok).toBe(false)
  })
})

describe('executeRecordMatchOutcome — l’écriture d’un bloc, par la base', () => {
  const payload = { match_id: 'r1', reponse: 'interesse', motif: null, note: null, nom: 'Julie Martin', bien: 'Attique 4 p.' }

  it('envoie l’agence et l’agent de la session, puis rend le compte rendu', async () => {
    const { client, appels } = fauxClient({}, { wa_matching_consigner: { ok: true, deja: false } })
    expect(await executeRecordMatchOutcome(ctx(client), payload)).toBe('✅ Consigné pour Julie Martin : « Attique 4 p. » — intéressé·e.')
    expect(appels).toEqual([{ rpc: 'wa_matching_consigner', args: { p_agency: A, p_profile: 'p-agent', p_match: 'r1', p_reponse: 'interesse', p_motif: null, p_note: null } }])
  })

  it('« déjà consigné » et « hors agence » ne se font pas passer pour une écriture', async () => {
    const deja = fauxClient({}, { wa_matching_consigner: { ok: true, deja: true } })
    expect(await executeRecordMatchOutcome(ctx(deja.client), payload)).toMatch(/^Rien n'a été écrit/)
    const hors = fauxClient({}, { wa_matching_consigner: { ok: false } })
    expect(await executeRecordMatchOutcome(ctx(hors.client), payload)).toMatch(/^Rien n'a été écrit/)
  })
})
```

```bash
npx vitest run supabase/functions/_shared/whatsapp-matching-outils.test.ts
```

Attendu : ÉCHEC : `prepareRecordMatchOutcome` n'est pas exporté.

- [ ] **Étape 3 : Écrire la préparation et l’exécution**

Dans `supabase/functions/_shared/whatsapp-matching-outils.ts`, remplacer :

```ts
import type { ActionCtx } from './whatsapp-actions.ts'
import { touchHotContact } from './contact-memory.ts'
import {
  COLONNES_MATCH, COLONNES_MANDAT, COLONNES_ANNONCE, STATUTS_COMPATIBLES, STATUTS_EN_COURS, bienDeMandat, bienDAnnonce,
  candidats, vueAcheteurs, vueCandidats, vueGetMatches,
  type BienWa, type Criteres, type EntreeMatch, type LigneAcheteur, type LigneAnnonce, type LigneMandat, type LigneMatch,
} from './whatsapp-matching.ts'
```

par :

```ts
import type { ActionCtx, Prepared } from './whatsapp-actions.ts'
import { touchHotContact } from './contact-memory.ts'
import {
  confirmConsigner, consigne, consignationDeja, consignationImpossible, consignationEchec, consignerMotifManquant,
  consignerAucunBien, consignerPlusieursBiens, type Consignation,
} from './whatsapp-i18n.ts'
import {
  COLONNES_MATCH, COLONNES_MANDAT, COLONNES_ANNONCE, STATUTS_COMPATIBLES, STATUTS_EN_COURS, STATUTS_DE_DEPART, bienDeMandat,
  bienDAnnonce, candidats, estMotif, estReponse, vueAcheteurs, vueCandidats, vueGetMatches,
  type BienWa, type Criteres, type EntreeMatch, type LigneAcheteur, type LigneAnnonce, type LigneMandat, type LigneMatch,
} from './whatsapp-matching.ts'
```

Ajouter à la fin de `supabase/functions/_shared/whatsapp-matching-outils.ts` :

```ts
// ── record_match_outcome (question Oui / Non) ───────────────────────────────

/** Les matchs d'un acheteur au statut de départ d'une réponse : parmi eux se cherche le bien nommé. */
const LIMITE_DEPART = 100

/**
 * Prépare la consignation : l'acheteur de l'agence, puis le bien, cherché parmi SES matchs au statut que la réponse
 * suppose (`STATUTS_DE_DEPART`). Aucun, ou plusieurs : un refus qui les nomme, rendu au modèle — il demande, rien
 * n'est stocké, donc aucun bouton. Un seul : la question [Oui] [Non] et la charge figée.
 */
export async function prepareRecordMatchOutcome(ctx: ActionCtx, a: Args): Promise<Prepared> {
  if (!aUneAgence(ctx)) return { ok: false, error: SANS_AGENCE }
  const lang = ctx.lang ?? 'fr'
  const reponse = estReponse(a.reponse) ? a.reponse : null
  if (!reponse) return { ok: false, error: lang === 'en' ? 'Which answer? propose, interesse, pas_interesse or pas_encore.' : 'Quelle réponse ? propose, interesse, pas_interesse ou pas_encore.' }
  const motif = reponse === 'pas_interesse' ? (estMotif(a.motif) ? a.motif : null) : null
  if (reponse === 'pas_interesse' && !motif) return { ok: false, error: consignerMotifManquant(lang) }
  const contactId = s(a.contact_id)
  const contact = contactId ? await contactDeLAgence(ctx, contactId) : null
  if (!contact) return { ok: false, error: lang === 'en' ? 'Which buyer? Find them first with search_contacts.' : 'Quel acheteur ? Retrouve-le d’abord avec search_contacts.' }
  const { data, error } = await ctx.supabase
    .from('matches').select(COLONNES_MATCH).eq('agency_id', ctx.agencyId).eq('contact_id', contact.id)
    .in('status', [...STATUTS_DE_DEPART[reponse]]).order('score', { ascending: false }).order('id').limit(LIMITE_DEPART)
  if (error) return { ok: false, error: consignationEchec(lang) }
  const lignes = (data ?? []) as LigneMatch[]
  const biens = await lireBiens(ctx, lignes)
  if (!biens) return { ok: false, error: consignationEchec(lang) }
  const options = lignes.flatMap((m) => {
    const b = biens.get(idBien(m))
    return b ? [{ ...b, matchId: m.id }] : []
  })
  const texte = s(a.bien)
  // Sans texte, tous les biens au bon statut sont candidats : un seul se désigne de lui-même (« Julie est intéressée »
  // quand un seul bien l'attend) ; plusieurs, le copilote demande lequel.
  const trouves = texte ? candidats(options, texte) : options
  if (trouves.length > 1) return { ok: false, error: consignerPlusieursBiens(lang, contact.nom, trouves.map((b) => b.titre)) }
  if (trouves.length === 0) return { ok: false, error: consignerAucunBien(lang, reponse, contact.nom, options.map((b) => b.titre)) }
  const choisi = trouves[0]
  const note = reponse === 'pas_interesse' ? s(a.note)?.slice(0, 300) ?? null : null
  const c: Consignation = { reponse, nom: contact.nom, bien: choisi.titre, motif, note }
  return { ok: true, prompt: confirmConsigner(lang, c), payload: { match_id: choisi.matchId, reponse, motif, note, nom: contact.nom, bien: choisi.titre } }
}

/** Après le « oui » : écrit d'un bloc par `wa_matching_consigner`, qui revérifie le statut de départ. */
export async function executeRecordMatchOutcome(ctx: ActionCtx, p: Args): Promise<string> {
  if (!aUneAgence(ctx)) return SANS_AGENCE
  const lang = ctx.lang ?? 'fr'
  const matchId = s(p.match_id)
  const reponse = estReponse(p.reponse) ? p.reponse : null
  if (!matchId || !reponse) return consignationEchec(lang)
  const c: Consignation = { reponse, nom: s(p.nom) ?? '—', bien: s(p.bien) ?? '—', motif: s(p.motif), note: s(p.note) }
  const { data, error } = await ctx.supabase.rpc('wa_matching_consigner', {
    p_agency: ctx.agencyId, p_profile: ctx.profileId, p_match: matchId, p_reponse: reponse, p_motif: c.motif ?? null, p_note: c.note ?? null,
  })
  if (error) {
    console.error('wa_matching_consigner failed:', (error.message ?? 'error').slice(0, 120))
    return consignationEchec(lang)
  }
  const r = (data ?? {}) as { ok?: boolean; deja?: boolean }
  if (!r.ok) return consignationImpossible(lang)
  if (r.deja) return consignationDeja(lang, c.nom, c.bien)
  return consigne(lang, c)
}
```

- [ ] **Étape 4 : Déclarer l'outil, et son niveau « à confirmer »**

Dans `whatsapp-tools.ts`, avant l'entrée de `get_daily_brief` (donc après `get_buyers_for_property`) :

Dans `supabase/functions/_shared/whatsapp-tools.ts`, remplacer :

```ts
  {
    type: 'function',
    function: {
      name: 'get_daily_brief',
```

par :

```ts
  {
    type: 'function',
    function: {
      name: 'record_match_outcome',
      description: "Consigne la réponse d'un acheteur sur un bien, dite par l'agent : « J'ai proposé l'attique à Julie » (propose), « Julie est intéressée par l'attique » (interesse), « Julie refuse Florissant, trop cher » (pas_interesse + motif), « Julie n'a pas encore répondu » (pas_encore). N'écrit JAMAIS à l'acheteur : l'agent présente les biens par ses propres moyens. Appelle directement l'outil : le système montre ce qui sera écrit et demande lui-même la confirmation. contact_id via search_contacts ; le bien par son nom, son adresse ou sa ville, ou son id (get_matches).",
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string' },
          bien: { type: 'string', description: "Le bien : un nom, une adresse, une ville, ou son id. Peut rester vide si un seul bien attend la réponse de l'acheteur." },
          reponse: { type: 'string', enum: ['propose', 'interesse', 'pas_interesse', 'pas_encore'] },
          motif: { type: 'string', enum: ['prix', 'quartier', 'surface', 'pieces', 'type', 'equipements', 'etat', 'autre'], description: 'Obligatoire pour pas_interesse : « trop cher » = prix, « trop petit » = surface…' },
          note: { type: 'string', description: "Précision facultative d'un refus, dans les mots de l'agent." },
        },
        required: ['contact_id', 'reponse'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_daily_brief',
```

Dans `whatsapp-agent-router.ts` :

Dans `supabase/functions/_shared/whatsapp-agent-router.ts`, remplacer :

```ts
  record_offer: 'confirm',
```

par :

```ts
  record_offer: 'confirm',
  // record_match_outcome : consigne la réponse d'un acheteur (lot D2). Question [Oui] [Non] AVANT d'écrire
  // (décision de Julien, 24.09.2026) : une réponse déclenche une chaîne qu'une annulation ne remettrait pas en
  // l'état — journal, clôture de relance, deal et relance pour « proposé » —, et le bien est retrouvé d'après un texte.
  record_match_outcome: 'confirm',
```

La liste épinglée des outils à confirmer (`whatsapp-agent-router.test.ts`) :

Dans `supabase/functions/_shared/whatsapp-agent-router.test.ts`, remplacer :

```ts
      'delete_contact', 'invite_optin', 'open_kyc_case', 'publish_to_portals', 'record_offer',
```

par :

```ts
      'delete_contact', 'invite_optin', 'open_kyc_case', 'publish_to_portals', 'record_match_outcome', 'record_offer',
```

- [ ] **Étape 5 : Brancher la question et le « oui »**

Dans `whatsapp-agent/index.ts`, l'import, puis la préparation dans `stashPending` :

Dans `supabase/functions/whatsapp-agent/index.ts`, remplacer :

```ts
import { execGetMatches, execGetBuyersForProperty } from '../_shared/whatsapp-matching-outils.ts'
```

par :

```ts
import { execGetMatches, execGetBuyersForProperty, prepareRecordMatchOutcome } from '../_shared/whatsapp-matching-outils.ts'
```

Dans `supabase/functions/whatsapp-agent/index.ts`, remplacer :

```ts
  } else if (tool === 'update_pipeline') {
    const p = await prepareUpdatePipeline(ctx, args)
    if (!p.ok) return { status: 'error', error: p.error }
    prompt = p.prompt; storeArgs = p.payload
  }
```

par :

```ts
  } else if (tool === 'update_pipeline') {
    const p = await prepareUpdatePipeline(ctx, args)
    if (!p.ok) return { status: 'error', error: p.error }
    prompt = p.prompt; storeArgs = p.payload
  } else if (tool === 'record_match_outcome') {
    // Lot D2 : le bien se cherche parmi les matchs de l'acheteur ; aucun ou plusieurs, le refus les nomme au modèle.
    const p = await prepareRecordMatchOutcome(ctx, args)
    if (!p.ok) return { status: 'error', error: p.error }
    prompt = p.prompt; storeArgs = p.payload
  }
```

Dans `whatsapp-webhook/index.ts`, l'import, puis l'exécution dans `executePending` :

Dans `supabase/functions/whatsapp-webhook/index.ts`, remplacer :

```ts
import { bienDansMessage, refusBienDansMessage } from '../_shared/message-sans-bien.ts'
```

par :

```ts
import { bienDansMessage, refusBienDansMessage } from '../_shared/message-sans-bien.ts'
import { executeRecordMatchOutcome } from '../_shared/whatsapp-matching-outils.ts'
```

Dans `supabase/functions/whatsapp-webhook/index.ts`, remplacer :

```ts
  if (pending.tool === 'record_offer') {
```

par :

```ts
  if (pending.tool === 'record_match_outcome') {
    // Lot D2 : la réponse d'un acheteur, écrite d'un bloc par la base (`wa_matching_consigner`, signé MEGGA AI), qui
    // revérifie le statut de départ. N'écrit jamais au client.
    const ctx: ActionCtx = { supabase: admin, profileId: agentLink.profile_id, agencyId: agentLink.agency_id, lang }
    return executeRecordMatchOutcome(ctx, pending.args)
  }
  if (pending.tool === 'record_offer') {
```

- [ ] **Étape 6 : Vérifier**

```bash
npx vitest run supabase/functions/_shared/whatsapp-matching-outils.test.ts supabase/functions/_shared/whatsapp-agent-router.test.ts tests/unit/whatsapp-confirm-tools.spec.ts supabase/functions/_shared/whatsapp-i18n.test.ts
```

Attendu : PASS : la liste épinglée, et une préparation et un exécuteur pour chaque outil à confirmer.

```bash
deno check --no-lock supabase/functions/whatsapp-agent/index.ts supabase/functions/whatsapp-webhook/index.ts
```

Attendu : Sortie 0.

---

## Tâche 9 : `schedule_visit` → `visit_planned`, sans rien envoyer au client

L'outil existant planifie désormais par `wa_matching_visite` : un mandat ou une annonce du marché (1 818 matchs sur 1 828 en sont), un acheteur « intéressé » qui passe `visit_planned`, son deal qui avance. ⛔ Et il tient sa promesse : rien ne part au client, `reminder_sent` est posé par la base (conception §5.4). « /annuler » défait le tout par `wa_matching_visite_annuler`.

**Fichiers :**
- Modifier : `supabase/functions/_shared/whatsapp-matching-outils.ts`
- Modifier : `supabase/functions/_shared/whatsapp-matching-outils.test.ts`
- Modifier : `supabase/functions/_shared/whatsapp-tools.ts`
- Modifier : `supabase/functions/whatsapp-agent/index.ts`
- Modifier : `supabase/functions/whatsapp-webhook/index.ts`
- Modifier : `supabase/functions/_shared/whatsapp-actions.ts`

- [ ] **Étape 1 : Écrire le test qui échoue**

Dans `supabase/functions/_shared/whatsapp-matching-outils.test.ts`, remplacer :

```ts
import {
  execGetMatches, execGetBuyersForProperty, prepareRecordMatchOutcome, executeRecordMatchOutcome,
} from './whatsapp-matching-outils'
```

par :

```ts
import {
  execGetMatches, execGetBuyersForProperty, prepareRecordMatchOutcome, executeRecordMatchOutcome, execScheduleVisit, annulerVisite,
} from './whatsapp-matching-outils'
```

Ajouter à la fin de `supabase/functions/_shared/whatsapp-matching-outils.test.ts` :

```ts
describe('execScheduleVisit — une visite interne, mandat ou annonce', () => {
  const tables = { contacts, market_listings: annonces, properties: mandats }

  it('un mandat part en `p_property`, une annonce en `p_market_listing` ; « /annuler » est enregistré', async () => {
    const { client, appels, inserts } = fauxClient(tables, {
      wa_matching_visite: { ok: true, genre: 'mandat', titre: 'Villa contemporaine', visite_id: 'v1', match_id: 'm1', statut_match: 'interested', match_avant: 'interested', deal_id: 'd1', etape_avant: 'new_lead' },
    })
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, scheduled_at: '2026-09-29T14:00:00+02:00' })
    expect(r).toMatch(/^Visite planifiée le .* pour Julie Martin \(bien : Villa contemporaine\)\. Julie Martin passe en « visite planifiée »/)
    expect(appels[0].args).toMatchObject({ p_agency: A, p_contact: JULIE, p_property: VILLA, p_market_listing: null, p_duree: 45, p_type: 'sur_place' })
    expect(inserts).toEqual([{ table: 'whatsapp_recent_auto_actions', row: expect.objectContaining({ tool: 'schedule_visit', payload_undo: { visite_id: 'v1', evenement_id: null, match_id: 'm1', deal_id: 'd1', etape_avant: 'new_lead' } }) }])

    const annonce = fauxClient(tables, { wa_matching_visite: { ok: true, genre: 'annonce', titre: 'Attique 4 p.', evenement_id: 'e1', statut_match: 'sent' } })
    const r2 = await execScheduleVisit(ctx(annonce.client), { contact_id: JULIE, property_id: ATTIQUE, scheduled_at: '2026-09-29T14:00:00+02:00' })
    expect(annonce.appels[0].args).toMatchObject({ p_property: null, p_market_listing: ATTIQUE })
    expect(r2).toMatch(/L’intérêt de Julie Martin pour ce bien n’est pas consigné/)
  })

  it('un bien inconnu n’est pas planifié', async () => {
    const { client, appels } = fauxClient(tables)
    expect(await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: 'f0000000-0000-4000-8000-000000000000', scheduled_at: '2026-09-29T14:00:00Z' })).toMatch(/bien introuvable/)
    expect(appels).toEqual([])
  })
})

describe('annulerVisite — « /annuler » passe par la base', () => {
  it('rend vrai seulement si la base a défait quelque chose', async () => {
    const oui = fauxClient({}, { wa_matching_visite_annuler: { ok: true } })
    expect(await annulerVisite(oui.client as never, A, 'p-agent', { visite_id: 'v1' })).toBe(true)
    expect(oui.appels).toEqual([{ rpc: 'wa_matching_visite_annuler', args: { p_agency: A, p_profile: 'p-agent', p_retour: { visite_id: 'v1' } } }])
    const non = fauxClient({}, { wa_matching_visite_annuler: { ok: false } })
    expect(await annulerVisite(non.client as never, A, 'p-agent', { visite_id: 'v1' })).toBe(false)
    expect(await annulerVisite(non.client as never, null, 'p-agent', { visite_id: 'v1' })).toBe(false)
  })
})
```

```bash
npx vitest run supabase/functions/_shared/whatsapp-matching-outils.test.ts
```

Attendu : ÉCHEC : `execScheduleVisit` n'est pas exporté par ce module.

- [ ] **Étape 2 : Écrire l'exécuteur et l'annulation**

Dans `supabase/functions/_shared/whatsapp-matching-outils.ts`, remplacer :

```ts
import type { ActionCtx, Prepared } from './whatsapp-actions.ts'
import { touchHotContact } from './contact-memory.ts'
import {
  confirmConsigner, consigne, consignationDeja, consignationImpossible, consignationEchec, consignerMotifManquant,
  consignerAucunBien, consignerPlusieursBiens, type Consignation,
} from './whatsapp-i18n.ts'
import {
  COLONNES_MATCH, COLONNES_MANDAT, COLONNES_ANNONCE, STATUTS_COMPATIBLES, STATUTS_EN_COURS, STATUTS_DE_DEPART, bienDeMandat,
  bienDAnnonce, candidats, estMotif, estReponse, vueAcheteurs, vueCandidats, vueGetMatches,
  type BienWa, type Criteres, type EntreeMatch, type LigneAcheteur, type LigneAnnonce, type LigneMandat, type LigneMatch,
} from './whatsapp-matching.ts'
```

par :

```ts
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { ActionCtx, Prepared } from './whatsapp-actions.ts'
import { recordAutoUndo } from './whatsapp-actions.ts'
import { touchHotContact } from './contact-memory.ts'
import {
  undoHint, confirmConsigner, consigne, consignationDeja, consignationImpossible, consignationEchec, consignerMotifManquant,
  consignerAucunBien, consignerPlusieursBiens, type Consignation,
} from './whatsapp-i18n.ts'
import {
  COLONNES_MATCH, COLONNES_MANDAT, COLONNES_ANNONCE, STATUTS_COMPATIBLES, STATUTS_EN_COURS, STATUTS_DE_DEPART, bienDeMandat,
  bienDAnnonce, candidats, estMotif, estReponse, retourDeVisite, vueAcheteurs, vueCandidats, vueGetMatches,
  type BienWa, type Criteres, type EntreeMatch, type LigneAcheteur, type LigneAnnonce, type LigneMandat, type LigneMatch,
  type VisitePlanifiee,
} from './whatsapp-matching.ts'
```

Ajouter à la fin de `supabase/functions/_shared/whatsapp-matching-outils.ts` :

```ts
// ── schedule_visit (automatique, « /annuler » 30 s) ─────────────────────────

/** Le genre d'un bien désigné par son identifiant : un mandat de l'agence, sinon une annonce du marché. */
async function genreDuBien(ctx: ActionCtx, id: string): Promise<'mandat' | 'annonce' | null | 'erreur'> {
  if (!UUID.test(id)) return null
  const { data: m, error } = await ctx.supabase
    .from('properties').select('id').eq('id', id).eq('agency_id', ctx.agencyId).is('deleted_at', null).maybeSingle()
  if (error) return 'erreur'
  if (m) return 'mandat'
  const { data: a, error: aErr } = await ctx.supabase.from('market_listings').select('id').eq('id', id).maybeSingle()
  if (aErr) return 'erreur'
  return a ? 'annonce' : null
}

const frDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('fr-CH', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Zurich' })

/**
 * Planifie une visite EN INTERNE (conception §5.4) : un mandat reçoit une visite, une annonce du marché un événement
 * d'agenda ; un acheteur « intéressé » passe `visit_planned` et son deal avance. ⛔ Rien ne part au client : la base
 * pose `reminder_sent` (`wa_matching_visite`).
 */
export async function execScheduleVisit(ctx: ActionCtx, a: Args): Promise<string> {
  if (!aUneAgence(ctx)) return SANS_AGENCE
  const lang = ctx.lang ?? 'fr'
  const contactId = s(a.contact_id)
  const bienId = s(a.property_id) ?? s(a.market_listing_id)
  const when = s(a.scheduled_at)
  if (!contactId) return 'Erreur: contact_id requis (via search_contacts).'
  if (!bienId) return 'Erreur: pour quel bien ? (property_id d’un mandat, ou market_listing_id d’une annonce, via get_matches — ou demande à l’agent).'
  if (!when || !Number.isFinite(Date.parse(when))) return 'Erreur: date/heure (scheduled_at, ISO 8601) requise.'
  const contact = await contactDeLAgence(ctx, contactId)
  if (!contact) return 'Erreur: contact introuvable dans votre agence.'
  const genre = await genreDuBien(ctx, bienId)
  if (genre === 'erreur') return LECTURE_IMPOSSIBLE
  if (!genre) return 'Erreur: bien introuvable (ni mandat de ton agence, ni annonce du marché).'
  const duree = typeof a.duration_minutes === 'number' && a.duration_minutes > 0 ? Math.min(Math.round(a.duration_minutes), 480) : 45
  const debut = new Date(when).toISOString()
  const { data, error } = await ctx.supabase.rpc('wa_matching_visite', {
    p_agency: ctx.agencyId, p_profile: ctx.profileId, p_contact: contactId,
    p_property: genre === 'mandat' ? bienId : null, p_market_listing: genre === 'annonce' ? bienId : null,
    p_debut: debut, p_duree: duree, p_type: s(a.visit_type) === 'video' ? 'video' : 'sur_place',
  })
  if (error) return `Erreur planification: ${error.message}`
  const r = (data ?? { ok: false }) as VisitePlanifiee
  if (!r.ok) return r.raison === 'contact' ? 'Erreur: contact introuvable dans votre agence.' : 'Erreur: bien introuvable.'
  const undoOk = await recordAutoUndo(ctx, 'schedule_visit', retourDeVisite(r))
  const lieu = r.genre === 'annonce' ? ' (annonce du marché : inscrite à l’agenda)' : ''
  const suite = r.match_avant
    ? ` ${contact.nom} passe en « visite planifiée » dans le Matching.`
    : r.statut_match === 'sent'
      ? ` L’intérêt de ${contact.nom} pour ce bien n’est pas consigné : demande à l’agent s’il faut le consigner (record_match_outcome).`
      : ''
  const texte = `Visite planifiée le ${frDateTime(debut)} pour ${contact.nom} (bien : ${r.titre ?? 'bien'})${lieu}.${suite}`
  return undoOk ? texte + undoHint(lang) : texte
}

/**
 * « /annuler » d'une visite du copilote (whatsapp-webhook, `rollbackAutoAction`) : la visite ou l'événement, le match,
 * l'étape du deal — d'un bloc, par la base, signé MEGGA AI. `true` si quelque chose a été défait.
 */
export async function annulerVisite(client: SupabaseClient, agencyId: string | null, profileId: string, retour: Record<string, unknown>): Promise<boolean> {
  if (!agencyId) return false
  const { data, error } = await client.rpc('wa_matching_visite_annuler', { p_agency: agencyId, p_profile: profileId, p_retour: retour })
  if (error) {
    console.error('undo schedule_visit failed:', (error.message ?? 'error').slice(0, 120))
    return false
  }
  return (data as { ok?: boolean } | null)?.ok === true
}
```

- [ ] **Étape 3 : Le schéma de l'outil**

Dans `whatsapp-tools.ts`, la description et les propriétés de `schedule_visit` :

Dans `supabase/functions/_shared/whatsapp-tools.ts`, remplacer :

```ts
      description: "Planifie une visite d'un BIEN pour un contact, EN INTERNE seulement : enregistre la visite dans le CRM, n'envoie RIEN au client (ni invitation, ni email, ni lien) et ne le prévient pas. Requiert le contact ET le bien. Pour « organise une visite du bien X avec Dubois mardi 14h ». contact_id via search_contacts, property_id via get_matches (ou demande à l'agent quel bien).",
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string' },
          property_id: { type: 'string', description: 'Bien à visiter (obligatoire).' },
```

par :

```ts
      description: "Planifie une visite d'un BIEN pour un contact, EN INTERNE seulement : enregistre la visite dans le CRM (un mandat : une visite ; une annonce du marché : un rendez-vous d'agenda), n'envoie RIEN au client (ni invitation, ni email, ni rappel, ni lien) et ne le prévient pas. Si l'acheteur est intéressé par ce bien, il passe en « visite planifiée » dans le Matching. Requiert le contact ET le bien. Pour « organise une visite du bien X avec Dubois mardi 14h ». contact_id via search_contacts ; l'id du bien via get_matches (property_id pour un mandat, market_listing_id pour une annonce) — ou demande à l'agent quel bien.",
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string' },
          property_id: { type: 'string', description: 'Mandat à visiter (ou market_listing_id pour une annonce du marché).' },
          market_listing_id: { type: 'string', description: 'Annonce du marché à visiter, à la place de property_id.' },
```

Dans `supabase/functions/_shared/whatsapp-tools.ts`, remplacer :

```ts
        required: ['contact_id', 'property_id', 'scheduled_at'],
```

par :

```ts
        required: ['contact_id', 'scheduled_at'],
```

- [ ] **Étape 4 : Brancher, et défaire par la base**

Dans `whatsapp-agent/index.ts`, les imports (le `case 'schedule_visit'` de `runTool` ne change pas) :

Dans `supabase/functions/whatsapp-agent/index.ts`, remplacer :

```ts
  execScheduleVisit, execCreateReminder, execUpdatePipeline, execUpdatePipelineWithUndo, execQualifyLead,
```

par :

```ts
  execCreateReminder, execUpdatePipeline, execUpdatePipelineWithUndo, execQualifyLead,
```

Dans `supabase/functions/whatsapp-agent/index.ts`, remplacer :

```ts
import { execGetMatches, execGetBuyersForProperty, prepareRecordMatchOutcome } from '../_shared/whatsapp-matching-outils.ts'
```

par :

```ts
import { execGetMatches, execGetBuyersForProperty, prepareRecordMatchOutcome, execScheduleVisit } from '../_shared/whatsapp-matching-outils.ts'
```

Dans `whatsapp-webhook/index.ts`, l'import et la branche `schedule_visit` de `rollbackAutoAction` :

Dans `supabase/functions/whatsapp-webhook/index.ts`, remplacer :

```ts
import { bienDansMessage, refusBienDansMessage } from '../_shared/message-sans-bien.ts'
import { executeRecordMatchOutcome } from '../_shared/whatsapp-matching-outils.ts'
```

par :

```ts
import { bienDansMessage, refusBienDansMessage } from '../_shared/message-sans-bien.ts'
import { executeRecordMatchOutcome, annulerVisite } from '../_shared/whatsapp-matching-outils.ts'
```

Dans `supabase/functions/whatsapp-webhook/index.ts`, remplacer :

```ts
  if (row.tool === 'schedule_visit') {
    const id = String(p.visit_id ?? ''); if (!id) return null
    const { data: done, error } = await admin.from('visits').delete().eq('id', id).eq('agency_id', agencyId).select('id')
    if (error) { console.error('undo schedule_visit failed:', error.message.slice(0, 120)); return null }
    if (!done || done.length === 0) return null  // rien d'affecté (déjà supprimé / autre agence) → pas de fausse confirmation
    await audit('contact', 'visit', id, 'undo visite')
    return undoneAuto(lang, undoNoun(lang, row.tool))
  }
```

par :

```ts
  if (row.tool === 'schedule_visit') {
    // Lot D2 : la visite (ou l'événement d'agenda d'une annonce), le match et l'étape du deal se défont d'un bloc, par la
    // base (`wa_matching_visite_annuler`, signé MEGGA AI). Un payload d'avant le lot, `{ visit_id }`, y passe aussi.
    const id = String(p.visite_id ?? p.visit_id ?? p.evenement_id ?? ''); if (!id) return null
    if (!(await annulerVisite(admin, agencyId, agentLink.profile_id, p))) return null  // rien de défait → pas de fausse confirmation
    await audit('contact', 'visit', id, 'undo visite')
    return undoneAuto(lang, undoNoun(lang, row.tool))
  }
```

- [ ] **Étape 5 : Retirer l'ancien exécuteur**

Dans `whatsapp-actions.ts`, supprimer `execScheduleVisit` (plus aucun appelant) :

Supprimer, dans `supabase/functions/_shared/whatsapp-actions.ts` :

```ts
/** Planifie une visite (table visits). property_id ET contact_id obligatoires (NOT NULL). */
export async function execScheduleVisit(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const contactId = s(a.contact_id), propertyId = s(a.property_id), when = s(a.scheduled_at)
  if (!contactId) return 'Erreur: contact_id requis (via search_contacts).'
  if (!propertyId) return 'Erreur: pour quel bien ? (property_id requis, via get_matches ou demande à l’agent).'
  if (!when || !Number.isFinite(Date.parse(when))) return 'Erreur: date/heure (scheduled_at, ISO 8601) requise.'
  const contact = await contactInAgency(ctx, contactId)
  if (!contact) return 'Erreur: contact introuvable dans votre agence.'
  const { data: prop } = await ctx.supabase
    .from('properties').select('id, title').eq('id', propertyId).eq('agency_id', ctx.agencyId).maybeSingle()
  if (!prop) return 'Erreur: bien introuvable dans votre agence.'
  const propTitle = (prop as { title: string | null }).title ?? 'bien'

  const visitType = s(a.visit_type) === 'video' ? 'video' : 'sur_place'
  const buyerName = `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() || null
  const iso = new Date(when).toISOString()
  const row: Record<string, unknown> = {
    agency_id: ctx.agencyId, agent_id: ctx.profileId,
    property_id: propertyId, contact_id: contactId,
    scheduled_at: iso, status: 'planned', visit_type: visitType, buyer_name: buyerName,
  }
  if (typeof a.duration_minutes === 'number' && a.duration_minutes > 0) row.duration_minutes = Math.min(a.duration_minutes, 480)
  if (visitType === 'video') row.video_platform = 'google_meet'
  const { data: visit, error } = await ctx.supabase.from('visits').insert(row).select('id').single()
  if (error) return `Erreur planification: ${error.message}`
  await logTimeline(ctx, 'visit_scheduled', `${propTitle} — ${frDateTime(iso)}`, contactId)
  const undoOk = await recordAutoUndo(ctx, 'schedule_visit', { visit_id: visit.id })
  const base = `Visite planifiée le ${frDateTime(iso)} pour ${buyerName ?? 'le contact'} (bien : ${propTitle}).`
  return undoOk ? base + undoHint(ctx.lang ?? 'fr') : base
}
```

- [ ] **Étape 6 : Vérifier**

```bash
npx vitest run supabase/functions/_shared/whatsapp-matching-outils.test.ts supabase/functions/_shared/whatsapp-actions.test.ts supabase/functions/_shared/whatsapp-agent-router.test.ts
```

Attendu : PASS.

```bash
deno check --no-lock supabase/functions/whatsapp-agent/index.ts supabase/functions/whatsapp-webhook/index.ts supabase/functions/ai-copilot/index.ts
```

Attendu : Sortie 0.

---

## Tâche 10 : La garde des confirmations simulées connaît la consignation

Le copilote a déjà prétendu une action qu'aucun outil n'avait faite (incident du 10.09.2026). Consigner une réponse passe désormais par une question [Oui] [Non] : un « Je consigne… Tu confirmes ? » écrit par DeepSeek sans outil, ou un « ✅ Consigné » recopié, sont des confirmations simulées. La garde les reconnaît, et laisse passer l'offre, la question et le fait passé daté.

**Fichiers :**
- Modifier : `supabase/functions/_shared/whatsapp-phantom-action.ts`
- Modifier : `supabase/functions/_shared/whatsapp-phantom-action.test.ts`

- [ ] **Étape 1 : Écrire le test qui échoue**

Dans `whatsapp-phantom-action.test.ts`, l'import, puis à la fin du fichier :

Dans `supabase/functions/_shared/whatsapp-phantom-action.test.ts`, remplacer :

```ts
import { t } from './whatsapp-i18n'
```

par :

```ts
import { t, consigne } from './whatsapp-i18n'
```

Ajouter à la fin de `supabase/functions/_shared/whatsapp-phantom-action.test.ts` :

```ts

describe('lot D2 — consigner la réponse d’un acheteur passe par l’outil', () => {
  it('une consignation simulée est détectée (FR, EN)', () => {
    for (const s of [
      'Je consigne : Julie pas intéressée par Florissant, motif prix. Tu confirmes ?',
      'C’est noté, je consigne le refus de Julie.',
      '✅ Consigné pour Julie Martin : « Attique 4 p. » — intéressé·e.',
      "J'ai consigné le refus de Julie pour Florissant.",
      "I'll record that Julie is not interested. Confirm?",
      '✅ Recorded for Julie Martin: « Attique » — interested.',
      "I've recorded her answer.",
    ]) expect(detectPhantomAction(s), s).not.toBeNull()
  })

  it('une offre, une question, ou un fait passé nommé comme tel, passe', () => {
    for (const s of [
      'Tu veux que je consigne son refus ?',
      'Si tu veux, je consigne le refus de Julie.',
      "J'ai consigné hier son refus pour Florissant.",
      'Want me to record her answer?',
    ]) expect(detectPhantomAction(s), s).toBeNull()
  })

  it('les comptes rendus de l’exécuteur sont ceux que la garde reconnaît', () => {
    expect(detectPhantomAction(consigne('fr', { reponse: 'interesse', nom: 'Julie Martin', bien: 'Attique' }))).toBe('action_claim')
    expect(detectPhantomAction(consigne('en', { reponse: 'pas_encore', nom: 'Julie Martin', bien: 'Attique' }))).toBe('action_claim')
  })
})
```

```bash
npx vitest run supabase/functions/_shared/whatsapp-phantom-action.test.ts
```

Attendu : ÉCHEC : les sept consignations simulées passent.

- [ ] **Étape 2 : Apprendre la consignation à la garde**

Dans `whatsapp-phantom-action.ts`, le mot d'action :

Dans `supabase/functions/_shared/whatsapp-phantom-action.ts`, remplacer :

```ts
const ACTION_WORD = /(suppr|effac|envo[iy]|publi(?!que|cs?\b)|retir|retrait|offre|kyc|invit|delet|remov|\bsend|\bsent\b|withdr|\boffer)/
```

par :

```ts
// `consign` et `record` (lot D2) : consigner la réponse d'un acheteur passe aussi par une confirmation (record_match_outcome).
const ACTION_WORD = /(suppr|effac|envo[iy]|publi(?!que|cs?\b)|retir|retrait|offre|kyc|invit|delet|remov|\bsend|\bsent\b|withdr|\boffer|consign|\brecord)/
```

…les comptes rendus que seul l'exécuteur écrit :

Dans `supabase/functions/_shared/whatsapp-phantom-action.ts`, remplacer :

```ts
  '✅ relance approuvee (template) envoyee', '✅ approved re-engagement template sent',
]
```

par :

```ts
  '✅ relance approuvee (template) envoyee', '✅ approved re-engagement template sent',
  // Lot D2 : le compte rendu de record_match_outcome (`consigne`, whatsapp-i18n.ts), écrit APRÈS le « oui » seulement.
  '✅ consigne', '✅ recorded',
]
```

…les annonces au présent, puis au passé :

Dans `supabase/functions/_shared/whatsapp-phantom-action.ts`, remplacer :

```ts
  /\bi(?:'ve| have) just (?:published|withdrawn|sent (?!you\b))/,
]
```

par :

```ts
  /\bi(?:'ve| have) just (?:published|withdrawn|sent (?!you\b))/,
  // Lot D2 : « je consigne son refus » sans outil — la consignation passe par record_match_outcome et son « oui ».
  new RegExp(NOT_OFFER + String.raw`\bje (?:le |la |les |l')?consigne\b`),
  /\bi(?:'m| am) (?:now )?recording\b/,
]
```

Dans `supabase/functions/_shared/whatsapp-phantom-action.ts`, remplacer :

```ts
  /\bi(?:'ve| have) (?:published|withdrawn|sent (?!you\b))/,
]
```

par :

```ts
  /\bi(?:'ve| have) (?:published|withdrawn|sent (?!you\b))/,
  /\bj'ai (?:bien )?consigne\b/,
  /\bi(?:'ve| have) recorded (?:(?:her|his|their|the|your) )?(?:answer|feedback|reply|response|refusal|interest)\b/,
]
```

- [ ] **Étape 3 : Vérifier**

```bash
npx vitest run supabase/functions/_shared/whatsapp-phantom-action.test.ts
```

Attendu : PASS, cas anciens compris.

```bash
deno check --no-lock supabase/functions/whatsapp-agent/index.ts
```

Attendu : Sortie 0.

---

## Tâche 11 : Le point du matin lit le matching du jour

Une sixième source : les actions de matching de l'agence, par `matching_actions_agence` (la fonction d'« Aujourd'hui »), et les intéressés qui attendent une visite. ⛔ Une relance de proposition échue n'est comptée qu'une fois : quand le matching porte le retour de son acheteur, elle quitte « À relancer » (conception §6). La composition vient à la tâche 12 ; ici, les données et leurs types.

**Fichiers :**
- Modifier : `supabase/functions/_shared/morning-brief.ts`
- Modifier : `supabase/functions/_shared/morning-brief-data.ts`
- Modifier : `supabase/functions/_shared/morning-brief-data.test.ts`

- [ ] **Étape 1 : Les types**

Dans `supabase/functions/_shared/morning-brief.ts`, les deux types du matching, après `BriefSellerLead` :

Dans `supabase/functions/_shared/morning-brief.ts`, remplacer :

```ts
export interface BriefSellerLead {
  contactName: string
  city: string | null
  estimationMedian: number | null
}
```

par :

```ts
export interface BriefSellerLead {
  contactName: string
  city: string | null
  estimationMedian: number | null
}

/**
 * Une action de matching du jour (lot D2) : une ligne de `matching_actions_agence`, la fonction d'« Aujourd'hui ». Le
 * prénom de l'acheteur, comme le segment d'« Aujourd'hui » : « pour Julie », jamais « de Julie ».
 */
export interface BriefMatchingAction {
  genre: 'retour' | 'prix' | 'mandat' | 'marche'
  who: string | null
  contactId: string | null
  /** Le statut du match d'une baisse : `sent` (proposé) ou `suggested` (refusé pour le prix, revenu). */
  statut: string | null
  titre: string | null
  ville: string | null
  nombre: number
  nouveaux: number
  baisses: number
  montant: number | null
}

/** Le matching du jour : les actions, classées par la base, leur total EXACT, et les intéressés sans visite. */
export interface BriefMatching {
  actions: BriefMatchingAction[]
  total: number
  /** Les acheteurs intéressés qui attendent une visite (« À conclure »), noms distincts. */
  interesses: string[]
  /** La lecture des intéressés a atteint sa limite : leur nombre réel est inconnu. */
  interessesAtLimit: boolean
}
```

…les champs de `MorningBriefData` :

Dans `supabase/functions/_shared/morning-brief.ts`, remplacer :

```ts
  eventsAtLimit?: boolean
  reminders: BriefReminder[]
  offers: BriefOffer[]
  sellerLeads: BriefSellerLead[]
}
```

par :

```ts
  eventsAtLimit?: boolean
  reminders: BriefReminder[]
  /** La lecture des relances a atteint sa limite : le total réel est inconnu (la déduplication du matching en retire). */
  remindersAtLimit?: boolean
  offers: BriefOffer[]
  sellerLeads: BriefSellerLead[]
  /** Lot D2 : le matching du jour. */
  matching?: BriefMatching
}
```

…les limites des lectures :

Dans `supabase/functions/_shared/morning-brief.ts`, remplacer :

```ts
export const SQL_LIMITS = { visits: 12, events: 20, reminders: 20, offers: 5, sellerLeads: 5 } as const
```

par :

```ts
export const SQL_LIMITS = { visits: 12, events: 20, reminders: 20, offers: 5, sellerLeads: 5, matching: 20, interesses: 20 } as const
```

…et ceux de `BriefAgencyData` :

Dans `supabase/functions/_shared/morning-brief.ts`, remplacer :

```ts
  eventsAtLimit: boolean
  reminders: BriefReminder[]
  offers: BriefOffer[]
  sellerLeads: BriefSellerLead[]
}
```

par :

```ts
  eventsAtLimit: boolean
  reminders: BriefReminder[]
  remindersAtLimit: boolean
  offers: BriefOffer[]
  sellerLeads: BriefSellerLead[]
  matching: BriefMatching
}
```

- [ ] **Étape 2 : Écrire le test qui échoue**

Dans `morning-brief-data.test.ts`, le faux client apprend `rpc` :

Dans `supabase/functions/_shared/morning-brief-data.test.ts`, remplacer :

```ts
  return { client: { from } as never, appels }
}
```

par :

```ts
  // Lot D2 : `matching_actions_agence`, appelée par `rpc` ; ses lignes sous la clé `rpc:<nom>`.
  const rpc = (nom: string, args: unknown) => {
    appels.push({ table: `rpc:${nom}`, op: 'rpc', args: [args] })
    return {
      then: (resolve: (r: unknown) => void) => resolve(`rpc:${nom}` === erreurSur
        ? { data: null, error: { message: 'canceling statement due to statement timeout' } }
        : { data: rows[`rpc:${nom}`] ?? [], error: null }),
    }
  }
  return { client: { from, rpc } as never, appels }
}
```

…l'attendu du test « met les lignes à plat », qui compare l'objet entier, et la lecture des intéressés parmi celles dont l'échec rend `null` :

Dans `supabase/functions/_shared/morning-brief-data.test.ts`, remplacer :

```ts
      reminders: [{ type: 'post_visit_feedback', who: 'Jean' }],
      offers: [{ amount: 1450000, byLabel: 'M. Keller', expiresAt: '2026-07-06T10:00:00Z' }],
      sellerLeads: [{ contactName: 'Marie Curie', city: 'Carouge', estimationMedian: 1250000 }],
    })
```

par :

```ts
      reminders: [{ type: 'post_visit_feedback', who: 'Jean' }],
      remindersAtLimit: false,
      offers: [{ amount: 1450000, byLabel: 'M. Keller', expiresAt: '2026-07-06T10:00:00Z' }],
      sellerLeads: [{ contactName: 'Marie Curie', city: 'Carouge', estimationMedian: 1250000 }],
      // Lot D2 : aucune action de matching ce jour-là.
      matching: { actions: [], total: 0, interesses: [], interessesAtLimit: false },
    })
```

Dans `supabase/functions/_shared/morning-brief-data.test.ts`, remplacer :

```ts
    for (const table of ['visits', 'calendar_events', 'reminders', 'crm_offers', 'seller_leads']) {
```

par :

```ts
    for (const table of ['visits', 'calendar_events', 'reminders', 'crm_offers', 'seller_leads', 'matches']) {
```

…et, à la fin du fichier :

Ajouter à la fin de `supabase/functions/_shared/morning-brief-data.test.ts` :

```ts

describe('loadAgencyData — le matching du jour (lot D2)', () => {
  const START = '2026-07-04T22:00:00.000Z'
  const END = '2026-07-05T22:00:00.000Z'
  const ACTIONS = [
    { genre: 'retour', contact_id: 'c-julie', prenom: 'Julie', nom: 'Martin', statut: null, titre: null, ville: null, nombre: 2, nouveaux: null, baisses: null, montant: null, total: 3 },
    { genre: 'prix', contact_id: 'c-antoine', prenom: 'Antoine', nom: 'Roux', statut: 'sent', titre: 'Attique', ville: 'Genève', nombre: null, nouveaux: null, baisses: null, montant: '900000', total: 3 },
    { genre: 'marche', contact_id: 'c-ana', prenom: 'Anastasia', nom: 'K', statut: null, titre: null, ville: null, nombre: 3, nouveaux: 0, baisses: 0, montant: null, total: 3 },
  ]

  it('lit les actions par la fonction d’agence, sur SON agence ; les intéressés, filtrés par agence', async () => {
    const { client, appels } = fauxClient({
      'rpc:matching_actions_agence': ACTIONS,
      matches: [{ contact: { first_name: 'Léa', last_name: 'Blanc' } }, { contact: { first_name: 'Léa', last_name: 'Blanc' } }],
    })
    const d = await loadAgencyData(client, AGENCY, START, END, NOW)
    expect(appels).toContainEqual({ table: 'rpc:matching_actions_agence', op: 'rpc', args: [{ p_agency: AGENCY, p_limite: 20 }] })
    expect(appels).toContainEqual({ table: 'matches', op: 'eq', args: ['agency_id', AGENCY] })
    expect(d!.matching.total).toBe(3)
    // Un marché sans nouveauté ni baisse n'a pas de raison d'être : écarté, comme dans « Aujourd'hui ».
    expect(d!.matching.actions.map((a) => a.genre)).toEqual(['retour', 'prix'])
    expect(d!.matching.actions[1]).toMatchObject({ who: 'Antoine', montant: 900000, statut: 'sent', titre: 'Attique' })
    expect(d!.matching.interesses).toEqual(['Léa Blanc'])
  })

  it('⛔ une relance de proposition échue n’est comptée qu’une fois : son acheteur a son retour dans le matching', async () => {
    const julie = { first_name: 'Julie', last_name: 'Martin' }
    const { client } = fauxClient({
      'rpc:matching_actions_agence': ACTIONS,
      reminders: [
        { type: 'follow_up_sent_property', trigger_at: '2026-07-04T08:00:00Z', contact_id: 'c-julie', contact: julie },
        { type: 'follow_up_sent_property', trigger_at: '2026-07-05T15:00:00Z', contact_id: 'c-julie', contact: julie },
        { type: 'post_visit_feedback', trigger_at: '2026-07-04T08:00:00Z', contact_id: 'c-julie', contact: julie },
      ],
    })
    const d = await loadAgencyData(client, AGENCY, START, END, NOW)
    // L'échue part (le matching la porte) ; celle de l'après-midi et le retour de visite restent.
    expect(d!.reminders).toEqual([
      { type: 'follow_up_sent_property', who: 'Julie Martin' },
      { type: 'post_visit_feedback', who: 'Julie Martin' },
    ])
    expect(d!.remindersAtLimit).toBe(false)
  })

  it('une lecture du matching en échec : pas de brief — une section manquante en silence mentirait', async () => {
    const { client } = fauxClient({}, 'rpc:matching_actions_agence')
    expect(await loadAgencyData(client, AGENCY, START, END, NOW)).toBeNull()
  })
})
```

```bash
npx vitest run supabase/functions/_shared/morning-brief-data.test.ts
```

Attendu : ÉCHEC : `matching` indéfini.

- [ ] **Étape 3 : Lire le matching**

Dans `morning-brief-data.ts`, l'en-tête et l'import :

Dans `supabase/functions/_shared/morning-brief-data.ts`, remplacer :

```ts
// Lecture des cinq sources du point du jour — partagée par le push de 07h30
```

par :

```ts
// Lecture des sources du point du jour — cinq, plus le matching depuis le lot D2 —, partagée par le push de 07h30
```

Dans `supabase/functions/_shared/morning-brief-data.ts`, remplacer :

```ts
  SQL_LIMITS,
  type BriefAgencyData, type BriefVisitRow, type BriefEvent, type BriefReminder, type BriefOffer, type BriefSellerLead,
} from './morning-brief.ts'
```

par :

```ts
  SQL_LIMITS,
  type BriefAgencyData, type BriefVisitRow, type BriefEvent, type BriefReminder, type BriefOffer, type BriefSellerLead,
  type BriefMatching, type BriefMatchingAction,
} from './morning-brief.ts'
```

…les deux lectures de plus :

Dans `supabase/functions/_shared/morning-brief-data.ts`, remplacer :

```ts
  const [visitsRes, eventsRes, remindersRes, offersRes, leadsRes] = await Promise.all([
```

par :

```ts
  const [visitsRes, eventsRes, remindersRes, offersRes, leadsRes, matchingRes, interessesRes] = await Promise.all([
```

Dans `supabase/functions/_shared/morning-brief-data.ts`, remplacer :

```ts
      .select('type, trigger_at, contact:contacts(first_name, last_name)')
```

par :

```ts
      .select('type, trigger_at, contact_id, contact:contacts(first_name, last_name)')
```

Dans `supabase/functions/_shared/morning-brief-data.ts`, remplacer :

```ts
      .order('created_at', { ascending: false })
      .limit(SQL_LIMITS.sellerLeads),
  ])
```

par :

```ts
      .order('created_at', { ascending: false })
      .limit(SQL_LIMITS.sellerLeads),
    // Lot D2 : le matching du jour, par la fonction d'« Aujourd'hui » sur l'agence passée — le rôle de service n'a pas
    // d'agence à lui, `matching_actions_du_jour` ne rendrait rien. Actions classées, total exact.
    admin.rpc('matching_actions_agence', { p_agency: agencyId, p_limite: SQL_LIMITS.matching }),
    // Les intéressés qui attendent une visite (« À conclure »), le plus ancien intérêt d'abord.
    admin.from('matches')
      .select('contact:contacts(first_name, last_name)')
      .eq('agency_id', agencyId)
      .eq('status', 'interested')
      .order('response_at', { ascending: true, nullsFirst: false })
      .limit(SQL_LIMITS.interesses),
  ])
```

Dans `supabase/functions/_shared/morning-brief-data.ts`, remplacer :

```ts
  for (const res of [visitsRes, eventsRes, remindersRes, offersRes, leadsRes]) {
```

par :

```ts
  for (const res of [visitsRes, eventsRes, remindersRes, offersRes, leadsRes, matchingRes, interessesRes]) {
```

…la déduplication des relances :

Dans `supabase/functions/_shared/morning-brief-data.ts`, remplacer :

```ts
  const reminders: BriefReminder[] = ((remindersRes.data ?? []) as unknown as Array<{
    type: string; contact: NameRow
  }>).map((r) => ({ type: r.type, who: contactName(r.contact) }))
```

par :

```ts
  // Lot D2 : le matching d'abord — la déduplication des relances en dépend.
  const matching = lireMatching(matchingRes.data, interessesRes.data)
  const retoursDus = new Set(matching.actions.filter((a) => a.genre === 'retour' && a.contactId).map((a) => a.contactId as string))
  const lignesRelances = (remindersRes.data ?? []) as unknown as Array<{
    type: string; trigger_at: string | null; contact_id: string | null; contact: NameRow
  }>
  // ⛔ Une relance de proposition ÉCHUE n'est comptée qu'une fois : la section Matching porte le retour de son acheteur
  // (« Retour à consigner pour Julie · 2 biens »). Due plus tard dans la journée, elle reste ici.
  const reminders: BriefReminder[] = lignesRelances
    .filter((r) => !(r.type === 'follow_up_sent_property' && r.contact_id && retoursDus.has(r.contact_id)
      && r.trigger_at && Date.parse(r.trigger_at) <= now.getTime()))
    .map((r) => ({ type: r.type, who: contactName(r.contact) }))
```

…et le retour, avec `lireMatching` :

Dans `supabase/functions/_shared/morning-brief-data.ts`, remplacer :

```ts
  return { visits, events, eventsAtLimit: lignesEvenements.length >= SQL_LIMITS.events, reminders, offers, sellerLeads }
}
```

par :

```ts
  return {
    visits, events, eventsAtLimit: lignesEvenements.length >= SQL_LIMITS.events,
    // Compté sur la lecture BRUTE : la déduplication retire des lignes, le plafond, lui, reste atteint.
    reminders, remindersAtLimit: lignesRelances.length >= SQL_LIMITS.reminders,
    offers, sellerLeads, matching,
  }
}

/** Une ligne de `matching_actions_agence` (les colonnes de la fonction du lot D1). */
interface LigneActionMatching {
  genre: string; contact_id: string | null; prenom: string | null; nom: string | null; statut: string | null
  titre: string | null; ville: string | null; nombre: number | null; nouveaux: number | null; baisses: number | null
  montant: number | string | null; total: number | null
}
const GENRES: ReadonlySet<string> = new Set(['retour', 'prix', 'mandat', 'marche'])

/**
 * Le matching du jour. Une action qui écrirait une phrase fausse ou sans raison est écartée — la règle de `versAction`
 * (src/components/crm/today/matchingDuJour.ts) : une baisse nulle ou sur un bien ni proposé ni à proposer, un marché
 * sans nouveauté ni baisse, un retour sans acheteur.
 */
function lireMatching(actionsBrutes: unknown, interessesBruts: unknown): BriefMatching {
  const lignes = (actionsBrutes ?? []) as LigneActionMatching[]
  const actions: BriefMatchingAction[] = lignes.flatMap((l) => {
    if (!GENRES.has(l.genre)) return []
    const montant = l.montant == null ? null : Number(l.montant)
    const nouveaux = l.nouveaux ?? 0
    const baisses = l.baisses ?? 0
    if (l.genre === 'retour' && !l.contact_id) return []
    if (l.genre === 'prix' && (!(montant != null && montant > 0) || (l.statut !== 'sent' && l.statut !== 'suggested'))) return []
    if (l.genre === 'marche' && nouveaux + baisses === 0) return []
    return [{
      genre: l.genre as BriefMatchingAction['genre'], who: l.prenom?.trim() || l.nom?.trim() || null, contactId: l.contact_id,
      statut: l.statut, titre: l.titre?.trim() || null, ville: l.ville?.trim() || null, nombre: l.nombre ?? 0, nouveaux, baisses,
      montant: montant != null && Number.isFinite(montant) ? montant : null,
    }]
  })
  const lignesInteresses = (interessesBruts ?? []) as unknown as Array<{ contact: NameRow }>
  const interesses = [...new Set(lignesInteresses.map((r) => contactName(r.contact)).filter((n): n is string => n != null))]
  return { actions, total: lignes[0]?.total ?? 0, interesses, interessesAtLimit: lignesInteresses.length >= SQL_LIMITS.interesses }
}
```

- [ ] **Étape 4 : Vérifier**

```bash
npx vitest run supabase/functions/_shared/morning-brief-data.test.ts supabase/functions/_shared/morning-brief.test.ts
```

Attendu : PASS.

```bash
deno check --no-lock supabase/functions/whatsapp-morning-brief/index.ts supabase/functions/whatsapp-agent/index.ts
```

Attendu : Sortie 0.

---

## Tâche 12 : Le point du matin parle du matching

Le point en texte libre gagne une section « Matching (N) » : cinq lignes au plus, aux phrases du segment d'« Aujourd'hui », puis les intéressés qui attendent une visite ; le compte du modèle Meta l'inclut, et le modèle part aussi un jour de matching seul (décisions de Julien, 24.09.2026). Le détail (« mon point du jour ») rend toutes les lignes lues. Toujours sans modèle de langue (conception §6).

**Fichiers :**
- Modifier : `supabase/functions/_shared/morning-brief.ts`
- Modifier : `supabase/functions/_shared/morning-brief.test.ts`
- Modifier : `supabase/functions/_shared/whatsapp-tools.ts`

- [ ] **Étape 1 : Écrire le test qui échoue**

Dans `morning-brief.test.ts`, l'import, puis à la fin du fichier :

Dans `supabase/functions/_shared/morning-brief.test.ts`, remplacer :

```ts
  zurichHour, zurichDayBoundsUtc, SQL_LIMITS, type MorningBriefData,
} from './morning-brief'
```

par :

```ts
  zurichHour, zurichDayBoundsUtc, SQL_LIMITS, type MorningBriefData, type BriefMatching,
} from './morning-brief'
```

Ajouter à la fin de `supabase/functions/_shared/morning-brief.test.ts` :

```ts

describe('le matching du matin (lot D2)', () => {
  const MATCHING: BriefMatching = {
    total: 7,
    actions: [
      { genre: 'retour', who: 'Julie', contactId: 'c1', statut: null, titre: null, ville: null, nombre: 2, nouveaux: 0, baisses: 0, montant: null },
      { genre: 'prix', who: 'Antoine', contactId: 'c2', statut: 'sent', titre: 'Attique Florissant', ville: 'Genève', nombre: 0, nouveaux: 0, baisses: 0, montant: 900000 },
      { genre: 'prix', who: 'Emma', contactId: 'c3', statut: 'suggested', titre: null, ville: null, nombre: 0, nouveaux: 0, baisses: 0, montant: 50000 },
      { genre: 'mandat', who: null, contactId: null, statut: null, titre: 'Villa Cologny', ville: 'Cologny', nombre: 4, nouveaux: 0, baisses: 0, montant: null },
      { genre: 'marche', who: 'Anastasia', contactId: 'c4', statut: null, titre: 'Appartement lumineux', ville: 'Carouge', nombre: 1, nouveaux: 1, baisses: 0, montant: null },
      { genre: 'marche', who: 'Bob', contactId: 'c5', statut: null, titre: null, ville: null, nombre: 3, nouveaux: 2, baisses: 1, montant: null },
    ],
    interesses: ['Léa Blanc', 'Marc Roux'],
    interessesAtLimit: false,
  }
  const VIDE: MorningBriefData = { agentFullName: 'Gregory Lyonnet', visits: [], reminders: [], offers: [], sellerLeads: [] }

  it('une section « Matching » : cinq lignes, « …et N autres » sur le total exact, puis les intéressés', () => {
    const text = composeMorningBrief({ ...VIDE, matching: MATCHING }, 'fr')!
    expect(text).toContain('**Matching (9)**')
    expect(text).toContain('- Retour à consigner pour Julie · 2 biens')
    expect(text).toContain("- Prix baissé de CHF 900'000 sur le bien proposé à Antoine · Attique Florissant")
    expect(text).toContain("- Prix baissé de CHF 50'000 sur le bien refusé par Emma")
    expect(text).toContain('- Nouveau mandat · 4 acquéreurs compatibles · Villa Cologny')
    expect(text).toContain('- Nouveau bien à Carouge pour Anastasia · Appartement lumineux')
    expect(text).not.toContain('Bob')
    expect(text).toContain('…et 2 autres')
    expect(text).toContain('- 2 acheteurs intéressés attendent une visite : Léa Blanc, Marc Roux')
  })

  it('en anglais', () => {
    const text = composeMorningBrief({ ...VIDE, matching: MATCHING }, 'en')!
    expect(text).toContain('- Feedback to record for Julie · 2 properties')
    expect(text).toContain('- New mandate · 4 matching buyers · Villa Cologny')
    expect(text).toContain('- 2 interested buyers are waiting for a viewing: Léa Blanc, Marc Roux')
  })

  it('un jour de matching seul a son brief, et le compte du modèle inclut le matching', () => {
    expect(composeMorningBrief({ ...VIDE, matching: MATCHING }, 'fr')).not.toBeNull()
    expect(briefItemCount({ ...VIDE, matching: MATCHING })).toEqual({ count: 9, atLimit: false })
    expect(briefItemCount({ ...VIDE, matching: { ...MATCHING, interessesAtLimit: true } }).atLimit).toBe(true)
    expect(composeMorningBrief({ ...VIDE, matching: { total: 0, actions: [], interesses: [], interessesAtLimit: false } }, 'fr')).toBeNull()
  })

  it('le détail rend toutes les lignes lues, et le même total que le modèle', () => {
    const detail = composeBriefDetail({ ...VIDE, matching: MATCHING }, 'fr')
    expect(detail.total).toBe('9')
    expect(detail.matching).toEqual({
      total: '7',
      actions: [
        'Retour à consigner pour Julie · 2 biens',
        "Prix baissé de CHF 900'000 sur le bien proposé à Antoine · Attique Florissant",
        "Prix baissé de CHF 50'000 sur le bien refusé par Emma",
        'Nouveau mandat · 4 acquéreurs compatibles · Villa Cologny',
        'Nouveau bien à Carouge pour Anastasia · Appartement lumineux',
        'Bob · 2 nouveaux biens, 1 en baisse',
      ],
      autres: 1,
      acheteurs_interesses_sans_visite: ['Léa Blanc', 'Marc Roux'],
    })
  })

  it('des relances plafonnées restent « N+ », même quand la déduplication en retire', () => {
    const reminders = Array.from({ length: 19 }, () => ({ type: 'custom', who: null }))
    expect(briefItemCount({ ...VIDE, reminders, remindersAtLimit: true }).atLimit).toBe(true)
    expect(composeMorningBrief({ ...VIDE, reminders, remindersAtLimit: true }, 'fr')).toContain('**À relancer (19+)**')
  })
})
```

```bash
npx vitest run supabase/functions/_shared/morning-brief.test.ts
```

Attendu : ÉCHEC : ni section, ni compte, ni détail.

- [ ] **Étape 2 : Composer**

Dans `morning-brief.ts`, le plafond d'affichage :

Dans `supabase/functions/_shared/morning-brief.ts`, remplacer :

```ts
const CAPS = { visits: 6, events: 6, reminders: 5, offers: 3, sellerLeads: 3 } as const
```

par :

```ts
const CAPS = { visits: 6, events: 6, reminders: 5, offers: 3, sellerLeads: 3, matching: 5 } as const
```

…le compte du modèle :

Dans `supabase/functions/_shared/morning-brief.ts`, remplacer :

```ts
export function briefItemCount(
  data: Pick<MorningBriefData, 'visits' | 'events' | 'eventsAtLimit' | 'reminders' | 'offers' | 'sellerLeads'>,
): { count: number; atLimit: boolean } {
  const { visits, reminders, offers, sellerLeads } = data
  const events = data.events ?? []
  return {
    count: visits.length + events.length + reminders.length + offers.length + sellerLeads.length,
    // Même règle que l'en-tête « Rendez-vous » du push : les séries développées peuvent dépasser
    // la limite SQL sans l'atteindre, c'est donc la requête qui dit si le total est connu.
    atLimit: visits.length >= SQL_LIMITS.visits || (data.eventsAtLimit ?? events.length >= SQL_LIMITS.events)
      || reminders.length >= SQL_LIMITS.reminders
      || offers.length >= SQL_LIMITS.offers || sellerLeads.length >= SQL_LIMITS.sellerLeads,
  }
}
```

par :

```ts
export function briefItemCount(
  data: Pick<MorningBriefData, 'visits' | 'events' | 'eventsAtLimit' | 'reminders' | 'remindersAtLimit' | 'offers' | 'sellerLeads' | 'matching'>,
): { count: number; atLimit: boolean } {
  const { visits, reminders, offers, sellerLeads } = data
  const events = data.events ?? []
  // Lot D2 : le matching compte (décision de Julien, 24.09.2026) — ses actions au total EXACT de la base, et les
  // intéressés qui attendent une visite. Le modèle part donc aussi un jour de matching seul.
  const m = data.matching
  return {
    count: visits.length + events.length + reminders.length + offers.length + sellerLeads.length
      + (m ? m.total + m.interesses.length : 0),
    // Même règle que l'en-tête « Rendez-vous » du push : les séries développées peuvent dépasser
    // la limite SQL sans l'atteindre, c'est donc la requête qui dit si le total est connu.
    atLimit: visits.length >= SQL_LIMITS.visits || (data.eventsAtLimit ?? events.length >= SQL_LIMITS.events)
      || (data.remindersAtLimit ?? reminders.length >= SQL_LIMITS.reminders)
      || offers.length >= SQL_LIMITS.offers || sellerLeads.length >= SQL_LIMITS.sellerLeads
      || (m?.interessesAtLimit ?? false),
  }
}
```

…les deux lignes, avant `composeMorningBrief` :

Dans `supabase/functions/_shared/morning-brief.ts`, remplacer :

```ts
/**
 * Compose le brief du matin. Gras en Markdown
```

par :

```ts
/**
 * Une action de matching, en une ligne — les phrases du segment d'« Aujourd'hui » (dashboard.json,
 * `today.h.matching`), plus le bien quand l'action en nomme un. « pour Julie », jamais « de Julie ».
 */
function ligneMatching(a: BriefMatchingAction, fr: boolean): string {
  const qui = a.who ?? (fr ? 'un acheteur' : 'a buyer')
  const avecBien = (base: string) => (a.titre ? `${base} · ${a.titre}` : base)
  switch (a.genre) {
    case 'retour':
      return fr
        ? `Retour à consigner pour ${qui} · ${a.nombre} ${a.nombre > 1 ? 'biens' : 'bien'}`
        : `Feedback to record for ${qui} · ${a.nombre} ${a.nombre > 1 ? 'properties' : 'property'}`
    case 'prix': {
      const m = fmtCHF(a.montant ?? 0)
      return avecBien(a.statut === 'sent'
        ? (fr ? `Prix baissé de ${m} sur le bien proposé à ${qui}` : `Price down ${m} on the property proposed to ${qui}`)
        : (fr ? `Prix baissé de ${m} sur le bien refusé par ${qui}` : `Price down ${m} on the property ${qui} declined`))
    }
    case 'mandat':
      return avecBien(fr
        ? `Nouveau mandat · ${a.nombre} ${a.nombre > 1 ? 'acquéreurs compatibles' : 'acquéreur compatible'}`
        : `New mandate · ${a.nombre} matching ${a.nombre > 1 ? 'buyers' : 'buyer'}`)
    case 'marche': {
      if (a.nouveaux + a.baisses === 1) {
        const ville = a.ville?.trim()
        const base = a.baisses === 1
          ? (fr ? (ville ? `Bien en baisse à ${ville} pour ${qui}` : `Bien en baisse pour ${qui}`) : (ville ? `Price drop in ${ville} for ${qui}` : `Price drop for ${qui}`))
          : (fr ? (ville ? `Nouveau bien à ${ville} pour ${qui}` : `Nouveau bien pour ${qui}`) : (ville ? `New property in ${ville} for ${qui}` : `New property for ${qui}`))
        return avecBien(base)
      }
      const liste = [
        a.nouveaux ? (fr ? `${a.nouveaux} ${a.nouveaux > 1 ? 'nouveaux biens' : 'nouveau bien'}` : `${a.nouveaux} new ${a.nouveaux > 1 ? 'properties' : 'property'}`) : null,
        a.baisses ? (fr ? `${a.baisses} en baisse` : `${a.baisses} price ${a.baisses > 1 ? 'drops' : 'drop'}`) : null,
      ].filter(Boolean).join(', ')
      return `${qui} · ${liste}`
    }
  }
}

/** Les intéressés qui attendent une visite, en une ligne : trois noms au plus. */
function ligneInteresses(m: BriefMatching, fr: boolean): string {
  const n = m.interesses.length
  const noms = m.interesses.slice(0, 3).join(', ') + (n > 3 ? '…' : '')
  const compte = sectionCount(n, m.interessesAtLimit)
  return fr
    ? `${compte} ${n > 1 ? 'acheteurs intéressés attendent' : 'acheteur intéressé attend'} une visite : ${noms}`
    : `${compte} interested ${n > 1 ? 'buyers are' : 'buyer is'} waiting for a viewing: ${noms}`
}

/**
 * Compose le brief du matin. Gras en Markdown
```

…le jour vide, le plafond des relances, et la section, entre les relances et les offres :

Dans `supabase/functions/_shared/morning-brief.ts`, remplacer :

```ts
  if (!visits.length && !events.length && !reminders.length && !offers.length && !sellerLeads.length) return null
```

par :

```ts
  const m = data.matching
  const sansMatching = !m || (m.total === 0 && m.interesses.length === 0)
  if (!visits.length && !events.length && !reminders.length && !offers.length && !sellerLeads.length && sansMatching) return null
```

Dans `supabase/functions/_shared/morning-brief.ts`, remplacer :

```ts
  if (reminders.length) {
    const atLimit = reminders.length >= SQL_LIMITS.reminders
```

par :

```ts
  if (reminders.length) {
    const atLimit = data.remindersAtLimit ?? reminders.length >= SQL_LIMITS.reminders
```

Dans `supabase/functions/_shared/morning-brief.ts`, remplacer :

```ts
  if (offers.length) {
    const atLimit = offers.length >= SQL_LIMITS.offers
```

par :

```ts
  // Lot D2 : le matching du jour, après les relances qu'il déduplique. Le total vient de la base : « …et N autres » est
  // exact, même au-delà des vingt actions lues.
  if (m && !sansMatching) {
    const lignes = m.actions.slice(0, CAPS.matching).map((a) => `- ${ligneMatching(a, fr)}`)
    const reste = m.total - Math.min(m.actions.length, CAPS.matching)
    if (reste > 0) lignes.push(fr ? `…et ${reste} ${reste > 1 ? 'autres' : 'autre'}` : `…and ${reste} more`)
    if (m.interesses.length) lignes.push(`- ${ligneInteresses(m, fr)}`)
    blocks.push([`**Matching (${sectionCount(m.total + m.interesses.length, m.interessesAtLimit)})**`, ...lignes].join('\n'))
  }

  if (offers.length) {
    const atLimit = offers.length >= SQL_LIMITS.offers
```

…et le détail :

Dans `supabase/functions/_shared/morning-brief.ts`, remplacer :

```ts
    nouveaux_leads_vendeurs: data.sellerLeads.map((l) => ({
      nom: l.contactName, ville: l.city, estimation: l.estimationMedian ? fmtCHF(l.estimationMedian) : null,
    })),
  }
}
```

par :

```ts
    nouveaux_leads_vendeurs: data.sellerLeads.map((l) => ({
      nom: l.contactName, ville: l.city, estimation: l.estimationMedian ? fmtCHF(l.estimationMedian) : null,
    })),
    // Lot D2 : toutes les actions lues (vingt au plus), écrites comme au matin ; `autres`, ce que la lecture a coupé.
    ...(data.matching ? {
      matching: {
        total: String(data.matching.total),
        actions: data.matching.actions.map((a) => ligneMatching(a, fr)),
        ...(data.matching.total > data.matching.actions.length ? { autres: data.matching.total - data.matching.actions.length } : {}),
        acheteurs_interesses_sans_visite: data.matching.interesses,
      },
    } : {}),
  }
}
```

- [ ] **Étape 3 : Dire à l'outil ce que le détail contient**

Dans `supabase/functions/_shared/whatsapp-tools.ts`, remplacer :

```ts
      description: "Point du jour : visites du jour de l'agent, relances dues, offres qui expirent, nouveaux leads vendeurs, leads à compléter. Pour « mon point du jour », « brief », « ma journée », « qu'est-ce que je fais aujourd'hui ? », « my daily brief ».",
```

par :

```ts
      description: "Point du jour : visites du jour de l'agent, relances dues, offres qui expirent, nouveaux leads vendeurs, actions de matching (retours à consigner, baisses de prix, nouveaux mandats, nouveaux biens, intéressés sans visite), leads à compléter. Pour « mon point du jour », « brief », « ma journée », « qu'est-ce que je fais aujourd'hui ? », « my daily brief ». Rends les lignes du matching telles quelles.",
```

- [ ] **Étape 4 : Vérifier**

```bash
npx vitest run supabase/functions/_shared/morning-brief.test.ts supabase/functions/_shared/morning-brief-data.test.ts
```

Attendu : PASS.

```bash
deno check --no-lock supabase/functions/whatsapp-morning-brief/index.ts supabase/functions/whatsapp-agent/index.ts supabase/functions/ai-copilot/index.ts
```

Attendu : Sortie 0.

---

## Tâche 13 : La garde « sans sortie » couvre le copilote

Rien de ce que le matching produit ne part vers l'acheteur (décision de Julien, 21.09.2026). La garde étend son périmètre aux deux modules du copilote et aux lignes de matching du point du matin, y interdit les chemins d'envoi côté serveur, et épingle la promesse de `schedule_visit` : la base pose `reminder_sent`.

**Fichiers :**
- Modifier : `tests/unit/matching-sans-sortie.spec.ts`

- [ ] **Étape 1 : Étendre la garde**

Dans `tests/unit/matching-sans-sortie.spec.ts`, le périmètre :

Dans `tests/unit/matching-sans-sortie.spec.ts`, remplacer :

```ts
  'src/components/crm/today/PageCatalogue.tsx',
  'src/components/crm/today/useFocusMatches.ts',
]
```

par :

```ts
  'src/components/crm/today/PageCatalogue.tsx',
  'src/components/crm/today/useFocusMatches.ts',
  // Lot D2 (24.09.2026) : le copilote WhatsApp du matching — ses règles pures et ses outils. Le point du matin écrit à
  // l'AGENT : seule sa section Matching est lue (SECTIONS).
  'supabase/functions/_shared/whatsapp-matching.ts',
  'supabase/functions/_shared/whatsapp-matching-outils.ts',
]
```

…les sections :

Dans `tests/unit/matching-sans-sortie.spec.ts`, remplacer :

```ts
  { fichier: 'src/components/crm/contacts-pager/ContactDetailPager.tsx', debut: 'function CdBienBoucle(' },
]
```

par :

```ts
  { fichier: 'src/components/crm/contacts-pager/ContactDetailPager.tsx', debut: 'function CdBienBoucle(' },
  // Lot D2 : les lignes de matching du point du matin (`_shared/morning-brief.ts`), dont le reste écrit à l'agent.
  { fichier: 'supabase/functions/_shared/morning-brief.ts', debut: 'function ligneMatching(' },
]
```

…les interdits :

Dans `tests/unit/matching-sans-sortie.spec.ts`, remplacer :

```ts
  [/\/dashboard\/messagerie\?ecrire/, 'composeur de la Messagerie sur l’acheteur'],
]
```

par :

```ts
  [/\/dashboard\/messagerie\?ecrire/, 'composeur de la Messagerie sur l’acheteur'],
  // Lot D2 : côté serveur, les chemins d'envoi du copilote — un message ou un modèle WhatsApp, un e-mail. Aucun n'a de
  // place dans le matching. (Les fonctions serveur, `send-visit-email` compris, sont gardées par le cas qui suit.)
  [/sendOutboundGuarded|buildTemplateMessage|sendRelanceEmail/, 'envoi WhatsApp, modèle ou e-mail depuis le matching'],
]
```

…et deux cas, avant « le copilote WhatsApp n’a plus d’outil pour envoyer des biens au client » :

Dans `tests/unit/matching-sans-sortie.spec.ts`, remplacer :

```ts
  it('le copilote WhatsApp n’a plus d’outil pour envoyer des biens au client', () => {
```

par :

```ts
  it('le copilote WhatsApp du matching n’appelle aucune fonction serveur', () => {
    // Côté Deno, la forme est `urlFonction(base, 'nom')` : le motif d'au-dessus, écrit pour le bundle, ne la voit pas.
    for (const f of ['supabase/functions/_shared/whatsapp-matching.ts', 'supabase/functions/_shared/whatsapp-matching-outils.ts']) {
      expect(readFileSync(join(R, f), 'utf8'), f).not.toMatch(/functions\.invoke|urlFonction\(/)
    }
  })

  it('⛔ une visite planifiée par le copilote ne prévient pas le client : la base pose `reminder_sent`', () => {
    // `visit-reminders-j1` écrit au client la veille de toute visite `planned` dont le rappel n'est pas parti.
    const nom = readdirSync(join(R, 'supabase/migrations')).find((n) => n.endsWith('_matching_whatsapp.sql'))
    expect(nom, 'migration du lot D2').toBeTruthy()
    const sql = readFileSync(join(R, 'supabase/migrations', nom!), 'utf8')
    const i = sql.indexOf('create or replace function public.wa_matching_visite(')
    const insert = sql.slice(sql.indexOf('insert into public.visits', i), sql.indexOf('returning id into v_visite', i))
    expect(insert).toMatch(/reminder_sent/)
    expect(insert.split('values')[1]).toMatch(/\btrue\b/)
    // Et le copilote n'insère plus de visite lui-même : sa seule écriture passe par cette fonction.
    expect(readFileSync(join(R, 'supabase/functions/_shared/whatsapp-actions.ts'), 'utf8')).not.toMatch(/from\('visits'\)\.insert/)
  })

  it('le copilote WhatsApp n’a plus d’outil pour envoyer des biens au client', () => {
```

```bash
npx vitest run tests/unit/matching-sans-sortie.spec.ts
```

Attendu : PASS.

- [ ] **Étape 2 : Prouver qu'elle rougit**

Dans `wa_matching_visite` (migration), passer le `true` de `reminder_sent` à `false` : la garde doit ÉCHOUER. Puis ajouter `sendOutboundGuarded` dans un commentaire de `whatsapp-matching-outils.ts` : ÉCHEC encore. Tout remettre, et vérifier qu'elle repasse.

- [ ] **Étape 3 : Vérifier**

```bash
npx vitest run tests/unit/matching-sans-sortie.spec.ts && npx eslint tests/unit/matching-sans-sortie.spec.ts --quiet
```

Attendu : PASS, sortie 0.

---

## Tâche 14 : vérification, docs, cerveau, feuille de route, commits

- [ ] **Étape 1 : les portes**

```bash
npx tsc -b && npx eslint src tests --quiet
bash -c 'for g in lint:prose lint:i18n lint:deadcode lint:deps lint:types-freshness lint:roster lint:edge-auth lint:email-shell lint:migrations lint:whatsapp-outbound lint:spec-sql i18n:parity:ci i18n:coverage:ci check:privileges; do printf "%-28s" "$g"; npm run --silent $g >/dev/null 2>&1 && echo "✓" || echo "✗"; done'
find supabase/functions -name '*.ts' ! -name '*.test.ts' ! -path '*/_shared/mail/*' ! -path '*/mail-*' -print0 | xargs -0 deno check --no-lock
```

Attendu : `tsc`, `eslint` et `deno check` à 0, « ✓ » partout. ⚠ Le `deno check` écarte la messagerie **sur cette machine seulement** : `_shared/mail/mime-parse.ts` importe `postal-mime`, absent du `node_modules` local (du dossier principal comme des worktrees), et le contrôle entier s'arrête sur cette erreur étrangère au lot. Mesuré au banc le 24.09.2026 : 212 fichiers hors messagerie, sortie 0. La CI, elle, contrôle tout. (`mapfile` n'existe pas dans le bash 3.2 de macOS, d'où `xargs -0`.) ⚠ `check:privileges`, `check:drift` et `lint:claude-md` ont besoin de `SUPABASE_ACCESS_TOKEN` : sans lui, ils ne mesurent qu'une partie et le DISENT — ne pas les compter verts pour autant. ⚠ `lint:whatsapp-outbound` fige les sites d'envoi WhatsApp : aucun ne doit apparaître.

- [ ] **Étape 2 : la suite unitaire, SEULE**

```bash
npx vitest run
```

Attendu : aucune régression. Trois échecs sont connus et hors sujet en local : `mail/imap`, `mail/mime-parse`, `safe-internal-path`. Tout autre rouge se rejoue d'abord seul.

- [ ] **Étape 3 : le build**

```bash
npm run build
```

Attendu : sortie 0.

- [ ] **Étape 4 : les docs**

- `docs/system-map.md`, section WhatsApp (§6bis) : **39 outils** (37 au 21.09.2026, plus `get_buyers_for_property` et `record_match_outcome`) ; `get_matches` rend les biens vivants, leur état et leur score expliqué ; `schedule_visit` accepte une annonce du marché, pose `visit_planned` et n'écrit plus au client la veille (`reminder_sent`). Le bullet du point du matin : ⛔ il disait « LIVRÉ — gated OFF » — il est **allumé depuis le 15.09.2026** (mesuré le 24.09.2026 : 10 points, dont 8 par le modèle, au seul numéro relié) ; il gagne la section Matching et son compte. §6 E (matching) : un paragraphe « Lot D2 (24.09.2026, sur branche, fusion à la fin) » — les trois fonctions signées MEGGA AI, `matching_actions_agence`, les quatre outils, la question [Oui] [Non] de `record_match_outcome` et pourquoi.
- `CLAUDE.md` §8, ligne « CRM agent », après la phrase du lot D1 : une phrase sur D2, sur branche.
- `docs/superpowers/feuille-de-route.md` : l'état de l'étape 4b.
- Cerveau : une entrée `megga/matching-whatsapp` dans `.claude-flow/knowledge/megga-memory.seed.json` (ce qui est fait ; les pièges : écrire par les fonctions de base et jamais par PostgREST, sinon le journal dit `system` ; le copilote ne choisit jamais entre plusieurs biens ; `reminder_sent` ; le modèle Meta gardé et son compte ; D2 ne part pas sans le lot E), puis `npm run ruflo:seed`.
- Le plan : ses « Écarts à l'exécution » et ses « En attente », comme pour D1.

```bash
npm run lint:prose && npm run lint:claude-md
```

- [ ] **Étape 5 : les commits, au signal de Julien**

Un commit par sujet, dans l'ordre des tâches, bâti depuis la photo de l'arbre prise à la fin de sa dernière tâche ; chacun doit compiler et passer ses specs SEUL (le vérifier dans un worktree jetable, `node_modules` lié) :

```
feat(matching): la base du copilote — actions d'une agence, réponses et visites signées MEGGA AI   (tâches 1-3)
feat(whatsapp): le modèle pur du matching, confronté au fil                                        (tâches 4-5)
feat(whatsapp): get_matches rend les biens vivants, leur état et leur score expliqué               (tâche 6)
feat(whatsapp): get_buyers_for_property, qui pour ce bien                                          (tâche 7)
feat(whatsapp): record_match_outcome consigne une réponse après le « oui » de l'agent              (tâche 8)
fix(whatsapp): schedule_visit pose visit_planned et n'écrit plus au client la veille               (tâche 9)
feat(whatsapp): la garde des confirmations simulées connaît la consignation                         (tâche 10)
feat(whatsapp): le point du matin parle du matching                                                 (tâches 11-12)
test(matching): la garde « sans sortie » couvre le copilote                                          (tâche 13)
docs(matching): le lot D2 — conception, plan, carte et cerveau                                      (tâche 14, + la conception et la feuille de route)
```

---

## Décisions prises (rappel)

1. **Le modèle Meta approuvé est gardé** ; le matching entre dans le détail et dans le point en texte libre (Julien, 24.09.2026).
2. **Le compte du modèle inclut le matching** : le modèle part aussi un jour de matching seul.
3. **`get_matches` entre dans D2**, avec l'état et l'explication.
4. **`record_match_outcome` demande Oui / Non avant d'écrire** — écart assumé au §5.1 de la conception de la boucle.
5. **« Pas encore » est une réponse** de `record_match_outcome`.
6. **La base porte les règles** : trois fonctions signées MEGGA AI, une lecture d'agence partagée avec « Aujourd'hui ».

## En attente (hors périmètre — rien n'est fait sans accord de Julien)

- Les anciens prospects par WhatsApp.
- Les actions de matching par agent plutôt que par agence (« Aujourd'hui » comme le point du matin).
- Les intéressés qui attendent une visite dans « Aujourd'hui ».
- Les relances « acheteur chaud » d'`automation-engine` (`follow_up_sent_property` sans match), libellées « Retour sur un bien proposé ».
- `prepare_meeting` lit encore les cinq meilleurs matchs sans filtre de statut (un refusé peut y revenir).
- `execCreateDeal` journalise `kyc_case_opened` en ouvrant un deal.
- L'interrupteur du point du matin par agent (`set_morning_brief_enabled`) n'a pas d'écran.
- Le corps anglais du modèle écrit « my daily brief » quand son commentaire dit la commande française dans toutes les langues.
- Un nouveau modèle Meta qui nommerait le matching (décision 1) : à reconsidérer une fois le point enrichi en service.
- Sur la fiche d'un mandat, « Qui pour ce bien ? » écarte les acheteurs déjà en deal sur ce bien ; `get_buyers_for_property` les garde.

**Relevé à l'exécution (24 au 27.09.2026)** — non fait, hors périmètre ou à relire. Les mesures de production ont été faites en lecture seule, le 25.09.2026.

*Avant la fusion — à dire à Julien*
- ⛔ **D2 ne part pas sans le lot E** : il fusionne avec toute la pile, à la fin, sur `megga/matching-lot-d1` dont il réécrit la fonction (D1 ne part pas sans le lot E).
- **La migration `20260924200000_matching_whatsapp.sql` s'applique à la main AVANT la fusion**, avec l'accord de Julien, après celle de D1 ; au redatage, un suffixe POSTÉRIEUR à `…190000_matching_surfaces` (elle réécrit `matching_actions_du_jour` et lit les colonnes du lot B : `prix_propose`, `match_ids`, `sent_via = 'agent'`).
- ⛔ **La SQL du lot n'a JAMAIS tourné** (le port 54321 est pris sur cette machine) : les specs de la base W1 à W6 (`tests/backend/matching-whatsapp.spec.ts`) et les deux réparées (`whatsapp-matches-enrich`, `whatsapp-antifab`) se jouent contre une base locale (`npm run test:backend`) AVANT d'appliquer la migration, puis se voient vertes dans la CI de la PR (`backend.yml` ne tourne que sur une PR ou un push vers `main`). W6 est la seule preuve que le filtre `.or(…)` des relances est valide : une faute y rendrait une erreur 400, donc plus AUCUN point du matin.
- **Un EXPLAIN des deux désignations** sur la même base locale : pour `wa_matching_biens_designes` (§5 de la migration), la branche `suggested` sur `idx_matches_agency_focus` et la branche `in (…)` sur `idx_matches_boucle`, plutôt qu'un balayage de `matches` ; pour `wa_matching_biens_de_l_acheteur` (§6), une lecture menée par `contact_id`. Attendu, non vérifié.
- **Remesurer les relances « orphelines »** — ouvertes, échues, dont aucun match n'est plus `sent` — APRÈS l'application de la pile : le filtre des relances les sort de « À relancer » sans que la section Matching les porte ; les clore si besoin. Mesuré le 25.09.2026 : `reminders.match_ids` n'existe pas encore en production (la migration du lot B n'y est pas appliquée), 1 relance de proposition ouverte, aucune orpheline.
- **Remesurer la garde du profil** (`ok: false` quand le profil de l'agent n'est pas de l'agence passée) : le 25.09.2026, 1 lien vérifié, de la même agence que son profil, et 1 lien non vérifié, sans agence — la garde ne casse rien aujourd'hui, mais un tel écart a déjà existé (migration `20260817145711`).
- **La section Matching du point du matin est à l'échelle de l'AGENCE**, comme « Aujourd'hui » (décidé par la conception) : chaque agent y lit les acheteurs de ses collègues, alors que ses visites sont filtrées par agent. Le « par agent » est en attente, ci-dessus.

*Les outils*
- Désigner un bien par la RÉFÉRENCE du CRM (`MG-IN-…`, `MG-FL-…`, `MG-MK-…`), et l'ajouter aux libellés qui se confondent : la seule façon de départager les 410 annonces sur 1 800 suivies par l'agence WhatsApp (23 %) qui partagent leur libellé avec une autre. Le NPA (« 1206 ») n'est cherché nulle part (antérieur au lot). À proposer à Julien.
- `get_buyers_for_property` garde « précise l'adresse » sur un écho coupé (outil de lecture, rappelable par l'identifiant de `get_matches`), là où `record_match_outcome` renvoie au CRM.
- La garde d'écho de `candidats` ne voit que les biens de la lecture en cours (risque nul au 25.09.2026 : aucune annonce suivie n'a de « · » dans son titre).
- `wa_matching_consigner` rend `ok: false` sans raison pour un profil hors de l'agence : le copilote répond « ce bien n'est plus dans la boucle de ton agence ».
- La règle `occasion` des mandats (actif seul) : `get_matches` ne propose qu'un mandat `active` ; `record_match_outcome` et le fil gardent tous les mandats. À trancher avec la décision 12 du lot D1 avant de la généraliser.
- `create_reminder` lit une heure sans décalage comme de l'UTC (`new Date(when)`, antérieur au lot) : partager `debutDe` réglerait tous les outils datés.
- La branche `schedule_visit` de `rollbackAutoAction` (`whatsapp-webhook`) n'a aucun test : la fonction n'est pas exportée.
- Une heure DOUBLÉE (bascule d'automne) écrite avec un décalage genevois explicite se lit comme sa seconde occurrence : une nuit par an, entre 02:00 et 02:59.
- Les codes de connexion (SQLSTATE 08xxx, `PGRST000` à `PGRST002`) sont classés « rien n'a été écrit », alors que l'issue est inconnue.
- Annuler la visite d'un MANDAT ne laisse rien sur la fiche du contact (l'audit de l'annulation porte l'entité `visit`) : un `visit_cancelled` demanderait une action et ses libellés en quatre langues.

*La garde des confirmations simulées* — heuristique : chaque passe de relecture y a ouvert un bord nouveau, jusqu'à la quatrième, approuvée avec ses mineurs (9 mutations sur 49 y survivent, jugées acceptables) ; son coût d'erreur est borné (un faux positif coûte une relance du modèle ; un faux négatif laisse passer ce qui passait déjà). Restent :
- la normalisation NFC du participe « consigné », sans test (un témoin en forme décomposée) ;
- des faux positifs acceptés et figés : le participe dans une question de clarification, « acompte consigné chez le notaire » ;
- « Dis-moi quand tu le lui as présenté, je le consigne. » est pris (coût accepté) ;
- une offre exempte sa phrase entière (règle antérieure au lot) ;
- le futur simple « Je consignerai » n'est pas pris ; « close to record levels… Confirm? » serait pris (rare).

*Le point du matin*
- `now` est figé avant la boucle des agents (60 s), la base lit `now()` : une relance échue entre les deux instants peut compter deux fois, ou pas du tout (faible).
- Un mandat supprimé reste compté parmi les intéressés (la RLS l'écarte d'« À conclure ») : l'exclure demande un embarquement `properties` facultatif filtré, à vérifier contre un vrai PostgREST.
- ⚠ CI (W6) : le delta avant/après de `loadAgencyData` peut être faussé si l'agence A des fixtures accumule plus d'environ 17 relances dues (la lecture en garde 20).

*La base*
- Sous le rôle de service, `matching_actions_agence` s'ancre sur `p_agency`, mais trois jointures ne tiennent que par la cohérence des références : `reminders.match_ids` (un `uuid[]` sans clé étrangère), `matches.property_id` et `contacts`. Inexploitable sans connaître les UUID d'une autre agence ; un ancrage des trois — dans D1 et D2 ensemble, leurs corps étant identiques — le fermerait. Décision de Julien ; le commentaire est dans la migration.
- Le verrou consultatif `wa_matching_acheteur:` ne sérialise que les appels du copilote : le fil (`rattacherDeal`) ne le prend pas, et la course à deux deals reste ouverte entre le fil et WhatsApp.

*Hérités du fil, recopiés tels quels*
- `execPasEncore` (`useAtelierMatching.ts`) journalise `relance_id: null` quand il CRÉE la relance ; `wa_matching_consigner` journalise la vraie.
- L'élision : « Retour de {prénom} » (« de Emma ») pour « Proposé », « Retour : » pour « Pas encore » (relevé au lot B).
- Un prix 7 % au-dessus du budget sort `tenu: true, ecart: null` (règle de `lignesCriteres`) ; un état déduit (« neuf ») perd sa source, l'année de construction.

*Les gardes*
- `matching-sans-sortie.spec.ts` ne lit pas les branches du WEBHOOK : `record_match_outcome` après le « oui », l'annulation de `schedule_visit` (la 27ᵉ mutation de sa relecture passe).

---

## Écarts à l'exécution (27.09.2026) — le code du dépôt fait foi

Les tâches ont été exécutées par sous-agents à partir du 24.09.2026 : chacune suivie d'une relecture de conformité puis d'une de qualité, reprises jusqu'à ce que les deux passent — jusqu'à quatre passes de qualité (tâches 8 et 10). La 14 : `deno check`, la suite unitaire et le build joués le 27.09.2026, docs relues, commits au signal de Julien.

⛔ **Les blocs de code des tâches ci-dessus décrivent l'état AVANT les relectures, et ne sont pas réécrits : les commits font foi.** Le plan a été rejoué depuis son texte le 24.09.2026, à l'arbre près ; rejoué aujourd'hui, il réintroduirait les défauts que les relectures ont corrigés — un échantillon de 1 000 matchs pour désigner un bien, une heure lue en UTC, deux specs backend rouges à la fusion, entre autres. Ces lignes disent où le dépôt s'en écarte, et pourquoi.

- ⚠ **La migration porte SIX noms neufs**, pas trois (en-tête du plan) ni quatre (« Pile ») : `matching_actions_agence`, les trois fonctions d'écriture, et deux lectures nées à l'exécution, `wa_matching_biens_designes` (tâche 7) et `wa_matching_biens_de_l_acheteur` (tâche 8) ; plus deux redéfinitions, `matching_actions_du_jour` (l'enveloppe) et `calendar_events_journaliser` (tâche 3). `src/types/database.ts` porte les six.
- **Tâche 1** — W1 éprouve le cloisonnement SOUS LE RÔLE DE SERVICE (un retour dû chez l'agence B : absent de la lecture de A, seul dans celle de B, rien pour une agence nulle), et `actionsAgence` lève sur une erreur ; la spec statique compare les en-têtes à partir de `returns` ; `mkAnnonce` dérive ses trois prix, comme D1 ; la migration dit que trois jointures ne tiennent sous ce rôle que par la cohérence des références (en attente, « La base »). Corps SQL inchangé.
- **Tâche 2** — les relances et le journal désignent le bien par la RÉFÉRENCE du fil (`MG-IN-…`, `MG-FL-…`, `MG-MK-…` ; `bien_refs`, `bien_ref`), avec les phrases de relance du fil ; le journal de « pas encore » porte la vraie relance (le fil écrit `null`) ; le mandat d'un match et le profil sont ancrés sur l'agence (`ok: false`) ; un **verrou consultatif** `wa_matching_acheteur:<contact>`, pris après le verrou du match, remplace le `for update` sur l'acheteur, qui ouvrait deux cycles d'interblocage (les clés étrangères d'une relance posée par le fil ; `capture_transaction_lifecycle` puis `bump_contact_last_interaction`) ; `statut` rendu seulement avec `deja` ; la note rognée comme le `.trim()` du fil (`btrim(p_note, E' \t\r\n')`). Spec statique : motifs et références confrontés au fil par import, garde du mandat et verrou figés. W2 : le deal réutilisé et son mandat, les refus (réponse inconnue, motif hors liste, acheteur, profil ou mandat hors de l'agence), `relance_id`, `response_at`.
- **Tâche 3** — ⛔ **Défaut de conception** : sur une ANNONCE, la visite du copilote n'écrit qu'un `calendar_events`, dont le journal (`calendar_events_journaliser`, 15.09.2026) ne lisait que `auth.uid()` : `system` sous le rôle de service, sur le chemin de 1 818 des 1 828 matchs de la production (24.09.2026). La migration la REDÉFINIT au modèle de `log_match_reaction`, inchangée pour le CRM ; sa spec la confronte au 15.09 et à `log_match_reaction`, et garde sa dernière redéfinition à venir. Et : le profil de l'agence (`raison: 'profil'`) ; le même verrou consultatif, après le `for update` du match et avant le deal ; le journal `visit_scheduled` aligné sur le fil (« nom · titre » et `bien_ref`), au lieu du libellé de l'ancien copilote (« titre — date ») que reprenait le plan ; `match_id` rendu seulement si le match a bougé ; le lieu d'un événement « adresse, ville », comme `FilConclure`. W3 : un deal déjà à l'offre ne recule pas, annonce et intéressé sans deal, annulation par `evenement_id` journalisée `ai`, visite sans match, raison « bien », garde du profil de l'annulation.
- **Tâche 4** — `VisitePlanifiee.raison` gagne `'profil'` ; ⚠ **`get_matches` ne propose un MANDAT que s'il est `active`** (`occasion`, distincte de l'étiquette `retire` : annonce `removed`, mandat `sold` ou `archived`) — la règle du point du matin, appliquée à cet outil et à faire confirmer par Julien (décision 12 du lot D1, en attente) ; `occasion: false` et le statut du mandat sont rendus au modèle. Aussi : l'adresse dans `bienEnClair`, une note au modèle partagée (le score est une estimation, `tenu: null` n'est pas évalué), l'ordre du fil (`created_at`), les reportés « N+ », « /mois », le préfixe `custom:` retiré. ⚠ Les tâches 7 et 8 ont réécrit ici `candidats`, `motsDe`, `libelleBien`, `titreAffiche`, `jetonsFins` et `LIMITE_ECHO` : le texte de la tâche 4 n'est plus leur code.
- **Tâche 5** — `created_at: null` dans le littéral `wa.LigneMatch` (une erreur de type qu'aucun outil ne voyait : `tests/unit` est hors de `tsc -b`) ; la forme du bien confrontée champ par champ à `versBien` et `versBienMarche` de production (`useMatchingFil.ts` exporte `versBien` et le type `LigneBien`), charge utile complète, bornes, entrées mélangées ; l'ordre « à proposer » confronté à `construireFil`. La spec a été réécrite deux fois : des mutations de la copie passaient sans la faire rougir.
- **Tâche 6** — ⛔ **Défaut du plan** : `tests/backend/whatsapp-matches-enrich.spec.ts` importait l'ancien `execGetMatches`, retiré de `whatsapp-actions.ts` — rouge en CI à la fusion. Réparée sur le contrat de D2 (E1 : id et titre, prix calculé ; E2 : un bien non résolu absent ; le mandat du jeu d'essai `active`). Et : les lectures triées comme le fil (score, `created_at`, id) ; quatre lectures bornées à leur limite plus une (`aLaLimite`, jamais `longueur >= limite`) puis dédoublonnées — intéressés et visites, proposés, à proposer, revenus (lus à part : un bien revenu garde le `created_at` de sa proposition d'origine) ; `en_cours` « N+ » ; `contactDeLAgence` à trois issues (un identifiant mal formé, une panne de lecture, une absence) ; les mandats supprimés écartés à la lecture ; la description web de `get_matches` DÉRIVÉE de celle de WhatsApp, sans exception au chargement (elle ferait tomber tout le copilote web) ; le faux client trie comme PostgreSQL.
- **Tâche 7** — ⛔ **Défaut du plan, critique** : `designerBien` lisait 500 mandats, puis 1 000 matchs compatibles, pour chercher le texte en TypeScript — un ÉCHANTILLON (PostgREST plafonne à 1 000 lignes ; l'agence WhatsApp portait 1 828 matchs le 24.09.2026) —, et « le mandat d'abord » choisissait à la place de l'agent. La désignation passe EN BASE : `wa_matching_biens_designes`, section 5 de la migration (mandats et annonces suivies ENSEMBLE, `lower(unaccent(x))`, rôle de service seul), lue à 50 + 1 lignes et affinée par `candidats` ; une lecture coupée demande toujours ; les fiches de TOUS les compatibles sont lues (deux lots de 100), et une ligne sans fiche est écartée avant de compter ; « 5 sur N » ; le faux client projette le `select`. W4. La tâche a aussi balayé les commentaires « histoire du chantier » de tout le lot.
- **Tâche 8** — ⛔ **Défaut mesuré** : le bien se cherchait dans les 100 premiers matchs de l'acheteur, or 3 acheteurs de l'agence WhatsApp en ont plus de 100 `suggested`, jusqu'à 1 142 (25.09.2026) — « proposé » ratait le bien nommé. D'où trois chemins : un identifiant revérifié exactement (`matchsParIds`), des mots désignés EN BASE parmi les seuls biens de l'acheteur (`wa_matching_biens_de_l_acheteur`, section 6 neuve, plafond de 201 : les 200 biens d'un écho relu et la ligne qui dit la coupe), sinon la page de ses matchs (100 + 1). ⛔ **La règle « un nombre ne se compare qu'à l'adresse »** (tâches 4 et 7) cassait la désignation par titre : 1 184 des 1 806 biens désignables de l'agence WhatsApp ont un chiffre dans leur titre, et 22 seulement s'y retrouvaient (25.09.2026) ; un nombre se compare désormais en mot entier, où qu'il soit, et un palier « nombre dans l'adresse d'abord », essayé, est abandonné (il rendait seul un leurre). L'égalité exacte au LIBELLÉ ne joue que pour un écho qui porte « · » (sans lui, « studio rue du Lac 2 » choisissait entre deux studios). Les refus sont des PHRASES sans identifiant — ils partent tels quels à l'agent au second refus —, et nomment les biens par leur libellé (« titre · adresse », sinon la ville), comme la question [Oui] [Non] ; « (n sur plus de P) » pour une page coupée ; `consignationChangee` sépare « a changé » de « déjà consignée » ; une annonce retirée ne se « propose » pas ; la note tient en 300 points de code (sans couper un émoji). `contactDeLAgence` à trois issues : le plan testait `if (!contact)`.
- **Tâche 9** — ⛔ **Défaut du plan** : `tests/backend/whatsapp-antifab.spec.ts:28` figeait `required` avec `property_id` — rouge en CI, l'outil acceptant désormais une annonce ; réparée (`required` sans `property_id`, et les deux propriétés). ⛔ **L'heure** : `new Date(when)` dans une Edge Function en UTC planifiait « 14:00 » à 16:00 l'été, sur un outil automatique. `debutDe` : ISO strict ; sans décalage, l'heure de Genève ; `+01:00` et `+02:00` lus comme l'heure murale de Genève, recalculée pour la saison de la date ; tout autre décalage tel quel ; une date impossible, une heure sautée et une date passée de plus d'une heure refusées. L'exemple du schéma porte un décalage ; le prompt système n'est pas touché. Et : le contact à trois issues ; la raison « profil » ; une annonce retirée et une visio sur une annonce SIGNALÉES, jamais refusées ; aucune fuite du message d'erreur de la base ; « non confirmé » sur une panne sans code Postgres, étendu à `executeRecordMatchOutcome` ; `frDateTime` importé ; l'audit de l'annulation garde l'entité `visit` ; la durée bornée de 5 à 480 minutes, 45 par défaut, lue aussi dans une chaîne de chiffres (« 60 »), jamais dans « 0x10 » ni « 1e2 », et affichée dans le compte rendu ; l'exception au garde-fou de `update_pipeline` écrite dans le routeur ; `docs/whatsapp-templates-catalogue.md` à jour ; les tests à horloge figée (écrits à date fixe, ils rougissaient dès le 29.09.2026).
- **Tâche 10** — « Je note que » devient « **Je consigne que** » dans les questions de « proposé » et de « pas encore » (`whatsapp-i18n.ts`, tâche 8) : sans mot d'action, leur imitation privée du suffixe « (« oui » / « non ») » passait la garde. `CONSIGNE_ECHO` reconnaît la FORME exacte des quatre comptes rendus (un préfixe « ✅ Consigné » prenait aussi un relais d'`add_note`) ; `record` n'est pris que comme VERBE ; les temps en français et en anglais ; une offre est une demande d'INFORMATION avant « et je … », jamais une demande d'accord ni un délai — la première correction exemptait « dis-moi… », la forme même de l'incident d'origine ; le participe « consigné » se relit sur le texte BRUT (normalisé, il devient le nom « consigne », qu'elle écarte).
- **Tâches 11 et 12** — ⛔ **Défaut de conception** : la déduplication des relances se faisait APRÈS les coupes, à partir des actions lues — famine (vingt retours lus, « À relancer » vide) et double compte (un retour au-delà du rang des actions lues restait dans « À relancer »). Elle se fait DANS la requête des relances, par la définition du retour de la section 1 de la migration (`.or(…)`, `match_ids` vide compris) ; l'embarquement du contact est SIMPLE sur les relances (une relance sans acheteur reste, sans nom), `!inner` sur les intéressés ; la copie `lireMatching` alignée sur `versAction` (le plan oubliait `contact_id`, `match_id` et `property_id`) et confrontée à lui ; les intéressés dédoublonnés par contact, jamais par nom ; W6, `loadAgencyData` contre une vraie base. Tâche 12 : un loyer porte « / mois » (la colonne `location` n'était jamais lue) ; `ecrire` déplacée de `HlMatching.tsx` vers `matchingDuJour.ts`, sans changement de rendu, pour être confrontée ; le pluriel d'`Intl.PluralRules` (« 0 properties » en anglais) ; le `total` du détail égal à l'en-tête ; « …et N autres actions » ; une majuscule au nom qui ouvre une ligne du marché ; jamais un montant nul.
- **Tâche 13** — la garde lit les imports des deux modules contre une liste NOMMÉE (une liste d'interdits ne connaît que les envois d'hier), refuse `fetch(` et `import(`, un `insert` ou un `upsert` dans `visits` depuis les deux modules et `whatsapp-actions.ts`, lit `reminder_sent` par sa POSITION dans l'`insert`, et couvre quatre sections du point du matin (dont le bloc de `composeMorningBrief` et l'objet de `composeBriefDetail`). 26 des 27 mutations de sa relecture rougissent ; la 27ᵉ, une branche du webhook, est en attente.
- **Tâche 14** — le 27.09.2026 : `tsc -b` et `eslint src tests` à 0 ; treize portes sur quatorze vertes (`lint:prose`, `lint:i18n`, `lint:deadcode`, `lint:deps`, `lint:types-freshness`, `lint:roster`, `lint:edge-auth`, `lint:email-shell`, `lint:migrations`, `lint:whatsapp-outbound`, `lint:spec-sql`, `i18n:parity:ci`, `i18n:coverage:ci`), la quatorzième, `check:privileges`, non mesurée faute de `SUPABASE_ACCESS_TOKEN` (elle interroge la production) ; `deno check` à 0 sur les 212 fichiers hors messagerie ; la suite unitaire jouée seule, 5 158 tests réussis, 3 ignorés, 1 échec, les fichiers en échec étant les trois connus et hors sujet (`mail/imap`, `mail/mime-parse`, `safe-internal-path`) ; le build (`tsc -b` puis Vite) à 0 ; `lint:claude-md` : 24 prétentions mesurées, aucun écart (17 de base non mesurées, faute de jeton). Specs de la base NON jouées.
- ⚠ **Les commits** (étape 5 de la tâche 14) — une photo de fin de tâche emporte ce que ses relectures ont changé ailleurs : celle de la tâche 7 touche la migration (§5) et les commentaires balayés des tâches 1 à 6 ; celle de la 8, `whatsapp-matching.ts` (tâche 4), la migration (§5 en sur-ensemble, §6 neuve, plafond de 201, en-tête « six noms neufs ») et `src/types/database.ts` ; celle de la 9, `executeRecordMatchOutcome` (« non confirmée »), `whatsapp-i18n.ts`, le routeur, `docs/whatsapp-templates-catalogue.md` et `tests/backend/whatsapp-antifab.spec.ts` ; celle de la 10, `whatsapp-i18n.ts` (« Je consigne que ») et `whatsapp-matching-outils.test.ts` ; celle des 11-12, `HlMatching.tsx` et `matchingDuJour.ts` (`ecrire`, rendu inchangé), `tests/unit/whatsapp-matching-fil.spec.ts` et W6. Le dire dans leurs messages, ou bâtir les commits antérieurs avec ces versions — à décider au signal de Julien, arbres vérifiés. `eslint` rougit sur `tests/backend/matching-whatsapp.spec.ts` entre les tâches 1 et 3 (fixtures lues par W2 et W3) : le premier commit groupe les tâches 1 à 3.
