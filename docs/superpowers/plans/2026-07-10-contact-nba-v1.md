# Spec — `contact_next_action` v1 (NBA par contact, cerveau partagé WhatsApp × copilote)

> Vague 2 (Concevoir) de la méthode des 3 vagues. Statut : **spec révisée v1.1 — à valider, aucun code de prod écrit**.
> Révision v1.1 : intègre la revue adversariale 3 lentilles (3 × go-with-fixes, 5 mustFix corrigés,
> shoulds retenus). Vague 1 (carte d'état + blockers B1/B2/B3) : mémoire `project_nba_shared_brain_vague1`.
> Objectif produit : une seule « prochaine meilleure action » **déterministe, explicable, tunable**, par contact,
> lue à l'identique par l'agent WhatsApp (`whatsapp-agent`) et le copilote CRM (`ai-copilot`).

---

## 1. Objectif & périmètre

**v1 =** une fonction SQL à la volée qui, pour UN contact d'UNE agence, rend LA prochaine action
(+ raison + échéance + note KYC facultative), consommée par les deux agents via leurs exécuteurs
**déjà partagés** (`_shared/whatsapp-actions.ts`).

**Dans le périmètre v1 :**
- Fonction cœur `contact_next_action(p_contact, p_agency)` (service-role) + wrapper JWT
  `get_contact_next_action(p_contact)` (authenticated) — résout le blocker **B1** par construction :
  deux portes, une seule logique.
- Règles par **priorité absolue** (pas de seuils distributionnels : 12 contacts en base).
- **Trigger `touch_transactions_updated_at`** (pré-requis de R4, même migration — voir R4 : sans lui,
  le proxy de stagnation est cassé dans le sens masquant).
- Câblage additif dans `execGetContactBrief` + `execPrepareMeeting` (+ exposition `rolling_summary`
  au passage, item A1 de l'éval convergence).
- Barème tunable `app_config.contact_nba_v1`.

**Hors périmètre v1 (non-buts explicites) :**
- Radar agence cross-contact (« par quoi je commence ? ») = Phase 2 ; le blend + cap anti-volume
  (blocker B2) n'est pas nécessaire ici car le classement est intra-contact.
- Persistance/historisation du NBA (pas de table, pas de cron : calcul à la volée — un NBA nocturne
  serait périmé dès le premier message, faiblesse #4 du rapport score).
- Tout apprentissage (réactivité, proba de conversion) : **data-gated** (0 signal de résultat en prod).
- Offres sans `transaction_id` (non attribuables à un contact en v1 — couvert par le radar Phase 2).
  `crm_offers` porte aussi `deal_id` (héritage) : les éventuelles offres deal_id-only restent hors v1.
- `seller_leads` (pas de `contact_id` en statut `new`).
- **Visites `no_show`** : le radar v3 les route « à relancer » (`classifyVisit`,
  `focusScore.ts:427`) ; 0 ligne en prod. Non repris en v1 — documenté ici pour que « reprend la
  sémantique du radar v3 » ne soit pas survendu : v1 reprend (a) today et (b) debrief, pas no-show.
- DE/IT : le formatteur est FR/EN (aligné `WaLang`). Côté copilote, `ctx.lang` est déjà dégradé en
  `fr` pour tous les exécuteurs (`ai-copilot/index.ts:928`) et la consigne de langue du system prompt
  fait rendre la réponse finale en DE/IT par DeepSeek — comportement existant, inchangé.
- Surface front (fiche contact) : le wrapper JWT est prêt, le câblage UI viendra après.

---

## 2. Contrat de sortie (jsonb)

```jsonc
{
  "version": 1,
  "action": "rappel" | "offre_expirante" | "visite_preparer" | "visite_debrief"
          | "deal_stagnant" | "match_a_envoyer" | "relance" | "aucune",
  "reason_key": "reminder_overdue" | "reminder_today" | "offer_expiring" | "visit_today"
              | "visit_debrief" | "deal_stalled" | "matches_to_send"
              | "never_contacted" | "dormant" | "none",
  "params": { /* déterministes, PII-minimales — voir §3 par règle */ },
  "due_at": "timestamptz | null",
  "kyc_note": { "status": "...", "completion_pct": 0 } | null,   // JAMAIS une action (M3)
  "computed_at": "timestamptz"
}
```

- `params` ne contient **jamais** de nom/email/téléphone : uniquement compteurs, jours, ids, montants
  de dossier, stage. Le libellé humain est rendu côté TS par clé contrôlée (patron
  `REASON_KEY_LABEL_FR` du Focus — on n'affiche jamais un `.detail` libre). Les `*_id` des `params`
  servent au débogage/liaison et ne sont **jamais interpolés** dans les libellés (« pas
  d'identifiants bruts », asserté en unit — §9.1).
- Retour `NULL` si le contact n'existe pas **ou** n'appartient pas à `p_agency` (pas de fuite d'existence).

---

## 3. Règles de décision v1 — ordre absolu

> Première règle qui matche = l'action. Départage intra-règle indiqué. Tous les prédicats sont scopés
> `agency_id = p_agency` **ET `contact_id`/lien contact = `p_contact`** dans chaque sous-requête
> (doctrine multi-tenant + isolation par-contact — testée, cf. N17).

### R1 — Rappel échu ou du jour → `rappel`
```sql
SELECT ... FROM reminders r
WHERE r.contact_id = p_contact AND r.agency_id = p_agency
  AND r.status IN ('pending','triggered')       -- valeur live observée : 'triggered'
  AND r.completed_at IS NULL
  AND r.trigger_at <= v_eod_zurich               -- échu OU dû aujourd'hui (fin de journée Zurich)
ORDER BY r.trigger_at ASC LIMIT 1                -- départage : le plus ancien gagne (testé N21)
```
- `reason_key` : `reminder_overdue` si `trigger_at < v_sod_zurich` (début de journée), sinon `reminder_today`.
- `params` : `{ "reminder_type": r.type, "days_overdue": n, "reminder_id": r.id }` ; `due_at = trigger_at`.

### R2 — Offre en attente proche d'échéance → `offre_expirante` (`offer_expiring`)
```sql
SELECT ... FROM crm_offers o
JOIN transactions t ON t.id = o.transaction_id AND t.agency_id = p_agency
WHERE o.agency_id = p_agency AND o.status = 'pending'
  AND (t.contact_buyer_id = p_contact OR t.contact_seller_id = p_contact)
  AND o.expires_at IS NOT NULL                   -- défensif (colonne NOT NULL au schéma live)
  AND o.expires_at <= now() + make_interval(days => v_offer_window_days)
ORDER BY o.expires_at ASC LIMIT 1                -- départage : échéance la plus proche
```
- Lien contact **via `transaction_id`** (`crm_offers` n'a pas de `contact_id` — vérifié au schéma).
- Une offre déjà passée (`expires_at < now()`) mais encore `pending` (cron horaire pas encore passé)
  compte : `days_left` peut être négatif ⇒ libellé « échéance dépassée ».
- Négatif testé : offre `pending` expirant **au-delà** de la fenêtre ⇒ pas d'action (N20).
- `params` : `{ "amount": o.amount, "days_left": n, "offer_id": o.id }` ; `due_at = expires_at`.

### R3 — Visite du jour / à débriefer → `visite_preparer` (`visit_today`) | `visite_debrief` (`visit_debrief`)
```sql
-- (a) préparer : à venir AUJOURD'HUI (Europe/Zurich)
v.contact_id = p_contact AND v.agency_id = p_agency
AND v.status IN ('planned','confirmed') AND v.scheduled_at >= now()
AND (v.scheduled_at AT TIME ZONE 'Europe/Zurich')::date = (now() AT TIME ZONE 'Europe/Zurich')::date
-- (b) débriefer : passée non clôturée, fenêtre bornée (v_visit_debrief_window_days, défaut 21 j)
v.contact_id = p_contact AND v.agency_id = p_agency
AND ( (v.status IN ('planned','confirmed') AND v.scheduled_at < now())
   OR (v.status = 'done' AND v.rapport IS NULL
       AND (v.feedback_agent IS NULL OR btrim(v.feedback_agent) = '')) )   -- btrim : parité radar (.trim())
AND v.scheduled_at >= now() - make_interval(days => v_visit_debrief_window_days)
```
- (a) prime sur (b) — invariant **intra-règle** repris du radar v3 (une visite du jour prime sur un
  débrief). L'ordre absolu inter-règles reste maître : R1/R2 passent avant une visite du jour, c'est
  voulu (obligations datées d'abord).
- Départage : `scheduled_at ASC` pour (a), `scheduled_at DESC` pour (b).
- `params` : `{ "visit_id", "scheduled_at" }` ; `due_at = scheduled_at`.

### R4 — Deal actif qui stagne → `deal_stagnant` (`deal_stalled`)
```sql
SELECT ... FROM transactions t
WHERE t.agency_id = p_agency
  AND (t.contact_buyer_id = p_contact OR t.contact_seller_id = p_contact)
  AND t.status = 'active'
  AND t.stage NOT IN ('signed','closed','lost','to_recontact')
  AND t.updated_at < now() - make_interval(days => v_deal_stall_days)
ORDER BY t.updated_at ASC LIMIT 1
```
- **Pré-requis livré dans la même migration — trigger `touch_transactions_updated_at`**
  (`BEFORE UPDATE ON transactions … NEW.updated_at := now()`). La revue adverse a **prouvé**
  qu'aucun chemin ne rafraîchit `updated_at` aujourd'hui : pas de trigger existant ;
  `wa_move_transaction_stage` ne SET que `stage` ; le front n'envoie que `{stage, notes}`
  (`useTransactions.ts:130-135`) ; live : 4/4 deals ont `updated_at = created_at` figé au 19.05.
  Sans ce trigger, le proxy serait cassé dans le sens **masquant** : tout deal actif > 14 j serait
  « stagnant » à perpétuité même si l'agent bouge le pipeline chaque jour, et R4 étoufferait R5/R6.
  Le trigger est le point unique qui couvre les 3 chemins d'écriture (front, RPC WhatsApp, trigger
  accept→signed) ; il ne touche pas l'attribution GUC des triggers AFTER existants.
- Proxy assumé dans l'autre sens (un edit anodin « rafraîchit » le deal) : acceptable v1, remplacé
  par la vélocité `stage_change` quand la donnée s'accumulera (data-gated).
- `params` : `{ "stage": t.stage, "days_stalled": n, "transaction_id": t.id }`.

### R5 — Matches à envoyer → `match_a_envoyer` (`matches_to_send`)
```sql
SELECT count(*) AS n, max(score) AS best FROM matches m
WHERE m.contact_id = p_contact AND m.agency_id = p_agency
  AND m.status = 'suggested' AND m.response_at IS NULL
  AND (m.snoozed_until IS NULL OR m.snoozed_until <= now())   -- borne <= : équivalence stricte focus_top_matches
  AND m.score >= v_match_gate
```
- `n > 0` ⇒ action. Requête couverte par l'index partiel existant
  `idx_matches_agency_focus (agency_id, contact_id, score DESC) WHERE status='suggested'`
  (les filtres `response_at`/`snoozed_until` s'appliquent post-index sur le sous-ensemble du contact —
  volume pire cas mesuré 2805 lignes, négligeable).
- **`v_match_gate` : chaîne de fallback anti-divergence** —
  `COALESCE(contact_nba_v1.match_gate, today_focus_v1.thresholds.match_gate, 70)`. Tant que la clé
  NBA est absente, le NBA et le radar Focus lisent **le même gate** ; poser la clé NBA = divergence
  assumée et visible.
- Pas de blend ici (classement **intra**-contact) — le blend + cap anti-volume reste l'affaire du
  radar cross-contact (Phase 2, blocker B2).
- `params` : `{ "count": n, "best_score": best, "gate": v_match_gate }`.
- L'action reste « préparer/proposer l'envoi » : l'envoi réel passe par `send_listings` (tier
  `confirm`, socle légal intact — M1).

### R6 — Relance dormance → `relance`
```sql
-- sur la ligne contacts (déjà chargée pour la garde d'agence)
c.type IN ('buyer','seller','tenant','landlord','investor','both','lead')
-- last_interaction_at IS NULL        → reason_key 'never_contacted'  (honnête, pas de fausse décroissance)
-- last_interaction_at < now() - make_interval(days => v_dormant_days) → 'dormant', params {days_dormant}
```
- Whitelist = **les 7 valeurs de la contrainte live `contacts_type_check`** (vérifiée en base :
  buyer, seller, tenant, landlord, investor, both, lead). La revue adverse a montré que le précédent
  `useRelanceLeads` (4 types) excluait aussi `lead` : on ne copie pas ses trous — un investisseur ou
  un « both » dormant mérite une relance comme les autres. Un `type` NULL ⇒ pas de R6 (⇒ `aucune`),
  cas documenté pour les imports futurs.
- `v_dormant_days` défaut 14 (aligné `useRelanceLeads.DORMANT_DAYS`).
- Réalité mesurée : `last_interaction_at` non-NULL sur 6/12 contacts (l'hypothèse « NULL partout » des
  commentaires du radar est périmée — la règle gère les deux cas explicitement).

### R7 — Rien → `aucune` (`reason_key: none`)
Libellé : « Aucune action urgente pour ce contact. » — un vrai zéro honnête, pas d'invention.

### Note KYC (transverse, jamais une action — M3)
```sql
SELECT ... FROM kyc_cases k
WHERE k.contact_id = p_contact AND k.agency_id = p_agency
  AND k.status NOT IN ('validated','rejected')
  AND EXISTS (SELECT 1 FROM transactions t WHERE t.agency_id = p_agency
              AND (t.contact_buyer_id = p_contact OR t.contact_seller_id = p_contact)
              AND t.status = 'active'
              AND t.stage IN ('interest_confirmed','offer','negotiation','reserved','financing','notary','signed'))
ORDER BY k.created_at DESC LIMIT 1
```
- Remplit `kyc_note {status, completion_pct}`. Ne modifie **jamais** `action` ni l'ordre. Libellé TS :
  « dossier KYC à finaliser (facultatif, ne bloque rien) ».

---

## 4. Tunables — `app_config.contact_nba_v1`

```json
{ "dormant_days": 14, "offer_window_days": 7,
  "deal_stall_days": 14, "visit_debrief_window_days": 21, "version": 1 }
```
- TEXT JSON, chaque clé lue en `COALESCE(cfg->..., littéral)` (un JSON cassé ne casse rien — patron
  `contact_scoring_v1`). `INSERT ... ON CONFLICT (key) DO NOTHING`.
- **`match_gate` volontairement ABSENT du défaut** : R5 le lit en fallback depuis
  `today_focus_v1.thresholds.match_gate` (une seule notion, un seul tunable). La clé
  `contact_nba_v1.match_gate` n'existe que comme override explicite si on veut un jour découpler.
- Pas de `blend_floor` en v1 (pas de cross-contact) — surface minimale.

---

## 5. Architecture SQL

### 5.1 Fonction cœur (service-role)
```sql
CREATE OR REPLACE FUNCTION public.contact_next_action(p_contact uuid, p_agency uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
SET statement_timeout = '8s'
AS $$ ... $$;
REVOKE ALL ON FUNCTION public.contact_next_action(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contact_next_action(uuid, uuid) TO service_role;
```
- Garde d'entrée : `p_contact`/`p_agency` NULL ⇒ NULL ; contact absent ou d'une autre agence ⇒ NULL.
- Le paramètre **est** le scope (patron `calculate_contact_scores`) : sûr parce que **jamais** exposé
  à `authenticated`.
- `search_path = public, pg_temp` : aligné sur le précédent le plus récent du repo
  (`wa_move_transaction_stage`).
- **Honnêteté sur `SET statement_timeout`** : clause conservée par convention du repo
  (`focus_top_matches` 15s), mais elle ne borne pas l'appel en cours (timer armé au statement
  top-level). La borne réelle côté wrapper = `rolconfig` du rôle `authenticated` (8s, vérifié live) ;
  le chemin service-role n'a pas de borne de rôle. Le vrai argument perf est la volumétrie (§7 :
  tables minuscules + index partiel, pire cas mesuré < 1 ms).

### 5.2 Wrapper JWT (authenticated)
```sql
CREATE OR REPLACE FUNCTION public.get_contact_next_action(p_contact uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_agency uuid := public.get_user_agency_id();
BEGIN
  IF v_agency IS NULL THEN RETURN NULL; END IF;
  RETURN public.contact_next_action(p_contact, v_agency);
END $$;
REVOKE ALL ON FUNCTION public.get_contact_next_action(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_contact_next_action(uuid) TO authenticated, service_role;
```
- Zéro paramètre d'agence forgeable (patron `focus_top_matches`) ⇒ pas de surface IDOR.
- **Une seule logique** (le cœur) pour les deux portes ⇒ pas de divergence copilote/WhatsApp (B1
  résolu) — équivalence testée sur le happy path (N18), pas seulement les refus.

### 5.3 Trigger `touch_transactions_updated_at` (pré-requis R4)
```sql
CREATE OR REPLACE FUNCTION public.touch_transactions_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_touch_transactions_updated_at ON public.transactions;
CREATE TRIGGER trg_touch_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.touch_transactions_updated_at();
```
- BEFORE (modifie NEW) ⇒ n'interfère pas avec les triggers AFTER existants
  (`trg_transaction_lifecycle`, `trg_monitor_transaction_kyc_gate`) ni avec l'attribution GUC.

### 5.4 Ni table ni cron
Calcul à la volée : tables minuscules (`reminders` 5, `visits` 0, `crm_offers` 0, `transactions` 4,
`kyc_cases` petit) + `matches` couvert par l'index partiel. Latence mesurée en revue ≪ 1 ms pire
cas — compatible avec le budget du tour WhatsApp (45 s global ; le RPC s'exécute entre les tours,
pas dans l'appel DeepSeek).

---

## 6. Câblage TS (canal-agnostique, additif)

### 6.1 Nouveau module pur `_shared/contact-nba.ts`
- `export interface ContactNextAction { ... }` (miroir du contrat §2, défensif au parse).
- `parseNextAction(raw: unknown): ContactNextAction | null` — whitelists sur `action`/`reason_key`
  (patron `parseInsight`) : une valeur inconnue ⇒ null, jamais d'exception.
- `formatNextAction(nba, lang: 'fr'|'en'): string` — libellés contrôlés par clé, interpolation des
  `params`, dates au format suisse, **cadrage « estimation »** systématique, zéro tiret cadratin
  (compatible meggaProse). **Jamais d'interpolation des `*_id`** dans les libellés (« pas
  d'identifiants bruts ») — asserté en unit. Le LLM ne fournit **jamais** le tri ni le libellé de
  priorité (B3).
- `export const NBA_PROMPT_GUARDRAIL` : la consigne §6.4, exportée pour être injectée par les deux
  agents ET assertée en unit (présence de l'interdiction d'initiative).
- 100 % pur, zéro I/O ⇒ couvert en vitest (comble le trou « edge functions hors tsc/vitest »).

### 6.2 `execGetContactBrief` (`_shared/whatsapp-actions.ts:225-245`)
- Ajout **best-effort** :
  `const { data, error } = await supabase.rpc('contact_next_action', { p_contact: c.id, p_agency: ctx.agencyId })`
  — `supabase.rpc()` **ne throw pas** : consulter `error` explicitement (un try/catch seul laisserait
  passer un null silencieux) ; `error` ⇒ champ absent, le brief ne casse jamais.
  → champ `next_action_estimee = { action, label: formatNextAction(...), due_at, kyc_note }`.
- Ajout de `rolling_summary` au SELECT `whatsapp_conversation_insights` existant (item A1 — la
  mémoire longue devient visible des deux agents).
- L'insight LLM (`comprehension`) reste un champ séparé : contexte conversationnel, jamais le décideur.
- Mettre à jour la **description de l'outil** (`whatsapp-tools.ts`) : `comprehension.next_action` =
  « piste évoquée en conversation » ; `next_action_estimee` = « prochaine action du dossier
  (estimation déterministe interne) » — deux notions distinctes, pas de fusion.

### 6.3 `execPrepareMeeting` (`_shared/whatsapp-actions.ts:2149-2288`)
- Même appel best-effort ; le NBA rejoint le **contexte factuel** passé à DeepSeek pour ancrer les
  « 3 points à aborder ». Étiquetage distinct et préséance explicite dans le contexte :
  « Prochaine action (dossier, estimation interne) : … » vs « Piste évoquée en conversation : … »
  (l'existant `insight.next_action.label`, `whatsapp-actions.ts:2264`) — en cas de divergence, le
  déterministe cadre la priorité. La dégradation propre existante (partie factuelle rendue même si
  DeepSeek échoue) est conservée.

### 6.4 Consigne prompt (`NBA_PROMPT_GUARDRAIL`, 1 bloc dans l'anti-fabrication des deux agents)
> `next_action_estimee` est une estimation déterministe interne : présente-la comme une suggestion
> (« je te suggère de… »), jamais comme une obligation ni une action déjà faite, et JAMAIS comme un
> ordre. N'appelle AUCUN outil d'action de ta propre initiative sur cette base : propose-la en une
> phrase, l'agent décide. `comprehension.next_action` (piste évoquée en conversation) est un signal
> conversationnel : en cas de divergence, `next_action_estimee` cadre la priorité.

- Motif (revue adverse) : le system prompt WhatsApp pousse à l'action directe (« appelle DIRECTEMENT
  l'outil », « sois proactive ») et les outils tier `auto` (create_reminder, add_note, qualify_lead)
  s'exécutent sans confirmation ; sans cette interdiction, un libellé NBA « 3 biens à proposer »
  pourrait déclencher un enchaînement d'outils non sollicité (voire occuper le slot unique de
  `whatsapp_pending_actions` 15 min sur un send_listings jamais demandé). Le socle légal (tier
  confirm) reste intact dans tous les cas — cette consigne protège l'**initiative**, pas l'envoi.

### 6.5 Ce qui ne change PAS (invariants de non-régression)
- Aucun nouvel outil, aucun tier modifié, `canLeaveConfirm` intact (M1 : le NBA est une **lecture** ;
  agir reste un geste HITL par les outils existants).
- `get_contact_brief`/`prepare_meeting` : champs existants inchangés (ajout only) — aucun consommateur
  actuel ne casse.
- Parité automatique : les deux agents passent par les **mêmes** exécuteurs.

---

## 7. Compliance (récapitulatif doctrine)

| Règle | Application |
|---|---|
| Déterministe, 0 LLM dans le tri | Ordre absolu SQL ; LLM cantonné au contexte (B3) ; préséance explicite §6.3/§6.4 |
| Estimation, jamais garanti | Cadrage dans `formatNextAction` + `NBA_PROMPT_GUARDRAIL` |
| KYC non-bloquant | `kyc_note` séparée, jamais `action`, libellé « facultatif » (M3) |
| HITL | Lecture seule ; interdiction d'initiative outillée (§6.4) ; toute action passe par les outils tiérés existants (M1) |
| Multi-tenant | `p_agency` + `p_contact` dans **chaque** sous-requête ; wrapper JWT sans param forgeable (B1) ; isolation par-contact testée (N17) |
| LPD | Donnée dérivée ; pas de PII nouvelle dans `params` (même catégorie que le brief existant) ; pas de table ; pas d'UUID dans les libellés |
| Perf §7 | Volumétrie mesurée < 1 ms pire cas ; index partiel réutilisé ; le seul `count(*)` porte sur le sous-ensemble matches indexé du contact ; borne réelle = rolconfig authenticated 8s |
| Audit | Lecture ⇒ pas d'`activity_events` (cohérent avec les reads existants ; `whatsapp_tool_usage` continue de logger le nom d'outil) |

---

## 8. Migration

- **1 fichier** : `supabase/migrations/<stamp>_contact_nba_v1.sql` — les 2 fonctions + le trigger §5.3
  + GRANT/REVOKE + INSERT `app_config` ON CONFLICT DO NOTHING. **Idempotent** (re-run sûr).
- **Règle date-guard (piège prouvé par la revue : `deploy.yml:104,153-158`)** : la partie date du
  fichier = **date UTC du jour du merge** — re-stamper si la PR glisse. Le deploy n'applique que les
  migrations `stamp_date >= TODAY` : un fichier daté d'hier ne s'applique JAMAIS en prod (feature
  silencieusement morte, CI verte car la CI part d'une base fraîche où tout s'applique). Un fichier
  futur-daté se re-rejoue à chaque deploy jusqu'à sa date — inoffensif ici (idempotent), raison de
  plus pour stamper au jour du merge. Slot si merge le 10.07 : après `20260710191000` (#833),
  p.ex. `20260710200000`.
- Aucune nouvelle table, aucun index (l'existant couvre), aucune RLS à créer.

---

## 9. Plan de test

### 9.1 Unit (vitest, purs)
`tests/unit/contact-nba-format.spec.ts` :
- parse défensif (action/reason_key inconnus ⇒ null) ;
- chaque `reason_key` en FR et EN, interpolation params, dates suisses ;
- présence du cadrage « estimation » dans chaque libellé ; absence de tiret cadratin ;
- **aucun UUID dans un libellé rendu** (balayage regex sur tous les cas) ;
- `kyc_note` rendue « facultatif » ;
- **`NBA_PROMPT_GUARDRAIL` contient l'interdiction d'initiative** (« n'appelle AUCUN outil »).

### 9.2 Backend LIVE (CI) — `tests/backend/contact-nba.spec.ts`
| # | Cas | Attendu |
|---|---|---|
| N1 | reminder échu + matches ≥ gate | `action=rappel` (priorité absolue) |
| N2 | matches sous le gate seulement | pas `match_a_envoyer` |
| N3 | match avec `response_at` posé ou snoozé (`snoozed_until` futur) | exclu |
| N4 | contact jamais contacté (`last_interaction_at` NULL) | `relance` / `never_contacted` |
| N5 | dormance datée > `dormant_days` | `relance` / `dormant` + `days_dormant` |
| N6 | rien | `aucune` |
| N7 | cœur appelé avec la mauvaise agence | NULL (isolation agence) |
| N8 | wrapper avec JWT sans agence | NULL |
| N9 | rôle `authenticated` appelle le **cœur** | erreur de permission (42501) |
| N10 | KYC seul signal (deal closing-proximate + kyc non validé, rien d'autre) | `action≠kyc`, `kyc_note` remplie |
| N11 | UPDATE `app_config.contact_nba_v1.dormant_days` | comportement change sans redeploy |
| N12 | visite aujourd'hui + deal stagnant | `visite_preparer` gagne |
| N13 | offre `pending` expirant, liée via `transaction_id` | `offre_expirante` + `days_left` |
| N14 | deal `active` non touché depuis > `deal_stall_days` | `deal_stagnant` |
| N15 | deal bougé la veille (UPDATE stage ⇒ trigger touch) | **pas** `deal_stagnant` (proxy vivant) |
| N16 | visite passée non clôturée dans la fenêtre 21 j | `visite_debrief` |
| N17 | visite passée non clôturée > 21 j | exclue (pas de débrief antique) |
| N18 | reminder + visite d'un AUTRE contact de la MÊME agence | `aucune` pour p_contact (isolation par-contact) |
| N19 | wrapper avec JWT d'agence (happy path) | résultat **identique** au cœur (deux portes, une logique) |
| N20 | offre `pending` expirant au-delà de `offer_window_days` | pas `offre_expirante` |
| N21 | 2 reminders échus | le plus ancien `trigger_at` gagne |
| N22 | contact type `investor` (ou `both`) dormant | `relance` (whitelist 7 types) |

- Leçons CI intégrées : pas d'INSERT `client_searches` dans le seed (trigger `net.http_post` — piège
  contact-scores) ; qualifier les colonnes dans les expressions des RPC plpgsql (42702).
- Vague 3 : `npm run build` (tsc -b) avant push ; tests backend live = la vraie validation.

### 9.3 Validation à la main (pré-merge)
Transaction `BEGIN … ROLLBACK` sur la base réelle : appeler le cœur sur les 12 contacts prod, vérifier
qu'aucun ne throw et que la distribution des actions est plausible. **Attention à l'attendu** : tant
que le trigger touch n'a pas vécu, les 4 deals ont `updated_at` figé ⇒ leurs contacts sortiront
`deal_stagnant` (légitime : ces dossiers stagnent réellement depuis mai) ; le reste attendu :
`relance` / `match_a_envoyer` / `aucune`.

---

## 10. Risques & suites

- **Proxy `updated_at`** (R4) : rendu vivant par le trigger §5.3 ; remplacé par la vélocité
  `stage_change` quand la donnée s'accumulera (instrumentation déjà posée).
- **Valeur observable** : dépend de la Phase 0 (flag `copilot_tools_enabled` pilote, routage
  `agency_wa_numbers`, consolidation du pilote sur une agence exerçant les deux surfaces). Le code
  ship indépendamment ; l'observation cross-canal exige la Phase 0.
- **Phase 2 (étoile polaire)** : porter le radar 10 familles en backend dual-mode (`get_my_priorities`
  pour WhatsApp), rebrancher `suggest_priorities_today`, basculer le front — le blend + cap (B2) et le
  sous-signal no-show se traitent là.
- **PR #833** (heure de relance apprise) : une fois mergée, son RPC fournit le « quand » de l'action
  `relance` (champ `suggested_hour` ajouté aux `params` — additif, non bloquant).
