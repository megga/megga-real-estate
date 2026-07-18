/**
 * Contenu statique du Help Center — source unique des articles + pages annexes.
 *
 * Articles répartis en 3 personas (agent / vendeur / acheteur) et regroupés par
 * section ; `ALL_ARTICLES` les concatène et les helpers en bas font le lookup
 * (par slug, catégorie, sections). Exporte aussi les données des pages spéciales
 * (changelog, statut services, raccourcis clavier, limites plan, FAQ conformité).
 */

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

### Leads vendeurs

Les nouveaux leads vendeurs (soumis via /sell) apparaissent dans une section dédiée avec les boutons Accepter / Rejeter.`,
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

// ── AGENT — Tutoriels ──────────────────────────────────────────────────

const AGENT_TUTORIALS: HelpArticle[] = [
  {
    slug: 'premier-bien-3min',
    category: 'agent',
    section: 'Tutoriels',
    title: 'Créer votre premier bien en 3 minutes',
    description: 'Guide pas à pas pour publier un bien rapidement : import, infos, photos, prix, publication.',
    keywords: ['bien', 'créer', 'rapide', 'tutoriel', 'publier', 'import', 'photos', 'premier'],
    relatedSlugs: ['creer-bien', 'virtual-staging', 'matching'],
    content: `## Créer votre premier bien en 3 minutes

### Choisir votre méthode d'import

Rendez-vous dans **Mes biens > Créer un bien**. Vous avez 4 options :

- **Saisie manuelle** : remplissez le formulaire étape par étape
- **Import URL** : collez un lien d'annonce d'un portail suisse — les données sont extraites automatiquement
- **Import PDF** : uploadez un descriptif — MEGGA AI extrait les informations
- **Dupliquer** : copiez un bien existant et modifiez les détails

**Astuce** : l'import URL est le plus rapide. Collez le lien et MEGGA pré-remplit tout.

### Remplir les informations essentielles

- **Titre** : court et descriptif ("3.5 pièces vue lac, Montreux")
- **Type et prix** : appartement, maison, villa, terrain ou commercial
- **Adresse** : l'autocomplétion Mapbox vous aide à trouver l'adresse exacte

### Ajouter les photos

Uploadez au minimum 3 photos. Glissez-déposez ou cliquez pour sélectionner. Taguez chaque photo par pièce (salon, cuisine, chambre) pour le plan interactif.

### Fixer le prix et publier

Vérifiez le prix et cliquez "Publier". Le bien apparaît immédiatement dans la recherche et le matching démarre automatiquement.

**Conseil** : utilisez le virtual staging pour meubler les pièces vides avant de publier.`,
  },
  {
    slug: 'automatiser-relances',
    category: 'agent',
    section: 'Tutoriels',
    title: 'Automatiser vos relances client',
    description: 'Configurez des règles de relance automatique : déclencheurs, délais, canaux, templates.',
    keywords: ['automatiser', 'relance', 'automatisation', 'règle', 'template', 'email', 'rappel', 'suivi'],
    relatedSlugs: ['action-board', 'messagerie', 'gerer-contacts'],
    content: `## Automatiser vos relances client

### Principe

MEGGA crée des rappels et suggestions basés sur des règles que vous configurez. Par défaut, les relances apparaissent dans l'Action Board — vous gardez le contrôle.

### Accéder à la configuration

Rendez-vous dans **Automatisation** dans la sidebar. Vous y trouvez la liste de vos règles actives.

### Les 6 relances préconfigurées

| Déclencheur | Délai | Action |
|---|---|---|
| Bien envoyé à un client | J+3 | Rappel de suivi |
| Visite effectuée | J+1 | Demande de feedback |
| Lead inactif | J+30 | Relance douce |
| Acheteur chaud non relancé | J+7 | Alerte agent |
| Vendeur sans suivi récent | J+14 | Suggestion de mise à jour |
| Document manquant KYC | J+3 | Relance client |

### Créer une règle personnalisée

1. Cliquez "Nouvelle règle"
2. Choisissez le **déclencheur** (événement qui active la règle)
3. Définissez le **délai** en jours
4. Sélectionnez le **canal** (email, notification, tâche)
5. Associez un **template de message** (optionnel)

### Templates de messages

