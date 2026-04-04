# Super-Admin MEGGA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a super-admin panel inside the existing MEGGA dashboard for platform-wide management — agencies, users, monitoring, moderation, compliance, and support.

**Architecture:** New section in the existing sidebar, protected by `super_admin` role. 7 pages under `/dashboard/admin/*`, 7 hooks, 1 migration, 1 Edge Function. Violet accent `#8B5CF6` for visual distinction.

**Tech Stack:** React 18 + TypeScript + Tailwind + shadcn/ui + TanStack React Query + Supabase + Recharts + Lucide icons

---

## File Map

### New files to create

```
# Database
supabase/migrations/20260404_001_super_admin.sql

# Guard & shared components
src/components/admin/SuperAdminGuard.tsx
src/components/admin/AdminKpiCard.tsx
src/components/admin/AdminAlertFeed.tsx
src/components/admin/AdminTable.tsx
src/components/admin/UserDrawer.tsx
src/components/admin/ModerationActionDialog.tsx

# Hooks
src/hooks/useAdminStats.ts
src/hooks/useAdminAgencies.ts
src/hooks/useAdminUsers.ts
src/hooks/useAdminMonitoring.ts
src/hooks/useAdminModeration.ts
src/hooks/useAdminCompliance.ts
src/hooks/useAdminSupport.ts

# Pages
src/pages/admin/AdminDashboardPage.tsx
src/pages/admin/AdminAgenciesPage.tsx
src/pages/admin/AdminAgencyDetailPage.tsx
src/pages/admin/AdminUsersPage.tsx
src/pages/admin/AdminMonitoringPage.tsx
src/pages/admin/AdminMarketplacePage.tsx
src/pages/admin/AdminCompliancePage.tsx
src/pages/admin/AdminSupportPage.tsx

# Edge Function
supabase/functions/admin-monitoring/index.ts
```

### Existing files to modify

```
src/types/auth.ts                    — add 'super_admin' to UserRole
src/components/layout/Sidebar.tsx    — add ADMIN MEGGA section
src/App.tsx                          — add /dashboard/admin/* routes
src/styles/globals.css               — add admin accent CSS variables
src/i18n/locales/fr/common.json      — add admin nav labels
src/i18n/locales/de/common.json      — add admin nav labels
src/i18n/locales/en/common.json      — add admin nav labels
src/i18n/locales/it/common.json      — add admin nav labels
```

---

## Task 1: SQL Migration — Role, Tables, Functions, Policies

