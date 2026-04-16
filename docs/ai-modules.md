## 8. MODULES IA (spécifications Gregory Lyonnet)

> Gregory Lyonnet, notre expert terrain, a défini ces modules comme essentiels au quotidien d'un courtier. L'IA n'est JAMAIS un gadget — elle est toujours connectée au contexte réel du CRM.

### 8.1 MEGGA AI (ancien Copilote)

**Accès :** Bouton flottant en bas à droite (icône Sparkles, style ghost), disponible depuis toute page agent. Panel slide-in depuis le bas.

**Commandes naturelles supportées :**
- "Résume-moi ce client" → Résumé structuré (qui, où en est la relation, quoi faire ensuite)
- "Rédige une relance pour [client]" → Email ou WhatsApp contextualisé
- "Quels biens envoyer à [client]" → Shortlist matching avec scores
- "Prépare un mandat pour [bien]" → Pré-remplissage document
- "Quelles sont les prochaines actions" → Next-best-actions triées par priorité
- "Résume les objections de [client]" → Analyse des feedbacks de visite

**Règle clé :** L'IA doit TOUJOURS être nourrie par les vraies données CRM du client/bien/deal actif. Pas de réponse "dans le vide".

### 8.2 Matching intelligent acheteurs ↔ biens

**Flux quand un nouveau bien entre :**
1. L'IA analyse tous les acheteurs existants + leurs critères de recherche (client_searches)
2. Calcule un score de compatibilité (0-100%) basé sur : budget, zone, type, pièces, surface, features
3. Classe les meilleurs matchs
4. Propose l'envoi en un clic (email ou WhatsApp)

**Flux quand un acheteur est créé/modifié :**
1. L'IA surveille tous les biens déjà présents (status = 'active')
2. Propose les biens pertinents automatiquement
3. Suggère l'envoi immédiat

**Surveillance continue (si client_search.is_active = true) :**
- Nouveaux biens dans la base → notification agent
- Changements de prix → re-matching
- Biens remis en ligne → alerte
- Message type : "3 nouveaux biens correspondent à la recherche de M. Dupont"

**Phase 2 :** Recherche externe sur portails (dépend des API disponibles).

### 8.3 Relances automatiques intelligentes

**Types de relances :**

| Trigger | Délai | Action | Canal |
|---|---|---|---|
| Bien envoyé à un client | J+3 | Reminder agent ou relance auto | Email/WhatsApp |
| Visite effectuée | J+1 | Demande de feedback | Email/WhatsApp |
| Lead inactif | J+30 | Relance douce + nouveau bien | Email |
| Acheteur chaud non relancé | J+7 | Alerte agent | Notification |
| Vendeur sans suivi récent | J+14 | Alerte + suggestion update | Notification |
| Document manquant | J+3 | Relance client | Email |

