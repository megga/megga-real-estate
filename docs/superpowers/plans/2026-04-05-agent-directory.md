# Agent Directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public agent/agency directory at `/agents` and `/agences` with search, profiles, reviews, and a 2-level system (free/premium) to drive CRM acquisition.

**Architecture:** 3 new Supabase tables (agent_profiles, agency_profiles, agent_reviews) with public read RLS. 3 new public pages (directory search, agent profile, agency profile). 8 new components in `src/components/directory/`. 3 new hooks. 1 new i18n namespace (directory). 1 migration. 1 seed script for SVIT/SMK/USPI data. Navbar updated with "Trouver un agent" link.

**Tech Stack:** React 18, TypeScript, TanStack Query, Supabase (PostgreSQL + RLS), react-i18next, Tailwind CSS, shadcn/ui patterns, React Router v6 (lazy loading).

---

## File Structure

### New files to create

```
# Database
supabase/migrations/20260405_001_agent_directory.sql

# Seed script
scripts/seed-directory.mjs

# Hooks
src/hooks/useAgentDirectory.ts
src/hooks/useAgentProfile.ts
src/hooks/useAgentReviews.ts

# Pages
src/pages/public/AgentDirectoryPage.tsx
src/pages/public/AgentProfilePage.tsx
src/pages/public/AgencyProfilePage.tsx

# Components
src/components/directory/AgentSearchBar.tsx
src/components/directory/AgentCard.tsx
src/components/directory/AgencyCard.tsx
src/components/directory/AgentStatsPanel.tsx
src/components/directory/ReviewCard.tsx
src/components/directory/ReviewForm.tsx
src/components/directory/ClaimProfileCTA.tsx
src/components/directory/VerifiedBadge.tsx

# i18n (4 languages)
src/i18n/locales/fr/directory.json
src/i18n/locales/de/directory.json
src/i18n/locales/en/directory.json
src/i18n/locales/it/directory.json
```

### Files to modify

```
src/App.tsx                          # Add 3 lazy routes
src/components/layout/Navbar.tsx     # Add "Trouver un agent" link
src/i18n/index.ts                   # Register directory namespace
```

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260405_001_agent_directory.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- ============================================================================
-- Agent Directory — Tables, RLS, Indexes, RPC
-- ============================================================================

-- ── agency_profiles (must be created first — agent_profiles references it) ──

CREATE TABLE agency_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES agencies(id),

  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,

  canton text,
  city text,
  address text,

  description text,
  founded_year integer,
  specialties text[] DEFAULT '{}',
  languages text[] DEFAULT '{}',
  certifications text[] DEFAULT '{}',
  website_url text,
  phone text,
  email text,
  zones_covered text[] DEFAULT '{}',

  status text NOT NULL DEFAULT 'unclaimed'
    CHECK (status IN ('unclaimed', 'claimed', 'verified')),
  claim_token uuid DEFAULT gen_random_uuid(),
  claimed_at timestamptz,
  verified_at timestamptz,

  agent_count integer DEFAULT 0,
  active_listings_count integer DEFAULT 0,
  rating_avg numeric DEFAULT 0,
  rating_count integer DEFAULT 0,

  source text,  -- 'svit', 'smk', 'uspi', 'manual'
  source_id text, -- external ID for deduplication

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ── agent_profiles ──

CREATE TABLE agent_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id),
  agency_profile_id uuid REFERENCES agency_profiles(id),

  first_name text NOT NULL,
  last_name text NOT NULL,
  slug text UNIQUE NOT NULL,
  photo_url text,

  canton text,
  city text,

  specialties text[] DEFAULT '{}',
  languages text[] DEFAULT '{}',
  bio text,
  experience_years integer,
  certifications text[] DEFAULT '{}',
  website_url text,
  phone text,
  email text,

  status text NOT NULL DEFAULT 'unclaimed'
    CHECK (status IN ('unclaimed', 'claimed', 'verified')),
  claim_token uuid DEFAULT gen_random_uuid(),
  claimed_at timestamptz,
  verified_at timestamptz,

  stats_properties_sold integer DEFAULT 0,
  stats_avg_price numeric DEFAULT 0,
  stats_avg_days_to_sell integer DEFAULT 0,
  stats_response_rate numeric DEFAULT 0,
  stats_updated_at timestamptz,

  meta_title text,
  meta_description text,

  rating_avg numeric DEFAULT 0,
  rating_count integer DEFAULT 0,

  source text,
  source_id text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ── agent_reviews ──

CREATE TABLE agent_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_profile_id uuid NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE,

  reviewer_name text NOT NULL,
  reviewer_email text,
  reviewer_contact_id uuid REFERENCES contacts(id),
  is_verified boolean DEFAULT false,

  rating_local_knowledge smallint NOT NULL CHECK (rating_local_knowledge BETWEEN 1 AND 5),
  rating_process_expertise smallint NOT NULL CHECK (rating_process_expertise BETWEEN 1 AND 5),
  rating_responsiveness smallint NOT NULL CHECK (rating_responsiveness BETWEEN 1 AND 5),
  rating_negotiation smallint NOT NULL CHECK (rating_negotiation BETWEEN 1 AND 5),
  rating_overall numeric GENERATED ALWAYS AS (
    (rating_local_knowledge + rating_process_expertise + rating_responsiveness + rating_negotiation) / 4.0
  ) STORED,

  comment text,

  agent_response text,
  agent_responded_at timestamptz,

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  moderated_at timestamptz,

  created_at timestamptz DEFAULT now()
);

-- ── Indexes ──

CREATE INDEX idx_agent_profiles_canton ON agent_profiles(canton);
CREATE INDEX idx_agent_profiles_status ON agent_profiles(status);
CREATE INDEX idx_agent_profiles_slug ON agent_profiles(slug);
CREATE INDEX idx_agent_profiles_search ON agent_profiles
  USING gin (to_tsvector('french', coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || coalesce(city, '')));

CREATE INDEX idx_agency_profiles_canton ON agency_profiles(canton);
CREATE INDEX idx_agency_profiles_status ON agency_profiles(status);
CREATE INDEX idx_agency_profiles_slug ON agency_profiles(slug);
CREATE INDEX idx_agency_profiles_search ON agency_profiles
  USING gin (to_tsvector('french', coalesce(name, '') || ' ' || coalesce(city, '')));

