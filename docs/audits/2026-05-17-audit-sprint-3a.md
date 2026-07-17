# AUDIT_SPRINT_3A.md

> Audit technique post-implémentation — conformité (nLPD/LBA/sécu) + fonctionnel.
> Posture : auditer **mon propre travail** comme s'il venait d'un dev tiers, avec la même exigence que `RED_TEAM_SPRINT_3.md`. Aucun bénéfice du doute.
> Périmètre : tout ce qui a été ajouté/modifié pour Sprint 3a (Import Lead IA + C2PA cleanup).

**Légende**
- `BLOQUANT` : empêche le ship — à fixer avant merge
- `MAJEUR` : ship possible mais dégrade UX / sécu / data
- `MINEUR` : à fixer dans la foulée ou backlog post-merge

---

## TL;DR — Ce qui doit changer avant merge

| # | Sujet | Sévérité | Effort |
|---|---|---|---|
| **1** | Stage du deal en kebab-case au lieu de snake_case → insert PostgreSQL échoue | BLOQUANT | 5 min |
| **2** | Audit event unique pour contact+deal → traçabilité deal absente | MAJEUR | 15 min |
| **3** | Pas d'idempotence sur `handleCreate` → double-clic crée 2 contacts | MAJEUR | 10 min |
| **4** | Audit insert fire-and-forget sans retry → perte d'event possible (nLPD 10 ans) | MAJEUR | 30 min |
| **5** | CORS `*` sur Edge Function → POST cross-origin possible | MAJEUR | 5 min |
| **6** | Phone stocké brut, comparé normalisé → dédup future ratée sur le contact créé | MAJEUR | 15 min |
| **7** | Truncation à 8 KB silencieuse côté UI (Edge le signale mais l'UI ne l'affiche pas) | MINEUR | 5 min |
| **8** | Esc ferme sans confirmer la perte du texte saisi | MINEUR | 10 min |

Total des correctifs avant merge propre : **~1h30**.

---

## A. Conformité

### A.1 — `BLOQUANT` — Stage de Deal : hyphen au lieu de underscore

[useImportLead.ts:36-38](src/hooks/useImportLead.ts:36)
```ts
if (urgency === 'high') return 'to-qualify'   // ❌
if (intent === 'seller') return 'new-lead'    // ❌
return 'new-lead'                              // ❌
```

Le reste du repo utilise le format underscore : [useSellerLeads.ts:107](src/hooks/useSellerLeads.ts:107) `stage: 'new_lead'`, [NewTransactionDialog.tsx:62](src/components/transactions/NewTransactionDialog.tsx:62) idem.

La contrainte SQL `transactions_stage_check` ([20260319_001_enriched_crm_tables.sql:205](supabase/migrations/20260319_001_enriched_crm_tables.sql:205)) attend `'new_lead'` / `'to_qualify'` — l'INSERT côté `useImportLead` produira une erreur `check_violation` à chaque création de deal.

**Fix** : remplacer les 3 occurrences par les valeurs underscore. 5 min.

*Note pré-existante* (hors scope Sprint 3a, à signaler) : le type ENUM `transaction_stage` ([002_core_tables.sql:13](supabase/migrations/002_core_tables.sql:13)) n'a jamais été étendu et reste sur les 10 valeurs originales (`lead, qualified, visit_planned, ...`). Le CHECK 20260319 ajoute des valeurs (`new_lead, to_qualify, ...`) que l'ENUM rejette. Soit la prod a été migrée hors-band, soit tous les inserts neufs cassent. **À investiguer séparément**.

### A.2 — `MAJEUR` — Audit event manquant pour le Deal créé

[useImportLead.ts:113-135](src/hooks/useImportLead.ts:113) émet **un seul** event :
```ts
{ action: 'Lead validé & créé', entity_type: 'contact', entity_id: contact.id, ... }
```

Le deal est mentionné via `metadata.deal_id` mais n'a pas son propre event `entity_type: 'transaction'`. Conséquences :
- Le journal d'audit filtré sur `entity_type='transaction' AND entity_id=<dealId>` ne montre pas la création du deal
- Si nLPD/LBA audit demande "qui a créé ce deal #X" → trou
- Inconsistant avec [`auto_verify_kyc_dossier`](supabase/migrations/20260516_002_sprint1_kyc_lba.sql:118) qui émet 1 event par étape

**Fix** : émettre 2 events séquentiels (contact + deal) avec metadata partagée. 15 min.

