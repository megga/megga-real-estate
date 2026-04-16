## 12. PRIORITÉ DE DÉVELOPPEMENT

> **Stratégie (alignée Document Maître) :** On construit d'abord le **Compliance-First Transaction OS** — les outils agent qui changent leur quotidien (la vraie valeur pour embarquer les 10-20 agences pilotes). La marketplace publique arrive ensuite, une fois que l'outil CRM est adopté et que les agents ont de la valeur d'usage dès le premier jour, indépendamment du nombre d'acheteurs sur le portail.

> **Migration CRM enrichi en 6 étapes :** Le CRM agent passe du modèle générique au modèle enrichi spécifié par Gregory Lyonnet. L'ordre des 6 étapes n'est pas négociable — chaque étape débloque la suivante.

### Sprint 1 (Semaine 1-2) — Fondations + Setup
- Setup projet (Vite + React + TS + Tailwind + shadcn)
- Supabase : schema de base (tables section 6), RLS, auth
- Layout : Navbar, Footer, Sidebar (avec entrées : Aujourd'hui, Pipeline, Matching, Contacts, Mes biens, KYC, Messages, Documents, Calendrier)
- HomePage avec hero + barre de recherche (statique d'abord — marketplace en Sprint 6)
- LoginPage / RegisterPage (Supabase Auth)

### Sprint 2 (Semaine 3-4) — Migration CRM Étapes 1-2

#### Étape 1 — Migrations DB (2-3 jours)
- **Migration SQL unique** : créer les 7 nouvelles tables dans l'ordre de dépendances FK :
  - `message_templates` (aucune FK externe)
  - `client_searches` (FK → contacts)
  - `matches` (FK → contacts, properties, client_searches)
  - `reminders` (FK → contacts, properties, transactions, matches)
  - `automation_rules` (FK → message_templates)
  - `visits` (FK → properties, contacts, transactions)
  - `daily_actions` (aucune FK externe)
- **ALTER TABLE contacts** : ajouter whatsapp_phone, language, nationality, budget_announced, budget_estimated_ai, search_zones, search_criteria, ai_seriousness_score, ai_purchase_probability, ai_timing, ai_engagement_level, ai_tension_level, ai_price_reduction_probability, last_interaction_at
- **ALTER TABLE transactions** : enrichir stage pour supporter les 15 étapes pipeline Gregory (new_lead, to_qualify, active_search, visit_planned, visit_done, interest_confirmed, offer, negotiation, reserved, financing, notary, signed, closed, lost, to_recontact)
- **RLS policies** sur chaque nouvelle table (pattern : agency_id via profiles WHERE id = auth.uid())
- **Index** : matches(contact_id, status), reminders(agency_id, status, trigger_at), client_searches(contact_id, is_active), daily_actions(agent_id, is_completed, generated_at), visits(property_id, scheduled_at)
- Fichier unique : `supabase/migrations/YYYYMMDD_001_enriched_crm_tables.sql`
- Tester avec `supabase db reset` avant production

#### Étape 2 — Contact Detail enrichie (4-5 jours)
- **ContactDetailPage** avec 4 zones verticales :
  - Zone 1 : En-tête (nom, avatar, type badge, score IA badge, actions rapides appel/WhatsApp/email, last_interaction_at en relatif)
  - Zone 2 : Résumé IA (encadré bg-accent/5, icône sparkle, 2-3 phrases contextualisées, label "estimation IA", refresh à la demande + cache 24h)
  - Zone 3 : Next Best Action (encadré bg-success/5, suggestion IA, bouton d'action directe)
  - Zone 4 : Tabs (Infos · Timeline · Biens envoyés · Matching · Documents · Offres)
- **ContactTimeline.tsx** — Timeline unifiée agrégeant : messages email, WhatsApp, appels, visites, biens envoyés, notes, documents, offres, changements pipeline, relances, actions IA. Chaque type a icône Lucide + couleur distincte. Source : activity_events filtrés par contact_id (MVP), puis UNION ALL sur tables source (Phase 2)
- **useContactDetail(contactId)** — Hook React Query chargeant en parallèle : contact complet, activity_events, transactions liées, client_searches actives, matches récents. Expose refreshAiSummary()
- Section critères de recherche (onglet Infos) : type, zones (badges), budget annoncé vs estimé IA, pièces min/max, surface min/max, features, timing IA
- **CopilotSummary.tsx** + **NextBestAction.tsx** — Composants pour les zones 2-3 (mode mock d'abord, connecté à Edge Function ai-copilot en Sprint 5)

### Sprint 3 (Semaine 5-6) — Migration CRM Étapes 3-4

#### Étape 3 — Pipeline Kanban 12+ colonnes (3-4 jours)
- **PipelineKanban.tsx** refactorisé avec dnd-kit — 14 colonnes :
  1. Nouveau lead (gray-400) → 2. À qualifier (gray-500) → 3. Recherche active (blue-500) → 4. Visite planifiée (cyan-500) → 5. Visite effectuée (teal-500) → 6. Intérêt confirmé (green-500) → 7. Offre (emerald-600) → 8. Négociation (amber-500) → 9. Réservé (orange-500) → 10. Financement (purple-500) → 11. Notaire (indigo-600) → 12. Signé (green-700) | Perdu (red-500) | À relancer (yellow-500)
- Scroll horizontal obligatoire. Colonnes "Perdu" et "À relancer" visuellement distinctes (opacité réduite, séparateur)
- **DealCard enrichie** : avatar contact, nom contact, adresse bien (tronquée), prix, date mise à jour en relatif, **badge orange si relance en retard** (reminders WHERE transaction_id = X AND status = 'triggered' AND trigger_at < NOW())
- Drag-and-drop → 3 actions : UPDATE transactions.stage, INSERT activity_event (stage_change avec ancien/nouveau stage), invalidation cache React Query
- Dialogue de confirmation obligatoire si drop sur "Perdu" (raison obligatoire → transactions.notes)
- Barre de résumé en haut : total deals actifs, valeur totale pipeline, deals à risque, taux de conversion

#### Étape 4 — Action Board "Quoi faire aujourd'hui" (3-4 jours)
- **ActionBoardPage.tsx** — PAGE D'ACCUEIL AGENT (première chose vue à la connexion)
- En-tête : "Bonjour [Prénom], voici votre journée" + date + compteur global "X actions recommandées"
- 5 sections par priorité décroissante :
  1. **Urgences** (bg-red-50, border-l-4 border-red-500) : deals à risque, docs manquants, relances en retard → source : daily_actions priority='urgent' + reminders en retard
  2. **Relances du jour** (bg-amber-50, border-l-4 border-amber-500) : clients à rappeler, feedbacks → source : reminders du jour
  3. **Matchs trouvés** (bg-blue-50, border-l-4 border-blue-500) : nouveaux biens compatibles → source : matches status='suggested' récents
  4. **Visites à confirmer** (bg-white) : agenda du jour → source : visits WHERE scheduled_at = TODAY
  5. **Suggestions IA** (bg-green-50, border-l-4 border-green-500) : next-best-actions → source : daily_actions category='suggestion'
- **ActionCard.tsx** : icône Lucide, titre, description courte, bouton action rapide (Appeler/Envoyer/Voir dossier), lien entité. Click → is_completed = true
- **useActionBoard(agentId)** : daily_actions non complétées + reminders actifs + visites du jour + matches non traités. staleTime 30s
- **Implémentation en 2 temps** : Phase A statique (requêtes SQL directes, sans IA — déjà utile), Phase B connectée IA (Sprint 5 — daily_actions générées par pg_cron + ai-scoring)

### Sprint 4 (Semaine 7-8) — Migration CRM Étapes 5-6

#### Étape 5 — Matching acheteurs ↔ biens (4-5 jours)
- **Logique de scoring** (Edge Function ou SQL, sans LLM) — 100 points sur 5 critères :
  - Budget (30 pts) : prix bien dans fourchette client_search
  - Zone (25 pts) : ville/canton dans search_zones
  - Type de bien (15 pts) : type = type recherché
  - Pièces/Surface (15 pts) : dans fourchettes min/max
  - Features (15 pts) : features souhaitées présentes
- **3 déclencheurs** :
  - Nouveau bien actif → matching contre tous client_searches actifs → INSERT matches score ≥ 60
  - Nouveau client/critères → matching contre toutes properties actives
  - Job pg_cron quotidien → surveillance continue pour is_active = true
- **MatchingPage.tsx** : vue globale matchs non traités, filtrables par contact ou bien
- **MatchingPanel.tsx** : intégré dans ContactDetailPage onglet Matching
- **MatchScoreCard.tsx** : photo bien, adresse, prix, score %, barre progression colorée, raisons (badges "Budget ✓", "Zone ✓", "Critères ✓"), boutons "Envoyer au client" + "Planifier visite"
- Action "Envoyer" : choix canal (email/WhatsApp), template pré-rempli depuis message_templates (property_presentation), variables remplacées, édition avant envoi, confirmation → match.status = 'sent' + activity_event + reminder auto J+3

#### Étape 6 — Système de relances (4-5 jours)
- **6 types de relances préconfigurées** :
  - Bien envoyé → J+3 → reminder agent / relance auto (email/WhatsApp)
  - Visite effectuée → J+1 → demande feedback (email/WhatsApp)
  - Lead inactif → J+30 → relance douce + nouveau bien (email)
  - Acheteur chaud non relancé → J+7 → alerte agent (notification)
  - Vendeur sans suivi récent → J+14 → alerte + suggestion update (notification)
  - Document manquant KYC → J+3 → relance client (email)
- **3 couches du moteur** :
  - Configuration : automation_rules via AutomationPage (trigger + action + delay + template + is_active)
  - Génération : pg_cron toutes les heures → Edge Function automation-engine → scanne activity_events → crée reminders
  - Exécution : reminder.trigger_at atteint → status = 'triggered' → apparaît dans Action Board
- **Principe : l'agent garde le contrôle.** Par défaut = suggestions/tâches, PAS envois silencieux. Option "envoi auto" = opt-in explicite (auto_send = true dans la règle). Même en auto, activity_event créé.
- **message_templates** : variables {{contact.first_name}}, {{property.address}}, {{property.price}}, {{agent.full_name}}, etc. Catégories : follow_up, visit_confirmation, property_presentation, post_visit, seller_update. Canal : email, whatsapp, both
- **AutomationPage.tsx** : liste règles actives (toggle on/off), formulaire création, compteur relances générées
- **ReminderList.tsx** : relances en attente + triggered, actions : marquer fait, reporter (snooze +3j), annuler
- Génération documentaire (mandat, bon de visite, fiche bien)
- KYC : liste, détail, checklist, upload documents

### Sprint 5 (Semaine 9-10) — IA & Intelligence
- Edge Functions : ai-copilot, ai-matching (enrichissement du scoring), ai-scoring (buyer/seller intelligence)
- **ActionBoardPage connecté à l'IA** (daily_actions générées par pg_cron + ai-scoring)
- **Next-best-action** par client/deal (connecte CopilotSummary + NextBestAction à Edge Function ai-copilot)
- **Buyer intelligence + Seller intelligence** (scores IA enrichis via ai-scoring)
- Copilot Panel global (commandes naturelles : résumé, relance, matching, mandat, prochaines actions)
- Edge Function ai-search (pgvector + Claude API) pour recherche conversationnelle (Phase 2 prioritaire)

### Sprint 6 (Semaine 11-12) — Communication + Portail vendeur
- **WhatsApp Business API** : envoi, réception, archivage dans timeline
- Messaging unifié (email + WhatsApp + interne) + Inbox
- **Portail vendeur** : dashboard confiance, visites, offres, documents, analyse positionnement
- Onboarding client (formulaires PP/PM)

### Sprint 7 (Semaine 13-14) — Marketplace publique + IA avancée
- **Marketplace publique** (vitrine) : ListingCard, ListingGrid, SearchPage, ListingPage, MapView, Favoris
- Recherche conversationnelle frontend (ChatSearch.tsx connecté à ai-search)
- **Copilote de négociation** (aide à la contre-offre)
- **Génération annonces multi-versions** (standard, premium, luxe, courte, social)
- **Analyse d'objections** post-visite

### Sprint 8 (Semaine 15-16) — Launch
- Responsive mobile
- Performance (lazy loading, image optimization)
- Tests end-to-end
- Déploiement Cloudflare Pages
- Onboarding pilote : Gregory + 10-20 agences
- Feedback loop → itérations

### Phase 2 (post-launch)
- Assistant vocal (speech-to-text → commandes CRM)
- Notes vocales → texte (transcription auto dans fiche client)
- ~~Recherche externe sur portails (API ou scraping légal)~~ → ✅ FAIT (RealAdvisor, 3 niveaux)
- Analytics avancés (PostHog + dashboards custom)
- Publication multiportails (export contenu vers portails)
- Adaptation comportementale relances (email ouvert, lien cliqué)
- Estimation IA (AVM) basée sur données Registre foncier + transactions publiques
- Virtual staging IA intégré (API tierce)
- ~~Dark mode~~ → ✅ FAIT (dashboard agent + portail vendeur)
- i18n (DE, EN, IT)
- Signature électronique intégrée
- Alertes matching temps réel (pg_cron → notification Action Board)
- Historique de prix externe (tracker les baisses)
- Templates de messages intelligents (relances pré-remplies contextualisées)

### Calculateur accessibilité inline (planifié — à implémenter)

**Objectif :** Transformer le calculateur hypothécaire (actuellement en modal séparé `AffordabilityCalculator.tsx`) en un funnel de conversion intégré directement dans la fiche bien et le preview panel.

**3 niveaux d'intégration :**

#### Niveau 1 — Estimation mensualité visible partout
- Sous chaque prix de listing (cards, preview panel, fiche bien), afficher : `~CHF 2'831/mois`
- Calcul automatique : prix × 80% hypothèque × taux 1.5% / 12 mois + charges
- Un clic ouvre le détail (niveau 2)
- Fonction utilitaire : `estimateMonthly(price, rate?, downPct?)` dans `src/lib/utils.ts`
- Affichage : `<span className="text-xs text-gray-500">~{formatCHF(monthly)}/mois</span>` sous le prix

#### Niveau 2 — Calculateur inline dans la fiche
- Remplace le modal actuel par un composant inline dans le preview panel (section dédiée) et la fiche bien (sidebar)
- Champs : Revenu brut annuel + Fonds propres disponibles (sliders + inputs)
- Résultat temps réel avec badge couleur :
  - 🟢 Vert (`text-emerald-600`) : ratio charges < 33% ET fonds propres ≥ 20% → "Vous pouvez acheter ce bien"
  - 🟠 Orange (`text-amber-600`) : ratio 33-38% OU fonds propres 15-20% → "Accessible avec conditions"
  - 🔴 Rouge (`text-red-600`) : ratio > 38% OU fonds propres < 15% → "Budget insuffisant"
- Détail breakdown : fonds propres min requis (20%), hypothèque estimée, charges annuelles (7% = 5% intérêts imputés + 1% amortissement + 1% entretien), charges max autorisées (33% revenu), prix max accessible
- CTA contextuel selon résultat :
  - Vert → "Planifier une visite" (bouton accent)
  - Orange → "Contacter un conseiller" (bouton outline)
  - Rouge → "Voir des biens dans votre budget" (lien vers `/acheter?maxPrice={prixMax}`)
- Règles suisses intégrées : règle des 33% du revenu brut, 20% fonds propres minimum, taux de charge annuel 7%

#### Niveau 3 — Intelligence CRM (côté agent)
- Quand un acheteur utilise le calculateur → `activity_event` loggé avec `actor_id = 'buyer'`, `action = 'affordability_check'`, `metadata = { property_id, result: 'green'|'orange'|'red', income_range, funds_range }`
- Le CRM agent affiche dans la fiche contact : "A vérifié son accessibilité pour [bien] — résultat : accessible"
- Nourrit le scoring comportemental : un check vert = signal d'intention fort (+20 points buyer score)
- Data anonymisée agrégée : MEGGA connaît le pouvoir d'achat moyen de ses utilisateurs par canton/ville

#### Fichiers concernés :
- `src/lib/utils.ts` — ajouter `estimateMonthly(price, rate?, downPct?)`
- `src/components/listing/ListingPreviewPanel.tsx` — section calculateur inline
- `src/components/listing/ListingSidebar.tsx` — calculateur inline (remplace le bouton modal)
- `src/components/listings/AffordabilityCalculator.tsx` — refactorer en composant inline (garder le modal comme fallback mobile)
- `src/components/listings/ListingCard.tsx` — afficher estimation mensualité sous le prix
- `src/pages/public/SearchPage.tsx` — afficher estimation mensualité dans les cards

#### Données stratégiques :
- **Rétention ×3** — les pages avec calculateur inline gardent l'utilisateur 3× plus longtemps
- **Qualification automatique** — l'acheteur se qualifie avant de contacter l'agent → leads plus chauds
- **Différenciateur Suisse** — Homegate et ImmoScout24.ch n'ont PAS de calculateur inline
- **Monétisation future** — partenariats bancaires ("X utilisateurs ont vérifié leur accessibilité → devenez partenaire hypothécaire recommandé")

### MEGGA Staging — Virtual Staging IA (planifié — à implémenter)

**Objectif :** Permettre à l'agent de meubler virtuellement les photos de pièces vides directement dans le formulaire de création de bien, avant publication. L'acheteur voit les photos déjà stagées — il ne sait pas que c'est de l'IA.

**Scénario :** Agent uniquement (Scénario A). L'acheteur ne trigger pas le staging lui-même.

**Fournisseur API :** Nano Banana 2 (Google Gemini 3.1 Flash Image)
- Coût : CHF 0.034/image (Batch API, 1024px) — CHF 0.067/image (Standard, temps réel ~5 sec)
- Résolution : 1024px (standard), 2048px (CHF 0.05), 4096px (CHF 0.15)
- Styles supportés : prompt-based (Moderne, Scandinave, Luxe, Minimaliste, Familial, Classique suisse)
- Input : photo JPG/PNG d'une pièce vide
- Output : même photo avec meubles ajoutés par IA

**Pricing MEGGA (marge > 95%) :**
| | Coût API | Prix client | Marge |
|---|---|---|---|
| 1 photo temps réel | CHF 0.067 | CHF 2.90 | 98% |
| Pack 5 photos | CHF 0.34 | CHF 9.90 | 97% |
| Pack 10 photos | CHF 0.67 | CHF 14.90 | 95% |
| Plan Pro (20 inclus/mois) | CHF 1.34 | Inclus CHF 89/mois | ~0% du coût abo |
| Plan Agency (illimité) | ~CHF 5-7/mois | Inclus CHF 249/mois | ~0% du coût abo |

**UX dans le formulaire de création de bien :**
1. L'agent upload ses photos dans `ListingFormPage`
2. Sur chaque photo de pièce vide, bouton "Meubler avec l'IA"
3. Sélecteur de style : 6 pills (Moderne, Scandinave, Luxe, Minimaliste, Familial, Classique)
4. Résultat en 5-15 secondes (progress bar ou skeleton)
5. Before/After slider pour comparer (composant `BeforeAfterSlider.tsx`)
6. L'agent choisit : publier l'original, le stagé, ou les deux
7. Badge discret "Staging virtuel" sur la photo publiée (transparence pour l'acheteur)

**Pièces supportées (intérieur uniquement) :**
- Salon / Séjour
- Chambre à coucher
- Cuisine
- Salle à manger
- Bureau / Home office
- PAS d'extérieur (jardin, terrasse, façade — l'IA est moins bonne et le ROI est faible)

**Implémentation technique :**
- Edge Function `virtual-staging/index.ts` : reçoit image + style → appelle Nano Banana 2 API → retourne image stagée
- Secret requis : `GOOGLE_AI_KEY` (Gemini API key)
- Storage : images stagées dans bucket Supabase `staging-results` (privé)
- Table : `staging_jobs` (id, property_id, photo_url, style, status, result_url, cost, created_at)
- Composant : `StagingButton.tsx` dans `ListingFormPage` — bouton + sélecteur style + before/after
- Composant : `BeforeAfterSlider.tsx` — slider horizontal drag pour comparer original vs stagé
- Hook : `useVirtualStaging(propertyId)` — CRUD staging jobs + appel Edge Function

**Fichiers concernés :**
- `supabase/functions/virtual-staging/index.ts` — Edge Function (appel Nano Banana 2)
- `src/hooks/useVirtualStaging.ts` — hook React Query
- `src/components/listings/StagingButton.tsx` — bouton + style picker + résultat
- `src/components/listings/BeforeAfterSlider.tsx` — comparaison visuelle
- `src/pages/agent/ListingFormPage.tsx` — intégration dans le formulaire

**Compteur crédits (côté agent) :**
- Plan Starter : 0 staging inclus → pay-per-use CHF 2.90/photo
- Plan Pro : 20 stagings/mois inclus
- Plan Agency : illimité
- Compteur visible dans Settings > Abonnement

---
