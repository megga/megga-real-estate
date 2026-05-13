// Mesures détaillées de chaque élément critique de /about pour audit serré.
// Compare aux specs Figma exactes pour identifier les écarts.

import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  ignoreHTTPSErrors: true,
});
const page = await ctx.newPage();

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  sessionStorage.setItem('megga-site-access', 'true');
  localStorage.setItem('cookie-consent', 'accepted');
});

await page.goto('http://localhost:5173/about', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2500);

const m = await page.evaluate(() => {
  function box(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      top: Math.round(r.top + window.scrollY),
      left: Math.round(r.left),
      width: Math.round(r.width),
      height: Math.round(r.height),
    };
  }

  // Tous les boutons cliquables, pour comparer leurs tailles à Figma
  const buttons = Array.from(document.querySelectorAll('button, a[href]')).map(el => {
    const b = box(el);
    if (!b || b.height < 12 || b.width < 12) return null;
    return {
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || '').trim().slice(0, 40),
      ...b,
    };
  }).filter(Boolean);

  const headerEl   = document.querySelector('header');
  const heroEl     = document.querySelector('section');       // 1er section = Hero
  const heroContainer = document.querySelector('section > div');  // Container dark interne
  const heroTitle  = document.querySelector('h1');
  const heroBadge  = document.querySelector('section > div span');
  const browser    = document.querySelector('form');
  const footerEl   = document.querySelector('footer');
  const footerContainerDark = document.querySelector('footer > div');

  return {
    body: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight },
    header: box(headerEl),
    hero_section: box(heroEl),
    hero_container_dark: box(heroContainer),
    hero_title: box(heroTitle),
    browser_bar: box(browser),
    footer_outer: box(footerEl),
    footer_container_dark: box(footerContainerDark),
    buttons: buttons.slice(0, 25),
  };
});

console.log(JSON.stringify(m, null, 2));
await browser.close();
