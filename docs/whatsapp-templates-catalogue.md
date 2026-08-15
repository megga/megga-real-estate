<!-- Catalogue des prochains templates WhatsApp — exploration multi-agents du 14.08.2026.
     Ancré sur le code et sur des mesures en base de production, pas sur des idées.
     Les 3 premiers templates (megga_followup / megga_availability / megga_new_listings)
     ont été soumis à Meta le même jour et ne sont pas rediscutés ici. -->

# WhatsApp — catalogue de templates : retenus, écartés, et ce qui bloque

**Verdict en une ligne :** 6 retenus sur 9, **aucun n'était correct tel que rédigé** (les 6 sont des corps réécrits), 3 écartés, **0 activable aujourd'hui**, et **rien n'est soumissible avant d'avoir tranché la convention de nommage**. Plusieurs preuves du catalogue initial étaient fausses ; elles sont corrigées au fil du texte.

Trois faits transversaux qui commandent tout le reste :

- **Le WABA est mono-numéro partagé entre toutes les agences.** Un corps qui ne nomme pas l'émetteur arrive d'un numéro inconnu → blocage/signalement → le quality rating tombe pour *tous* les tenants, y compris sur les 3 templates déjà approuvés. C'est pourquoi 5 des 6 corps corrigés introduisent une variable « agence/agent » qui n'existait pas dans la proposition.
- **« Opt-in transactionnel » n'existe pas.** Meta exige un opt-in pour **toutes** les catégories, UTILITY comprise ; la catégorie règle le tarif et la fenêtre, pas le consentement. Côté nLPD, un numéro saisi pour organiser une visite n'est pas un consentement à être joint sur WhatsApp (limitation de finalité). Le champ `needs_optin` du catalogue est faux en droit sur les 9 fiches et doit être réécrit avant d'être repris ailleurs.
- **Aucun template ne peut porter d'URL ni de bouton.** `OutboundTemplateMessage` n'expose que `bodyParams` (`_shared/whatsapp-gateway.ts:47-52`) et `buildSendTemplateRequest` ne construit qu'un composant `body` (:316-336). D'où le parcours en deux temps (question fermée → réponse client → fenêtre 24 h → lien en texte libre). Ajouter un bouton URL est un chantier gateway, pas un choix de rédaction.

---

## 1. Templates retenus (6), par priorité révisée

Les priorités du catalogue initial ne survivent pas à la mesure : `visits` compte **0 ligne en production**, ce qui fait tomber les trois P1 « visite ». La priorité ci-dessous est reclassée sur *l'existence réelle d'une population* et *la traçabilité de l'opt-in*.

### P1 — `agent_daily_brief` · UTILITY · agent-facing

**Corps :**
> Bonjour {{1}}, votre point du jour MEGGA compte {{2}} élément(s) à traiter : visites, relances, offres à échéance et nouveaux leads. Répondez « mon point du jour » pour recevoir le détail ici.

**Variables :** {{1}} prénom de l'agent · {{2}} nombre d'éléments (entier ; rendre « plus de 12 » côté appelant quand `SQL_LIMITS` sature, ne jamais passer « 12+ » en échantillon Meta).

**Déclencheur :** push matinal du morning brief vers l'agent, quand la fenêtre 24 h est fermée. `whatsapp-morning-brief/index.ts` en-tête **lignes 14-17** (pas 16-18 comme écrit) : « fenêtre 24 h PAS trackée … échec silencieux journalisé + claim relâché ». Correction de preuve : ce n'est **pas** 07h30 heure de Zurich — le gate est à 07h locale avec filet à 08h, crons 05:30/06:30/07:30 UTC, donc pire cas ~08h30. Le gate `whatsapp_morning_brief_enabled='false'` est un **seed de migration** (`20260705180000`), pas une mesure en base.

**Opt-in :** le seul du lot qui soit **traçable aujourd'hui** — `whatsapp_agent_links.verified` + `verified_at`, opt-out par agent via `morning_brief_enabled`. L'agent est utilisateur du service, pas un contact démarché.

