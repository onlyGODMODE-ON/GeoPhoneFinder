import { useEffect } from 'react';

function setMeta(name, content) {
  let el = document.head.querySelector(`meta[name="${name}"]`);
  if (!content) { el?.remove(); return; }
  if (!el) { el = document.createElement('meta'); el.setAttribute('name', name); document.head.appendChild(el); }
  el.setAttribute('content', content);
}

function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!href) { el?.remove(); return; }
  if (!el) { el = document.createElement('link'); el.setAttribute('rel', 'canonical'); document.head.appendChild(el); }
  el.setAttribute('href', href);
}

/**
 * Per-page title / description / robots / canonical (PRD §27).
 * Filter, result and compare pages pass `noindex` so unlimited filter combinations are not indexed.
 */
export function usePageMeta({ title, description, noindex = false, canonical } = {}) {
  useEffect(() => {
    if (title) document.title = title;
    setMeta('description', description);
    setMeta('robots', noindex ? 'noindex,follow' : null);
    setCanonical(canonical);
  }, [title, description, noindex, canonical]);
}
