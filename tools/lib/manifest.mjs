import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const paths = {
  posts: join(ROOT, 'data', 'posts.json'),
};

export function readJson(path) {
  if (!existsSync(path)) throw new Error(`missing file: ${path}`);
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (err) { throw new Error(`${path} is not valid JSON: ${err.message}`); }
}

export const readPosts = () => readJson(paths.posts);

// Always sorted newest-first, always 2-space indent, always a trailing
// newline. A stable serialisation means a new entry is one clean git hunk.
export function writeManifest(path, data, sortKey) {
  if (sortKey && Array.isArray(data.entries)) {
    data.entries.sort((a, b) => {
      const cmp = String(b[sortKey]).localeCompare(String(a[sortKey]));
      return cmp !== 0 ? cmp : String(a.id ?? a.slug).localeCompare(String(b.id ?? b.slug));
    });
  }
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

// Writes only when the content actually differs, so a no-op build leaves a
// clean tree and stable mtimes.
export function writeIfChanged(path, content) {
  if (existsSync(path) && readFileSync(path, 'utf8') === content) return false;
  writeFileSync(path, content);
  return true;
}