**Pourquoi le corps a changé :** l'original demandait la permission (« Souhaitez-vous le recevoir ici ? ») au lieu de livrer un fait — lecture marketing quasi assurée, et branché sur le code actuel il écrit `confirmed_at` sur le teaser (:310-314), donc la journée est marquée livrée avec zéro information et la dédup `whatsapp_daily_briefs` bloque toute reprise. Le corps corrigé porte le décompte, donc délivre de la valeur hors fenêtre, et « mon point du jour » retombe sur l'outil copilote `get_daily_brief` qui existe déjà (`whatsapp-tools.ts:133`).

**Reste à faire :** deux versions (fr + en — `composeMorningBrief` est bilingue via `profiles.spoken_languages`, `morning-brief.ts:113-119`) ; **rien en DE/IT**, le brief ne sait pas y répondre. Gérer le singulier. Et trancher le sujet dans le registre de consentement (voir §3, point F).

### P1 — `kyc_documents_missing` · UTILITY · client

**Corps :**
> Bonjour {{1}}, il manque encore une ou plusieurs pièces à votre dossier chez {{2}}. Souhaitez-vous recevoir le lien de dépôt sécurisé ?

**Variables :** {{1}} prénom (repli « Madame, Monsieur ») · {{2}} nom de l'agence.

**Déclencheur :** détecteur 6 de l'automation-engine, `kyc_cases.status='in_progress' AND completion_pct<100 AND created_at < now()-3j` (`automation-engine/index.ts:405-441`), cron `hourly-automation-scan` `0 * * * *` actif. **C'est la preuve la mieux tenue du lot** : 2 lignes `reminders type='missing_document'` en prod, et 2 `kyc_cases` remplissent la condition à l'instant. Correction de citation : le corps e-mail est `send-reminder-email/index.ts:66-79`, pas 72-82 (80-82 = template `custom`).

**Opt-in :** requis comme partout. Et le mot « vérification » a sauté du corps volontairement : il **divulgue un statut LAB/KYC** sur un canal grand public (aperçu écran verrouillé, WhatsApp Web partagé, sauvegardes cloud). Les 3 templates déjà soumis ne fuitent qu'« un projet immobilier ».

**Ce qui reste bancal, à assumer :** la promesse du corps est **intenable aujourd'hui**. `executeSendKycLink` (`_shared/whatsapp-actions.ts:1499-1539`) fige `channels: ['email']` et refuse net sans e-mail (:1510). `kyc_magic_links` = **0 ligne** : le lien n'a jamais été émis une seule fois. Un « oui » sur WhatsApp ouvre une fenêtre 24 h vers une impasse. Le template est soumissible, il n'est pas activable avant que ce chemin accepte un contact sans e-mail.

### P2 — `visit_reminder` · UTILITY · client

**Corps :**
> Bonjour {{1}}, {{2}} vous rappelle votre visite du bien {{3}}, prévue {{4}}. Ce créneau vous convient-il toujours ?

