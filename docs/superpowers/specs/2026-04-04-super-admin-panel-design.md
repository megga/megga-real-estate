# Super-Admin MEGGA — Spec Design

> Panneau de controle super-admin pour piloter toute la plateforme MEGGA Real Estate.
> Accessible uniquement au role `super_admin` depuis la sidebar du dashboard agent.

---

## 1. Role & Acces

### Nouveau role : `super_admin`

- Ajoute au enum existant : `'super_admin' | 'admin' | 'manager' | 'agent' | 'assistant'`
- Difference avec `admin` : `admin` = admin de son agence. `super_admin` = voit TOUTES les agences, TOUTES les donnees.
- Un seul compte super_admin au depart (Gregory/Julien).

### Protection

- **Sidebar** : section "ADMIN MEGGA" visible si `profile.role === 'super_admin'`
- **Routes** : `/dashboard/admin/*` protegees par un composant `<SuperAdminGuard>` qui redirige si role != super_admin
- **RLS** : nouvelle fonction SQL `is_super_admin()` retourne `true` si le role du user courant est super_admin
- **Policies** : les queries super-admin bypassent le filtre `agency_id` via `is_super_admin() OR agency_id = get_user_agency_id()`

### Entrees sidebar

Positionnees apres la section CONFORMITE :

```
-- ADMIN MEGGA --
  Vue d'ensemble    (LayoutDashboard)
  Agences           (Building2)
  Utilisateurs      (Users)
  Monitoring        (Activity)
  Marketplace       (Store)
  Compliance        (ShieldCheck)
  Support           (LifeBuoy)
```

---

## 2. Vue d'ensemble

**Route** : `/dashboard/admin`

### KPIs (6 cards bento)

| KPI | Source |
|-----|--------|
| Agences actives | `agencies` COUNT WHERE status != 'suspended' |
| Utilisateurs total | `profiles` COUNT |
| Biens actifs | `properties` COUNT WHERE status = 'active' |
| Transactions en cours | `transactions` COUNT WHERE status = 'active' |
| MRR estime | `subscriptions` SUM(price) WHERE status = 'active' |
| Dossiers KYC a risque | `kyc_cases` COUNT WHERE risk_level = 'high' |

### Graphiques (Recharts)

- **Croissance** : agences + utilisateurs sur 12 mois (line chart)
- **Repartition plans** : Starter / Pro / Agency (pie chart)
- **Volume transactions** : par mois (bar chart)
- **Revenus MRR** : par mois (area chart)

### Feed alertes

Les 10 derniers evenements critiques depuis `activity_events` + `platform_metrics` :
- Nouvelle agence inscrite
- Edge Function en erreur
- Dossier KYC flagge PEP/Sanctions
- Abonnement annule
- Ticket support urgent

---

## 3. Gestion des Agences

**Route** : `/dashboard/admin/agencies`

### Liste (tableau)

| Colonne | Source |
|---------|--------|
| Nom | agencies.name |
| Plan | subscriptions.plan |
| Agents | profiles COUNT WHERE agency_id |
| Biens actifs | properties COUNT WHERE agency_id AND status = 'active' |
| Transactions | transactions COUNT WHERE agency_id |
| MRR | subscriptions.price |
| Date inscription | agencies.created_at |
| Statut | agencies.status (actif/suspendu) |

- Recherche par nom
- Filtres : plan, statut, date
- Tri par colonne

### Actions

- Voir fiche detaillee
- Activer / Suspendre
- Changer le plan manuellement
- Impersonate (se connecter "en tant que")

### Fiche agence (`/dashboard/admin/agencies/:id`)

**En-tete** : logo, nom, plan, statut, date inscription

**Onglets** :
- **Infos** : adresse, email, telephone, branding
- **Equipe** : agents avec roles, derniere connexion
- **Activite** : timeline activity_events filtres par agency_id
- **Biens** : properties de cette agence
- **Transactions** : pipeline de cette agence
- **Abonnement** : plan, historique paiements Stripe, prochaine facture
- **KYC** : dossiers KYC de cette agence

---

## 4. Gestion des Utilisateurs

**Route** : `/dashboard/admin/users`

### Liste (tableau)

| Colonne | Source |
|---------|--------|
| Nom | profiles.full_name |
| Email | profiles.email |
| Agence | agencies.name (join) |
| Role | profiles.role |
| Derniere connexion | profiles.last_sign_in_at |
| Date inscription | profiles.created_at |
| Statut | actif/suspendu |

