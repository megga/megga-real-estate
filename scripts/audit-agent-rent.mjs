// Agent persona simulation: "Marc Bernhard", agent in Zurich creating a RENTAL listing.
// Run: BASE_URL=http://localhost:5174 node scripts/audit-agent-rent.mjs

import { runPersona } from './audit-helper.mjs';

const BASE = 'http://localhost:5174';
const findings = {};

await runPersona('agent-rent', async (ctx) => {
  const { page } = ctx;

  // ---- 1. Land on /dashboard ----
  await ctx.step('dashboard', async () => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await ctx.unlockGate();
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await ctx.screenshot('dashboard');
    const url = page.url();
    findings.dashboardUrl = url;
    const h1 = await page.locator('h1').first().textContent().catch(() => null);
    findings.dashboardH1 = h1?.trim().slice(0, 200);
    ctx.log('dashboard url:', url, 'h1:', findings.dashboardH1);
  });

  // ---- 2. Navigate to ListingFormPage (new) — chooser shown first ----
  await ctx.step('listing-form-chooser', async () => {
    await page.goto(`${BASE}/dashboard/listings/new`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await ctx.unlockGate();
    await page.waitForTimeout(2000);
    // Dismiss cookie banner if present
    const cookieBtn = page.locator('button:has-text("Refuser non essentiels"), button:has-text("Accepter tout")').first();
    if (await cookieBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await cookieBtn.click().catch(() => {});
      await page.waitForTimeout(400);
    }
    await ctx.screenshot('listing-form-chooser', true);
    const text = await page.locator('body').innerText().catch(() => '');
    findings.chooserHasManual = /Saisie manuelle/i.test(text);
    findings.chooserHasURL = /Depuis une URL/i.test(text);
    findings.chooserHasPDF = /Depuis un PDF/i.test(text);
    ctx.log('chooser — manual?', findings.chooserHasManual, 'URL?', findings.chooserHasURL, 'PDF?', findings.chooserHasPDF);

    // Click "Saisie manuelle"
    const manualBtn = page.locator('button:has-text("Saisie manuelle"), [role="button"]:has-text("Saisie manuelle")').first();
    if (await manualBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await manualBtn.click().catch(() => {});
      await page.waitForTimeout(2500);
    }
    await ctx.screenshot('listing-form-after-manual', true);
    const url = page.url();
    findings.formUrl = url;
    const text2 = await page.locator('body').innerText().catch(() => '');
    findings.formHasVenteToggle = /\bVente\b/i.test(text2);
    findings.formHasLocationToggle = /\bLocation\b/i.test(text2);
    ctx.log('after manual — url:', url, 'Vente?', findings.formHasVenteToggle, 'Location?', findings.formHasLocationToggle);
  });

  // ---- 3. Click on Location toggle ----
  await ctx.step('toggle-rent', async () => {
    // The toggle uses pills with exact text "Vente" / "Location" per plan-2.md
    const locationBtn = page.locator('button:has-text("Location")').first();
    if (await locationBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await locationBtn.click().catch(() => {});
      await page.waitForTimeout(1000);
      await ctx.screenshot('toggled-rent', true);
      findings.toggleClicked = true;
      // Check if "Loyer" label appears (suggesting rent fields are now visible)
      const text = await page.locator('body').innerText().catch(() => '');
      findings.formShowsLoyer = /Loyer/i.test(text);
      findings.formShowsCaution = /Caution/i.test(text);
      findings.formShowsMeuble = /Meublé/i.test(text);
      ctx.log('after toggle — Loyer?', findings.formShowsLoyer, 'Caution?', findings.formShowsCaution, 'Meublé?', findings.formShowsMeuble);
    } else {
      findings.toggleClicked = false;
      ctx.log('Location button not visible');
      await ctx.screenshot('no-location-button', true);
    }
  });

  // ---- 4. Fill basic identification (title etc) ----
  await ctx.step('fill-step1', async () => {
    // try to find a title input
    const titleInput = page.locator('input[name="title"], input[placeholder*="titre" i], input[placeholder*="Titre"]').first();
    if (await titleInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await titleInput.fill('TEST_audit_3.5p Zurich Bahnhofstrasse').catch(() => {});
      ctx.log('filled title');
    }
    // type select / radio
    await ctx.screenshot('after-title', true);
  });

  // ---- 5. Navigate to step 3 (price) by expanding section "Prix & détails" ----
  await ctx.step('reach-price-section', async () => {
    // Try clicking on the "Prix & détails" section header (collapsible accordion in form)
    const prixBtn = page.locator('button:has-text("Prix"), [role="button"]:has-text("Prix"), :text("Prix & détails")').first();
    if (await prixBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await prixBtn.click().catch(() => {});
      await page.waitForTimeout(600);
    }
    // Also scroll way down to find sections
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await page.waitForTimeout(800);
    await ctx.screenshot('full-form-scrolled', true);

    // Try expanding all sections
    const sectionBtns = await page.locator('button[aria-expanded="false"]').all();
    for (const btn of sectionBtns.slice(0, 6)) {
      await btn.click({ timeout: 500 }).catch(() => {});
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(500);
    await ctx.screenshot('all-sections-expanded', true);

    const text = await page.locator('body').innerText().catch(() => '');
    findings.formShowsLoyerInBody = /Loyer mensuel/i.test(text);
    findings.formShowsDeposit = /Caution|3 mois|Mois de loyer/i.test(text);
    findings.formShowsAvailability = /disponibilité|Date de disponibilité/i.test(text);
    findings.formShowsRegie = /Régie externe|external_regie/i.test(text);
    findings.formShowsMeubleToggle = /Meublé/.test(text);
    ctx.log('rental fields visible — loyer?', findings.formShowsLoyerInBody,
            'caution?', findings.formShowsDeposit,
            'dispo?', findings.formShowsAvailability,
            'regie?', findings.formShowsRegie,
            'meublé?', findings.formShowsMeubleToggle);
  });

  // ---- 6. Try to fill rent (price input) ----
  await ctx.step('fill-rent-price', async () => {
    const priceInput = page.locator('input[name="price"], input[type="number"][placeholder*="500"], input[placeholder*="2500"]').first();
    if (await priceInput.isVisible({ timeout: 1500 }).catch(() => false)) {
      await priceInput.fill('2800').catch(() => {});
      findings.priceFilled = true;
      ctx.log('filled price');
      await page.waitForTimeout(500);
    }
    await ctx.screenshot('price-filled', true);
  });

  // ---- 7. Try caution pills (1 / 2 / 3 mois) ----
  await ctx.step('caution-pills', async () => {
    const pill3 = page.locator('button:has-text("3 mois")').first();
    if (await pill3.isVisible({ timeout: 1500 }).catch(() => false)) {
      await pill3.click().catch(() => {});
      findings.cautionPillFound = true;
      await page.waitForTimeout(300);
      await ctx.screenshot('caution-3m', true);
      ctx.log('clicked 3 mois');
    } else {
      findings.cautionPillFound = false;
      ctx.log('No "3 mois" pill found');
    }
  });

  // ---- 8. Sidebar preview check ----
  await ctx.step('sidebar-preview', async () => {
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
    await page.waitForTimeout(500);
    const text = await page.locator('body').innerText().catch(() => '');
    // Check if /mois suffix appears anywhere (meaning the sidebar is showing rent format)
    findings.previewShowsPerMonth = /\/mois/.test(text);
    ctx.log('sidebar shows /mois?', findings.previewShowsPerMonth);
    await ctx.screenshot('sidebar-preview', true);
  });

  // ---- 9. Navigate to /louer (public rent page) ----
  await ctx.step('public-louer', async () => {
    await page.goto(`${BASE}/louer`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await ctx.unlockGate();
    await page.waitForTimeout(2500);
    await ctx.screenshot('louer-page', true);
    const url = page.url();
    findings.louerUrl = url;
    const h1 = await page.locator('h1').first().textContent().catch(() => null);
    findings.louerH1 = h1?.trim().slice(0, 200);
    const text = await page.locator('body').innerText().catch(() => '');
    findings.louerHasLoyerLabel = /Loyer mensuel/i.test(text);
    findings.louerHasMeubleFilter = /Meublé/i.test(text);
    findings.louerHasDispoFilter = /Disponible immédiatement/i.test(text);
    findings.louerHasRecommended = /Recommandé pour vous/i.test(text);
    ctx.log('louer h1:', findings.louerH1,
            'Loyer label?', findings.louerHasLoyerLabel,
            'Meublé filter?', findings.louerHasMeubleFilter,
            'Dispo filter?', findings.louerHasDispoFilter,
            'Recommandé tri (should be FALSE)?', findings.louerHasRecommended);
  });

  // ---- 10. Count cards on /louer ----
  await ctx.step('louer-card-count', async () => {
    const cardSelectors = '[data-testid="listing-card"], article, [class*="ListingCard"]';
    const count = await page.locator(cardSelectors).count().catch(() => 0);
    findings.louerCardCount = count;

    // Look for "/mois" in displayed prices
    const text = await page.locator('body').innerText().catch(() => '');
    const mosCount = (text.match(/\/mois/g) || []).length;
    findings.louerPerMosOccurrences = mosCount;
    ctx.log('cards on /louer:', count, '/mois occurrences:', mosCount);
  });

  // ---- 11. Check that /louer doesn't show calculateur accessibilité ----
  await ctx.step('louer-no-calculator', async () => {
    const text = await page.locator('body').innerText().catch(() => '');
    findings.louerHasCalculator = /accessibilité|hypothécaire/i.test(text);
    ctx.log('louer has accessibility calculator (should be FALSE):', findings.louerHasCalculator);
  });

  // ---- 12. Open a louer listing card if any (preview panel) ----
  await ctx.step('louer-open-preview', async () => {
    // Click first listing card
    const firstCard = page.locator('a[href*="/listing/"], a[href*="/bien/"]').first();
    if (await firstCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      const href = await firstCard.getAttribute('href');
      findings.firstLouerHref = href;
      await firstCard.click().catch(() => {});
      await page.waitForTimeout(2500);
      await ctx.screenshot('louer-listing-detail', true);
      const text = await page.locator('body').innerText().catch(() => '');
      findings.louerDetailHasContacterRegie = /Contacter la régie/i.test(text);
      findings.louerDetailHasPlanifierVisite = /Planifier une visite/i.test(text);
      findings.louerDetailHasMos = /\/mois/.test(text);
      ctx.log('detail — Contacter la régie?', findings.louerDetailHasContacterRegie,
              'Planifier une visite (should be FALSE for rent)?', findings.louerDetailHasPlanifierVisite,
              '/mois?', findings.louerDetailHasMos);
    } else {
      findings.firstLouerHref = null;
      ctx.log('no listing cards found on /louer');
    }
  });

  // ---- 13. Compare with /acheter ----
  await ctx.step('public-acheter', async () => {
    await page.goto(`${BASE}/acheter`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await ctx.unlockGate();
    await page.waitForTimeout(2500);
    await ctx.screenshot('acheter-page', true);
    const h1 = await page.locator('h1').first().textContent().catch(() => null);
    findings.acheterH1 = h1?.trim().slice(0, 200);
    const text = await page.locator('body').innerText().catch(() => '');
    findings.acheterHasPrixAchat = /Prix d'achat|Prix/i.test(text);
    findings.acheterHasMeubleFilter = /Meublé/i.test(text);
    findings.acheterHasDispoFilter = /Disponible immédiatement/i.test(text);
    findings.acheterHasMos = /\/mois/.test(text);
    findings.acheterHasCalc = /accessibilité|hypothécaire/i.test(text);
    ctx.log('acheter h1:', findings.acheterH1,
            'Meublé filter (should be FALSE)?', findings.acheterHasMeubleFilter,
            'Calc (should be TRUE)?', findings.acheterHasCalc);
  });

  // ---- 14. Try matching from agent CRM (does it differentiate buy/rent?) ----
  await ctx.step('matching-page', async () => {
    await page.goto(`${BASE}/dashboard/matching`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await ctx.unlockGate();
    await page.waitForTimeout(2500);
    await ctx.screenshot('matching-page', true);
    const text = await page.locator('body').innerText().catch(() => '');
    findings.matchingHasRentMention = /location|loyer|rent|locataire|tenant/i.test(text);
    findings.matchingHasBuyerOnlyTerms = /acheteur|buyer/i.test(text);
    ctx.log('matching — mentions rent terms?', findings.matchingHasRentMention,
            'mentions buyer terms?', findings.matchingHasBuyerOnlyTerms);
  });

  // ---- 15. Try contact create form (does it have a "type": locataire?) ----
  await ctx.step('contact-types', async () => {
    await page.goto(`${BASE}/dashboard/contacts`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await ctx.unlockGate();
    await page.waitForTimeout(2000);
    // Look for + new button
    const newBtn = page.locator('button:has-text("Nouveau"), button:has-text("Ajouter"), a:has-text("Nouveau contact")').first();
    if (await newBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await newBtn.click().catch(() => {});
      await page.waitForTimeout(1000);
    }
    await ctx.screenshot('contact-form', true);
    const text = await page.locator('body').innerText().catch(() => '');
    findings.contactHasLocataire = /locataire|tenant/i.test(text);
    findings.contactHasBailleur = /bailleur|landlord/i.test(text);
    ctx.log('contact types — locataire?', findings.contactHasLocataire,
            'bailleur?', findings.contactHasBailleur);
  });

  // ---- 16. Final dump ----
  await ctx.step('summary', async () => {
    ctx.log('FINDINGS:', JSON.stringify(findings, null, 2));
  });
});

console.log('\n=== Findings dump ===');
console.log(JSON.stringify(findings, null, 2));