**Files:**
- Create: `supabase/migrations/20260404_001_super_admin.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- ============================================
-- Super-Admin MEGGA — Migration
-- ============================================

-- 1. Add super_admin to role constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'admin', 'manager', 'agent', 'assistant', 'seller', 'buyer', 'particulier'));

-- 2. Add status to agencies
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
DO $$ BEGIN
  ALTER TABLE agencies ADD CONSTRAINT agencies_status_check CHECK (status IN ('active', 'suspended'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Add moderation columns to properties
ALTER TABLE properties ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'published';
DO $$ BEGIN
  ALTER TABLE properties ADD CONSTRAINT properties_moderation_status_check
    CHECK (moderation_status IN ('pending', 'published', 'flagged', 'removed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS moderation_reason TEXT;

-- 4. is_super_admin() function
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 5. platform_metrics table
CREATE TABLE IF NOT EXISTS platform_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metadata JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE platform_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_read_metrics"
  ON platform_metrics FOR SELECT
  USING (is_super_admin());

CREATE POLICY "super_admin_insert_metrics"
  ON platform_metrics FOR INSERT
  WITH CHECK (is_super_admin());

-- 6. moderation_actions table
CREATE TABLE IF NOT EXISTS moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('approve', 'flag', 'remove')),
  reason TEXT,
  actor_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_read_moderation"
  ON moderation_actions FOR SELECT
  USING (is_super_admin());

CREATE POLICY "super_admin_insert_moderation"
  ON moderation_actions FOR INSERT
  WITH CHECK (is_super_admin());

-- 7. admin_notes table
CREATE TABLE IF NOT EXISTS admin_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('agency', 'user', 'kyc_case', 'ticket', 'property')),
  entity_id UUID NOT NULL,
  content TEXT NOT NULL,
  author_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE admin_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_read_notes"
  ON admin_notes FOR SELECT
  USING (is_super_admin());

CREATE POLICY "super_admin_insert_notes"
  ON admin_notes FOR INSERT
  WITH CHECK (is_super_admin());

-- 8. Super-admin bypass policies on existing tables
-- agencies
CREATE POLICY "super_admin_read_all_agencies"
  ON agencies FOR SELECT
  USING (is_super_admin());

CREATE POLICY "super_admin_update_agencies"
  ON agencies FOR UPDATE
  USING (is_super_admin());

-- profiles
CREATE POLICY "super_admin_read_all_profiles"
  ON profiles FOR SELECT
  USING (is_super_admin());

CREATE POLICY "super_admin_update_profiles"
  ON profiles FOR UPDATE
  USING (is_super_admin());

-- properties
CREATE POLICY "super_admin_read_all_properties"
  ON properties FOR SELECT
  USING (is_super_admin());

CREATE POLICY "super_admin_update_properties"
  ON properties FOR UPDATE
  USING (is_super_admin());

-- transactions
CREATE POLICY "super_admin_read_all_transactions"
  ON transactions FOR SELECT
  USING (is_super_admin());

-- kyc_cases
CREATE POLICY "super_admin_read_all_kyc"
  ON kyc_cases FOR SELECT
  USING (is_super_admin());

CREATE POLICY "super_admin_update_kyc"
  ON kyc_cases FOR UPDATE
  USING (is_super_admin());

-- activity_events
CREATE POLICY "super_admin_read_all_events"
  ON activity_events FOR SELECT
  USING (is_super_admin());

CREATE POLICY "super_admin_insert_events"
  ON activity_events FOR INSERT
  WITH CHECK (is_super_admin());

-- support_tickets
CREATE POLICY "super_admin_read_all_tickets"
  ON support_tickets FOR SELECT
  USING (is_super_admin());

CREATE POLICY "super_admin_update_tickets"
  ON support_tickets FOR UPDATE
  USING (is_super_admin());

-- ticket_messages
CREATE POLICY "super_admin_read_all_ticket_messages"
  ON ticket_messages FOR SELECT
  USING (is_super_admin());

CREATE POLICY "super_admin_insert_ticket_messages"
  ON ticket_messages FOR INSERT
  WITH CHECK (is_super_admin());

-- subscriptions
CREATE POLICY "super_admin_read_all_subscriptions"
  ON subscriptions FOR SELECT
  USING (is_super_admin());

-- 9. Indexes
CREATE INDEX IF NOT EXISTS idx_platform_metrics_type_date ON platform_metrics(metric_type, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_property ON moderation_actions(property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notes_entity ON admin_notes(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agencies_status ON agencies(status);
CREATE INDEX IF NOT EXISTS idx_properties_moderation ON properties(moderation_status);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260404_001_super_admin.sql
git commit -m "feat(admin): add super_admin role, tables, RLS policies"
```

---

## Task 2: Admin Accent Theme + Type Update

**Files:**
- Modify: `src/styles/globals.css`
- Modify: `src/types/auth.ts`

- [ ] **Step 1: Add admin accent CSS variables to globals.css**

Add after the existing `:root` accent variables:

```css
/* Admin accent (violet) */
--color-admin-accent: 139 92 246;
--color-admin-accent-hover: 124 58 237;
--color-admin-accent-light: 245 243 255;
```

And in `[data-theme="dark"]`:

```css
--color-admin-accent: 167 139 250;
--color-admin-accent-hover: 139 92 246;
--color-admin-accent-light: 46 16 101;
```

- [ ] **Step 2: Add Tailwind admin color utilities**

In `tailwind.config.ts`, add under `extend.colors`:

```typescript
'admin-accent': 'rgb(var(--color-admin-accent) / <alpha-value>)',
'admin-accent-hover': 'rgb(var(--color-admin-accent-hover) / <alpha-value>)',
'admin-accent-light': 'rgb(var(--color-admin-accent-light) / <alpha-value>)',
```

- [ ] **Step 3: Add super_admin to UserRole type**

In `src/types/auth.ts`, find the `UserRole` type and add `'super_admin'`:

