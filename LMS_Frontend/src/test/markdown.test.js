import { describe, it, expect } from 'vitest';
import { renderMarkdown, tocFromMarkdown } from '@/lib/markdown';

describe('renderMarkdown', () => {
  it('renders headings with slug ids', () => {
    expect(renderMarkdown('# Title')).toBe('<h1 id="title">Title</h1>');
    expect(renderMarkdown('### Small')).toBe('<h3 id="small">Small</h3>');
  });

  it('renders bold and italic', () => {
    expect(renderMarkdown('**bold**')).toContain('<strong>bold</strong>');
    expect(renderMarkdown('*italic*')).toContain('<em>italic</em>');
  });

  it('renders bullet and numbered lists', () => {
    const ul = renderMarkdown('- one\n- two');
    expect(ul).toBe('<ul>\n<li>one</li>\n<li>two</li>\n</ul>');
    const ol = renderMarkdown('1. a\n2. b');
    expect(ol).toBe('<ol>\n<li>a</li>\n<li>b</li>\n</ol>');
  });

  it('renders inline code and code blocks', () => {
    expect(renderMarkdown('`x = 1`')).toContain('<code>x = 1</code>');
    expect(renderMarkdown('```\ncode()\n```')).toContain('<pre><code>code()</code></pre>');
  });

  it('renders safe links and blocks javascript: URLs', () => {
    expect(renderMarkdown('[site](https://a.com)')).toContain('<a href="https://a.com"');
    // javascript: URL is neutralised to an inert anchor
    const evil = renderMarkdown('[x](javascript:alert(1))');
    expect(evil).toContain('href="#"');
    expect(evil).not.toContain('javascript:');
  });

  it('escapes raw HTML (no XSS)', () => {
    const out = renderMarkdown('<img src=x onerror=alert(1)>');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
    const script = renderMarkdown('<script>alert(1)</script>');
    expect(script).not.toContain('<script>');
    expect(script).toContain('&lt;script&gt;');
  });

  it('handles empty input', () => {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown(null)).toBe('');
    expect(renderMarkdown(undefined)).toBe('');
  });
});

describe('tocFromMarkdown', () => {
  it('extracts the heading outline with levels and ids', () => {
    const md = '# Intro\nsome text\n## Setup\n### Details\n## Wrap up';
    const toc = tocFromMarkdown(md);
    expect(toc).toEqual([
      { level: 1, text: 'Intro', id: 'intro' },
      { level: 2, text: 'Setup', id: 'setup' },
      { level: 3, text: 'Details', id: 'details' },
      { level: 2, text: 'Wrap up', id: 'wrap-up' },
    ]);
  });

  it('de-duplicates repeated headings, matching the rendered ids', () => {
    const md = '## Notes\n## Notes';
    const toc = tocFromMarkdown(md);
    expect(toc.map((h) => h.id)).toEqual(['notes', 'notes-2']);
    const html = renderMarkdown(md);
    expect(html).toContain('id="notes"');
    expect(html).toContain('id="notes-2"');
  });

  it('ignores headings inside code fences and strips inline markdown from the text', () => {
    const md = '# Real **bold** heading\n```\n# not a heading\n```';
    const toc = tocFromMarkdown(md);
    expect(toc).toEqual([{ level: 1, text: 'Real bold heading', id: 'real-bold-heading' }]);
  });
});
