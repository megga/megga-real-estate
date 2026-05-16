# MEGGA CRM Agent — Architecture design

> Plan stratégique pour la refonte de l'espace agent. À lire avant la maquette.

---

## 1. Posture produit

Le CRM agent MEGGA n'est pas un Pipedrive de plus. Sa proposition de valeur tient sur **4 piliers spécifiques au marché suisse + à la promesse MEGGA** :

| Pilier | Pourquoi c'est différent |
|---|---|
| **Matching IA acheteurs ↔ biens** | Le moteur croise critères des contacts et caractéristiques des biens en continu. C'est le générateur de leads interne, pas un module annexe. |
| **Conformité LBA / LSFin native** | KYC obligatoire pour un agent suisse — pas un onglet caché, mais bloquant dans le pipeline (un deal ne passe pas en "Intérêt confirmé" sans KYC). |
| **C2PA + traçabilité photos** | Les biens publiés depuis MEGGA héritent automatiquement des photos signées (cohérent avec le site public). |
| **Copilote MEGGA AI** | Présent partout : résume une fiche, rédige une relance, qualifie un lead text-libre, propose le next-best-action. Pas un chatbot séparé. |

Posture visuelle : **outil pro suisse**, sobre, dense mais aéré, tabular-nums, zéro emoji, zéro gradient agressif. Mode sombre soigné.

---

## 2. Personas (rôles)

| Rôle | Accès | Notes |
|---|---|---|
| **Agent principal** | Tout — ses contacts, biens, deals, calendrier, KYC, docs | Persona par défaut (Gregory dans la maquette) |
| **Agent au sein d'une agence** | Ses propres données + biens partagés de l'agence | Vue "Mon portefeuille" vs "Agence" |
| **Manager d'agence** | Vue équipe : tous les agents, KPI consolidés, attribution des leads | Peut réassigner un deal |
| **Assistant / back-office** | KYC, documents, calendrier — pas de vue pipeline value | Souvent une seule personne pour plusieurs agents |
| **Admin** | Settings agence, facturation, abonnement, intégrations | Hors scope phase 1 |

Variable de switch : `acc.role` → conditionne la sidebar et les sections accessibles.

---

## 3. Sitemap

```
CRM Agent (/agent ou subdomaine app.megga.ch)
│
├── PRINCIPAL
│   ├── Aujourd'hui            ← écran d'atterrissage par défaut
│   └── Dashboard              ← KPI + pipeline view + risques + activité
│
├── CRM
│   ├── Contacts               ← annuaire + fiche détail (split view)
│   │   └── Contact:id         ← timeline, biens proposés, KYC, docs, deals
│   ├── Pipeline               ← kanban / liste / timeline (toggle)
│   │   └── Deal:id            ← drawer plein-écran avec étapes, docs, parties
│   └── Matching               ← table croisée acheteurs ↔ biens
│
├── BIENS
│   ├── Mes biens              ← grille / liste
│   │   └── Bien:id            ← fiche bien agent (différente de la fiche publique)
│   └── Créer un bien          ← wizard 4 modes (manuel, dupliquer, URL, PDF)
│
├── COMMUNICATION
│   ├── Chat                   ← conversations client + MEGGA AI (onglet)
│   ├── Calendrier             ← visites, signatures, échéances, Google Cal
│   └── Support                ← tickets MEGGA
│
├── CONFORMITÉ
│   ├── KYC                    ← dossiers de vérification (LBA)
│   ├── Documents              ← templates + générés + signés
│   └── Automatisation         ← règles, relances, templates email/SMS
│
└── COMMAND PALETTE (cmd+K)
    Recherche unifiée + actions : "Nouveau contact", "Créer bien",
    "Relancer Marie Bertrand", "Trouver matchs pour bien #12"...
```

---

## 4. Objets de données (modèle)

### `Contact`
```
id, type ('buyer'|'seller'|'tenant'|'landlord'|'mixed'),
firstName, lastName, email, phone, lang,
status ('lead'|'qualified'|'active'|'archived'),
score (0-100, calculé),
source ('website'|'referral'|'csv'|'call'|'walk-in'|'AI'),
assignedTo (agentId),
createdAt, lastActivityAt,
kyc: { status: 'none'|'pending'|'verified'|'stale', riskLevel, lastScreenedAt },
criteria: {                  ← critères de recherche (acheteurs/locataires)
  transaction, types[], cantons[], cities[],
  budgetMin, budgetMax, areaMin, areaMax, roomsMin,
  mustHave[], niceToHave[], deadline
},
preferences: { contactMethod, bestTimeOfDay, language },
tags[], notes, customFields{}
```

