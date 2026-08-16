# Langue des e-mails — ce qui reste, et dans quel ordre

> Écrit le 16 août 2026, à la fin du chantier qui a porté dix gabarits aux quatre langues.
> Ce document est un **point de reprise** : il dit ce qui est fait, ce qui reste, et les
> pièges déjà payés. Il se périme le jour où les quatre lots ci-dessous sont clos.

## La règle

**La langue d'interface EST la langue de correspondance.** Si quelqu'un bascule le CRM ou
la vitrine en allemand, ses courriels suivent. Décision de Julien, 16 août 2026.

## Où l'on en est

**Treize gabarits sur quatorze** rendent les quatre langues (fr, de, en, it) :

| gabarit | destinataire | source de langue |
|---|---|---|
| `onboarding-email` (confirmation, rappel J-1, annulation) | agence | `profiles.language` |
| `booking-email` (convocation KYC) | **client de l'agence** | `contacts.language` |
| `device-alert-email` (sécurité) | agent | `profiles.language` |
| `team-invite-email` | invité **sans compte** | langue de qui invite |
| `agency-verification-notice` (décision KYB) | dirigeant | `profiles.language`, **un envoi par langue** |
| `magic-link-email` | client | déjà multilingue avant le chantier |
| `whatsapp-optin-send` | client | déjà multilingue avant le chantier |
| `reminder-email` + `reminder-templates` (5 rappels auto) | **client de l'agence** | `contacts.language` (lot A, 16.08) |
| `visit-email` (confirmation, rappel) | **client de l'agence** | `contacts.language` (lot B, 16.08) |
| `visit-email` (notification de demande) | agent | `profiles.language`, **même gabarit, autre population** |
| `property-email` (fiche de bien) | **client de l'agence** | langue jointe par la REQUÊTE (pas de `contact_id` côté edge) |

**Deux gabarits n'ont pas à être traduits** : `weekly-report-email` et `admin-alert-email`
sont **internes à l'équipe MEGGA**. Les traduire serait du travail sans destinataire.

## Ce qui reste : quatre gabarits, trois natures différentes

### ~~Lot A — les rappels automatiques~~ · ✅ FAIT le 16 août 2026

La copie des cinq gabarits vit désormais dans `_shared/reminder-templates.ts`, en quatre
langues, montée depuis `contacts.language`. Trois choses ont été apprises en le faisant, et
elles corrigent ce que cette section annonçait.

⛔ **`contact_reminder_templates` N'EXISTE PAS**, ni en base ni dans le code déployé. La
table de surcharge est **`message_templates`**, et la décision qu'elle appelait est sans
objet : **0 ligne**, **0 des 9 rappels** y renvoie, **aucun écrivain** dans le dépôt.

⛔ **Pire, le chemin de surcharge ne pouvait pas aboutir.** `reminders.message_template` est
un `text` où tous les producteurs réels écrivent une **phrase lisible** (« Premier suivi »,
les raisons du radar…), jamais un uuid ; le `.eq('id', …)` partait donc en
`invalid input syntax for type uuid`, erreur **avalée** parce que seul `data` était
déstructuré. La colonne sert partout de libellé, jamais de clé étrangère — son nom fait
croire l'inverse. Un garde d'UUID évite désormais la requête vouée à l'échec.

