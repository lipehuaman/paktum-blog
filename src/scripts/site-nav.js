/* Copied from Paktum-landing/site-nav.js so the blog matches paktum.ch. Keep both in sync. */
/* Shared site navigation: mobile menu, language picker and compact state on scroll. */
(() => {
  const nav = document.querySelector('.site-nav');
  if (!nav) return;
  const button = nav.querySelector('.sn-menu-btn');
  const menu = document.getElementById('site-nav-menu');
  let previousFocus = null;

  const background = () => [...document.body.children].filter(el => el !== nav && el !== menu && !el.matches('script, style, link, .skip-link, dialog'));

  function setMenu(open) {
    if (!menu || !button) return;
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? button.dataset.closeLabel : button.dataset.openLabel);
    document.body.classList.toggle('sn-open', open);
    background().forEach(el => { el.inert = open; });
    if (open) {
      previousFocus = document.activeElement;
      nav.querySelector('.sn-lang')?.removeAttribute('open');
      menu.querySelector('a')?.focus({ preventScroll: true });
    } else if (previousFocus && menu.contains(document.activeElement)) {
      previousFocus.focus({ preventScroll: true });
    }
  }

  button?.addEventListener('click', () => setMenu(menu.hidden));
  menu?.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
  matchMedia('(min-width: 961px)').addEventListener('change', event => { if (event.matches) setMenu(false); });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (menu && !menu.hidden) { setMenu(false); button.focus(); }
      nav.querySelectorAll('.sn-lang[open]').forEach(picker => { picker.removeAttribute('open'); picker.querySelector('summary').focus(); });
      if (nav.contains(document.activeElement) && document.activeElement.closest('.sn-panel')) document.activeElement.closest('.sn-dropdown').querySelector('a').focus();
    }
    if (event.key === 'Tab' && menu && !menu.hidden) {
      const items = [...nav.querySelectorAll('a, summary, button'), ...menu.querySelectorAll('a, summary')]
        .filter(item => item.getClientRects().length && !item.closest('[hidden]'));
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  document.addEventListener('click', event => {
    nav.querySelectorAll('.sn-lang[open]').forEach(picker => { if (!picker.contains(event.target)) picker.removeAttribute('open'); });
  });

  const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