### `Bien`
```
id, ref (MG-XXXXX), status ('draft'|'active'|'reserved'|'sold'|'paused'),
mandat: { type: 'exclusif'|'simple'|'recherche', signedAt, expiresAt, commission },
ownerContactId,                    ← lien vers le vendeur (Contact)
type, transaction, address, canton, lat/lng,
price, charges, area, rooms, beds, baths, year, energy,
features[], descLong, photos[], signedPhotos[] (C2PA manifest IDs),
visibility ('private'|'agency'|'public'),
publishedTo[],                     ← ImmoScout, Homegate, MEGGA…
stats: { views, favorites, visitRequests }
```

### `Deal`
```
id, contactId, bienId,             ← bien optionnel (recherche active = pas encore de bien)
stage ('new-lead'|'to-qualify'|'searching'|'visit-scheduled'
       |'visit-done'|'interest-confirmed'|'offer'|'signed'|'lost'),
value (CHF),
probability (auto à partir du stage),
nextAction: { kind, dueAt, note },
risk ('healthy'|'at-risk'|'stalled'),
ownerAgentId,
history[]                          ← timeline d'évènements
```

### `Match`
```
contactId, bienId,
score (0-100),
reasons[],                         ← "+25 budget", "+15 surface", "−10 canton"
status ('to-send'|'sent'|'viewed'|'liked'|'rejected'),
generatedAt, sentAt, viewedAt
```

### `KYCDossier`
```
id, contactId, type ('person'|'company'),
status, riskLevel ('low'|'medium'|'high'),
checks: { id, address, pep, sanctions, sourceOfFunds },
documents[], auditTrail[],
expiresAt
```

### `Activity` (timeline unifiée)
```
id, kind ('call'|'email'|'sms'|'visit'|'meeting'|'note'|'doc-sent'
         |'doc-signed'|'kyc-update'|'match-sent'|'stage-change'|'ai-action'),
contactId?, bienId?, dealId?,
agentId, at, payload, mediaUrl
```

Toutes les entités relient `Contact ↔ Bien ↔ Deal ↔ Activity`. La fiche contact agrège tout.

---

## 5. Flux clés

### 5.1 Capture d'un lead
4 chemins, tous convergents → `Contact{status:'lead'} + Activity{kind:'note'}`
1. **CSV/Excel** — colonne mapping intelligente
2. **vCard** — import natif depuis carnet d'adresses
3. **Texte libre IA** — l'agent colle un email ou message vocal, MEGGA AI extrait nom/email/critères
4. **Saisie manuelle**

→ Si critères détectés : matching auto lancé en arrière-plan, suggestions visibles dans le widget "Aujourd'hui".

### 5.2 Qualification & matching
```
lead créé → critères saisis → matching engine tourne →
  affiche top 5 matchs (portefeuille + marché public MEGGA) →
  agent envoie 2-3 biens via lien personnalisé →
  tracking ouverture / vue / favori →
  visite proposée
```

### 5.3 Visite → Offre → Signature
```
visite-scheduled → bon de visite généré (signé électroniquement) →
visite-done → rapport visite (vendeur ↑, acheteur ↑) →
intérêt-confirmé → KYC déclenché en parallèle →
offre déposée → contre-offre éventuelle → acceptation →
notaire dans le pipeline → signature → archivage
```

Chaque transition génère une `Activity`, propose un document à envoyer, et déclenche éventuellement une relance auto si pas de réponse en N jours.

### 5.4 Création d'un bien
4 entrées : manuel / dupliquer / URL (ImmoScout, Homegate) / PDF (MEGGA AI lit la fiche descriptive). Toutes terminent sur le même éditeur 5 sections : identité, descriptif, photos (avec signature C2PA), mandat, publication.

### 5.5 KYC bloquant
Un deal **ne peut pas passer en "intérêt confirmé"** si le contact n'est pas KYC-verifié. Banner persistante sur la fiche contact + sur la carte deal. CTA "Lancer le KYC" en un clic.

---

## 6. Place de MEGGA AI

3 niveaux d'intégration :

1. **Surface ambient** — barre `cmd+K` sur chaque écran. Recherche + actions.
2. **Suggestions contextuelles** — bandeau discret en haut de la fiche contact / deal :
   - "Marie n'a pas eu de nouvelles depuis 11 jours → relance ?"
   - "3 nouveaux biens correspondent à ses critères"
   - "Le mandat exclusif expire dans 12 jours"
3. **Conversationnel** — onglet Chat avec MEGGA AI dédié, capable de référencer @contact, #bien, !deal pour piocher dans les données du CRM.

L'IA n'écrase **jamais** le contrôle de l'agent : suggestions = boutons, pas d'actions auto invisibles. Toute action générée par l'IA est tracée comme `Activity{kind:'ai-action'}`.

---

## 7. Layout & navigation

### Sidebar (gauche, 220px, persistante)
- Logo + collapse
- Recherche (cmd+K opener)
- Action rapide : "+ Nouveau contact"
- Sections : Principal, CRM, Biens, Communication, Conformité
- Bas : mode sombre, paramètres, profil agent (avec menu logout)

Cohérent avec les captures actuelles — c'est un acquis, on le garde.

