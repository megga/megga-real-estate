import { chromium } from 'playwright';

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  ignoreHTTPSErrors: true,
});
const page = await context.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const url = 'http://localhost:5173/about';
console.log('Loading', url);

// Bypass site password gate (sessionStorage flag set after origin is set)
// Also pre-acknowledge cookie banner so it doesn't overlay screenshots
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  sessionStorage.setItem('megga-site-access', 'true');
  // Try common cookie banner keys
  localStorage.setItem('cookie-consent', 'accepted');
  localStorage.setItem('megga-cookie-consent', 'accepted');
  localStorage.setItem('cookie_consent', 'accepted');
});

await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(4000);

// Force-hide any cookie banner that might still be visible
await page.evaluate(() => {
  document.querySelectorAll('[class*="cookie" i], [data-cookie-banner], [class*="CookieBanner" i]').forEach((el) => {
    el.style.display = 'none';
  });
});
await page.waitForTimeout(500);

await page.screenshot({ path: '/tmp/about-page.png', fullPage: true });
const dim = await page.evaluate(() => ({
  w: document.documentElement.scrollWidth,
  h: document.documentElement.scrollHeight,
}));
console.log('Saved screenshot. Page dimensions:', dim);

console.log('errors:', errors);

await browser.close();
