#!/usr/bin/env node
// Register a blog post, and scaffold posts/<slug>.html if it does not exist.
//
// This does NOT convert markdown. Every published post here is hand-written
// HTML with bespoke <figure> blocks; adding a markdown pipeline would mean
// either rewriting them or maintaining two authoring paths. That is a separate
// decision, and the manifest is unaffected by it either way.
import { parseArgs } from 'node:util';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, paths, readPosts, writeManifest } from './lib/manifest.mjs';
import { kebab, isValidId } from './lib/slug.mjs';
import { ask, closePrompts, rule, fail, dim, bold, accent, green, yellow } from './lib/ask.mjs';

const { values: flags } = parseArgs({
  options: {
    title: { type: 'string' }, slug: { type: 'string' }, at: { type: 'string' },
    tags: { type: 'string' }, preview: { type: 'string' }, canonical: { type: 'string' },
    draft: { type: 'boolean' }, yes: { type: 'boolean' }, help: { type: 'boolean' },
  },
});

if (flags.help) {
  console.log(`
  ${bold('npm run post')} -- [flags]

    --title "Plaster Prescription"   post title
    --slug plaster-prescription      defaults to a kebab of the title, immutable after
    --at 2026-07-12                  publish date (YYYY-MM-DD), defaults to today
    --tags health,prevention,nhs     comma separated
    --preview "one line summary"     shown on the homepage and in blogs.html
    --canonical https://...          original URL, if cross-posted
    --draft                          register as "public": false
    --yes                            never prompt
`);
  process.exit(0);
}

const posts = readPosts();
const interactive = !flags.yes;
const need = (v, label) => v ?? (interactive ? null : fail(`--${label} is required with --yes`));

console.log(`\n  ${bold('bobbay post')}\n`);

const title = flags.title ?? need(null, 'title') ?? await ask('title', { required: true });
const slug = flags.slug ?? (interactive ? await ask('slug', { fallback: kebab(title) }) : kebab(title));
if (!isValidId(slug)) fail(`"${slug}" is not a valid slug`, 'lowercase letters, digits and hyphens only');

const existing = posts.entries.find(p => p.slug === slug);
if (existing && !interactive) fail(`a post with slug "${slug}" already exists`);

const today = new Date().toISOString().slice(0, 10);
const publishedAt = flags.at ?? (interactive ? await ask('published', { fallback: today }) : today);
if (!/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) fail(`"${publishedAt}" is not YYYY-MM-DD`);

const tagsRaw = flags.tags ?? (interactive ? await ask('tags', { fallback: '' }) : '');
const tags = tagsRaw.split(/[,\s]+/).map(t => t.trim()).filter(Boolean);

const preview = flags.preview ?? (interactive ? await ask('preview', { required: true }) : need(null, 'preview'));
const canonical = (flags.canonical ?? (interactive ? await ask('canonical url') : '')) || null;

const entry = {
  slug, title, publishedAt, tags, preview,
  public: !flags.draft,
  canonical,
};

if (existing) Object.assign(existing, entry);
else posts.entries.push(entry);
writeManifest(paths.posts, posts, 'publishedAt');

// Scaffold only when the file is absent. An existing post is registered and
// otherwise left completely alone.
const file = join(ROOT, 'posts', `${slug}.html`);
let scaffolded = false;
if (!existsSync(file)) {
  const template = readFileSync(join(ROOT, 'tools', 'templates', 'post.html'), 'utf8');
  writeFileSync(file, template
    .replaceAll('{{SLUG}}', slug)
    .replaceAll('{{TITLE}}', title)
    .replace('{{CANONICAL}}', canonical
      ? `\n  <link rel="canonical" href="${canonical}">` : ''));
  scaffolded = true;
}

rule();
console.log(`  ${'slug'.padEnd(12)}${accent(slug)}`);
console.log(`  ${'published'.padEnd(12)}${publishedAt}`);
console.log(`  ${'tags'.padEnd(12)}${tags.join(', ') || dim('none')}`);
if (!entry.public) console.log(`  ${'state'.padEnd(12)}${yellow('draft (public: false)')}`);
rule();
console.log(`\n  ${existing ? 'updated' : 'wrote'}  ${dim('data/posts.json')}  (${posts.entries.length} total)`);
if (scaffolded) console.log(`  ${green('created')}  posts/${slug}.html  ${dim('write the prose between the markers')}`);
else console.log(`  ${dim('kept')}     posts/${slug}.html  ${dim('untouched')}`);

closePrompts();