**Variables :** {{1}} prénom · {{2}} agence · {{3}} intitulé du bien · {{4}} date et heure, ex. « le 16.03.2026 à 14h00 » (la préposition est dans la variable — le formateur d'exécution doit produire exactement ça).

**Déclencheur :** crons `visit-reminders-j1` (`17 * * * *`) et `visit-reminder-hourly` (`15 * * * *`), fenêtre +12 h/+36 h, `reminder_sent=false`, `buyer_email IS NOT NULL` (`20260617160000_crons_service_key_and_guc_hygiene.sql:76-104`).

**Correction de preuve, et elle est lourde :** `visits` compte **0 ligne en production** (contacts 15, properties 6, whatsapp_messages 172). Le cron tourne 24×/jour sur une table vide et `reminder_sent` n'a **jamais** été posé. Le P1 revendiqué n'est pas tenable, et `megga_availability` — déjà approuvé — couvre le seul cas qui existe réellement aujourd'hui.

**Trois verrous techniques avant activation :** (1) la requête cron ne SELECT que `FROM visits`, sans jointure `contacts` : aucun téléphone n'est atteignable, et `visits.buyer_phone` est nullable sans normalisation E.164 ; (2) `execScheduleVisit` (`whatsapp-actions.ts:448-455`), chemin de création principal du copilote, n'insère **ni** `buyer_email` **ni** `buyer_phone` — ces visites sont structurellement invisibles au cron sur les deux canaux ; (3) `reminder_sent` est un booléen unique déjà partagé par les deux crons live : un second canal brûlerait le drapeau du premier. Il faut **un drapeau par canal**.

### P2 — `visit_change` · UTILITY · client

**Corps :**
> Bonjour {{1}}, {{2}} doit annuler la visite du bien {{3}} prévue {{4}}. Souhaitez-vous convenir d'un autre créneau ?

**Variables :** {{1}} prénom · {{2}} agence · {{3}} bien · {{4}} créneau annulé.

**Déclencheur :** annulation d'une visite par l'agent. **Le corps a été restreint à l'annulation seule** : sur un déplacement, l'agent a déjà choisi le nouveau créneau, et lui répondre « ne peut pas être maintenue, souhaitez-vous convenir d'un autre créneau ? » cache l'information utile et impose un aller-retour — l'inverse de l'objectif revendiqué. Le report se sert par `megga_availability`, déjà approuvé.

**La justification « un seul template pour report et annulation » était fausse** : ce sont deux intentions, et `_shared/booking-email.ts:16` (ligne 16, pas 17) le prouve en gardant `'confirmed' | 'rescheduled' | 'cancelled'` séparés dans le module voisin cité en preuve. Meta facture l'approbation par template, pas par intention.

**Prérequis propre, en base :** l'annulation agent **n'est jamais persistée**. `setStatus(id,'cancelled')` (`CalendarApp.tsx:381-403`) ne touche que du state React, la branche serveur est gardée par `status === 'done'` sans `else`, et le seul geste qui atteint la base est `deleteVisit` (`useVisits.ts:151,197`) qui **supprime la ligne**. Tant que c'est le cas, il ne reste ni destinataire ni `scheduled_at` pour remplir {{4}} : le template ne peut pas se déclencher, même registre de consentement livré.

⚠ Piège d'heure : si l'on réutilise le formateur du module visites, il calcule sur `getHours()`, donc en UTC en edge — 1 à 2 h de décalage selon la saison (défaut documenté en tête de `_shared/booking-email.ts:4-9`). Annoncer une mauvaise heure est pire que le silence.

### P3 — `visit_feedback` · UTILITY · client

**Corps :**
> Bonjour {{1}}, {{2}} souhaite recueillir votre avis sur la visite du bien {{3}}, le {{4}}. Pouvez-vous répondre en quelques mots ?

**Variables :** {{1}} prénom · {{2}} agence · {{3}} bien · {{4}} date de visite.

**Déclencheur :** détecteur 2, `visits.status='done' AND feedback_buyer IS NULL AND completed_at < now()-1j` (`automation-engine/index.ts:261-297`, dédup :150-176).

**Correction de preuve :** {{4}} n'a pas de source propre — la seule date disponible côté détecteur est `completed_at`, écrit `= now()` à la clôture (migration ligne 217) : on afficherait l'heure à laquelle l'agent a clôturé, pas la date de la visite.

**Le vrai motif du P3 :** ce n'est pas un manque, c'est un **doublon de canal**. `send-reminder-email/index.ts:39-51` expédie déjà ce message par e-mail, sur exactement le même déclencheur. Ajouter WhatsApp ici, c'est un second canal *payant* sur une relance existante — arbitrage à assumer explicitement, avec une règle d'exclusion e-mail/WhatsApp, sinon le contact reçoit les deux.

**Mécanique de re-nag payant à corriger avant activation :** `reminderExists` ne dédupe que sur les statuts actifs, le cron est horaire, et comme le corps ne porte aucun lien, une réponse WhatsApp en texte libre n'écrit rien dans `visits.feedback_buyer` → la condition reste vraie → le reminder est recréé.

⚠ Piège métier hérité, à ne pas réintroduire : le détecteur ne part **que** sur `visits.status='done'` — refuser ce statut ailleurs dans la chaîne ferme 100 % des avis.

### P3 — `offer_expiring` · UTILITY · client

**Corps :**
> Bonjour {{1}}, {{2}} vous contacte au sujet de l'offre enregistrée à votre dossier pour {{3}}. Son échéance est fixée au {{4}}. Souhaitez-vous en parler avant cette date ?

**Variables :** {{1}} prénom · {{2}} agence/agent · {{3}} intitulé du bien · {{4}} date d'échéance. ⛔ **Jamais le montant** : donnée sensible transitant par Meta, et l'intitulé du bien suffit à rouvrir la conversation.

**Deux tiers de la preuve initiale étaient faux.** `useExpiringOffers` (`useOffers.ts:65-95`) **ne filtre ni sur 48 h ni sur `expires_at`** : il prend toutes les offres `pending` de l'agence, triées, limit 50 — la requête n'existe donc pas « en deux endroits ». Et « aucun chemin sortant vers le client, quel que soit le canal » est réfuté par `send_client_message` et `send_client_email`, deux outils tier confirm vivants (`whatsapp-agent/index.ts:507`, :523). Seul `whatsapp-morning-brief/index.ts:96-103` est exact — et il ne sélectionne que `amount, by_label, expires_at` : {{3}} n'est requêté **nulle part** aujourd'hui (`useFocusQueue.ts:360` le confirme : `bien: { …, title: undefined }`) et exige une jointure neuve vers `properties`.

**Deux blocages propres, les plus graves du lot retenu :**
1. **La date est un défaut inventé.** `whatsapp-actions.ts:1008` pose 30 jours dès que l'agent ne dicte rien, et :1034 repose le même défaut à l'insert. Écrire au client une échéance que le CRM s'est donnée seul, c'est lui affirmer un **terme contractuel faux**. Le déclencheur doit être restreint aux offres dont `expires_at` a été explicitement fixé.
2. **Le destinataire n'est pas résoluble.** `crm_offers.by_id` est polymorphe (contact acheteur *ou* profile de l'agent vendeur, `useOffers.ts:105`), NULL pour toute offre créée par l'agent IA (`executeRecordOffer` ne l'écrit jamais, :1024-1037), et la file Focus retombe sur l'id de l'**offre** (`contactId: o.by_id || o.id`, `useFocusQueue.ts:348`). Écrire au mauvais `by_id` = texter un collègue. Il faut passer par `crm_offers.deal_id` → `transactions.contact_buyer_id/contact_seller_id`, sachant que `deal_id` est nullable et `ON DELETE SET NULL` (baseline :3725, :6401) — {{2}} et le destinataire disparaissent ensemble sur une transaction supprimée.