CREATE INDEX idx_agent_reviews_agent ON agent_reviews(agent_profile_id);
CREATE INDEX idx_agent_reviews_status ON agent_reviews(status);

-- ── RLS ──

ALTER TABLE agency_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_reviews ENABLE ROW LEVEL SECURITY;

-- agency_profiles: public read, owner/admin write
CREATE POLICY "public_read_agency_profiles" ON agency_profiles
  FOR SELECT USING (true);

CREATE POLICY "owner_update_agency_profiles" ON agency_profiles
  FOR UPDATE TO authenticated
  USING (
    agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
    OR is_super_admin()
  );

CREATE POLICY "admin_insert_agency_profiles" ON agency_profiles
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

-- agent_profiles: public read, owner/admin write
CREATE POLICY "public_read_agent_profiles" ON agent_profiles
  FOR SELECT USING (true);

CREATE POLICY "owner_update_agent_profiles" ON agent_profiles
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid() OR is_super_admin());

CREATE POLICY "admin_insert_agent_profiles" ON agent_profiles
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

-- agent_reviews: public read approved, anyone can insert, owner can respond, admin can moderate
CREATE POLICY "public_read_approved_reviews" ON agent_reviews
  FOR SELECT USING (status = 'approved');

CREATE POLICY "anyone_insert_reviews" ON agent_reviews
  FOR INSERT WITH CHECK (true);

CREATE POLICY "agent_respond_reviews" ON agent_reviews
  FOR UPDATE TO authenticated
  USING (
    agent_profile_id IN (SELECT id FROM agent_profiles WHERE profile_id = auth.uid())
    OR is_super_admin()
  );

CREATE POLICY "admin_delete_reviews" ON agent_reviews
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- ── RPC: search directory ──

