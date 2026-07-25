// Phase B — Routes CRM agent paramétrées (:id, :dossierId, :kind, :externalId).
//
// Strategy: use a stable bogus UUID/ID. The page must either:
//   - render a clean "not found" / empty state
//   - or redirect gracefully (e.g. back to a list)
// But it MUST NOT crash, throw uncaught errors, or render a white screen.
//
// This catches the class of bug where a hook explodes when the resource
// doesn't exist (forgotten null-check, RLS denial cascaded into error
// boundary, etc.) — a very common regression on detail pages.

import { test, expect } from '@playwright/test'
import { collectConsoleErrors } from './helpers/console'

const MOCK_UUID = '00000000-0000-0000-0000-000000000000'
const MOCK_EXTERNAL_ID = '0'

interface ParamRouteSpec {
  path: string
  label: string
}

const CRM_AGENT_PARAM_ROUTES: ParamRouteSpec[] = [
  { path: `/dashboard/contacts/${MOCK_UUID}`, label: 'Contact detail' },
  { path: `/dashboard/listings/${MOCK_UUID}`, label: 'Listing detail' },
  { path: `/dashboard/listings/${MOCK_UUID}/edit`, label: 'Listing edit' },
  { path: `/dashboard/transactions/${MOCK_UUID}`, label: 'Transaction detail' },
  { path: `/dashboard/transactions/${MOCK_UUID}/offre/offer`, label: 'Offer modal' },
  { path: `/dashboard/transactions/${MOCK_UUID}/offre/counter`, label: 'Counter-offer modal' },
  { path: `/dashboard/visits/${MOCK_UUID}`, label: 'Visit detail' },
  { path: `/dashboard/visits/${MOCK_UUID}/companion`, label: 'Visit companion (mobile)' },
  { path: `/dashboard/kyc/${MOCK_UUID}`, label: 'KYC dossier detail' },
  { path: `/dashboard/kyc/${MOCK_UUID}/export`, label: 'KYC export PDF' },
  { path: `/dashboard/market/${MOCK_EXTERNAL_ID}`, label: 'External listing detail' },
]

test.describe('CRM agent — parametric routes (mock IDs)', () => {
  for (const route of CRM_AGENT_PARAM_ROUTES) {
    test(`${route.label} loads without crashing`, async ({ page }) => {
      const collector = collectConsoleErrors(page)
      await page.goto(route.path)
      await page.waitForLoadState('networkidle')

      // Seuil calibré sur le PLUS COURT état vide légitime du CRM :
      // « Deal introuvable. » (17), « Visite introuvable. » (19),
      // « Dossier introuvable. » (20) — des pages plein écran, sans chrome de
      // navigation autour. C'est exactement le rendu que l'en-tête de ce fichier
      // décrit comme acceptable.
      //
      // L'ancien seuil de 50 ne tenait que grâce à la bannière cookies, montée
      // globalement dans App.tsx : elle ajoutait 580 caractères au body de
      // CHAQUE page, portant ces routes à ~600 et masquant leur vraie valeur.
      // La bannière retirée, le seuil mesurait donc un élément décoratif, pas
      // la page. Le vrai détecteur de plantage reste l'assertion suivante
      // (zéro erreur console) ; ici on ne dépiste qu'un écran blanc.
      const bodyText = await page.locator('body').innerText()
      expect(
        bodyText.trim().length,
        `${route.path}: body too small (${bodyText.trim().length} chars) — likely a render crash`
      ).toBeGreaterThan(10)

      expect(
        collector.errors,
        `${route.path}: blocking console errors:\n${collector.errors.join('\n')}`
      ).toEqual([])
    })
  }
})
