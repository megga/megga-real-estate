# WhatsApp Conversation Intelligence — Design

> Date : 2026-06-02
> Statut : validé (brainstorming) — en attente de plan d'implémentation
> Périmètre de cette tranche : **Capture + compréhension** des conversations
> client *entrantes* (la pointe de lance du produit phare). Lecture seule côté
> CRM, validation humaine pour toute action.

## 1. Objectif & vision

**La fonctionnalité phare de MEGGA.** L'agent immobilier vit déjà sur WhatsApp.
On veut que chaque conversation client se capture **toute seule** dans le CRM,
que la voix devienne du texte, et que MEGGA **comprenne** le fil (résumé,
intention, engagements, prochaine action). L'agent ne fait plus de saisie : le
CRM se remplit depuis le canal qu'il utilise déjà. C'est ça qui « gagne la
partie » — la première cause d'échec d'un CRM agent, c'est la saisie manuelle.

Cette tranche livre la **boucle d'entrée** de bout en bout :

```
message client (texte / vocal / média)
   → capté (whatsapp_messages, déjà le cas)
   → média récupéré et stocké (R2)
   → audio transcrit (Deepgram)
   → conversation comprise par MEGGA (résumé + intention + engagements + next action)
   → affiché dans la fiche contact
```

Hors périmètre de cette tranche (tranches suivantes) : l'agent qui répond au
client depuis son WhatsApp appairé, et l'exécution automatique d'actions
(toujours human-in-the-loop ici : MEGGA *propose*, l'agent *décide*).

## 2. Contexte / état actuel (audit 2026-06-02)

**Ce qui existe et marche :**
- `whatsapp-webhook` reçoit les messages entrants (Meta Cloud API, signature
  HMAC), les mappe au contact par numéro, insère dans `whatsapp_messages`
  (idempotent sur `UNIQUE(provider, provider_message_id)`).
- `whatsapp-send` : envoi sortant depuis le CRM (composer `CdWhatsAppCard`).
- Phase 4A : copilote agent (l'agent appaire SON numéro, interroge MEGGA,
  qui peut créer contact / note / agenda, envoi client en tier `confirm`).
- Deepgram déjà utilisé server-side (`speech-to-text`, Nova-2).
- R2 déjà utilisé server-side (`photo-processor`, `aws4fetch` + SigV4).
- DeepSeek déjà utilisé server-side (`whatsapp-agent`, function calling) — c'est l'IA de cette tranche.
- `pg_cron` opérationnel (`flatfox-sync-daily`, `platform-metrics-hourly`).

**Les chemins morts qu'on ouvre ici :**
- **Média Meta jamais récupéré** : `MetaProvider.parseInbound` met
  `mediaUrl: null` (commentaire « media_id → fetch séparé, Phase 2 ») et
  **n'extrait même pas le `media_id`**. Donc images, documents et **vocaux**
  arrivent sans contenu exploitable.
- **Aucune transcription** des notes vocales entrantes.
- **Aucune augmentation** : le fil est stocké mais jamais compris.

**Le canal, pour être au clair :** le client écrit au **numéro WhatsApp Business
de l'agence** (c'est ce que le webhook reçoit). On ne capte PAS le WhatsApp
*personnel* de l'agent — interdit par Meta, risque de bannissement. Le client
parle au numéro MEGGA, l'agent pilote depuis le CRM (et, tranche ultérieure, son
WhatsApp appairé).

## 3. Périmètre de cette tranche (YAGNI)

**Dans le périmètre :**
- Extraction du `media_id` Meta + téléchargement du média + stockage R2.
- Transcription des vocaux entrants (Deepgram) → texte sur le message.
- Compréhension de conversation par MEGGA (DeepSeek) → 1 « insight » courant par
  contact, en lecture seule.
- Affichage : transcript dans les bulles `CdWhatsAppCard` + carte
  « Compréhension MEGGA » dans la fiche contact (résumé + next action proposée,
  non exécutée).
- Traitement **durable** (reprise sur échec) via `pg_cron`.
- Fondation sécurité P0 (cf. §8) et garde-fous LPD (cf. §9).