CREATE OR REPLACE FUNCTION search_directory(
  search_query text DEFAULT '',
  search_type text DEFAULT 'agents',  -- 'agents' | 'agencies'
  filter_canton text DEFAULT NULL,
  filter_city text DEFAULT NULL,
  filter_specialties text[] DEFAULT NULL,
  filter_languages text[] DEFAULT NULL,
  filter_verified boolean DEFAULT NULL,
  sort_by text DEFAULT 'relevance',   -- 'relevance' | 'name' | 'rating' | 'listings'
  page_number integer DEFAULT 0,
  page_size integer DEFAULT 20
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result json;
  total_count bigint;
BEGIN
  IF search_type = 'agents' THEN
    -- Count
    SELECT count(*) INTO total_count
    FROM agent_profiles ap
    WHERE (search_query = '' OR
      to_tsvector('french', coalesce(ap.first_name, '') || ' ' || coalesce(ap.last_name, '') || ' ' || coalesce(ap.city, ''))
      @@ plainto_tsquery('french', search_query)
      OR ap.first_name ILIKE '%' || search_query || '%'
      OR ap.last_name ILIKE '%' || search_query || '%'
      OR ap.city ILIKE '%' || search_query || '%')
    AND (filter_canton IS NULL OR ap.canton = filter_canton)
    AND (filter_city IS NULL OR ap.city ILIKE '%' || filter_city || '%')
    AND (filter_specialties IS NULL OR ap.specialties && filter_specialties)
    AND (filter_languages IS NULL OR ap.languages && filter_languages)
    AND (filter_verified IS NULL OR (filter_verified = true AND ap.status = 'verified') OR filter_verified = false);

    -- Results
    SELECT json_build_object(
      'total', total_count,
      'page', page_number,
      'pageSize', page_size,
      'items', coalesce(json_agg(row_to_json(r)), '[]'::json)
    ) INTO result
    FROM (
      SELECT ap.*,
        agp.name AS agency_name, agp.slug AS agency_slug
      FROM agent_profiles ap
      LEFT JOIN agency_profiles agp ON agp.id = ap.agency_profile_id
      WHERE (search_query = '' OR
        to_tsvector('french', coalesce(ap.first_name, '') || ' ' || coalesce(ap.last_name, '') || ' ' || coalesce(ap.city, ''))
        @@ plainto_tsquery('french', search_query)
        OR ap.first_name ILIKE '%' || search_query || '%'
        OR ap.last_name ILIKE '%' || search_query || '%'
        OR ap.city ILIKE '%' || search_query || '%')
      AND (filter_canton IS NULL OR ap.canton = filter_canton)
      AND (filter_city IS NULL OR ap.city ILIKE '%' || filter_city || '%')
      AND (filter_specialties IS NULL OR ap.specialties && filter_specialties)
      AND (filter_languages IS NULL OR ap.languages && filter_languages)
      AND (filter_verified IS NULL OR (filter_verified = true AND ap.status = 'verified') OR filter_verified = false)
      ORDER BY
        CASE WHEN sort_by = 'name' THEN ap.last_name END ASC,
        CASE WHEN sort_by = 'rating' THEN ap.rating_avg END DESC,
        CASE WHEN sort_by = 'listings' THEN ap.stats_properties_sold END DESC,
        CASE WHEN sort_by = 'relevance' THEN
          CASE WHEN ap.status = 'verified' THEN 0 WHEN ap.status = 'claimed' THEN 1 ELSE 2 END
        END ASC,
        ap.rating_avg DESC,
        ap.created_at DESC
      LIMIT page_size OFFSET page_number * page_size
    ) r;

  ELSE
    -- Agencies
    SELECT count(*) INTO total_count
    FROM agency_profiles agp
    WHERE (search_query = '' OR
      to_tsvector('french', coalesce(agp.name, '') || ' ' || coalesce(agp.city, ''))
      @@ plainto_tsquery('french', search_query)
      OR agp.name ILIKE '%' || search_query || '%'
      OR agp.city ILIKE '%' || search_query || '%')
    AND (filter_canton IS NULL OR agp.canton = filter_canton)
    AND (filter_city IS NULL OR agp.city ILIKE '%' || filter_city || '%')
    AND (filter_specialties IS NULL OR agp.specialties && filter_specialties)
    AND (filter_languages IS NULL OR agp.languages && filter_languages)
    AND (filter_verified IS NULL OR (filter_verified = true AND agp.status = 'verified') OR filter_verified = false);

    SELECT json_build_object(
      'total', total_count,
      'page', page_number,
      'pageSize', page_size,
      'items', coalesce(json_agg(row_to_json(r)), '[]'::json)
    ) INTO result
    FROM (
      SELECT agp.*
      FROM agency_profiles agp
      WHERE (search_query = '' OR
        to_tsvector('french', coalesce(agp.name, '') || ' ' || coalesce(agp.city, ''))
        @@ plainto_tsquery('french', search_query)
        OR agp.name ILIKE '%' || search_query || '%'
        OR agp.city ILIKE '%' || search_query || '%')
      AND (filter_canton IS NULL OR agp.canton = filter_canton)
      AND (filter_city IS NULL OR agp.city ILIKE '%' || filter_city || '%')
      AND (filter_specialties IS NULL OR agp.specialties && filter_specialties)
      AND (filter_languages IS NULL OR agp.languages && filter_languages)
      AND (filter_verified IS NULL OR (filter_verified = true AND agp.status = 'verified') OR filter_verified = false)
      ORDER BY
        CASE WHEN sort_by = 'name' THEN agp.name END ASC,
        CASE WHEN sort_by = 'rating' THEN agp.rating_avg END DESC,
        CASE WHEN sort_by = 'listings' THEN agp.active_listings_count END DESC,
        CASE WHEN sort_by = 'relevance' THEN
          CASE WHEN agp.status = 'verified' THEN 0 WHEN agp.status = 'claimed' THEN 1 ELSE 2 END
        END ASC,
        agp.rating_avg DESC,
        agp.created_at DESC
      LIMIT page_size OFFSET page_number * page_size
    ) r;
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION search_directory TO anon, authenticated;
```

- [ ] **Step 2: Verify migration syntax**

Run: `cat supabase/migrations/20260405_001_agent_directory.sql | head -5`
Expected: First lines of the migration visible, no syntax errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260405_001_agent_directory.sql
git commit -m "feat: add agent directory tables, RLS, indexes, and search RPC"
```

---

## Task 2: i18n namespace (directory)

**Files:**
- Create: `src/i18n/locales/fr/directory.json`
- Create: `src/i18n/locales/de/directory.json`
- Create: `src/i18n/locales/en/directory.json`
- Create: `src/i18n/locales/it/directory.json`
- Modify: `src/i18n/index.ts`

- [ ] **Step 1: Create FR directory namespace**

Create `src/i18n/locales/fr/directory.json`:

```json
{
  "title": "Trouver un agent immobilier en Suisse",
  "subtitle": "Comparez les professionnels verifies par MEGGA",
  "searchPlaceholder": "Nom, agence, ville ou canton...",
  "toggleAgents": "Agents",
  "toggleAgencies": "Agences",
  "filterCanton": "Canton",
  "filterAllSwitzerland": "Toute la Suisse",
  "filterSpecialty": "Specialite",
  "filterLanguage": "Langue",
  "filterVerified": "Verifies MEGGA",
  "filterAll": "Tous",
  "sortRelevance": "Pertinence",
  "sortName": "Nom A-Z",
  "sortRating": "Avis",
  "sortListings": "Biens actifs",
  "resultCount": "{{count}} agent dans {{location}}",
  "resultCount_plural": "{{count}} agents dans {{location}}",
  "resultCountAgencies": "{{count}} agence dans {{location}}",
  "resultCountAgencies_plural": "{{count}} agences dans {{location}}",
  "noResults": "Aucun resultat",
  "noResultsSubtitle": "Essayez d'elargir vos criteres de recherche",
  "specialty.residential": "Residentiel",
  "specialty.commercial": "Commercial",
  "specialty.luxury": "Luxe",
  "specialty.new": "Neuf",
  "specialty.rental": "Location",
  "badge.verified": "Verifie MEGGA",
  "badge.unclaimed": "Profil non reclame",
  "badge.claimed": "Profil reclame",
  "badge.verifiedClient": "Client verifie",
  "contact": "Contacter",
  "viewProfile": "Voir le profil",
  "viewAgency": "Voir l'agence",
  "agents": "{{count}} agent",
  "agents_plural": "{{count}} agents",
  "activeListings": "{{count}} bien actif",
  "activeListings_plural": "{{count}} biens actifs",
  "profile.about": "A propos",
  "profile.stats": "Statistiques",
  "profile.reviews": "Avis clients",
  "profile.listings": "Biens actifs",
  "profile.team": "L'equipe",
  "profile.specialties": "Specialites",
  "profile.languages": "Langues",
  "profile.certifications": "Certifications",
  "profile.experience": "{{years}} ans d'experience",
  "profile.website": "Site web",
  "stats.propertiesSold": "Biens vendus (12 mois)",
  "stats.avgPrice": "Prix moyen de vente",
  "stats.avgDays": "Temps moyen de vente",
  "stats.responseRate": "Taux de reponse",
  "stats.verifiedLabel": "Donnees verifiees par MEGGA CRM",
  "stats.blurredCTA": "Reclamez votre profil pour afficher vos stats",
  "stats.days": "{{count}} jour",
  "stats.days_plural": "{{count}} jours",
  "review.localKnowledge": "Connaissance locale",
  "review.processExpertise": "Expertise du processus",
  "review.responsiveness": "Reactivite",
  "review.negotiation": "Negociation",
  "review.overall": "Note globale",
  "review.sortRecent": "Plus recents",
  "review.sortBest": "Meilleure note",
  "review.writeReview": "Laisser un avis",
  "review.noReviews": "Aucun avis pour le moment",
  "review.yourName": "Votre nom",
  "review.yourEmail": "Votre email (confidentiel)",
  "review.yourComment": "Votre experience avec cet agent...",
  "review.submit": "Soumettre l'avis",
  "review.submitted": "Merci ! Votre avis sera publie apres moderation.",
  "review.agentResponse": "Reponse de l'agent",
  "claim.title": "Vous etes {{name}} ?",
  "claim.subtitle": "Reclamez ce profil pour gerer vos informations et debloquer les fonctionnalites premium.",
  "claim.button": "Reclamer ce profil",
  "claim.upgradeCTA": "Passez a MEGGA Pro pour debloquer vos stats verifiees",
  "claim.upgradeButton": "Decouvrir MEGGA Pro",
  "agency.aboutTitle": "A propos de l'agence",
  "agency.foundedYear": "Fondee en {{year}}",
  "agency.zonesCovered": "Zones couvertes",
  "agency.noDescription": "Aucune description disponible",
  "nav.findAgent": "Trouver un agent"
}
```

- [ ] **Step 2: Create DE directory namespace**

Create `src/i18n/locales/de/directory.json` with German translations of all keys above. Keep brand names (MEGGA, MEGGA CRM, MEGGA Pro) and technical terms unchanged.

- [ ] **Step 3: Create EN directory namespace**

Create `src/i18n/locales/en/directory.json` with English translations.

- [ ] **Step 4: Create IT directory namespace**

Create `src/i18n/locales/it/directory.json` with Italian translations.

- [ ] **Step 5: Register namespace in i18n/index.ts**

Add after the existing admin imports in each language block:

```typescript
// After: import frAdmin from './locales/fr/admin.json'
import frDirectory from './locales/fr/directory.json'
// After: import deAdmin from './locales/de/admin.json'
import deDirectory from './locales/de/directory.json'
// After: import enAdmin from './locales/en/admin.json'
import enDirectory from './locales/en/directory.json'
// After: import itAdmin from './locales/it/admin.json'
import itDirectory from './locales/it/directory.json'
```

Then add `directory: frDirectory` (and de/en/it equivalents) to each language's resource object.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/
git commit -m "feat: add directory i18n namespace (FR/DE/EN/IT)"
```

---

## Task 3: Hooks (useAgentDirectory, useAgentProfile, useAgentReviews)

**Files:**
- Create: `src/hooks/useAgentDirectory.ts`
- Create: `src/hooks/useAgentProfile.ts`
- Create: `src/hooks/useAgentReviews.ts`

- [ ] **Step 1: Create useAgentDirectory hook**

Create `src/hooks/useAgentDirectory.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface DirectoryFilters {
  query: string
  type: 'agents' | 'agencies'
  canton: string | null
  city: string | null
  specialties: string[]
  languages: string[]
  verifiedOnly: boolean
  sortBy: 'relevance' | 'name' | 'rating' | 'listings'
  page: number
}

export interface AgentProfileRow {
  id: string
  profile_id: string | null
  agency_profile_id: string | null
  first_name: string
  last_name: string
  slug: string
  photo_url: string | null
  canton: string | null
  city: string | null
  specialties: string[]
  languages: string[]
  bio: string | null
  experience_years: number | null
  certifications: string[]
  website_url: string | null
  phone: string | null
  email: string | null
  status: 'unclaimed' | 'claimed' | 'verified'
  stats_properties_sold: number
  stats_avg_price: number
  stats_avg_days_to_sell: number
  stats_response_rate: number
  rating_avg: number
  rating_count: number
  agency_name: string | null
  agency_slug: string | null
  created_at: string
}

export interface AgencyProfileRow {
  id: string
  agency_id: string | null
  name: string
  slug: string
  logo_url: string | null
  canton: string | null
  city: string | null
  address: string | null
  description: string | null
  founded_year: number | null
  specialties: string[]
  languages: string[]
  certifications: string[]
  website_url: string | null
  phone: string | null
  email: string | null
  zones_covered: string[]
  status: 'unclaimed' | 'claimed' | 'verified'
  agent_count: number
  active_listings_count: number
  rating_avg: number
  rating_count: number
  created_at: string
}

export interface DirectoryResult {
  total: number
  page: number
  pageSize: number
  items: AgentProfileRow[] | AgencyProfileRow[]
}

const PAGE_SIZE = 20

export const DEFAULT_FILTERS: DirectoryFilters = {
  query: '',
  type: 'agents',
  canton: null,
  city: null,
  specialties: [],
  languages: [],
  verifiedOnly: false,
  sortBy: 'relevance',
  page: 0,
}

export function useAgentDirectory(filters: DirectoryFilters) {
  return useQuery({
    queryKey: ['directory', filters],
    queryFn: async (): Promise<DirectoryResult> => {
      const { data, error } = await supabase.rpc('search_directory', {
        search_query: filters.query,
        search_type: filters.type,
        filter_canton: filters.canton,
        filter_city: filters.city,
        filter_specialties: filters.specialties.length > 0 ? filters.specialties : null,
        filter_languages: filters.languages.length > 0 ? filters.languages : null,
        filter_verified: filters.verifiedOnly ? true : null,
        sort_by: filters.sortBy,
        page_number: filters.page,
        page_size: PAGE_SIZE,
      })
      if (error) throw error
      return data as DirectoryResult
    },
    staleTime: 60_000,
  })
}
```

- [ ] **Step 2: Create useAgentProfile hook**

Create `src/hooks/useAgentProfile.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { AgentProfileRow, AgencyProfileRow } from './useAgentDirectory'

export function useAgentProfile(slug: string) {
  return useQuery({
    queryKey: ['agent-profile', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_profiles')
        .select('*')
        .eq('slug', slug)
        .single()
      if (error) throw error

      let agency: AgencyProfileRow | null = null
      if (data.agency_profile_id) {
        const { data: agencyData } = await supabase
          .from('agency_profiles')
          .select('*')
          .eq('id', data.agency_profile_id)
          .single()
        agency = agencyData
      }

      return { agent: data as AgentProfileRow, agency }
    },
    enabled: !!slug,
    staleTime: 60_000,
  })
}

export function useAgencyProfile(slug: string) {
  return useQuery({
    queryKey: ['agency-profile', slug],
    queryFn: async () => {
      const { data: agency, error } = await supabase
        .from('agency_profiles')
        .select('*')
        .eq('slug', slug)
        .single()
      if (error) throw error

      const { data: agents } = await supabase
        .from('agent_profiles')
        .select('id, first_name, last_name, slug, photo_url, specialties, languages, status, rating_avg, rating_count')
        .eq('agency_profile_id', agency.id)
        .order('status', { ascending: true })
        .order('rating_avg', { ascending: false })

      return { agency: agency as AgencyProfileRow, agents: (agents ?? []) as AgentProfileRow[] }
    },
    enabled: !!slug,
    staleTime: 60_000,
  })
}
```

- [ ] **Step 3: Create useAgentReviews hook**

Create `src/hooks/useAgentReviews.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AgentReview {
  id: string
  agent_profile_id: string
  reviewer_name: string
  is_verified: boolean
  rating_local_knowledge: number
  rating_process_expertise: number
  rating_responsiveness: number
  rating_negotiation: number
  rating_overall: number
  comment: string | null
  agent_response: string | null
  agent_responded_at: string | null
  created_at: string
}

export function useAgentReviews(agentProfileId: string, sortBy: 'recent' | 'best' = 'recent') {
  return useQuery({
    queryKey: ['agent-reviews', agentProfileId, sortBy],
    queryFn: async (): Promise<AgentReview[]> => {
      let query = supabase
        .from('agent_reviews')
        .select('id, agent_profile_id, reviewer_name, is_verified, rating_local_knowledge, rating_process_expertise, rating_responsiveness, rating_negotiation, rating_overall, comment, agent_response, agent_responded_at, created_at')
        .eq('agent_profile_id', agentProfileId)
        .eq('status', 'approved')

      if (sortBy === 'best') {
        query = query.order('rating_overall', { ascending: false })
      } else {
        query = query.order('created_at', { ascending: false })
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as AgentReview[]
    },
    enabled: !!agentProfileId,
    staleTime: 60_000,
  })
}

export interface SubmitReviewInput {
  agent_profile_id: string
  reviewer_name: string
  reviewer_email: string
  rating_local_knowledge: number
  rating_process_expertise: number
  rating_responsiveness: number
  rating_negotiation: number
  comment: string
}

export function useSubmitReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SubmitReviewInput) => {
      const { error } = await supabase.from('agent_reviews').insert(input)
      if (error) throw error
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['agent-reviews', input.agent_profile_id] })
    },
  })
}
```

- [ ] **Step 4: Verify TypeScript**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAgentDirectory.ts src/hooks/useAgentProfile.ts src/hooks/useAgentReviews.ts
git commit -m "feat: add directory hooks (search, profile, reviews)"
```