### A.3 — `MAJEUR` — Audit insert fire-and-forget = risque de perte

[useImportLead.ts:115-138](src/hooks/useImportLead.ts:115) et [useImportLead.ts:151](src/hooks/useImportLead.ts:151) appellent `.insert(...).then(...)` sans await et ne loggent qu'un `console.error` en cas d'échec.

Idem dans [extract-lead/index.ts:178-193](supabase/functions/extract-lead/index.ts:178) (fonction `logExtraction`).

Si RLS, timeout réseau, ou panne Supabase → l'event est perdu. **nLPD art. 12 / LBA art. 7** exigent une rétention 10 ans appliquée à TOUS les events métier (lead importé en fait partie).

**Fix** : (a) `await` l'insert dans `useImportLead` (pas critique UX, ça prend 50ms), (b) côté Edge Function, en cas d'échec d'insert, écrire dans une table `audit_dead_letter` ou retry via `pg_cron`. 30 min.

### A.4 — `MAJEUR` — CORS `*` sur Edge Function

[extract-lead/index.ts:25-28](supabase/functions/extract-lead/index.ts:25)
```ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  ...
}
```

Cohérent avec les autres Edge Functions du repo, mais Sprint 3 augmente la sensibilité : un site malveillant pourrait POSTer côté navigateur (auth JWT volé via XSS = cookie/storage de la victime) et provoquer extraction LLM coûteuse + pollution audit.

**Fix** : restreindre à `https://megga.ch` + `https://*.megga.ch` (preview Cloudflare Pages). 5 min. *Note : c'est un rétrofit à faire sur toutes les Edge Functions à terme — sortir le pattern dans `_shared/cors.ts`*.

### A.5 — `MAJEUR` — Pas de rate limit (red-team A5 toujours ouvert)

Le red-team prévoyait un garde-fou `> N appels/h/agent → critical alert`. Pas implémenté. Un agent compromis ou un bug front en boucle pourrait facturer des centaines de dollars de tokens Claude en quelques minutes.

**Fix** : (a) vue matérialisée `ai_usage_per_agent_hourly` (cf. red-team G10), (b) dans `extract-lead`, query la vue avant chaque appel, refuse si > 50/h. 2h. Reporté Sprint 3b acceptable si **monitoring manuel** mis en place côté `ai_usage_logs` entre-temps.

### A.6 — `MINEUR` — Truncation silencieuse côté UI

[extract-lead/index.ts:229](supabase/functions/extract-lead/index.ts:229) retourne `truncated: true` quand `text > 8KB` mais l'UI [ImportLeadSugarV3Page.tsx](src/pages/agent/ImportLeadSugarV3Page.tsx) ne l'affiche pas. L'agent croit que tout son texte a été analysé.

**Fix** : afficher un bandeau "Message tronqué à 8 KB pour l'analyse" si `extractMutation.data?.truncated`. 5 min.

### A.7 — `MINEUR` — Rétention rawText non implémentée

Le red-team A2 demandait : (a) `rawText` stocké séparément sur le Contact, (b) job pg_cron quotidien qui purge à 90j. Sprint 3a ne stocke **pas** le rawText du tout — l'agent perd la trace de la source dès qu'il ferme le wizard. Tradeoff acceptable pour MVP mais à documenter dans la roadmap.

**Décision suggérée** : ajouter une colonne `contacts.import_raw_text TEXT` + job purge dans une migration Sprint 3a.1 (1h). Sinon arbitrer avec Grégory si la trace doit vraiment exister.

### A.8 — `MINEUR` — `actor_kind` non rétrofité sur les call sites existants

Migration G2 ajoute `actor_kind` avec `DEFAULT 'user'`. Les inserts existants (ex. `ai-copilot/index.ts:48` `actor_id: 'ai'`) continuent de violer la FK et tombent en `'user'` par défaut. La discriminator IA est perdue pour ces events.

**Fix** : rétrofiter les Edge Functions IA (ai-copilot, ai-search, parse-search-query, photo-labeler, support-chatbot, ticket-ai-reply, extract-property-pdf/url) pour utiliser `actor_id: null, actor_kind: 'ai'`. ~30 min × 7 = ~3h. Reporté Sprint 3a.1.

---

## B. Fonctionnel

### B.1 — `MAJEUR` — Pas d'idempotence sur création (double-clic)

