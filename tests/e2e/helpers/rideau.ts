import { expect, type Page } from '@playwright/test'

/**
 * Attend que le rideau d'arrivée soit levé.
 *
 * Sur `/dashboard*` et le banc `/dev/crm`, le rideau (`BootCurtain`, et son jumeau HTML
 * `#megga-boot`) couvre l'écran au moins 1,6 s depuis l'ouverture du document
 * (`MIN_VISIBLE_MS`), puis fond en 220 ms — même quand la page est déjà rendue DESSOUS.
 *
 * Un `locator.click()` l'attend de lui-même : Playwright vérifie que l'élément reçoit bien
 * le pointeur. Un geste par COORDONNÉES (`page.mouse`, `elementFromPoint`) ne vérifie rien
 * et tombe sur le rideau : le glissé ne part pas, le cadre mesuré est le sien. Mesuré le
 * 28.09.2026 — cinq tests des bancs rougissaient ainsi, seulement quand la page se rendait
 * avant la fin du rideau : au deuxième test d'un worker en local, au premier essai en CI
 * (verts au retry, donc lus « flaky »).
 */
export async function attendreRideauLeve(page: Page): Promise<void> {
  await expect(page.locator('.megga-boot'), 'le rideau d’arrivée couvre encore l’écran').toHaveCount(0, { timeout: 15_000 })
}