Plus une mécanique de double envoi : fenêtre 48 h contre brief quotidien (2 entrées cron, `20260705180000_whatsapp_morning_brief.sql:46` et :61) → sans clé d'idempotence par offre, le même client reçoit deux fois le template à 24 h d'intervalle.

---

## 2. Écartés (3)

- **`signature_pending`** — `signature_requests` = **0 ligne** et `esign_provider_connections` = **0 connexion** : aucune agence n'a jamais branché Skribble. Le déclencheur n'est pas rare, il n'a jamais pu exister. Et `signers` ne stocke que `{name,email,role,sequence,status}` — ni téléphone ni `contact_id`, donc aucun sujet auquel rattacher un opt-in ni un STOP. (Correction : `:370` vise la const `firstSigningUrl`, pas une garde côté agent.) À revoir avec 1 connexion provider vivante + un téléphone sur les signataires.
- **`kyc_link_expiring`** — `kyc_magic_links` = **0 ligne** pour 10 dossiers KYC : le maillon manquant est **l'émission** du lien, pas sa relance. En prime, `'whatsapp'` n'est pas une valeur admise du CHECK `kyc_magic_links.channels` (email|sms), et le template doublonne `kyc_documents_missing` sur la même personne et le même dossier sans règle d'exclusion. **Preuve fausse à corriger** : « `magic-link-send-email` n'a aucun appelant applicatif » — la fonction est appelée en service-role par `magic-link-create/index.ts:197` et `_shared/whatsapp-actions.ts:1545` ; seul « aucune occurrence dans `src/` » est exact.
- **`mandate_checkin`** — quasi-doublon de `megga_followup` (même acte, même verbe, même réponse attendue) déguisé en UTILITY pour changer de tarif ; Meta corrige ce genre de reclassement à la revue. Et la base ne peut ni nommer ni prouver le mandat : 0 propriété avec `mandate_signed_at`/`mandate_type` sur 6, 0 transaction reliant `contact_seller_id` à un `property_id`, rappel créé avec `property_id: null` → {{2}} sans source, or c'était {{2}} qui portait toute la revendication UTILITY. Le « détecteur mesuré » matche **0 ligne** : l'unique contact `type='seller'` a `last_interaction_at` NULL, que le `.lt()` exclut.

