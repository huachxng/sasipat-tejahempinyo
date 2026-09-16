const nav = document.querySelector<HTMLElement>('[data-nav]');
const menu = document.getElementById('site-menu') as HTMLDialogElement | null;
const onScroll = () => nav?.classList.toggle('is-scrolled', window.scrollY > 40);
onScroll();
addEventListener('scroll', onScroll, { passive: true });
document.querySelector('[data-menu-open]')?.addEventListener('click', () => menu?.showModal());
document.querySelector('[data-menu-close]')?.addEventListener('click', () => menu?.close());
menu?.addEventListener('click', (e) => { if (e.target === menu) menu.close(); });
menu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => menu.close()));

// Reveal-on-scroll for .reveal / .fade
const io = new IntersectionObserver((entries) => {
  for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
}, { threshold: 0.15 });
document.querySelectorAll('.reveal, .fade').forEach((el) => io.observe(el));

// Search shortcut
addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement | null;
  const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
    e.preventDefault();
    document.querySelector<HTMLButtonElement>('[data-search-open]')?.click();
  }
});
