# Annuaire Agents & Agences MEGGA — Spec Design

**Date** : 2026-04-05
**Approche** : A — "Google My Business de l'immobilier suisse"
**Objectifs** : Acquisition agents (funnel CRM) + Credibilite/branding
**Phase** : MVP (Phase 2 = marketplace avec encheres par canton)

---

## 1. Positionnement strategique

### Pourquoi c'est un differenciateur

**Aucune plateforme suisse n'offre un annuaire d'agents comparable.**

| Plateforme | Recherche agent | Profils | Avis | Stats verifiees |
|---|---|---|---|---|
| Homegate | Non | Page agence basique | Non | Non |
| ImmoScout24 | Non | Page agence basique | Non | Non |
| Comparis | Non | Non | Non | Non |
| RealAdvisor | Oui (thin) | Oui (basique) | Oui (peu) | Non |
| Houzy | Non (boite noire) | Non | Non | Non |
| **MEGGA** | **Oui** | **Oui (2 niveaux)** | **Oui (verifies)** | **Oui (CRM)** |

Le differentiel MEGGA : les stats de performance proviennent du CRM (pas auto-declarees). C'est un moat que personne ne peut copier sans avoir le CRM.

### Double funnel

```
Vendeur/Acheteur                    Agent/Agence
     |                                   |
     v                                   v
"Trouver un agent"              "Reclamez votre profil"
     |                                   |
     v                                   v
Profil agent                    Profil gratuit cree
     |                                   |
     v                                   v
Contact agent                   Voit "Debloquez vos stats"
     |                                   |
     v                                   v
Lead genere                     S'abonne au CRM MEGGA
```

---

## 2. Architecture des pages

### 2.1 Page de recherche — `/agents`

**URL** : `/agents`
**Navbar** : Acheter . Louer . Vendre . **Trouver un agent**

**Hero** :
- Titre : "Trouvez votre agent immobilier en Suisse"
- Sous-titre : "Comparez les professionnels verifies par MEGGA"
- Barre de recherche : input texte "Nom, agence, ville ou canton..."
- Toggle : "Agents" | "Agences" (pills, defaut = Agents)

**Filtres** :
- Canton (dropdown avec les 26 cantons + "Toute la Suisse")
- Ville (dynamique selon canton, RPC `get_cities_by_canton`)
- Specialite : Residentiel / Commercial / Luxe / Neuf / Location (pills multi-select)
- Langue : FR / DE / EN / IT (pills multi-select)
- Badge : "Tous" / "Verifies MEGGA" (toggle)

**Resultats** :
- Grille de cards (3 colonnes desktop, 2 tablet, 1 mobile)
- Tri : Pertinence (defaut) / Nom A-Z / Avis / Biens actifs
- Pagination serveur (20 par page)
- Compteur : "X agents dans le canton de Geneve"

**SEO** :
- URLs canoniques : `/agents/geneve`, `/agents/zurich`, `/agences/lausanne`
- Meta title : "Agents immobiliers a Geneve | MEGGA"
- Schema.org : `RealEstateAgent` structured data

### 2.2 Card agent (resultats)

```
+------------------------------------------+
|  [Avatar 64px]  Nom Prenom               |
|                 Agence XYZ               |
|                 Geneve, GE               |
|                 ★★★★☆ (12 avis)          |
|                                          |
|  Residentiel · Luxe · FR DE             |
|                                          |
|  [Badge "Verifie MEGGA"]   [Contacter →] |
+------------------------------------------+
```

- Avatar : photo ou initiales (bg-theme-hover)
- Badge "Verifie MEGGA" : seulement pour les abonnes CRM (bg-admin-accent/10 text-admin-accent)
- Contacter : bouton ghost → ouvre le profil

### 2.3 Card agence (resultats)

```
+------------------------------------------+
|  [Logo 64px]    Nom de l'agence          |
|                 Geneve, GE               |
|                 ★★★★☆ (8 avis)           |
|                                          |
|  5 agents · 12 biens actifs             |
|  Residentiel · Commercial               |
|                                          |
|  [Badge "Verifie MEGGA"]   [Voir →]      |
+------------------------------------------+
```

### 2.4 Profil agent — `/agents/:slug`

**Header** :
- Photo grand format (120px)
- Nom, titre, agence (lien vers page agence)
- Canton, ville
- Etoiles + nombre d'avis
- Badge "Verifie MEGGA" (si abonne CRM)
- Boutons : Contacter (tel/email) + Site web

