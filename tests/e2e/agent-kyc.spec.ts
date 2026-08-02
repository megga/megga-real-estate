/**
 * Fumée sur /dashboard/kyc.
 *
 * ⚠ CE QUE CET ENVIRONNEMENT PERMET RÉELLEMENT DE VÉRIFIER. Sous
 * `VITE_DEV_BYPASS_AUTH` (playwright.config.ts), `useLabGuard()` ne peut jamais
 * obtenir de statut d'agence exploitable : le pager KYC n'est JAMAIS monté ici.
 * C'est le comportement voulu du garde, fail-closed par construction (étape 5
 * KYB) — pas d'accès KYC tant que le statut n'est pas confirmé.
 *
 * Le garde se range alors dans l'UN de ses deux écrans, et lequel dépend du
 * réseau de la machine, pas du code — mesuré le 02.08.2026 :
 *   - Supabase joignable : la lecture échoue proprement -> écran « Statut de
 *     vérification indisponible » (un titre, 254 caractères, aucun role=status) ;
 *   - Supabase injoignable : la requête ne rend jamais -> écran « Vérification du
 *     statut… » (role=status, 39 caractères, aucun titre).
 * Les deux sont délibérés, aucun n'est un plantage. C'est pourquoi l'assertion
 * accepte l'un OU l'autre : la viser sur un seul rendrait le test vert ou rouge
 * selon la connectivité du runner, ce qui est exactement le défaut qu'il corrige.
 *
 * Ce spec vérifiait auparavant `bodyText.length > 50`, sous le commentaire « KYC
 * page renders if body content is present ». L'assertion était CREUSE : elle était
 * satisfaite par le seul message d'attente du garde, long de 74 caractères. Le
 * raccourcissement des textes du 02.08.2026 l'a ramené à 39 et le test est passé au
 * rouge sans qu'aucun comportement n'ait changé, révélant qu'il n'avait jamais
 * éprouvé le rendu du pager. Le seuil n'a PAS été abaissé pour faire passer : c'est
 * l'assertion qui a été remplacée par ce que cet environnement peut prouver, à
 * savoir que la route se monte sur un écran délibéré et non sur un plantage.
 *
 * Le rendu du pager KYC se prouve là où un vrai Supabase existe : suite KYB
 * (playwright.kyb.config.ts) et tests backend.
 */
import { test, expect } from '@playwright/test'
import { collectConsoleErrors } from './helpers/console'

test.describe('Agent KYC', () => {
  test('la route se monte sur le garde LAB, sans plantage', async ({ page }) => {
    await page.goto('/dashboard/kyc')
    await page.waitForLoadState('networkidle')

    // 1. La route est montée et n'a pas été expulsée ailleurs.
    await expect(page).toHaveURL(/\/dashboard\/kyc/)

    // 2. L'un des deux écrans délibérés du garde est rendu : son attente
    //    (`role="status"`) ou son verdict (un titre). Repères STRUCTURELS, donc
    //    insensibles au libellé — contrairement au comptage de caractères qu'ils
    //    remplacent, qu'un simple raccourcissement de texte faisait basculer.
    await expect(
      page.getByRole('status').or(page.getByRole('heading')).first(),
    ).toBeVisible()

    // 3. Ce n'est pas la frontière d'erreur. C'EST CETTE ASSERTION QUI PORTE LA
    //    DÉTECTION DE PLANTAGE, pas la précédente : vérifié en cassant le garde
    //    le 02.08.2026, la frontière d'erreur rend elle aussi un titre et
    //    satisfait donc le point 2. Ne pas retirer celle-ci en croyant que
    //    l'autre couvre le cas.
    await expect(page.getByText('Une erreur est survenue')).toHaveCount(0)
  })

  test('no blocking console errors on /dashboard/kyc load', async ({ page }) => {
    const collector = collectConsoleErrors(page)
    await page.goto('/dashboard/kyc')
    await page.waitForLoadState('networkidle')

    expect(
      collector.errors,
      `Blocking console errors:\n${collector.errors.join('\n')}`
    ).toEqual([])
  })
})
