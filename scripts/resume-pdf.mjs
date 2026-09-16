#!/usr/bin/env node
/**
 * postbuild: dist/resume.json → dist/resume.pdf, then delete resume.json.
 * Runs from the repo root (`node scripts/resume-pdf.mjs`); DIST_DIR overrides ./dist.
 * ESM because @react-pdf/renderer 4.x ships no CJS build. No JSX: plain React.createElement.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { Document, Font, Link, Page, StyleSheet, Text, View, renderToFile } from '@react-pdf/renderer';

const h = React.createElement;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.resolve(process.cwd(), process.env.DIST_DIR ?? 'dist');
const jsonPath = path.join(dist, 'resume.json');
const pdfPath = path.join(dist, 'resume.pdf');
const rel = (p) => {
  const r = path.relative(process.cwd(), p);
  return r && !r.startsWith('..') ? r : p;
};

function fail(message) {
  console.error(`✖ resume-pdf: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(jsonPath)) {
  fail(
    `${rel(jsonPath)} is missing. Run \`npx astro build\` first (src/pages/resume.json.ts writes it), then \`node scripts/resume-pdf.mjs\`; set DIST_DIR when the build output is not ./dist.`,
  );
}
let model;
try {
  model = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
} catch (err) {
  fail(`${rel(jsonPath)} is not valid JSON (${err.message}). Rebuild with \`npx astro build\`.`);
}
if (!model?.header?.name || !Array.isArray(model.sections) || !Array.isArray(model.education)) {
  fail(`${rel(jsonPath)} is not a resume model (expected { header, education, sections, skills }). Rebuild with \`npx astro build\`.`);
}

// Fonts: react-pdf reads TTF/WOFF (not WOFF2, not variable fonts) and on Node needs ABSOLUTE paths.
const fontDir = path.resolve(root, 'node_modules/@fontsource/inter/files');
const fonts = [
  { src: path.join(fontDir, 'inter-latin-400-normal.woff'), fontWeight: 400 },
  { src: path.join(fontDir, 'inter-latin-600-normal.woff'), fontWeight: 600 },
];
for (const f of fonts) {
  if (!fs.existsSync(f.src)) fail(`font file missing: ${f.src}. Run \`npm install\` (@fontsource/inter is a dependency).`);
}
Font.register({ family: 'Inter', fonts });
Font.registerHyphenationCallback((word) => [word]);

const INK = '#111111';
const INK2 = '#3d3b37';
const INK3 = '#6b6862';
const GOLD = '#e8b84a';

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 40, paddingHorizontal: 44, fontFamily: 'Inter', fontSize: 9.5, lineHeight: 1.35, color: INK },
  head: { paddingBottom: 7, borderBottomWidth: 1, borderBottomColor: INK },
  name: { fontSize: 19, fontWeight: 600, letterSpacing: -0.3, lineHeight: 1.15 },
  headline: { fontSize: 9.5, color: INK2, marginTop: 3 },
  meta: { fontSize: 8.5, color: INK2, marginTop: 3 },
  link: { color: INK, textDecoration: 'none' },
  section: { marginTop: 9 },
  h: { fontSize: 7.5, fontWeight: 600, letterSpacing: 1.1, textTransform: 'uppercase', paddingBottom: 2, marginBottom: 3, borderBottomWidth: 1, borderBottomColor: GOLD },
  item: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 1.5 },
  line: { flexGrow: 1, flexShrink: 1, flexBasis: 0, paddingRight: 10 },
  date: { width: 84, flexShrink: 0, textAlign: 'right', fontSize: 8, color: INK3, paddingTop: 1 },
  row: { flexDirection: 'row', paddingVertical: 1 },
  key: { width: 64, flexShrink: 0, fontSize: 7.5, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: INK3, paddingTop: 1.5 },
  val: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  foot: { marginTop: 10, fontSize: 7.5, color: INK3 },
});

const siteUrl = model.siteUrl ?? 'https://sasipat-tejahempinyo.vercel.app';
const absolute = (href) => (/^[a-z]+:/i.test(href) ? href : new URL(href, siteUrl).toString());
const pretty = (href) => href.replace(/^[a-z]+:\/\//i, '').replace(/^www\./, '').replace(/\/$/, '');

const item = (it) =>
  h(
    View,
    { key: it.id, style: s.item, wrap: false },
    h(Text, { style: s.line }, h(Link, { src: absolute(it.href), style: s.link }, it.line)),
    h(Text, { style: s.date }, it.dateText ?? ''),
  );
const plain = (text, i) => h(View, { key: `plain-${i}`, style: s.item, wrap: false }, h(Text, { style: s.line }, text));
const section = (title, children) =>
  children.length ? h(View, { key: title, style: s.section }, h(Text, { style: s.h, minPresenceAhead: 36 }, title), ...children) : null;

// Header: legal name, headline, then one contact line.
const { header } = model;
const parts = [];
if (header.nickname) parts.push(`Goes by ${header.nickname}`);
if (header.location) parts.push(header.location);
if (header.email) parts.push(h(Link, { key: 'email', src: `mailto:${header.email}`, style: s.link }, header.email));
if (header.github) parts.push(h(Link, { key: 'github', src: header.github, style: s.link }, pretty(header.github)));
for (const l of header.links ?? []) {
  if (l.href !== header.github) parts.push(h(Link, { key: l.href, src: l.href, style: s.link }, l.label));
}
const meta = parts.flatMap((part, i) => (i ? ['   ·   ', part] : [part]));
const head = h(
  View,
  { style: s.head },
  h(Text, { style: s.name }, header.name),
  header.headline ? h(Text, { style: s.headline }, header.headline) : null,
  meta.length ? h(Text, { style: s.meta }, ...meta) : null,
);

// Same order as the page: Education (lines + any Education-targeted entries), the sections, Skills.
const eduSection = model.sections.find((x) => x.title === 'Education');
const education = section('Education', [...model.education.map(plain), ...(eduSection?.items ?? []).map(item)]);
const rest = model.sections.filter((x) => x.title !== 'Education').map((x) => section(x.title, x.items.map(item)));
const rows = [
  ['Skills', model.skills],
  ['Languages', model.languages],
  ['Coursework', model.coursework],
  ['Tests', model.tests],
].filter(([, v]) => Array.isArray(v) && v.length > 0);
const skills = section(
  'Skills',
  rows.map(([k, v]) => h(View, { key: k, style: s.row, wrap: false }, h(Text, { style: s.key }, k), h(Text, { style: s.val }, v.join('  ·  ')))),
);
const foot = h(
  Text,
  { style: s.foot },
  'Full record with photos and certificates: ',
  h(Link, { src: `${siteUrl}/achievements`, style: s.link }, `${pretty(siteUrl)}/achievements`),
);

const epoch = Number(process.env.SOURCE_DATE_EPOCH);
const stamp = Number.isFinite(epoch) && epoch > 0 ? new Date(epoch * 1000) : undefined;
const docProps = {
  title: `${header.name} — Resume`,
  author: header.name,
  subject: header.headline ?? 'Resume',
  keywords: `resume, ${header.name}`,
  creator: 'sasipat-tejahempinyo build (Astro + react-pdf)',
  producer: 'react-pdf',
  language: 'en',
};
if (stamp) Object.assign(docProps, { creationDate: stamp, modificationDate: stamp });

const doc = h(Document, docProps, h(Page, { size: 'LETTER', style: s.page }, head, education, ...rest, skills, foot));

try {
  await renderToFile(doc, pdfPath);
} catch (err) {
  fail(`rendering failed: ${err?.stack ?? err}`);
}

const buf = fs.readFileSync(pdfPath);
const pages = (buf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
if (!buf.length || pages < 1) fail(`${rel(pdfPath)} came out empty.`);
fs.unlinkSync(jsonPath);
console.log(
  `✔ resume-pdf: ${rel(pdfPath)} — ${pages} page${pages === 1 ? '' : 's'}, ${Math.round(buf.length / 1024)} KB, ${model.count ?? '?'} entries (${header.name})`,
);
if (pages > 2) {
  console.warn(
    `⚠ resume-pdf: ${pages} pages; the target is one page, two at most. Set resume: false on older entries in content/achievements or lower RESUME_SECTION_CAP in src/site.config.ts.`,
  );
}
