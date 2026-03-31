// Help Center articles — 35 articles across 3 personas + special pages

export interface HelpArticle {
  slug: string
  category: 'agent' | 'vendeur' | 'acheteur'
  section: string
  title: string
  description: string
  keywords: string[]
  content: string
  relatedSlugs: string[]
}

// ── AGENT — Premiers pas ────────────────────────────────────────────────

const AGENT_PREMIERS_PAS: HelpArticle[] = [
  {
    slug: 'configurer-profil',
    category: 'agent',
    section: 'Premiers pas',
    title: 'Configurer votre profil et agence',
    description: 'Remplissez vos informations personnelles et celles de votre agence pour démarrer.',
    keywords: ['profil', 'agence', 'avatar', 'photo', 'langue', 'paramètres', 'settings', 'configuration'],
    relatedSlugs: ['importer-contacts', 'action-board'],
    content: `## Configurer votre profil

Votre profil est la première chose que vos clients voient. Prenez 2 minutes pour le compléter.

### Informations personnelles

Rendez-vous dans **Paramètres > Profil** pour remplir :

- **Prénom et nom** : affichés dans les emails envoyés à vos clients
- **Téléphone** : pour les rappels et notifications
- **Canton** : détermine votre zone de couverture
- **Photo de profil** : cliquez sur l'avatar pour uploader une photo (max 2 MB, JPG/PNG)

### Langue de l'interface

MEGGA supporte 4 langues : **Français**, **Deutsch**, **English**, **Italiano**.

Changez la langue dans Paramètres > Profil > section Langue. Cliquez sur la pill de votre choix.

### Informations agence

Dans **Paramètres > Agence**, configurez :

- Nom de l'agence
- Adresse et téléphone
- Logo (affiché dans les emails et documents)

### Dark mode

Activez le mode sombre depuis l'icône lune/soleil dans la sidebar.`,
  },
  {
    slug: 'importer-contacts',
    category: 'agent',
    section: 'Premiers pas',
    title: 'Importer vos contacts',
    description: '4 méthodes pour importer vos contacts : CSV, vCard, texte libre IA, ou saisie manuelle.',
    keywords: ['importer', 'contacts', 'csv', 'excel', 'vcard', 'import', 'iphone', 'android', 'outlook', 'gmail'],
    relatedSlugs: ['gerer-contacts', 'action-board'],
    content: `## Importer vos contacts

Rendez-vous dans **Contacts > Importer** (ou cliquez "Importer" dans la page contacts vide).

### Méthode 1 — CSV / Excel

1. Préparez un fichier CSV avec les colonnes : prénom, nom, email, téléphone
2. Glissez le fichier dans la zone de drop (ou cliquez pour sélectionner)
3. MEGGA détecte automatiquement le mapping des colonnes
4. Vérifiez la prévisualisation et cliquez "Importer"

**Exporter depuis Gmail :** Contacts Google > Exporter > Format CSV Google

**Exporter depuis Outlook :** Fichier > Ouvrir et exporter > Exporter vers un fichier > CSV

### Méthode 2 — vCard (.vcf)

Glissez un fichier .vcf dans la zone d'import. Compatible avec les exports de :
- iPhone (Contacts > Partager le contact)
- Android (Contacts > Exporter)
- Outlook et Gmail

### Méthode 3 — Texte libre IA

Collez un texte contenant des noms, emails, téléphones (par exemple un email, une liste, un message). MEGGA AI extrait automatiquement les contacts.

### Méthode 4 — Saisie manuelle

Utilisez le raccourci **\u2318\u21e7C** (Mac) ou **Ctrl+Shift+C** (PC) pour ouvrir le formulaire de création rapide.`,
  },
  {
    slug: 'action-board',
    category: 'agent',
    section: 'Premiers pas',
    title: "Comprendre l'Action Board",
    description: "L'Action Board vous dit quoi faire aujourd'hui : relances, matchs, urgences, suggestions IA.",
    keywords: ['action board', "aujourd'hui", 'relances', 'urgences', 'suggestions', 'dashboard', 'accueil'],
    relatedSlugs: ['premier-deal', 'scores-ia'],
    content: `## L'Action Board

C'est la **première page que vous voyez** en vous connectant. Elle résume votre journée.

### Les 5 sections

1. **Urgences** (rouge) : deals à risque, documents manquants, relances en retard
2. **Relances du jour** (orange) : clients à rappeler, feedbacks à demander
3. **Matchs trouvés** (bleu) : nouveaux biens compatibles avec les recherches de vos clients
4. **Visites à confirmer** (cyan) : agenda du jour
5. **Suggestions IA** (vert) : actions recommandées par MEGGA AI

### Marquer une action comme faite

Cliquez sur le bouton d'action (Appeler, Envoyer, Voir dossier) ou sur la coche pour marquer l'action comme complétée. Elle disparaît de la liste.

### Checklist d'onboarding

Si vous venez de créer votre compte, une barre de progression vous guide à travers les 5 étapes essentielles.

### Leads vendeurs

Les nouveaux leads vendeurs (soumis via /vendre) apparaissent dans une section dédiée avec les boutons Accepter / Rejeter.`,
  },
  {
    slug: 'premier-deal',
    category: 'agent',
    section: 'Premiers pas',
    title: 'Votre premier deal dans le pipeline',
    description: 'Créez une transaction et suivez-la dans le pipeline Kanban à 14 étapes.',
    keywords: ['deal', 'pipeline', 'kanban', 'transaction', 'étapes', 'drag', 'drop'],
    relatedSlugs: ['gerer-contacts', 'matching'],
    content: `## Le pipeline de transactions

Le pipeline est un kanban avec **14 colonnes** représentant chaque étape d'une transaction immobilière.

### Les 14 étapes

1. Nouveau lead → 2. À qualifier → 3. Recherche active → 4. Visite planifiée → 5. Visite effectuée → 6. Intérêt confirmé → 7. Offre → 8. Négociation → 9. Réservé → 10. Financement → 11. Notaire → 12. Signé | Perdu | À relancer

### Créer un deal

Depuis la fiche contact, cliquez sur "Créer une transaction". Sélectionnez le bien concerné et l'étape initiale.

### Déplacer un deal

**Glissez-déposez** la carte du deal vers la colonne souhaitée. Si vous déplacez vers "Perdu", une raison est obligatoire.

### KPIs en haut

La barre résumé affiche : total deals actifs, valeur totale pipeline, deals à risque, taux de conversion.`,
  },
]

