# WhatsApp — Boutons de réponse et confirmations du copilote — Design

> Date : 2026-09-10 · Statut : implémenté et relu (branche `claude/whatsapp-no-response-diagnostic-fd6bd7`,
> plan `docs/superpowers/plans/2026-09-10-whatsapp-boutons-confirmations.md`) — preuve en
> production à faire après le merge (§7)
> Chantier 1 sur 2. Le chantier 2 (questionnaires client : qualification, avis après visite)
> aura sa propre spec et réutilisera le socle posé ici.
> Aucune migration. IA inchangée (DeepSeek).

## 1. Objectif

Quand le copilote WhatsApp demande à l'agent de confirmer une action, l'agent reçoit deux
boutons — **[Oui] [Non]** — au lieu de devoir taper sa réponse. C'est le premier usage d'un
socle générique : envoyer un message à boutons et savoir, à la réception, lequel a été touché.

Ce chantier sert l'objectif n°1 du Document Maître (réduire le temps administratif) et pose
la mécanique dont les questionnaires client auront besoin.

## 2. Pourquoi un bouton n'est pas un « oui » tapé

**Un bouton reste dans la conversation.** Un « oui » tapé répond toujours à la question du
moment ; un bouton [Oui] peut être touché une semaine plus tard, sous une question ancienne.
Lire son seul libellé reviendrait à confirmer l'action en attente *au moment de l'appui* — par
exemple une publication sur les portails — alors que l'agent avait sous les yeux un
déplacement de deal.

**Décision : le bouton porte l'identifiant de l'action qu'il confirme** (approche A). Les
approches écartées :

- **B — relier la réponse au message d'origine** (`context.id` de Meta, stocké sur l'action) :
  même garantie, mais une colonne de plus et une dépendance à un champ que Meta renvoie sans
  l'engager contractuellement.
- **C — libellé seul** : rien à construire à la réception, et le défaut ci-dessus.

## 3. Comportement côté agent

1. **Chaque demande de confirmation arrive avec [Oui] [Non]** ([Yes] [No] en anglais) : les
   outils de tier `confirm` du copilote (`update_pipeline` hors autonomie, `record_offer`,
   `open_kyc_case`, `send_kyc_link`, `send_listings`, `publish_to_portals`,
   `withdraw_from_portals`, `delete_contact`, `invite_optin`, `send_client_message`,
   `send_client_email`) et la proposition de template quand la fenêtre 24 h d'un client est
   fermée (`send_template`).
2. **Le texte de la question ne change pas.** Il garde « (« oui » / « non ») », qui reste
   vrai puisque taper continue de marcher, et c'est ce même texte qui part si les boutons
   échouent. Une seule rédaction pour les deux rendus.
3. **Question trop longue.** Meta borne le corps d'un message à boutons à 1024 caractères —
   un brouillon client peut dépasser. Au-delà, MEGGA envoie le texte complet, puis un court
   « Tu confirmes ? » portant les boutons. **Un brouillon n'est jamais tronqué** : l'agent
   valide exactement ce qui partira.
4. **Bouton périmé** (action déjà traitée, annulée, remplacée par une autre, ou expirée
   PUIS purgée) : MEGGA répond « Ce bouton ne correspond plus à une action en attente (déjà
   traitée, annulée ou expirée) : cet appui n'a rien déclenché. » L'action en attente, s'il y
   en a une, **n'est pas consommée**, et le copilote n'est pas appelé. Un double appui tombe
   dans ce cas.
   ⚠ **Le texte parle de l'APPUI, jamais de l'action** (corrigé en revue) : sur un double
   appui, le premier a exécuté l'action, et « rien n'a été fait » ferait croire à l'agent que
   l'envoi n'a pas eu lieu — il le relancerait, doublon vers le client.
   Une action expirée mais pas encore purgée n'est pas « périmée » : l'identifiant correspond,
   et le chemin existant répond « La demande en attente a expiré ».
   **Si une AUTRE action attend encore** (valide) au moment de l'appui périmé, elle est remise
   sous les yeux de l'agent avec SES boutons (ajout de la revue 6 à 9) : sinon l'agent qui
   retape « oui » après le refus confirmerait une action qu'il n'a plus en vue.
   **Une panne n'est jamais prise pour « périmé »** : si la lecture de l'action en attente ou
   son verrou (DELETE) échoue, l'appui reçoit « Désolé, je n'ai pas pu traiter ta demande pour
   le moment » (`cantProcessNow`), jamais « déjà traitée ».