```typescript
export type UserRole = 'buyer' | 'seller' | 'particulier' | 'agent' | 'manager' | 'admin' | 'assistant' | 'super_admin'
```

- [ ] **Step 4: Commit**

```bash
git add src/styles/globals.css tailwind.config.ts src/types/auth.ts
git commit -m "feat(admin): add violet admin accent theme + super_admin role type"
```

---

## Task 3: SuperAdminGuard + AdminKpiCard + i18n

**Files:**
- Create: `src/components/admin/SuperAdminGuard.tsx`
- Create: `src/components/admin/AdminKpiCard.tsx`
- Modify: `src/i18n/locales/fr/common.json`
- Modify: `src/i18n/locales/de/common.json`
- Modify: `src/i18n/locales/en/common.json`
- Modify: `src/i18n/locales/it/common.json`

- [ ] **Step 1: Create SuperAdminGuard**

```tsx
// src/components/admin/SuperAdminGuard.tsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth()

  if (loading) return null

  if (!profile || profile.role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
```

- [ ] **Step 2: Create AdminKpiCard**

```tsx
// src/components/admin/AdminKpiCard.tsx
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface AdminKpiCardProps {
  label: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: { value: number; label: string }
  variant?: 'default' | 'danger'
}

export default function AdminKpiCard({ label, value, subtitle, icon: Icon, trend, variant = 'default' }: AdminKpiCardProps) {
  return (
    <div className="rounded-xl border border-theme-border p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-theme-secondary uppercase tracking-wide">{label}</span>
        <div className={cn(
          'h-8 w-8 rounded-lg flex items-center justify-center',
          variant === 'danger' ? 'bg-red-50 dark:bg-red-500/10' : 'bg-admin-accent-light'
        )}>
          <Icon className={cn(
            'h-4 w-4',
            variant === 'danger' ? 'text-red-500' : 'text-admin-accent'
          )} />
        </div>
      </div>
      <p className="text-2xl font-bold text-theme-primary">{value}</p>
      {subtitle && <p className="text-xs text-theme-secondary mt-1">{subtitle}</p>}
      {trend && (
        <p className={cn(
          'text-xs font-medium mt-1',
          trend.value >= 0 ? 'text-emerald-500' : 'text-red-500'
        )}>
          {trend.value >= 0 ? '+' : ''}{trend.value} {trend.label}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add i18n keys to all 4 locales**

Add to each locale's `common.json` file:

**FR** (`src/i18n/locales/fr/common.json`):
```json
"sections.adminMegga": "ADMIN MEGGA",
"nav.adminOverview": "Vue d'ensemble",
"nav.adminAgencies": "Agences",
"nav.adminUsers": "Utilisateurs",
"nav.adminMonitoring": "Monitoring",
"nav.adminMarketplace": "Moderation",
"nav.adminCompliance": "Conformite",
"nav.adminSupport": "Support"
```

**DE** (`src/i18n/locales/de/common.json`):
```json
"sections.adminMegga": "ADMIN MEGGA",
"nav.adminOverview": "Ubersicht",
"nav.adminAgencies": "Agenturen",
"nav.adminUsers": "Benutzer",
"nav.adminMonitoring": "Monitoring",
"nav.adminMarketplace": "Moderation",
"nav.adminCompliance": "Compliance",
"nav.adminSupport": "Support"
```

**EN** (`src/i18n/locales/en/common.json`):
```json
"sections.adminMegga": "ADMIN MEGGA",
"nav.adminOverview": "Overview",
"nav.adminAgencies": "Agencies",
"nav.adminUsers": "Users",
"nav.adminMonitoring": "Monitoring",
"nav.adminMarketplace": "Moderation",
"nav.adminCompliance": "Compliance",
"nav.adminSupport": "Support"
```

**IT** (`src/i18n/locales/it/common.json`):
```json
"sections.adminMegga": "ADMIN MEGGA",
"nav.adminOverview": "Panoramica",
"nav.adminAgencies": "Agenzie",
"nav.adminUsers": "Utenti",
"nav.adminMonitoring": "Monitoraggio",
"nav.adminMarketplace": "Moderazione",
"nav.adminCompliance": "Conformita",
"nav.adminSupport": "Supporto"
```

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/ src/i18n/
git commit -m "feat(admin): add SuperAdminGuard, AdminKpiCard, i18n labels"
```