Restent également écartées et non rediscutées : relance J+3 nommant le bien (doublon `followup`, reste MARKETING), lead dormant 30 j et acheteur chaud 7 j (cas d'usage canonique de `followup` — il lui manque un câblage, pas un jumeau), alertes de matches (couvertes par `new_listings`, injoignable), template de re-permission (contradiction de conception : sans opt-in Meta bloque le premier contact ; le seul chemin légal est e-mail/SMS avec un lien `wa.me`), campagnes broadcast (à router en CAMPAGNE avec HITL, après la garde), AUTHENTICATION (aucun OTP dans le produit ; gabarit figé), rapport KYC PDF au client (destinataire = agent en dur, `whatsapp-actions.ts:1292`), dossier stagnant (gate fermé, et l'annoncer au client est un aveu), estimation vente (réponse synchrone, fenêtre ouverte par construction), rappel J-1 du RDV d'identité (`appointments.reminder_sent_at` déclarée jamais écrite — **c'est une dette, pas un manque de template**).

---

## 3. Ce qui bloque l'activation

**Réponse directe à « lesquels sont activables tout de suite » : aucun. Zéro sur neuf.** Y compris ceux dont le déclencheur UTILITY est vivant et mesuré. Les blocages, du plus structurant au plus local :

**A. Le nommage — à trancher AVANT toute soumission.** Le catalogue préfixe plateforme (`megga_*`) alors que `docs/chantier-whatsapp-outbound.md` m4 (lignes 228-232) impose un préfixe **agence**, l'index `uq_msg_templates_wa_meta_name` étant unique au niveau **WABA global**. Un nom soumis n'est pas récupérable : se tromper coûte une re-soumission de tout le lot. Décision à prendre pour les 6 d'un coup.

**B. Le registre de consentement n'existe pas.** Vérifié : `sendOutboundGuarded`, `whatsapp_consents`, `whatsapp_suppressions` n'apparaissent **que** dans le document de chantier — aucune migration. Aucune colonne `opt_in_whatsapp` / `do_not_contact` / `consent_at` sur `contacts` (0/3). `20260705170000_user_consents.sql` et `20260731210000_consent_at_signup.sql` tracent l'acceptation des CGU par l'**agent**, pas le consentement du contact au canal. Aucun handler STOP nulle part, alors que `send-relance-email/index.ts:67` promet déjà « répondez STOP » en pied de chaque relance. Trois chemins sortants tapent déjà des clients sans aucune garde. Sur un WABA mono-numéro partagé, **un seul trou dégrade la note de toutes les agences**.

**C. Pas de sélecteur de clé.** Le seul appelant réel de `buildTemplateMessage` code `'followup'` **en dur** (`whatsapp-webhook/index.ts:964`) et stashe la même clé (:976). Grep sur `__template_key` : 2 occurrences, les deux `'followup'`. Ajouter 6 clés au REGISTRY sans routage reproduit exactement l'angle mort qui a tué `availability` et `new_listings`.

