/**
 * Fumée sur /dashboard/kyc — le PAGER, pas le garde qui le précède.
 *
 * ⚠ HISTORIQUE, à ne pas défaire. Jusqu'au 02.08.2026 ce spec ne montait jamais
 * la page KYC : sous `VITE_DEV_BYPASS_AUTH`, le profil mock désignait une agence
 * (`dev-mock-agency`) absente de toute base, `useLabGuard()` n'obtenait donc aucun
 * statut et `KycLabGuard` REMPLAÇAIT les trois routes KYC par son écran « statut
 * illisible ». Mesuré par mutation : faire renvoyer `null` à KycSugarV3Page ne
 * changeait pas d'un caractère le body de /dashboard/kyc, et les tests restaient
 * verts. Le correctif tient en une ligne de donnée — DEV_BYPASS_AGENCY
 * (src/hooks/useAuth.tsx) déclare l'agence du mock VÉRIFIÉE, et useLabGuard la lit
 * au lieu d'un réseau qui ne peut rien lui dire.
 *
 * Ce que ces tests éprouvent donc réellement, à partir d'ici : le pager KYC se
 * monte et rend son écran, pas celui d'un garde ni celui d'une frontière d'erreur.
 *
 * ⚠ Les DONNÉES restent vides : sans session Supabase, la RLS ne rend aucune ligne.
 * On éprouve le rendu de la page à vide, jamais le rendu d'un dossier. Ce dernier
 * se prouve là où de vraies données existent (playwright.kyb.config.ts, tests
 * backend). De même, les écrans de BLOCAGE du garde LAB (jamais soumis / en revue
 * / rejeté) ne sont plus couverts ici — leur règle est éprouvée à l'unité, sans
 * réseau ni rendu, dans tests/unit/lab-guard.spec.ts.
 */
import { test, expect } from '@playwright/test'
import { collectConsoleErrors } from './helpers/console'
import { skipKycOnboarding } from './helpers/kyc'

test.describe('Agent KYC', () => {
  test('le pager KYC se monte, garde LAB franchi', async ({ page }) => {
    await skipKycOnboarding(page)
    await page.goto('/dashboard/kyc')
    await page.waitForLoadState('networkidle')

    // 1. La route est montée et n'a pas été expulsée ailleurs — ni vers
    //    /dashboard/kyc/bienvenue, ni vers /dashboard : les deux redirections que
    //    cette page sait émettre. D'où l'ancre de fin.
    await expect(page).toHaveURL(/\/dashboard\/kyc$/)

    // 2. Le titre du pager (KycListPage) — c'est LUI qui distingue la vraie page
    //    des deux écrans qui savaient la remplacer : le garde LAB titre « Statut
    //    de vérification illisible », la frontière d'erreur « Une erreur est
    //    survenue ». Un repère qu'aucun des deux ne peut satisfaire.
    await expect(page.getByRole('heading', { name: 'KYC', exact: true })).toBeVisible()

    // 3. Une commande propre au pager, pour ne pas s'en remettre au seul titre.
    await expect(page.getByRole('button', { name: 'Nouveau dossier' })).toBeVisible()

    // 4. Ceinture et bretelles : ni la frontière d'erreur, ni le garde. Le point 2
    //    les exclut déjà par construction ; on le dit quand même parce qu'un futur
    //    assouplissement du sélecteur (un `exact: false` de trop) rouvrirait
    //    exactement le trou que ce fichier documente.
    await expect(page.getByText('Une erreur est survenue')).toHaveCount(0)
    await expect(page.getByText('Statut de vérification illisible')).toHaveCount(0)
  })

  test('no blocking console errors on /dashboard/kyc load', async ({ page }) => {
    await skipKycOnboarding(page)
    const collector = collectConsoleErrors(page)
    await page.goto('/dashboard/kyc')
    await page.waitForLoadState('networkidle')

    expect(
      collector.errors,
      `Blocking console errors:\n${collector.errors.join('\n')}`
    ).toEqual([])
  })
})
