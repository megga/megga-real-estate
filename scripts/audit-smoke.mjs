// Smoke test: verifies dev server + Playwright + PasswordGate bypass work end-to-end.
import { runPersona, BASE_URL } from './audit-helper.mjs';

await runPersona('smoke', async (ctx) => {
  const { page, step, screenshot } = ctx;

  await step('home', async () => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await ctx.unlockGate();
    await page.waitForTimeout(500);
    await screenshot('home');
    const title = await page.title();
    ctx.log('title:', title);
  });

  await step('acheter', async () => {
    await page.goto(`${BASE_URL}/acheter`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await ctx.unlockGate();
    await page.waitForTimeout(1000);
    await screenshot('acheter');
  });

  await step('louer', async () => {
    await page.goto(`${BASE_URL}/louer`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await ctx.unlockGate();
    await page.waitForTimeout(1000);
    await screenshot('louer');
  });
});