---

## Task 4: Shared components (VerifiedBadge, ClaimProfileCTA, AgentCard, AgencyCard)

**Files:**
- Create: `src/components/directory/VerifiedBadge.tsx`
- Create: `src/components/directory/ClaimProfileCTA.tsx`
- Create: `src/components/directory/AgentCard.tsx`
- Create: `src/components/directory/AgencyCard.tsx`

- [ ] **Step 1: Create VerifiedBadge**

Create `src/components/directory/VerifiedBadge.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VerifiedBadgeProps {
  status: 'unclaimed' | 'claimed' | 'verified'
  compact?: boolean
}

export default function VerifiedBadge({ status, compact }: VerifiedBadgeProps) {
  const { t } = useTranslation('directory')

  if (status === 'verified') {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 font-medium',
        compact ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1',
        'bg-accent/10 text-accent rounded-md'
      )}>
        <ShieldCheck className="h-3 w-3" />
        {!compact && t('badge.verified')}
      </span>
    )
  }

  if (status === 'unclaimed') {
    return (
      <span className="inline-flex items-center text-xs text-theme-muted px-2 py-1 bg-theme-hover rounded-md">
        {t('badge.unclaimed')}
      </span>
    )
  }

  return null
}
```

- [ ] **Step 2: Create ClaimProfileCTA**

