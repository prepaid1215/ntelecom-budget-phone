const validSource = source => /^exp_a_[a-z0-9_]{1,60}$/.test(String(source));

// Retain the originating guide through comparison/detail pages. Keep product and network fields.
export function guideJourneyHref(href, source, origin, basePath = '/') {
  if (!validSource(source) || !href || href.startsWith('#')) return href;
  let target;
  try { target = new URL(href, origin); } catch { return href; }
  if (target.origin !== new URL(origin).origin) return href;
  const base = String(basePath).replace(/\/$/, '');
  if (base && !target.pathname.startsWith(base + '/')) return href;
  const route = base ? target.pathname.slice(base.length) : target.pathname;
  if (!/^\/(?:start|plans|benefits|card|compare)(?:\/|$)/.test(route)) return href;
  target.searchParams.set('from', source);
  return target.href;
}

export function installGuideJourney() {
  const root = document.querySelector('[data-site-shell]');
  if (!root) return;
  const own = root.dataset.guideSource;
  const incoming = new URLSearchParams(location.search).get('from');
  const source = validSource(own) ? own : incoming;
  if (!validSource(source)) return;
  const decorate = link => {
    if (!(link instanceof HTMLAnchorElement) || link.hasAttribute('download')) return;
    const href = link.getAttribute('href');
    const next = guideJourneyHref(href, source, location.origin, root.dataset.siteBase);
    if (next !== href) link.setAttribute('href', next);
  };
  root.querySelectorAll('a[href]').forEach(decorate);
  // Covers results inserted by the plan finder after filtering or loading more.
  for (const event of ['click', 'auxclick', 'contextmenu']) root.addEventListener(event, e => {
    const link = e.target instanceof Element ? e.target.closest('a[href]') : null;
    if (link && root.contains(link)) decorate(link);
  });
}
