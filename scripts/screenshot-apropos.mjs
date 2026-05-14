// Capture /a-propos en full page screenshot pour comparaison Figma.
// Adapté de scripts/screenshot-about.mjs.
import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  ignoreHTTPSErrors: true,
});
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

// Pre-bypass : password gate + cookie banner
await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  sessionStorage.setItem('megga-site-access', 'true');
  localStorage.setItem('cookie-consent', 'accepted');
  localStorage.setItem('megga-cookie-consent', 'accepted');
  localStorage.setItem('cookie_consent', 'accepted');
});

console.log('Loading /a-propos…');
await page.goto('http://localhost:5174/a-propos', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(4000);

// Force-hide cookie banner si toujours là
await page.evaluate(() => {
  document.querySelectorAll('[class*="cookie" i], [data-cookie-banner], [class*="CookieBanner" i]').forEach((el) => {
    el.style.display = 'none';
  });
});
await page.waitForTimeout(500);

await page.screenshot({ path: '/tmp/apropos-page.png', fullPage: true });
const dim = await page.evaluate(() => ({
  w: document.documentElement.scrollWidth,
  h: document.documentElement.scrollHeight,
  h1: document.querySelector('h1')?.innerText || 'NONE',
  sections: document.querySelectorAll('section').length,
}));
console.log('Saved /tmp/apropos-page.png — dimensions:', dim);
console.log('errors:', errors.length === 0 ? 'none' : errors);

await browser.close();
