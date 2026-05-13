// Mesure les Y de chaque section sur /about pour comparer aux specs Figma.
//
// Repères Figma (node 9552:21438) :
//   Header Wrapper       y = 0     h = 112
//   Hero Section         y = 0     h = 540  (lourd : pt-24 + Container 24+110+220+316+90 = 540)
//   ↳ Container interne  y = 24    h = 516
//   ↳ Browser absolute   bottom-[-48] (chevauche le grid)
//   Articles Section     y = 587   h = 1880 (pt-64 pb-160 + 1656 grid)
//   Footer V1            y = 2514  h = 996
//
// On lit aussi tailles utiles dans le DOM.

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
  localStorage.setItem('megga-cookie-consent', 'accepted');
  localStorage.setItem('cookie_consent', 'accepted');
});

await page.goto('http://localhost:5173/about', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2500);

const m = await page.evaluate(() => {
  function box(sel) {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top + window.scrollY, left: r.left, width: r.width, height: r.height };
  }
  return {
    body: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight },
    header: box('header'),
    h1: box('h1'),
    section_hero: box('header + section'),
    sections: Array.from(document.querySelectorAll('section')).map(s => {
      const r = s.getBoundingClientRect();
      return { top: r.top + window.scrollY, height: r.height, w: r.width };
    }),
    cards: Array.from(document.querySelectorAll('section > div > div')).slice(0, 6).map(s => {
      const r = s.getBoundingClientRect();
      return { top: Math.round(r.top + window.scrollY), height: Math.round(r.height), w: Math.round(r.width) };
    }),
  };
});

console.log(JSON.stringify(m, null, 2));
await browser.close();
