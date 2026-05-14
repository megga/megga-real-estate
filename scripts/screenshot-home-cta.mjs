// Capture l'homepage et zoom sur la section CTA iPad pour comparer à la maquette.
import { chromium } from 'playwright'

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  ignoreHTTPSErrors: true,
})
const page = await ctx.newPage()

await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  sessionStorage.setItem('megga-site-access', 'true')
  localStorage.setItem('cookie-consent', 'accepted')
  localStorage.setItem('megga-cookie-consent', 'accepted')
})
await page.goto('http://localhost:5174/', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(3000)

await page.evaluate(() => {
  document.querySelectorAll('[class*="cookie" i], [data-cookie-banner]').forEach(el => el.style.display = 'none')
})

// Trouve l'image iPad par son alt text
const ipadY = await page.evaluate(() => {
  const img = document.querySelector('img[alt*="iPad"]')
  if (!img) return null
  const section = img.closest('section')
  if (!section) return null
  const r = section.getBoundingClientRect()
  const ir = img.getBoundingClientRect()
  return {
    section: { y1: Math.round(r.top + window.scrollY), y2: Math.round(r.bottom + window.scrollY), h: Math.round(r.height) },
    ipad: { x: Math.round(ir.left), y: Math.round(ir.top + window.scrollY), w: Math.round(ir.width), h: Math.round(ir.height) },
  }
})

console.log('iPad CTA bounds:', JSON.stringify(ipadY, null, 2))

if (ipadY) {
  // Scroll vers la section pour qu'elle soit dans le viewport, puis screenshot
  await page.evaluate((y) => window.scrollTo(0, y - 100), ipadY.section.y1)
  await page.waitForTimeout(500)
  // Resize viewport pour englober la section entière
  await page.setViewportSize({ width: 1440, height: Math.min(ipadY.section.h + 200, 1500) })
  await page.evaluate((y) => window.scrollTo(0, y), ipadY.section.y1)
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/home-cta.png' })
  console.log(`Saved /tmp/home-cta.png`)
}

await browser.close()