Les templates utilisent des variables dynamiques : \`{{contact.first_name}}\`, \`{{property.address}}\`, \`{{property.price}}\`. Créez vos propres templates dans la section dédiée.

### Mode automatique (opt-in)

Par défaut, les relances créent des suggestions. Activez l'envoi automatique dans les paramètres de chaque règle si vous souhaitez un envoi sans validation.`,
  },
  {
    slug: 'creer-portail-vendeur',
    category: 'agent',
    section: 'Tutoriels',
    title: 'Créer un portail vendeur pour votre client',
    description: 'Générez un espace vendeur sécurisé pour que votre client suive sa vente en temps réel.',
    keywords: ['portail', 'vendeur', 'client', 'lien', 'créer', 'suivi', 'transparence'],
    relatedSlugs: ['acces-portail', 'gerer-contacts', 'premier-deal'],
    content: `## Créer un portail vendeur

### Pourquoi un portail vendeur

Le portail vendeur donne à votre client une visibilité totale sur l'avancement de la vente : visites, offres, documents, analyse marché. Le vendeur se sent rassuré et vous réduit le nombre d'appels de suivi.

### Générer le lien

1. Ouvrez la fiche du contact vendeur
2. Cliquez **"Créer un portail vendeur"**
3. Sélectionnez le bien concerné
4. MEGGA génère un lien sécurisé unique

### Envoyer l'accès

Le lien est envoyé automatiquement par email au vendeur. Vous pouvez aussi le copier et l'envoyer manuellement.

### Ce que le vendeur voit

- **Mon bien** : état du mandat, progression en 6 étapes, timeline d'activité
- **Visites** : planifiées et effectuées, feedbacks anonymisés, notes
- **Offres** : montants, statuts, progression par rapport au prix demandé
- **Documents** : mandat, diagnostics, certificats — avec upload possible
- **Messages** : conversation directe avec vous
- **Analyse** : positionnement marché, prix/m\u00b2, biens comparables

### Validité et sécurité

Le lien est valable **6 mois**. Le vendeur n'a pas besoin de créer de compte. Pour renouveler l'accès, générez un nouveau lien depuis la fiche contact.

### Suivre l'engagement

Dans votre CRM, vous voyez quand le vendeur consulte son portail. Cette donnée nourrit le score Seller Intelligence.`,
  },
  {
    slug: 'megga-ai-quotidien',
    category: 'agent',
    section: 'Tutoriels',
    title: 'Utiliser MEGGA AI au quotidien',
    description: 'Les 6 commandes IA les plus utiles : résumé, relance, matching, annonce, marché, actions.',
    keywords: ['ia', 'copilote', 'megga ai', 'commandes', 'résumé', 'relance', 'rédiger', 'quotidien'],
    relatedSlugs: ['scores-ia', 'action-board', 'matching'],
    content: `## Utiliser MEGGA AI au quotidien

### Accéder à MEGGA AI

Cliquez sur le bouton **\u2728** en bas à droite de n'importe quelle page du dashboard. Un panel de chat s'ouvre.

### Les 6 commandes les plus utiles

**1. Résumer un client**
> "Résume-moi M. Dupont"

MEGGA AI génère un résumé structuré : profil, historique des interactions, état de la relation, prochaines étapes suggérées.

**2. Rédiger une relance**
> "Rédige une relance pour Mme Martin après la visite d'hier"

Un email ou message personnalisé et contextualisé, prêt à envoyer.

**3. Trouver des biens compatibles**
> "Quels biens envoyer à M. Schmid ?"

MEGGA AI analyse les critères du client et propose une shortlist avec scores de compatibilité.

**4. Rédiger une annonce**
> "Rédige une annonce pour le 4 pièces rue du Rhône"

Génération d'un texte d'annonce professionnel basé sur les caractéristiques du bien.

**5. Analyser le marché**
> "Comment se positionne le bien rue de Lausanne par rapport au marché ?"

Analyse prix/m\u00b2, comparables, tendances du secteur.

**6. Prochaines actions**
> "Quelles sont mes prochaines actions prioritaires ?"

Liste triée par impact des actions recommandées pour vos clients et deals actifs.

### Le contexte est automatique

MEGGA AI connaît le contact ou le bien que vous consultez. Pas besoin de tout re-expliquer à chaque question.`,
  },
  {
    slug: 'raccourcis-productivite',
    category: 'agent',
    section: 'Tutoriels',
    title: '10 astuces pour gagner du temps',
    description: 'Raccourcis clavier, import rapide, templates, palette de commandes et autres gains de productivité.',
    keywords: ['raccourcis', 'productivité', 'astuces', 'clavier', 'rapide', 'temps', 'efficacité'],
    relatedSlugs: ['importer-contacts', 'megga-ai-quotidien', 'action-board'],
    content: `## 10 astuces pour gagner du temps

### 1. Créer un contact en 2 secondes

**\u2318\u21e7C** (Mac) / **Ctrl+Shift+C** (PC) — le formulaire de création rapide s'ouvre depuis n'importe quelle page.

### 2. Palette de commandes

**\u2318K** / **Ctrl+K** — accédez à n'importe quelle page, contact ou action en tapant quelques lettres.

### 3. Dupliquer un bien

Au lieu de tout saisir, dupliquez un bien similaire et modifiez les différences. Gain moyen : 5 minutes.

### 4. Import URL en un clic

Collez un lien d'annonce (Homegate, ImmoScout24, Comparis...) et MEGGA extrait tout : titre, prix, surface, adresse, photos.

### 5. Import contacts en lot

Glissez un fichier CSV ou vCard pour importer des dizaines de contacts en une seule opération.

### 6. Recherche IA

Tapez en langage naturel dans la barre de recherche au lieu de configurer chaque filtre manuellement.

### 7. Templates de messages

Créez des templates réutilisables pour vos relances, confirmations de visite, et présentations de biens.

### 8. Auto-save du formulaire

Le formulaire de création de bien sauvegarde automatiquement votre progression. Quittez et revenez sans rien perdre.

### 9. Navigation clavier dans la lightbox

**\u2190 \u2192** pour les photos, **P** pour afficher le plan, **Esc** pour fermer.

### 10. Action Board comme page d'accueil

Commencez chaque journée par l'Action Board — les tâches prioritaires sont déjà triées pour vous.`,
  },
]

