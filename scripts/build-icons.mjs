// Builds every shipped icon from design/app-icon.svg.
//   npm run icons        (needs the optional dev dependency "sharp")
//
// Output in public/icons/:
//   icon.svg                  rounded-tile icon ("any" purpose, also used as the favicon)
//   icon-maskable.svg         full-bleed icon with the artwork pulled into the maskable safe zone
//   icon-192.png / -512.png   rounded-tile PNGs
//   icon-maskable-192.png / -512.png
//   apple-touch-icon.png      180 px full-bleed (iOS rounds the corners itself)
//   favicon-32.png
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); } catch {
  console.error('sharp is not installed. Run "npm install" first.');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public', 'icons');
const master = await readFile(path.join(root, 'design', 'app-icon.svg'), 'utf8');

const open = master.match(/<svg[^>]*>/)[0];
const inner = master.slice(master.indexOf(open) + open.length, master.lastIndexOf('</svg>'));

// Rounded tile for purpose "any": the whole design clipped to a squircle-ish rounded square.
const anySvg = `${open}
  <defs><clipPath id="icon-tile"><rect width="1024" height="1024" rx="228"/></clipPath></defs>
  <g id="icon-tile-content" clip-path="url(#icon-tile)">${inner}</g>
</svg>
`;

// Maskable: keep the full-bleed background, shrink the artwork towards the centre so it
// stays inside the 80% safe circle that launchers may crop to.
const maskSvg = master.replace('<g id="artwork">', '<g id="artwork" transform="translate(512 512) scale(.84) translate(-512 -512)">');

await writeFile(path.join(out, 'icon.svg'), anySvg);
await writeFile(path.join(out, 'icon-maskable.svg'), maskSvg);

const render = (svg, size, file) =>
  sharp(Buffer.from(svg), { density: Math.max(72, Math.ceil((size / 1024) * 72 * 4)) })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(path.join(out, file));

await Promise.all([
  render(anySvg, 192, 'icon-192.png'),
  render(anySvg, 512, 'icon-512.png'),
  render(maskSvg, 192, 'icon-maskable-192.png'),
  render(maskSvg, 512, 'icon-maskable-512.png'),
  render(master, 180, 'apple-touch-icon.png'),
  render(anySvg, 32, 'favicon-32.png')
]);
console.log('Icons written to public/icons');
