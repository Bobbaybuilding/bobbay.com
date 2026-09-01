import { readFileSync, existsSync } from 'node:fs';
import { writeIfChanged } from './manifest.mjs';

const start = name => `<!-- generated:${name}:start -->`;
const end = name => `<!-- generated:${name}:end -->`;

// Markers are exact literal strings. A missing, duplicated or out-of-order
// pair is an error that writes nothing: the build never guesses a location
// and never inserts markers on your behalf. Content outside the pair is
// never read or touched.
export function replaceBlock(source, name, body, { file = '<string>' } = {}) {
  const a = start(name), b = end(name);
  const firstA = source.indexOf(a), lastA = source.lastIndexOf(a);
  const firstB = source.indexOf(b), lastB = source.lastIndexOf(b);

  if (firstA === -1 || firstB === -1) throw new Error(`${file}: missing marker pair "${name}"`);
  if (firstA !== lastA || firstB !== lastB) throw new Error(`${file}: duplicate marker "${name}"`);
  if (firstB < firstA) throw new Error(`${file}: marker "${name}" end precedes start`);

  const indent = (source.slice(0, firstA).match(/\n([ \t]*)$/) ?? ['', ''])[1];
  const indented = body.trim()
    ? '\n' + body.trim().split('\n').map(l => (l ? indent + l : l)).join('\n') + '\n' + indent
    : '\n' + indent;

  return source.slice(0, firstA) + a + indented + source.slice(firstB);
}

export function injectFile(path, blocks, { check = false } = {}) {
  if (!existsSync(path)) throw new Error(`missing file: ${path}`);
  const before = readFileSync(path, 'utf8');
  let after = before;
  for (const [name, body] of Object.entries(blocks)) {
    after = replaceBlock(after, name, body, { file: path });
  }
  if (check) return { path, changed: after !== before };
  return { path, changed: writeIfChanged(path, after) };
}

export function hasMarkers(source, name) {
  return source.includes(start(name)) && source.includes(end(name));
}