### Zone principale
3 patterns selon l'écran :
- **Dashboard / liste simple** : header titre + filtres + contenu pleine largeur
- **Split view (Contacts, Pipeline)** : liste à gauche (320-400px) + détail à droite. Drawer extensible en plein-écran.
- **Canvas (Matching, Calendrier)** : pleine largeur, vue tabulaire ou kanban

### Header zone
- Titre de la section + sous-titre (count + last update)
- Filtres / segments à gauche
- Actions à droite ("+ Nouveau X", export, settings vue)

### Cmd+K (palette)
Modal centrée. 3 sections : recherche (contacts, biens, deals), actions ("Créer bien", "Lancer matching"), chat IA ("Demande à MEGGA AI").

---

## 8. Système visuel (rappel + extensions)

```
ENCRE          #0E1410
TEXTE SOFT     #3F4640
TEXTE MUTED    #7A8079
BORDURE        #DDE2EA
SECTION        #F6F8F4
FOND           #FAFBFD
BLEU PRIMAIRE  #0041D9
BLEU PÂLE      #E8EFFE
ROUGE ALERTE   #E53935

— STATUTS DEAL (chip 11px bold) —
new-lead             #6B7280  (gris)
to-qualify           #F59E0B  (ambre)
searching            #0041D9  (bleu)
visit-scheduled      #6366F1  (indigo)
visit-done           #06B6D4  (cyan)
interest-confirmed   #10B981  (émeraude — ÉTAT POSITIF, autorisé ici car fonctionnel)
offer                #8B5CF6  (violet)
signed               #0E1410  (encre)
lost                 #E53935  (rouge)
```

Note: les couleurs de statut sortent légèrement de la palette de marque. C'est volontaire — chaque statut doit être instantanément reconnaissable. La marque reste le bleu `#0041D9`.

### Mode sombre
```
FOND           #0B0E0D
SURFACE        #14181A
SURFACE-2      #1C2125
BORDURE        #2A3036
TEXTE          #E8EAED
TEXTE SOFT     #B0B5BA
BLEU PRIMAIRE  #4A78F0   ← légèrement remonté pour contraste
```

### Type
Manrope (cohérent site public). 4 niveaux : 11px (label), 13px (body dense), 14-15px (body), 18-22px (titre section), 28-34px (titre page). `tabular-nums` partout sur les nombres.

### Composants neufs spécifiques au CRM
- `StageChip` — chip statut deal
- `KYCBadge` — pastille verifiée / pending / stale / none
- `MatchScore` — anneau circulaire 0-100
- `ContactRow` — ligne dense avec avatar, nom, score, last activity
- `DealCard` (kanban) — title, value, contact, next action, risk indicator
- `AIBubble` — bulle suggestion IA avec actions inline
- `CommandPalette` — modal cmd+K
- `Drawer` — détail glissant droite, fermable Esc

---

## 9. Tweaks à exposer dans la maquette

| Tweak | Options |
|---|---|
| Mode | Clair / Sombre |
| Densité | Confort / Compact |
| IA | Discrète (chat seulement) / Présente (suggestions) / Centrale (cmd+K + suggestions partout) |
| Vue pipeline | Kanban / Liste / Timeline |
| Sidebar | Étendue / Réduite (icônes seules) |
| Écran | Aujourd'hui / Pipeline / Fiche contact / Matching / Mes biens |

---

## 10. Phasage de livraison

| Phase | Contenu | État |
|---|---|---|
| **0 — Plan** (ce doc) | Architecture écrite, modèle, sitemap | ✅ |
| **1 — Hi-fi clés** | Aujourd'hui, Pipeline, Fiche contact, Matching, Mes biens | en cours |
| 2 — Hi-fi flux | Wizard création bien, KYC, Doc + Auto | à venir |
| 3 — Détails | Calendrier, Chat, Settings agence, mode multi-agents | à venir |
| 4 — Système | Composants extraits dans une librairie réutilisable | à venir |

---

## 11. Anti-patterns à éviter

- ❌ Recopier l'UI d'un CRM connu (Pipedrive, Salesforce…) — chaque widget doit servir un cas d'usage immobilier suisse réel
- ❌ Surcharger d'icônes décoratives ou d'emoji
- ❌ "Score IA" 5 étoiles pour faire joli — un score doit avoir une formule défendable
- ❌ Notifications gamifiées ("vous êtes en feu 🔥")
- ❌ Gradients / glassmorphism / shadow soft excessives
- ❌ Pousser l'IA en mode "rédige tout pour toi" — l'agent reste pilote
- ❌ Cacher le KYC dans un sous-menu — c'est un objet de premier rang
- ❌ Empiler les onglets dans la fiche contact — préférer une page scrollable structurée

---

**Prochaine étape :** maquette hi-fi des 5 écrans principaux dans `MEGGA CRM.html` avec Tweaks pour comparer mode clair/sombre, densité, place de l'IA et vue pipeline.