Create `src/components/directory/ClaimProfileCTA.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

interface ClaimProfileCTAProps {
  name: string
  status: 'unclaimed' | 'claimed' | 'verified'
}

export default function ClaimProfileCTA({ name, status }: ClaimProfileCTAProps) {
  const { t } = useTranslation('directory')

  if (status === 'verified') return null

  if (status === 'unclaimed') {
    return (
      <div className="rounded-xl border border-dashed border-theme-border p-5 text-center">
        <p className="text-sm font-medium text-theme-primary mb-1">
          {t('claim.title', { name })}
        </p>
        <p className="text-xs text-theme-secondary mb-4">
          {t('claim.subtitle')}
        </p>
        <Link
          to="/register"
          className="inline-flex h-9 px-4 items-center rounded-lg text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors"
        >
          {t('claim.button')}
        </Link>
      </div>
    )
  }

  // claimed but not verified — upsell to CRM
  return (
    <div className="rounded-xl border border-accent/20 bg-accent/5 p-5 text-center">
      <p className="text-sm font-medium text-theme-primary mb-1">
        {t('claim.upgradeCTA')}
      </p>
      <Link
        to="/register"
        className="inline-flex h-9 px-4 mt-3 items-center rounded-lg text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors"
      >
        {t('claim.upgradeButton')}
      </Link>
    </div>
  )
}
```

- [ ] **Step 3: Create AgentCard**

Create `src/components/directory/AgentCard.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import VerifiedBadge from './VerifiedBadge'
import type { AgentProfileRow } from '@/hooks/useAgentDirectory'

interface AgentCardProps {
  agent: AgentProfileRow
}

const SPECIALTY_KEYS: Record<string, string> = {
  residential: 'specialty.residential',
  commercial: 'specialty.commercial',
  luxury: 'specialty.luxury',
  new: 'specialty.new',
  rental: 'specialty.rental',
}

export default function AgentCard({ agent }: AgentCardProps) {
  const { t } = useTranslation('directory')
  const initials = `${agent.first_name[0] ?? ''}${agent.last_name[0] ?? ''}`.toUpperCase()

  return (
    <Link
      to={`/agents/${agent.slug}`}
      className="group rounded-xl border border-theme-border p-5 hover:border-theme-active transition-colors block"
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        {agent.photo_url ? (
          <img
            src={agent.photo_url}
            alt={`${agent.first_name} ${agent.last_name}`}
            className="w-16 h-16 rounded-full object-cover flex-shrink-0"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-theme-hover flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-semibold text-theme-secondary">{initials}</span>
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-theme-primary group-hover:text-accent transition-colors">
            {agent.first_name} {agent.last_name}
          </p>
          {agent.agency_name && (
            <p className="text-xs text-theme-secondary truncate">{agent.agency_name}</p>
          )}
          <p className="text-xs text-theme-muted">
            {agent.city}{agent.canton ? `, ${agent.canton}` : ''}
          </p>

          {/* Rating */}
          {agent.rating_count > 0 && (
            <div className="flex items-center gap-1 mt-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn('h-3 w-3', i < Math.round(agent.rating_avg) ? 'fill-amber-400 text-amber-400' : 'text-theme-border')}
                />
              ))}
              <span className="text-xs text-theme-muted ml-1">({agent.rating_count})</span>
            </div>
          )}
        </div>
      </div>

      {/* Specialties + languages */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {agent.specialties.map(s => (
          <span key={s} className="text-xs text-theme-secondary">{SPECIALTY_KEYS[s] ? t(SPECIALTY_KEYS[s]) : s}</span>
        ))}
        {agent.specialties.length > 0 && agent.languages.length > 0 && (
          <span className="text-xs text-theme-muted">·</span>
        )}
        {agent.languages.map(l => (
          <span key={l} className="text-xs text-theme-muted uppercase">{l}</span>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-theme-border-subtle">
        <VerifiedBadge status={agent.status} compact />
        <span className="text-xs font-medium text-theme-secondary group-hover:text-accent transition-colors">
          {t('viewProfile')} →
        </span>
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: Create AgencyCard**

Create `src/components/directory/AgencyCard.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Building2, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import VerifiedBadge from './VerifiedBadge'
import type { AgencyProfileRow } from '@/hooks/useAgentDirectory'

