import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'assets/brand/logo-source.png');

const targets = [
  { out: 'assets/images/icon.png', size: 1024 },
  { out: 'assets/images/splash-icon.png', size: 800 },
  { out: 'assets/images/favicon.png', size: 48 },
];

for (const { out, size } of targets) {
  const outPath = path.join(root, out);
  await sharp(source)
    .resize(size, size, { fit: 'contain', background: '#ffffff' })
    .png()
    .toFile(outPath);
  console.log(`Wrote ${out} (${size}x${size})`);
}
