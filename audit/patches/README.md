# Patchs de remédiation — pré-lancement (à review/appliquer par Julien)

> **NON APPLIQUÉS.** Ces fichiers décrivent des correctifs *proposés* (before/after exacts contre le code réel au
> 2026-07-02). Aucun fichier source, migration ou secret n'a été modifié. Julien relit, teste (tests backend/RLS),
> et applique via le pipeline habituel. Les numéros de ligne peuvent bouger — se repérer sur les blocs `AVANT`.

## Ordre d'application (priorité)

| # | Fichier | Finding | Gravité | Type |
|---|---------|---------|---------|------|
| 01 | `01-send-email-open-relay.md` | S1a | **P0** | Edge function |
| 02 | `02-forgeable-service-role-jwt.md` | S1b / S22 | **P0** | Edge functions ×2 |
| 03 | `03-B1-pipeline-audit-trail.md` | B1 | ÉLEVÉ (compliance) | Frontend |
| 04 | `04-B5-kyc-silent-write-failures.md` | B5 | MOYEN (compliance) | Frontend |
| 05 | `05-S13-join-agency-invite-gate.md` | S13 | ÉLEVÉ (multi-tenant) | Migration SQL |
| 06 | `06-S2-S10-S17-secdef-grants-lockdown.md` | S2/S10/S17 | MOYEN‑ÉLEVÉ | Migration SQL |
| 07 | `07-S12-S31-anon-policies-tighten.md` | S12/S31 | MOYEN | Migration SQL |
| 08 | `08-S30-agency-billing-lockdown.md` | S30 | MOYEN | Migration SQL |

| 09 | `09-R4-cost-dos-edge-auth.md` | S1c + cluster | ÉLEVÉ/MOYEN | Edge functions |
| 10 | `10-R5-ssrf-safe-fetch.md` | S23/S24/S1h | ÉLEVÉ/MOYEN | Edge functions + helper |
| 11 | `11-R6-sentry-mfa.md` | S27/S28 | MOYEN | Frontend + migration |
| 12 | `12-quickwins-quality-perf.md` | Q2/Q4/Q6, P8-P10, S20 | quick-wins | Deps/dead code/perf |

**Reste à traiter en PR dédiées avec tests** (non patchés ici) : bugs `B2`/`B3`/`B4`/`B6`/`B7`/`B9`/`B10`
(audit §4), refactors des fichiers monstres (`ListingFormPage`…), ajout de tests MFA/KYC (Q1).

Voir `../PRE_LAUNCH_REMEDIATION.md` pour la vue d'ensemble.

## Rappel — 2 causes racines
1. Edge Functions déployées `--no-verify-jwt` → chaque fonction doit s'authentifier elle-même.
2. `EXECUTE` non révoqué de `public`/`anon` sur les fonctions `SECURITY DEFINER`.
