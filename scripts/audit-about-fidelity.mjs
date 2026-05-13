// Audit pixel par section de la page /about contre la maquette Figma.
// Découpe Figma (1440x3510) et /about (1440x≈3501) en tranches verticales,
// pose les paires côte à côte et écrit /tmp/audit-{section}.png.
//
// Sections (y_start, y_end) sur le repère Figma 1440x3510 :
//   - nav        :    0 → 112    (Header Wrapper)
//   - hero       :   24 → 540    (Hero Section + Browser overlap -48 bottom)
//   - browser    :  464 → 564    (Browser bar)
//   - grid_row1  :  651 → 1171   (cards 1 & 2)
//   - grid_row2  : 1219 → 1739   (cards 3 & 4)
//   - grid_row3  : 1787 → 2307   (cards 5 & 6)
//   - post_prop  : 2467 → 2627   (Post a free/paid property)
//   - footer     : 2627 → 3510   (Footer dark)

import { promises as fs } from 'node:fs';
import { chromium } from 'playwright';

const FIGMA = '/tmp/figma-full.png';
const IMPL  = '/tmp/about-page.png';

const SECTIONS = [
  { id: 'nav',       y1:    0, y2:  150, label: 'Nav header (top 150px)' },
  { id: 'hero',      y1:   24, y2:  600, label: 'Hero Section + Browser overlap' },
  { id: 'grid_row1', y1:  587, y2: 1175, label: 'Grid row 1 (cards Luxury Loft / Home LA Heart)' },
  { id: 'grid_row2', y1: 1175, y2: 1755, label: 'Grid row 2 (cards Modern Loft / Executive Office)' },
  { id: 'grid_row3', y1: 1755, y2: 2335, label: 'Grid row 3 (cards Apartment / Home Downtown)' },
  { id: 'post_prop', y1: 2335, y2: 2575, label: 'Post a property cards' },
  { id: 'footer',    y1: 2575, y2: 3510, label: 'Dark footer' },
];

// Génère un HTML qui empile chaque tranche figma / impl côte à côte.
async function makeAuditHtml() {
  let body = '';
  for (const s of SECTIONS) {
    const h = s.y2 - s.y1;
    body += `
    <section>
      <h2>${s.label} — y ${s.y1}→${s.y2} (h=${h})</h2>
      <div class="row">
        <div class="col">
          <div class="label">FIGMA</div>
          <div class="crop" style="height:${h}px;">
            <img src="file://${FIGMA}" style="margin-top:-${s.y1}px;">
          </div>
        </div>
        <div class="col">
          <div class="label">IMPLEMENTATION</div>
          <div class="crop" style="height:${h}px;">
            <img src="file://${IMPL}" style="margin-top:-${s.y1}px;">
          </div>
        </div>
      </div>
    </section>`;
  }
  const html = `<!doctype html><html><head><style>
    body { margin: 0; padding: 0; background: #14161c; color: #fff; font-family: sans-serif; }
    section { padding: 12px; border-bottom: 2px solid #383838; }
    section h2 { margin: 0 0 8px; font-size: 14px; font-weight: 500; color: #a4a6b0; }
    .row { display: flex; gap: 12px; }
    .col { flex: 1; min-width: 0; }
    .label { font-size: 11px; font-weight: 600; color: #14161c; background: #ffd700; padding: 4px 8px; display: inline-block; margin-bottom: 4px; }
    .crop { width: 100%; overflow: hidden; position: relative; background: #fafafb; border: 1px solid #383838; }
    .crop img { width: 100%; display: block; }
  </style></head><body>${body}</body></html>`;
  await fs.writeFile('/tmp/audit.html', html);
}

await makeAuditHtml();

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 2900, height: 1200 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
await page.goto('file:///tmp/audit.html');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(800);

// Une image par section pour des comparaisons ciblées.
for (const s of SECTIONS) {
  const el = await page.$(`section:nth-of-type(${SECTIONS.indexOf(s) + 1})`);
  if (el) {
    await el.screenshot({ path: `/tmp/audit-${s.id}.png` });
    console.log(`saved /tmp/audit-${s.id}.png`);
  }
}

// Et un fichier global pour vue d'ensemble.
await page.screenshot({ path: '/tmp/audit-full.png', fullPage: true });
console.log('saved /tmp/audit-full.png');

await browser.close();