// ── AGENT — CRM & Contacts ─────────────────────────────────────────────

const AGENT_CRM: HelpArticle[] = [
  {
    slug: 'gerer-contacts',
    category: 'agent',
    section: 'CRM & Contacts',
    title: 'Ajouter et gérer vos contacts',
    description: 'Fiche contact enrichie avec timeline, tags, scoring, et raccourci clavier.',
    keywords: ['contacts', 'ajouter', 'fiche', 'timeline', 'tags', 'notes', 'scoring', 'raccourci'],
    relatedSlugs: ['importer-contacts', 'scores-ia', 'timeline'],
    content: `## Gérer vos contacts

### Créer un contact rapidement

Raccourci : **\u2318\u21e7C** (Mac) / **Ctrl+Shift+C** (PC) — accessible depuis n'importe quelle page.

### La fiche contact enrichie

Chaque contact dispose de :

- **En-tête** : nom, avatar, type (acheteur/vendeur/les deux), score IA, actions rapides
- **Résumé IA** : 2-3 phrases contextualisées par MEGGA AI
- **Next Best Action** : suggestion de la meilleure prochaine action
- **6 onglets** : Infos, Timeline, Biens envoyés, Matching, Documents, Offres

### Types de contacts

- **Acheteur** : personne recherchant un bien
- **Vendeur** : personne vendant un bien
- **Les deux** : acheteur et vendeur simultanément
- **Investisseur**, **Locataire**, **Bailleur**, **Lead**

### Tags et notes

Ajoutez des tags libres et des notes pour organiser vos contacts.`,
  },
  {
    slug: 'scores-ia',
    category: 'agent',
    section: 'CRM & Contacts',
    title: 'Comprendre les scores IA',
    description: 'Buyer et Seller Intelligence : sérieux, budget réel, timing, engagement.',
    keywords: ['score', 'ia', 'intelligence', 'buyer', 'seller', 'sérieux', 'budget', 'engagement'],
    relatedSlugs: ['gerer-contacts', 'matching'],
    content: `## Les scores IA

MEGGA calcule des indicateurs comportementaux pour chaque contact. Ce sont des **estimations** indicatives, pas des certitudes.

### Buyer Intelligence (acheteurs)

- **Sérieux** (0-100) : basé sur la réactivité, le nombre de visites, la cohérence budget/recherche
- **Budget réel estimé** : déduit des biens consultés et des offres faites
- **Timing** : immédiat, 1-3 mois, 3-6 mois, 6-12 mois, long terme
- **Probabilité d'achat** (0-100)
- **Engagement** : very_high, high, medium, low, dormant

### Seller Intelligence (vendeurs)

- **Niveau de tension** : calm, moderate, tense, critical
- **Probabilité d'accepter une baisse** (0-100)
- **Niveau d'urgence** : pas pressé, modéré, urgent, très urgent

### Affichage

Les scores sont affichés avec un label "estimation IA" et des barres monochromes. Ils ne constituent jamais une garantie.`,
  },
  {
    slug: 'timeline',
    category: 'agent',
    section: 'CRM & Contacts',
    title: 'La timeline unifiée',
    description: 'Tous les événements d\'un contact en un seul fil chronologique.',
    keywords: ['timeline', 'historique', 'événements', 'appels', 'emails', 'visites', 'notes'],
    relatedSlugs: ['gerer-contacts', 'messagerie'],
    content: `## La timeline unifiée

Chaque contact dispose d'une timeline qui regroupe **tous les événements** en un seul fil chronologique.

### Types d'événements

- Appels téléphoniques
- Emails envoyés/reçus
- Messages internes
- Visites planifiées et effectuées
- Biens envoyés
- Notes ajoutées
- Documents uploadés
- Offres soumises
- Changements d'étape pipeline
- Relances automatiques
- Actions IA

### Filtrer la timeline

Utilisez les onglets en haut de la timeline pour filtrer par type d'événement.

### Ajouter une note

Cliquez sur "Ajouter une note" en haut de la timeline pour enregistrer une observation ou un appel.`,
  },
]

// ── AGENT — Matching & Biens ────────────────────────────────────────────

