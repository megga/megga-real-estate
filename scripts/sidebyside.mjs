import { promises as fs } from 'node:fs';
import { chromium } from 'playwright';

const html = `<!doctype html><html><head><style>
  body { margin: 0; padding: 0; background: #1c1c1c; }
  .row { display: flex; gap: 16px; padding: 16px; }
  .col { flex: 1; display: flex; flex-direction: column; gap: 8px; }
  .col h2 { color: white; font-family: sans-serif; margin: 0; font-weight: 500; }
  img { width: 100%; height: auto; display: block; border: 1px solid #333; }
</style></head><body>
  <div class="row">
    <div class="col">
      <h2>Figma reference (1440x3510)</h2>
      <img src="file:///tmp/about-figma.png" />
    </div>
    <div class="col">
      <h2>Implementation /about (1440x3501)</h2>
      <img src="file:///tmp/about-page.png" />
    </div>
  </div>
</body></html>`;
await fs.writeFile('/tmp/sidebyside.html', html);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1800, height: 1200 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
await page.goto('file:///tmp/sidebyside.html');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: '/tmp/sidebyside.png', fullPage: true });
await browser.close();
console.log('saved /tmp/sidebyside.png');