**Hors périmètre (tranches suivantes, notées au §12) :**
- Réponse de l'agent au client depuis le WhatsApp appairé.
- Exécution automatique d'une action proposée (reste human-in-the-loop).
- Statut de livraison sortant (✓✓ delivered/read) — feature distincte.
- Templates Meta hors fenêtre 24h — feature distincte.
- OCR des documents/images (on stocke et on affiche, on n'analyse pas encore).

## 4. Architecture

### 4.1 Le pipeline en 4 étapes (unités isolées)

1. **Capter** (`whatsapp-webhook`, déjà là, modifié) : à l'insertion d'un
   message entrant, si `media_type` ∈ {audio, image, video, document} ou s'il
   faut (re)calculer l'insight, on marque `processing_status = 'pending'`. Le
   webhook **ACK immédiatement** (200) — pas de travail lourd en ligne.
2. **Récupérer le média** (`_shared/whatsapp-media.ts`) : `media_id` Meta →
   `GET graph.facebook.com/<v>/<media_id>` (donne une URL valable ~5 min) →
   download bytes → upload R2 (clé déterministe) → `media_r2_key`. Le média Meta
   expire vite : on le sécurise dès le premier passage du cron.
3. **Transcrire** (`_shared/whatsapp-transcribe.ts`) : bytes audio (depuis R2)
   → Deepgram Nova-2 (`language=fr`, `detect_language`, `smart_format`) →
   `transcript` + `transcript_confidence` + `transcript_lang` sur le message.
4. **Comprendre** (`_shared/whatsapp-comprehend.ts`) : lit le fil récent du
   contact (≤ 30 derniers messages, ≤ 90 jours, transcripts inclus) → DeepSeek →
   JSON structuré (cf. §5.2) → upsert dans `whatsapp_conversation_insights`.

### 4.2 La décision de robustesse : « le message est le job »

Pas de file externe, pas de `waitUntil` (qui meurt sans reprise). On porte
l'état du traitement **sur la ligne du message** :

- `whatsapp_messages.processing_status` : `pending → processing → done | failed`.
  (`done` aussi pour un texte simple sans média : rien à faire mais l'insight a
  pu être recalculé.)
- Un edge function **`whatsapp-process`** (cron, toutes les minutes) :
  1. **réclame** un lot de `pending` de façon atomique
     (`UPDATE … SET processing_status='processing', claimed_at=now()
       WHERE id IN (SELECT … WHERE processing_status='pending'
       OR (processing_status='processing' AND claimed_at < now()-interval '5 min')
       ORDER BY created_at LIMIT N FOR UPDATE SKIP LOCKED) RETURNING …`)
     — `SKIP LOCKED` évite le double-traitement entre deux invocations.
  2. exécute média → transcription pour chaque message réclamé ;
  3. recalcule l'insight des contacts touchés ;
  4. marque `done`, ou `failed` avec `retry_count++` et `last_error`.
- **Reprise** : un `failed` avec `retry_count < MAX_RETRIES (3)` est re-réclamé
  au tour suivant (backoff simple via `claimed_at`). Au-delà, on s'arrête (ex.
  média expiré côté Meta) et on le laisse `failed` (visible, non bloquant).
- **Idempotence** : tout est rejouable. Transcription et insight écrasent en
  place ; l'upload R2 a une clé déterministe (`wa/<agency>/<message_id>.<ext>`).

C'est ce qui garantit qu'**une note vocale n'est jamais perdue** : tant qu'elle
n'est pas `done`, le cron y revient.

### 4.3 Fichiers (responsabilités isolées, testables)

Backend (Deno / Supabase Edge) :
- `_shared/whatsapp-gateway.ts` *(modifié)* — `NormalizedInboundMessage` gagne
  `mediaId: string | null` ; `MetaProvider.parseInbound` extrait
  `message[type].id` et `message[type].mime_type`. **Logique pure → testée.**
- `_shared/whatsapp-media.ts` *(nouveau)* — `fetchMetaMedia(mediaId, cfg)` (2
  étapes Graph API) + `putR2(key, bytes, contentType)` (réutilise le pattern
  `aws4fetch` de `photo-processor`). I/O isolé.
- `_shared/whatsapp-transcribe.ts` *(nouveau)* — `transcribe(bytes, mime)` →
  `{ transcript, confidence, lang }`. Appel Deepgram isolé.
- `_shared/whatsapp-comprehend.ts` *(nouveau)* — `buildPrompt(thread)` (**pur,
  testé**) + `comprehend(thread, cfg)` → insight validé contre un schéma.
- `whatsapp-process/index.ts` *(nouveau)* — orchestrateur cron : réclame,
  appelle les helpers, écrit les statuts. Auth service-role (cf. §8).
