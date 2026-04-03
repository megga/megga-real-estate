---
name: swiss-compliance-check
description: Use before implementing any feature — verifies it serves the 5 strategic objectives and respects Swiss compliance rules (LAB/KYC, LPD, data protection)
---

# Swiss Compliance Check

## Overview

MEGGA is compliance-first. Every feature must serve the business AND respect Swiss regulatory requirements. This skill prevents scope creep and compliance violations.

**Core principle:** If a feature doesn't serve at least 1 of the 5 objectives, it's out of scope.

## When to Use

- Before starting any new feature
- When modifying KYC, transaction, or client data flows
- When adding IA/automation that touches sensitive data
- When building features that display or process personal data

## The 5 Strategic Objectives

Every feature must serve at least ONE:

1. **Reduce admin time** — Automate repetitive agent tasks
2. **Reduce LAB/KYC risk** — Standardize compliance workflows
3. **Accelerate closing** — Shorten time from lead to signature
4. **Increase client transparency** — Keep buyers/sellers informed
5. **Replace fragmented tools** — One platform instead of 5 tools

### Quick Test

Ask: "Which objective does this feature serve?"
- If you can name one → proceed
- If you can't → stop and reconsider with the human

## Swiss Regulatory Checklist

### LAB/LBA (Anti-Money Laundering)

- [ ] **Human-in-the-loop**: No automated KYC validation — agent must click "Valider"
- [ ] **Audit trail**: Every KYC action logged in `activity_events` with actor_id
- [ ] **PEP/Sanctions screening**: Must use dilisense API, results displayed with human review
- [ ] **Risk scoring**: Always labeled "estimation IA" — never presented as certainty
- [ ] **Document expiry**: Identity documents tracked with `expires_at`, alerts shown
- [ ] **FATF lists**: High-risk countries flagged (lists in `src/lib/constants.ts`)

### LPD/nLPD (Swiss Data Protection)

- [ ] **Purpose limitation**: Data collected only for stated purposes
- [ ] **Data minimization**: Don't collect data you don't need
- [ ] **Consent**: Privacy policy link accessible (route `/privacy`)
- [ ] **Right to deletion**: User data must be deletable (no hard dependencies)
- [ ] **Cross-border**: Data stays in EU (Supabase eu-west-1)
- [ ] **No sensitive data in URLs**: Never put PII in query params
- [ ] **No sensitive data in localStorage**: Use Supabase Auth, not localStorage for auth state

### IA/Automation Rules

- [ ] **IA is assistance, not decision**: Scores are "estimations", not "certitudes"
- [ ] **No silent actions**: Every IA action logged in `activity_events` with `actor_id = 'ai'`
- [ ] **No auto-contact**: IA never contacts clients without agent validation (unless explicit opt-in)
- [ ] **No auto-modify**: IA never changes prices, stages, or statuses without human action
- [ ] **Contextual**: IA always fed with real CRM data, never answers "in the void"
- [ ] **Reversible**: Agent can undo any IA suggestion

### Transaction Rules

- [ ] **Pipeline stages**: 14 stages from "Nouveau lead" to "Signé" — no shortcuts
- [ ] **Lost deals**: Require a reason when moving to "Perdu"
- [ ] **Mandate types**: Track mandate_type (exclusive, semi-exclusive, simple)
- [ ] **Price in CHF**: Always formatted with Swiss apostrophe (CHF 720'000)

## Compliance Wording

### DO say:
- "Assistance à la conformité"
- "Outil d'aide à la décision"
- "Estimation IA"
- "Standardisation des processus"
- "Traçabilité et orchestration"

### DON'T say:
- "Conformité automatique garantie"
- "LAB 100% automatisée"
- "Validation automatique"
- "Décision IA"
- "Compliance-replacing"

## Feature Scope Gate

Before coding, answer these 3 questions:

1. **Which of the 5 objectives does this serve?** → Name it explicitly
2. **Does this touch personal data?** → If yes, check LPD rules above
3. **Does this involve IA/automation?** → If yes, check IA rules above

If all 3 pass → proceed.
If any fails → discuss with the human before coding.

## Red Flags — Stop Immediately

- Feature that auto-validates KYC dossiers
- Feature that sends messages to clients without agent review
- Feature that stores passwords or tokens in localStorage
- Feature that exposes personal data in URLs
- Feature that presents IA scores as facts
- Feature that bypasses pipeline stages
- Feature that doesn't log IA actions in activity_events
