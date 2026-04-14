// scripts/playwright-directory-audit.mjs
// Visual + console audit of the Agent Directory pages.
import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const OUT = '/tmp'

const consoleMessages = []
const pageErrors = []
const failedRequests = []

function log(tag, ...args) {
  console.log(`[${tag}]`, ...args)
}

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
  } catch (_) { return null }
}

;(async () => {
  const proxy = parseProxy()
  if (proxy) log('INFO', `Using proxy ${proxy.server} (user=${proxy.username.slice(0, 20)}…)`)
  const browser = await chromium.launch({
    headless: true,
    proxy: proxy || undefined,
    args: ['--ignore-certificate-errors'],
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  })
  // Bypass the PasswordGate: it reads sessionStorage.getItem('megga-site-access') === 'true'
  await context.addInitScript(() => {
    try { sessionStorage.setItem('megga-site-access', 'true') } catch (_) {}
  })
  const page = await context.newPage()

  // Instrumentation
  page.on('console', (msg) => {
    consoleMessages.push({ type: msg.type(), text: msg.text(), url: page.url() })
  })
  page.on('pageerror', (err) => {
    pageErrors.push({ message: err.message, stack: err.stack, url: page.url() })
  })
  page.on('requestfailed', (req) => {
    failedRequests.push({
      url: req.url(),
      method: req.method(),
      failure: req.failure()?.errorText,
      pageUrl: page.url(),
    })
  })

  // ── 1. Directory ──
  log('STEP', '1. Navigate to /agents')
  await page.goto(`${BASE}/agents`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1500) // let React Query settle
  const directoryScreenshot = `${OUT}/01-directory.png`
  await page.screenshot({ path: directoryScreenshot, fullPage: true })
  log('OK', `Screenshot → ${directoryScreenshot}`)

  const directoryTitle = await page.title()
  const directoryH1 = await page.locator('h1').first().textContent().catch(() => null)
  const directoryUrl = page.url()

  // Find cards — try a few selectors that match the directory cards
  const cardSelectors = [
    'a[href^="/agences/"]',
    'a[href^="/agents/"]',
    '[data-testid="agency-card"]',
    '[data-testid="agent-card"]',
  ]

  // Count each kind
  const agencyLinks = await page.locator('a[href^="/agences/"]').count()
  const agentLinks = await page.locator('a[href^="/agents/"]').count()
  log('INFO', `Found ${agencyLinks} agency links + ${agentLinks} agent links on /agents`)

  // ── 2. Click first agency card (agencies tab) ──
  // The directory default type is 'agents'. Switch to agencies first.
  let agencyProfileScreenshot = null
  let agencyProfileInfo = { title: null, h1: null, url: null, clickedHref: null }

  log('STEP', '2. Switch to agencies tab and click first agency card')
  // Look for a tab / pill that switches to agencies (common patterns)
  const agencyTabCandidates = [
    'button:has-text("Agences")',
    'button:has-text("Agences immobilières")',
    'button:has-text("Agencies")',
    'a[href="/agences"]',
    '[role="tab"]:has-text("Agences")',
  ]
  let switched = false
  for (const sel of agencyTabCandidates) {
    const el = page.locator(sel).first()
    if (await el.count() > 0 && await el.isVisible().catch(() => false)) {
      await el.click({ timeout: 3000 }).catch(() => {})
      switched = true
      log('INFO', `Clicked agency tab via selector: ${sel}`)
      break
    }
  }
  if (!switched) log('WARN', 'No "agencies" tab found — trying direct navigation to /agences if available')

  await page.waitForTimeout(2000)
  const firstAgency = page.locator('a[href^="/agences/"]').first()
  if (await firstAgency.count() > 0) {
    const href = await firstAgency.getAttribute('href')
    agencyProfileInfo.clickedHref = href
    await firstAgency.click()
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1500)
    agencyProfileScreenshot = `${OUT}/02-agency-profile.png`
    await page.screenshot({ path: agencyProfileScreenshot, fullPage: true })
    agencyProfileInfo.title = await page.title()
    agencyProfileInfo.h1 = await page.locator('h1').first().textContent().catch(() => null)
    agencyProfileInfo.url = page.url()
    log('OK', `Agency profile → ${agencyProfileScreenshot}`)
  } else {
    log('WARN', 'No agency link found — falling back to direct URL /agences/fermer-labels-geneve')
    await page.goto(`${BASE}/agences/fermer-labels-geneve`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    agencyProfileScreenshot = `${OUT}/02-agency-profile.png`
    await page.screenshot({ path: agencyProfileScreenshot, fullPage: true })
    agencyProfileInfo.title = await page.title()
    agencyProfileInfo.h1 = await page.locator('h1').first().textContent().catch(() => null)
    agencyProfileInfo.url = page.url()
    agencyProfileInfo.clickedHref = '/agences/fermer-labels-geneve (fallback)'
  }

  // ── 3. Back to /agents and click first agent card ──
  log('STEP', '3. Navigate back to /agents and click first agent card')
  await page.goto(`${BASE}/agents`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1500)

  let agentProfileScreenshot = null
  let agentProfileInfo = { title: null, h1: null, url: null, clickedHref: null }
  const firstAgent = page.locator('a[href^="/agents/"]').first()
  if (await firstAgent.count() > 0) {
    const href = await firstAgent.getAttribute('href')
    agentProfileInfo.clickedHref = href
    await firstAgent.click()
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1500)
    agentProfileScreenshot = `${OUT}/03-agent-profile.png`
    await page.screenshot({ path: agentProfileScreenshot, fullPage: true })
    agentProfileInfo.title = await page.title()
    agentProfileInfo.h1 = await page.locator('h1').first().textContent().catch(() => null)
    agentProfileInfo.url = page.url()
    log('OK', `Agent profile → ${agentProfileScreenshot}`)
  } else {
    log('WARN', 'No agent link found — falling back to direct URL /agents/pierre-hagmann-geneve')
    await page.goto(`${BASE}/agents/pierre-hagmann-geneve`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    agentProfileScreenshot = `${OUT}/03-agent-profile.png`
    await page.screenshot({ path: agentProfileScreenshot, fullPage: true })
    agentProfileInfo.title = await page.title()
    agentProfileInfo.h1 = await page.locator('h1').first().textContent().catch(() => null)
    agentProfileInfo.url = page.url()
    agentProfileInfo.clickedHref = '/agents/pierre-hagmann-geneve (fallback)'
  }

  await browser.close()

  // ── Report ──
  const report = {
    directory: {
      url: directoryUrl,
      title: directoryTitle,
      h1: directoryH1,
      agencyLinksCount: agencyLinks,
      agentLinksCount: agentLinks,
      screenshot: directoryScreenshot,
    },
    agencyProfile: { ...agencyProfileInfo, screenshot: agencyProfileScreenshot },
    agentProfile: { ...agentProfileInfo, screenshot: agentProfileScreenshot },
    consoleMessages: {
      total: consoleMessages.length,
      errors: consoleMessages.filter((m) => m.type === 'error'),
      warnings: consoleMessages.filter((m) => m.type === 'warning'),
    },
    pageErrors,
    failedRequests,
  }

  console.log('\n=== AUDIT REPORT ===')
  console.log(JSON.stringify(report, null, 2))
})()
