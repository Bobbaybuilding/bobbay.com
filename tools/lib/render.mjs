// HTML templates. Everything the homepage shows is generated from data/, so a
// fact lives in exactly one place. Rows share one shape: something on the left,
// a figure on the right, both on a shared baseline.
import { htmlEscape as e } from './escape.mjs';

const fmt = (iso, opts) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts })
    .format(new Date(`${iso.slice(0, 10)}T12:00:00Z`));

const longDate  = iso => fmt(iso, { day: 'numeric', month: 'short', year: 'numeric' });

const shortMonth = iso => fmt(iso, { month: 'short', year: 'numeric' });

// --- homepage blocks ------------------------------------------------------

export function intro(site) {
  return `<h1>${e(site.name)}</h1>
<p class="bio">
  ${e(site.bio)}
  ${site.motto ? `<span class="motto">${e(site.motto)}</span>` : ''}
</p>`;
}

export function writingRows(posts) {
  if (!posts.length) return '<p class="empty">nothing published yet</p>';
  return `<div class="rows">\n` + posts.map(p => {
    const href = p.external ? p.external : `/posts/${e(p.slug)}.html`;
    const out = p.external ? ' target="_blank" rel="noopener"' : '';
    // Name the host so an outbound link is obviously outbound.
    const host = p.external
      ? `<small>${e(new URL(p.external).hostname.replace(/^www\./, ''))}</small>` : '';
    return `  <a class="row" href="${href}"${out}><span>${e(p.title)}${host}</span>` +
      `<span class="meta">${e(shortMonth(p.publishedAt))}</span></a>`;
  }).join('\n') + `\n</div>`;
}

export function workRows(work) {
  if (!work?.length) return '';
  return `<div class="rows">\n` + work.map(w => {
    const span = w.to ? `${w.from}&ndash;${String(w.to).slice(-2)}` : `${w.from}&ndash;`;
    return `  <div class="row"><span><span class="role">${e(w.role)}</span>` +
      `<small>${e(w.org)}</small></span><span class="meta">${span}</span></div>`;
  }).join('\n') + `\n</div>`;
}

// Heaviest first, so the column reads as a ranking rather than a list.
export function liftRows(lifts) {
  if (!lifts?.entries?.length) return '';
  const sorted = [...lifts.entries].sort((a, b) => b.kg - a.kg);
  return `<div class="rows">\n` + sorted.map(l =>
    `  <div class="row"><span>${e(l.name)}</span>` +
    `<span class="meta">${l.kg}<i> kg</i></span></div>`
  ).join('\n') + `\n</div>`;
}

export function socialLinks(socials) {
  const links = socials
    .map(({ label, url }) => {
      const rel = /^https?:/.test(url) ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${e(url)}"${rel}>${e(label)}</a>`;
    })
    .join('\n<span>&middot;</span>\n');

  // Both labels ship in the DOM and CSS picks one, so the button never shows
  // the wrong word before the script runs.
  const toggle = `<button class="theme" type="button" data-theme aria-label="Switch colour scheme">` +
    `<span class="to-night">Dark</span><span class="to-day">Light</span></button>`;

  return `${links}\n<span>&middot;</span>\n${toggle}`;
}

// --- other surfaces -------------------------------------------------------

export function blogCards(posts) {
  if (!posts.length) return '<p class="empty">nothing published yet</p>';
  return `<div class="rows">\n` + posts.map(p => {
    const href = p.external ? p.external : `posts/${e(p.slug)}.html`;
    const out = p.external ? ' target="_blank" rel="noopener"' : '';
    const meta = p.external
      ? e(new URL(p.external).hostname.replace(/^www\./, ''))
      : `${p.readingMinutes} min`;
    return `  <a class="row" href="${href}"${out}><span>${e(p.title)}` +
      `<small>${e(p.preview)}</small></span>` +
      `<span class="meta">${e(shortMonth(p.publishedAt))} <i>${meta}</i></span></a>`;
  }).join('\n') + `\n</div>`;
}

export function postNav(prev, next) {
  const cell = (post, label, dir) => post
    ? `<a class="${dir}" href="${e(post.slug)}.html"><span class="label">${label}</span>` +
      `<span class="t">${e(post.title)}</span></a>`
    : `<span class="${dir}"></span>`;
  return `${cell(prev, 'Previous', 'prev')}\n${cell(next, 'Next', 'next')}`;
}

export function postMeta(post) {
  return `<time datetime="${e(post.publishedAt)}">${e(longDate(post.publishedAt))}</time>\n` +
    `<span>${post.readingMinutes} min read</span>`;
}
