// Persona: Carlo Rossi — Swiss owner in Lausanne wanting to sell his 4-room apartment.
// Walks through the public seller funnel + portail vendeur in dev mode.
// Stops one step before any DB write or email trigger.

import { runPersona } from './audit-helper.mjs'

await runPersona('seller', async (ctx) => {
  const { page } = ctx

  // ── 1. Land on home, unlock password gate ──────────────────────────
  await ctx.step('home-land', async () => {
    await page.goto(ctx.base + '/', { waitUntil: 'networkidle', timeout: 20000 })
    await ctx.unlockGate()
    await page.waitForTimeout(800)
    await ctx.screenshot('home')
  })

  // ── 2. Click "Vendre" link in navbar ───────────────────────────────
  await ctx.step('home-find-vendre-cta', async () => {
    const links = await page.locator('a[href="/vendre"], a[href="/estimations"]').all()
    ctx.log(`found ${links.length} sell-related links`)
    for (let i = 0; i < Math.min(links.length, 5); i++) {
      const txt = (await links[i].textContent())?.trim()
      const href = await links[i].getAttribute('href')
      ctx.log(`  link[${i}]: "${txt}" → ${href}`)
    }
    await ctx.screenshot('home-cta-area')
  })

  // ── 3. Navigate to /vendre wizard ─────────────────────────────────
  await ctx.step('vendre-page', async () => {
    await page.goto(ctx.base + '/vendre', { waitUntil: 'networkidle', timeout: 20000 })
    await ctx.unlockGate()
    await page.waitForTimeout(1200)
    // capture button labels to verify i18n
    const buttons = await page.locator('button').allTextContents()
    ctx.log('buttons sample:', buttons.slice(0, 8).map((b) => b.trim().slice(0, 40)))
    await ctx.screenshot('vendre-hero', true)
  })

  // ── 4. Start wizard — pick property type "apartment" ──────────────
  await ctx.step('vendre-start-wizard', async () => {
    // Try clicking on "Appartement" type tile if visible
    const apt = page.locator('button:has-text("Appartement"), button:has-text("Apartment")').first()
    if (await apt.isVisible({ timeout: 3000 }).catch(() => false)) {
      await apt.click()
      ctx.log('clicked Appartement tile')
    } else {
      // Fallback — click the main CTA "Estimer mon bien" or similar
      const cta = page.locator('button:has-text("Estimer"), button:has-text("Commencer"), a:has-text("Estimer")').first()
      if (await cta.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cta.click()
        ctx.log('clicked main CTA')
      }
    }
    await page.waitForTimeout(1000)
    await ctx.screenshot('wizard-step1', true)
  })

  // ── 5. Fill address (Lausanne) — manual input fallback ────────────
  await ctx.step('vendre-fill-address', async () => {
    const addressInput = page.locator('input[placeholder*="adresse" i], input[placeholder*="address" i], input[type="search"]').first()
    if (await addressInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addressInput.fill('Avenue de la Gare 12, 1003 Lausanne')
      await page.waitForTimeout(1500)
      // try selecting first geocoder suggestion if present
      const suggestion = page.locator('[role="option"], .mapboxgl-ctrl-geocoder--suggestion, button:has-text("Lausanne")').first()
      if (await suggestion.isVisible({ timeout: 2000 }).catch(() => false)) {
        await suggestion.click()
        ctx.log('selected first address suggestion')
      }
    } else {
      ctx.log('no address input visible at this stage')
    }
    await page.waitForTimeout(800)
    await ctx.screenshot('wizard-address-filled', true)
  })

  // ── 6. Continue / next step — try to advance ──────────────────────
  await ctx.step('vendre-next-step', async () => {
    const nextBtn = page.locator('button:has-text("Continuer"), button:has-text("Suivant"), button:has-text("Next")').first()
    if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nextBtn.click()
      ctx.log('clicked Continuer/Suivant')
    } else {
      ctx.log('no next button — wizard may auto-advance')
    }
    await page.waitForTimeout(1200)
    await ctx.screenshot('wizard-step2', true)
  })

  // ── 7. Try to fill rooms = 4 (pills) ──────────────────────────────
  await ctx.step('vendre-fill-rooms', async () => {
    const pill4 = page.locator('button:has-text("4")').filter({ hasText: /^4$/ }).first()
    if (await pill4.isVisible({ timeout: 2000 }).catch(() => false)) {
      await pill4.click()
      ctx.log('clicked 4 rooms pill')
    }
    await page.waitForTimeout(600)
    await ctx.screenshot('wizard-rooms', true)
  })

  // ── 8. Fill surface (110m²) if input shown ────────────────────────
  await ctx.step('vendre-fill-surface', async () => {
    const surfInput = page.locator('input[type="number"], input[placeholder*="surface" i], input[placeholder*="m²" i]').first()
    if (await surfInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await surfInput.fill('110')
      ctx.log('filled surface 110')
    }
    await page.waitForTimeout(400)
    await ctx.screenshot('wizard-surface', true)
  })

  // ── 9. Capture wizard form labels for i18n verification ───────────
  await ctx.step('vendre-capture-labels', async () => {
    const labels = await page.locator('label, h1, h2, h3').allTextContents()
    const sample = labels.map((l) => l.trim()).filter(Boolean).slice(0, 15)
    ctx.log('labels sample:', sample)
    await ctx.screenshot('wizard-labels', true)
  })

  // ── 10. Stop before final submit — go to /estimations now ─────────
  await ctx.step('estimations-page', async () => {
    await page.goto(ctx.base + '/estimations', { waitUntil: 'networkidle', timeout: 20000 })
    await ctx.unlockGate()
    await page.waitForTimeout(1000)
    const heroH1 = await page.locator('h1').first().textContent().catch(() => null)
    ctx.log('estimations h1:', heroH1?.slice(0, 80))
    await ctx.screenshot('estimations-hero', true)
  })

  // ── 11. /estimer → should redirect or render same as /estimations ─
  await ctx.step('estimer-alias', async () => {
    await page.goto(ctx.base + '/estimer', { waitUntil: 'networkidle', timeout: 20000 })
    await ctx.unlockGate()
    await page.waitForTimeout(800)
    ctx.log('final url:', page.url())
    await ctx.screenshot('estimer', true)
  })

  // ── 12. /publier — agent-facing publish landing ───────────────────
  await ctx.step('publier-page', async () => {
    await page.goto(ctx.base + '/publier', { waitUntil: 'networkidle', timeout: 20000 })
    await ctx.unlockGate()
    await page.waitForTimeout(800)
    const h1 = await page.locator('h1').first().textContent().catch(() => null)
    ctx.log('publier h1:', h1?.slice(0, 80))
    await ctx.screenshot('publier', true)
  })

  // ── 13. Seller portal /portail (dev access without token) ─────────
  await ctx.step('portail-dossier', async () => {
    await page.goto(ctx.base + '/portail', { waitUntil: 'networkidle', timeout: 20000 })
    await ctx.unlockGate()
    await page.waitForTimeout(1500)
    ctx.log('portail url:', page.url())
    const titles = await page.locator('h1, h2').allTextContents()
    ctx.log('portail titles:', titles.slice(0, 5).map((t) => t.trim().slice(0, 50)))
    await ctx.screenshot('portail-dossier', true)
  })

  // ── 14. Portail — Visites tab ─────────────────────────────────────
  await ctx.step('portail-visites', async () => {
    await page.goto(ctx.base + '/portail/visites', { waitUntil: 'networkidle', timeout: 15000 })
    await ctx.unlockGate()
    await page.waitForTimeout(1000)
    await ctx.screenshot('portail-visites', true)
  })

  // ── 15. Portail — Offres tab ──────────────────────────────────────
  await ctx.step('portail-offres', async () => {
    await page.goto(ctx.base + '/portail/offres', { waitUntil: 'networkidle', timeout: 15000 })
    await ctx.unlockGate()
    await page.waitForTimeout(1000)
    await ctx.screenshot('portail-offres', true)
  })

  // ── 16. Portail — Documents tab ───────────────────────────────────
  await ctx.step('portail-documents', async () => {
    await page.goto(ctx.base + '/portail/documents', { waitUntil: 'networkidle', timeout: 15000 })
    await ctx.unlockGate()
    await page.waitForTimeout(1000)
    await ctx.screenshot('portail-documents', true)
  })

  // ── 17. Portail — Messages tab ────────────────────────────────────
  await ctx.step('portail-messages', async () => {
    await page.goto(ctx.base + '/portail/messages', { waitUntil: 'networkidle', timeout: 15000 })
    await ctx.unlockGate()
    await page.waitForTimeout(1000)
    await ctx.screenshot('portail-messages', true)
  })

  // ── 18. Portail — Analyse tab + Profil tab ────────────────────────
  await ctx.step('portail-analyse', async () => {
    await page.goto(ctx.base + '/portail/analyse', { waitUntil: 'networkidle', timeout: 15000 })
    await ctx.unlockGate()
    await page.waitForTimeout(1200)
    await ctx.screenshot('portail-analyse', true)
  })

  await ctx.step('portail-profil', async () => {
    await page.goto(ctx.base + '/portail/profil', { waitUntil: 'networkidle', timeout: 15000 })
    await ctx.unlockGate()
    await page.waitForTimeout(1000)
    await ctx.screenshot('portail-profil', true)
  })

  // ── 19. Try dark mode toggle in portal ────────────────────────────
  await ctx.step('portail-dark-mode', async () => {
    const themeBtn = page.locator('button[aria-label*="dark" i], button[aria-label*="theme" i], button[title*="thème" i], button:has(svg.lucide-moon), button:has(svg.lucide-sun)').first()
    if (await themeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await themeBtn.click()
      await page.waitForTimeout(500)
      ctx.log('toggled dark/light mode')
      await ctx.screenshot('portail-dark', true)
    } else {
      ctx.log('no dark-mode toggle visible in portal')
    }
  })

  // ── 20. Language switcher — try EN / DE in portal ─────────────────
  await ctx.step('portail-lang-switch', async () => {
    // Open profile menu / language picker
    const langBtn = page.locator('button:has-text("FR"), button:has-text("EN"), button[aria-label*="lang" i]').first()
    if (await langBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await langBtn.click()
      await page.waitForTimeout(400)
      const enOpt = page.locator('button:has-text("English"), button:has-text("EN")').last()
      if (await enOpt.isVisible({ timeout: 1000 }).catch(() => false)) {
        await enOpt.click()
        await page.waitForTimeout(800)
        ctx.log('switched to EN')
      }
      await ctx.screenshot('portail-en', true)
    } else {
      ctx.log('no language switcher visible in portal')
    }
  })
})
