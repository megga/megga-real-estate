---
name: edge-function-deploy
description: Use when creating, modifying, or deploying Supabase Edge Functions (Deno/TypeScript)
---

# Edge Function Deploy Workflow

## Overview

Edge Functions are the backend of MEGGA. Every function follows the same structure, security model, and deployment process.

**Core principle:** Test locally, verify secrets, deploy with confidence.

## When to Use

- Creating a new Edge Function
- Modifying an existing one
- Adding new secrets
- Debugging a deployed function

## Function Structure

```
supabase/functions/
  function-name/
    index.ts      # Entry point (required)
```

### Template

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data, error } = await req.json()
    if (error) throw error

    // Business logic here

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

## Pre-Deploy Checklist

### 1. Secrets

- [ ] List all `Deno.env.get()` calls in the function
- [ ] Verify each secret exists: `supabase secrets list`
- [ ] Set missing secrets: `supabase secrets set KEY=value`

**Known secrets in MEGGA:**
```
ANTHROPIC_API_KEY         # Claude API (Sonnet 4)
RESEND_API_KEY            # Email via megga.ch
DILISENSE_API_KEY         # KYC screening PEP/Sanctions
MICROSOFT_CLIENT_ID       # Outlook Calendar OAuth
MICROSOFT_CLIENT_SECRET   # Outlook Calendar OAuth
GOOGLE_AI_API_KEY         # Gemini (virtual staging)
```

**Auto-available (no setup needed):**
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

### 2. CORS

- [ ] `corsHeaders` defined with correct `Access-Control-Allow-Headers`
- [ ] OPTIONS handler returns 200 with CORS headers
- [ ] All responses include `...corsHeaders`

### 3. Auth

Decide the auth model:
- **Public** (anon OK): Search, market data, public staging
- **Authenticated**: CRM operations, messaging, KYC
- **Service role only**: Cron jobs, admin operations

For authenticated functions:
```typescript
const authHeader = req.headers.get('Authorization')
if (!authHeader) throw new Error('Missing auth')

const { data: { user }, error } = await supabase.auth.getUser(
  authHeader.replace('Bearer ', '')
)
if (error || !user) throw new Error('Unauthorized')
```

### 4. Error Handling

- [ ] Try/catch wraps entire handler
- [ ] Errors return proper HTTP status codes (400, 401, 403, 500)
- [ ] Error messages are user-friendly (no stack traces in response)
- [ ] Sensitive data never in error messages

### 5. Deploy

```bash
supabase functions deploy function-name
```

### 6. Verify

```bash
# Test with curl
curl -X POST \
  'https://eayczugyrvmtqnnmvjod.supabase.co/functions/v1/function-name' \
  -H 'Authorization: Bearer ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"test": true}'
```

## Calling from Frontend

```typescript
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { param1: 'value' },
})
```

## Deployed Functions in MEGGA

| Function | Purpose | Auth |
|---|---|---|
| ai-copilot | Claude chat + actions | authenticated |
| send-email | Resend transactional email | service_role |
| kyc-screening | dilisense PEP/Sanctions | authenticated |
| score-engine | Contact/property scoring | service_role |
| search-alert | Saved search email alerts | service_role (pg_cron) |
| extract-property-pdf | PDF → property data | authenticated |
| extract-property-url | URL → property data | authenticated |
| virtual-staging | Gemini image staging | authenticated |
| google-calendar-sync | Google Calendar OAuth | authenticated |
| outlook-calendar-sync | Outlook Calendar OAuth | authenticated |
| send-visit-email | Visit confirmation emails | service_role |
| external-matching | RealAdvisor matching | authenticated |

## Anti-Patterns

- **Hardcoded secrets**: Never put API keys in code — use `Deno.env.get()`
- **Missing CORS**: Frontend calls will fail silently without CORS headers
- **No error handling**: Unhandled errors crash the function with 500
- **Using anon key for writes**: Use `SUPABASE_SERVICE_ROLE_KEY` for server-side operations that bypass RLS
- **Logging secrets**: Never `console.log` API keys or tokens
