// One-shot smoke test for CreateVisitDialog — validates the refactor from mocks to Supabase.
import { chromium } from 'playwright'

function parseProxy() {
  const raw = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy
  if (!raw) return null
  try {
    const u = new URL(raw)
    return {
      server: `${u.protocol}//${u.host}`,
      username: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      bypass: 'localhost,127.0.0.1',
    }
  } catch { return null }
}

const consoleErrors = []
const pageErrors = []

;(async () => {
  const proxy = parseProxy()
  const browser = await chromium.launch({
    headless: true,
    proxy: proxy || undefined,
    args: ['--ignore-certificate-errors'],
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  })
  await context.addInitScript(() => {
    try { sessionStorage.setItem('megga-site-access', 'true') } catch {}
  })
  const page = await context.newPage()

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push({ text: msg.text(), url: page.url() })
  })
  page.on('pageerror', (err) => pageErrors.push({ message: err.message, url: page.url() }))

  await page.goto('http://localhost:5173/dashboard/calendar', { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2000)
  // Dismiss cookies banner if present (buttons: "Accept all", "Accepter tout", "Rejeter non essentiel")
  const acceptBtn = page.locator('button:has-text("Accept all"), button:has-text("Accepter tout"), button:has-text("Tout accepter")').first()
  if (await acceptBtn.count() > 0) {
    await acceptBtn.click({ timeout: 2000 }).catch(() => {})
    await page.waitForTimeout(500)
  }
  await page.screenshot({ path: '/tmp/calendar-page.png', fullPage: true })

  const calendarH1 = await page.locator('h1, h2').first().textContent().catch(() => null)
  const currentUrl = page.url()

  // Click the "+ Nouveau" button via text content
  let opened = false
  let usedSelector = null
  let debug = {}
  // Exact name to avoid matching "Nouveau contact" in sidebar
  const candidates = [
    ['getByRole name=Nouveau (exact)', page.getByRole('button', { name: 'Nouveau', exact: true }).first()],
    ['locator button hasText=/^\\+?\\s*Nouveau$/', page.locator('button', { hasText: /^\+?\s*Nouveau\s*$/ }).first()],
  ]
  for (const [label, loc] of candidates) {
    const c = await loc.count().catch(() => -1)
    debug[label] = { count: c }
    if (c > 0 && !opened) {
      try {
        await loc.click({ timeout: 3000, force: true })
        await page.waitForTimeout(1500)
        const dialogTitle = await page.locator('text=/Nouvel événement/i').count()
        if (dialogTitle > 0) {
          opened = true
          usedSelector = label
        }
      } catch (e) { debug[label].error = e.message }
    }
  }

  let contactOptions = 0
  let propertyOptions = 0
  let dialogScreenshot = null
  if (opened) {
    dialogScreenshot = '/tmp/calendar-dialog.png'
    await page.screenshot({ path: dialogScreenshot, fullPage: true })
    // Count options in <select> elements (Contact / Bien)
    const selects = await page.locator('select').elementHandles()
    for (const sel of selects) {
      const options = await sel.$$('option')
      const label = await sel.evaluate((el) => {
        const prev = el.previousElementSibling
        return prev?.textContent || ''
      })
      if (label.match(/contact/i)) contactOptions = options.length
      if (label.match(/bien/i)) propertyOptions = options.length
    }
  }

  await browser.close()

  const report = {
    calendarPage: { url: currentUrl, headingText: calendarH1, screenshot: '/tmp/calendar-page.png' },
    dialog: {
      opened,
      openedViaSelector: usedSelector,
      contactOptionsCount: contactOptions,
      propertyOptionsCount: propertyOptions,
      screenshot: dialogScreenshot,
      debug,
    },
    consoleErrors,
    pageErrors,
  }
  console.log(JSON.stringify(report, null, 2))
})()