---

## Task 4: Sidebar + Routing Integration

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add admin section to Sidebar.tsx**

Add the new icons to the import line: `Activity, Store, LifeBuoy`

Find the `NAV_SECTIONS` array and add after the compliance section:

```typescript
// Only added dynamically for super_admin — see rendering below
```

In the rendering section, after the existing sections loop, add a conditional block:

```tsx
{profile?.role === 'super_admin' && (
  <>
    <div className={cn('px-3 pt-4 pb-1', collapsed && 'px-0 text-center')}>
      <span className={cn(
        'text-[10px] font-semibold uppercase tracking-wider text-admin-accent',
        collapsed && 'hidden'
      )}>
        {t('sections.adminMegga')}
      </span>
      {collapsed && <div className="w-4 h-px bg-admin-accent/30 mx-auto" />}
    </div>
    {[
      { labelKey: 'nav.adminOverview', href: '/dashboard/admin', icon: LayoutDashboard },
      { labelKey: 'nav.adminAgencies', href: '/dashboard/admin/agencies', icon: Building2 },
      { labelKey: 'nav.adminUsers', href: '/dashboard/admin/users', icon: Users },
      { labelKey: 'nav.adminMonitoring', href: '/dashboard/admin/monitoring', icon: Activity },
      { labelKey: 'nav.adminMarketplace', href: '/dashboard/admin/marketplace', icon: Store },
      { labelKey: 'nav.adminCompliance', href: '/dashboard/admin/compliance', icon: ShieldCheck },
      { labelKey: 'nav.adminSupport', href: '/dashboard/admin/support', icon: LifeBuoy },
    ].map((item) => {
      const isActive = location.pathname === item.href ||
        (item.href !== '/dashboard/admin' && location.pathname.startsWith(item.href))
      return (
        <Link key={item.href} to={item.href} className={cn(
          navRow(collapsed, isActive),
          isActive && '!bg-admin-accent/8 !text-admin-accent'
        )}>
          <item.icon className={cn('h-[18px] w-[18px] flex-shrink-0', isActive && 'text-admin-accent')} />
          {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
        </Link>
      )
    })}
  </>
)}
```

- [ ] **Step 2: Add admin routes to App.tsx**

Add lazy imports at the top with the other lazy imports:

```typescript
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'))
const AdminAgenciesPage = lazy(() => import('@/pages/admin/AdminAgenciesPage'))
const AdminAgencyDetailPage = lazy(() => import('@/pages/admin/AdminAgencyDetailPage'))
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage'))
const AdminMonitoringPage = lazy(() => import('@/pages/admin/AdminMonitoringPage'))
const AdminMarketplacePage = lazy(() => import('@/pages/admin/AdminMarketplacePage'))
const AdminCompliancePage = lazy(() => import('@/pages/admin/AdminCompliancePage'))
const AdminSupportPage = lazy(() => import('@/pages/admin/AdminSupportPage'))
```

Add import for the guard:

```typescript
import SuperAdminGuard from '@/components/admin/SuperAdminGuard'
```

Inside the `/dashboard` `<Route>` children, add before the catch-all:

```tsx
{/* Super-Admin routes */}
<Route path="admin" element={<SuperAdminGuard><AdminDashboardPage /></SuperAdminGuard>} />
<Route path="admin/agencies" element={<SuperAdminGuard><AdminAgenciesPage /></SuperAdminGuard>} />
<Route path="admin/agencies/:id" element={<SuperAdminGuard><AdminAgencyDetailPage /></SuperAdminGuard>} />
<Route path="admin/users" element={<SuperAdminGuard><AdminUsersPage /></SuperAdminGuard>} />
<Route path="admin/monitoring" element={<SuperAdminGuard><AdminMonitoringPage /></SuperAdminGuard>} />
<Route path="admin/marketplace" element={<SuperAdminGuard><AdminMarketplacePage /></SuperAdminGuard>} />
<Route path="admin/compliance" element={<SuperAdminGuard><AdminCompliancePage /></SuperAdminGuard>} />
<Route path="admin/support" element={<SuperAdminGuard><AdminSupportPage /></SuperAdminGuard>} />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/App.tsx
git commit -m "feat(admin): add admin section to sidebar + routes"
```

