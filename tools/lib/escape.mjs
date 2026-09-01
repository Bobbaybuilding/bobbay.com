// Escaping for HTML and XML. Every interpolated value passes through here:
// a post title containing an ampersand or an angle bracket must not be able
// to break out of the attribute or element it lands in.

const HTML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function htmlEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => HTML[ch]);
}

export const xmlEscape = htmlEscape;
