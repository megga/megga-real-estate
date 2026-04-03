---
name: supabase-migration
description: Use when creating or modifying database tables, columns, RLS policies, indexes, or RPC functions in Supabase
---

# Supabase Migration Workflow

## Overview

Every database change goes through a structured migration. No ad-hoc SQL, no manual changes in the dashboard.

**Core principle:** If it's not in a migration file, it doesn't exist.

## When to Use

- Adding/modifying tables or columns
- Creating/updating RLS policies
- Adding indexes
- Creating RPC functions
- Changing enums or constraints

## The Migration Checklist

### 1. Plan the Schema Change

Before writing SQL:
- [ ] What tables are affected?
- [ ] What are the FK dependencies? (order matters)
- [ ] Will this break existing data?
- [ ] Does this need a backfill?

### 2. Create the Migration File

```
supabase/migrations/YYYYMMDD_NNN_descriptive_name.sql
```

Naming: `20260403_001_add_buyer_preferences.sql`

### 3. Write the SQL — In This Order

```sql
-- 1. CREATE/ALTER tables (respect FK order)
-- 2. ADD indexes
-- 3. ENABLE RLS
-- 4. CREATE policies (use get_my_agency_id() for agency scoping)
-- 5. CREATE RPC functions if needed
-- 6. INSERT seed data if needed
```

### 4. RLS Rules — Non-Negotiable

Every table MUST have RLS enabled. Use this pattern:

```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Agent access: scoped by agency
CREATE POLICY "agents_crud" ON table_name
  FOR ALL TO authenticated
  USING (agency_id = (SELECT get_my_agency_id()));

-- Public read (if applicable)
CREATE POLICY "public_read" ON table_name
  FOR SELECT TO anon
  USING (status = 'active');
```

**NEVER** use `USING (true)` in production. Temp policies must be marked with `-- TODO: tighten for prod`.

### 5. Use SECURITY DEFINER for Recursive Policies

If a policy on table A needs to join table B which also has RLS:

```sql
CREATE OR REPLACE FUNCTION get_my_agency_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT agency_id FROM profiles WHERE id = auth.uid()
$$;
```

### 6. Index Strategy

```sql
-- Always index FK columns used in WHERE clauses
CREATE INDEX idx_tablename_column ON table_name(column);

-- Partial indexes for status filters
CREATE INDEX idx_tablename_active ON table_name(status) WHERE status = 'active';

-- Composite for common queries
CREATE INDEX idx_tablename_agency_status ON table_name(agency_id, status);
```

### 7. Verify Before Deploying

- [ ] SQL is syntactically valid
- [ ] FK references exist (tables created in correct order)
- [ ] RLS policies cover all operations (SELECT, INSERT, UPDATE, DELETE)
- [ ] No `USING (true)` without explicit justification
- [ ] Indexes on columns used in WHERE, JOIN, ORDER BY
- [ ] Column types match (uuid for IDs, timestamptz for dates, text[] for arrays, jsonb for structured data)

### 8. Test Locally

```bash
supabase db reset  # Apply all migrations fresh
```

If reset fails, fix the migration before deploying.

## Anti-Patterns

- **Dashboard SQL**: Never run ALTER TABLE in the Supabase SQL editor without creating a migration file
- **Missing RLS**: A table without policies is a security hole
- **Recursive policies**: profiles → contacts → profiles loop — use SECURITY DEFINER functions
- **Hardcoded UUIDs**: Use `auth.uid()` and `get_my_agency_id()`, never paste IDs
- **No indexes on FKs**: Every foreign key column needs an index

## MEGGA-Specific

- Project ref: `eayczugyrvmtqnnmvjod`
- Region: `eu-west-1`
- Plan: Nano (500 MB limit — currently at 160 MB)
- Auth: email + magic link + OAuth Google
- Storage buckets: `kyc-documents` (private), `property-photos` (public)
