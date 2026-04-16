// Shared Playwright helper for persona simulation audits.
// Each persona script imports this and calls runPersona() with a sequence of steps.
//
// Usage:
//   node scripts/audit-helper.mjs --persona=buyer --base=http://localhost:5173
//
// Each persona script should export a default async function(ctx) where ctx = { page, log, step, screenshot, errors }.

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

export const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

/**
 * Run a persona simulation with consistent setup, console capture, screenshots, and JSON report.
 * @param {string} personaName - e.g. 'buyer', 'agent-sale'
 * @param {(ctx: PersonaCtx) => Promise<void>} runFn - the persona scenario
 * @param {object} options
 * @param {boolean} [options.devBypassAuth=false] - injects localStorage to bypass auth (NOT supported here, must be set via env var before vite start)
 * @param {string} [options.bypassRole] - role for DEV_BYPASS_AUTH if used
 */
export async function runPersona(personaName, runFn, options = {}) {
  const outDir = path.resolve(`docs/audits/2026-04-16-simulation/${personaName}`);
  const shotDir = path.join(outDir, 'screenshots');
  await fs.mkdir(shotDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'fr-CH',
    // Trust Supabase Pro HTTPS cert inside sandboxed environments (Docker,
    // CI, Cloudflare Workers, etc.) where the system CA bundle may not include
    // the issuer. Without this, every fetch to *.supabase.co fails with
    // ERR_CERT_AUTHORITY_INVALID and the audit captures 500+ spurious errors
    // (see audit bug C3). Safe here — these are test scripts, not prod code.
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // Capture console + page errors + failed requests
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const stepLog = [];
  let currentStep = 'init';

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({ step: currentStep, text: msg.text(), url: page.url() });
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push({ step: currentStep, message: err.message, stack: err.stack?.split('\n').slice(0, 3).join(' | ') });
  });
  page.on('requestfailed', (req) => {
    failedRequests.push({ step: currentStep, url: req.url(), method: req.method(), failure: req.failure()?.errorText });
  });

  let stepCounter = 0;

  const ctx = {
    page,
    base: BASE_URL,
    persona: personaName,
    async step(name, fn) {
      stepCounter++;
      currentStep = `${stepCounter.toString().padStart(2, '0')}-${name}`;
      const start = Date.now();
      const entry = { step: currentStep, name, start: new Date().toISOString(), ok: false };
      try {
        await fn();
        entry.ok = true;
        entry.durationMs = Date.now() - start;
        stepLog.push(entry);
        console.log(`  ✓ ${currentStep} (${entry.durationMs}ms)`);
      } catch (err) {
        entry.ok = false;
        entry.error = err.message;
        entry.durationMs = Date.now() - start;
        stepLog.push(entry);
        console.log(`  ✗ ${currentStep} — ${err.message}`);
        // try to capture state on error
        try { await page.screenshot({ path: path.join(shotDir, `${currentStep}-ERROR.png`), fullPage: false }); } catch {}
      }
    },
    async screenshot(label, fullPage = false) {
      const file = path.join(shotDir, `${currentStep}-${label}.png`);
      try {
        await page.screenshot({ path: file, fullPage });
        return file;
      } catch (err) {
        console.log(`  ! screenshot fail ${label}: ${err.message}`);
        return null;
      }
    },
    log: (...args) => console.log(`  [${currentStep}]`, ...args),
    async unlockGate() {
      // Bypass is set via VITE_PASSWORD_GATE_BYPASS=true in .env.local, but if not, type the password.
      const input = page.locator('input[type="password"]').first();
      if (await input.isVisible({ timeout: 1500 }).catch(() => false)) {
        await input.fill('gg');
        await page.locator('button:has-text("Accéder au site")').click();
        await page.waitForTimeout(400);
      }
    },
    async getConsoleErrors() { return consoleErrors.slice(); },
  };

  console.log(`\n=== Persona: ${personaName} ===`);
  const startedAt = new Date().toISOString();
  let crashErr = null;
  try {
    await runFn(ctx);
  } catch (err) {
    crashErr = err;
    console.log(`  !! CRASH: ${err.message}`);
  }
  const endedAt = new Date().toISOString();

  const report = {
    persona: personaName,
    startedAt,
    endedAt,
    base: BASE_URL,
    crashed: !!crashErr,
    crashError: crashErr?.message,
    stepCount: stepCounter,
    steps: stepLog,
    consoleErrors,
    pageErrors,
    failedRequests,
  };

  await fs.writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`  → report.json written (${stepLog.filter(s => s.ok).length}/${stepLog.length} ok, ${consoleErrors.length} console errors, ${pageErrors.length} page errors)`);

  await context.close();
  await browser.close();
  return report;
}