const AGENT_MATCHING: HelpArticle[] = [
  {
    slug: 'matching',
    category: 'agent',
    section: 'Matching & Biens',
    title: 'Le matching acheteurs \u2194 biens',
    description: 'Score de compatibilité, envoi en un clic, matching automatique.',
    keywords: ['matching', 'compatibilité', 'score', 'envoyer', 'acheteur', 'bien', 'suggestion'],
    relatedSlugs: ['creer-bien', 'gerer-contacts'],
    content: `## Le matching intelligent

MEGGA calcule un score de compatibilité entre chaque acheteur et chaque bien.

### Score de compatibilité (0-100)

- **Budget** (30 pts) : prix du bien dans la fourchette du client
- **Zone** (25 pts) : ville/canton dans les zones recherchées
- **Type** (15 pts) : type de bien correspondant
- **Pièces/Surface** (15 pts) : dans les fourchettes min/max
- **Features** (15 pts) : caractéristiques souhaitées présentes

### Matching automatique

Quand un nouveau bien entre dans la base, MEGGA identifie automatiquement les acheteurs compatibles et crée des suggestions.

### Envoyer un bien

Depuis la page Matching ou la fiche contact (onglet Matching), cliquez "Envoyer" sur un match. Choisissez le canal (email ou messagerie) et personnalisez le message.`,
  },
  {
    slug: 'creer-bien',
    category: 'agent',
    section: 'Matching & Biens',
    title: 'Créer un bien immobilier',
    description: '4 méthodes d\'import : saisie manuelle, duplication, URL, PDF.',
    keywords: ['bien', 'créer', 'import', 'url', 'pdf', 'dupliquer', 'photos', 'listing'],
    relatedSlugs: ['virtual-staging', 'matching'],
    content: `## Créer un bien

### 4 méthodes d'import

1. **Saisie manuelle** : formulaire wizard en 5 étapes
2. **Dupliquer** : copier un bien existant avec modifications
3. **Import URL** : collez un lien d'annonce (Homegate, ImmoScout24, RealAdvisor, Comparis, etc.)
4. **Import PDF** : uploadez un descriptif PDF — MEGGA AI extrait les données

### Le wizard de création

- **Étape 1** : Informations (titre, type, prix, description)
- **Étape 2** : Adresse (geocoding Mapbox, canton, code postal)
- **Étape 3** : Caractéristiques (pièces, surface, étage, état, année)
- **Étape 4** : Photos (upload, tagging par pièce, plan interactif)
- **Étape 5** : Publication et options

### Plan interactif

Uploadez un plan d'étage et placez des hotspots cliquables liés aux pièces et photos.`,
  },
  {
    slug: 'virtual-staging',
    category: 'agent',
    section: 'Matching & Biens',
    title: 'Le virtual staging IA',
    description: 'Meublez virtuellement une pièce vide en 5-15 secondes.',
    keywords: ['staging', 'virtuel', 'meubler', 'ia', 'photo', 'décoration', 'meuble'],
    relatedSlugs: ['creer-bien', 'matching'],
    content: `## Virtual Staging IA

Meublez virtuellement les photos de pièces vides avant publication.

### Comment ça marche

1. Dans le formulaire de création de bien, sélectionnez une photo de pièce vide
2. Choisissez un style parmi 5 options
3. Sélectionnez le type de pièce (salon, chambre, cuisine, etc.)
4. Cliquez "Générer" — résultat en 5-15 secondes
5. Comparez avant/après avec le slider

### 5 styles disponibles

- **Moderne** : lignes épurées, mobilier contemporain
- **Classique** : style intemporel, bois noble
- **Luxe** : matériaux haut de gamme, finitions premium
- **Scandinave** : minimaliste, tons clairs, bois naturel
- **Minimal** : essentiel, espaces dégagés

### Quotas par plan

| Plan | Stagings/mois |
|---|---|
| Starter | 0 (upsell) |
| Pro | 50 |
| Agency | 200 |`,
  },
]

// ── AGENT — KYC & Conformité ────────────────────────────────────────────