5. **Action déjà en attente** (`busy`) : le rappel reprend la question de l'action qui
   attend (son `summary`), avec ses boutons. Sans elle, [Oui] confirmerait une action que
   l'agent n'a plus sous les yeux — précisément ce que l'identifiant dans le bouton évite.
6. **Taper reste possible** : « oui », « non », ou une correction de brouillon, exactement
   comme aujourd'hui.
7. **Repli** : si Meta refuse le message à boutons **à l'envoi** (réponse d'erreur
   synchrone), MEGGA envoie la version texte. ⚠ Ce repli ne couvre PAS un échec signalé plus
   tard par un statut `failed` (ex. 131026, client WhatsApp trop ancien) : rien ne renvoie
   alors la question en texte, et l'alerte d'échec de livraison ne vise que les messages à
   un client. Improbable pour un agent ; piste notée en suite possible (relancer le texte
   depuis `applyStatusUpdates` pour une ligne portant `raw.interactive_buttons`).

## 4. Pièges identifiés pendant la conception

- ⛔ **Un libellé de bouton ne doit JAMAIS être un mot-clé STOP.** Le webhook traite un
  appui sur un bouton dont le libellé est un mot de désinscription comme un **opt-out par
  bouton**, AVANT la bifurcation agent/client (`whatsapp-webhook/index.ts`, bloc « 2ter »).
  « Cancel » figure dans la liste internationale de `whatsapp-stop-keywords.ts` : un bouton
  [Cancel] désinscrirait l'agent de son brief du matin. Les libellés sont donc Oui/Non et
  Yes/No, un test le verrouille, et — par défense en profondeur — une réponse dont
  l'identifiant est un identifiant de confirmation MEGGA n'entre jamais dans ce bloc.
- ⛔ **La porte CI énumère les constructeurs.** `scripts/check-whatsapp-outbound.mjs`
  (propriété 1) n'autorise `buildSend*Request` que dans la gateway et la garde, mais
  reconnaît ces constructeurs par une alternative fermée
  `buildSend(Text|Image|Document|Template)Request`. Un constructeur ajouté lui échappe : il
  pourrait être appelé n'importe où sans passer par la garde de consentement. La règle
  devient `buildSend\w*Request`, **sans point devant** (revue 6 à 9) : la forme pointée
  laissait passer une déstructuration (`const { buildSendTextRequest } = provider`), un accès
  par crochets et un `buildSendRequest` nu.
- ⚠ **La limite de 1024 caractères se mesure sur le texte qui PART**, c'est-à-dire après
  `formatOutboundText` (`_shared/whatsapp-format.ts` : `meggaProse` puis `toWhatsAppText`).
  La garde et le découpage appellent la MÊME fonction — l'invariant est structurel depuis la
  revue, plus une convention ; le constructeur refuse au-delà en seconde ligne.
- ⚠ **Le corps d'un entrant reste le LIBELLÉ**, jamais l'identifiant : il alimente le corpus
  de voix et la compréhension (commentaire existant de `parseInbound`). L'identifiant vit
  dans un champ séparé.

## 5. Architecture

Aucune migration : `whatsapp_pending_actions.id` (uuid) existe, l'entrant garde son payload
Meta complet dans `raw`.

### 5.1 `_shared/whatsapp-gateway.ts`

- **Sortant.** `OutboundButtonsMessage { toPhone; body; buttons: { id; title }[] }` et
  `MetaProvider.buildSendButtonsRequest`, qui produit :
  `{ messaging_product: 'whatsapp', to, type: 'interactive', interactive: { type: 'button',
  body: { text }, action: { buttons: [{ type: 'reply', reply: { id, title } }] } } }`.
  Il **lève** hors des limites Meta : 1 à 3 boutons, `title` de 1 à 20 caractères, `id` de 1
  à 256 caractères et unique dans le message, `body` de 1 à 1024 caractères.