---

## Task 5: Admin Stats Hook + Dashboard Page

**Files:**
- Create: `src/hooks/useAdminStats.ts`
- Create: `src/pages/admin/AdminDashboardPage.tsx`

- [ ] **Step 1: Create useAdminStats hook**

```typescript
// src/hooks/useAdminStats.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface AdminKPIs {
  activeAgencies: number
  totalUsers: number
  activeProperties: number
  activeTransactions: number
  estimatedMRR: number
  highRiskKyc: number
  newAgenciesThisMonth: number
  newUsersThisMonth: number
}

interface AlertEvent {
  id: string
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, unknown>
  created_at: string
}

export function useAdminStats() {
  const kpis = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async (): Promise<AdminKPIs> => {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [agencies, users, properties, transactions, kyc, newAgencies, newUsers] = await Promise.all([
        supabase.from('agencies').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('properties').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('kyc_cases').select('id', { count: 'exact', head: true }).eq('risk_level', 'high'),
        supabase.from('agencies').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
      ])

      return {
        activeAgencies: agencies.count ?? 0,
        totalUsers: users.count ?? 0,
        activeProperties: properties.count ?? 0,
        activeTransactions: transactions.count ?? 0,
        estimatedMRR: 0, // TODO: connect when subscriptions table has data
        highRiskKyc: kyc.count ?? 0,
        newAgenciesThisMonth: newAgencies.count ?? 0,
        newUsersThisMonth: newUsers.count ?? 0,
      }
    },
    staleTime: 30_000,
  })

  const alerts = useQuery({
    queryKey: ['admin-alerts'],
    queryFn: async (): Promise<AlertEvent[]> => {
      const { data, error } = await supabase
        .from('activity_events')
        .select('id, action, entity_type, entity_id, metadata, created_at')
        .in('action', ['agency_created', 'kyc_screening_match', 'subscription_cancelled', 'edge_function_error', 'ticket_created'])
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return (data ?? []) as AlertEvent[]
    },
    staleTime: 30_000,
  })

  return {
    kpis: kpis.data,
    kpisLoading: kpis.isLoading,
    alerts: alerts.data ?? [],
    alertsLoading: alerts.isLoading,
  }
}
```

- [ ] **Step 2: Create AdminDashboardPage**

