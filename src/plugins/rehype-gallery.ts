// Wraps runs of image-only paragraphs in <div class="gallery"> and marks certificate images.
import type { Root, Element, ElementContent } from 'hast';

const isImg = (n: ElementContent): n is Element => n.type === 'element' && n.tagName === 'img';
const isImageParagraph = (n: ElementContent | Root['children'][number]) =>
  n.type === 'element' && n.tagName === 'p' && n.children.length > 0 && n.children.every((c) => isImg(c) || (c.type === 'text' && !c.value.trim()));

export function rehypeGallery() {
  return (tree: Root) => {
    const kids = tree.children;
    for (let i = 0; i < kids.length; i++) {
      if (!isImageParagraph(kids[i])) continue;
      let j = i;
      while (j + 1 < kids.length && (isImageParagraph(kids[j + 1]) || (kids[j + 1].type === 'text' && !(kids[j + 1] as { value: string }).value.trim()))) j++;
      const figures: Element[] = [];
      for (let k = i; k <= j; k++) {
        const p = kids[k];
        if (p.type !== 'element') continue;
        for (const img of p.children.filter(isImg)) {
          const src = String(img.properties?.src ?? '');
          const cert = /certificate|certi\b/i.test(src);
          img.properties = { ...img.properties, loading: 'lazy', decoding: 'async' };
          figures.push({
            type: 'element',
            tagName: 'figure',
            properties: { className: ['gallery-item', ...(cert ? ['is-certificate'] : [])] },
            children: [img],
          });
        }
      }
      const wrapper: Element = { type: 'element', tagName: 'div', properties: { className: ['gallery'], 'data-count': String(figures.length) }, children: figures };
      kids.splice(i, j - i + 1, wrapper);
    }
  };
}
export default rehypeGallery;
