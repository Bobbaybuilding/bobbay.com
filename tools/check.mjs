#!/usr/bin/env node
// Validation. Exits 1 on any error, 0 with warnings printed.
//
// The pass that matters most is `build --check`: it renders everything in
// memory and diffs against disk, so "I forgot to rebuild" is caught here
// rather than discovered live.
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, readPosts } from './lib/manifest.mjs';
import { isValidId } from './lib/slug.mjs';
import { dim, bold, green, red, yellow, rule } from './lib/ask.mjs';

const errors = [];
const warnings = [];
const err = (m, fix) => errors.push(fix ? `${m}\n         ${dim('fix:')} ${fix}` : m);
const warn = m => warnings.push(m);

let posts;
try {
  posts = readPosts();
} catch (e) { console.error(`\n  ${red('error')}  ${e.message}\n`); process.exit(1); }

// --- manifest -------------------------------------------------------------
const seenSlugs = new Set();
for (const p of posts.entries) {
  if (!isValidId(p.slug)) err(`post slug "${p.slug}" is not kebab-case`);
  if (seenSlugs.has(p.slug)) err(`duplicate post slug "${p.slug}"`);
  seenSlugs.add(p.slug);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.publishedAt)) err(`post "${p.slug}": publishedAt must be YYYY-MM-DD`);
  if (!p.title) err(`post "${p.slug}" has no title`);
  if (!Array.isArray(p.tags) || !p.tags.length) warn(`post "${p.slug}" has no tags`);
}

// --- post files, respecting .gitignore ------------------------------------
let ignored = new Set();
try {
  ignored = new Set(execFileSync('git', ['ls-files', '--others', '--ignored', '--exclude-standard', 'posts/'],
    { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean));
} catch { /* not a git repo */ }

const onDisk = existsSync(join(ROOT, 'posts'))
  ? readdirSync(join(ROOT, 'posts')).filter(f => f.endsWith('.html')).map(f => `posts/${f}`)
  : [];

for (const p of posts.entries) {
  // An external post lives on someone else's server. There is no local file
  // and no render to expect.
  if (p.external) {
    try { new URL(p.external); } catch { err(`post "${p.slug}" has an invalid external URL`); }
    continue;
  }
  const rel = `posts/${p.slug}.html`;
  const exists = existsSync(join(ROOT, rel));
  if (p.public !== false && !exists) err(`post "${p.slug}" is public but ${rel} is missing`);
  if (p.public !== false && ignored.has(rel)) {
    err(`post "${p.slug}" is public but ${rel} is gitignored`, 'set "public": false, or unignore it');
  }
}
for (const rel of onDisk) {
  const slug = rel.replace(/^posts\/|\.html$/g, '');
  if (!seenSlugs.has(slug)) err(`${rel} has no entry in data/posts.json`, 'run npm run post, or delete the file');
}

// --- HTML in sync ---------------------------------------------------------
let inSync = true;
try {
  execFileSync('node', [join(ROOT, 'tools', 'build.mjs'), '--check'], { cwd: ROOT, stdio: 'pipe' });
} catch {
  inSync = false;
  err('generated HTML does not match data/', 'run npm run build');
}

// --- report ---------------------------------------------------------------
console.log(`\n  ${bold('check')}  ${dim(`${posts.entries.length} posts`)}`);
for (const w of warnings) console.log(`  ${yellow('warn')}   ${w}`);
for (const e of errors) console.log(`  ${red('error')}  ${e}`);
rule();
if (errors.length) {
  console.log(`  ${red(`${errors.length} error${errors.length === 1 ? '' : 's'}`)}, ${warnings.length} warning(s)\n`);
  process.exit(1);
}
console.log(`  ${green('ok')}  ${warnings.length} warning(s)${inSync ? dim('  ·  html in sync') : ''}\n`);