interface AgencyCardProps {
  agency: AgencyProfileRow
}

export default function AgencyCard({ agency }: AgencyCardProps) {
  const { t } = useTranslation('directory')

  return (
    <Link
      to={`/agences/${agency.slug}`}
      className="group rounded-xl border border-theme-border p-5 hover:border-theme-active transition-colors block"
    >
      <div className="flex items-start gap-4">
        {/* Logo */}
        {agency.logo_url ? (
          <img
            src={agency.logo_url}
            alt={agency.name}
            className="w-16 h-16 rounded-lg object-contain flex-shrink-0 bg-theme-hover p-1"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-theme-hover flex items-center justify-center flex-shrink-0">
            <Building2 className="h-6 w-6 text-theme-tertiary" />
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-theme-primary group-hover:text-accent transition-colors truncate">
            {agency.name}
          </p>
          <p className="text-xs text-theme-muted">
            {agency.city}{agency.canton ? `, ${agency.canton}` : ''}
          </p>

          {/* Rating */}
          {agency.rating_count > 0 && (
            <div className="flex items-center gap-1 mt-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn('h-3 w-3', i < Math.round(agency.rating_avg) ? 'fill-amber-400 text-amber-400' : 'text-theme-border')}
                />
              ))}
              <span className="text-xs text-theme-muted ml-1">({agency.rating_count})</span>
            </div>
          )}

          {/* Counters */}
          <p className="text-xs text-theme-secondary mt-1">
            {t('agents', { count: agency.agent_count })}
            {agency.active_listings_count > 0 && (
              <> · {t('activeListings', { count: agency.active_listings_count })}</>
            )}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-theme-border-subtle">
        <VerifiedBadge status={agency.status} compact />
        <span className="text-xs font-medium text-theme-secondary group-hover:text-accent transition-colors">
          {t('viewAgency')} →
        </span>
      </div>
    </Link>
  )
}
```

- [ ] **Step 5: Verify TypeScript**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/directory/
git commit -m "feat: add directory cards and shared components"
```

---

## Task 5: Review components (ReviewCard, ReviewForm, AgentStatsPanel)

**Files:**
- Create: `src/components/directory/ReviewCard.tsx`
- Create: `src/components/directory/ReviewForm.tsx`
- Create: `src/components/directory/AgentStatsPanel.tsx`

- [ ] **Step 1: Create ReviewCard**

Create `src/components/directory/ReviewCard.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { Star, ShieldCheck } from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import type { AgentReview } from '@/hooks/useAgentReviews'

interface ReviewCardProps {
  review: AgentReview
}

const AXES = [
  { key: 'rating_local_knowledge', i18n: 'review.localKnowledge' },
  { key: 'rating_process_expertise', i18n: 'review.processExpertise' },
  { key: 'rating_responsiveness', i18n: 'review.responsiveness' },
  { key: 'rating_negotiation', i18n: 'review.negotiation' },
] as const

export default function ReviewCard({ review }: ReviewCardProps) {
  const { t } = useTranslation('directory')

  return (
    <div className="rounded-xl border border-theme-border p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-theme-primary">{review.reviewer_name}</span>
          {review.is_verified && (
            <span className="inline-flex items-center gap-1 text-xs text-accent">
              <ShieldCheck className="h-3 w-3" />
              {t('badge.verifiedClient')}
            </span>
          )}
        </div>
        <span className="text-xs text-theme-muted">{formatRelativeDate(review.created_at)}</span>
      </div>

      {/* 4-axis ratings */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {AXES.map(axis => {
          const value = review[axis.key]
          return (
            <div key={axis.key} className="flex items-center justify-between">
              <span className="text-xs text-theme-secondary">{t(axis.i18n)}</span>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={cn('h-2.5 w-2.5', i < value ? 'fill-amber-400 text-amber-400' : 'text-theme-border')} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Comment */}
      {review.comment && (
        <p className="text-sm text-theme-primary">{review.comment}</p>
      )}

      {/* Agent response */}
      {review.agent_response && (
        <div className="mt-3 pl-4 border-l-2 border-theme-border">
          <p className="text-xs font-medium text-theme-secondary mb-1">{t('review.agentResponse')}</p>
          <p className="text-sm text-theme-primary">{review.agent_response}</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create ReviewForm**

Create `src/components/directory/ReviewForm.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Star, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSubmitReview } from '@/hooks/useAgentReviews'

interface ReviewFormProps {
  agentProfileId: string
  onSuccess?: () => void
}

const AXES = [
  { key: 'rating_local_knowledge' as const, i18n: 'review.localKnowledge' },
  { key: 'rating_process_expertise' as const, i18n: 'review.processExpertise' },
  { key: 'rating_responsiveness' as const, i18n: 'review.responsiveness' },
  { key: 'rating_negotiation' as const, i18n: 'review.negotiation' },
]