// ── VENDEUR — Guides pratiques ─────────────────────────────────────────

const VENDEUR_GUIDES: HelpArticle[] = [
  {
    slug: 'processus-vente-suisse',
    category: 'vendeur',
    section: 'Guides pratiques',
    title: 'Les étapes d\'une vente immobilière en Suisse',
    description: 'De l\'estimation à la signature chez le notaire : les 8 étapes clés d\'une vente réussie.',
    keywords: ['vente', 'étapes', 'processus', 'notaire', 'mandat', 'suisse', 'délai', 'timeline'],
    relatedSlugs: ['estimation', 'acces-portail', 'documents-vendeur'],
    content: `## Les étapes d'une vente immobilière en Suisse

### Durée typique : 3 à 6 mois

Voici les 8 étapes principales du processus de vente en Suisse.

### 1. Estimation du bien

L'agent évalue votre bien sur la base des prix/m\u00b2 du secteur, des transactions récentes et de l'état du bien. MEGGA fournit une estimation IA instantanée complétée par l'expertise de l'agent.

### 2. Signature du mandat

Vous signez un mandat de courtage (simple ou exclusif) qui autorise l'agent à commercialiser votre bien.

### 3. Préparation (photos et staging)

Photos professionnelles, éventuellement staging virtuel IA, rédaction de l'annonce, rassemblement des documents (CECB, plans, extrait RF).

### 4. Publication et diffusion

L'annonce est publiée sur MEGGA et les portails immobiliers partenaires.

### 5. Visites et retours

L'agent organise les visites et vous transmet les retours anonymisés via votre portail vendeur.

### 6. Réception des offres

Les offres arrivent dans votre portail avec le montant, les conditions et le statut. Vous en discutez avec votre agent.

### 7. Négociation et réservation

L'agent négocie en votre nom. Une fois l'accord trouvé, le bien est réservé et retiré de la commercialisation.

### 8. Notaire et signature

Le notaire prépare l'acte authentique de vente. La signature transfère officiellement la propriété. Le paiement est versé via le compte de consignation du notaire.`,
  },
  {
    slug: 'preparer-bien-visite',
    category: 'vendeur',
    section: 'Guides pratiques',
    title: 'Préparer votre bien pour les visites',
    description: 'Checklist de 10 points pour faire bonne impression lors des visites.',
    keywords: ['visite', 'préparer', 'checklist', 'impression', 'nettoyage', 'présentation', 'conseils'],
    relatedSlugs: ['suivi-visites', 'estimation', 'communiquer-agent'],
    content: `## Préparer votre bien pour les visites

### Première impression = décision d'achat

Les acheteurs se font une opinion dans les 30 premières secondes. Voici 10 points essentiels.

### 1. Désencombrer

Retirez les objets personnels, les meubles superflus et le désordre. L'acheteur doit pouvoir se projeter.

### 2. Nettoyer en profondeur

Sols, vitres, sanitaires, cuisine — tout doit être impeccable. Faites appel à un professionnel si nécessaire.

### 3. Maximiser la lumière

Ouvrez tous les volets et rideaux. Allumez les lumières dans les pièces sombres. La luminosité est le critère n\u00b01 des acheteurs suisses.

### 4. Aérer avant chaque visite

Ouvrez les fenêtres 15 minutes avant l'arrivée des visiteurs pour renouveler l'air.

### 5. Préparer les documents

Ayez à disposition : certificat CECB, plans, extrait du registre foncier, décompte de charges PPE.

### 6. Éloigner les animaux

Prévoyez une solution pour vos animaux de compagnie pendant la visite. Certains acheteurs sont allergiques ou mal à l'aise.

### 7. Effectuer les petites réparations

Poignée cassée, joint noirci, ampoule grillée — ces détails donnent une impression de négligence.

### 8. Soigner les extérieurs

Jardin tondu, balcon rangé, entrée propre. L'extérieur est la toute première chose que l'acheteur voit.

### 9. Décoration neutre

Retirez les éléments de décoration trop personnels (photos de famille, objets religieux, collections).

### 10. Être flexible sur les horaires

Plus vous êtes disponible pour les visites, plus vite vous vendrez. Les week-ends sont particulièrement demandés.`,
  },
  {
    slug: 'analyse-positionnement',
    category: 'vendeur',
    section: 'Guides pratiques',
    title: 'L\'analyse de positionnement marché',
    description: 'Comprenez le prix/m\u00b2 de votre secteur, le risque de stagnation et les biens comparables.',
    keywords: ['analyse', 'positionnement', 'marché', 'prix', 'm2', 'comparables', 'stagnation'],
    relatedSlugs: ['estimation', 'acces-portail', 'offres-vendeur'],
    content: `## L'analyse de positionnement marché

### Où la trouver

Dans votre portail vendeur, section **Analyse**. Cette page est mise à jour automatiquement.

### Prix au m\u00b2 vs quartier

Un graphique compare le prix/m\u00b2 de votre bien avec la médiane du quartier et du canton. Vous voyez immédiatement si votre bien est positionné au-dessus, en dessous ou dans la moyenne du marché.

### Risque de stagnation

MEGGA calcule un indicateur de risque basé sur :
- Le nombre de jours en ligne
- Le nombre de visites
- Les retours des visiteurs
- L'activité du marché local

Un risque élevé signifie qu'un ajustement de prix pourrait être pertinent.

### Activité hebdomadaire

Un graphique montre l'évolution des vues, favoris et demandes de visite semaine par semaine.

### Biens comparables vendus

Jusqu'à 4 biens similaires récemment vendus dans votre secteur sont affichés avec leur prix final, surface et délai de vente. Ces comparables vous aident à comprendre le prix réaliste du marché.

### Comment utiliser cette analyse

Discutez-en avec votre agent lors de vos points réguliers. Si le bien stagne depuis plus de 6 semaines avec peu de visites, un ajustement de prix de 3-5% relance souvent l'intérêt.`,
  },
]