**Section "A propos"** :
- Bio texte libre (max 500 mots)
- Specialites (badges)
- Langues parlees (badges)
- Certifications (USPI, SVIT, Brevet federal)
- Annees d'experience

**Section "Stats" (premium CRM uniquement)** :
- Biens vendus (12 derniers mois)
- Prix moyen de vente
- Temps moyen de vente (jours)
- Taux de reponse (< 1h, < 24h)
- Zone d'activite (carte mini avec pins)
- Label "Donnees verifiees par MEGGA CRM"
- Si pas abonne : zone floutee avec CTA "Reclamez votre profil pour afficher vos stats"

**Section "Avis clients"** :
- 4 axes de notation (inspire Zillow, adapte Suisse) :
  1. Connaissance locale (1-5)
  2. Expertise du processus (1-5)
  3. Reactivite (1-5)
  4. Negociation (1-5)
- Note globale calculee (moyenne des 4 axes)
- Commentaire texte libre
- Badge "Client verifie" si l'avis vient d'un contact CRM
- L'agent peut repondre publiquement a chaque avis
- Tri : Plus recents / Meilleure note / Plus utile

**Section "Biens actifs"** (premium CRM uniquement) :
- Grille de cards listings (photos, prix, adresse)
- Lien vers la fiche bien MEGGA
- Si pas abonne : "X biens actifs — Devenez partenaire MEGGA pour les afficher"

**CTA "Reclamer ce profil"** (si profil non reclame) :
- Bouton prominent en haut du profil
- Lien vers le formulaire d'inscription CRM
- "Vous etes [Nom] ? Reclamez ce profil pour gerer vos informations et debloquer les fonctionnalites premium."

### 2.5 Profil agence — `/agences/:slug`

**Header** :
- Logo agence (ou placeholder Building2)
- Nom, adresse, canton
- Site web, telephone, email
- Badge "Verifie MEGGA" (si au moins 1 agent abonne CRM)

**Section "L'equipe"** :
- Grille de cards agents (avatar, nom, specialite)
- Lien vers le profil individuel de chaque agent

**Section "A propos"** :
- Description agence
- Annee de creation
- Zones couvertes (cantons/villes)
- Specialites
- Certifications (USPI, SVIT, membre de)

**Section "Biens actifs"** (si agents CRM) :
- Grille de tous les biens actifs de l'agence

**Section "Avis"** :
- Agregation des avis de tous les agents de l'agence
- Note globale agence

---

## 3. Systeme de profils a 2 niveaux

### Niveau 1 — Profil gratuit (non reclame ou reclame basique)

**Source** : registres publics USPI/SVIT (nom agence, canton) ou auto-inscription
**Contenu** :
- Nom agent/agence
- Canton, ville
- Specialite (si renseigne)
- Description (si reclamee)
- Photo/logo (si reclame)
- Lien site web (si reclame)
- Contact (si reclame)

**Etat "Non reclame"** :
- Badge gris "Profil non reclame"
- CTA : "Vous etes cette agence ? Reclamez votre profil"
- Pas de photo, pas de description — juste nom + localisation

**Etat "Reclame gratuit"** :
- L'agent a reclame le profil (email de verification)
- Peut ajouter photo, bio, specialites, contact
- Pas de stats, pas d'avis verifies, pas de biens
- CTA : "Passez a MEGGA Pro pour debloquer vos stats verifiees"

### Niveau 2 — Profil premium (abonne CRM MEGGA)

**Source** : donnees CRM auto-alimentees
**Contenu supplementaire** :
- Badge "Verifie MEGGA" (violet, bg-admin-accent)
- Stats de performance (biens vendus, prix moyen, temps moyen, taux reponse)
- Avis clients verifies (badge "Client verifie MEGGA")
- Biens actifs affiches (sync avec les properties CRM)
- Zone d'activite (carte)
- Timeline activite recente
- Position privilegiee dans les resultats de recherche

**Auto-alimentation CRM** :
- `properties` status='sold' → compteur "biens vendus"
- `transactions` stage='signed' → stats closing
- `activity_events` → taux de reponse
- `contacts` feedback → avis verifies
- Calcul automatique, pas de saisie manuelle

---

## 4. Schema de donnees

### Nouvelles tables

