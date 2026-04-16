// Admin persona simulation: "MEGGA Platform Operator" — super_admin daily ops
// Run: BASE_URL=http://localhost:5175 node scripts/audit-admin.mjs

import { runPersona } from './audit-helper.mjs';

const BASE = 'http://localhost:5175';
const findings = {};

await runPersona('admin', async (ctx) => {
  const { page } = ctx;

  async function captureH1() {
    return await page.locator('h1').first().textContent({ timeout: 2000 }).catch(() => null);
  }

  async function emptyCheck() {
    const txt = await page.locator('body').innerText().catch(() => '');
    const isEmpty = /aucun|aucune|empty|no data|0 résultat|aucune donnée/i.test(txt);
    const isMock = /mock|données mockées|placeholder|todo|coming soon|bientôt/i.test(txt);
    return { isEmpty, isMock, len: txt.length };
  }

  async function gotoAdmin(slug, label) {
    const url = `${BASE}/dashboard/admin${slug ? '/' + slug : ''}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await ctx.unlockGate();
    await page.waitForTimeout(1800);
    await ctx.screenshot(label);
    const h1 = await captureH1();
    const ec = await emptyCheck();
    findings[label] = { h1: h1?.trim().slice(0, 120), ...ec, url: page.url() };
    ctx.log(`${label}: h1="${findings[label].h1}" empty=${ec.isEmpty} mock=${ec.isMock}`);
  }

  // ---- 1. Land on home (gate) ----
  await ctx.step('home', async () => {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await ctx.unlockGate();
    await page.waitForTimeout(800);
    await ctx.screenshot('home');
  });

  // ---- 2. Land on /dashboard (auto super_admin via DEV_BYPASS) ----
  await ctx.step('dashboard-redirect', async () => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await ctx.unlockGate();
    await page.waitForTimeout(2000);
    await ctx.screenshot('dashboard');
    findings.dashboardUrl = page.url();
    findings.dashboardH1 = (await captureH1())?.trim();
    ctx.log('dashboard url:', findings.dashboardUrl, 'h1:', findings.dashboardH1);
  });

  // ---- 3-15. Visit all 13 admin pages ----
  await ctx.step('admin-dashboard', async () => { await gotoAdmin('', 'admin-dashboard'); });
  await ctx.step('admin-agencies', async () => { await gotoAdmin('agencies', 'admin-agencies'); });

  // pick first agency for detail
  await ctx.step('admin-agency-detail', async () => {
    const link = page.locator('a[href*="/dashboard/admin/agencies/"]').first();
    let id = null;
    if (await link.count()) {
      const href = await link.getAttribute('href').catch(() => null);
      if (href && href.match(/agencies\/([^/?]+)/)) id = href.match(/agencies\/([^/?]+)/)[1];
    }
    if (id) {
      await gotoAdmin(`agencies/${id}`, 'admin-agency-detail');
      // try to switch tabs
      const tabs = await page.locator('[role="tab"], button[class*="tab"]').allInnerTexts().catch(() => []);
      findings.agencyTabs = tabs.slice(0, 10);
    } else {
      findings['admin-agency-detail'] = { skipped: true, reason: 'no agency in list' };
      ctx.log('no agency to open');
    }
  });

  await ctx.step('admin-users', async () => {
    await gotoAdmin('users', 'admin-users');
    // try to open drawer on first user row
    const userRow = page.locator('tbody tr, [role="row"]').first();
    if (await userRow.count()) {
      await userRow.click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(700);
      await ctx.screenshot('admin-users-drawer');
    }
  });
  await ctx.step('admin-monitoring', async () => { await gotoAdmin('monitoring', 'admin-monitoring'); });
  await ctx.step('admin-marketplace', async () => { await gotoAdmin('marketplace', 'admin-marketplace'); });
  await ctx.step('admin-compliance', async () => { await gotoAdmin('compliance', 'admin-compliance'); });
  await ctx.step('admin-support', async () => { await gotoAdmin('support', 'admin-support'); });
  await ctx.step('admin-live', async () => { await gotoAdmin('live', 'admin-live'); });
  await ctx.step('admin-changelog', async () => { await gotoAdmin('changelog', 'admin-changelog'); });
  await ctx.step('admin-feature-flags', async () => { await gotoAdmin('feature-flags', 'admin-feature-flags'); });
  await ctx.step('admin-plans', async () => { await gotoAdmin('plans', 'admin-plans'); });
  await ctx.step('admin-security', async () => { await gotoAdmin('security', 'admin-security'); });
  await ctx.step('admin-nps', async () => { await gotoAdmin('nps', 'admin-nps'); });

  // ---- 16. Sidebar + nav check ----
  await ctx.step('sidebar-nav', async () => {
    await page.goto(`${BASE}/dashboard/admin`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await ctx.unlockGate();
    await page.waitForTimeout(1000);
    const navItems = await page.locator('nav a, aside a').allInnerTexts().catch(() => []);
    findings.sidebarItems = [...new Set(navItems.map(t => t.trim()).filter(Boolean))].slice(0, 40);
    await ctx.screenshot('sidebar');
  });

  // ---- 17. Try language switch (FR -> DE -> EN -> IT) ----
  await ctx.step('lang-switch', async () => {
    // Go to settings to switch lang or try localStorage
    for (const lang of ['de', 'en', 'it', 'fr']) {
      await page.evaluate((l) => {
        try { localStorage.setItem('megga-language', l); } catch {}
      }, lang);
      await page.goto(`${BASE}/dashboard/admin`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await ctx.unlockGate();
      await page.waitForTimeout(1200);
      await ctx.screenshot(`lang-${lang}`);
      const h1 = (await captureH1())?.trim();
      findings[`lang_${lang}_h1`] = h1;
      ctx.log(`lang ${lang} h1:`, h1);
    }
  });

  // dump findings into report via console
  ctx.log('FINDINGS:', JSON.stringify(findings, null, 2));
});
