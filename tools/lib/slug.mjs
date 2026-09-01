const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function kebab(input) {
  return String(input)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '');
}

export function isValidId(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= 48 && SLUG_RE.test(id);
}