const AGENT_KYC: HelpArticle[] = [
  {
    slug: 'creer-kyc',
    category: 'agent',
    section: 'KYC & Conformité',
    title: 'Créer un dossier KYC',
    description: 'Nouveau dossier : sélection contact, type PP/PM, checklist auto-générée.',
    keywords: ['kyc', 'dossier', 'conformité', 'créer', 'checklist', 'documents'],
    relatedSlugs: ['screening-pep', 'validation-kyc'],
    content: `## Créer un dossier KYC

### Depuis la page KYC

1. Cliquez "Nouveau dossier" (en-tête ou état vide)
2. Sélectionnez le contact concerné
3. Choisissez le type : Personne Physique (PP) ou Personne Morale (PM)
4. Renseignez la nationalité et le montant de la transaction

### Checklist auto-générée

Une checklist adaptée au type (PP ou PM) est automatiquement créée :

**Personne Physique :** Pièce d'identité, justificatif domicile, attestation revenus, déclaration origine fonds, formulaire compliance

**Personne Morale :** Extrait RC, statuts société, identification UBO, domicile, revenus, origine fonds, compliance

### Upload de documents

Chaque item de la checklist peut être lié à un document uploadé. Formats acceptés : PDF, JPG, PNG. Taille max : 10 MB.`,
  },
  {
    slug: 'screening-pep',
    category: 'agent',
    section: 'KYC & Conformité',
    title: 'Screening PEP & Sanctions',
    description: 'Vérification automatique des personnes politiquement exposées et listes de sanctions.',
    keywords: ['pep', 'sanctions', 'screening', 'vérification', 'dilisense', 'risque', 'gafi'],
    relatedSlugs: ['creer-kyc', 'validation-kyc'],
    content: `## Screening PEP & Sanctions

MEGGA vérifie automatiquement si un contact apparaît sur les listes internationales de personnes politiquement exposées (PEP) ou de sanctions.

### Lancer une vérification

Depuis la fiche KYC, section "Vérification Compliance", cliquez "Lancer la vérification". Le résultat apparaît en quelques secondes.

### Résultats possibles

- **Clear** (vert) : aucune correspondance trouvée
- **Match PEP** (orange) : la personne est ou a été politiquement exposée
- **Match Sanctions** (rouge) : la personne figure sur une liste de sanctions

### Score de risque (0-100)

Calculé sur 5 facteurs :
1. Nationalité pays GAFI à risque (25 pts)
2. PEP positif (25 pts)
3. Montant > CHF 5M (20 pts)
4. Personne morale vs physique (15 pts)
5. Documents incomplets (15 pts)

### Que faire en cas de match

Un match ne signifie pas automatiquement un refus. Analysez le résultat, documentez votre décision dans les notes internes, et validez ou refusez le dossier.`,
  },
  {
    slug: 'validation-kyc',
    category: 'agent',
    section: 'KYC & Conformité',
    title: 'Validation et audit trail',
    description: 'Validation human-in-the-loop, journal d\'audit complet, alertes expiration.',
    keywords: ['validation', 'audit', 'trail', 'journal', 'expiration', 'human-in-the-loop'],
    relatedSlugs: ['creer-kyc', 'screening-pep'],
    content: `## Validation KYC

### Human-in-the-loop

MEGGA ne valide **jamais** un dossier automatiquement. C'est toujours l'agent qui prend la décision finale via le bouton "Valider le dossier".

### Journal d'audit

Chaque action est enregistrée avec horodatage et identité de l'auteur :
- Création du dossier
- Upload de documents
- Modifications de statut
- Screenings lancés et résultats
- Validation ou rejet

### Alertes expiration

Les documents avec une date d'expiration génèrent des alertes :
- **Rouge** : document expiré
- **Orange** : expire dans les 30 prochains jours

### Notes internes

Ajoutez des notes internes à chaque dossier pour documenter vos observations et décisions.`,
  },
]

// ── AGENT — Communication & Outils ──────────────────────────────────────

const AGENT_COMM: HelpArticle[] = [
  {
    slug: 'messagerie',
    category: 'agent',
    section: 'Communication',
    title: 'La messagerie',
    description: 'Envoyez des messages, répondez, épinglez, et utilisez MEGGA AI dans la conversation.',
    keywords: ['messagerie', 'messages', 'chat', 'envoyer', 'répondre', 'épingler', 'ia'],
    relatedSlugs: ['calendrier', 'gerer-contacts'],
    content: `## La messagerie

### Envoyer un message

Ouvrez un thread existant ou créez une nouvelle conversation depuis le bouton "Nouveau message". Sélectionnez un contact et rédigez votre message.

### Fonctionnalités

- **Répondre** : clic droit > Répondre (citation visuelle)
- **Épingler** : clic droit > Épingler un message important
- **Copier** : clic droit > Copier le texte
- **Transférer à MEGGA AI** : clic droit > demander une analyse IA

### MEGGA AI dans la conversation

Le bouton "Demander à MEGGA AI" dans le profil contact bascule vers le chat IA avec le contexte du contact injecté automatiquement.

### Commandes rapides

Tapez \`/\` dans la zone de saisie pour voir les 8 commandes métier disponibles. Tapez \`@\` pour mentionner un contact.

### Suggestions de réponses

MEGGA propose 3 suggestions contextuelles de réponse pour chaque message reçu.`,
  },
  {
    slug: 'calendrier',
    category: 'agent',
    section: 'Communication',
    title: 'Le calendrier et les visites',
    description: 'Planifiez des visites, synchronisez Google Calendar et Outlook.',
    keywords: ['calendrier', 'visite', 'google', 'outlook', 'sync', 'rappel', 'agenda'],
    relatedSlugs: ['messagerie', 'premier-deal'],
    content: `## Le calendrier

### Planifier une visite

Depuis la fiche bien ou la fiche contact, cliquez "Planifier une visite". Choisissez :

- **Date et créneau** (matin ou après-midi)
- **Type** : sur place ou vidéo (Google Meet / FaceTime)
- **Pré-qualification** : budget, financement, première visite

### Synchronisation

Connectez votre calendrier externe dans **Paramètres > Applications** :

- **Google Calendar** : OAuth, synchronisation bidirectionnelle
- **Outlook Calendar** : OAuth Azure, synchronisation bidirectionnelle

Les événements externes apparaissent en violet dans votre calendrier MEGGA.

### Rappels automatiques

Un email de rappel est envoyé automatiquement au visiteur la veille de la visite (J-1).

### Feedback post-visite

Après une visite, un email avec un lien de feedback est envoyé au visiteur (étoiles 1-5, points forts, objections).`,
  },
]

// ── VENDEUR — Portail ───────────────────────────────────────────────────

