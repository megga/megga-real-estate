# Sprint 2 CRM — pack livraison

Implémentation des 5 livrables Sprint 2 (Fiches Bien/Deal/Visite + modals Offre/Visite) dans la direction artistique **Sugar Pure** (cohabitation namespace `crm-sugar-v3/`).

## Ce qui a été livré

| # | Livrable | Route | Page React | Composants partagés |
|---|---|---|---|---|
| 1 | **Fiche Bien** + édition inline 12+ champs | `/dashboard/listings/:id` | `BienDetailSugarV3Page.tsx` | `bien-detail/BdShared.tsx` |
| 2 | **Fiche Deal** + stepper 8 + bannière KYC indicative | `/dashboard/transactions/:id` | `DealDetailSugarV3Page.tsx` | `deal-detail/DdShared.tsx` |
| 3 | **Modal Offre / Contre-offre** Sugar plein écran 3 étapes | `/dashboard/transactions/:id/offre/{nouvelle,contre}` | `OfferModalSugarV3Page.tsx` | inline |
| 4 | **Modal Planifier Visite** Sugar plein écran 3 étapes | `/dashboard/visites/nouveau?bienId=&contactId=` | `VisitModalSugarV3Page.tsx` | inline |
| 5 | **Fiche Visite** desktop + iPhone compagnon embedded | `/dashboard/visites/:id` | `VisiteDetailSugarV3Page.tsx` | `visite-detail/VdShared.tsx` |
| 5b | **Vue mobile compagnon** responsive 375px | `/dashboard/visites/:id/companion` | `VisitCompanionPage.tsx` | réutilise `VdMobileCompanion` |

## Infra DB

- Migration `supabase/migrations/20260517_001_sprint2_crm_offers_visits.sql` :
  - Nouvelle table `crm_offers` (chaîne d'offres + contre-offres par deal) avec RLS agency-scoped
  - Triggers AuditEvent nLPD : `Offre créée` / `Contre-offre envoyée` / `Offre acceptée|refusée|expirée|retirée`
  - Job `pg_cron` `crm-offers-expire-hourly` (0 * * * *) → bascule auto `pending → expired`
  - Extension `visits` : `duration_minutes`, `agent_id`, `bon JSONB`, `rapport JSONB`
  - Extension `properties` : `energy_class`, `mandate_commission_pct`, `mandate_signed_at`, `mandate_expires_at`
  - Realtime : `crm_offers` + `visits` ajoutés à la publication `supabase_realtime`
  - RPC `crm_offer_chain(deal_id)`, `crm_visits_by_property(property_id)`, `expire_crm_offers_now()`

## Hooks TanStack Query nouveaux

- `useOffers.ts` : `useOfferChain(dealId)`, `useOffersCountByDeal`, `useCreateOffer`, `useUpdateOfferStatus`, helpers `lastOffer`, `suggestedOfferAmount`
- `useVisitDetail.ts` : `useVisitDetail(id)`, `useVisitRealtime(id)` (pattern `useId()` obligatoire, CLAUDE.md §7), `useCreateAgentVisit`, `useSignVisitBon`, `useSaveVisitRapport`

## Types nouveaux

- `src/types/offer.ts` — `Offer`, `OfferKind`, `OfferParty`, `OfferStatus`, `OfferConditions`, `EMPTY_OFFER_CONDITIONS`, helpers `countActiveConditions`
- `src/types/visit.ts` — `VisitBon`, `VisitRapport`, `VisitKind`, `VisitSentiment`, `visitStatusToKind` (mapping `planned/confirmed → scheduled`, `no_show → no-show`)
- `src/components/crm-sugar-v3/dealStepper.ts` — `mapTransactionStageToStepper` (14 stages DB → 8 cercles UI), `isStageKycBlocking`

## Alias Sg* génériques

Pour ne plus suggérer que les primitives `crm-sugar-v3/primitives.tsx` sont KYC-only, des alias `Sg*` ont été ajoutés en cohabitation avec les `Kyc*` historiques (rétrocompat Sprint 1) :

```ts
SgBlackPill, SgGhostPill, SgCircleBtn, SgRing, SgStatusPill,
SgRiskPill, SgNeutralPill, SgStatCard, SgSection, SgAvatar, SgStepper
```

## Lecture obligatoire (dans cet ordre)

1. `MIGRATION_NOTES.md` — comment appliquer la migration Supabase (incl. dépendance pg_cron)
2. `SHIPPED.md` — récap détaillé fichier-par-fichier et dévations
3. `../sprint-1-kyc/HANDOFF_SPRINT_1_CLAUDE_CODE.md` — rappel direction artistique Sugar Pure (non négociable)

## Tests E2E

- `scripts/audit-sprint2-crm.mjs` — calqué sur `audit-sprint1-kyc.mjs`
- Couvre les 5 flows + responsive 375 (Mobile companion)
- Prérequis : dev server + auth bypass + migration appliquée + 1 contact/bien/transaction en DB

## Direction artistique respectée

- Accent unique `#0B0C0E`, surfaces blanches pures + gradient radial gris-bleu
- Aucune bordure 1px décorative — uniquement ombres Sugar (`shadowSm/shadow/shadowLg`)
- Manrope, tabular-nums, CHF apostrophes (formatters `fmtCHF/bdFmtCHF/ddFmt`)
- Animation `sgFadeUp .5s` sur entrée des cards
- Iconographie SVG stroke linéaire (catalogue `SgIcon` étendu : `arrowUp/globe/ruler/heart/photos/pen/mic/pin/smile/play/pause`)
- Sélection card : `boxShadow: "0 0 0 2px #0B0C0E inset"`

---
*Sprint 2 livré · mai 2026 · suite du Sprint 1 (KYC + LBA + nLPD)*