```tsx
// src/pages/admin/AdminDashboardPage.tsx
import { Building2, Users, Home, GitBranch, CreditCard, ShieldAlert, AlertTriangle, Bell } from 'lucide-react'
import { useAdminStats } from '@/hooks/useAdminStats'
import AdminKpiCard from '@/components/admin/AdminKpiCard'
import { formatRelativeDate } from '@/lib/utils'

const ALERT_ICONS: Record<string, typeof AlertTriangle> = {
  agency_created: Building2,
  kyc_screening_match: ShieldAlert,
  subscription_cancelled: CreditCard,
  edge_function_error: AlertTriangle,
  ticket_created: Bell,
}

const ALERT_LABELS: Record<string, string> = {
  agency_created: 'Nouvelle agence inscrite',
  kyc_screening_match: 'Alerte PEP/Sanctions',
  subscription_cancelled: 'Abonnement annule',
  edge_function_error: 'Erreur Edge Function',
  ticket_created: 'Nouveau ticket support',
}

const ALERT_COLORS: Record<string, string> = {
  agency_created: 'border-l-admin-accent',
  kyc_screening_match: 'border-l-red-500',
  subscription_cancelled: 'border-l-amber-500',
  edge_function_error: 'border-l-red-500',
  ticket_created: 'border-l-blue-500',
}

export default function AdminDashboardPage() {
  const { kpis, kpisLoading, alerts, alertsLoading } = useAdminStats()

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header with admin badge */}
      <div className="flex items-center gap-3">
        <div className="h-8 px-3 rounded-lg bg-admin-accent/10 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-admin-accent" />
          <span className="text-xs font-semibold text-admin-accent">Admin MEGGA</span>
        </div>
        <h1 className="text-xl font-semibold text-theme-primary">Vue d'ensemble</h1>
      </div>

      {/* KPI Grid */}
      {kpisLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-theme-border p-5 animate-pulse">
              <div className="h-3 bg-theme-hover rounded w-20 mb-3" />
              <div className="h-7 bg-theme-hover rounded w-16" />
            </div>
          ))}
        </div>
      ) : kpis && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <AdminKpiCard
            label="Agences"
            value={kpis.activeAgencies}
            icon={Building2}
            trend={{ value: kpis.newAgenciesThisMonth, label: 'ce mois' }}
          />
          <AdminKpiCard label="Utilisateurs" value={kpis.totalUsers} icon={Users}
            trend={{ value: kpis.newUsersThisMonth, label: 'ce mois' }} />
          <AdminKpiCard label="Biens actifs" value={kpis.activeProperties} icon={Home} />
          <AdminKpiCard label="Transactions" value={kpis.activeTransactions} icon={GitBranch} />
          <AdminKpiCard label="MRR estime" value={`CHF ${kpis.estimatedMRR}`} icon={CreditCard} />
          <AdminKpiCard label="KYC a risque" value={kpis.highRiskKyc} icon={ShieldAlert}
            variant={kpis.highRiskKyc > 0 ? 'danger' : 'default'} />
        </div>
      )}

      {/* Alerts feed */}
      <div className="rounded-xl border border-theme-border p-5">
        <h2 className="text-sm font-semibold text-theme-primary mb-4">Alertes recentes</h2>
        {alertsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-theme-hover rounded-lg animate-pulse" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <p className="text-sm text-theme-secondary py-8 text-center">Aucune alerte recente</p>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => {
              const Icon = ALERT_ICONS[alert.action] ?? Bell
              return (
                <div key={alert.id} className={`flex items-center gap-3 p-3 rounded-lg border-l-4 ${ALERT_COLORS[alert.action] ?? 'border-l-gray-300'} bg-theme-hover/50`}>
                  <Icon className="h-4 w-4 text-theme-secondary flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-theme-primary">{ALERT_LABELS[alert.action] ?? alert.action}</p>
                  </div>
                  <span className="text-xs text-theme-muted flex-shrink-0">{formatRelativeDate(alert.created_at)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAdminStats.ts src/pages/admin/AdminDashboardPage.tsx
git commit -m "feat(admin): add dashboard page with KPIs and alert feed"
```

---

## Task 6: Agencies Hook + Page + Detail Page

**Files:**
- Create: `src/hooks/useAdminAgencies.ts`
- Create: `src/pages/admin/AdminAgenciesPage.tsx`
- Create: `src/pages/admin/AdminAgencyDetailPage.tsx`

- [ ] **Step 1: Create useAdminAgencies hook**

Hook should provide: `agencies` list with aggregated counts (agents, properties, transactions), `updateAgencyStatus` mutation, single `agency` query by id. All queries use React Query with `queryKey: ['admin-agencies']`. Use `supabase.from('agencies').select('*, profiles(id), properties(id), transactions(id)')` pattern for counts. Mutation invalidates `['admin-agencies']` on success.

- [ ] **Step 2: Create AdminAgenciesPage**

Table page with: search input, status filter (Tous/Actif/Suspendu), sortable columns (nom, plan, agents, biens, transactions, MRR, date, statut). Each row shows a green/red dot for status. Row click navigates to `/dashboard/admin/agencies/:id`. Hover reveals "Suspendre/Activer" action button. Use the same table pattern as ContactsPage (filter + sort + paginate in useMemo). Admin badge header like dashboard page.

- [ ] **Step 3: Create AdminAgencyDetailPage**

