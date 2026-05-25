import type { Page } from '@playwright/test'

// Console errors that are known/pre-existing and should not fail tests.
// Each entry must reference a tracked issue or known limitation.
const IGNORED_PATTERNS: Array<RegExp | string> = [
  // Network noise — not app bugs
  'Failed to load resource',
  /favicon/i,
  'chrome-extension',
  // Tracked: SugarConnector writes calc()/% into SVG path "d" — see spawn_task chip
  /<path>\s*attribute d:\s*Expected number/,
  // Tracked: Mapbox token missing in test env (VITE_MAPBOX_TOKEN unset)
  /mapbox/i,
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
