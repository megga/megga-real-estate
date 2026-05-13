// Calcule un score de fidélité pixel-par-pixel pour chaque section
// entre Figma (référence) et /about (implementation).
//
// Méthodologie :
// 1. Charge figma-full.png (1440x3510) et about-page.png (1440x≈3554)
// 2. Pour chaque section (y_start → y_end), crop les 2 images sur le
//    repère Figma + le repère impl correspondant (avec offset ajusté)
// 3. Resize au plus petit format commun (les hauteurs peuvent différer
//    légèrement à cause du gap-47 ou du footer)
// 4. pixelmatch avec threshold 0.1 (assez tolérant pour anti-aliasing
//    et différences d'images sans masquer les vraies divergences)
// 5. Score = (totalPixels - mismatchPixels) / totalPixels * 100

import { promises as fs } from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { chromium } from 'playwright';

const FIGMA = '/tmp/figma-full.png';
const IMPL = '/tmp/about-page.png';

// Sections sur le repère Figma 1440x3510.
// Pour /about (1440x3554) on applique l'offset car la page est un peu
// plus grande (+44px due au padding du PostProperty/Footer wrappers).
const SECTIONS = [
  { id: 'nav',       fy1:    0, fy2:  112,  iy1:    0, iy2:  112,  label: 'Nav (Header Wrapper, h=112)' },
  { id: 'hero',      fy1:    0, fy2:  588,  iy1:    0, iy2:  588,  label: 'Hero + Browser (y=0→588)' },
  { id: 'grid_r1',   fy1:  587, fy2: 1171,  iy1:  587, iy2: 1171,  label: 'Grid row 1 (cards 1-2)' },
  { id: 'grid_r2',   fy1: 1171, fy2: 1755,  iy1: 1171, iy2: 1755,  label: 'Grid row 2 (cards 3-4)' },
  { id: 'grid_r3',   fy1: 1755, fy2: 2335,  iy1: 1755, iy2: 2335,  label: 'Grid row 3 (cards 5-6)' },
  { id: 'post_prop', fy1: 2510, fy2: 2700,  iy1: 2510, iy2: 2700,  label: 'Post property cards (incl gap-24 to footer)' },
  { id: 'footer',    fy1: 2700, fy2: 3510,  iy1: 2700, iy2: 3507,  label: 'Footer dark + logo + cols' },
];

async function loadPng(path) {
  const buffer = await fs.readFile(path);
  return PNG.sync.read(buffer);
}

function cropPng(png, x, y, w, h) {
  const out = new PNG({ width: w, height: h });
  // Copier pixel par pixel (4 bytes / pixel rgba)
  for (let row = 0; row < h; row++) {
    const srcStart = ((y + row) * png.width + x) * 4;
    const dstStart = (row * w) * 4;
    png.data.copy(out.data, dstStart, srcStart, srcStart + w * 4);
  }
  return out;
}

function resizePngTo(png, targetW, targetH) {
  // Resize naïf (nearest neighbor) — suffisant pour pixelmatch sur sections
  if (png.width === targetW && png.height === targetH) return png;
  const out = new PNG({ width: targetW, height: targetH });
  const xRatio = png.width / targetW;
  const yRatio = png.height / targetH;
  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const srcX = Math.floor(x * xRatio);
      const srcY = Math.floor(y * yRatio);
      const srcIdx = (srcY * png.width + srcX) * 4;
      const dstIdx = (y * targetW + x) * 4;
      out.data[dstIdx]     = png.data[srcIdx];
      out.data[dstIdx + 1] = png.data[srcIdx + 1];
      out.data[dstIdx + 2] = png.data[srcIdx + 2];
      out.data[dstIdx + 3] = png.data[srcIdx + 3];
    }
  }
  return out;
}

async function compareSection(figmaPng, implPng, s, threshold = 0.1, suffix = '') {
  // Clamp Y aux dimensions réelles (les hauteurs Figma/impl peuvent diverger)
  const fy2 = Math.min(s.fy2, figmaPng.height);
  const iy2 = Math.min(s.iy2, implPng.height);
  const figmaCrop = cropPng(figmaPng, 0, s.fy1, figmaPng.width, fy2 - s.fy1);
  const implCrop  = cropPng(implPng,  0, s.iy1, implPng.width,  iy2 - s.iy1);
  const w = Math.min(figmaCrop.width, implCrop.width);
  const h = Math.min(figmaCrop.height, implCrop.height);
  const figmaResized = resizePngTo(figmaCrop, w, h);
  const implResized  = resizePngTo(implCrop, w, h);
  const diff = new PNG({ width: w, height: h });
  const mismatch = pixelmatch(
    figmaResized.data,
    implResized.data,
    diff.data,
    w,
    h,
    { threshold, alpha: 0.5, diffMask: false },
  );
  const total = w * h;
  const score = ((total - mismatch) / total) * 100;
  await fs.writeFile(`/tmp/diff-${s.id}${suffix}.png`, PNG.sync.write(diff));
  return { id: s.id, label: s.label, w, h, total, mismatch, score };
}

console.log('Loading Figma reference...');
const figmaPng = await loadPng(FIGMA);
console.log(`  ${figmaPng.width}x${figmaPng.height}`);
console.log('Loading implementation...');
const implPng = await loadPng(IMPL);
console.log(`  ${implPng.width}x${implPng.height}`);

// Run comparison at 3 thresholds : strict (0.05), default (0.1), perceptual (0.3)
const THRESHOLDS = [
  { label: 'strict (0.05) — toute différence pixel-level', t: 0.05, sfx: '-strict' },
  { label: 'default (0.1) — équilibré',                    t: 0.1,  sfx: '' },
  { label: 'perceptual (0.3) — œil humain',                t: 0.3,  sfx: '-perc' },
];

const allResults = {};
for (const { label, t, sfx } of THRESHOLDS) {
  console.log(`\n=== Threshold ${t} (${label}) ===`);
  console.log('| Section | Score |');
  console.log('|---|---|');
  const results = [];
  let totalAll = 0;
  let mismatchAll = 0;
  for (const s of SECTIONS) {
    const r = await compareSection(figmaPng, implPng, s, t, sfx);
    totalAll += r.total;
    mismatchAll += r.mismatch;
    results.push(r);
    console.log(`| ${r.id.padEnd(10)} | **${r.score.toFixed(2)}%** |`);
  }
  const overall = ((totalAll - mismatchAll) / totalAll) * 100;
  console.log(`| **OVERALL** | **${overall.toFixed(2)}%** |`);
  allResults[t] = { results, overall, totalAll, mismatchAll };
}

await fs.writeFile('/tmp/fidelity-report.json', JSON.stringify(allResults, null, 2));
console.log('\nSaved /tmp/fidelity-report.json and /tmp/diff-*.png');