const VENDEUR_ARTICLES: HelpArticle[] = [
  {
    slug: 'acces-portail',
    category: 'vendeur',
    section: 'Portail vendeur',
    title: 'Accéder à votre espace vendeur',
    description: 'Lien sécurisé reçu par email, pas besoin de compte, validité 6 mois.',
    keywords: ['portail', 'accès', 'lien', 'token', 'email', 'espace vendeur'],
    relatedSlugs: ['estimation', 'suivi-visites'],
    content: `## Accéder à votre espace vendeur

### Comment ça marche

Après l'acceptation de votre dossier par un agent MEGGA, vous recevez un email contenant un **lien sécurisé** vers votre espace vendeur.

### Pas besoin de compte

Vous n'avez pas besoin de créer un compte ni de vous connecter. Le lien est personnel et sécurisé.

### Validité

Votre lien est valable **6 mois**. Après cette période, contactez votre agent pour en obtenir un nouveau.

### Que pouvez-vous faire

- Suivre l'avancement de la vente (visites, offres, étapes)
- Consulter les feedbacks des visiteurs
- Voir les offres reçues
- Échanger avec votre agent
- Analyser le positionnement marché de votre bien
- Uploader des documents`,
  },
  {
    slug: 'estimation',
    category: 'vendeur',
    section: 'Portail vendeur',
    title: 'Comprendre votre estimation',
    description: 'Estimation basée sur les prix/m\u00b2 de biens comparables dans votre secteur.',
    keywords: ['estimation', 'prix', 'valeur', 'comparables', 'fourchette', 'm2'],
    relatedSlugs: ['acces-portail', 'offres-vendeur'],
    content: `## Comprendre votre estimation

### Méthodologie

L'estimation MEGGA est calculée à partir des **prix au m\u00b2** de biens similaires vendus récemment dans votre secteur (canton, ville, type de bien).

### Fourchette min-max

Le résultat est une fourchette (\u00b115% autour de la médiane) qui tient compte de la variabilité du marché local.

### Score de confiance

- **Faible** : moins de 5 biens comparables trouvés
- **Moyen** : 5 à 15 biens comparables
- **\u00c9levé** : plus de 15 biens comparables

### Limites

L'estimation est **indicative**. Elle ne remplace pas une évaluation professionnelle in situ qui prend en compte l'état réel du bien, sa luminosité, les travaux récents, la vue, etc.`,
  },
  {
    slug: 'suivi-visites',
    category: 'vendeur',
    section: 'Portail vendeur',
    title: 'Suivre les visites',
    description: 'Visites planifiées et effectuées, feedbacks anonymisés des acheteurs.',
    keywords: ['visites', 'suivi', 'feedback', 'planifié', 'effectué', 'retour'],
    relatedSlugs: ['offres-vendeur', 'acces-portail'],
    content: `## Suivre les visites

### Page Visites de votre portail

Vous y trouvez :

- **Visites à venir** : date, horaire, statut (planifiée / confirmée)
- **Visites passées** : date, feedback anonymisé, note sur 5

### Feedbacks anonymisés

Les retours des acquéreurs sont **anonymisés** : vous voyez le contenu du feedback mais pas l'identité du visiteur. Cela permet une transparence honnête.

### Statistiques

- Nombre total de visites
- Visites ce mois-ci
- Tendance (en hausse, stable, en baisse)`,
  },
  {
    slug: 'offres-vendeur',
    category: 'vendeur',
    section: 'Portail vendeur',
    title: 'Les offres reçues',
    description: 'Montant, statut, progression par rapport au prix demandé.',
    keywords: ['offres', 'montant', 'statut', 'accepter', 'refuser', 'contre-offre'],
    relatedSlugs: ['suivi-visites', 'communiquer-agent'],
    content: `## Les offres reçues

### Page Offres de votre portail

Chaque offre affiche :
- **Montant** en CHF
- **Statut** : en attente, acceptée, refusée, contre-offre, expirée
- **Date de réception**
- **Conditions** éventuelles (financement, délai, etc.)

### Barre de progression

Une barre visuelle montre la progression de l'offre par rapport à votre prix demandé.

### Décisions

Les décisions concernant les offres sont prises en concertation avec votre agent. Utilisez la messagerie pour discuter de chaque offre.`,
  },
  {
    slug: 'documents-vendeur',
    category: 'vendeur',
    section: 'Portail vendeur',
    title: 'Vos documents',
    description: 'Documents du mandat, upload, alertes expiration.',
    keywords: ['documents', 'upload', 'mandat', 'pdf', 'expiration'],
    relatedSlugs: ['acces-portail', 'communiquer-agent'],
    content: `## Vos documents

### Page Documents de votre portail

Retrouvez tous les documents liés à votre mandat de vente :
- Mandat signé
- Descriptif du bien
- Diagnostics techniques
- Certificats (CECB, amiante, etc.)

### Uploader un document

Cliquez "Déposer un document" et sélectionnez votre fichier (PDF, JPG, PNG). Taille max : 10 MB.

### Alertes

Si un document est expiré ou manquant, une alerte rouge/orange apparaît.`,
  },
  {
    slug: 'communiquer-agent',
    category: 'vendeur',
    section: 'Portail vendeur',
    title: 'Communiquer avec votre agent',
    description: 'Messagerie directe dans le portail, délai de réponse sous 24h.',
    keywords: ['communiquer', 'agent', 'message', 'messagerie', 'réponse'],
    relatedSlugs: ['acces-portail', 'offres-vendeur'],
    content: `## Communiquer avec votre agent

### Messagerie intégrée

Dans la page Messages de votre portail, échangez directement avec votre agent par écrit.

### Délai de réponse

Votre agent s'engage à répondre sous **24h en jours ouvrés**.

### Informations de contact

Le nom, téléphone et email de votre agent sont affichés dans la sidebar de votre portail. Vous pouvez l'appeler ou lui envoyer un email directement.`,
  },
]

