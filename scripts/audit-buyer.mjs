// Buyer persona simulation: "Marie Müller", Swiss buyer searching in Geneva.
// Run: node scripts/audit-buyer.mjs

import { runPersona, BASE_URL } from './audit-helper.mjs';

const findings = {};

await runPersona('buyer', async (ctx) => {
  const { page } = ctx;

  // ---- 1. Land on home ----
  await ctx.step('home', async () => {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await ctx.unlockGate();
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await ctx.screenshot('home');
    const h1 = await page.locator('h1').first().textContent().catch(() => null);
    findings.homeH1 = h1?.trim().slice(0, 200);
    ctx.log('home h1:', findings.homeH1);
  });

  // ---- 2. Try the main nav ----
  await ctx.step('nav-explore', async () => {
    const navLinks = await page.locator('nav a, header a').allInnerTexts().catch(() => []);
    findings.navLinks = [...new Set(navLinks.map(t => t.trim()).filter(Boolean))].slice(0, 20);
    ctx.log('nav links:', findings.navLinks);
    await ctx.screenshot('nav');
  });

  // ---- 3. Acheter (search page) ----
  await ctx.step('acheter-page', async () => {
    await page.goto(`${BASE_URL}/acheter`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await ctx.unlockGate();
    await page.waitForTimeout(1500);
    await ctx.screenshot('acheter');
    const h1 = await page.locator('h1').first().textContent().catch(() => null);
    findings.acheterH1 = h1?.trim().slice(0, 200);
    // Count cards
    const cardCount = await page.locator('[data-testid="listing-card"], article, [class*="ListingCard"]').count().catch(() => 0);
    findings.acheterCards = cardCount;
    ctx.log('acheter h1:', findings.acheterH1, 'cards:', cardCount);
  });

  // ---- 4. Try search filters ----
  await ctx.step('acheter-filter-price', async () => {
    // Try clicking on price filter or type filter (depends on UI)
    const filterButtons = await page.locator('button').allInnerTexts().catch(() => []);
    findings.acheterButtons = filterButtons.slice(0, 30);
    await ctx.screenshot('acheter-filters');
  });

  // ---- 5. Try the map view ----
  await ctx.step('acheter-map', async () => {
    // look for mapbox canvas
    const mapCount = await page.locator('canvas, .mapboxgl-canvas, [class*="map"]').count().catch(() => 0);
    findings.acheterMapCanvases = mapCount;
    ctx.log('map canvases:', mapCount);
    await ctx.screenshot('acheter-map');
  });

  // ---- 6. Open a listing ----
  await ctx.step('open-listing', async () => {
    // find first listing link
    const links = await page.locator('a[href*="/listing/"], a[href*="/bien/"]').all();
    if (links.length > 0) {
      const href = await links[0].getAttribute('href');
      findings.firstListingHref = href;
      await page.goto(`${BASE_URL}${href}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await ctx.unlockGate();
      await page.waitForTimeout(1500);
      await ctx.screenshot('listing-detail');
      const h1 = await page.locator('h1').first().textContent().catch(() => null);
      findings.listingH1 = h1?.trim().slice(0, 200);
      ctx.log('listing h1:', findings.listingH1);
    } else {
      ctx.log('no listing links found, trying default ID');
      // Try to find listing IDs from supabase REST
      await page.goto(`${BASE_URL}/listing/1`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await ctx.unlockGate();
      await ctx.screenshot('listing-detail-fallback');
    }
  });

  // ---- 7. Test affordability calculator ----
  await ctx.step('affordability-cta', async () => {
    // look for calculator
    const text = await page.locator('body').innerText().catch(() => '');
    const hasCalc = /accessibilité|calculateur|hypothèque|mensualité|/i.test(text);
    findings.hasAffordabilityText = hasCalc;
    // try clicking on any "calculer" or "accessibilité" button
    const calcBtn = page.locator('button:has-text("Calculer"), button:has-text("accessibilité"), button:has-text("Accessibilité")').first();
    if (await calcBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await calcBtn.click().catch(() => {});
      await page.waitForTimeout(500);
      await ctx.screenshot('affordability-open');
    } else {
      await ctx.screenshot('affordability-not-found');
    }
  });

  // ---- 8. Test favorite (heart) ----
  await ctx.step('favorite-toggle', async () => {
    const heart = page.locator('button[aria-label*="favori"], button[aria-label*="Ajouter"], button:has(svg.lucide-heart)').first();
    if (await heart.isVisible({ timeout: 1500 }).catch(() => false)) {
      await heart.click().catch(() => {});
      await page.waitForTimeout(800);
      await ctx.screenshot('favorite-clicked');
      ctx.log('clicked heart');
    } else {
      ctx.log('no heart button found');
      await ctx.screenshot('favorite-not-found');
    }
  });

  // ---- 9. Visit booking CTA ----
  await ctx.step('visit-cta', async () => {
    const visitBtn = page.locator('button:has-text("visite"), button:has-text("Visite"), button:has-text("Planifier"), a:has-text("Planifier")').first();
    if (await visitBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await visitBtn.click().catch(() => {});
      await page.waitForTimeout(800);
      await ctx.screenshot('visit-modal');
      const dialogVisible = await page.locator('[role="dialog"], .dialog').count().catch(() => 0);
      findings.visitDialogCount = dialogVisible;
      // close
      await page.keyboard.press('Escape').catch(() => {});
    } else {
      await ctx.screenshot('visit-cta-not-found');
    }
  });

  // ---- 10. Louer page (rentals) ----
  await ctx.step('louer-page', async () => {
    await page.goto(`${BASE_URL}/louer`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await ctx.unlockGate();
    await page.waitForTimeout(2000);
    await ctx.screenshot('louer');
    const h1 = await page.locator('h1').first().textContent().catch(() => null);
    findings.louerH1 = h1?.trim().slice(0, 200);
    const cardCount = await page.locator('[data-testid="listing-card"], article').count().catch(() => 0);
    findings.louerCards = cardCount;
    ctx.log('louer h1:', findings.louerH1, 'cards:', cardCount);
  });

  // ---- 11. Agents directory ----
  await ctx.step('agents-directory', async () => {
    await page.goto(`${BASE_URL}/agents`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await ctx.unlockGate();
    await page.waitForTimeout(1500);
    await ctx.screenshot('agents');
    const h1 = await page.locator('h1').first().textContent().catch(() => null);
    findings.agentsH1 = h1?.trim().slice(0, 200);
    ctx.log('agents h1:', findings.agentsH1);
  });

  // ---- 12. Vendre page ----
  await ctx.step('vendre-page', async () => {
    await page.goto(`${BASE_URL}/vendre`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await ctx.unlockGate();
    await page.waitForTimeout(1500);
    await ctx.screenshot('vendre');
    const h1 = await page.locator('h1').first().textContent().catch(() => null);
    findings.vendreH1 = h1?.trim().slice(0, 200);
    ctx.log('vendre h1:', findings.vendreH1);
  });

  // ---- 13. Estimations page ----
  await ctx.step('estimations-page', async () => {
    await page.goto(`${BASE_URL}/estimations`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await ctx.unlockGate();
    await page.waitForTimeout(1500);
    await ctx.screenshot('estimations');
    const h1 = await page.locator('h1').first().textContent().catch(() => null);
    findings.estimationsH1 = h1?.trim().slice(0, 200);
  });

  // ---- 14. Language switch FR -> DE ----
  await ctx.step('lang-switch-de', async () => {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await ctx.unlockGate();
    await page.waitForTimeout(800);
    // try to find lang switcher
    const langBtn = page.locator('button:has-text("FR"), [aria-label*="langue"], [aria-label*="language"]').first();
    if (await langBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await langBtn.click();
      await page.waitForTimeout(400);
      const deBtn = page.locator('button:has-text("DE"), li:has-text("Deutsch"), [role="menuitem"]:has-text("DE")').first();
      if (await deBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await deBtn.click();
        await page.waitForTimeout(800);
        await ctx.screenshot('lang-de');
        const h1 = await page.locator('h1').first().textContent().catch(() => null);
        findings.homeH1_de = h1?.trim().slice(0, 200);
        ctx.log('home DE h1:', findings.homeH1_de);
      } else {
        await ctx.screenshot('lang-menu-no-de');
      }
    } else {
      await ctx.screenshot('lang-no-switcher');
      ctx.log('no language switcher visible');
    }
  });

  // ---- 15. EN ----
  await ctx.step('lang-switch-en', async () => {
    const langBtn = page.locator('button:has-text("DE"), button:has-text("FR"), [aria-label*="langue"], [aria-label*="language"]').first();
    if (await langBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await langBtn.click();
      await page.waitForTimeout(400);
      const enBtn = page.locator('button:has-text("EN"), li:has-text("English"), [role="menuitem"]:has-text("EN")').first();
      if (await enBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await enBtn.click();
        await page.waitForTimeout(800);
        await ctx.screenshot('lang-en');
        const h1 = await page.locator('h1').first().textContent().catch(() => null);
        findings.homeH1_en = h1?.trim().slice(0, 200);
        ctx.log('home EN h1:', findings.homeH1_en);
      }
    }
  });

  // ---- 16. IT ----
  await ctx.step('lang-switch-it', async () => {
    const langBtn = page.locator('button:has-text("EN"), button:has-text("DE"), button:has-text("FR")').first();
    if (await langBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await langBtn.click();
      await page.waitForTimeout(400);
      const itBtn = page.locator('button:has-text("IT"), li:has-text("Italiano"), [role="menuitem"]:has-text("IT")').first();
      if (await itBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await itBtn.click();
        await page.waitForTimeout(800);
        await ctx.screenshot('lang-it');
        const h1 = await page.locator('h1').first().textContent().catch(() => null);
        findings.homeH1_it = h1?.trim().slice(0, 200);
        ctx.log('home IT h1:', findings.homeH1_it);
      }
    }
  });

  // ---- 17. Login page ----
  await ctx.step('login-page', async () => {
    await page.goto(`${BASE_URL}/connexion`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await ctx.unlockGate();
    await page.waitForTimeout(800);
    await ctx.screenshot('login');
    const h1 = await page.locator('h1').first().textContent().catch(() => null);
    findings.loginH1 = h1?.trim().slice(0, 200);
    // check for OAuth Google button + email/password
    const hasGoogle = await page.locator('button:has-text("Google")').count();
    findings.loginHasGoogle = hasGoogle > 0;
  });

  // ---- 18. Register page ----
  await ctx.step('register-page', async () => {
    await page.goto(`${BASE_URL}/inscription`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await ctx.unlockGate();
    await page.waitForTimeout(800);
    await ctx.screenshot('register');
    const h1 = await page.locator('h1').first().textContent().catch(() => null);
    findings.registerH1 = h1?.trim().slice(0, 200);
  });

  // ---- 19. Test 404 ----
  await ctx.step('404-test', async () => {
    await page.goto(`${BASE_URL}/this-page-does-not-exist-xyz`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await ctx.unlockGate();
    await page.waitForTimeout(800);
    await ctx.screenshot('404');
    const text = await page.locator('body').innerText().catch(() => '');
    findings.has404 = /404|introuvable|not found/i.test(text);
  });

  // ---- 20. Final findings dump ----
  await ctx.step('summary', async () => {
    ctx.log('FINDINGS:', JSON.stringify(findings, null, 2));
  });
});

console.log('\n=== Findings dump ===');
console.log(JSON.stringify(findings, null, 2));
