// Persona: Sophie Dubois - Geneva agent creating her first SALE listing.
// Runs against the dev server with DEV_BYPASS_AUTH=true (role=agent) on port 5174.

import { runPersona } from './audit-helper.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:5174';

await runPersona('agent-sale', async (ctx) => {
  const { page, step, screenshot } = ctx;

  // Helper: capture page text snapshot for verification
  async function snapshot(label) {
    try {
      const h1 = await page.locator('h1').allInnerTexts().catch(() => []);
      const h2 = await page.locator('h2').allInnerTexts().catch(() => []);
      const sidebarItems = await page.locator('aside a, nav[aria-label] a, [role="navigation"] a').allInnerTexts().catch(() => []);
      ctx.log(`[${label}] h1=`, h1.slice(0, 4));
      ctx.log(`[${label}] h2=`, h2.slice(0, 6));
      ctx.log(`[${label}] sidebar=`, sidebarItems.slice(0, 18));
      return { h1, h2, sidebarItems };
    } catch (e) {
      ctx.log(`[${label}] snapshot fail: ${e.message}`);
      return {};
    }
  }

  await step('home-landing', async () => {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await ctx.unlockGate();
    await page.waitForTimeout(800);
    await screenshot('home');
  });

  await step('goto-dashboard', async () => {
    await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await ctx.unlockGate();
    await page.waitForTimeout(1500);
    await snapshot('dashboard');
    await screenshot('action-board', true);
  });

  await step('explore-sidebar', async () => {
    // List all sidebar items visible
    const links = await page.locator('aside a, [data-sidebar] a').all();
    ctx.log('sidebar link count:', links.length);
    for (let i = 0; i < Math.min(links.length, 20); i++) {
      const txt = (await links[i].innerText().catch(() => '')).trim();
      const href = await links[i].getAttribute('href').catch(() => '');
      if (txt) ctx.log(`  - ${txt} → ${href}`);
    }
    await screenshot('sidebar-state');
  });

  await step('goto-contacts', async () => {
    await page.goto(BASE + '/dashboard/contacts', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);
    await snapshot('contacts');
    await screenshot('contacts-list', true);
  });

  await step('try-open-create-contact', async () => {
    // Find a Create / Nouveau contact button without submitting
    const candidates = ['button:has-text("Nouveau contact")', 'button:has-text("Créer")', 'button:has-text("Ajouter un contact")', 'button:has-text("Nouveau")'];
    let opened = false;
    for (const sel of candidates) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(800);
        opened = true;
        ctx.log('opened with selector:', sel);
        break;
      }
    }
    if (!opened) ctx.log('no create-contact button found');
    await screenshot('contact-create-modal');
    // Close if a modal opened (Escape)
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
  });

  await step('goto-pipeline', async () => {
    await page.goto(BASE + '/dashboard/pipeline', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1800);
    await snapshot('pipeline');
    // Count Kanban columns
    const cols = await page.locator('[data-column], [data-kanban-column], [data-stage]').count().catch(() => 0);
    ctx.log('kanban column data-attrs:', cols);
    const headerLikely = await page.locator('h3, h4').allInnerTexts().catch(() => []);
    ctx.log('possible column headers:', headerLikely.slice(0, 20));
    await screenshot('pipeline-kanban', true);
  });

  await step('goto-matching', async () => {
    await page.goto(BASE + '/dashboard/matching', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);
    await snapshot('matching');
    await screenshot('matching-page', true);
  });

  await step('goto-listings', async () => {
    await page.goto(BASE + '/dashboard/listings', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);
    await snapshot('listings');
    await screenshot('listings-list', true);
  });

  await step('open-listing-form', async () => {
    // Try to click "Créer un bien" / "Nouveau bien"
    const candidates = [
      'a:has-text("Créer un bien")', 'a:has-text("Nouveau bien")',
      'button:has-text("Créer un bien")', 'button:has-text("Nouveau bien")',
      'a[href*="/listings/new"]',
    ];
    let clicked = false;
    for (const sel of candidates) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 800 }).catch(() => false)) {
        await el.click();
        clicked = true;
        ctx.log('clicked:', sel);
        break;
      }
    }
    if (!clicked) {
      ctx.log('no create-listing CTA found, navigating directly');
      await page.goto(BASE + '/dashboard/listings/new', { waitUntil: 'domcontentloaded', timeout: 15000 });
    }
    await page.waitForTimeout(1800);
    await snapshot('listing-form');
    await screenshot('listing-form-step1', true);
  });

  await step('inspect-import-methods', async () => {
    // The wizard should offer 4 methods: Manuel / Duplication / PDF / URL
    const buttons = await page.locator('button, [role="button"]').allInnerTexts().catch(() => []);
    ctx.log('buttons on form:', buttons.filter(b => b.length < 60).slice(0, 30));
    await screenshot('import-methods');
  });

  await step('select-manual-import', async () => {
    // Choose "Manuel" (or whatever first card is)
    const candidates = [
      'button:has-text("Manuel")', 'button:has-text("Saisie manuelle")',
      '[data-method="manual"]', 'button:has-text("Manuelle")',
    ];
    let picked = false;
    for (const sel of candidates) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 800 }).catch(() => false)) {
        await el.click();
        picked = true;
        ctx.log('picked manual:', sel);
        break;
      }
    }
    await page.waitForTimeout(1200);
    await screenshot('manual-form-open', true);
  });

  await step('select-transaction-sale', async () => {
    // The wizard should ask sale vs rent. Pick "Vente"
    const candidates = ['button:has-text("Vente")', 'button:has-text("Vendre")', '[data-transaction="sale"]', 'label:has-text("Vente")'];
    let picked = false;
    for (const sel of candidates) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 800 }).catch(() => false)) {
        await el.click();
        picked = true;
        ctx.log('picked sale:', sel);
        break;
      }
    }
    await page.waitForTimeout(600);
    await screenshot('transaction-sale-picked');
  });

  await step('fill-listing-form', async () => {
    // Try to find input fields and fill them — apartment 4.5p 120m² CHF 1'650'000
    // Type
    const typeApart = page.locator('button:has-text("Appartement"), [data-type="apartment"], label:has-text("Appartement")').first();
    if (await typeApart.isVisible({ timeout: 800 }).catch(() => false)) await typeApart.click();
    // Title
    const titleInput = page.locator('input[name="title"], input[placeholder*="Titre" i], input[placeholder*="title" i]').first();
    if (await titleInput.isVisible({ timeout: 600 }).catch(() => false)) await titleInput.fill('TEST_audit Bel appartement Eaux-Vives');
    // Price
    const priceInput = page.locator('input[name="price"], input[type="number"]').first();
    if (await priceInput.isVisible({ timeout: 600 }).catch(() => false)) await priceInput.fill('1650000');
    // Surface
    const surfaceInput = page.locator('input[name="surface_m2"], input[name="surface"], input[placeholder*="surface" i], input[placeholder*="m²"]').first();
    if (await surfaceInput.isVisible({ timeout: 600 }).catch(() => false)) await surfaceInput.fill('120');
    // Rooms
    const roomsInput = page.locator('input[name="rooms"], input[placeholder*="pièces" i], input[placeholder*="rooms" i]').first();
    if (await roomsInput.isVisible({ timeout: 600 }).catch(() => false)) await roomsInput.fill('4.5');
    // Address
    const addrInput = page.locator('input[name="address"], input[placeholder*="adresse" i], input[placeholder*="address" i]').first();
    if (await addrInput.isVisible({ timeout: 600 }).catch(() => false)) await addrInput.fill('Rue du Stand 12');
    // City
    const cityInput = page.locator('input[name="city"], input[placeholder*="ville" i], input[placeholder*="city" i]').first();
    if (await cityInput.isVisible({ timeout: 600 }).catch(() => false)) await cityInput.fill('Genève');
    // Postal
    const npaInput = page.locator('input[name="postal_code"], input[name="npa"], input[placeholder*="NPA" i], input[placeholder*="postal" i]').first();
    if (await npaInput.isVisible({ timeout: 600 }).catch(() => false)) await npaInput.fill('1204');
    // Year built
    const yearInput = page.locator('input[name="year_built"], input[placeholder*="année" i]').first();
    if (await yearInput.isVisible({ timeout: 600 }).catch(() => false)) await yearInput.fill('2010');
    // Description
    const descArea = page.locator('textarea[name="description"], textarea[placeholder*="description" i]').first();
    if (await descArea.isVisible({ timeout: 600 }).catch(() => false))
      await descArea.fill('TEST_audit — Magnifique 4.5 pièces lumineux au 3e étage avec balcon. Cuisine ouverte rénovée, parquet d\'origine, proche commodités. Vue dégagée sur cour intérieure.');
    await page.waitForTimeout(500);
    await screenshot('form-filled-step1', true);
  });

  await step('explore-form-steps', async () => {
    // Try Suivant / Continuer to reach later steps without submitting
    for (let i = 0; i < 3; i++) {
      const next = page.locator('button:has-text("Suivant"), button:has-text("Continuer"), button:has-text("Étape suivante")').first();
      if (await next.isVisible({ timeout: 800 }).catch(() => false)) {
        await next.click();
        await page.waitForTimeout(800);
        await screenshot(`form-step-${i + 2}`, true);
      } else {
        ctx.log(`no Suivant button at iteration ${i}`);
        break;
      }
    }
  });

  await step('verify-no-publish-clicked', async () => {
    // Just take a final screenshot before we leave
    await screenshot('form-final-not-published', true);
    const publishBtn = await page.locator('button:has-text("Publier")').count().catch(() => 0);
    ctx.log('Publier button count visible:', publishBtn, '(NOT clicked)');
  });

  await step('goto-kyc', async () => {
    await page.goto(BASE + '/dashboard/kyc', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);
    await snapshot('kyc');
    await screenshot('kyc-list', true);
  });

  await step('goto-messages', async () => {
    await page.goto(BASE + '/dashboard/messages', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);
    await snapshot('messages');
    await screenshot('messages', true);
  });

  await step('goto-calendar', async () => {
    await page.goto(BASE + '/dashboard/calendar', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);
    await snapshot('calendar');
    await screenshot('calendar', true);
  });

  await step('goto-automation', async () => {
    await page.goto(BASE + '/dashboard/automation', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);
    await snapshot('automation');
    await screenshot('automation', true);
  });

  await step('goto-documents', async () => {
    await page.goto(BASE + '/dashboard/documents', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);
    await snapshot('documents');
    await screenshot('documents', true);
  });

  await step('try-megga-ai-copilot', async () => {
    // Look for the Sparkles floating button
    const sparkles = page.locator('button[aria-label*="copilot" i], button[aria-label*="MEGGA" i], button:has(svg.lucide-sparkles), [data-copilot-button]').first();
    if (await sparkles.isVisible({ timeout: 800 }).catch(() => false)) {
      await sparkles.click();
      await page.waitForTimeout(800);
      await screenshot('copilot-open', true);
      await page.keyboard.press('Escape').catch(() => {});
    } else {
      ctx.log('no copilot floating button found');
      await screenshot('no-copilot');
    }
  });

  await step('goto-settings-profile', async () => {
    await page.goto(BASE + '/dashboard/settings', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);
    await snapshot('settings');
    await screenshot('settings-profile', true);
  });

  await step('try-language-switch', async () => {
    // Find FR/DE/EN/IT pills
    const langPills = ['button:has-text("EN")', 'button:has-text("DE")', 'button:has-text("IT")'];
    for (const sel of langPills) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 600 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(700);
        const label = sel.match(/"(\w+)"/)?.[1] || 'lang';
        await screenshot(`lang-switched-${label}`);
        ctx.log('switched to', label);
        break; // do one
      }
    }
    // Switch back to FR
    const fr = page.locator('button:has-text("FR")').first();
    if (await fr.isVisible({ timeout: 500 }).catch(() => false)) await fr.click();
    await page.waitForTimeout(500);
  });

  await step('try-theme-toggle', async () => {
    const toggles = [
      'button[aria-label*="theme" i]', 'button[aria-label*="dark" i]', 'button[aria-label*="thème" i]',
      'button:has(svg.lucide-moon)', 'button:has(svg.lucide-sun)',
    ];
    for (const sel of toggles) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(500);
        await screenshot('theme-toggled', true);
        ctx.log('theme toggle clicked:', sel);
        break;
      }
    }
  });

  await step('back-to-dashboard', async () => {
    await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);
    await screenshot('final-dashboard', true);
  });

  // Print last few console errors
  const errs = await ctx.getConsoleErrors();
  ctx.log(`TOTAL console errors: ${errs.length}`);
  for (const e of errs.slice(-5)) ctx.log(' • ', e.text.slice(0, 180));
});