// ── ACHETEUR — Public ───────────────────────────────────────────────────

const ACHETEUR_ARTICLES: HelpArticle[] = [
  {
    slug: 'rechercher-bien',
    category: 'acheteur',
    section: 'Recherche',
    title: 'Rechercher un bien',
    description: '3 modes d\'affichage, filtres avancés, zone dessinée, isochrone temps de trajet.',
    keywords: ['rechercher', 'bien', 'acheter', 'filtres', 'carte', 'grille', 'split', 'zone', 'isochrone'],
    relatedSlugs: ['recherche-ia', 'favoris-alertes'],
    content: `## Rechercher un bien

### 3 modes d'affichage

- **Grille** : vue classique, 3 colonnes de cards
- **Split** (Zillow-style) : listings + carte côte à côte, séparateur ajustable
- **Carte** : carte plein écran avec mini-liste

### Filtres disponibles

- Type de bien (appartement, maison, villa, terrain, commercial)
- Prix min-max
- Nombre de pièces
- Surface m\u00b2
- Nombre de chambres et salles de bain
- Label énergie CECB (Minergie, A, B, C, D+)
- Tri : pertinence, prix, date, recommandé

### Outils carte

- **Dessiner une zone** : tracez un polygone sur la carte
- **Isochrone** : affichez la zone accessible en X minutes (voiture, pied, vélo)
- **Lier à la carte** : ne montrer que les biens visibles dans le viewport
- **Score quartier** : Walk Score 0-100 pour n'importe quel point`,
  },
  {
    slug: 'recherche-ia',
    category: 'acheteur',
    section: 'Recherche',
    title: 'La recherche IA conversationnelle',
    description: 'Tapez en langage naturel et l\'IA extrait les filtres automatiquement.',
    keywords: ['ia', 'recherche', 'conversationnelle', 'langage naturel', 'chatbot'],
    relatedSlugs: ['rechercher-bien', 'favoris-alertes'],
    content: `## Recherche IA

### Comment l'utiliser

Cliquez sur l'icône \u2728 dans la barre de recherche pour ouvrir le chat IA. Tapez votre demande en langage naturel.

### Exemples de requêtes

- "3 pièces lumineux près de Cornavin max 800K"
- "Maison avec jardin à Nyon, budget 1.5 million"
- "Appartement rénové dans le canton de Vaud, 4 pièces minimum"
- "Quelque chose pas trop cher à Lausanne avec parking"

### Comment ça marche

L'IA analyse votre texte, extrait les critères (type, prix, zone, pièces, etc.) et applique les filtres correspondants sur la page de recherche. Vous pouvez affiner en continuant la conversation.`,
  },
  {
    slug: 'favoris-alertes',
    category: 'acheteur',
    section: 'Recherche',
    title: 'Favoris et alertes',
    description: 'Sauvegardez vos biens préférés et créez des alertes pour les nouveaux biens.',
    keywords: ['favoris', 'alertes', 'sauvegarder', 'notification', 'email', 'recherche sauvegardée'],
    relatedSlugs: ['rechercher-bien', 'creer-compte'],
    content: `## Favoris et alertes

### Sauvegarder un favori

Cliquez sur le c\u0153ur d'un bien pour l'ajouter à vos favoris. Les 2 premiers favoris sont sauvegardés localement. Au 3ème, connectez-vous pour les retrouver sur tous vos appareils.

### Créer une alerte

1. Effectuez une recherche avec vos critères
2. Cliquez sur l'icône Sauvegarder dans la barre de filtres
3. Choisissez la fréquence : instantanée (30 min), quotidienne, hebdomadaire
4. Recevez un email dès qu'un nouveau bien correspond

### Gérer vos alertes

Retrouvez vos recherches sauvegardées depuis le menu utilisateur > Mes recherches.`,
  },
  {
    slug: 'calculateur',
    category: 'acheteur',
    section: 'Outils',
    title: "Le calculateur d'accessibilité",
    description: 'Règle suisse des 33%, fonds propres 20%, taux de charge 7%.',
    keywords: ['calculateur', 'accessibilité', 'hypothèque', 'budget', 'fonds propres', '33%', 'financement'],
    relatedSlugs: ['rechercher-bien', 'planifier-visite'],
    content: `## Calculateur d'accessibilité

### Règles suisses

Le financement immobilier en Suisse suit des règles strictes :

- **33% max** : les charges du logement ne doivent pas dépasser 1/3 du revenu brut annuel
- **20% min** : fonds propres minimum (dont min 10% hors 2ème pilier)
- **Taux de charge 7%** : 5% intérêts imputés + 1% amortissement + 1% entretien

### Résultats

- **Vert** : accessible — ratio < 33% ET fonds propres \u2265 20%
- **Orange** : accessible avec conditions — ratio 33-38% OU fonds propres 15-20%
- **Rouge** : budget insuffisant — ratio > 38% OU fonds propres < 15%

### Où le trouver

Le calculateur est disponible dans la fiche de chaque bien (sidebar) et dans le preview panel.`,
  },
  {
    slug: 'planifier-visite',
    category: 'acheteur',
    section: 'Outils',
    title: 'Planifier une visite',
    description: 'Choisissez date, créneau, type (sur place ou vidéo), avec pré-qualification.',
    keywords: ['visite', 'planifier', 'rendez-vous', 'vidéo', 'google meet', 'facetime'],
    relatedSlugs: ['rechercher-bien', 'comparer-biens'],
    content: `## Planifier une visite

### Comment faire

Depuis la fiche d'un bien, cliquez "Planifier une visite".

### Étape 1 — Date et créneau

Sélectionnez une date et un créneau (matin ou après-midi). Les créneaux indisponibles sont grisés.

### Étape 2 — Type de visite

- **Sur place** : visite physique du bien
- **Vidéo** : visite virtuelle via Google Meet ou FaceTime

### Étape 3 — Pré-qualification

Renseignez (optionnel mais recommandé) :
- Votre budget
- Votre situation de financement
- S'il s'agit de votre première visite

### Confirmation

Vous recevez un email de confirmation avec les détails. Un rappel est envoyé la veille (J-1).`,
  },
  {
    slug: 'comparer-biens',
    category: 'acheteur',
    section: 'Outils',
    title: 'Comparer des biens',
    description: 'Ajoutez jusqu\'\u00e0 3 biens côte à côte avec 9 métriques comparées.',
    keywords: ['comparer', 'comparaison', 'côte à côte', 'métriques'],
    relatedSlugs: ['rechercher-bien', 'favoris-alertes'],
    content: `## Comparer des biens

### Ajouter à la comparaison

Cliquez sur l'icône de comparaison (GitCompareArrows) sur la card d'un bien ou dans le preview panel. Maximum 3 biens simultanément.

### 9 métriques comparées

Prix, prix/m\u00b2, surface, pièces, chambres, salles de bain, type, canton, jours en ligne.

Le highlighting intelligent met en évidence les meilleures valeurs (prix le plus bas, surface la plus grande, etc.).

### Partage

La comparaison est persistée dans l'URL. Partagez le lien pour que quelqu'un voie la même comparaison.`,
  },
  {
    slug: 'estimer-vendre',
    category: 'acheteur',
    section: 'Vendre',
    title: 'Estimer et vendre votre bien',
    description: 'Wizard 4 étapes, estimation IA instantanée, un agent vous contacte sous 24h.',
    keywords: ['estimer', 'vendre', 'estimation', 'wizard', 'gratuit', 'agent'],
    relatedSlugs: ['estimation', 'acces-portail'],
    content: `## Estimer et vendre votre bien

### Le wizard en 4 étapes

1. **Adresse** : saisissez l'adresse et le canton (autocomplete Mapbox)
2. **Détails** : type de bien, pièces, surface, état, année de construction
3. **Photos** : uploadez au minimum 3 photos (max 10)
4. **Coordonnées** : nom, email, téléphone, motivation de vente

### Estimation IA instantanée

Après l'étape 3, MEGGA calcule une estimation basée sur les prix/m\u00b2 de biens similaires. Vous voyez immédiatement la fourchette de prix estimée.

### Ensuite

Un agent MEGGA de votre région vous contacte sous 24h pour une visite gratuite et sans engagement. Vous recevez ensuite un accès à votre espace vendeur pour suivre la vente.`,
  },
  {
    slug: 'creer-compte',
    category: 'acheteur',
    section: 'Compte',
    title: 'Créer un compte',
    description: 'Google, Facebook ou email — pour sauvegarder favoris, alertes et historique.',
    keywords: ['compte', 'créer', 'inscription', 'google', 'facebook', 'email', 'connexion'],
    relatedSlugs: ['favoris-alertes', 'rechercher-bien'],
    content: `## Créer un compte

### Pourquoi créer un compte

- Sauvegarder vos favoris sur tous vos appareils
- Créer des alertes email pour les nouveaux biens
- Retrouver votre historique de recherches
- Planifier des visites

### 3 méthodes

- **Google** : connexion en un clic
- **Facebook** : connexion en un clic (bientôt disponible)
- **Email** : adresse email + mot de passe (min 8 caractères)

### Espace professionnel

Si vous êtes agent immobilier, cliquez "Espace agent" en bas de la page de connexion pour accéder au CRM professionnel.`,
  },
]

