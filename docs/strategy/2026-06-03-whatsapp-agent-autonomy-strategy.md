> Stratégie produite par un workflow multi-agents (7 agents : 4 experts cerveau+code → synthèse → red-team → révision), 2026-06-03.

# Stratégie — Agent WhatsApp MEGGA : stable d'abord, autonome ensuite (v finale)

## 1. Résumé exécutif

L'agent boucle DeepSeek exécute des outils KYC lents **en synchrone dans la boucle de réflexion**. Les fenêtres d'abort réelles sont `50_000` ms pour le screening (`whatsapp-actions.ts:608`) et `60_000` ms pour le rapport PDF (`whatsapp-actions.ts:663`), plus jusqu'à `12_000` ms de DeepSeek par tour (`whatsapp-agent/index.ts:25`). Un tour double-KYC peut donc atteindre **~122 s** (12 + 50 + 60), au-delà du timeout `callAgentBrain` de `90_000` ms (`whatsapp-webhook/index.ts:402`) et proche de la limite edge (~150 s). Pendant ce gel, l'agent ne reçoit rien et MEGGA réinjecte ensuite ses propres réponses d'échec comme contexte valide — d'où le ressenti « instable, oublie tout ».

Cible : tour DeepSeek **toujours < 4 s**, tâches lentes livrées en différé, mémoire qui ne rejoue jamais une erreur, échelle d'autonomie qui monte **sans jamais lever le human-in-the-loop légal**. Trois leviers :
- **(A)** sortir les 3 outils KYC lents de la boucle vers une file cron — on clone le pattern `whatsapp-process` déjà en prod ;
- **(B)** marquer et filtrer les réponses d'erreur dans la mémoire 24 h ;
- **(C)** brancher l'`autonomy_gate` DB sur `update_pipeline` — mais **seulement après** avoir ajouté la clé manquante dans `compute_agent_preferences`, sans quoi le câblage est silencieusement mort.

> **Trois corrections de diagnostic, vérifiées contre le code, qui changent le plan :**
> 1. Le quick-win `.neq('status','failed')` proposé par un expert mémoire **ne filtre rien** : les réponses agent sont écrites `status: 'received'` en dur (`whatsapp-webhook/index.ts:360`), jamais un statut de livraison Meta. Seul un marqueur explicite (`is_agent_error`) marche.
> 2. L'élévation de `update_pipeline` via `can_auto_send(profileId, 'pipeline_move')` est **morte au démarrage** sans migration préalable : `compute_agent_preferences` ne produit pas la clé `pipeline_move` dans son `autonomy_gate` (`baseline_remote_schema.sql:780-809`), donc `can_auto_send` renvoie `COALESCE(NULL, FALSE)` = `false` pour TOUT agent (`baseline:678-681`).
> 3. Le worst-case temps n'est pas « 31-46 s » mais **~122 s** (abort screening 50 s + rapport 60 s + DeepSeek 12 s). L'async n'est pas un confort, c'est ce qui empêche le worker d'être tué.

---

## 2. Stabilisation immédiate (< 1 jour, zéro nouvelle archi)

Cinq correctifs déployables aujourd'hui, par ordre de gain. **Honnêteté de cadrage : §2 supprime le « délire » mémoire et le double-screening, mais NE règle PAS les tours KYC lents.** Si l'agent lance un screening ou un PDF, la boucle gèle toujours 50-60 s après §2 — c'est §3 qui stabilise ce cas. §2 réduit la dégradation visible ; il ne rend pas l'agent stable sous charge KYC à lui seul.

**2.1 — Purge ciblée de l'écho mémoire (cause #1 du « il oublie / délire »).**
La requête C1 (`whatsapp-agent/index.ts:86-94`) ré-injecte **tout** l'outbound. `buildHistoryMessages` (`whatsapp-agent-router.ts:109-116`) mappe `outbound→assistant` sans condition. MEGGA relit ses propres échecs (`iaDown`, `cantProcess`, `reformulate`, `tooLarge`, `cantProcessNow`) et les traite comme des faits.

Action : nouvelle colonne `is_agent_error boolean NOT NULL DEFAULT false` sur `whatsapp_messages` (**migration additive à créer** — absente de `20260528150000` et de `20260602090000`). La passer à `true` à l'écriture de l'outbound quand `reply` vient d'une branche d'erreur. Les sites d'écriture concernés : `whatsapp-webhook/index.ts:352-361` (l'upsert outbound — c'est là que le flag se pose, selon la provenance de `reply`) et la valeur retournée par `callAgentBrain` quand elle tombe sur `cantProcess`/`cantProcessNow` (`whatsapp-webhook/index.ts:405,408`). Filtrer `.eq('is_agent_error', false)` dans C1. RLS intacte : `service_role` écrit, policy `agency_select` lit (`20260528150000:67`).

