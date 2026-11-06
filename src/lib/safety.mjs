/** Serialize data for an HTML script element without allowing a closing-tag breakout. */
export function scriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/** Escape text and quoted attributes when raw HTML is needed for email obfuscation. */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

/** Content links may use HTTP(S); reject executable and ambiguous URL schemes. */
export function isWebUrl(value) {
  if (typeof value !== 'string' || /[\s\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    return /^https?:\/\//i.test(value) && ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Profile links additionally support local paths and mailto addresses. */
export function isProfileUrl(value) {
  if (isWebUrl(value)) return true;
  if (typeof value !== 'string' || /[\s\\]/.test(value)) return false;
  return /^\/(?!\/)/.test(value) || /^mailto:[^@?]+@[^@?]+(?:\?.*)?$/i.test(value);
}
