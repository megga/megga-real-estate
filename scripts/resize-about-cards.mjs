// Compress + resize les 6 images Figma téléchargées (8-10MB chacune) à
// une taille adaptée aux cards Property X V2 (588×364 affichées) à 2x retina
// → 1176×728. JPEG quality 82 = ~150-300KB par image.

import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const DIR = '/home/user/megga-real-estate/public/about-cards';
const files = (await fs.readdir(DIR)).filter(f => f.endsWith('.jpg'));

for (const f of files) {
  const p = path.join(DIR, f);
  const stat = await fs.stat(p);
  // Lire l'image et l'analyser
  const input = await sharp(p);
  const meta = await input.metadata();

  // Resize en gardant le ratio, cover crop pour 588×364 (ratio 1.615)
  const buf = await sharp(p)
    .resize({ width: 1176, height: 728, fit: 'cover', position: 'center' })
    .jpeg({ quality: 82, progressive: true })
    .toBuffer();
  await fs.writeFile(p, buf);
  const newStat = await fs.stat(p);
  console.log(`${f}: ${(stat.size/1024).toFixed(0)}KB (${meta.width}x${meta.height}) → ${(newStat.size/1024).toFixed(0)}KB (1176x728)`);
}