- **Entrant.** `NormalizedInboundMessage.replyId: string | null`, lu dans cet ordre :
  `interactive.button_reply.id`, `interactive.list_reply.id`, `button.payload`. `body` et
  `bodySource` sont inchangés.

### 5.2 `_shared/whatsapp-confirm-buttons.ts` (nouveau, pur)

- `confirmReplyId(pendingId, choice)` → `pa:<uuid>:yes` | `pa:<uuid>:no` ;
  `parseConfirmReplyId(replyId)` → `{ pendingId, choice } | null` (null pour tout ce qui
  n'est pas exactement cette forme, uuid compris).
- `planConfirmation(prompt, pendingId, lang)` → la suite ORDONNÉE des payloads à envoyer :
  `[buttons(prompt)]` si le texte formaté tient en 1024 caractères, sinon
  `[text(prompt), buttons(confirmShort)]`.
- `resolveButtonDecision(replyId, currentPendingId)` → `'yes' | 'no' | 'stale' | null` —
  `null` quand la réponse n'est pas un bouton de confirmation (le chemin tapé actuel
  s'applique), `stale` quand l'identifiant ne désigne pas l'action en attente.
- `deliverConfirmation(plan, prompt, send)` (revue 6 à 9) : déroule le plan avec un
  expéditeur INJECTÉ et porte les trois règles d'envoi — boutons seulement si le texte complet
  est parti ; un message à boutons SEUL refusé hors garde retombe sur le texte ; un refus de
  garde arrête tout. Rend les échecs hors garde, que l'appelant journalise. Sept cas testés.

### 5.3 `_shared/whatsapp-outbound-guard.ts`

- `OutboundPayload` gagne `{ type: 'buttons'; body: string; buttons: { id; title }[] }`.
- `needsOpenWindow` inchangé : tout ce qui n'est pas un template exige la fenêtre — un
  message à boutons en est un comme un autre.
- `buildRequest` : même mise en forme que le texte (`formatOutboundText(body)`).
- Persistance : un sortant à boutons garde `raw = { interactive_buttons }` — sans cette trace,
  un message à boutons et son repli texte laissaient des lignes identiques, et la preuve de
  production (§7) ne pouvait pas les distinguer. Les identifiants ne sont pas une donnée
  personnelle ; `raw` est déjà purgé à 30 jours.
  Une levée du constructeur remonte par le chemin existant `{ ok: false, blocked: false }`.
- `outboundBody` : le corps journalisé est le texte de la question.

### 5.4 `whatsapp-agent/index.ts`

- `stashPending` récupère l'identifiant inséré (`insert(...).select('id').single()`) et le
  rend ; en `busy`, il rend l'identifiant ET le `summary` de l'action qui attend, que le
  rappel reprend sous le texte `busy`.
- La réponse HTTP devient `{ reply, confirmPendingId? }` sur ces deux chemins ; tous les
  autres chemins restent `{ reply, isError? }`.

### 5.5 `whatsapp-webhook/index.ts`

- `callAgentBrain` propage `confirmPendingId`.
- **`sendConfirmation`** (nouvelle) : construit le plan (`planConfirmation`) et le confie à
  `deliverConfirmation` avec `sendOutboundGuarded` comme expéditeur (`purpose: 'service'`,
  `retry: true`, `isAutomated: true`) ; journalise les échecs hors garde. ⛔ Dans le cas
  découpé, les boutons ne partent **que si le texte complet est parti** : on ne fait jamais
  confirmer un brouillon que l'agent n'a pas reçu. Un refus de garde n'appelle aucun repli
  (le texte serait refusé pour la même raison).
- `offerTemplateFallback` rend aussi l'identifiant de l'action créée, et `executePending`
  le propage jusqu'à `sendConfirmation`.
- **Réception, avant la branche undo et la branche pending** : si la LECTURE de l'action en
  attente a échoué et que la réponse est un bouton MEGGA → `cantProcessNow`, arrêt. Sinon
  `resolveButtonDecision`. `stale` → si une autre action valide attend, `staleButton` suivi
  de sa question avec SES boutons (`sendConfirmation`) ; sinon `staleButton` seul ; arrêt
  (ni cerveau, ni verrou). `yes`/`no` → la décision vient du bouton, puis le chemin existant
  s'applique tel quel (verrou gagnant-unique, échéance, exécution, journal de confirmation).
  Si le verrou échoue parce qu'un appui concurrent l'a pris, la réponse est `staleButton` —
  jamais un appel au cerveau avec « Oui » ; si c'est le DELETE lui-même qui a échoué,
  `cantProcessNow`.
- Bloc opt-out par bouton (2ter) : ignoré quand `parseConfirmReplyId(msg.replyId)` n'est pas
  `null`.

### 5.6 `_shared/whatsapp-i18n.ts`

`btnYes` (Oui / Yes), `btnNo` (Non / No), `confirmShort` (Tu confirmes ? / Confirm?),
`staleButton` — en `fr` et `en`, parité vérifiée par `whatsapp-i18n.test.ts`.

### 5.7 `scripts/check-whatsapp-outbound.mjs`

Propriété 1 : `buildSend\w*Request`, sans point devant, au lieu de l'alternative fermée.

## 6. Tests

Vitest. ⚠ Tout nouveau fichier de test sous `supabase/functions/_shared/` doit être ajouté à
la liste d'inclusion écrite en dur de `vitest.config.ts`, sinon il ne tourne jamais.

- **Gateway** : forme exacte du payload interactif ; levée à 0 et 4 boutons, libellé de 21
  caractères, identifiant de 257, identifiants dupliqués, corps de 1025 ; `replyId` lu pour
  `button_reply`, `list_reply` et le `payload` d'un bouton de template ; `body` reste le
  libellé.
- **Confirm-buttons** : aller-retour de l'identifiant ; rejets (préfixe étranger, uuid
  invalide, choix inconnu, `null`) ; découpage à 1024 et 1025 caractères formatés ;
  matrice de décision (bon identifiant oui/non, autre action en attente, aucune action,
  réponse non-confirmation).