// ── ACHETEUR — Guides pratiques ────────────────────────────────────────

const ACHETEUR_GUIDES: HelpArticle[] = [
  {
    slug: 'financer-achat-suisse',
    category: 'acheteur',
    section: 'Guides pratiques',
    title: 'Financer votre achat immobilier en Suisse',
    description: 'Fonds propres, hypothèque, taux, amortissement : tout comprendre sur le financement suisse.',
    keywords: ['financement', 'hypothèque', 'fonds propres', 'taux', 'amortissement', 'banque', 'pilier', 'budget'],
    relatedSlugs: ['calculateur', 'rechercher-bien', 'planifier-visite'],
    content: `## Financer votre achat immobilier en Suisse

### Les fonds propres (20% minimum)

Vous devez apporter au minimum **20% du prix d'achat** en fonds propres :
- **10% minimum** en épargne liquide, 3ème pilier, ou titres
- **10% maximum** depuis le 2ème pilier (caisse de pension)

**Exemple** : pour un bien à CHF 800'000, il faut CHF 160'000 de fonds propres dont CHF 80'000 hors 2ème pilier.

### L'hypothèque

L'hypothèque couvre les 80% restants, en deux rangs :
- **1er rang** (65% du prix) : pas d'obligation d'amortissement
- **2ème rang** (15% du prix) : amortissement obligatoire sur 15 ans ou avant la retraite

### Les taux d'intérêt

Les banques proposent des taux fixes (2-10 ans) ou variables (SARON). Comparez les offres de plusieurs établissements. Un courtier hypothécaire peut négocier pour vous.

### Le taux de charge (règle des 33%)

Les charges annuelles ne doivent pas dépasser **33% du revenu brut** :
- 5% d'intérêts imputés (même si votre taux réel est plus bas)
- 1% d'amortissement
- 1% d'entretien

### L'assurance

Une assurance décès et incapacité de gain est souvent exigée par la banque pour sécuriser le remboursement de l'hypothèque.

### Frais annexes à prévoir

- Frais de notaire : 1-3% du prix (variable par canton)
- Droit de mutation : 1-3% (variable par canton)
- Déménagement, rénovations éventuelles`,
  },
  {
    slug: 'reussir-premiere-visite',
    category: 'acheteur',
    section: 'Guides pratiques',
    title: 'Réussir votre première visite',
    description: 'Questions à poser, points à vérifier, documents à demander et checklist de visite.',
    keywords: ['visite', 'première', 'questions', 'vérifier', 'checklist', 'inspection', 'conseils'],
    relatedSlugs: ['planifier-visite', 'rechercher-bien', 'comparer-biens'],
    content: `## Réussir votre première visite

### Avant la visite

- Étudiez l'annonce en détail (photos, plan, description)
- Repérez le quartier sur la carte (transports, commerces, écoles)
- Préparez une liste de questions

### Questions essentielles à poser

- Depuis combien de temps le bien est-il en vente ?
- Quel est le montant des charges PPE mensuelles ?
- Y a-t-il des travaux votés ou prévus par la copropriété ?
- Quel est le label énergétique (CECB) ?
- Le vendeur est-il ouvert à la négociation ?
- Pourquoi le vendeur vend-il ?

### Points à vérifier sur place

- **Humidité** : traces sur les murs, odeur, joints noircis
- **Bruit** : ouvrez les fenêtres, écoutez (route, voisins, avion)
- **Orientation** : où est le soleil en journée, luminosité naturelle
- **État des installations** : cuisine, salle de bain, électricité, chauffage
- **Voisinage** : état de l'immeuble, parties communes, parking

### Documents à demander

- Extrait du registre foncier
- Plans d'étage
- Certificat CECB
- Décompte de charges PPE des 3 dernières années
- Règlement de copropriété

### Après la visite

Notez vos impressions immédiatement. Utilisez le formulaire de feedback MEGGA (envoyé par email après la visite) pour structurer votre retour.`,
  },
  {
    slug: 'comprendre-charges-ppe',
    category: 'acheteur',
    section: 'Guides pratiques',
    title: 'Comprendre les charges PPE',
    description: 'Composition des charges de copropriété, montants typiques par canton et signaux d\'alerte.',
    keywords: ['charges', 'ppe', 'copropriété', 'fonds', 'rénovation', 'entretien', 'montant'],
    relatedSlugs: ['financer-achat-suisse', 'calculateur', 'rechercher-bien'],
    content: `## Comprendre les charges PPE

### Qu'est-ce que la PPE ?

La **Propriété par Étages** (PPE) est le régime de copropriété en Suisse. Chaque propriétaire possède un lot (son appartement) et une quote-part des parties communes.

### Composition des charges

Les charges mensuelles couvrent :
- **Entretien courant** : nettoyage, jardinage, ascenseur, éclairage commun
- **Fonds de rénovation** : épargne obligatoire pour les gros travaux futurs
- **Assurance bâtiment** : incendie, dégâts d'eau, responsabilité civile
- **Conciergerie** : si applicable
- **Chauffage et eau chaude** : souvent inclus dans les charges
- **Administration** : gérance, comptabilité, assemblées générales

### Montants typiques

Les charges varient selon le canton, la taille et l'âge du bâtiment :
- **Appartement 3 pièces** : CHF 300-600/mois
- **Appartement 4-5 pièces** : CHF 400-800/mois
- Les charges sont plus élevées à **Genève** et **Zurich** qu'en Valais ou à Fribourg

### Signaux d'alerte

- **Fonds de rénovation insuffisant** : si le fonds est bas et le bâtiment ancien, des appels de fonds exceptionnels sont probables
- **Charges anormalement basses** : l'entretien est peut-être négligé
- **Charges en forte hausse** : demandez la raison (travaux votés, augmentation assurance)
- **Procès en cours** : vérifiez si la copropriété a des litiges

### Conseil

Demandez les procès-verbaux des 3 dernières assemblées générales et le décompte de charges détaillé avant de faire une offre.`,
  },
]

