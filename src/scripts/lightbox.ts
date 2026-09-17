// PhotoSwipe 5 lightbox for achievement pages: one gallery per page (cover, body photos, certificate), PhotoSwipe
// itself dynamically imported on first click. Slide sources come from getImage() at build (JSON in <Lightbox>).
import type PhotoSwipeType from 'photoswipe';
import type { SlideData } from 'photoswipe';

type Slide = SlideData & { caption?: string };
const motionOff = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';

const dataEl = document.querySelector<HTMLScriptElement>('[data-lightbox-slides]');
if (dataEl) {
  let slides: Slide[] = [];
  let bodyMap: number[] = [];
  try {
    slides = JSON.parse(dataEl.textContent || '[]');
    bodyMap = JSON.parse(dataEl.dataset.bodyMap || '[]');
  } catch {
    slides = [];
  }

  const triggers = new Map<number, HTMLElement>();
  const largestSrc = (img: HTMLImageElement) => {
    const set = img.srcset
      .split(',')
      .map((s) => s.trim().split(/\s+/))
      .filter((p) => p[0])
      .map((p) => ({ url: p[0], w: Number.parseInt(p[1] ?? '0', 10) || 0 }))
      .sort((a, b) => b.w - a.w);
    return set[0]?.url ?? img.currentSrc ?? img.src;
  };

  let pswp: PhotoSwipeType | null = null;
  let loading: Promise<typeof import('photoswipe')> | null = null;

  const open = async (index: number, openerEl?: HTMLElement) => {
    loading ??= import('photoswipe');
    const { default: PhotoSwipe } = await loading;
    if (pswp) pswp.destroy();
    const dataSource = slides.map((s, i) => ({ ...s, element: triggers.get(i) }));
    pswp = new PhotoSwipe({
      dataSource,
      index,
      bgOpacity: 1,
      padding: { top: 32, bottom: 56, left: 16, right: 16 },
      showHideAnimationType: motionOff() ? 'none' : 'zoom',
      returnFocus: false,
      wheelToZoom: true,
      closeTitle: 'Close (Esc)',
      zoomTitle: 'Zoom',
      arrowPrevTitle: 'Previous (←)',
      arrowNextTitle: 'Next (→)',
      errorMsg: 'The image could not be loaded.',
    });
    pswp.on('uiRegister', () => {
      pswp?.ui?.registerElement({
        name: 'ach-caption',
        order: 9,
        isButton: false,
        appendTo: 'root',
        onInit: (el, ps) => {
          const update = () => {
            const d = ps.currSlide?.data as Slide | undefined;
            el.textContent = d?.caption ?? '';
            el.hidden = !d?.caption;
          };
          ps.on('change', update);
          update();
        },
      });
    });
    // Return focus ourselves: Safari does not focus a clicked button, so PhotoSwipe's own returnFocus lands on <body>.
    const opener = openerEl ?? triggers.get(index);
    pswp.on('destroy', () => {
      pswp = null;
      opener?.focus({ preventScroll: true });
    });
    pswp.init();
  };

  const wire = (el: HTMLElement, index: number) => {
    if (!slides[index]) return;
    if (!triggers.has(index)) triggers.set(index, el); // first registration wins (the visible cover, not a hidden duplicate)
    el.dataset.lbIndex = String(index);
    el.setAttribute('aria-label', `Open image ${index + 1} of ${slides.length}${slides[index].caption ? `: ${slides[index].caption}` : ''}`);
    el.addEventListener('click', (e) => {
      e.preventDefault();
      void open(index, el);
    });
  };

  // Server-rendered triggers (cover + certificate slot) carry data-lb-index.
  document.querySelectorAll<HTMLElement>('[data-lb-index]').forEach((el) => wire(el, Number(el.dataset.lbIndex)));

  // Body images (rehype-gallery figures) are matched to slides by document order; wrap each in a link.
  const bodyImgs = [...document.querySelectorAll<HTMLImageElement>('[data-lightbox-body] img')];
  bodyImgs.forEach((img, n) => {
    if (img.closest('a, button')) return;
    let index = bodyMap[n];
    if (index === undefined || !slides[index]) {
      // Fallback: use the largest srcset candidate as its own slide.
      index = slides.length;
      slides.push({ src: largestSrc(img), width: img.naturalWidth || Number(img.getAttribute('width')) || 1600, height: img.naturalHeight || Number(img.getAttribute('height')) || 1067, alt: img.alt, caption: img.alt || undefined });
    }
    const a = document.createElement('a');
    a.href = slides[index].src ?? img.src;
    a.className = 'lb-trigger';
    img.replaceWith(a);
    a.append(img);
    wire(a, index);
  });
}