export default function ReviewForm({ agentProfileId, onSuccess }: ReviewFormProps) {
  const { t } = useTranslation('directory')
  const submitReview = useSubmitReview()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [comment, setComment] = useState('')
  const [ratings, setRatings] = useState({
    rating_local_knowledge: 0,
    rating_process_expertise: 0,
    rating_responsiveness: 0,
    rating_negotiation: 0,
  })
  const [submitted, setSubmitted] = useState(false)

  const allRated = Object.values(ratings).every(v => v > 0)
  const canSubmit = name.trim() && email.trim() && allRated && !submitReview.isPending

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    submitReview.mutate(
      { agent_profile_id: agentProfileId, reviewer_name: name, reviewer_email: email, comment, ...ratings },
      { onSuccess: () => { setSubmitted(true); onSuccess?.() } }
    )
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-theme-border p-5 text-center">
        <p className="text-sm text-emerald-600">{t('review.submitted')}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-theme-border p-5 space-y-4">
      {/* Ratings */}
      {AXES.map(axis => (
        <div key={axis.key}>
          <label className="text-xs text-theme-secondary mb-1 block">{t(axis.i18n)}</label>
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setRatings(prev => ({ ...prev, [axis.key]: i + 1 }))}
                className="p-0.5"
              >
                <Star className={cn('h-5 w-5 transition-colors', i < ratings[axis.key] ? 'fill-amber-400 text-amber-400' : 'text-theme-border hover:text-amber-300')} />
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Text fields */}
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder={t('review.yourName')}
        className="w-full h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg text-theme-primary placeholder:text-theme-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
      />
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder={t('review.yourEmail')}
        className="w-full h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg text-theme-primary placeholder:text-theme-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
      />
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder={t('review.yourComment')}
        rows={3}
        className="w-full px-3 py-2 text-sm bg-transparent border border-theme-border rounded-lg text-theme-primary placeholder:text-theme-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
      />

      <button
        type="submit"
        disabled={!canSubmit}
        className="h-9 px-4 text-sm font-medium rounded-lg border border-theme-border text-theme-primary hover:border-theme-active disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
      >
        {submitReview.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {t('review.submit')}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Create AgentStatsPanel**

Create `src/components/directory/AgentStatsPanel.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { Lock } from 'lucide-react'
import { formatCHF } from '@/lib/utils'
import type { AgentProfileRow } from '@/hooks/useAgentDirectory'

interface AgentStatsPanelProps {
  agent: AgentProfileRow
}

export default function AgentStatsPanel({ agent }: AgentStatsPanelProps) {
  const { t } = useTranslation('directory')
  const isVerified = agent.status === 'verified'

  const stats = [
    { label: t('stats.propertiesSold'), value: String(agent.stats_properties_sold) },
    { label: t('stats.avgPrice'), value: formatCHF(agent.stats_avg_price) },
    { label: t('stats.avgDays'), value: t('stats.days', { count: agent.stats_avg_days_to_sell }) },
    { label: t('stats.responseRate'), value: `${Math.round(agent.stats_response_rate)}%` },
  ]

  return (
    <div className="rounded-xl border border-theme-border p-5">
      <h3 className="text-sm font-semibold text-theme-primary mb-4">{t('profile.stats')}</h3>

      {isVerified ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            {stats.map(s => (
              <div key={s.label}>
                <p className="text-lg font-bold text-theme-primary">{s.value}</p>
                <p className="text-xs text-theme-muted">{s.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-theme-muted mt-4 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            {t('stats.verifiedLabel')}
          </p>
        </>
      ) : (
        <div className="relative">
          {/* Blurred stats */}
          <div className="grid grid-cols-2 gap-4 blur-sm select-none pointer-events-none">
            {stats.map(s => (
              <div key={s.label}>
                <p className="text-lg font-bold text-theme-primary">--</p>
                <p className="text-xs text-theme-muted">{s.label}</p>
              </div>
            ))}
          </div>
          {/* Overlay CTA */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Lock className="h-5 w-5 text-theme-muted mx-auto mb-2" />
              <p className="text-xs text-theme-secondary">{t('stats.blurredCTA')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/directory/ReviewCard.tsx src/components/directory/ReviewForm.tsx src/components/directory/AgentStatsPanel.tsx
git commit -m "feat: add review and stats components for agent directory"
```

---

## Task 6: AgentSearchBar component

**Files:**
- Create: `src/components/directory/AgentSearchBar.tsx`

- [ ] **Step 1: Create AgentSearchBar**

Create `src/components/directory/AgentSearchBar.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DirectoryFilters } from '@/hooks/useAgentDirectory'

const CANTONS = ['AG','AI','AR','BE','BL','BS','FR','GE','GL','GR','JU','LU','NE','NW','OW','SG','SH','SO','SZ','TG','TI','UR','VD','VS','ZG','ZH']

const SPECIALTIES = ['residential', 'commercial', 'luxury', 'new', 'rental'] as const
const LANGUAGES = ['fr', 'de', 'en', 'it'] as const

interface AgentSearchBarProps {
  filters: DirectoryFilters
  onChange: (filters: Partial<DirectoryFilters>) => void
}

export default function AgentSearchBar({ filters, onChange }: AgentSearchBarProps) {
  const { t } = useTranslation('directory')

  function toggleInArray<T extends string>(arr: T[], value: T): T[] {
    return arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]
  }

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-tertiary" />
        <input
          type="text"
          value={filters.query}
          onChange={e => onChange({ query: e.target.value, page: 0 })}
          placeholder={t('searchPlaceholder')}
          className="w-full h-11 pl-10 pr-4 text-sm bg-transparent border border-theme-border rounded-xl text-theme-primary placeholder:text-theme-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        />
      </div>

      {/* Type toggle */}
      <div className="flex items-center gap-2">
        {(['agents', 'agencies'] as const).map(type => (
          <button
            key={type}
            onClick={() => onChange({ type, page: 0 })}
            className={cn(
              'h-9 px-4 rounded-lg text-sm transition-colors',
              filters.type === type
                ? 'bg-theme-active text-theme-primary font-medium'
                : 'text-theme-secondary hover:text-theme-primary'
            )}
          >
            {type === 'agents' ? t('toggleAgents') : t('toggleAgencies')}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-2">
        {/* Canton */}
        <select
          value={filters.canton ?? ''}
          onChange={e => onChange({ canton: e.target.value || null, page: 0 })}
          className="h-9 px-3 pr-8 text-sm bg-transparent border border-theme-border rounded-lg text-theme-secondary focus:outline-none appearance-none"
        >
          <option value="">{t('filterAllSwitzerland')}</option>
          {CANTONS.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Specialties */}
        {SPECIALTIES.map(s => (
          <button
            key={s}
            onClick={() => onChange({ specialties: toggleInArray(filters.specialties, s), page: 0 })}
            className={cn(
              'h-9 px-3 rounded-lg text-xs transition-colors',
              filters.specialties.includes(s)
                ? 'bg-theme-active text-theme-primary font-medium'
                : 'border border-theme-border text-theme-secondary hover:text-theme-primary'
            )}
          >
            {t(`specialty.${s}`)}
          </button>
        ))}

        {/* Languages */}
        {LANGUAGES.map(l => (
          <button
            key={l}
            onClick={() => onChange({ languages: toggleInArray(filters.languages, l), page: 0 })}
            className={cn(
              'h-9 px-3 rounded-lg text-xs uppercase transition-colors',
              filters.languages.includes(l)
                ? 'bg-theme-active text-theme-primary font-medium'
                : 'border border-theme-border text-theme-secondary hover:text-theme-primary'
            )}
          >
            {l}
          </button>
        ))}

        {/* Verified toggle */}
        <button
          onClick={() => onChange({ verifiedOnly: !filters.verifiedOnly, page: 0 })}
          className={cn(
            'h-9 px-3 rounded-lg text-xs transition-colors',
            filters.verifiedOnly
              ? 'bg-accent/10 text-accent font-medium'
              : 'border border-theme-border text-theme-secondary hover:text-theme-primary'
          )}
        >
          {t('filterVerified')}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/directory/AgentSearchBar.tsx
git commit -m "feat: add AgentSearchBar with filters"
```

---

## Task 7: Pages (AgentDirectoryPage, AgentProfilePage, AgencyProfilePage)

**Files:**
- Create: `src/pages/public/AgentDirectoryPage.tsx`
- Create: `src/pages/public/AgentProfilePage.tsx`
- Create: `src/pages/public/AgencyProfilePage.tsx`

- [ ] **Step 1: Create AgentDirectoryPage**

Create `src/pages/public/AgentDirectoryPage.tsx` — the main search page at `/agents`. Contains: hero title/subtitle, AgentSearchBar, results grid (AgentCard or AgencyCard based on filter.type), sort dropdown, pagination (previous/next with page counter), empty state, loading skeletons (grid of 6 placeholder cards).

- [ ] **Step 2: Create AgentProfilePage**

Create `src/pages/public/AgentProfilePage.tsx` — individual agent profile at `/agents/:slug`. Uses `useAgentProfile(slug)` and `useAgentReviews(agentProfileId)`. Layout: header (photo, name, agency link, rating, badge, contact buttons), ClaimProfileCTA (if unclaimed), about section (bio, specialties badges, languages badges, certifications, experience), AgentStatsPanel, reviews section (ReviewCard list + ReviewForm), active listings section (blurred if not verified).

- [ ] **Step 3: Create AgencyProfilePage**

Create `src/pages/public/AgencyProfilePage.tsx` — agency profile at `/agences/:slug`. Uses `useAgencyProfile(slug)`. Layout: header (logo, name, address, contact, badge), about section (description, founded year, zones covered, specialties, certifications), team section (grid of AgentCard for each agent in the agency), reviews section (aggregated from all agents), active listings (if verified).

- [ ] **Step 4: Verify TypeScript**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/public/AgentDirectoryPage.tsx src/pages/public/AgentProfilePage.tsx src/pages/public/AgencyProfilePage.tsx
git commit -m "feat: add directory pages (search, agent profile, agency profile)"
```

---

## Task 8: Router + Navbar integration

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Navbar.tsx`

- [ ] **Step 1: Add lazy imports and routes in App.tsx**

Add lazy imports at the top with the other public page imports:

```typescript
const AgentDirectoryPage = lazy(() => import('@/pages/public/AgentDirectoryPage'))
const AgentProfilePage = lazy(() => import('@/pages/public/AgentProfilePage'))
const AgencyProfilePage = lazy(() => import('@/pages/public/AgencyProfilePage'))
```

Add routes inside the public routes section (alongside `/acheter`, `/vendre`, etc.):

```tsx
<Route path="/agents" element={<AgentDirectoryPage />} />
<Route path="/agents/:slug" element={<AgentProfilePage />} />
<Route path="/agences/:slug" element={<AgencyProfilePage />} />
```

- [ ] **Step 2: Add "Trouver un agent" link in Navbar**

In `src/components/layout/Navbar.tsx`, add a link to `/agents` in the navigation. Use the translation key `directory:nav.findAgent`. Add it to both desktop and mobile navigation arrays.

- [ ] **Step 3: Verify TypeScript and build**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/layout/Navbar.tsx
git commit -m "feat: add directory routes and navbar link"
```

---

## Task 9: Seed script for SVIT/SMK/USPI data

**Files:**
- Create: `scripts/seed-directory.mjs`

- [ ] **Step 1: Create the seed script**

Create `scripts/seed-directory.mjs` — a Node.js script that:

1. Fetches SVIT members from their JSON API (`https://svit.ch/de/svit/members/json?page=0`, paginated 20/page, ~114 pages). Filters by organisation_id=30 (Maklerkammer) to get certified brokers. Extracts: name, address, city, postal_code, phone, email.

2. Fetches SMK certified brokers from `https://www.maklerkammer.ch/zertifizierte-makler/` — parses HTML table for company name, contact person, address, phone, email, website.

3. Fetches USPI Geneva members from `https://www.uspi-ge.ch/membres/` — parses static HTML for agency name, address, phone, website.

4. Deduplicates by name similarity (Levenshtein distance or exact match after normalization).

5. Generates slugs from name + city (e.g. "dupont-immobilier-geneve").

6. Inserts into `agency_profiles` table via Supabase service role key with `status='unclaimed'`, `source='svit'|'smk'|'uspi'`, `source_id` for dedup on re-runs.

7. Uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`.

8. Logs progress: "Fetching SVIT... 130 brokers found", "Fetching SMK... 250 entries found", "After dedup: 380 unique agencies", "Inserted 380 agency profiles".

9. Has a `--dry-run` flag that logs what would be inserted without touching the database.

- [ ] **Step 2: Test with dry-run**

Run: `node scripts/seed-directory.mjs --dry-run`
Expected: Logs showing fetched data and dedup results without database writes.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-directory.mjs
git commit -m "feat: add directory seed script for SVIT/SMK/USPI data"
```

---

## Task 10: Final verification

- [ ] **Step 1: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Visual verification**

Start dev server, navigate to `/agents`. Verify:
- Search bar renders with filters
- Toggle between Agents/Agences works
- Empty state shows when no data
- Navigate to `/agents/test-slug` shows 404/empty profile gracefully

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: agent directory MVP complete"
```