// ── AGENT — FAQ & Référence ────────────────────────────────────────────

const FAQ_ARTICLES: HelpArticle[] = [
  {
    slug: 'glossaire-immobilier',
    category: 'agent',
    section: 'FAQ & Référence',
    title: 'Glossaire immobilier suisse',
    description: 'Définitions des termes clés du courtage immobilier en Suisse.',
    keywords: ['glossaire', 'définitions', 'termes', 'vocabulaire', 'immobilier', 'suisse', 'ppe', 'cecb', 'lab'],
    relatedSlugs: ['creer-kyc', 'creer-bien', 'premier-deal'],
    content: `## Glossaire immobilier suisse

### Propriété et droits réels

- **PPE** (Propriété par Étages) : régime de copropriété suisse. Chaque lot est un droit distinct inscrit au registre foncier
- **Registre foncier** : registre officiel cantonal où sont inscrits tous les droits réels immobiliers
- **Servitude** : droit réel limité grevant un immeuble au profit d'un autre (passage, vue, conduites)
- **Droit de superficie** : droit de construire sur le terrain d'autrui, inscrit au registre foncier
- **Usufruit** : droit d'utiliser un bien et d'en percevoir les revenus sans en être propriétaire
- **Droit de préemption** : droit d'acquérir un bien en priorité à conditions égales
- **Cédule hypothécaire** : titre de gage immobilier suisse, support de l'hypothèque

### Énergie et construction

- **CECB** (Certificat Énergétique Cantonal des Bâtiments) : diagnostic énergétique officiel (classes A à G)
- **Minergie** : label suisse de construction basse consommation (Minergie, Minergie-P, Minergie-A)
- **COS** (Coefficient d'Occupation du Sol) : rapport entre surface bâtie et surface du terrain
- **IUS** (Indice d'Utilisation du Sol) : rapport entre surface brute de plancher et surface du terrain

### Conformité et juridique

- **LAB** (Loi sur le blanchiment d'argent) : loi fédérale imposant des obligations de diligence aux intermédiaires financiers, y compris les courtiers immobiliers
- **KYC** (Know Your Customer) : processus de vérification de l'identité et de l'origine des fonds
- **PEP** (Personne Politiquement Exposée) : personne exerçant ou ayant exercé une fonction publique importante
- **Acte authentique** : document notarié ayant force exécutoire (obligatoire pour tout transfert immobilier en Suisse)
- **nFADP** : nouvelle Loi fédérale sur la Protection des Données (entrée en vigueur 1er septembre 2023)

### Courtage et transactions

- **Mandat exclusif** : un seul agent mandaté pour la vente, meilleur engagement
- **Mandat simple** : plusieurs agents peuvent commercialiser le même bien
- **Courtage** : commission de l'agent, généralement 2-3% du prix de vente en Suisse
- **Régie** : société de gestion immobilière (administration, gérance locative)
- **Gérance** : gestion courante d'un immeuble (encaissement loyers, entretien, relations locataires)
- **Note hypothécaire** : ancien terme pour cédule hypothécaire de registre
- **Expertise** : évaluation professionnelle de la valeur d'un bien par un expert certifié`,
  },
  {
    slug: 'faq-generale',
    category: 'agent',
    section: 'FAQ & Référence',
    title: 'Questions fréquentes',
    description: '10 questions-réponses sur l\'utilisation quotidienne de MEGGA.',
    keywords: ['faq', 'questions', 'réponses', 'aide', 'problème', 'mot de passe', 'plan', 'export', 'équipe'],
    relatedSlugs: ['configurer-profil', 'plans-et-tarifs', 'securite-confidentialite'],
    content: `## Questions fréquentes

### Comment réinitialiser mon mot de passe ?

Sur la page de connexion, cliquez "Mot de passe oublié". Un email avec un lien de réinitialisation vous est envoyé. Le lien est valable 1 heure.

### Comment changer de plan ?

Rendez-vous dans **Paramètres > Abonnement**. Vous pouvez passer d'un plan à l'autre à tout moment. Le changement prend effet immédiatement et la facturation est ajustée au prorata.

### Comment exporter mes données ?

Depuis la page Contacts ou Biens, cliquez l'icône d'export CSV en haut à droite. Vous pouvez exporter la liste complète ou une sélection filtrée.

### Comment inviter un membre d'équipe ?

Dans **Paramètres > Équipe**, cliquez "Inviter". Saisissez l'email et le rôle (agent, manager, assistant). Le membre reçoit un email d'invitation.

### Comment connecter Google Calendar ?

Dans **Paramètres > Applications**, trouvez Google Calendar et cliquez "Connecter". Autorisez l'accès OAuth. Vos événements Google apparaissent en violet dans le calendrier MEGGA.

### Comment supprimer mon compte ?

Contactez le support via la page Aide. La suppression est définitive et entraîne la perte de toutes les données. Un délai de 30 jours est appliqué.

### Combien de temps les données sont-elles conservées ?

Les données sont conservées tant que votre compte est actif. Après suppression, elles sont purgées sous 30 jours conformément à la nFADP.

### Qui peut voir mes données ?

Seuls les membres de votre agence ont accès à vos données (isolation par Row Level Security). MEGGA n'accède pas à vos données sauf pour le support technique sur demande.

### Existe-t-il une application mobile ?

Pas encore. MEGGA est une application web responsive qui fonctionne sur mobile via le navigateur. Une application native est prévue en Phase 2.

### Comment contacter le support ?

Via la page **Aide > Contacter le support** ou par email à support@megga.ch. Temps de réponse : 24h en jours ouvrés.`,
  },
  {
    slug: 'securite-confidentialite',
    category: 'agent',
    section: 'FAQ & Référence',
    title: 'Sécurité et confidentialité',
    description: 'Chiffrement, isolation des données, conformité nFADP et mesures de protection.',
    keywords: ['sécurité', 'confidentialité', 'chiffrement', 'tls', 'aes', 'rls', 'nfadp', 'données', 'protection'],
    relatedSlugs: ['faq-generale', 'validation-kyc', 'configurer-profil'],
    content: `## Sécurité et confidentialité

### Chiffrement des données

- **En transit** : TLS 1.3 sur toutes les connexions (HTTPS obligatoire)
- **Au repos** : AES-256 pour le chiffrement des bases de données (standard Supabase)

### Isolation des données (RLS)

Chaque agence est isolée grâce au **Row Level Security** (RLS) de PostgreSQL. Un agent de l'agence A ne peut jamais accéder aux données de l'agence B, même en cas de faille applicative.

### Contrôle d'accès (RBAC)

4 rôles avec des permissions différentes :
- **Admin** : accès complet à l'agence
- **Manager** : gestion équipe + toutes les fonctionnalités
- **Agent** : CRM, biens, transactions, KYC
- **Assistant** : lecture seule + actions limitées

### Authentification

- Email + mot de passe (bcrypt)
- Google OAuth (connexion en un clic)

### Conformité nFADP

MEGGA respecte la nouvelle Loi fédérale sur la Protection des Données :
- Données hébergées en UE (eu-west-1, Irlande)
- Pas de transfert de données hors UE/Suisse
- Droit d'accès, de rectification et de suppression
- Registre des traitements maintenu

### Audit trail

Toutes les actions sensibles sont enregistrées dans un journal d'audit horodaté (connexions, modifications KYC, exports, validations).`,
  },
  {
    slug: 'plans-et-tarifs',
    category: 'agent',
    section: 'FAQ & Référence',
    title: 'Comprendre les plans et tarifs',
    description: 'Comparaison des 3 plans MEGGA : Starter, Pro et Agency avec fonctionnalités détaillées.',
    keywords: ['plans', 'tarifs', 'prix', 'abonnement', 'starter', 'pro', 'agency', 'fonctionnalités'],
    relatedSlugs: ['faq-generale', 'configurer-profil', 'virtual-staging'],
    content: `## Comprendre les plans et tarifs

### 3 plans adaptés à chaque besoin

| | Starter | Pro | Agency |
|---|---|---|---|
| **Prix** | Gratuit | CHF 89/mois | CHF 249/mois |
| **Annuel** | Gratuit | CHF 71/mois (-20%) | CHF 199/mois (-20%) |
| **Contacts** | 50 | Illimité | Illimité |
| **Biens actifs** | 10 | Illimité | Illimité |
| **Utilisateurs** | 1 | 5 | Illimité |
| **Staging IA** | Non | 50/mois | 200/mois |
| **Plan interactif** | Non | Oui | Oui |
| **KYC screening** | 5/mois | Illimité | Illimité |
| **Stockage** | 500 MB | 10 GB | 50 GB |
| **Portails vendeur** | 3 | Illimité | Illimité |

### Starter — Démarrer gratuitement

Idéal pour tester MEGGA sans engagement. Comprend le CRM de base, le matching simple, et un accès limité aux fonctionnalités IA.

### Pro — L'essentiel du courtier

Le plan le plus populaire. Contacts et biens illimités, staging IA, plan interactif, KYC complet, et synchronisation calendrier.

### Agency — Pour les équipes

Tout le plan Pro, plus : utilisateurs illimités, quotas étendus, support prioritaire, et fonctionnalités multi-agences.

### Changer de plan

Rendez-vous dans **Paramètres > Abonnement**. Le changement est immédiat, la facturation ajustée au prorata. Vous pouvez résilier à tout moment.

### Besoin d'un plan sur mesure ?

Contactez-nous pour les agences de plus de 20 agents ou les groupements immobiliers.`,
  },
]

