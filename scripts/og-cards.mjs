// Dev-only: regenerate public/og/*.png from CHAPTERS. Run: node scripts/og-cards.mjs (outputs are committed).
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { CHAPTERS } from '../src/site.config.ts';
mkdirSync('public/og', { recursive: true });
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const card = (num, title, sub) => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#0a0a0b"/>
<g stroke="#26262a" stroke-width="1">${[...Array(11)].map((_, i) => `<line x1="${100 * (i + 1)}" y1="0" x2="${100 * (i + 1)}" y2="630"/>`).join('')}</g>
<text x="72" y="150" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="40" fill="#8a8782" font-weight="300">${num}</text>
<text x="72" y="360" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="${title.length > 14 ? 96 : 128}" font-weight="700" fill="#f2f0ea" letter-spacing="-4">${esc(title)}</text>
<text x="72" y="430" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="28" fill="#a8a59d">${esc(sub)}</text>
<rect x="72" y="520" width="14" height="14" fill="#e8b84a"/><text x="100" y="533" font-family="Menlo, monospace" font-size="20" fill="#e8b84a">sasipat-tejahempinyo.vercel.app</text></svg>`;
const cards = [['default', '', 'SASIPAT (HUA) TEJAHEMPINYO', 'Achievements, notes and essays'], ...CHAPTERS.map((c) => [c.slug, c.num, c.title.toUpperCase(), c.dek])];
for (const [name, num, title, sub] of cards) { await sharp(Buffer.from(card(num, title, sub))).png().toFile(`public/og/${name}.png`); console.log('og', name); }
