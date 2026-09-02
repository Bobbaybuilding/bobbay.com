#!/usr/bin/env node
// data/*.json -> HTML, injected between exact marker pairs.
//
// Nothing is fetched at runtime: the galleries are the homepage's primary
// content, so they ship in the initial HTML. `--check` renders everything in
// memory and reports drift without writing, which is what makes it impossible
// to forget to rebuild.
import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ROOT, readPosts, readJson, writeIfChanged } from './lib/manifest.mjs';
import { injectFile, hasMarkers } from './lib/inject.mjs';
import {
  intro, lastSeen, writingRows, workRows, liftRows,
  blogCards, postNav, postMeta, socialLinks,
} from './lib/render.mjs';
import { xmlEscape } from './lib/escape.mjs';
import { dim, bold, green, red, yellow, rule } from './lib/ask.mjs';

const { values: flags } = parseArgs({ options: { check: { type: 'boolean' }, help: { type: 'boolean' } } });
if (flags.help) { console.log('\n  npm run build [-- --check]\n'); process.exit(0); }

const WORDS_PER_MINUTE = 220;
const errors = [];
const changed = [];
const die = (msg, fix) => errors.push(fix ? `${msg}\n         ${dim('fix:')} ${fix}` : msg);

// --- load and validate ----------------------------------------------------
const posts = readPosts();
const siteConfig = readJson(join(ROOT, 'data', 'site.json'));
const socials = socialLinks(siteConfig.socials);