```sql
-- Profils publics agents (separe de profiles pour la partie publique)
agent_profiles (
  id uuid PK DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id),  -- NULL si non reclame
  agency_profile_id uuid REFERENCES agency_profiles(id),

  -- Identite
  first_name text NOT NULL,
  last_name text NOT NULL,
  slug text UNIQUE NOT NULL,  -- URL-friendly : "jean-dupont-geneve"
  photo_url text,

  -- Localisation
  canton text,  -- GE, VD, ZH...
  city text,

  -- Professionnel
  specialties text[],  -- ['residential', 'luxury', 'commercial']
  languages text[],    -- ['fr', 'de', 'en']
  bio text,
  experience_years integer,
  certifications text[],  -- ['USPI', 'SVIT', 'Brevet federal']
  website_url text,
  phone text,
  email text,

  -- Statut
  status text DEFAULT 'unclaimed',  -- 'unclaimed' | 'claimed' | 'verified'
  claim_token uuid,  -- token pour reclamer
  claimed_at timestamptz,
  verified_at timestamptz,  -- quand l'agent s'abonne au CRM

  -- Stats (calculees, alimentees par le CRM)
  stats_properties_sold integer DEFAULT 0,
  stats_avg_price numeric DEFAULT 0,
  stats_avg_days_to_sell integer DEFAULT 0,
  stats_response_rate numeric DEFAULT 0,  -- 0-100
  stats_updated_at timestamptz,

  -- SEO
  meta_title text,
  meta_description text,

  -- Avis agreges (calcules)
  rating_avg numeric DEFAULT 0,  -- 0-5
  rating_count integer DEFAULT 0,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Profils publics agences
agency_profiles (
  id uuid PK DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES agencies(id),  -- NULL si non reclamee

  -- Identite
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,

  -- Localisation
  canton text,
  city text,
  address text,

  -- Info
  description text,
  founded_year integer,
  specialties text[],
  languages text[],
  certifications text[],
  website_url text,
  phone text,
  email text,
  zones_covered text[],  -- cantons/villes

  -- Statut
  status text DEFAULT 'unclaimed',
  claim_token uuid,
  claimed_at timestamptz,
  verified_at timestamptz,

  -- Stats agregees
  agent_count integer DEFAULT 0,
  active_listings_count integer DEFAULT 0,
  rating_avg numeric DEFAULT 0,
  rating_count integer DEFAULT 0,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Avis clients
agent_reviews (
  id uuid PK DEFAULT gen_random_uuid(),
  agent_profile_id uuid NOT NULL REFERENCES agent_profiles(id),

  -- Auteur
  reviewer_name text NOT NULL,
  reviewer_email text,  -- pour verification, jamais affiche
  reviewer_contact_id uuid REFERENCES contacts(id),  -- si client CRM
  is_verified boolean DEFAULT false,  -- true si contact CRM

  -- Notation (4 axes)
  rating_local_knowledge smallint CHECK (rating_local_knowledge BETWEEN 1 AND 5),
  rating_process_expertise smallint CHECK (rating_process_expertise BETWEEN 1 AND 5),
  rating_responsiveness smallint CHECK (rating_responsiveness BETWEEN 1 AND 5),
  rating_negotiation smallint CHECK (rating_negotiation BETWEEN 1 AND 5),
  rating_overall numeric GENERATED ALWAYS AS (
    (rating_local_knowledge + rating_process_expertise + rating_responsiveness + rating_negotiation) / 4.0
  ) STORED,

  -- Contenu
  comment text,

  -- Reponse agent
  agent_response text,
  agent_responded_at timestamptz,

  -- Moderation
  status text DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  moderated_at timestamptz,

  created_at timestamptz DEFAULT now()
);
```

### Index

```sql
CREATE INDEX idx_agent_profiles_canton ON agent_profiles(canton);
CREATE INDEX idx_agent_profiles_status ON agent_profiles(status);
CREATE INDEX idx_agent_profiles_slug ON agent_profiles(slug);
CREATE INDEX idx_agency_profiles_canton ON agency_profiles(canton);
CREATE INDEX idx_agency_profiles_slug ON agency_profiles(slug);
CREATE INDEX idx_agent_reviews_agent ON agent_reviews(agent_profile_id);
CREATE INDEX idx_agent_reviews_status ON agent_reviews(status);
```

### RLS

```sql
-- agent_profiles : lecture publique, ecriture par le owner
SELECT : anon + authenticated (profil public)
UPDATE : authenticated WHERE profile_id = auth.uid() OR is_super_admin()
INSERT : authenticated (claim) OR service_role (seeding)

-- agency_profiles : lecture publique, ecriture par un agent de l'agence
SELECT : anon + authenticated
UPDATE : authenticated WHERE agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid()) OR is_super_admin()

-- agent_reviews : lecture publique, ecriture par le reviewer ou moderation super_admin
SELECT : anon + authenticated WHERE status = 'approved'
INSERT : anon + authenticated (soumission avis)
UPDATE : authenticated WHERE agent_profile_id IN (...own profile...) -- reponse agent
DELETE : is_super_admin() -- moderation
```