[ImportLeadSugarV3Page.tsx:80](src/pages/agent/ImportLeadSugarV3Page.tsx:80) — `handleCreate` est attaché au CTA sans guard. Si l'agent double-clique pendant que `importMutation.isPending`, le bouton se désactive (via `disabled` au render) mais l'async gap entre setState et re-render peut laisser passer 2 mutations.

Pire : React Query ne déduplique pas par défaut les mutations.

**Fix** : `if (importMutation.isPending) return` en début de handler, OU utiliser une `useRef` pour bloquer le double appel. 10 min.

### B.2 — `MAJEUR` — Dédup query court-circuitable

[ImportLeadSugarV3Page.tsx:64-69](src/pages/agent/ImportLeadSugarV3Page.tsx:64) — `useFindContactDuplicates` est appelé en arrière-plan mais [handleCreate](src/pages/agent/ImportLeadSugarV3Page.tsx:80) ne vérifie pas `dedup.data`. Donc :
- Agent colle un message
- IA extrait `marie.bertrand@bluewin.ch` (qui existe déjà)
- Dédup query part en async
- Agent clique "Créer" avant que la dédup réponde
- Bannière dédup ne s'affiche pas (encore loading), contact créé en doublon

**Fix** : (a) bloquer le CTA tant que `dedup.isLoading`, OU (b) afficher la bannière dès `dedup.isFetching` (skeleton), OU (c) re-vérifier sync côté serveur via une RPC `assert_no_duplicate(email, phone)` qui lève si match. 30 min option (a)+(b), 1h option (c).

### B.3 — `MAJEUR` — Phone stocké brut, comparé normalisé

[useImportLead.ts:65](src/hooks/useImportLead.ts:65) `phone: extracted.phone || null` → stocke `'+41 79 555 12 34'` tel quel.

[20260517_004_sprint3_contact_dedup_rpc.sql:13](supabase/migrations/20260517_004_sprint3_contact_dedup_rpc.sql:13) `normalize_phone()` normalise aux 9 derniers chiffres.

Conséquence : si demain un contact arrive avec `'0041 79 555 12 34'`, la dédup match (mêmes 9 chiffres) mais l'agent voit deux contacts avec des téléphones qui ne se ressemblent pas. Inconsistance entre la donnée stockée et la donnée de comparaison.

**Fix** : ajouter une colonne `contacts.phone_normalized` peuplée par trigger, et stocker également `phone_normalized` à la création. Ou : normaliser `phone` à l'insert. 30 min. Reporté Sprint 3a.1 acceptable.

### B.4 — `MINEUR` — Escape ferme sans warning

[ImportLeadSugarV3Page.tsx:73-78](src/pages/agent/ImportLeadSugarV3Page.tsx:73) — la touche Escape navigue immédiatement vers `returnTo`. Si l'agent a tapé 1500 caractères ou cliqué "Analyser" sans clore le wizard, tout est perdu sans avertissement.

**Fix** : si `text.trim().length > 50` OU `step > 0`, afficher un `confirm()` avant de naviguer. 10 min.

### B.5 — `MINEUR` — État perdu au refresh navigateur

L'URL préserve `?text=...&returnTo=...` mais l'état post-extraction (extracted, step=1, edit mode) est local. Refresh → retour à step 0 avec le même text.

Comportement acceptable pour MVP — le refresh est rare en travail réel. À noter pour backlog. *(Red-team D1 traité partiellement par URL params, pas par sessionStorage.)*

### B.6 — `MINEUR` — Seuil de confidence trop bas

[ImportLeadSugarV3Page.tsx:113-114](src/pages/agent/ImportLeadSugarV3Page.tsx:113) — `if (result.extracted.confidence < 0.5) setEditMode(true)`.

Claude Sonnet retourne rarement < 0.5 même sur des messages courts (test empirique courant : minimum observé ~0.6). Le seuil 0.5 ne déclenchera presque jamais.

**Fix** : remonter à 0.7, ou enrichir le système prompt pour calibrer la confidence (« Note : 0.7 = sûr, 0.5 = devine, 0.3 = bruit »). Tester avec l'eval harness D3. Backlog.

### B.7 — `MINEUR` — Dédup query trop bavarde en mode édition

[ImportLeadSugarV3Page.tsx:64-69](src/pages/agent/ImportLeadSugarV3Page.tsx:64) — la query est `enabled` dès qu'il y a un signal. En mode édition, chaque keystroke dans email/phone/firstName/lastName re-trigger un cycle React Query. Sur connexion lente, ça crée du bruit.