// ── Export all articles ─────────────────────────────────────────────────

export const ALL_ARTICLES: HelpArticle[] = [
  ...AGENT_PREMIERS_PAS,
  ...AGENT_CRM,
  ...AGENT_MATCHING,
  ...AGENT_KYC,
  ...AGENT_COMM,
  ...VENDEUR_ARTICLES,
  ...ACHETEUR_ARTICLES,
]

export function getArticlesByCategory(category: HelpArticle['category']): HelpArticle[] {
  return ALL_ARTICLES.filter(a => a.category === category)
}

export function getArticle(slug: string): HelpArticle | undefined {
  return ALL_ARTICLES.find(a => a.slug === slug)
}

export function getArticlesBySlugs(slugs: string[]): HelpArticle[] {
  return slugs.map(s => ALL_ARTICLES.find(a => a.slug === s)).filter(Boolean) as HelpArticle[]
}

export function getSections(category: HelpArticle['category']): string[] {
  const sections = new Set(ALL_ARTICLES.filter(a => a.category === category).map(a => a.section))
  return [...sections]
}

// ── Changelog entries ───────────────────────────────────────────────────

export interface ChangelogEntry {
  date: string
  title: string
  description: string
}

export const CHANGELOG: ChangelogEntry[] = [
  { date: '2026-03-30', title: 'Carte Zillow-style', description: 'Split 3 modes, pins prix individuels, clustering intelligent, hover tooltips.' },
  { date: '2026-03-29', title: 'Wizard /vendre + Estimation IA', description: 'Estimez votre bien en 2 minutes. Fourchette basée sur 38\u2019000 biens suisses.' },
  { date: '2026-03-28', title: 'Onboarding agent', description: "Wizard de bienvenue, données de démo, checklist d'activation 5 étapes." },
  { date: '2026-03-27', title: 'Import multi-sources', description: "Importez vos biens depuis URL, PDF, ou duplication. 8 portails suisses supportés." },
  { date: '2026-03-26', title: 'MEGGA AI Copilote', description: 'Chat IA métier : résumé client, relance, analyse marché, KYC.' },
  { date: '2026-03-25', title: 'KYC Screening PEP/Sanctions', description: 'Vérification dilisense intégrée. Score de risque automatique.' },
]

