// Capture la section Testimonials de la homepage pour comparer à la maquette.
import { chromium } from 'playwright'

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true })
const page = await ctx.newPage()

await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  sessionStorage.setItem('megga-site-access', 'true')
  localStorage.setItem('cookie-consent', 'accepted')
  localStorage.setItem('megga-cookie-consent', 'accepted')
})
await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
await page.evaluate(() => {
  document.querySelectorAll('[class*="cookie" i]').forEach(el => el.style.display = 'none')
})

const data = await page.evaluate(() => {
  // Trouve la section qui contient "Testimonials" badge ou title with "what people say"
  const allSections = Array.from(document.querySelectorAll('section'))
  for (const s of allSections) {
    const txt = s.innerText
    if (txt?.includes('Testimonials') || txt?.includes('what people say') || txt?.includes('people say about')) {
      const r = s.getBoundingClientRect()
      // Count testimonial cards (white rounded boxes with avatar + quote + name)
      const cards = s.querySelectorAll('[style*="rounded"], [style*="radius"], article')
      return {
        y1: Math.round(r.top + window.scrollY),
        y2: Math.round(r.bottom + window.scrollY),
        h: Math.round(r.height),
        cardCount: cards.length,
        snippet: txt.slice(0, 200),
      }
    }
  }
  return null
})

console.log('Testimonials section:', JSON.stringify(data, null, 2))

if (data) {
  await page.evaluate(y => window.scrollTo(0, y - 50), data.y1)
  await page.waitForTimeout(500)
  await page.setViewportSize({ width: 1440, height: Math.min(data.h + 200, 1500) })
  await page.evaluate(y => window.scrollTo(0, y), data.y1)
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/home-testimonials.png' })
  console.log('Saved /tmp/home-testimonials.png')
}

await browser.close()
