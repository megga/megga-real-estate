import type { Page } from '@playwright/test'

// Console errors that are known/pre-existing and should not fail tests.
// Each entry must reference a tracked issue or known limitation.
const IGNORED_PATTERNS: Array<RegExp | string> = [
  // Network noise — not app bugs
  'Failed to load resource',
  /favicon/i,
  'chrome-extension',
  // Tracked: Mapbox token missing in test env (VITE_MAPBOX_TOKEN unset)
  /mapbox/i,
  // Realtime sans backend — PAR CONCEPTION depuis le 13.09.2026. Les suites sous
  // VITE_DEV_BYPASS_AUTH visent le Supabase LOCAL (playwright.local-supabase.ts), qui ne
  // tourne pas dans le job `e2e` de la CI : le socket Realtime est refusé (ERR_CONNECTION_REFUSED)
  // et supabase-js le journalise en erreur. C'est le pendant du « Failed to load resource »
  // ci-dessus pour REST : du bruit d'environnement, pas un plantage de l'app. Jusqu'à ce
  // jour ce socket s'ouvrait… sur la production.
  /WebSocket connection to '.*\/realtime\/v1\/websocket.*' failed/,
]

function isIgnored(msg: string): boolean {
  return IGNORED_PATTERNS.some((p) =>
    typeof p === 'string' ? msg.includes(p) : p.test(msg)
  )
}

export function collectConsoleErrors(page: Page): { errors: string[] } {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return {
    get errors() {
      return errors.filter((e) => !isIgnored(e))
    },
  } as { errors: string[] }
}