// ── Status page data ────────────────────────────────────────────────────

export interface ServiceStatus {
  name: string
  status: 'operational' | 'degraded' | 'incident'
  description: string
}

export const SERVICES_STATUS: ServiceStatus[] = [
  { name: 'Application web', status: 'operational', description: 'Toutes les pages chargent normalement.' },
  { name: 'Base de données', status: 'operational', description: 'Supabase PostgreSQL, temps de réponse normal.' },
  { name: "Envoi d'emails", status: 'operational', description: 'Resend API, domaine megga.ch vérifié.' },
  { name: 'IA (Copilote)', status: 'operational', description: 'Claude Sonnet 4, temps de réponse < 3s.' },
  { name: 'Carte Mapbox', status: 'operational', description: 'Tiles, geocoding, isochrone, directions.' },
]

// ── Keyboard shortcuts ──────────────────────────────────────────────────

export interface KeyboardShortcut {
  keys: string
  description: string
  context: string
}

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  { keys: '\u2318K / Ctrl+K', description: 'Ouvrir la palette de commandes', context: 'Global' },
  { keys: '\u2318\u21e7C / Ctrl+Shift+C', description: 'Créer un contact rapidement', context: 'Global' },
  { keys: 'Esc', description: 'Fermer un modal ou un panel', context: 'Global' },
  { keys: '\u2190 \u2192', description: 'Photo précédente / suivante', context: 'Lightbox' },
  { keys: 'P', description: 'Afficher / masquer le plan interactif', context: 'Lightbox' },
  { keys: 'Esc', description: 'Quitter le mode plein écran', context: 'Carte' },
  { keys: '+ / -', description: 'Zoom avant / arrière', context: 'Carte' },
]

// ── Limits by plan ──────────────────────────────────────────────────────

export interface PlanLimit {
  feature: string
  starter: string
  pro: string
  agency: string
}

export const PLAN_LIMITS: PlanLimit[] = [
  { feature: 'Contacts', starter: '50', pro: 'Illimité', agency: 'Illimité' },
  { feature: 'Biens actifs', starter: '10', pro: 'Illimité', agency: 'Illimité' },
  { feature: 'Staging IA', starter: '0', pro: '50/mois', agency: '200/mois' },
  { feature: 'Plan interactif', starter: 'Non', pro: 'Oui', agency: 'Oui' },
  { feature: 'Matching IA', starter: 'Basique', pro: 'Complet', agency: 'Complet' },
  { feature: 'KYC screening', starter: '5/mois', pro: 'Illimité', agency: 'Illimité' },
  { feature: 'Stockage photos', starter: '500 MB', pro: '10 GB', agency: '50 GB' },
  { feature: 'Taille max fichier', starter: '10 MB', pro: '25 MB', agency: '50 MB' },
  { feature: 'Utilisateurs', starter: '1', pro: '5', agency: 'Illimité' },
  { feature: 'Portails vendeur', starter: '3', pro: 'Illimité', agency: 'Illimité' },
]

// ── Compliance FAQ ──────────────────────────────────────────────────────

export interface ComplianceFaq {
  question: string
  answer: string
}

export const COMPLIANCE_FAQ: ComplianceFaq[] = [
  { question: 'MEGGA est-il conforme nFADP ?', answer: 'Oui. Les données sont hébergées en Europe (eu-west-1, Irlande) via Supabase. Le traitement respecte les principes de la nouvelle Loi fédérale sur la protection des données (nFADP) entrée en vigueur le 1er septembre 2023.' },
  { question: 'Où sont stockées mes données ?', answer: 'Sur les serveurs Supabase en Union européenne (Irlande, eu-west-1). Les données ne quittent jamais l\'UE.' },
  { question: 'Comment fonctionne le screening PEP/Sanctions ?', answer: 'MEGGA utilise l\'API dilisense pour vérifier en temps réel si un contact apparaît sur les listes PEP (personnes politiquement exposées) ou les listes de sanctions internationales (UN, EU, OFAC, etc.).' },
  { question: 'MEGGA remplace-t-il un compliance officer ?', answer: 'Non. MEGGA est un outil compliance-enabling, pas compliance-replacing. Il standardise et accélère les processus KYC, mais la validation finale est toujours humaine (human-in-the-loop). MEGGA ne prend aucune décision réglementaire de manière autonome.' },
  { question: 'Les données sont-elles chiffrées ?', answer: 'Oui. En transit via TLS 1.3 et au repos via AES-256 (chiffrement Supabase par défaut).' },
  { question: 'Qui peut voir mes données ?', answer: 'Les politiques Row Level Security (RLS) de Supabase garantissent que chaque agence ne voit que ses propres données. Aucun agent d\'une agence ne peut accéder aux contacts, biens ou transactions d\'une autre agence.' },
]