- **i18n** : les quatre clés dans les deux langues ; **aucun libellé de bouton n'est détecté
  par `detectStopRequest`**.
- **Garde** : un payload `buttons` est refusé `window_closed` hors fenêtre ; le corps
  persisté est le texte de la question.
- **Porte CI** : `node scripts/check-whatsapp-outbound.mjs` vert, et rouge sur un appel de
  `buildSendButtonsRequest` placé hors de la gateway et de la garde (vérifié à la main).
- Les suites WhatsApp existantes (`whatsapp-agent-router`, `whatsapp-gateway`,
  `whatsapp-outbound-guard`, specs backend `tests/backend/whatsapp-*`) restent vertes ;
  `npm run build`.

## 7. Preuve en production

Merger `main` déploie les fonctions edge. Prérequis : un contact de test dans
« MEGGA Agence », qui n'en compte aucun au 10.09.2026.

1. Julien demande au copilote une action de tier `confirm` → la question arrive avec
   [Oui] [Non] ; [Oui] exécute l'action.
2. Il touche de nouveau ce [Oui] → « Ce bouton ne correspond plus à une action en attente
   (déjà traitée, annulée ou expirée) : cet appui n'a rien déclenché. », et rien ne
   s'exécute. Si une AUTRE action attend à ce moment, elle est remise sous ses yeux avec ses
   propres boutons (ajout de la revue des tâches 6 à 9).
3. Un brouillon client de plus de 1024 caractères → deux messages, le second portant les
   boutons.

Vérifié dans `whatsapp_messages` (sortant à boutons persisté avec `raw.interactive_buttons`, entrant « Oui » avec l'id dans
`raw`) et dans les journaux de `whatsapp-webhook` / `whatsapp-agent`.

## 8. Hors périmètre

- Bouton [Modifier] sur les brouillons (taper une correction marche déjà).
- Bouton [Annuler] après une action automatique (aujourd'hui `/annuler`).
- Messages liste, WhatsApp Flows, questionnaires client — chantier 2.
