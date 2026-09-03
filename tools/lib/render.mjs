// HTML templates. Everything the homepage shows is generated from data/, so a
// fact lives in exactly one place. Rows share one shape: something on the left,
// a figure on the right, both on a shared baseline.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { htmlEscape as e } from './escape.mjs';
import { kebab } from './slug.mjs';
import { ROOT } from './manifest.mjs';

const fmt = (iso, opts) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts })
    .format(new Date(`${iso.slice(0, 10)}T12:00:00Z`));

const longDate  = iso => fmt(iso, { day: 'numeric', month: 'short', year: 'numeric' });

const shortMonth = iso => fmt(iso, { month: 'short', year: 'numeric' });

// en-GB short month is "Sept"; the page language is "1 Sep 2026".
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const dayDate = iso => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

const attr = (name, val) => (val ? ` data-${name}="${e(String(val))}"` : '');

const checkinId = c => kebab(c.id || c.place);

const jpegUriCache = new Map();

function jpegFromSvg(svg) {
  const m = String(svg).match(/data:image\/jpeg;base64,([A-Za-z0-9+/=\s]+)/i);
  if (!m) return '';
  return `data:image/jpeg;base64,${m[1].replace(/\s+/g, '')}`;
}

// GitHub MCP cannot reliably push binary JPEGs, so the page inlines them.
function jpegDataUri(relPath) {
  if (!relPath) return '';
  if (String(relPath).startsWith('data:')) return relPath;
  if (jpegUriCache.has(relPath)) return jpegUriCache.get(relPath);
  const jpgAbs = join(ROOT, relPath.replace(/\.svg$/i, '.jpg'));
  const svgAbs = join(ROOT, relPath.replace(/\.jpe?g$/i, '.svg'));
  let uri = relPath;
  if (existsSync(jpgAbs) && /\.jpe?g$/i.test(jpgAbs)) {
    uri = `data:image/jpeg;base64,${readFileSync(jpgAbs).toString('base64')}`;
  } else if (existsSync(svgAbs)) {
    uri = jpegFromSvg(readFileSync(svgAbs, 'utf8')) || uri;
  }
  jpegUriCache.set(relPath, uri);
  return uri;
}


// --- homepage blocks ------------------------------------------------------

export function intro(site) {
  return `<h1>${e(site.name)}</h1>
<p class="bio">
  ${e(site.bio)}
  ${site.motto ? `<span class="motto">${e(site.motto)}</span>` : ''}
</p>`;
}

export function lastSeen(site) {
  const here = site.here;
  if (!here) return '';
  const at = here.at;
  const when = dayDate(at);
  const currentId = checkinId({ place: here.place, at: here.at });
  const size = (here.width && here.height) ? ` width="${here.width}" height="${here.height}"` : '';
  const heroSrc = here.image ? jpegDataUri(here.image) : '';
  const img = heroSrc
    ? `<img src="${e(heroSrc)}"${size} alt="${e(here.alt || here.place)}" data-hero-img>`
    : `<img alt="" data-hero-img hidden>`;
  const phHidden = here.image ? ' hidden' : '';
  const venue = here.url
    ? `<a class="venue" href="${e(here.url)}" target="_blank" rel="noopener">${e(here.place)}</a>`
    : e(here.place);
  const area = here.area ? `, ${e(here.area)}` : '';
  const strip = checkinRows(site.checkins, here);
  return `<div class="last-seen" id="check-ins" data-last-seen-root data-expanded="false" data-current="${e(currentId)}">
  <div class="scene" data-hero>
    <div class="plaque plaque-top">
      <span>${e(here.city)}</span>
      <span>Last seen <time datetime="${e(at)}" data-at="${e(at)}">${e(when)}</time></span>
    </div>
    ${img}
    <div class="scene-ph" data-hero-ph${phHidden}></div>
    <button class="plaque plaque-checkins" type="button" data-hero-button aria-expanded="false" aria-label="Show all check-ins">Check-ins</button>
  </div>
  <p class="caption" data-hero-caption>Last seen at ${venue}${area}</p>
  <div class="strip-wrap" data-strip-wrap inert>
    <div class="strip" data-strip role="region" aria-label="All check-ins" tabindex="-1">
      <div class="strip-track" data-strip-track>
${strip}
      </div>
    </div>
    <button class="back-button" type="button" data-back-button>Back</button>
  </div>
</div>`;
}

// Oldest first so the newest check-in sits rightmost in the strip.
export function checkinRows(checkins, here = {}) {
  if (!checkins?.length) return '';
  const sorted = [...checkins].sort((a, b) => a.at.localeCompare(b.at) || a.place.localeCompare(b.place));
  return sorted.map(c => {
    const id = checkinId(c);
    const isHere = c.place === here.place && c.at === here.at;
    const imagePath = c.image || (isHere ? here.image : '');
    const image = imagePath ? jpegDataUri(imagePath) : '';
    const alt = c.alt || (isHere ? here.alt : '') || c.place;
    const width = c.width || 480;
    const height = c.height || 360;
    const area = c.area || (isHere ? here.area : '') || '';
    const media = image
      ? `<img class="strip-plaque" src="${e(image)}" width="${width}" height="${height}" alt="${e(alt)}">`
      : `<span class="strip-ph" aria-hidden="true"></span>`;
    const place = c.url
      ? `<a class="strip-place" href="${e(c.url)}" target="_blank" rel="noopener">${e(c.place)}</a>`
      : `<span class="strip-place">${e(c.place)}</span>`;
    const note = c.note ? `<span class="strip-note">${e(c.note)}</span>` : '';
    return `        <figure class="strip-item" data-checkin-id="${e(id)}"${attr('place', c.place)}${attr('at', c.at)}${attr('url', c.url)}${attr('note', c.note)}${attr('area', area)}${attr('image', image)}${attr('alt', image ? alt : '')}${attr('width', image ? width : '')}${attr('height', image ? height : '')}>
          <p class="strip-when"><time datetime="${e(c.at)}" data-at="${e(c.at)}">${e(dayDate(c.at))}</time></p>
          ${media}
          <figcaption>${place}${note}</figcaption>
        </figure>`;
  }).join('\n');
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
