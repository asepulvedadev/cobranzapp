/** Deterministic, font-independent geometric brand masters and transparent exports. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const colors = { charcoal: '#171717', cream: '#FFEDD5', yellow: '#FBBF24' };
const variants = {
  primary: { ink: colors.charcoal, node: colors.yellow },
  reversed: { ink: colors.cream, node: colors.yellow },
  charcoal: { ink: colors.charcoal, node: colors.charcoal },
  white: { ink: '#FFFFFF', node: '#FFFFFF' },
};

// The C traces a collection loop; the detached rounded square is a collection stop.
function symbol({ ink, node }) {
  return `<path d="M208 84Q208 48 172 48H84Q48 48 48 84V172Q48 208 84 208H172Q208 208 208 172" fill="none" stroke="${ink}" stroke-width="32" stroke-linecap="round"/><rect x="196" y="116" width="24" height="24" rx="6" fill="${node}"/>`;
}

// Bold geometric lowercase lettering with circular bowls and flat-cut terminals.
// Approved isotype geometry is unchanged; no font or bitmap dependency.
const circle = 'M58 72A26 26 0 1 1 6 72A26 26 0 1 1 58 72Z';
const glyphs = {
  c: { advance: 61, d: 'M50.38 53.62A26 26 0 1 0 50.38 90.38' },
  o: { advance: 64, d: circle },
  b: { advance: 65, d: `M6 14V107${circle}` },
  r: { advance: 36, d: 'M6 107V37M6 71Q6 46 32 46H35' },
  a: { advance: 65, d: `${circle}M58 37V107` },
  n: { advance: 64, d: 'M6 107V37M6 72Q6 46 32 46Q58 46 58 72V107' },
  z: { advance: 59, d: 'M6 46H53L6 98H53' },
  p: { advance: 65, d: `M6 37V137${circle}` },
};

function wordmark(ink) {
  let x = 0;
  const letters = [];
  for (const letter of 'cobranzapp') {
    const glyph = glyphs[letter];
    letters.push(`<path transform="translate(${x} 0)" d="${glyph.d}"/>`);
    x += glyph.advance + 12;
  }
  return { width: x - 12 + 4, markup: `<g fill="none" stroke="${ink}" stroke-width="18" stroke-linecap="butt" stroke-linejoin="round">${letters.join('')}</g>` };
}

function svg(title, width, height, contents) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" fill="none" role="img" aria-labelledby="title"><title id="title">${title}</title>${contents}</svg>\n`;
}

const manifest = { brand: 'cobranzapp', version: '2.0', background: 'transparent', palette: colors, assets: [] };
for (const dir of ['svg', 'png', 'previews']) await fs.mkdir(path.join(root, dir), { recursive: true });
for (const [variant, palette] of Object.entries(variants)) {
  const word = wordmark(palette.ink);
  const assets = {
    isotype: { width: 256, height: 256, markup: symbol(palette), sizes: [24, 32, 48, 64, 128, 256, 512, 1024] },
    wordmark: { width: word.width + 20, height: 150, markup: `<g transform="translate(10 3)">${word.markup}</g>`, sizes: [512, 1024, 2048] },
    lockup: { width: word.width + 195, height: 170, markup: `<g transform="translate(0 8) scale(.6)">${symbol(palette)}</g><g transform="translate(175 14)">${word.markup}</g>`, sizes: [512, 1024, 2048] },
  };
  for (const [kind, asset] of Object.entries(assets)) {
    const name = `cobranzapp-${kind}-${variant}`;
    const source = svg(`cobranzapp ${kind} — ${variant}`, asset.width, asset.height, asset.markup);
    await fs.writeFile(path.join(root, 'svg', `${name}.svg`), source);
    for (const width of asset.sizes) {
      const file = `png/${name}-${width}.png`;
      const height = Math.round(width * asset.height / asset.width);
      await sharp(Buffer.from(source)).resize({ width, height }).png({ compressionLevel: 9, palette: false }).toFile(path.join(root, file));
      manifest.assets.push({ file, width, height, variant, kind });
    }
  }
}

// Presentation boards are previews only; masters and production exports have no background.
const primary = variants.primary;
const reversed = variants.reversed;
const lightWord = wordmark(primary.ink);
const darkWord = wordmark(reversed.ink);
const board = `<rect width="1440" height="1240" fill="${colors.cream}"/><rect y="620" width="1440" height="620" fill="${colors.charcoal}"/>
<g transform="translate(656 24) scale(.5)">${symbol(primary)}</g>
<g transform="translate(166 176) scale(1.55)">${lightWord.markup}</g>
<g transform="translate(354 443) scale(.8)"><g transform="translate(0 8) scale(.6)">${symbol(primary)}</g><g transform="translate(175 14)">${lightWord.markup}</g></g>
<g transform="translate(656 644) scale(.5)">${symbol(reversed)}</g>
<g transform="translate(166 796) scale(1.55)">${darkWord.markup}</g>
<g transform="translate(354 1063) scale(.8)"><g transform="translate(0 8) scale(.6)">${symbol(reversed)}</g><g transform="translate(175 14)">${darkWord.markup}</g></g>`;
await sharp(Buffer.from(svg('cobranzapp identity — preview surfaces only', 1440, 1240, board))).png().toFile(path.join(root, 'previews', 'cobranzapp-brand-preview.png'));
await sharp(Buffer.from(svg('cobranzapp identity — preview surfaces only', 1440, 1240, board))).resize({ width: 720 }).png().toFile(path.join(root, 'previews', 'cobranzapp-brand-preview-720.png'));

await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Exported ${manifest.assets.length} transparent PNGs and 12 SVG masters.`);
