import { useMemo, useRef, useState } from 'react';
import { List, X } from 'lucide-react';
import { Markdown } from './Markdown';
import { tocFromMarkdown } from '@/lib/markdown';
import './articleReader.css';

/**
 * Reads a markdown article with a toggleable "Contents" navigation. The list icon
 * reveals the outline — larger headings for top level, smaller/indented for
 * sub-headings — and clicking an entry scrolls the article to that heading.
 */
export function ArticleReader({ source }) {
  const toc = useMemo(() => tocFromMarkdown(source), [source]);
  const [showToc, setShowToc] = useState(false);
  const bodyRef = useRef(null);

  function jump(id) {
    const el = bodyRef.current?.querySelector(`#${CSS.escape(id)}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (window.innerWidth < 720) setShowToc(false); // collapse the overlay on mobile
  }

  return (
    <div className="article-reader">
      {toc.length > 0 && (
        <button
          type="button"
          className="article-reader__toggle"
          onClick={() => setShowToc((v) => !v)}
          aria-label={showToc ? 'Hide contents' : 'Show contents'}
          aria-expanded={showToc}
          title="Contents"
        >
          {showToc ? <X size={18} /> : <List size={18} />}
        </button>
      )}

      {showToc && toc.length > 0 && (
        <nav className="article-reader__toc" aria-label="Article contents">
          <div className="article-reader__toc-title">Contents</div>
          {toc.map((h, i) => (
            <button
              type="button"
              key={`${h.id}-${i}`}
              className={`article-toc__link article-toc__link--h${Math.min(h.level, 3)}`}
              onClick={() => jump(h.id)}
            >
              {h.text}
            </button>
          ))}
        </nav>
      )}

      <div className="article-reader__body" ref={bodyRef}>
        <Markdown source={source} />
      </div>
    </div>
  );
}
