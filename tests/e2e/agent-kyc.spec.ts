// Fumée sur /dashboard/kyc.
//
// ⛔ CE QUE CE TEST NE COUVRE PAS, ET IL FAUT LE SAVOIR AVANT DE S'Y FIER. Les routes
// `kyc/*` vivent sous une route-layout `<KycLabGuard>` (App.tsx) qui les REMPLACE tant que
// `agencies.verification_status` n'est ni `auto_validated` ni `validated`. Sous
// `VITE_DEV_BYPASS_AUTH`, le profil est un mock sans agence réelle : le garde échoue à lire
// le statut et rend son écran de blocage. **`KycSugarV3Page` n'est jamais monté.**
//
// Mesuré le 02.08.2026, par mutation : en faisant retourner `null` à `KycSugarV3Page`, le
// body reste IDENTIQUE (478 caractères, l'écran du garde) et les deux tests passaient
// toujours. Ce fichier prétendait donc vérifier « la page liste KYC » sans jamais l'atteindre
// — un vert sans assertion. Couvrir la vraie page exige un profil de bypass dont l'agence
// est validée ; c'est un changement de fixture qui porte sur toute la suite, pas sur ce
// fichier.
//
// ⚠ POURQUOI PLUS DE `networkidle`. Le body traverse 52 → 101 → 478 caractères en ~1,5 s
// (rideau d'ouverture, vérification d'agence, puis écran du garde). `networkidle` ne dit pas
// « React a peint » mais « le réseau s'est calmé » : il échantillonnait un instant arbitraire
// de cette séquence. En CI il a attrapé un état à 39 caractères — trois tentatives d'affilée,
// puis encore à la relance — alors que le MÊME commit passait sur une branche sur-ensemble
// trois minutes plus tard.
//
// ⚠ ET PLUS DE SEUIL SUR LA LONGUEUR DU BODY. Il ne mordait pas : la coquille du CRM suffit à
// le franchir (mutation ci-dessus). `crm-agent-params-coverage.spec.ts` avait déjà constaté
// que l'ancien seuil de 50 ne tenait que grâce à la bannière cookies, ~580 caractères ajoutés
// à CHAQUE page, depuis retirée. On assert désormais un repère STRUCTUREL : le garde rend
// exactement un `<h1>` dans chacune de ses branches bloquantes — indépendant de la langue,
// et absent si l'écran ne se monte pas.
import { test, expect } from '@playwright/test'
import { collectConsoleErrors } from './helpers/console'

/** Le titre de l'écran rendu par la route — présent dans toutes les branches du garde. */
const titre = (page: import('@playwright/test').Page) =>
  page.getByRole('heading', { level: 1 })

test.describe('Agent KYC', () => {
  test('la route /dashboard/kyc rend l\'écran du garde LAB', async ({ page }) => {
    await page.goto('/dashboard/kyc', { waitUntil: 'domcontentloaded' })

    await expect(page).toHaveURL(/\/dashboard\/kyc/)
    // Attendre le repère plutôt qu'un délai réseau : c'est lui qui dit que React a peint.
    await expect(titre(page)).toBeVisible({ timeout: 20000 })
  })

  test('no blocking console errors on /dashboard/kyc load', async ({ page }) => {
    const collector = collectConsoleErrors(page)
    await page.goto('/dashboard/kyc', { waitUntil: 'domcontentloaded' })
    // Attendre le rendu ICI AUSSI : relever les erreurs avant que l'écran soit monté rendait
    // un VERT possible sur une page qui crie une seconde plus tard. Un faux vert est pire
    // qu'un rouge.
    await expect(titre(page)).toBeVisible({ timeout: 20000 })

    expect(
      collector.errors,
      `Blocking console errors:\n${collector.errors.join('\n')}`
    ).toEqual([])
  })
})