- Recherche par nom ou email
- Filtres : role, agence, statut

### Actions

- Changer le role
- Activer / Suspendre
- Reset mot de passe (Supabase Admin API)
- Impersonate

### Detail (drawer slide-in, pas de page separee)

- Avatar, nom, email, telephone
- Agence (lien cliquable)
- Role (modifiable)
- Derniere connexion
- 10 derniers activity_events

---

## 5. Monitoring technique

**Route** : `/dashboard/admin/monitoring`

### Sante plateforme (4 indicateurs)

| Indicateur | Source |
|------------|--------|
| Supabase DB | taille / limite via Management API |
| Edge Functions | derniere erreur, uptime |
| Scraping | dernier run, biens mis a jour |
| Emails Resend | envoyes aujourd'hui, delivrabilite |

### Edge Functions (tableau)

- Colonnes : Nom, Derniere invocation, Statut (ok/erreur), Temps reponse moyen, Invocations 24h
- Dot vert/rouge
- Clic -> 20 derniers logs

### Logs d'erreurs (feed)

- 50 dernieres erreurs toutes fonctions
- Filtrable par fonction, severite
- Timestamp, fonction, message, payload tronque

### Implementation technique

- Edge Function `admin-monitoring` : query logs Supabase Management API + agregation metriques
- Table `platform_metrics` : snapshots horaires (taille DB, compteurs, erreurs) via pg_cron
- Metriques Resend via API `/emails`
- Limites plan Nano : on commence avec ce qui est accessible, enrichissement au passage plan Pro

---

## 6. Moderation Marketplace

**Route** : `/dashboard/admin/marketplace`

### Annonces (tableau)

| Colonne | Source |
|---------|--------|
| Photo | properties.photos[0] |
| Titre | properties.title |
| Agence | agencies.name |
| Prix | properties.price |
| Canton | properties.canton |
| Date publication | properties.published_at |
| Qualite | quality_score (0-100) |
| Statut | en attente / publie / signale / retire |

- Filtres : statut, agence, qualite
- Tri : date, score

### Actions

- Approuver
- Signaler (raison obligatoire : photo trompeuse, prix irrealiste, doublon, contenu inapproprie)
- Retirer (avec notification agence)
- Voir fiche complete

### Alertes automatiques

- quality_score < 50
- Prix/m2 > 3x mediane canton
- Photos manquantes
- Doublons potentiels (meme adresse + surface +/- 5%)

### Metriques moderation

- Biens publies total
- Signales ce mois
- Retires ce mois
- Temps moyen traitement

---

## 7. Compliance reseau

**Route** : `/dashboard/admin/compliance`

### KPIs (4 cards)

| KPI | Source |
|-----|--------|
| Dossiers KYC total | kyc_cases COUNT (toutes agences) |
| En attente | kyc_cases WHERE status IN ('pending', 'in_progress') |
| Alertes PEP/Sanctions | kyc_cases WHERE screening_status = 'match' |
| Taux completion moyen | AVG(completion_pct) |

### Dossiers a risque (tableau)

- Filtre defaut : risk_level = 'high' OU screening_status = 'match'
- Colonnes : Contact, Agence, Type (PP/PM), Score risque, PEP, Sanctions, Completion, Date
- Clic -> KycDetailPage existant (cross-agence)

### Onglets

- A risque
- En cours (completion < 100%)
- Valides
- Tous

### Actions super-admin

- Relancer screening PEP/Sanctions
- Forcer changement risk_level
- Note interne (visible super-admin uniquement)
- Export CSV pour audit

### Audit trail

- Toutes actions loggees dans activity_events avec actor_role = 'super_admin'

---

## 8. Support

**Route** : `/dashboard/admin/support`

### Layout

2 colonnes (comme Messages existant) :
- Gauche : liste tickets tries par urgence puis date
- Droite : conversation du ticket selectionne

### Liste tickets

| Colonne | Source |
|---------|--------|
| Sujet | support_tickets.subject |
| Agence | agencies.name |
| Priorite | urgent / high / medium / low |
| Statut | open / in_progress / resolved / closed |
| Derniere reponse | ticket_messages.created_at MAX |
| Date creation | support_tickets.created_at |

- Filtres : statut, priorite, agence
- Badge "X tickets ouverts"
- Dot rouge si sans reponse > 24h

### Conversation