**Fix** : debounce 300ms via `useDebouncedValue` (déjà dans le repo si présent, sinon implémenté ad-hoc). 15 min. Backlog.

---

## C. Code quality / typing

### C.1 — `MINEUR` — `as never` sur les noms d'icônes

[ImportLeadSugarV3Page.tsx](src/pages/agent/ImportLeadSugarV3Page.tsx) utilise `<SgIcon name={icon as never} />` pour passer des string génériques. Bypass de la safety du type `SgIconName`.

**Fix** : typer le prop `icon` du `ExtractedField` comme `SgIconName`. 5 min.

### C.2 — `MINEUR` — Props deprecated dans `BdPhoto` et `BnPhoto`

[BdShared.tsx:178-184](src/components/crm-sugar-v3/bien-detail/BdShared.tsx:178) et [BnPhoto.tsx:13](src/components/crm-sugar/biens/BnPhoto.tsx:13) — props `c2paVerified`, `photoCount`, `showBadge`, `signed` marquées `@deprecated` mais conservées. Compatibilité respectée mais dette tech.

**Fix** : nettoyer les call sites pour ne plus passer ces props, puis retirer la signature. Backlog.

### C.3 — `MINEUR` — `intent` LLM coercé silencieusement à `'buyer'`

[extract-lead/index.ts:105-107](supabase/functions/extract-lead/index.ts:105) :
```ts
const intent = (parsed.intent === 'seller' || parsed.intent === 'tenant')
  ? parsed.intent
  : 'buyer' as Intent
```

Si Claude retourne `'investor'` (extension future) ou `'landlord'`, on tombe silencieusement à `'buyer'`. Pas d'audit log de la coercition.

**Fix** : si `parsed.intent` n'est pas dans la liste, logger `severity: 'warn'` dans l'audit avec la valeur brute. 10 min.

### C.4 — `MAJEUR` — `useImportLead` ne gère pas l'échec partiel

Si `contacts.insert` réussit puis `transactions.insert` échoue (ex. enum `transaction_stage` rejette `'new_lead'` cf. A.1 note), on a un Contact orphelin sans Deal. Pas de rollback.

**Fix** : utiliser une transaction Postgres via RPC `create_lead_with_optional_deal(...)` qui fait les 2 inserts atomiques. 1h. Ou accepter la fragilité tant que A.1 est fixé. Backlog raisonnable.

### C.5 — `MINEUR` — Sample WhatsApp grammaticalement faux

[samples.ts:35](src/components/crm-sugar-v3/import-lead/samples.ts:35) — *« On sommes tous les deux salariés »* (faute, devrait être *« On est tous les deux salariés »* ou *« Nous sommes tous les deux salariés »*).

Hérité de la maquette handoff (`crm-import-lead-modal.jsx`). Trivial mais visible sur le bouton "Essayer avec un exemple".

**Fix** : 1 min. Décider si on corrige la maquette ou si on laisse à l'identique (port pixel-près).

---

## D. Architecture / déploiement

### D.1 — `BLOQUANT pour ship` — Migrations à appliquer dans l'ordre strict

Ordre obligatoire :
1. `20260517_002_sprint3_contact_type_extension.sql`
2. `20260517_003_sprint3_audit_actor_kind.sql`
3. `20260517_004_sprint3_contact_dedup_rpc.sql`

Si on applique 004 avant 002 et qu'un contact `tenant` existe, le test de la RPC sera valide MAIS le premier insert tenant côté useImportLead échouera. Comme c'est `supabase db push` qui ordonne par nom, c'est OK tant que la convention de naming est respectée. **À vérifier explicitement à la première migration.**

### D.2 — `MAJEUR` — Edge Function `extract-lead` à déployer

`supabase functions deploy extract-lead` n'est pas automatique. Le projet a-t-il un CI sur les Edge Functions ? Si non, déploiement manuel à inclure dans la procédure de release.

**À documenter** dans la PR description.

### D.3 — `MAJEUR` — Pas de feature flag

Si Claude Sonnet est down ou que les coûts explosent, on ne peut pas désactiver Import Lead côté UI sans redéployer. Pattern feature flag absent du repo (vu via grep).

**Fix** : ajouter un check `useFeatureFlag('import_lead_ia')` avant d'afficher les boutons + la route. Backlog Sprint 3a.1.

