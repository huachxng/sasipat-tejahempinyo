#!/usr/bin/env node
/**
 * scripts/shrink-images.ts — `npm run shrink`
 *
 * Downsizes every image in content/media that is over 2 MB, in place (same file name, so wikilinks stay valid):
 * auto-rotate from EXIF, longest edge 2400 px, JPEG quality 82 (mozjpeg). PNGs stay PNG (lossless, palette
 * quantised only if still over the limit) because renaming would break embeds. All metadata (EXIF, GPS) is dropped.
 *
 * Flags: --all           process every image, not only those over the limit (also strips GPS from small photos)
 *        --limit <MB>    threshold (default 2)
 *        --dry-run       print what would change
 *        --dir <path>    folder to process (default content/media)
 */
import { readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'tinyglobby';
import sharp from 'sharp';

const args = process.argv.slice(2);
const flagValue = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIR = flagValue('--dir') ?? join(REPO_ROOT, 'content', 'media');
const ALL = args.includes('--all');
const DRY = args.includes('--dry-run');
const MB = 1024 * 1024;
const LIMIT = Number(flagValue('--limit') ?? 2) * MB;
const LONGEST_EDGE = 2400;
const JPEG_QUALITY = 82;
const fmt = (n: number) => `${(n / MB).toFixed(2)} MB`;

const images = globSync(['**/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}'], { cwd: DIR, absolute: true }).sort();
let touched = 0;
let savedBytes = 0;
for (const file of images) {
  const before = statSync(file).size;
  if (!ALL && before <= LIMIT) continue;
  const rel = relative(REPO_ROOT, file);
  const ext = extname(file).toLowerCase();
  const input = readFileSync(file);
  const meta = await sharp(input).metadata();
  let pipeline = sharp(input).rotate().resize({ width: LONGEST_EDGE, height: LONGEST_EDGE, fit: 'inside', withoutEnlargement: true });
  let note = '';
  if (ext === '.png') pipeline = pipeline.png({ compressionLevel: 9, effort: 8 });
  else if (ext === '.webp') pipeline = pipeline.webp({ quality: JPEG_QUALITY });
  else pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
  let out = await pipeline.toBuffer();
  if (ext === '.png' && out.length > LIMIT) {
    out = await sharp(input).rotate().resize({ width: LONGEST_EDGE, height: LONGEST_EDGE, fit: 'inside', withoutEnlargement: true }).png({ compressionLevel: 9, effort: 8, palette: true, quality: 90 }).toBuffer();
    note = ' (palette-quantised)';
  }
  const outMeta = await sharp(out).metadata();
  const grew = out.length >= before;
  const line = `${rel}: ${fmt(before)} ${meta.width}×${meta.height} → ${fmt(out.length)} ${outMeta.width}×${outMeta.height}${note}${grew ? ' — kept original (no gain)' : ''}${DRY ? ' [dry run]' : ''}`;
  console.log(line);
  if (grew && !ALL) continue;
  if (grew && ALL && !meta.exif) continue; // nothing to strip, nothing to gain
  if (DRY) continue;
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, out);
  renameSync(tmp, file);
  touched++;
  savedBytes += before - out.length;
}
console.log(`\n${images.length} images scanned, ${touched} rewritten, ${fmt(Math.max(0, savedBytes))} saved${DRY ? ' (dry run — nothing written)' : ''}`);