- Thread chronologique (bulles)
- Repondre -> email via send-email Edge Function
- Changer statut, priorite
- Notes internes (non envoyees au client)

### Reponses rapides

- Reutilise `ticket_canned_responses` existante
- Selecteur -> injection -> edition -> envoi

### Metriques

- Tickets ouverts / resolus cette semaine
- Temps reponse moyen
- Temps resolution moyen

---

## 9. Tables & Migrations

### Nouvelles tables

```sql
-- Metriques plateforme (snapshots horaires)
platform_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL,  -- 'db_size' | 'edge_function_error' | 'email_sent' | 'user_count' | 'agency_count'
  metric_value NUMERIC NOT NULL,
  metadata JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ DEFAULT now()
)

-- Moderation marketplace
moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id),
  action TEXT NOT NULL,       -- 'approve' | 'flag' | 'remove'
  reason TEXT,
  actor_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
)

-- Notes internes super-admin
admin_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,  -- 'agency' | 'user' | 'kyc_case' | 'ticket'
  entity_id UUID NOT NULL,
  content TEXT NOT NULL,
  author_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
)
```

### Modifications tables existantes

```sql
-- profiles : ajouter super_admin au role check
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'admin', 'manager', 'agent', 'assistant', 'seller', 'buyer', 'particulier'));

-- agencies : ajouter statut
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'
  CHECK (status IN ('active', 'suspended'));

-- properties : ajouter moderation_status
ALTER TABLE properties ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'published'
  CHECK (moderation_status IN ('pending', 'published', 'flagged', 'removed'));
ALTER TABLE properties ADD COLUMN IF NOT EXISTS moderation_reason TEXT;
```

### Fonctions RLS

```sql
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### Policies RLS (toutes les tables admin)

- `platform_metrics` : SELECT si is_super_admin()
- `moderation_actions` : SELECT/INSERT si is_super_admin()
- `admin_notes` : SELECT/INSERT si is_super_admin()
- Tables existantes : ajouter `OR is_super_admin()` aux policies SELECT

### Edge Function

- `admin-monitoring` : query Supabase Management API, agrege metriques, retourne JSON

### pg_cron

- `platform-metrics-hourly` : toutes les heures, insere snapshot dans platform_metrics

---

## 10. Fichiers a creer

```
src/pages/admin/
  AdminLayout.tsx                  -- Layout avec guard super_admin
  AdminDashboardPage.tsx           -- Vue d'ensemble
  AdminAgenciesPage.tsx            -- Liste agences
  AdminAgencyDetailPage.tsx        -- Fiche agence
  AdminUsersPage.tsx               -- Liste utilisateurs
  AdminMonitoringPage.tsx          -- Monitoring technique
  AdminMarketplacePage.tsx         -- Moderation marketplace
  AdminCompliancePage.tsx          -- Compliance reseau
  AdminSupportPage.tsx             -- Support tickets

src/hooks/
  useAdminStats.ts                 -- KPIs globaux
  useAdminAgencies.ts              -- CRUD agences
  useAdminUsers.ts                 -- CRUD utilisateurs
  useAdminMonitoring.ts            -- Metriques + logs
  useAdminModeration.ts            -- Actions moderation
  useAdminCompliance.ts            -- KYC cross-agences
  useAdminSupport.ts               -- Tickets support

src/components/admin/
  SuperAdminGuard.tsx              -- Guard protection route
  AdminKpiCard.tsx                 -- Card KPI reutilisable
  AdminAlertFeed.tsx               -- Feed alertes temps reel
  AgencyDrawer.tsx                 -- Drawer detail agence (optionnel)
  UserDrawer.tsx                   -- Drawer detail utilisateur
  ModerationActionDialog.tsx       -- Dialog signalement/retrait

supabase/migrations/
  YYYYMMDD_001_super_admin_setup.sql    -- Role, fonctions, tables, policies
  YYYYMMDD_002_platform_metrics.sql     -- Table metrics + pg_cron

supabase/functions/
  admin-monitoring/index.ts        -- Edge Function metriques plateforme
```

---

## 11. Design system

Toutes les pages admin suivent le design system MEGGA existant :
- Bentos `rounded-xl border border-theme-border`
- Boutons ghost (pas de bg-accent)
- Tableaux avec hover row, pas de zebra stripe
- Modals via createPortal
- Dark/light mode via tokens theme
- Pas d'ombres, pas de couleurs hardcodees
