// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import pagefind from 'astro-pagefind';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkBreaks from 'remark-breaks';
import remarkCallout from 'remark-obsidian-callout';
import { remarkVault } from './src/plugins/remark-vault.ts';
import { rehypeGallery } from './src/plugins/rehype-gallery.ts';
import { previousSlugsRedirects } from './src/lib/redirects.ts';
import { SITE_URL } from './src/site.config.ts';

const localFont = (name, cssVariable, file, weight, fallback) => ({
  provider: fontProviders.local(),
  name,
  cssVariable,
  fallbacks: [fallback],
  optimizedFallbacks: true,
  display: 'swap',
  options: { variants: [{ src: [`./node_modules/@fontsource-variable/${file}`], weight, style: 'normal' }] },
});

export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'never',
  build: { format: 'file' },
  image: { layout: 'constrained' },
  redirects: previousSlugsRedirects(),
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath, remarkVault, remarkCallout, remarkBreaks],
      rehypePlugins: [rehypeKatex, rehypeGallery],
    }),
    shikiConfig: { theme: 'vesper' },
  },
  integrations: [
    sitemap({ filter: (page) => !page.includes('/tags/') && !page.includes('/404') }),
    pagefind(),
  ],
  fonts: [
    localFont('Inter Tight', '--font-display', 'inter-tight/files/inter-tight-latin-wght-normal.woff2', '100 900', 'sans-serif'),
    localFont('Inter', '--font-text', 'inter/files/inter-latin-wght-normal.woff2', '100 900', 'sans-serif'),
    localFont('JetBrains Mono', '--font-mono', 'jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2', '100 800', 'monospace'),
  ],
});
