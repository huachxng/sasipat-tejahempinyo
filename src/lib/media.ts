import type { ImageMetadata } from 'astro';
import { imageEmbeds } from './wikilinks.ts';

const files = import.meta.glob<ImageMetadata>('/content/media/**/*.{jpg,jpeg,png,webp,gif,avif,JPG,JPEG,PNG}', { eager: true, import: 'default' });
export const mediaByName = new Map<string, ImageMetadata>();
for (const [path, meta] of Object.entries(files)) mediaByName.set(path.split('/').pop()!.normalize('NFC'), meta);

export const media = (name?: string) => (name ? mediaByName.get(name.split('/').pop()!.normalize('NFC')) : undefined);
export const isCertificateName = (name: string) => /certificate|certi\b/i.test(name);

export interface EntryMedia {
  cover?: { name: string; meta: ImageMetadata };
  certificates: { name: string; meta: ImageMetadata }[];
  gallery: { name: string; meta: ImageMetadata; alt?: string }[];
}

/** Cover, certificates and gallery for an entry, from frontmatter overrides and body embeds. */
export function entryMedia(data: { cover?: string; certificate?: string }, body: string): EntryMedia {
  const embeds = imageEmbeds(body);
  const certificates: EntryMedia['certificates'] = [];
  const gallery: EntryMedia['gallery'] = [];
  for (const e of embeds) {
    const meta = media(e.name);
    if (!meta) continue;
    if (isCertificateName(e.name)) certificates.push({ name: e.name, meta });
    else gallery.push({ name: e.name, meta, alt: e.alt });
  }
  if (data.certificate) {
    const meta = media(data.certificate);
    if (meta && !certificates.some((c) => c.name === data.certificate)) certificates.unshift({ name: data.certificate, meta });
  }
  let cover: EntryMedia['cover'];
  if (data.cover && media(data.cover)) cover = { name: data.cover, meta: media(data.cover)! };
  else if (gallery.length) cover = gallery[0];
  else if (certificates.length) cover = certificates[0];
  return { cover, certificates, gallery };
}