// ── Export all articles ─────────────────────────────────────────────────

export const ALL_ARTICLES: HelpArticle[] = [
  ...AGENT_PREMIERS_PAS,
  ...AGENT_CRM,
  ...AGENT_MATCHING,
  ...AGENT_KYC,
  ...AGENT_COMM,
  ...AGENT_TUTORIALS,
  ...FAQ_ARTICLES,
  ...VENDEUR_ARTICLES,
  ...VENDEUR_GUIDES,
  ...ACHETEUR_ARTICLES,
  ...ACHETEUR_GUIDES,
]

/** Tous les articles d'une persona (agent / vendeur / acheteur). */
export function getArticlesByCategory(category: HelpArticle['category']): HelpArticle[] {
  return ALL_ARTICLES.filter(a => a.category === category)
}

/** Lookup d'un article par slug ; `undefined` si inconnu. */
export function getArticle(slug: string): HelpArticle | undefined {
  return ALL_ARTICLES.find(a => a.slug === slug)
}

/** Résout une liste de slugs en articles (ex. `relatedSlugs`) ; ignore les slugs inconnus. */
export function getArticlesBySlugs(slugs: string[]): HelpArticle[] {
  return slugs.map(s => ALL_ARTICLES.find(a => a.slug === s)).filter(Boolean) as HelpArticle[]
}

/** Libellés de sections distincts d'une persona, dans l'ordre d'apparition. */
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
  { date: '2026-03-29', title: 'Wizard /sell + Estimation IA', description: 'Estimez votre bien en 2 minutes. Fourchette basée sur 38\u2019000 biens suisses.' },
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