### D.4 — `BLOQUANT pour ship` — Build vite cassé (pré-existant)

`npm run build` échoue sur `react-is` (recharts dep resolution). Confirmé pré-existant sur main. Ce n'est pas Sprint 3a qui casse, mais **on ne peut pas livrer Sprint 3a en prod sans fixer ce bug d'abord** (CI Cloudflare Pages = build vite obligatoire).

**Décision suggérée** : PR séparé "fix(build): pin react-is or downgrade recharts" → merge avant cette PR. ~30 min.

### D.5 — `MINEUR` — i18n DE/EN/IT non commencée

Le handoff (et la maquette) sont 100% FR. Sprint 3a ship en FR-only. Pour les autres langues : 0.5j sur les 3 langues (extraire les strings, ajouter au namespace `i18n/locales/*/importLead.json`, traduire ~30 strings).

**Décision** : ship FR-only pour MVP, ouvrir un Sprint 3a.2 i18n quand les 3 langues seront priorisées.

### D.6 — `MINEUR` — Pas de tests E2E (Playwright)

Le repo a-t-il une suite Playwright ? Pas vérifié. Si oui : 1 scenario obligatoire à ajouter : `import-lead.spec.ts` (paste → analyse → edit → create → vérifier audit log).

---

## E. Tableau d'action pour merge propre

### Avant merge — ~1h30
- [ ] **A.1** — Fix stages `'new-lead'` → `'new_lead'`, `'to-qualify'` → `'to_qualify'` (5 min)
- [ ] **A.2** — Split audit event en 2 (contact + deal) (15 min)
- [ ] **A.4** — Restreindre CORS à megga.ch (5 min)
- [ ] **A.6** — Surfacer le flag `truncated` dans l'UI (5 min)
- [ ] **B.1** — Guard `isPending` sur `handleCreate` (10 min)
- [ ] **B.2** — Bloquer CTA tant que `dedup.isLoading` (15 min)
- [ ] **B.4** — Confirm avant Esc si texte > 50 chars (10 min)
- [ ] **A.3** — `await` les audit inserts (10 min)
- [ ] **D.4** — Fix build pré-existant (PR séparé, ~30 min)

### Immédiatement après merge — Sprint 3a.1 (~6h)
- [ ] **A.5** — Rate limit Edge Function (2h)
- [ ] **A.7** — Rétention rawText + cron purge (1h)
- [ ] **A.8** — Rétrofit `actor_kind` sur les 7 Edge Functions IA existantes (3h)

### Backlog — Sprint 3a.2+
- [ ] **B.3** — Phone normalization à l'insert
- [ ] **B.5** — sessionStorage backup de l'état modal
- [ ] **B.6** — Calibrage confidence + eval harness
- [ ] **B.7** — Debounce dédup query
- [ ] **C.1** — Typage strict des noms d'icônes
- [ ] **C.4** — RPC transactionnelle `create_lead_with_optional_deal`
- [ ] **D.3** — Feature flag
- [ ] **D.5** — i18n DE/EN/IT
- [ ] **D.6** — Test E2E Playwright

### À investiguer (hors Sprint 3a)
- [ ] **A.1 note** — Le type ENUM `transaction_stage` n'a jamais été étendu. Comment la prod fait-elle pour accepter `'new_lead'` aujourd'hui ? (Migration hors-band ? Bug latent ?)
- [ ] **D.4** — Origine du bug `react-is` / recharts sur la branche `main`.

---

## F. Méta — ce que j'aurais dû faire différemment

1. **Vérifier le schéma SQL réel avant d'écrire les inserts.** J'ai pris pour acquis que `stage = 'new-lead'` était bon parce que c'est dans la maquette. La maquette utilise des kebab-cases (`'new-lead'` partout dans `crm-data.jsx`), la prod utilise des underscores. Toujours croiser maquette ↔ schéma.

2. **Écrire le test E2E AVANT le bouton create.** Le bug A.1 aurait été pris immédiatement avec un test qui crée vraiment un contact + deal en CI.

3. **Auditer chaque insert pour idempotence.** B.1 (double-clic) est un classique que je connais mais que j'ai zappé.

4. **Lister les invariants compliance AVANT le code.** Si j'avais écrit *« chaque action métier émet 1 AuditEvent par entité touchée »* en intro de Sprint 3a, A.2 aurait été évité.

---

*Audit rédigé en self-review · à challenger ligne par ligne. Si une issue paraît creuse, dis-le.*