**Adaptation comportementale (Phase 2) :**
- Email ouvert mais pas de réponse → relance différente
- Bien consulté plusieurs fois → signal d'intérêt fort
- Aucune ouverture → changer de canal (WhatsApp au lieu d'email)

**Principe :** L'agent garde toujours le contrôle. Les relances "auto" créent des suggestions/tâches, pas des envois silencieux (sauf si l'agent active l'envoi automatique explicitement).

### 8.4 Next Best Action

Pour chaque client ou deal, l'IA suggère la meilleure prochaine action :
- Appeler
- Relancer (email/WhatsApp)
- Envoyer un bien (avec lequel)
- Proposer une visite
- Revoir le prix (vendeur)
- Envoyer un document
- Passer à l'étape suivante du pipeline

**Implémentation :** Edge Function `ai-copilot` qui reçoit le contexte complet (contact, transactions, matchs, interactions récentes, relances) et renvoie 1-3 actions classées par impact estimé.

### 8.5 Buyer Intelligence

L'IA estime pour chaque acheteur :
- **Sérieux** (0-100) : basé sur réactivité, nombre de visites, cohérence budget/recherche
- **Budget réel estimé** : basé sur les biens consultés, offres faites, interactions
- **Timing** : immédiat, 1-3 mois, 3-6 mois, 6-12 mois, long terme
- **Probabilité d'achat** (0-100)
- **Niveau d'engagement** : very_high → dormant

### 8.6 Seller Intelligence

L'IA analyse pour chaque vendeur :
- **Niveau de tension** : calm, moderate, tense, critical
- **Risque d'insatisfaction** : basé sur durée de mise en vente, feedbacks, relances
- **Probabilité d'accepter une baisse** (0-100)
- **Niveau d'urgence** : pas pressé, modéré, urgent, très urgent

### 8.7 Copilote de négociation

Quand une offre arrive, l'IA aide sur :
- Niveau de marge (écart offre vs prix demandé vs marché)
- Timing (depuis combien de temps le bien est en vente, combien de visites)
- Stratégie de contre-offre suggérée
- Degré d'intérêt probable de l'acheteur (basé sur son historique)

### 8.8 Génération d'annonces multi-versions

Pour chaque bien, l'IA génère automatiquement :
- **Version standard** — portails classiques
- **Version premium** — mise en valeur haut de gamme
- **Version luxe** — vocabulaire immobilier de prestige
- **Version courte** — SMS/WhatsApp
- **Version réseaux sociaux** — Instagram/LinkedIn

L'agent choisit, édite, valide. Pas de publication automatique.

### 8.9 Analyse d'objections post-visite

Après les visites, l'IA regroupe et analyse :
- Objections récurrentes (bruit, étage, luminosité, prix...)
- Points faibles identifiés du bien
- Suggestions d'ajustement (prix, mise en valeur, travaux à mentionner)

Stocké dans `visits.ai_objections` et affiché dans le portail vendeur (anonymisé).

### 8.10 KYC Tier 1 — Compliance avancée (IMPLÉMENTÉ + CONNECTÉ SUPABASE)

**100% connecté à Supabase — plus aucun mock.**

**Screening PEP & Sanctions (API dilisense) :**
- Edge Function `kyc-screening` déployée — appelle l'API dilisense (`checkIndividual` / `checkEntity`)
- Sépare automatiquement les hits PEP et Sanctions
- Statuts : `not_checked` → `pending` → `clear` | `match`
- Section "Vérification Compliance" dans KycDetailPage avec statut vert/rouge/amber
- Colonne PEP/S toujours visible dans KycListPage avec icônes : AlertTriangle (match), ShieldCheck (clear), Loader2 (pending), tiret (non vérifié)
- Bouton "Relancer la vérification" → appelle Edge Function → résultats temps réel (human-in-the-loop)
- Testé avec succès : Vladimir Putin → 3 hits PEP + 14 hits Sanctions, score 85/100
- Chaque screening loggé dans `activity_events` avec `actor_id = 'ai'`
- Secret requis : `DILISENSE_API_KEY` dans Supabase Edge Functions Secrets

**Score de risque automatique :**
- Fonction `calculateRiskScore()` dans `src/lib/kycUtils.ts` (frontend) + calculé aussi dans Edge Function (backend)
- 5 facteurs : nationalité GAFI (25pts), PEP (25pts), montant >5M (20pts), PM vs PP (15pts), docs incomplets (15pts)
- Score 0-100 → low/medium/high avec barre visuelle et facteurs détaillés
- Stocké en DB : `kyc_cases.risk_score`, `kyc_cases.risk_factors`, `kyc_cases.risk_level`
- Listes FATF dans `src/lib/constants.ts` (FATF_HIGH_RISK_COUNTRIES, FATF_INCREASED_MONITORING)
- Label "estimation IA" obligatoire

**Création de dossier KYC depuis l'interface :**
- Bouton "Nouveau dossier" dans KycListPage (header + empty state)
- Modal : sélection contact, type (PP/PM), nationalité, montant, transaction liée (optionnel)
- `useCreateKycCase()` — crée le dossier + checklist par défaut adaptée PP/PM
- Checklist auto-générée : Identité (RC/passeport, statuts, UBO), Domicile, Revenus, Origine des fonds, Compliance

**Upload documents vers Supabase Storage :**
- Bucket `kyc-documents` (privé)
- Upload avec sélection catégorie (identité, domicile, financier, compliance, autre)
- `useUploadKycDocument()` → upload Storage + INSERT documents + activity_event

**Alertes expiration documents :**
- Champs `issued_at`, `expires_at`, `document_category` sur table `documents`
- Badges "Expiré" (rouge) / "Expire dans Xj" (orange) dans la liste documents

**Menus contextuels (clic droit) :**
- Liste KYC : Voir le dossier, Lancer le screening, Changer le statut (sous-menu), Valider, Copier l'ID
- Documents : Télécharger, Valider le document, Rejeter le document
- Checklist : Marquer complété/non complété, Lier un document
- Composant `ContextMenu` Radix UI réutilisable dans `src/components/ui/context-menu.tsx`

**Validation human-in-the-loop :**
- Bouton "Valider le dossier" → modal de confirmation → `useValidateKycCase()` → status = 'validated' + activity_event
- Notes internes persistées → `useUpdateKycNotes()`
- Journal d'audit chargé depuis `activity_events` WHERE entity_type = 'kyc'

**Hooks Supabase (`src/hooks/useKyc.ts`) :**
- `useKycCases(filters?)` — liste avec join contacts
- `useKycCase(id)` — détail avec checklist
- `useKycDocuments(kycCaseId)` — documents d'un dossier
- `useKycAuditEvents(kycCaseId)` — journal d'audit
- `useCreateKycCase()` — création + checklist auto
- `useUpdateKycItem()` — toggle checklist item
- `useUpdateKycStatus()` — changement de statut
- `useUpdateKycNotes()` — sauvegarde notes
- `useValidateKycCase()` — validation human-in-the-loop
- `useUploadKycDocument()` — upload Storage + INSERT
- `useScreenKycCase()` — appel Edge Function dilisense

**RLS corrigé :**
- Récursion infinie sur `profiles` fixée avec fonctions `SECURITY DEFINER` (`get_my_agency_id()`)
- Policies `contacts`, `documents`, `activity_events` mises à jour
- Policies ouvertes temporaires sur `kyc_cases` et `kyc_checklist_items` pour dev

---

## 9. RECHERCHE IA CONVERSATIONNELLE

### Flux utilisateur
1. L'utilisateur tape en langage naturel : "3 pièces lumineux près de Cornavin, max 2'500/mois"
2. Edge Function `ai-search` reçoit la query
3. La query est embeddée via l'API d'embeddings
4. Recherche pgvector : top-20 listings similaires
5. Prompt Claude avec contexte : listings trouvés + historique conversation + contraintes
6. Claude filtre, classe, et répond en langage naturel
7. Résultats affichés sur la carte + liste

### Garde-fous IA
- Pas de discrimination (origine, genre, religion, âge)
- Pas de contenus trompeurs sur les biens
- Redirection vers agent humain si : offre, négociation, question juridique
- Disclaimer : "Les informations sont fournies à titre indicatif"
- Max 10 tours de conversation avant suggestion de contacter un agent
- Temps de réponse cible : < 2 secondes

### Garde-fous modules IA agent (section 8)
- L'IA ne contacte JAMAIS un client sans validation agent (sauf si relance auto explicitement activée)
- L'IA ne modifie JAMAIS un prix, un statut, ou une étape pipeline sans action humaine
- L'IA n'envoie JAMAIS de document juridique sans validation agent
- Les scores IA (buyer/seller intelligence) sont indicatifs — affichés comme "estimation IA", pas comme vérité
- Le copilote de négociation donne des SUGGESTIONS, pas des décisions
- Toute action IA est loggée dans `activity_events` avec `actor_id = 'ai'`

