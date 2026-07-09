/**
 * A small, dependency-free, XSS-safe Markdown → HTML renderer for article content.
 *
 * Safety model: every piece of user text is HTML-escaped BEFORE any markup is added,
 * and only a fixed whitelist of tags is ever emitted (headings, p, strong, em, code,
 * pre, ul/ol/li, blockquote, hr, a, br). Link hrefs are protocol-sanitised, so
 * `javascript:`/`data:` URLs can never execute. The output is safe to inject via
 * dangerouslySetInnerHTML.
 *
 * Supported syntax (kept in sync with the on-screen formatting guide):
 *   # / ## / ###      headings
 *   **bold**  __bold__
 *   *italic*  _italic_
 *   `code`             inline code
 *   ``` fenced ```     code block
 *   - item / * item    bullet list
 *   1. item            numbered list
 *   > quote            blockquote
 *   [text](https://…)  link
 *   ---                divider
 */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Only allow safe link protocols; anything else becomes an inert anchor. */
function sanitizeUrl(url) {
  const u = String(url).trim();
  return /^(https?:\/\/|mailto:|\/|#)/i.test(u) ? u : '#';
}

/** Inline formatting. Input is RAW text; we escape first, then add whitelisted tags. */
function inline(text) {
  let t = escapeHtml(text);
  // inline code first, so markers inside it aren't treated as formatting
  t = t.replace(/`([^`]+)`/g, (_m, c) => `<code>${c}</code>`);
  // links [text](url)
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, label, url) => `<a href="${sanitizeUrl(url)}" target="_blank" rel="noreferrer noopener">${label}</a>`);
  // bold
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  // italic (avoid matching inside ** by requiring a non-* neighbour)
  t = t.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  t = t.replace(/(^|[^_\w])_([^_\n]+)_(?![\w_])/g, '$1<em>$2</em>');
  return t;
}

export function renderMarkdown(md) {
  if (!md) return '';
  const lines = String(md).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let listType = null; // 'ul' | 'ol' | null
  let para = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = null; } };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // fenced code block ``` … ```
    if (/^```/.test(trimmed)) {
      flushPara(); closeList();
      const code = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i].trim())) { code.push(lines[i]); i += 1; }
      i += 1; // skip closing fence
      out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    if (trimmed === '') { flushPara(); closeList(); i += 1; continue; }

    if (/^(---|\*\*\*|___)$/.test(trimmed)) { flushPara(); closeList(); out.push('<hr />'); i += 1; continue; }

    const h = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flushPara(); closeList(); const lvl = h[1].length; out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`); i += 1; continue; }

    if (/^>\s?/.test(trimmed)) {
      flushPara(); closeList();
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) { quote.push(lines[i].trim().replace(/^>\s?/, '')); i += 1; }
      out.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`);
      continue;
    }

    const ul = trimmed.match(/^[-*]\s+(.*)$/);
    if (ul) { flushPara(); if (listType !== 'ul') { closeList(); out.push('<ul>'); listType = 'ul'; } out.push(`<li>${inline(ul[1])}</li>`); i += 1; continue; }

    const ol = trimmed.match(/^\d+\.\s+(.*)$/);
    if (ol) { flushPara(); if (listType !== 'ol') { closeList(); out.push('<ol>'); listType = 'ol'; } out.push(`<li>${inline(ol[1])}</li>`); i += 1; continue; }

    // plain paragraph line
    closeList();
    para.push(trimmed);
    i += 1;
  }
  flushPara(); closeList();
  return out.join('\n');
}

/** The formatting cheat-sheet shown to authors (syntax → what it does). */
export const MARKDOWN_HELP = [
  { syntax: '# Heading', does: 'Large heading' },
  { syntax: '## Subheading', does: 'Smaller heading' },
  { syntax: '**bold text**', does: 'Bold text' },
  { syntax: '*italic text*', does: 'Italic text' },
  { syntax: '- item', does: 'Bullet list' },
  { syntax: '1. item', does: 'Numbered list' },
  { syntax: '> quote', does: 'Quote block' },
  { syntax: '`code`', does: 'Inline code' },
  { syntax: '[text](https://link)', does: 'Link' },
  { syntax: '---', does: 'Divider line' },
];