Uses `useParams().id` to load single agency. Header with agency name, plan badge, status dot, date. 7 tabs using state toggle (Infos, Equipe, Activite, Biens, Transactions, Abonnement, KYC). Each tab queries the relevant table filtered by `agency_id`. Back button `<Link to="/dashboard/admin/agencies">`. Follow the same tab pattern as ContactDetailPage.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useAdminAgencies.ts src/pages/admin/AdminAgenciesPage.tsx src/pages/admin/AdminAgencyDetailPage.tsx
git commit -m "feat(admin): add agencies management pages"
```

---

## Task 7: Users Hook + Page + Drawer

**Files:**
- Create: `src/hooks/useAdminUsers.ts`
- Create: `src/pages/admin/AdminUsersPage.tsx`
- Create: `src/components/admin/UserDrawer.tsx`

- [ ] **Step 1: Create useAdminUsers hook**

Provides: `users` list with agency join (`profiles` + `agencies.name`), `updateUserRole` mutation, `suspendUser` mutation. Query key: `['admin-users']`.

- [ ] **Step 2: Create AdminUsersPage**

Table with: search (name/email), role filter, agency filter, status filter. Columns: avatar+name, email, agency (link), role (badge), last sign-in (relative), date, status dot. Click row opens UserDrawer (slide-in from right). Same filter/sort/paginate pattern.

- [ ] **Step 3: Create UserDrawer**

Slide-in drawer (right side, w-[380px]) via createPortal. Shows: avatar (h-16 w-16), full name, email, phone, agency link, role selector (dropdown to change), last connection, recent 10 activity_events in a mini timeline. Close button with aria-label.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useAdminUsers.ts src/pages/admin/AdminUsersPage.tsx src/components/admin/UserDrawer.tsx
git commit -m "feat(admin): add users management page + drawer"
```

---

## Task 8: Monitoring Hook + Page

**Files:**
- Create: `src/hooks/useAdminMonitoring.ts`
- Create: `src/pages/admin/AdminMonitoringPage.tsx`

- [ ] **Step 1: Create useAdminMonitoring hook**

Provides: `platformHealth` (4 indicators from platform_metrics table), `edgeFunctions` (list of 28 functions with last invocation status from activity_events), `errorLogs` (recent errors from activity_events where action = 'edge_function_error'). All query keys prefixed `['admin-monitoring']`.

- [ ] **Step 2: Create AdminMonitoringPage**

Top section: 4 health indicator cards (DB size, Edge Functions status, Last scraping, Emails today). Each card with a dot (green/red/amber).

Middle section: Edge Functions table — columns: Name, Last invocation, Status (dot), Response time, 24h invocations. Sortable.

Bottom section: Error logs feed — filterable by function name. Each entry: timestamp, function name, error message (truncated to 1 line), expandable on click.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAdminMonitoring.ts src/pages/admin/AdminMonitoringPage.tsx
git commit -m "feat(admin): add monitoring page with health indicators and error logs"
```

---

## Task 9: Marketplace Moderation Hook + Page + Dialog

**Files:**
- Create: `src/hooks/useAdminModeration.ts`
- Create: `src/pages/admin/AdminMarketplacePage.tsx`
- Create: `src/components/admin/ModerationActionDialog.tsx`

- [ ] **Step 1: Create useAdminModeration hook**

Provides: `listings` (properties with moderation fields + agency join), `moderateProperty` mutation (updates moderation_status + inserts moderation_action + inserts activity_event), `moderationStats` (counts by status). Query key: `['admin-moderation']`.

- [ ] **Step 2: Create AdminMarketplacePage**

Top: 4 stat cards (total published, flagged this month, removed this month, avg quality score).

Table: thumbnail (h-10 w-14 rounded), title, agency, price (formatCHF), canton, date, quality score (bar 0-100), moderation status (dot + label). Filters: status, agency, quality threshold. Sort by date or quality score.

Row actions on hover: Approve (check), Flag (alert triangle), Remove (trash). Flag and Remove open ModerationActionDialog.

Alerts section at top: properties with quality_score < 50 shown in amber banner.

- [ ] **Step 3: Create ModerationActionDialog**

Modal via createPortal. Shows property thumbnail + title. Action type (flag/remove). Reason selector: pills for predefined reasons (Photo trompeuse, Prix irrealiste, Doublon, Contenu inapproprie) + textarea for custom reason. Confirm button (ghost style). On confirm: calls `moderateProperty` mutation.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useAdminModeration.ts src/pages/admin/AdminMarketplacePage.tsx src/components/admin/ModerationActionDialog.tsx
git commit -m "feat(admin): add marketplace moderation page"
```

---

## Task 10: Compliance Hook + Page

**Files:**
- Create: `src/hooks/useAdminCompliance.ts`
- Create: `src/pages/admin/AdminCompliancePage.tsx`