**2.2 — Garde anti-rejeu sur le screening (double crédit Dilisense).**
`execRunKycScreening` (`whatsapp-actions.ts:583-627`) n'a aucun verrou applicatif : seul garde-fou un 429 Dilisense (l.617), non garanti. Sur timeout 50 s + rejeu, un 2e screening part.

`kyc_cases.screening_status` existe (colonne `TEXT` ajoutée par `20260526120000_restore_missing_columns.sql:30`) et `last_screening_at` existe au baseline (`baseline:3959`). **Attention** : `screening_status` est `TEXT` **sans `CHECK`** ; la valeur `'running'` est libre mais non documentée. La migration du §2.2 doit donc ajouter une contrainte `CHECK (screening_status IS NULL OR screening_status IN ('running','done','failed'))` pour figer le vocabulaire. Verrou avant le fetch Dilisense :

```sql
UPDATE kyc_cases SET screening_status='running', last_screening_at=now()
WHERE id = :kc AND (screening_status IS NULL OR screening_status='failed'
                    OR last_screening_at < now() - interval '2 minutes')
RETURNING id;
```

0 ligne → `« Screening déjà en cours, je reviens dans un instant. »`. Dans le `catch` → `screening_status='failed'` (rollback). Le seuil 2 min désenclave un dossier bloqué.

**2.3 — Détail d'erreur loggable sur `kyc-report-pdf` (fin du diagnostic à l'aveugle).**
Le fichier (127 lignes) n'a **aucun** `console.error`. Le détail d'erreur CF est capturé puis **jeté dans le JSON** sans être loggé (`kyc-report-pdf/index.ts:83-84`, `detail: errTxt.slice(0,300)`), et le `catch` global renvoie `err.message` sans le logger (l.121-125). Ajouter 4 `console.error` PII-safe aux phases qui retournent déjà un code : `cf-render` (l.82-84), `pdf-empty` (l.87), `meta-send` (l.107), `catch` global (l.121). Format : `console.error('kyc-pdf cf-render', { kycCaseId, cfStatus })`. Jamais le token, jamais les bytes, `to_phone.slice(-4)` au pire.

