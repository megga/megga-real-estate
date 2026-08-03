import type { Page } from '@playwright/test'

/**
 * Clé du flag « onboarding KYC déjà vu ». RECOPIÉE de `KYC_ONBOARDED_KEY`
 * (src/lib/kycOnboarding.ts), qui ne l'exporte pas — et que ces specs ne
 * pourraient de toute façon pas importer : le tsconfig racine lu par Playwright
 * ne déclare aucun `paths`, l'alias `@/` n'y résout pas.
 *
 * La recopie ne peut pas dériver en silence : si la clé change côté source, le
 * gate d'onboarding reprend la main, /dashboard/kyc repart sur /bienvenue et les
 * assertions qui visent le pager passent au rouge.
 */
const KYC_ONBOARDED_KEY = 'megga.kyc.onboarded'

/**
 * Fait passer l'agent pour « déjà passé par l'onboarding KYC », AVANT le premier
 * script de la page (addInitScript, donc avant que React lise le flag).
 *
 * Sans ça, /dashboard/kyc n'est jamais le pager : KycSugarV3Page monte son gate
 * d'empty-state, la lecture de `kyc_cases` revient vide (anon, sans session, sous
 * RLS) et la page redirige aussitôt vers /dashboard/kyc/bienvenue. Le pager —
 * l'écran que ces vérifications prétendent couvrir — ne serait donc jamais rendu.
 *
 * Ce n'est pas qu'un raccourci de confort : sans le flag, LEQUEL des deux écrans
 * est rendu dépend du réseau du runner (lecture vide → onboarding ; lecture en
 * échec → pager), c'est-à-dire d'autre chose que le code sous test.
 */
export async function skipKycOnboarding(page: Page): Promise<void> {
  await page.addInitScript((key: string) => {
    window.localStorage.setItem(key, '1')
  }, KYC_ONBOARDED_KEY)
}