const ignored = new Set(
  (() => {
    try {
      return execFileSync('git', ['ls-files', '--others', '--ignored', '--exclude-standard', 'posts/'],
        { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
    } catch { return []; }
  })()
);

// Reading time and size are computed from the article body, never typed, and
// never from the file size on disk: the build injects nav/meta/footer into
// these same files, so a disk-size reading would change on every run and the
// build would never reach a fixed point.
const bodyText = html => {
  const body = html.match(/<main class="article-body">([\s\S]*?)<nav class="article-nav"|<main class="article-body">([\s\S]*?)<\/main>/i);
  return (body?.[1] ?? body?.[2] ?? html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const live = posts.entries.filter(p => p.public !== false);
for (const p of live) {
  // An external post lives on someone else's server; there is no file to read,
  // so reading time and size do not apply.
  if (p.external) { p.readingMinutes = null; p.size = null; continue; }
  const rel = `posts/${p.slug}.html`;
  const file = join(ROOT, rel);
  if (!existsSync(file)) { die(`post "${p.slug}" is public but ${rel} does not exist`, `create it, or set "public": false`); continue; }
  if (ignored.has(rel)) { die(`post "${p.slug}" is public but ${rel} is gitignored`, `set "public": false, or unignore it`); continue; }
  const text = bodyText(readFileSync(file, 'utf8'));
  const n = text.split(' ').filter(Boolean).length;
  p.readingMinutes = Math.max(1, Math.round(n / WORDS_PER_MINUTE));
  p.size = `${(Buffer.byteLength(text, 'utf8') / 1024).toFixed(1)}k`;
}
live.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug));

if (errors.length) report();

// --- render ---------------------------------------------------------------
const blocks = {
  'index.html': {
    intro: intro(siteConfig),
    lastseen: lastSeen(siteConfig),
    writing: writingRows(live),
    work: workRows(siteConfig.work),
    lifts: liftRows(siteConfig.lifts),
  },
  'blogs.html': { 'blog-cards': blogCards(live) },
};

for (const [file, names] of Object.entries(blocks)) {
  const path = join(ROOT, file);
  if (!existsSync(path)) { die(`missing ${file}`); continue; }
  const source = readFileSync(path, 'utf8');
  const present = Object.fromEntries(
    Object.entries(names).filter(([name]) => hasMarkers(source, name))
  );
  const absent = Object.keys(names).filter(n => !(n in present));
  if (absent.length) die(`${file} has no marker pair for: ${absent.join(', ')}`,
    `add <!-- generated:${absent[0]}:start --> and <!-- generated:${absent[0]}:end -->`);
  if (Object.keys(present).length) {
    try {
      const res = injectFile(path, present, { check: flags.check });
      if (res.changed) changed.push(file);
    } catch (err) { die(err.message); }
  }
}

// The footer is on every page, including the ones with no other generated
// content, so it gets its own sweep rather than riding on the blocks map.
for (const rel of [...readdirSync(ROOT).filter(f => f.endsWith('.html')),
                   ...readdirSync(join(ROOT, 'posts')).filter(f => f.endsWith('.html')).map(f => `posts/${f}`)]) {
  const path = join(ROOT, rel);
  if (!hasMarkers(readFileSync(path, 'utf8'), 'socials')) continue;
  try {
    const res = injectFile(path, { socials }, { check: flags.check });
    if (res.changed) changed.push(rel);
  } catch (err) { die(err.message); }
}

// Per-post nav and meta
const localPosts = live.filter(p => !p.external);
for (const [i, post] of localPosts.entries()) {
  const path = join(ROOT, `posts/${post.slug}.html`);
  const source = readFileSync(path, 'utf8');
  const named = {};
  if (hasMarkers(source, 'post-nav')) named['post-nav'] = postNav(localPosts[i + 1], localPosts[i - 1]);
  if (hasMarkers(source, 'post-meta')) named['post-meta'] = postMeta(post);
  if (!Object.keys(named).length) continue;
  try {
    const res = injectFile(path, named, { check: flags.check });
    if (res.changed) changed.push(`posts/${post.slug}.html`);
  } catch (err) { die(err.message); }
}

// feed.xml and sitemap.xml
const site = siteConfig.url;
const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>bobbay</title>
  <link>${site}/</link>
  <description>words on systems, interfaces &amp; quiet infrastructure</description>
${live.map(p => `  <item>
    <title>${xmlEscape(p.title)}</title>
    <link>${p.external ?? `${site}/posts/${p.slug}.html`}</link>
    <guid>${p.external ?? `${site}/posts/${p.slug}.html`}</guid>
    <pubDate>${new Date(`${p.publishedAt}T12:00:00Z`).toUTCString()}</pubDate>
    <description>${xmlEscape(p.preview)}</description>
  </item>`).join('\n')}
</channel></rss>
`;
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${['', 'blogs.html', ...live.filter(p => !p.external).map(p => `posts/${p.slug}.html`)]
  .map(u => `  <url><loc>${site}/${u}</loc></url>`).join('\n')}
</urlset>
`;
for (const [file, content] of [['feed.xml', feed], ['sitemap.xml', sitemap]]) {
  const path = join(ROOT, file);
  if (flags.check) {
    if (!existsSync(path) || readFileSync(path, 'utf8') !== content) changed.push(file);
  } else if (writeIfChanged(path, content)) changed.push(file);
}

// --- cache busting --------------------------------------------------------
// Three post pages link ../style.css with no ?v= at all, so they would render
// new markup against a stale stylesheet. And versioning js/main.js alone is not
// enough: a module's own imports are separate requests, so a returning visitor
// would keep stale gallery.js/terminal.js forever. Version the whole graph.
const sha = buf => createHash('sha1').update(buf).digest('hex').slice(0, 8);
const cssV = sha(readFileSync(join(ROOT, 'style.css')));

const htmlFiles = [
  ...readdirSync(ROOT).filter(f => f.endsWith('.html')),
  ...(existsSync(join(ROOT, 'posts')) ? readdirSync(join(ROOT, 'posts')).filter(f => f.endsWith('.html')).map(f => `posts/${f}`) : []),
];
for (const rel of htmlFiles) {
  const path = join(ROOT, rel);
  let src = readFileSync(path, 'utf8');
  const before = src;
  src = src.replace(/(href=")([^"?]*style\.css)(\?v=[^"]*)?(")/g, `$1$2?v=${cssV}$4`);
  if (src === before) continue;
  if (flags.check) changed.push(rel);
  else if (writeIfChanged(path, src)) changed.push(rel);
}

report();

function report() {
  if (errors.length) {
    console.error(`\n  ${bold('build failed')}\n`);
    errors.forEach(e => console.error(`  ${red('error')}  ${e}`));
    console.error('');
    process.exit(1);
  }
  const uniq = [...new Set(changed)];
  if (flags.check) {
    if (uniq.length) {
      console.error(`\n  ${red('out of sync')}  HTML does not match data/\n`);
      uniq.forEach(f => console.error(`    ${f}`));
      console.error(`\n  ${dim('run')} npm run build\n`);
      process.exit(1);
    }
    console.log(`  ${green('in sync')}  ${dim('generated HTML matches data/')}`);
    process.exit(0);
  }
  console.log(`\n  ${bold('build')}  ${dim(`${live.length} posts`)}`);
  if (uniq.length) uniq.forEach(f => console.log(`  ${green('wrote')}  ${f}`));
  else console.log(`  ${dim('no changes')}`);
  console.log(`  ${dim(`style.css?v=${cssV}`)}\n`);
}