- `whatsapp-webhook/index.ts` *(modifié)* — pose `processing_status='pending'`
  pour média/voix ; marque les contacts à ré-analyser.

Frontend (React) :
- `useWhatsAppMessages.ts` *(modifié)* — expose `transcript`, `media_type`,
  `media_url`, `processing_status` (déjà presque tout là).
- `useConversationInsight.ts` *(nouveau)* — lit
  `whatsapp_conversation_insights` du contact (React Query, RLS agence).
- `CdWhatsAppCard.tsx` *(modifié)* — bulle vocale : 🎤 + transcript (ou « … en
  cours » si `pending/processing`, « transcription indisponible » si `failed`).
- `CdConversationInsight.tsx` *(nouveau)* — carte « Compréhension MEGGA » :
  résumé, intention, engagements, **next action proposée** (bouton qui
  pré-remplit le flux CRM existant ; n'exécute rien tout seul). Badge
  « estimation IA » (règle projet).

Migrations :
- colonnes `whatsapp_messages` (§5.1), table `whatsapp_conversation_insights`
  (§5.2), table `whatsapp_notices` (§9), `pg_cron` (§4.2).

## 5. Modèle de données

### 5.1 `whatsapp_messages` — colonnes ajoutées

```sql
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS processing_status    text NOT NULL DEFAULT 'done'
    CHECK (processing_status IN ('pending','processing','done','failed','skipped')),
  ADD COLUMN IF NOT EXISTS claimed_at           timestamptz NULL,
  ADD COLUMN IF NOT EXISTS retry_count          smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error           text NULL,
  ADD COLUMN IF NOT EXISTS media_r2_key         text NULL,
  ADD COLUMN IF NOT EXISTS media_mime           text NULL,
  ADD COLUMN IF NOT EXISTS transcript           text NULL,
  ADD COLUMN IF NOT EXISTS transcript_lang      text NULL,
  ADD COLUMN IF NOT EXISTS transcript_confidence real NULL;

-- File de travail : index partiel sur ce que le cron réclame.
CREATE INDEX IF NOT EXISTS idx_wa_messages_pending
  ON public.whatsapp_messages (created_at)
  WHERE processing_status IN ('pending','processing','failed');
```

Défaut `'done'` : lignes existantes et sortants ne déclenchent rien. Le webhook
pose `'pending'` sur tout entrant **client à traiter** : média/voix (récupération
+ transcription) **et/ou** message mappé à un contact (recalcul d'insight). Un
entrant texte non mappé à un contact reste `'done'` (rien à faire, pas de fiche
où rattacher un insight).

### 5.2 `whatsapp_conversation_insights` — nouvelle table

Un **insight courant par contact** (upsert). RLS miroir de `whatsapp_messages`.

```sql
CREATE TABLE public.whatsapp_conversation_insights (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id             uuid NOT NULL UNIQUE REFERENCES public.contacts(id) ON DELETE CASCADE,
  agency_id              uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  summary                text NULL,            -- résumé court du fil
  intent                 text NULL,            -- ex 'recherche_achat','prise_rdv','question_doc'
  entities               jsonb NOT NULL DEFAULT '{}'::jsonb,  -- budget, zones, type, pièces, dates…
  commitments            jsonb NOT NULL DEFAULT '[]'::jsonb,  -- engagements pris (agent/client)
  sentiment              text NULL,            -- 'positif' | 'neutre' | 'tendu'
  next_action            jsonb NULL,           -- { type, label, payload }
  model                  text NULL,            -- traçabilité (ex 'deepseek-chat')
  source_message_count   int  NOT NULL DEFAULT 0,
  source_last_message_at timestamptz NULL,     -- debounce : ne recalcule que si plus récent
  generated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_conversation_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_insights_agency_select" ON public.whatsapp_conversation_insights
  FOR SELECT TO authenticated
  USING (agency_id = public.get_my_agency_id());

CREATE POLICY "wa_insights_super_admin_all" ON public.whatsapp_conversation_insights
  FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
-- Écriture : service_role uniquement (le cron), bypass RLS.
```

`next_action.type` ∈ ensemble fermé mappé aux flux CRM existants :
`planifier_visite | envoyer_biens | relancer | qualifier_lead | repondre | rien`.
La tranche se contente d'**afficher** et de pré-remplir ; jamais d'exécuter.

## 6. Contrats des fonctions

- **Webhook (entrant)** : inchangé sur la sécurité (HMAC). Ajoute : extraction
  `mediaId`/`mediaMime`, insertion avec `processing_status='pending'` si
  média/voix (sinon `'done'`), et marque le contact « insight à recalculer »
  (en pratique : tout message entrant texte/voix d'un contact mappé pose
  `pending` sur la ligne, le cron recalcule l'insight du contact).
- **`whatsapp-process` (cron)** : `POST` authentifié **service-role** (cf. §8).
  Réclame ≤ `BATCH (25)` lignes, traite, écrit statuts. Borné en temps (~100s,
  comme `flatfox-sync`), se contente de ce lot, le tour suivant prend la suite.
- **`whatsapp-media.fetchMetaMedia`** : `(mediaId, { metaToken, apiVersion })`
  → `{ bytes, mime }`. Gère le 404/expiré → throw typé → `failed`.
- **`whatsapp-transcribe.transcribe`** : `(bytes, mime)` →
  `{ transcript, confidence, lang }`. Deepgram Nova-2.
- **`whatsapp-comprehend.comprehend`** : `(thread, { deepseekKey })` →
  insight validé. **DeepSeek** (`deepseek-chat`), le même moteur que le copilote agent.

## 7. Robustesse & gestion d'erreur

- **ACK rapide** du webhook (le travail lourd est porté par le cron) → pas de
  rejeu Meta.
- **Réclamation atomique** `FOR UPDATE SKIP LOCKED` → pas de double-traitement
  si deux invocations se chevauchent.
- **Reprise** : `failed` rejoué tant que `retry_count < 3` ; au-delà, laissé
  `failed` (média expiré, audio illisible) — visible, non bloquant pour le fil.
- **Dégradation propre** : si la transcription échoue, la bulle affiche
  « transcription indisponible », le message texte/légende reste lisible.
  Si la compréhension échoue, l'ancien insight reste affiché (jamais d'écran
  cassé). Deepgram/DeepSeek indisponibles → on retente plus tard.
- **Bornes anti-emballement** : `BATCH=25`, `MAX_RETRIES=3`, budget temps ~100s,
  insight recalculé au plus une fois par tour de cron par contact (debounce via
  `source_last_message_at`).

## 8. Sécurité

**P0 — fondation, à corriger avant tout le reste.** `deploy.yml` déploie
**toutes** les fonctions avec `--no-verify-jwt`. Or `whatsapp-agent` (Phase 4A)
suppose `verify_jwt=true` : son garde `isServiceRole()` ne fait que **décoder**
le JWT sans vérifier la signature. Résultat : son contrôle « service-role only »
est contournable (forge d'un JWT `role=service_role`). La nouvelle fonction
`whatsapp-process` tomberait dans le même piège.

Correctif (chirurgical, faible risque) : une allowlist de fonctions « à JWT
vérifié » dans la boucle de `deploy.yml` (sans `--no-verify-jwt`), les autres
restant publiques comme aujourd'hui (webhook HMAC, seller-portal-action,
log-auth-event, detect-new-device…). Membres initiaux de l'allowlist :
`whatsapp-agent`, `whatsapp-process`. On ajoute aussi `[functions.<name>]
verify_jwt = true` dans `config.toml` pour rendre l'intention déclarative.

L'appel interne (webhook → agent ; cron → process) continue de marcher : il
porte la vraie clé service-role **signée**, validée par la plateforme.

Autres garde-fous (inchangés / repris de l'existant) :
- Tout accès DB scopé `agency_id` au niveau SQL (jamais en comparaison JS).
- `whatsapp-process` n'est jamais exposé public ; service-role only.
- Aucun secret/PII en log (status only), comme `whatsapp-agent`.

## 9. Compliance (LPD suisse) — intégrée, pas en rattrapage

- **Avis de traitement (transparence LPD)** : au **premier** message entrant
  d'un numéro pour une agence, MEGGA envoie une fois un avis court
  (« Cette conversation est suivie via MEGGA pour le traitement de votre
  demande… ») et l'enregistre dans `whatsapp_notices (agency_id, wa_phone,
  sent_at)` `UNIQUE(agency_id, wa_phone)`. Idempotent, une seule fois par
  numéro.
- **Sous-traitants IA** : compréhension (**DeepSeek**) et transcription
  (**Deepgram**) traitent du contenu client. Sous-traitants externes, couverts
  par l'avis client ci-dessus et tenus dans l'inventaire des sous-traitants. Le
  moteur de compréhension est figé par décision produit (coût) : **DeepSeek** —
  aucun changement de modèle sans accord explicite.
- **Minimisation** : on conserve le **transcript** (texte) ; l'audio R2 peut
  être purgé après transcription réussie.
- **Rétention / purge** : `pg_cron` quotidien qui purge l'audio R2 après N jours
  et **purge enfin le champ `raw`** (PII brute, dette signalée à l'audit, encore
  non traitée). Durées configurables.
- **Cloisonnement** : RLS par agence sur `whatsapp_conversation_insights` et
  `whatsapp_notices`, comme `whatsapp_messages`.
- **Porte de conformité avant prod** : on peut bâtir L1/L2 en staging, mais
  l'**avis client (L3) doit être actif avant** de traiter de vraies
  conversations client en production.

## 10. UI / UX (fiche contact)

- **Bulles** (`CdWhatsAppCard`) : vocal → 🎤 + transcript ; pendant le
  traitement, « transcription en cours… » ; échec, « transcription
  indisponible ». Image/document → vignette/lien (média R2). Tokens thème,
  pas de couleurs en dur (règle DS).
- **Carte « Compréhension MEGGA »** (`CdConversationInsight`) : résumé,
  intention, entités clés, engagements, et **next action proposée** avec un
  bouton qui ouvre le flux CRM correspondant pré-rempli (planifier visite,
  envoyer des biens, relancer…). Badge « estimation IA » (sparkle). **Aucune
  exécution automatique.**
- États loading / vide / erreur pour chaque (règle projet).

## 11. Tests

- **Unitaires (vitest, purs)** : extraction `mediaId`/mime Meta
  (`whatsapp-gateway`) ; `buildPrompt` + parsing/validation du JSON insight
  (`whatsapp-comprehend`) ; logique de décision retry/claim isolée.
- **Backend (RLS, `tests/backend/`)** : isolation agence de
  `whatsapp_conversation_insights` (miroir de `whatsapp-messages-rls.spec.ts`,
  3 scénarios : voit son agence, pas l'agence B, pas un insight orphelin).
- **Manuel / staging** : vrai vocal Meta → R2 → Deepgram → transcript ; un fil
  réel → insight DeepSeek cohérent ; reprise (couper Deepgram, vérifier le rejeu).
- Mocks pour Deepgram/DeepSeek/Graph en unitaire ; appels réels en staging.

## 12. Phasage / découpe en lots

- **P0 — Sécurité (préalable).** Allowlist `verify_jwt` dans `deploy.yml` +
  `config.toml` (`whatsapp-agent`, `whatsapp-process`). Petit, sûr, mergé seul.
- **L1 — Capture média + transcription.** Migration colonnes + index ;
  `mediaId` dans la gateway ; `whatsapp-media` + `whatsapp-transcribe` ;
  `whatsapp-process` (média + transcription) ; `pg_cron` ; UI bulle vocale.
- **L2 — Compréhension.** `whatsapp_conversation_insights` ;
  `whatsapp-comprehend` (DeepSeek) branché dans le cron ; `useConversationInsight`
  + `CdConversationInsight`.
- **L3 — Compliance.** Avis client (`whatsapp_notices`) ; cron de purge
  (audio R2 + champ `raw`). **À activer avant tout trafic client réel en prod.**

Tranches suivantes (hors ce spec) : réponse agent depuis le WhatsApp appairé ;
exécution human-in-the-loop des next actions ; accusés de livraison ✓✓ ;
templates Meta hors 24h ; OCR des documents.

## 13. Vérification (definition of done de la tranche)

- Un vocal client entrant apparaît transcrit dans la fiche, sans saisie.
- Une image/document client est récupérée et consultable depuis la fiche.
- Le fil produit un insight MEGGA cohérent (résumé + next action), en lecture
  seule, avec badge IA.
- Couper Deepgram/DeepSeek une minute : aucun message perdu, tout se rejoue.
- `npm run build` vert, unitaires + RLS verts.
- `whatsapp-agent` et `whatsapp-process` déployés **verify_jwt vérifié** (P0).
- Avis LPD envoyé une seule fois par numéro ; purge `raw` effective.

## 14. Mise à jour du cerveau (après livraison)

Le cerveau dit encore « Phase 3 lecture seule » et ignore Phase 4A. Après cette
tranche : éditer `.claude-flow/knowledge/megga-memory.seed.json` (entrées
`whatsapp-*`) + `docs/system-map.md` (§6bis), puis `npm run ruflo:seed`.
