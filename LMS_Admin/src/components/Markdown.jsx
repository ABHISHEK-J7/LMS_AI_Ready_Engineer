import { renderMarkdown } from '@/lib/markdown';
import './markdown.css';

/** Renders trusted-subset Markdown as safe HTML (see lib/markdown for the safety model). */
export function Markdown({ source, className = '' }) {
  return (
    <div
      className={`markdown-body ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }}
    />
  );
}
