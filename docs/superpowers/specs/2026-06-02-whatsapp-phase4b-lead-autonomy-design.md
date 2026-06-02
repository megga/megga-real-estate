# WhatsApp Phase 4B — Qualification autonome du lead — Design

> Date : 2026-06-02
> Statut : validé (discussion) — build en cours
> Dépend de : capture + compréhension (spec 2026-06-02-whatsapp-conversation-intelligence)

## 1. Objectif

Passer de « MEGGA comprend » à « MEGGA agit ». Quand la compréhension (L2) identifie
un lead + des critères dans une conversation, MEGGA **crée/enrichit le contact tout
seul**, capte les critères, le **flague « à compléter »** s'il manque des infos, et —
si les critères sont suffisants — **crée une recherche `client_searches`** qui déclenche
le moteur de matching. L'agent relit et complète ; il ne fait plus la saisie.

## 2. La nuance : qui est le lead ?

La compréhension doit distinguer :
- **Client qui écrit pour lui-même** (« je cherche un 3,5 pièces, 1,2M ») → l'**expéditeur**
  est le lead → on enrichit la fiche déjà mappée (le contact de l'expéditeur).
- **Agent qui dicte à propos d'un client** (« j'ai une cliente Sarah Williams… ») → le lead
  est une **tierce personne** → on crée/retrouve la fiche **Sarah Williams** (pas l'expéditeur).

## 3. Périmètre

**Dans :** extraction du lead (expéditeur vs tiers) + critères + champs manquants ;
dédoublonnage ; création/MAJ du contact (`type='lead'`, `source='whatsapp_ai'`,
tag `à_compléter` + `score='cold'` si incomplet) ; note timeline (`actor_kind='ai'`) ;
création d'une `client_searches` (→ matching auto) **uniquement si critères suffisants**.

**Hors :** tout envoi **au client** (reste tier `confirm`) ; KYC. La création/MAJ de
données CRM internes est autonome (cohérent avec le tier `auto` existant).

## 4. Garde-fou (compliance)

- Créer/enrichir une fiche, une note, une recherche = **interne, risque faible → autonome**.
- Envoyer au client = **validation agent** (inchangé).
- Tout est journalisé en timeline (`actor_kind='ai'`, badge IA) → l'agent voit et corrige.
- Rien n'est « garanti » : la fiche reste « à compléter » tant que l'agent n'a pas validé.

## 5. Données (réutilise l'existant, 0 nouvelle table)

- `contacts` : `type='lead'`, `source='whatsapp_ai'`, `tags` (+ `à_compléter`),
  `score` (`cold` si incomplet), `notes`/`search_criteria` (critères bruts), `phone/email`
  si captés. Dédup : par `phone` (9 derniers chiffres) puis par nom (`first_name`+`last_name`).
- `client_searches` : `contact_id`, `agency_id`, `label`, `criteria` (jsonb), `is_active=true`.
  **Trigger `on_new_client_search` (AFTER INSERT) lance le matching** — on insère, le moteur fait le reste.
- `activity_events` : note de ce que MEGGA a fait + ce qui manque.
- `whatsapp_conversation_insights` : l'insight (déjà là) gagne la trace des actions menées.

## 6. Mapping des critères → `client_searches.criteria`

Schéma cible (constaté) : `{ transaction_type, type, zones[], budget_min, budget_max,
rooms_min, rooms_max, surface_min, features[] }` — `type` en anglais (`apartment`/`house`…).

Règles (pures, testées dans `whatsapp-lead.ts`) :
- **transaction_type** : `rent` si « louer / loyer / par mois / /mois », sinon `buy`. **Obligatoire.**
- **budget** : en location → `budget_max` = montant mensuel ; en achat → `budget_max` = prix.
- **type** FR→EN : appartement→apartment, maison→house, villa→villa, etc.
- **zones** : quartiers/villes cités (Carouge, Genève…).
- **features** : terrasse, balcon, parking, jardin…
- **rooms/surface** : si cités.
- **Seuil pour créer la recherche** : `transaction_type` **et** (`type` ou `zone` ou `budget`)
  présents. Sinon → PAS de `client_searches` (pas de matching sur du vide) ; lead juste
  « à compléter ».

## 7. Champs « à compléter »

Essentiels d'un lead exploitable : moyen de contact (téléphone/email), `transaction_type`,
`type`, `budget`, `zone`. `computeMissing(lead)` renvoie la liste des manquants → écrite
dans la note timeline (« manque : téléphone, nb pièces, date de visite ») + tag `à_compléter`.

## 8. Flux (dans le cron `whatsapp-process`, après l'insight)

1. La compréhension renvoie aussi un objet `lead` : `{ is_third_party, first_name, last_name,
   phone?, email?, criteria{…}, missing[] }` (ou `null` si pas de lead identifiable).
2. Résoudre le contact : tiers → dédup par téléphone puis nom → créer si absent ;
   expéditeur → le contact déjà mappé.
3. Upsert contact (champs captés + tag `à_compléter` si `missing` non vide + `score`).
4. Si critères ≥ seuil (§6) → upsert `client_searches` (is_active=true) → matching auto.
5. `activity_events` : « Lead qualifié par MEGGA depuis un vocal. Critères : … . À compléter : … »
6. Borné comme le reste (budget temps, idempotence : ne pas recréer si déjà fait).

## 9. Idempotence

L'insight est recalculé à chaque nouveau message (péremption dérivée). Pour ne pas recréer
le lead/la recherche à chaque tick : on n'agit que si le contact n'a pas déjà été qualifié
par MEGGA pour cette conversation (marqueur : tag `whatsapp_ai_qualified` sur le contact, ou
`client_searches` déjà existante pour ce contact). Dédup contact = jamais de doublon.

## 10. Tests

- **Purs (vitest)** : `whatsapp-lead.ts` — `mapCriteria` (rent vs buy, FR→EN, seuil),
  `computeMissing`, parsing de l'objet `lead` de la compréhension.
- **Manuel/staging** : un vocal « j'ai une cliente Sarah… » → contact Sarah créé,
  `à_compléter`, note timeline, et (si critères suffisants) une `client_searches` + matchs.

## 11. Vérification (definition of done)

- Vocal de dictée agent → contact tiers créé, taggé `à_compléter`, note timeline lisible.
- Vocal client 1ʳᵉ personne → fiche expéditeur enrichie (pas de doublon).
- Critères suffisants → `client_searches` créée → matching déclenché (matchs visibles).
- Rien envoyé au client sans validation. `npm run build` + unitaires verts, `deno check` vert.

## 12. Build (lots)

- **B1** : `whatsapp-comprehend` — étendre la sortie avec `lead` + `missing`. Tests parser.
- **B2** : `_shared/whatsapp-lead.ts` — `mapCriteria` / `computeMissing` purs + tests.
- **B3** : `whatsapp-process` — exécuter les actions lead (créer/MAJ contact, note, client_searches) après l'insight, bornes + idempotence.
- **B4** : déploiement + test vocal réel.

> IA = DeepSeek uniquement.