**D. Pas d'arête automation-engine → WhatsApp.** Les 8 détecteurs écrivent `channel ∈ {email, notification, task}` et l'auto-envoi n'existe que pour `'email'` (:211-216). 4 des 6 retenus sont détectés aujourd'hui et ne peuvent atteindre aucun canal WhatsApp.

**E. Pas de bouton URL** (voir en tête) → parcours en deux temps imposé, et pour `visit_reminder` un « non » devient un message entrant à trier à la main, alors que la version e-mail porte `visitManageUrl` (`send-visit-email:180`).

**F. Le brief agent n'a pas de sujet dans le registre prévu.** `whatsapp_consents.contact_id` est NOT NULL et `check_whatsapp_consent(p_contact_id uuid)` rend `contact_not_found` ⇒ `can_send=false` (chantier :148-152, :422-429). Appliqué mécaniquement, le wrapper `sendOutboundGuarded` **tuerait** le seul template dont l'opt-in est propre. À trancher : sujet `profile_id` dans le registre, ou exemption écrite. Second trou, à corriger dans le code : `whatsapp-morning-brief` (:203-210) ne consultera jamais `whatsapp_suppressions` — la suppression est par **numéro** et globale au WABA, donc un STOP ou un blocage Meta sur le numéro d'un agent n'arrêterait pas le push.

**G. Recatégorisation.** Meta recatégorise des templates déjà approuvés, presque toujours UTILITY → MARKETING. Ne jamais figer un coût ni une règle de consentement sur la catégorie **demandée** : relire la catégorie **effective** rendue par l'API après approbation et à chaque webhook de mise à jour.

---

## 4. Recommandation

**Soumettre maintenant : deux templates, et seulement une fois le point A tranché.**

1. **`<agence>_agent_daily_brief`** (fr + en). C'est le seul dont la population de destinataires a un consentement **enregistré en base** (`whatsapp_agent_links.verified`), le seul agent-facing, et le seul dont le corps corrigé délivre de la valeur sans dépendre d'une plomberie non écrite. Il ne débloque rien tant que le gate `whatsapp_morning_brief_enabled` reste à `false` — mais l'approbation Meta prend des jours à des semaines, elle est gratuite, et elle est **découplée de l'envoi**. Autant l'avoir en poche.
2. **`<agence>_kyc_documents_missing`**. Déclencheur mesuré vivant (cron horaire actif, 2 reminders en prod, 2 dossiers éligibles à l'instant), corps désormais sans fuite LAB, objectif 2 qui n'est adressé par rien hors e-mail. Réserve à écrire noir sur blanc : **ne pas activer** avant que `executeSendKycLink` accepte un contact sans e-mail, sinon un « oui » ouvre une fenêtre 24 h sur une impasse.

**Les quatre autres attendent, et pas pour la même raison :**

- `visit_reminder`, `visit_change`, `visit_feedback` attendent **des données et du code**, pas Meta : table `visits` vide, annulation non persistée (suppression de ligne), aucun téléphone dans la requête cron, `reminder_sent` mono-canal, doublon e-mail non arbitré. Soumettre maintenant, c'est réserver trois noms globaux pour des déclencheurs qui ne peuvent pas se déclencher.
- `offer_expiring` attend **deux corrections qui engagent la responsabilité** : ne jamais annoncer une échéance issue du défaut 30 jours, et savoir à qui l'on écrit. Tant que `by_id` est polymorphe et souvent NULL, ce template peut texter un collègue une information sur l'offre d'un client.

**Et avant tout envoi, quel que soit le template :** le registre de consentement + le STOP multilingue + la suppression par numéro (point B) ne sont pas une formalité de conformité qu'on rattrape après le pilote. Sur un numéro unique partagé, la première plainte fait tomber la note de toutes les agences en même temps.