✅ **Décision retenue** (l'option 2 de cette section) : les surcharges restent dans la langue
où l'agence les a écrites, ce sont **ses** mots. `message_templates` ne gagne pas de colonne
de langue.

⛔ **LE VRAI MUR N'ÉTAIT PAS LA TRADUCTION, C'ÉTAIT LE CÂBLAGE.** `contacts.language` n'était
écrite que par **un seul** chemin, `whatsapp-process` (langue observée dans le fil). Les deux
gestes humains du CRM — création et fiche — écrivaient dans `form_data.lang`, sur la foi d'un
commentaire (« la table contacts n'a PAS de colonne `language` ») devenu faux le 14.08.2026,
quand la colonne a été créée. Mesuré : **0 contact sur 15** portait une langue, ni dans la
colonne ni dans `form_data`. Traduire seul n'aurait donc **rien changé** : tout serait
resté français. Les deux gestes écrivent maintenant la colonne ; la fiche lit encore
`form_data.lang` en repli pour les saisies antérieures.

⚠ **Et rien ne part encore.** `automation_rules` ne contient qu'une ligne, `auto_send=false`,
donc `shouldAutoSend` rend `false` pour tous les types et **0 `activity_events`
`auto_email_sent`** n'existe. Le lot rend la chaîne correcte le jour où l'on armera une
règle ; il ne l'arme pas.

⚠ **Trois types de `reminders.type` n'ont pas de copie** — `price_change` (aucun producteur),
`deal_stagnant` et `match_ignored` (nés en `channel: 'notification'`). Ils retombent sur
`custom`, **dans la bonne langue**. La garde qui les empêche de partir est chez l'appelant,
pas dans l'envoi : basculer un littéral `'notification'` → `'email'` suffirait à les armer.

### ~~Lot B — visite et envoi de bien~~ · ✅ FAIT le 16 août 2026

Les deux gabarits rendent les quatre langues. Le décompte annoncé ici était bas (« ~16 » et
« ~5 ») : **50 chaînes** au total. Ce que le lot a appris :

⚠ **`visit-email` n'a pas UN destinataire mais DEUX.** Ses trois natures se répartissent en
deux populations : `notification_agent` écrit à l'AGENT (`profiles.language`),
`confirmation_buyer` et `reminder` au CLIENT (`contacts.language`). Cette section disait
« l'appelant qui lit `contacts.language` » — vrai pour deux natures sur trois seulement.

⛔ **Et la requête qui désigne l'agent prenait un profil ARBITRAIRE de l'agence**
(`.eq('agency_id', …).limit(1)`, sans `.eq('id', visit.agent_id)` ni `.order()`), alors que
`visits.agent_id` existe et n'était jamais lu. Sur une agence de plusieurs personnes, la
notification — avec les coordonnées de l'acheteur — partait chez un collègue au hasard. Le
défaut précède ce chantier ; il fallait le corriger pour ne pas écrire dans la langue d'un
tiers. Corrigé, avec repli sur le plus ancien profil de l'agence (`agent_id` est nullable).

✅ **Le fuseau tient.** `formatVisitDate` / `formatVisitTime` prennent la locale et gardent
`Europe/Zurich` ; le cas de bascule de jour (22:30 UTC = le LENDEMAIN 00:30 à Genève) est
gardé **dans les quatre langues**. La régression qui guettait était de dériver le fuseau de
la langue (« de ⇒ Europe/Berlin ») : Berlin ne coïncide avec Zurich que par accident.

⛔ **UN DÉFAUT JUMEAU TROUVÉ DANS UN GABARIT DÉJÀ LIVRÉ.** `booking-email.ts` (l'un des dix)
composait `` `${date} à ${time}` `` : `INTL_TAG` traduisait bien les deux moitiés, mais la
préposition qui les recolle était figée en français. Mesuré, l'allemand rendait
« Montag, 17. August 2026 **à** 14:00 ». Le renommage `formatFr` → `formatWhen` avait acté
« elle ne rend plus du français seul » ; le littéral, lui, était resté. **Aucun test ne
pouvait le voir** : le banc quatre langues vérifie le témoin de langue, `lang="xx"` et
l'absence de cadratin, jamais une préposition. Corrigé et gardé dans les deux fichiers.

⚠ **Le prix ne suit PAS la langue**, et c'est voulu : `CHF 720'000` est une règle suisse
(§6), pas un rendu régional. `Intl.NumberFormat(style:'currency')` déplacerait le symbole
selon la locale et casserait l'objet, qui commence par le prix.

⚠ **`property-email` ne peut pas lire la base** : `send-property-email` ne reçoit qu'une
ADRESSE, sans `contact_id` — l'envoi peut viser quelqu'un qui n'a pas de fiche. La langue
voyage donc dans la REQUÊTE, jointe par le front (`useAtelierMatching`, qui a la fiche).
C'est l'ordre de priorité déjà écrit plus bas : la requête d'abord, la base ensuite.

⚠ **Rien ne part encore, là non plus** : `visits` compte **0 ligne**, et les deux crons
(`visit-reminders-j1` et `visit-reminder-hourly`, tous deux actifs) totalisent **5503
exécutions réussies qui rendent toutes `0 rows`** — `net.http_post` n'a jamais été appelé.
⛔ Et **deux des quatre e-mails sont inatteignables** : les crons n'émettent que `'reminder'`,
donc `confirmation_buyer` et `notification_agent` n'ont aucun appelant.

### Trouvés en chemin, PAS corrigés — hors périmètre, mais mesurés

Cinq défauts réels rencontrés en portant les lots A et B. Aucun n'est un problème de langue :
les corriger au passage aurait mélangé deux chantiers.

1. ⛔ **`_shared/weekly-digest.ts:31` — `formatCHF` rend une apostrophe TYPOGRAPHIQUE.**
   Il fait `toLocaleString('de-CH')` puis `.replace(/[,.]/g, "'")`, or `de-CH` rend le
   séparateur en **U+2019**, que cette regex ne voit pas. Mesuré : `CHF 720’000` là où les
   trois autres `formatCHF` du dépôt rendent `CHF 720'000`. C'est exactement l'apostrophe
   que la docstring de `property-email.ts:41-51` a été écrite pour bannir, et elle cite ce
   fichier comme portant `'`. ⚠ Le défaut **dépend de la version d'ICU** (Node 26 rend `'`,
   Deno 2.8.3 rend U+2019), donc il est intermittent selon le runtime. Correctif : aligner
   sur la regex des trois autres, pas allonger la classe de caractères.
2. ⛔ **Deux crons font le même travail sur des fenêtres qui se recouvrent.**
   `visit-reminders-j1` (`17 * * * *`, +12 h..+36 h) et `visit-reminder-hourly`
   (`15 * * * *`, +23 h..+25 h) appellent tous deux `send-visit-email` en `'reminder'`.
   Seul `reminder_sent` les empêche de doubler, et seulement parce que l'un tourne deux
   minutes avant l'autre. ⚠ `visit-reminder-hourly` **n'existe dans aucune migration du
   dépôt** et lit encore `current_setting('app.settings.…')`, le GUC que la migration
   `20260617160000` était écrite pour supprimer.
3. ⚠ **`visit-reminders-j1` exige `buyer_email IS NOT NULL`** : une visite créée depuis le
   CRM (qui pose `contact_id` sans `buyer_email`) ne peut structurellement pas le déclencher.
4. ⛔ **`src/hooks/useSendEmail.ts` est un chemin MORT** : il envoie la clé anon en `Bearer`,
   que `require-agent-auth` refuse en 401 (`isNonUserToken`) avant même GoTrue. Son unique
   consommateur passe un `contactName` tiré de l'état du routeur, sans id ni fiche.
5. ⚠ **`src/components/crm/today/useFocusQueue.ts:67` prend `en-CH`** là où `booking-email`
   et `MlkScreens` prennent `en-GB`. Deux mappings sur trois s'accordent ; le troisième est
   isolé. `en-CH` hérite du séparateur de milliers suisse en apostrophe typographique.

### Lot C — la relance · l'option 1 est FAITE, l'option 3 reste à trancher

L'audit du 16.08.2026 a montré que **l'essentiel de ce lot n'était pas une décision** : le
gabarit ne contient **qu'UNE chaîne de prose écrite par MEGGA** (la mention de pied), et
tout le reste était des défauts.

✅ **Option 1 livrée** — c'est ce que MEGGA écrit, et ça seul :
- la mention de pied passe aux quatre langues (`Record<AppLocale>`), première phrase alignée
  sur `property-email`, l'autre envoi commercial ;
- `relance-email.ts` passe enfin `lang` à `shell()` (il annonçait `lang="fr"` en toutes
  circonstances) ;
- ⛔ **le pied de désinscription partait TOUJOURS en français** alors qu'il est quadrilingue
  depuis toujours : `unsubscribeFooterHtml(unsub.url)` était appelé **sans son 2ᵉ argument** ;
- ⛔ **`contactId` n'était pas passé à `emailSendAllowed`** — trou dans la garde elle-même :
  un STOP reçu sur WhatsApp écrit `channel='all'` sur le NUMÉRO, pas sur l'adresse, donc la
  personne continuait de recevoir des relances. `leadId` EST un `contacts.id` chez les trois
  appelants ; il ne servait que de tag Resend.

❌ **Option 2 écartée** : « ne rien traduire » laissait une mention légale et un lien de
désinscription incompréhensibles pour leur destinataire. Ce sont les deux seules parties que
la loi regarde.

✅ **Un cas qui n'était ni l'un ni l'autre** : `useAtelierMatching.execRelance` écrit son
corps en **littéral du code** — jamais vu ni édité par l'agent. Ce sont les mots de MEGGA,
pas ceux de l'agence : traduits aux quatre langues, avec `buyer.language` que le geste voisin
`execSend` utilisait déjà. ⛔ Son objet portait un **tiret cadratin** (« Toujours
disponible — … »), interdit dans du texte envoyé, et **rien ne l'attrapait** : `lint:prose`
ne lit que `src/i18n/locales/`.

✅ **Option 3 — TRANCHÉE ET LIVRÉE le 16.08.2026** (décision Julien) : le copilote rédige dans
`contacts.language`, **avec relecture assistée**. Ce qui a été fait, et pourquoi :

- ⛔ **`recipient_locale` est un paramètre NOUVEAU, distinct de `language`.** Les confondre
  aurait été le défaut du lot : `language` est la langue de l'AGENT (son interface, donc le
  chat du copilote), `recipient_locale` celle du CLIENT. Le prompt système dit « Toujours en
  français » parce qu'il parle à l'agent ; la consigne de destinataire est posée dans le
  MESSAGE (pas le système) et déclare primer — le préfixe système est ce que le cache
  DeepSeek couvre, une consigne variable ne doit pas y entrer.
- **Une table `CONSIGNE_DESTINATAIRE`, pas un ternaire.** Les neuf `language === 'en' ? …`
  du fichier restent : ils gouvernent le chat de l'agent, qui est binaire, et c'est correct.
- `useRelanceLeads` sélectionne `language` (deux types de ligne à élargir, le compilateur
  les a signalés tous les deux).
- ⛔ **`parseDraft` ne connaissait que « Objet »**. Un brouillon allemand commence par
  « Betreff: » : l'objet retombait sur le repli **et la ligne d'en-tête partait collée en
  tête du corps**. Les quatre marqueurs sont reconnus, gardés par
  [relance-langue.spec.ts](tests/unit/relance-langue.spec.ts).
- ⛔ **Le prompt demandait une signature au TIRET CADRATIN** (`« ${agentName} — MEGGA »`) :
  il faisait produire à l'IA un caractère interdit dans du texte envoyé. Passé au point médian.
- **La relecture assistée** (`RSRelecture`) : quand la langue du brouillon diffère de celle
  de l'agent, un second appel rend le message dans SA langue, en lecture seule, marqué comme
  non envoyé. Un échec la laisse absente et n'empêche jamais l'envoi. Motif : la validation
  humaine est une règle du produit, et un agent qui ne lit pas l'allemand n'y valide rien —
  il acquiesce.

⚠ **Ce qui restait mesuré avant la décision**, conservé ici parce que c'est ce qui la
motivait :
- le français est épinglé sur **quatre étages** : `RelanceSession.tsx:243` (`language: 'fr'`
  littéral), le prompt utilisateur `:241`, le preset `draft_email`
  (`ai-copilot/index.ts:277-281`), et le system prompt `:232` (« Toujours en français ») ;
- l'échappatoire prévue (`ai-copilot/index.ts:662`, `if (language !== 'fr')`) **n'est jamais
  atteinte** : les 5 appelants passent `'fr'` en littéral ;
- `useRelanceLeads.ts:131` ne sélectionne pas `language` — la colonne n'atteint jamais le
  composant ;
- ⛔ **la chaîne copilote est un ternaire BINAIRE** (`language === 'en' ? 'en' : 'fr'`, quatre
  sites) : un contact `de` retomberait **silencieusement** en français. « Une table, jamais un
  ternaire » ;
- ⛔ `RelanceSession.tsx:176` extrait l'objet avec `/^objet\s*:?\s*(.+)$/i` — **français
  seul**. Un brouillon allemand (« Betreff: ») verrait sa ligne d'objet rester collée dans le
  corps ;
- ⚠ et la vraie question n'est pas technique : **un agent qui ne lit pas l'allemand ne peut
  pas valider un brouillon allemand.** CLAUDE.md exige une validation humaine ; un
  acquiescement qui ne comprend pas le texte n'en est pas une.

⚠ **Le même défaut vit sur trois autres surfaces**, toutes écrivant au CLIENT :
`whatsapp-actions.ts:1757` (e-mail client depuis WhatsApp, français en dur même si
`ctx.lang='en'`), `send_client_message` et `prepareSendListings` (tous deux dans la langue de
l'AGENT). ⛔ Et `executeSendClientEmail` est de toute façon **cassé** : il appelle
`send-relance-email` avec la clé service-role, que `requireAgentAuth` refuse — **401 mesuré**,
faute du contournement que `magic-link-send-email:59-61` possède, lui.

### Lot D — la vitrine · le trou connu

Un utilisateur **déjà inscrit** qui bascule la langue sur `megga.ch` ne l'enregistre pas :
`localStorage` est cloisonné par origine et la vitrine n'a pas la session du CRM. En
pratique il rebasculera dans le CRM, où c'est capté. Fermer le trou demande de brancher
`sites/megga-vitrine/js/megga-lang.js` sur son propre client Supabase.

## Ce qu'il faut savoir avant de toucher à un gabarit

- **Deux colonnes, deux populations.** `profiles.language` = utilisateurs MEGGA.
  `contacts.language` = clients d'une agence. Les confondre écrit au client dans la langue
  de son courtier.
- **La requête prime sur la base** (`_shared/recipient-language.ts`) : qui vient de basculer
  attend sa confirmation dans la nouvelle langue, même si la persistance n'a pas atterri.
  `parseLocale` rend `null` et non `'fr'` sur l'inconnu — sinon un corps de requête bruité
  écraserait une préférence réelle.
- **Une table, jamais un ternaire.** `locale === 'en' ? 'en' : 'fr'` avalait `de` et `it` en
  silence. `Record<AppLocale, …>` fait échouer la compilation quand une langue manque.
- **Passer `lang` à `shell()`.** Un e-mail allemand annoncé `lang="fr"` casse la césure, la
  synthèse vocale et WCAG 3.1.1.
- **Aucun accord de genre**, dans aucune langue : le gabarit ne connaît pas le genre du
  destinataire. Formuler sans accord plutôt que d'en choisir un.
- **Aucun tiret cadratin** dans du texte envoyé. `lint:prose` ne couvre que
  `src/i18n/locales/`, elle ne le verra pas ici.
- **Inscrire la spec dans `vitest.config.ts`.** Une spec de `_shared/` absente de
  l'allowlist ne tourne **nulle part**.
- **D'abord vérifier QUI ÉCRIT la colonne dont on va lire la langue.** Un gabarit traduit
  branché sur une colonne que personne ne remplit rend exactement le même e-mail qu'avant,
  et tous les tests passent. C'est ce qui attendait le lot A.
- **Relire le rendu** : `npm run email:preview` puis `.email-preview/index.html`.
  ⚠ La commande **sortait en code 2** jusqu'au 16.08.2026 (il lui manquait `--allow-env` :
  `email-shell.ts` lit l'environnement au chargement du module). Rien en CI ne l'exécute,
  donc rien ne l'avait signalé. Un gabarit multilingue s'y inscrit en quatre cas, comme le
  lien magique, et **la copie doit venir du même module que l'envoi**, variables résolues :
  un banc qui montre un corps de démonstration donne à croire qu'il couvre le vrai.

## Comment traduire

La méthode qui a produit les quatre derniers gabarits : un agent traduit, **un second
relit en cherchant l'invention** — pas le style. Sur 80 chaînes, elle a écarté trois
défauts réels qu'une relecture ordinaire aurait laissés passer : une affirmation absente du
français, un désaccord de genre dans un même message, et un tutoiement repris de
l'interface. Consigne qui fait la différence : « par défaut, réponds *reel=false* ; la
charge de la preuve est sur la trouvaille ».