- [ ] **Step 1: Create useAdminCompliance hook**

Provides: `kycCases` (all kyc_cases with contact + agency join, no agency_id filter), `complianceStats` (4 KPIs: total, pending, PEP matches, avg completion), `updateRiskLevel` mutation, `exportCsv` function. Query key: `['admin-compliance']`.

- [ ] **Step 2: Create AdminCompliancePage**

Top: 4 KPI cards (total dossiers, en attente, alertes PEP, taux completion).

Tabs: A risque | En cours | Valides | Tous. Each tab filters the same dataset.

Table: Contact name (with avatar), Agency, Type (PP/PM badge), Risk score (dot + number), PEP status (icon), Sanctions status (icon), Completion % (mini bar), Date. Click navigates to existing `/dashboard/kyc/:id`.

Actions: "Relancer screening" button, "Export CSV" button in header, risk level override via dropdown on each row.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAdminCompliance.ts src/pages/admin/AdminCompliancePage.tsx
git commit -m "feat(admin): add compliance dashboard with KYC cross-agency view"
```

---

## Task 11: Support Hook + Page

**Files:**
- Create: `src/hooks/useAdminSupport.ts`
- Create: `src/pages/admin/AdminSupportPage.tsx`

- [ ] **Step 1: Create useAdminSupport hook**

Provides: `tickets` (support_tickets with agency join + last message), `selectedTicket` (single ticket with all messages), `replyToTicket` mutation (inserts ticket_message + calls send-email), `updateTicketStatus` mutation, `supportStats` (open count, resolved this week, avg response time). Query keys: `['admin-support']`, `['admin-support', ticketId]`.

- [ ] **Step 2: Create AdminSupportPage**

2-column layout like MessagesPage:

Left panel (w-[360px], border-r): ticket list sorted by priority then date. Each ticket: subject (truncated), agency name, priority dot (red/orange/yellow/gray), status badge, relative date. Red dot if no response > 24h. Filters: status, priority. Search. Badge "X ouverts" header.

Right panel (flex-1): selected ticket conversation. Header: subject, agency, priority dropdown, status dropdown. Message thread: chronological bubbles (agent = right/accent, admin = right/admin-accent, client = left/gray). Reply input at bottom: textarea + send button (ghost). Canned responses dropdown above textarea.

Stats bar at bottom: 3 mini stats (open tickets, resolved this week, avg response time).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAdminSupport.ts src/pages/admin/AdminSupportPage.tsx
git commit -m "feat(admin): add support ticket management page"
```

---

## Task 12: Edge Function admin-monitoring

**Files:**
- Create: `supabase/functions/admin-monitoring/index.ts`

- [ ] **Step 1: Create the Edge Function**

```typescript
// supabase/functions/admin-monitoring/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify caller is super_admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Unauthorized')

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) throw new Error('Unauthorized')

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'super_admin') throw new Error('Forbidden')

    // Collect metrics
    const [agencyCount, userCount, propertyCount, transactionCount, errorCount] = await Promise.all([
      supabaseAdmin.from('agencies').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('properties').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('transactions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('activity_events').select('id', { count: 'exact', head: true })
        .eq('action', 'edge_function_error')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    ])

    // Store snapshot
    const metrics = [
      { metric_type: 'agency_count', metric_value: agencyCount.count ?? 0 },
      { metric_type: 'user_count', metric_value: userCount.count ?? 0 },
      { metric_type: 'property_count', metric_value: propertyCount.count ?? 0 },
      { metric_type: 'transaction_count', metric_value: transactionCount.count ?? 0 },
      { metric_type: 'error_count_24h', metric_value: errorCount.count ?? 0 },
    ]

    await supabaseAdmin.from('platform_metrics').insert(metrics)

    return new Response(JSON.stringify({ success: true, metrics }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/admin-monitoring/
git commit -m "feat(admin): add admin-monitoring Edge Function"
```

---

## Task 13: TypeScript Check + Final Verification

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 2: Run dev server and verify**

```bash
npm run dev
```

Navigate to `/dashboard/admin` — should see the admin dashboard (if logged in as super_admin) or redirect to `/dashboard` (if not).

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(admin): super-admin panel — complete implementation"
```