---

## 5. Hooks et composants

### Hooks

```
useAgentDirectory(filters)     -- liste paginee agents/agences avec filtres
useAgentProfile(slug)          -- profil complet d'un agent
useAgencyProfile(slug)         -- profil complet d'une agence
useAgentReviews(agentId)       -- avis d'un agent
useSubmitReview()              -- mutation : soumettre un avis
useClaimProfile()              -- mutation : reclamer un profil
```

### Pages

```
src/pages/public/AgentDirectoryPage.tsx   -- /agents (recherche)
src/pages/public/AgentProfilePage.tsx     -- /agents/:slug
src/pages/public/AgencyProfilePage.tsx    -- /agences/:slug
```

### Composants

```
src/components/directory/AgentSearchBar.tsx     -- barre recherche + filtres
src/components/directory/AgentCard.tsx          -- card dans les resultats
src/components/directory/AgencyCard.tsx         -- card agence
src/components/directory/AgentStatsPanel.tsx    -- stats premium (ou floute)
src/components/directory/ReviewCard.tsx         -- un avis
src/components/directory/ReviewForm.tsx         -- formulaire soumission avis
src/components/directory/ClaimProfileCTA.tsx    -- CTA "Reclamez ce profil"
src/components/directory/VerifiedBadge.tsx      -- badge "Verifie MEGGA"
```

---

## 6. Strategie de remplissage initial

### Phase 1 — Seed depuis registres publics (semaine 1)

1. Scraper les pages publiques USPI (uspi.ch) et SVIT (svit.ch) pour extraire :
   - Noms d'agences (donnees commerciales publiques)
   - Cantons/villes
   - PAS de donnees personnelles (pas de noms d'agents individuels)
2. Inserer dans `agency_profiles` avec status='unclaimed'
3. Generer un slug pour chaque agence
4. Objectif : ~500-1000 agences listees

### Phase 2 — Outbound cible (semaine 2-4)

1. Identifier 50-100 agences cibles (Geneve, Lausanne, Zurich, Bale)
2. Email template :
   ```
   Objet : Votre agence [Nom] est referencee sur MEGGA

   Bonjour,

   Votre agence apparait dans l'annuaire professionnel MEGGA,
   la nouvelle reference immobiliere suisse.

   Reclamez votre profil gratuit en 2 minutes :
   → [Lien de reclamation]

   En bonus, 3 mois d'essai gratuit de MEGGA Pro
   (CRM, KYC, matching IA).
   ```
3. Suivi : relance J+7 si pas reclame
4. Objectif : 20-30 profils reclames

### Phase 3 — Croissance organique (continu)

1. SEO : pages `/agents/geneve`, `/agents/zurich` indexees
2. Chaque nouvel abonne CRM → profil automatiquement cree et verifie
3. Gregory + premiers clients → premiers avis verifies
4. Partage social : les agents partagent leur profil MEGGA

---

## 7. Monetisation (Phase 2 — post 50 agences)

Pas de monetisation directe dans le MVP. L'annuaire est un **funnel d'acquisition** vers le CRM.

**Phase 2** (quand volume suffisant) :
- Position premium dans les resultats (agents Pro/Agency en premier)
- "Agent recommande" dans la zone du vendeur (apres estimation sur /vendre)
- Analytics profil (nombre de vues, clics contact)
- Lead routing : le vendeur contacte un agent → lead dans le CRM

---

## 8. Conformite LPD (Suisse)

- Donnees agences USPI/SVIT = donnees commerciales publiques (pas de consentement requis)
- Donnees personnelles agents = opt-in uniquement (reclamation de profil)
- Avis clients = pseudonymes acceptes, email pour verification interne uniquement
- Droit de suppression : un agent peut demander la suppression de son profil
- Pas de scraping de donnees personnelles (noms, emails, telephones d'individus)
- Politique de confidentialite mise a jour pour couvrir l'annuaire

---

## 9. Hors scope MVP

- Encheres par canton (Phase 2 — monetisation)
- Matching automatique vendeur-agent (Phase 2 — post estimation)
- Chat direct acheteur-agent depuis l'annuaire (Phase 2)
- Comparateur d'agents cote a cote (Phase 2)
- API publique pour les agences (Phase 3)
- Application mobile dediee (Phase 3)
- Integration portails (Homegate, ImmoScout24) — pas d'API publique disponible