**2.4 — Désambiguïser le message de timeout screening.**
`whatsapp-actions.ts:613` dit « il a peut-être abouti » → incite l'agent à relancer (double crédit). Avec le verrou 2.2, le message devient déterministe : `« Le screening tourne, je te donne le résultat dès qu'il est prêt. »` (et c'est la file async du §3 qui le livrera).

**2.5 — Borner la race `kyc-report-pdf` ↔ `execSendKycReport`.**
La fenêtre interne de `kyc-report-pdf` (CF render `55000` ms, `kyc-report-pdf/index.ts:79`, **puis** upload Meta + envoi document) peut dépasser l'abort de `60_000` ms de son appelant (`whatsapp-actions.ts:663`). Conséquence : l'appelant abandonne et rend un message d'échec à l'agent **alors que le PDF est déjà parti au client/agent** côté Meta. Tant que l'envoi reste synchrone, réduire l'abort CF interne à ~45 s et garder la marge upload+send sous les 60 s de l'appelant. Le §3 supprime la race en sortant tout l'appel de la boucle (le worker async a `BUDGET_MS=90_000`, large).

---

## 3. Architecture ASYNC des outils lents (le cœur)

**Principe : ce qui dépasse ~3 s ne vit plus dans la boucle DeepSeek.** Trois outils, tous classés `auto` dans `TOOL_TIERS` (`whatsapp-agent-router.ts:40-42`) : `run_kyc_screening`, `send_kyc_report`, `attach_kyc_document`.

Aucune techno nouvelle. On clone le pattern en production `whatsapp-process` : un job en base, réclamé atomiquement par un cron à la minute, traité hors requête (`whatsapp-process/index.ts` + cron `20260602093000`).

### 3.1 Mécanisme

**Nouveau tier `slow_async`** dans `whatsapp-agent-router.ts`. Quand la boucle (`whatsapp-agent/index.ts:134`) voit un de ces 3 outils :

1. **Enqueue** dans une nouvelle table `whatsapp_async_jobs` :
   ```
   id, profile_id, agency_id, wa_agent_phone text NOT NULL,   -- voir 3.5 : indispensable pour livrer le résultat
   tool, args jsonb, contact_id,
   status text NOT NULL DEFAULT 'pending'
     CHECK (status IN ('pending','processing','done','failed')),
   claimed_at, retry_count smallint NOT NULL DEFAULT 0, last_error, result_summary,
   created_at, expires_at DEFAULT now()+interval '15 minutes'
   -- Idempotence (voir 3.3) : index UNIQUE partiel tolérant le contact_id NULL :
   CREATE UNIQUE INDEX uq_async_dedup ON whatsapp_async_jobs
     (profile_id, tool, COALESCE(contact_id::text, '∅'))
     WHERE status IN ('pending','processing');
   ```
   L'index partiel sur `COALESCE(contact_id::text,'∅')` corrige le piège SQL : `UNIQUE(profile_id,tool,contact_id)` laisse passer deux jobs `contact_id IS NULL` (NULL ≠ NULL), donc un doublon silencieux pour `send_kyc_report` tant que l'args n'est pas résolu. Le `WHERE status IN ('pending','processing')` permet de re-créer un job une fois l'ancien terminé.

2. **ACK immédiat** à DeepSeek comme résultat d'outil : `« Je lance le screening de {nom}, je te reviens dans ~15 s. »`. La boucle conclut en 1 tour.

3. **Message intermédiaire optionnel** avant l'enqueue : fetch Meta direct (`buildSendTextRequest`) `« Je prépare ça. »`. Fenêtre de silence < 2 s.

**Nouvelle edge `whatsapp-agent-async`**, jumelle de `whatsapp-process` :
- réclame via une RPC `claim_whatsapp_async_jobs(p_batch)` calquée sur `claim_whatsapp_jobs` (`20260602090000:27-47`) — `FOR UPDATE SKIP LOCKED`, reprise des `processing` bloqués > 5 min, retry des `failed` < 3 ;
- exécute l'outil lourd : la logique de `execRunKycScreening` / `execSendKycReport` / `execAttachKycDocument` est **déplacée telle quelle** depuis `whatsapp-actions.ts` (mêmes appels) ;
- **livre le résultat à l'AGENT** via `buildSendTextRequest` (jamais au client), au numéro `wa_agent_phone` lu sur le job ;
- `BUDGET_MS = 90_000` identique à `whatsapp-process:23`.

**Nouveau cron** `whatsapp-agent-async-minute`, copie conforme de `20260602093000_whatsapp_process_cron.sql` (garde `pg_cron`-présent incluse, `:10`).

### 3.2 Cas `attach_kyc_document` — le lien Meta qui expire (et un trou que la file seule ne bouche pas)

Particularité (`whatsapp-actions.ts:693-703`) : l'outil re-fetch le média Meta, qui **expire en 5-10 min**. Si l'agent confirme tard, l'OCR échoue (`ocr_completed_at: null`, l.763) **mais les INSERTs continuent** (`documents` l.730, `kyc_magic_link_uploads` l.750) → document sans OCR, rétention 10 ans. La file différée aggrave ce risque : il faut figer les bytes pendant qu'ils sont frais.

**Trou réel à corriger d'abord (non vu dans les analyses précédentes) :** sur le chemin AGENT, le webhook **ne persiste ni `media_id` ni `processing_status`** sur la ligne inbound (`whatsapp-webhook/index.ts:101-114` n'écrit que `body`, `media_type`, `status`). Les bytes sont fetchés en éphémère dans `processAgentMessage` (l.282-303) puis lâchés. Donc `media_r2_key` **n'existe jamais** pour un message agent — on ne peut pas « juste le lire » comme le ferait `whatsapp-process` (qui ne pousse en R2 que le chemin CLIENT, `whatsapp-process/index.ts:81-87`).

Correctif : sur la branche agent du webhook, quand `mediaType ∈ {image,document}`, **persister `media_id` sur la ligne inbound** et **pousser les bytes en R2** au moment du fetch éphémère déjà fait (l.282-303 a les bytes en main — on ajoute un PUT R2 + `media_r2_key`, en réutilisant `buildMediaKey` + `AwsClient` exactement comme `whatsapp-process:84-87`). La file async lit alors `media_r2_key` au lieu de re-fetcher Meta. TTL 24 h sur le key R2 temporaire (LPD, minimisation — le doc canonique vit déjà dans `documents`). Zéro OCR échoué pour lien expiré.

> Note d'idempotence à préserver : `whatsapp-actions.ts:747-749` documente l'absence de dédup `(kyc_case_id, wa_message_id)` — re-joindre le même message recrée un doc. Le passage en async ne doit pas multiplier ce risque : l'index UNIQUE partiel du §3.1 (sur `profile_id, tool, contact_id`) borne déjà les doublons de job, mais ajouter une dédup `(kyc_case_id, wa_message_id)` à l'INSERT `kyc_magic_link_uploads` est le vrai correctif de fond (à cadrer en P2).

### 3.3 Idempotence & dédup (4 niveaux, tous éprouvés ici)

1. **Webhook** : dédup inbound sur `(provider, provider_message_id)` avec `ignoreDuplicates` (`whatsapp-webhook/index.ts:114`) — un rejeu Meta ne crée pas un 2e job. Intact.
2. **Enqueue** : index UNIQUE partiel `COALESCE(contact_id::text,'∅')` (§3.1) → deux fois « envoie le rapport de Dupont » = un seul job tant qu'il est `pending`/`processing`.
3. **Claim** : `FOR UPDATE SKIP LOCKED` → deux ticks cron ne traitent jamais le même job. Pattern identique à `claim_whatsapp_jobs:42`.
4. **Screening** : le verrou `screening_status` du §2.2 reste la dernière barrière côté Dilisense.

### 3.4 Budget temps global dans la boucle (filet de dernier recours)

Même après l'async, borner la boucle : `const T0 = Date.now()` en tête de `serve`, `overBudget = () => Date.now()-T0 > 45_000`, testé en tête du `for(turn)` (`whatsapp-agent/index.ts:108`) et du `for(call)` (l.126). Si dépassé → `break` + un message de repli. **La clé i18n `complexRetry` n'existe pas** (`whatsapp-i18n.ts` ne la contient pas) : il faut la créer dans la même PR. Calqué sur `whatsapp-process:56-77`.

### 3.5 Garde service-role : trancher la divergence (sécurité)

Les deux fonctions de référence n'utilisent pas la même source de secret : `whatsapp-process` compare à `app_config.service_role_key` (`whatsapp-process/index.ts:49`), alors que `whatsapp-agent` compare à `SUPABASE_SERVICE_ROLE_KEY` env (`whatsapp-agent/index.ts:53`). Les deux sont sûres (comparaison à temps constant `safeEqual`), mais `whatsapp-agent-async` est appelée par **pg_cron**, comme `whatsapp-process`. **Décision : aligner sur `app_config.service_role_key`** (le cron envoie ce token via `get_app_config`), exactement comme `whatsapp-process`. Documenter ce choix en tête du fichier. `verify_jwt=FALSE` côté plateforme (clé legacy rejetée sinon), garde applicative obligatoire.

**Effort §3 : M (cœur du chantier).** Une table, une RPC, une edge, un cron — copies de fichiers existants — plus le correctif R2 sur la branche agent du webhook (§3.2). Compliance : le résultat KYC va **à l'agent seul** ; `is_completed` reste réservé MLRO (`whatsapp-actions.ts:768`, commentaire « JAMAIS is_completed — réservé MLRO »), aucune validation automatique.

---

## 4. Mémoire robuste

Au-delà de la purge d'écho (§2.1), trois durcissements de C1 (`whatsapp-agent/index.ts:85-94`). **Priorité honnête : 4.2 > 4.3 > 4.1.**

**4.1 — Index sur `wa_from` / `wa_to` (utile à terme, PAS un fix de stabilité).**
La requête filtre `.or('wa_from.eq…,wa_to.eq…')` sur des colonnes non indexées (seuls `contact_id` et `agency_id` le sont, `20260528150000:49-56`). Mais elle charge **12 lignes max, 3 colonnes légères** (`direction, body, transcript`, l.88) : la latence réelle est de quelques dizaines de ms, pas plusieurs secondes. À l'échelle actuelle, l'impact perçu est marginal face aux 50 s du screening. L'index reste justifié pour la croissance du volume — **mais ne le vendons pas comme un correctif de réactivité.** Deux index `CONCURRENTLY` (zéro lock) :
```sql
CREATE INDEX CONCURRENTLY idx_wa_from_created ON whatsapp_messages (wa_from, created_at DESC);
CREATE INDEX CONCURRENTLY idx_wa_to_created   ON whatsapp_messages (wa_to,   created_at DESC);
```

**4.2 — Garde `waNumber` vide (amnésie silencieuse).** `whatsapp-agent/index.ts:61` : `waNumber=''` → `.or('wa_from.eq.,wa_to.eq.')` ne matche rien → historique vide, sans trace. Court-circuiter avant la requête : `if (!waNumber) console.warn('C1 skipped: no waNumber for profile', profileId)` (PII-safe : profile ID seul). C'est le durcissement mémoire le plus utile : une amnésie totale aujourd'hui invisible.

**4.3 — Dédup des prompts de confirmation.** La fenêtre 24 h / 12 messages reste correcte. Les prompts de confirmation (`stashPending.summary`, `whatsapp-agent/index.ts:273-276`) restent dans le fil 24 h alors que le pending expire en 15 min (`20260531090000:20`) → un vieux « oui » peut être relu comme intention active. À traiter par un flag `is_confirmation_prompt` posé à l'écriture de l'outbound de confirmation, exclu de C1. Le tier CONFIRM (validation explicite) n'est **pas** touché — nettoyage de contexte, pas garde de sécurité.

---

## 5. Échelle d'autonomie L0 → Ln

### 5.1 Le socle légal IMMUABLE (jamais auto, quel que soit le niveau)

Ces actions touchent le **client, l'argent, ou la compliance LBA** → human-in-the-loop **obligatoire**, **non négociable** (réf. cerveau `ai-guardrails`, `kyc-non-blocking` ; CLAUDE.md §5). Le code applique déjà cette ligne :

| Outil | Tier (vérifié) | Raison légale |
|---|---|---|
| `send_client_message` | **confirm** (`whatsapp-agent-router.ts:36`) | Sortie vers un client = la vitrine de l'agence |
| `send_listings` | **confirm** (`:37`) | Envoi client |
| `record_offer` | **confirm** (`:38`) | Acte commercial, montant figé |
| `open_kyc_case` | **confirm** (`:39`) | Ouverture dossier LBA |
| Validation KYC (`dossier_status='verified'`, `is_completed`) | **MLRO humain** | LBA art. 7 al. 1 — verrouillé au trigger `guard_manual_kyc_verified` qui `RAISE EXCEPTION` sur tout bypass manuel (`20260522_003:76-77`) ; l'IA est en **lecture seule** sur le dossier (`whatsapp-actions.ts:768`) |

Précédent fort déjà dans le code : `compute_agent_preferences` garde `proposal_send: false` **même au niveau d'autonomie maximal** (`resume`), avec un commentaire explicite « Human-in-the-loop non négociable côté compliance » (`baseline:803-806`). Le socle ci-dessus suit exactement cette philosophie. Ces lignes ne bougent **jamais**.

### 5.2 L'échelle (ce qui peut monter)

| Niveau | Capacités auto | Garde-fou | Déclencheur |
|---|---|---|---|
| **L0 Lecture** | `get_my_agenda`, `search_contacts`, `get_contact_brief`, `list_followups`, `get_matches`, `get_daily_brief` (tier `read`, `router:22-27`) | aucun (rien n'est modifié) | toujours |
| **L1 CRM réversible** | `create_contact`, `add_note`, `schedule_visit`, `create_reminder`, `qualify_lead` (tier `auto`, `router:28-32`) | **undo /annuler 30 s** (§5.3) | toujours |
| **L2 Tâches lentes** | `run_kyc_screening`, `attach_kyc_document`, `send_kyc_report` | async + verrou screening + lecture seule dossier ; résultat à l'agent seul | toujours (via file §3) |
| **L3 Pipeline** | `update_pipeline` | **auto-avec-undo 60 s** si autorisé, sinon `confirm` | `can_auto_send(profileId,'pipeline_move')` — **après** la migration §5.3 |
| **Socle légal** | — | **confirm / MLRO permanent** | jamais auto (§5.1) |

### 5.3 Mécanismes pour monter en sécurité

**Pré-requis bloquant pour L3 (sinon code mort) : ajouter la clé `pipeline_move` dans `compute_agent_preferences`.** Migration `CREATE OR REPLACE FUNCTION public.compute_agent_preferences` qui ajoute la clé dans chaque branche du `CASE v_autonomy` (`baseline:780-809`) : `suggest → false`, `notify → false`, `resume → true`. Sans ça, `can_auto_send(profileId,'pipeline_move')` lit `(autonomy_gate->>'pipeline_move')` = NULL → `false` pour tous (`baseline:678-681`), et le câblage code ne s'active **jamais**. À shipper **avant** de toucher au code agent. `compute_agent_preferences` se dit elle-même « source de vérité unique » (`baseline:861`) : c'est le bon endroit, le seul.

**Undo différé sur L1 (filet manquant aujourd'hui).** Les outils `auto` s'exécutent sans délai (INSERT immédiat : `execCreateContact:116`, `execScheduleVisit:289`). Une visite au mauvais horaire n'a aucun recours. Table `whatsapp_recent_auto_actions (profile_id, tool, payload_undo jsonb, created_at, undo_until)`. Après l'action : `« Visite planifiée. Tape /annuler dans les 30 s pour défaire. »`. En tête de `processAgentMessage` (`whatsapp-webhook/index.ts:252`), si `undo_until > now()` et message = annulation courte → rollback.

**Undo de `qualify_lead` : prévention PRO-ACTIVE de l'incohérence (durcissement red-team).** `execQualifyLead` insère dans `client_searches` et lance le matching (`whatsapp-actions.ts:367-388`, « Recherche active créée → matching lancé » l.387). Un `/annuler` après coup laisserait un contact sans recherche mais **avec des `matches` en base** — état incohérent. Donc, au moment de l'undo : `SELECT 1 FROM client_searches WHERE contact_id=… AND <active>`. Si une recherche active existe → **ne pas faire un rollback silencieux** ; annuler ce qui est réversible et **dire à l'agent** que la partie matching reste (« J'ai annulé la qualification, mais une recherche + des correspondances ont déjà été générées — je te laisse vérifier dans le CRM »). Jamais d'état muet à moitié défait.

**Brancher l'`autonomy_gate` sur `update_pipeline` (L3, après le pré-requis ci-dessus).** Dans `stashPending` (`whatsapp-agent/index.ts:254`, branche `update_pipeline`), avant de stasher : `SELECT can_auto_send(profileId,'pipeline_move')`. Si `true` → exécuter direct via `execUpdatePipeline` + undo 60 s + audit `activity_events` (déjà posé, `whatsapp-actions.ts:328`) ; sinon → comportement `confirm` actuel. **`update_pipeline` est le SEUL outil qui peut quitter `confirm`** : réversible, pas de flux client/argent. Un agent en `resume` ne tape plus « oui » 10-15×/jour pour un déplacement audité.

**Apprentissage des confirmations (suggestion, jamais auto-élévation).** Table `whatsapp_confirmation_log (profile_id, tool, outcome, created_at)`, écrite à chaque « oui »/« non » (parsés par `parseConfirmation`, `whatsapp-agent-router.ts:89-95`). Après 10 « oui » consécutifs sans « non » sur un outil, l'UI super-admin **propose** de monter le tier — décision **humaine**. MEGGA observe, ne s'auto-autorise rien.

**Débloquer les READ pendant un pending (ampleur réelle plus faible que crue).** Correction de diagnostic : les lectures **fonctionnent déjà** pendant un pending — le `setAside` appelle `callAgentBrain` avec le jeu d'outils complet (`whatsapp-webhook/index.ts:328-329`). Le vrai problème est plus étroit : un message non-oui/non pendant un pending déclenche `callAgentBrain`, et si DeepSeek y tente un **second `confirm`**, `stashPending` renvoie `busy` (`whatsapp-agent/index.ts:139`) → réponse confuse. Le correctif utile n'est donc pas « débloquer les reads » mais **filtrer les outils du second appel sur le tier `read`** pour qu'aucun `confirm` concurrent ne parte tant qu'un pending est ouvert. Aucun impact compliance.

---

## 6. Roadmap séquencée

**Palier 1 — Stabiliser (J, quick-wins).** §2 en entier : `is_agent_error` + filtre C1, verrou `screening_status` (+ `CHECK`), logs `kyc-report-pdf`, message timeout déterministe, borne race PDF (§2.5). + §4.2 (garde waNumber). §4.1 (index) peut suivre, sans le présenter comme un fix de réactivité. → L'agent arrête de délirer et de doubler les screenings. **Les tours KYC lents persistent jusqu'à P2 — à dire clairement.**

**Palier 2 — Asynchrone (le cœur, dépend de P1 pour le verrou screening).** §3 : migration `whatsapp_async_jobs` (table + index UNIQUE partiel + RPC `claim_whatsapp_async_jobs`) + edge `whatsapp-agent-async` (garde `app_config`, §3.5) + cron + tier `slow_async` + budget global boucle (+ clé i18n `complexRetry`) + **correctif R2 sur la branche agent du webhook** (§3.2) + dédup `(kyc_case_id, wa_message_id)`. → Plus aucun tour > 4 s, worker jamais tué, race PDF supprimée. C'est le palier qui rend l'agent stable sous charge.

**Palier 3 — Autonomie sûre (dépend de P2).** D'abord la **migration `compute_agent_preferences` + clé `pipeline_move`** (pré-requis bloquant) → undo 30 s L1 + prévention pro-active `qualify_lead` → branchement `can_auto_send` sur `update_pipeline` avec undo 60 s → filtrage tier `read` du second appel pendant pending. → L'agent en `resume` gagne en fluidité sans franchir une ligne légale.

**Palier 4 — Observabilité & apprentissage (continu).** Timing par tour/outil, wrapper `logWaIncident` unifié, **normalisation des `error.message` Postgres exposés à DeepSeek** (13 sites : `whatsapp-actions.ts:55,79,116,191,205,289,308,326,363,509,564,721,744`), `whatsapp_confirmation_log` + suggestion super-admin.

> **Correction de diagnostic (coût/observabilité) :** remplacer la `callDeepSeek` locale (`whatsapp-agent/index.ts:179`) par `_shared/ai-provider.callDeepSeek` est **infaisable tel quel** — la version partagée n'a ni `tools` ni `tool_choice` dans sa signature ni son corps (`ai-provider.ts:150-171`, `AIOptions` l.19 n'expose que `maxTokens`/`temperature`), indispensables au function-calling. Deux options : **étendre** `ai-provider.callDeepSeek` pour accepter `options.tools`/`tool_choice` et renvoyer `tool_calls`, puis l'utiliser ici ; ou — plus rapide et suffisant — **garder la fonction locale et y ajouter `logUsage` vers `ai_usage_logs`** (les `usage` tokens sont dispo dans `data.usage`, `computeCost('deepseek',…)` et `logUsage` existent déjà, `ai-provider.ts:47,63,189-191`). La 2e rend le coût WhatsApp visible pour `ai-billing-monitor`. P4, pas P1.

---

## 7. Métriques de succès & observabilité

**Stabilité (cible P1+P2) :**
- **p95 durée tour DeepSeek < 4 s** (timing à instrumenter autour de `callDeepSeek` et `runTool`, `whatsapp-agent/index.ts:109,152`). Aujourd'hui : worst-case ~122 s sur tour double-KYC.
- **0 worker tué** (aucun outil > 50 s dans la boucle ; vérifiable par l'absence de jobs `processing` bloqués > 5 min dans `whatsapp_async_jobs`).
- **Double-screening = 0** (compteur sur le verrou `screening_status` : nb de « déjà en cours »).
- **Phase d'échec `kyc-report-pdf` identifiable en 1 coup d'œil** (les 4 `console.error` du §2.3, filtrables dans Supabase Logs).
- **0 PDF parti après abort appelant** (la race §2.5 supprimée par P2 : plus d'envoi Meta hors fenêtre).

**Mémoire (cible P1) :**
- **0 réponse d'erreur réinjectée** (audit : `SELECT count(*) FROM whatsapp_messages WHERE direction='outbound' AND is_agent_error=true` jamais présent dans le contexte C1).
- **0 amnésie silencieuse** (compteur du `console.warn` « C1 skipped: no waNumber » — doit rester à 0 ; >0 = bug de routage).

**Autonomie sans dérapage (cible P3+P4) :**
- **Ratio undo** : `/annuler` déclenchés / actions L1. Un ratio qui grimpe = MEGGA agit trop vite → resserrer, pas élargir.
- **Ratio « non »** par outil (`whatsapp_confirmation_log`). Suggestion de montée de tier émise seulement à **0 « non » sur 10**.
- **Invariant socle légal testé en CI — et rendu réellement parametré.** Le test `whatsapp-agent-router.test.ts:74-81` couvre déjà `toolTier(...) === 'confirm'` pour les 4 outils client/offre + `open_kyc_case`, mais sur le **map statique**. Après le câblage L3, étendre l'assertion : pour `send_client_message`, `send_listings`, `record_offer`, `open_kyc_case`, le chemin d'exécution doit rester `confirm` **même quand `can_auto_send` renvoie `true`** — sinon l'invariant n'est que décoratif. Les tests backend tournent en live (réf. cerveau `backend-tests-run-live-in-ci`), donc l'invariant est exécuté, pas figuratif.

**Coût (cible P4) :**
- **Tokens WhatsApp visibles dans `ai_usage_logs`** (aujourd'hui : 0 ligne pour ce flux → `ai-billing-monitor` aveugle). Worst-case non détecté : `MAX_TOOL_CALLS=10 × 1500 max_tokens × 5 tours` (`whatsapp-agent/index.ts:26,27,186`).

---

### Note de cadrage

Tout est ancré dans le code réel (refs `fichier:ligne` vérifiées une à une) et respecte les contraintes dures : **DeepSeek uniquement** (`model: 'deepseek-chat'`, `whatsapp-agent/index.ts:186` ; aucune bascule Claude), **human-in-the-loop légal intact** (socle §5.1 immuable, KYC en lecture seule `whatsapp-actions.ts:768`, validation MLRO verrouillée au trigger `20260522_003:76`), **persona employée modèle** (messages courts sans fluff, jamais d'ID brut au client, résultats KYC à l'agent seul — conforme au SYSTEM prompt `whatsapp-agent/index.ts:29-43`).

Corrections de diagnostic intégrées après vérification dans le code : le quick-win `status≠failed` (inopérant, outbound = `'received'` en dur, `webhook:360`) ; la réutilisation de `ai-provider.callDeepSeek` (ne supporte pas les tools, `ai-provider.ts:150-171`) ; le worst-case temps réévalué de ~46 s à **~122 s** ; **L3 `pipeline_move` mort sans migration `compute_agent_preferences`** (`baseline:780-809`) — corrigé en pré-requis bloquant ; `screening_status` `TEXT` sans `CHECK` — contrainte ajoutée ; reads déjà fonctionnels pendant un pending (`setAside`, `webhook:328`) — correctif recentré sur le filtrage `read` du second appel. Deux trous trouvés en propre, absents des deux analyses : (1) la branche agent du webhook ne persiste ni `media_id` ni `media_r2_key` (`webhook:101-114`), donc `attach_kyc_document` async ne peut pas « lire R2 » sans correctif amont ; (2) les clés i18n `complexRetry` et les ACK async **n'existent pas** dans `whatsapp-i18n.ts` et sont à créer.

**Fichiers à créer (Palier 2) :** `supabase/functions/whatsapp-agent-async/index.ts` · `supabase/migrations/*_whatsapp_async_jobs.sql` (table + index UNIQUE partiel + RPC `claim_whatsapp_async_jobs`) · `supabase/migrations/*_whatsapp_agent_async_cron.sql`.
**Fichiers à créer (Palier 1) :** `supabase/migrations/*_whatsapp_messages_agent_error.sql` (colonne `is_agent_error`) · `supabase/migrations/*_kyc_screening_status_check.sql` (CHECK + sémantique du verrou).
**Fichiers à créer (Palier 3) :** `supabase/migrations/*_autonomy_gate_pipeline_move.sql` (`CREATE OR REPLACE compute_agent_preferences` + clé) · `supabase/migrations/*_whatsapp_recent_auto_actions.sql` · `supabase/migrations/*_whatsapp_confirmation_log.sql`.
**Fichiers à modifier (Paliers 1-4) :** `supabase/functions/whatsapp-agent/index.ts` · `supabase/functions/whatsapp-webhook/index.ts` (dont push R2 branche agent, §3.2) · `supabase/functions/kyc-report-pdf/index.ts` · `supabase/functions/_shared/whatsapp-agent-router.ts` · `supabase/functions/_shared/whatsapp-actions.ts` · `supabase/functions/_shared/whatsapp-i18n.ts` (clés ACK async + `complexRetry`) · `supabase/functions/_shared/whatsapp-agent-router.test.ts` (invariant socle légal paramétré) · `supabase/functions/_shared/ai-provider.ts` (P4, extension tools — optionnel).

---

## Annexe — passe red-team (extrait)

J'ai tout ce qu'il me faut. Voici l'analyse complète.

---

## Red-team : stratégie agent WhatsApp MEGGA

### Verdict global

La stratégie est solide dans ses principes et bien ancrée dans le code réel. Elle ne viole pas le human-in-the-loop légal et respecte DeepSeek-only. Mais elle contient quatre erreurs factuelles et deux trous de compliance qui nécessitent des corrections avant implémentation.

---

### (a) Human-in-the-loop légal — PASS, avec un trou à boucher

Le socle légal (§5.1) est correctement identifié et les outils `send_client_message`, `send_listings`, `record_offer`, `open_kyc_case` sont bien en `confirm` dans `whatsapp-agent-router.ts:35-40`. Le trigger `auto_verify_kyc_dossier` n'est pas touché.

**Trou réel :** La stratégie propose d'activer `update_pipeline` en L3 via `can_auto_send(profileId, 'pipeline_move')`. Ce mécanisme est DOA sans correction préalable. La fonction `compute_agent_preferences` (baseline:780-808) ne contient pas la clé `'pipeline_move'` dans son `autonomy_gate` — les clés existantes sont `relance_simple`, `sms_courtoisie`, `accuse_reception`, `email_followup`, `briefing_today`, `proposal_send`. `can_auto_send` retourne donc `COALESCE(NULL, FALSE)` = `false` pour tout agent, même en mode `resume`. L3 ne fonctionnerait jamais. Correction requise : une migration qui ajoute `'pipeline_move': false/true` dans le `CASE v_autonomy` de `compute_agent_preferences` avant de câbler le code.

**Autre trou (mineur) :** Le `setAside` (webhook:328-3
