import { UploadCloud } from 'lucide-react';
import { MARKDOWN_HELP } from '@/lib/markdown';
import { Markdown } from './Markdown';
import './markdown.css';

/** Formatting cheat-sheet shown to article authors. */
function MarkdownHelp() {
  return (
    <div className="md-help">
      <div className="md-help__title">Formatting — type this to get that</div>
      <div className="md-help__grid">
        {MARKDOWN_HELP.map((h) => (
          <div className="md-help__row" key={h.syntax}>
            <span className="md-help__syntax">{h.syntax}</span>
            <span className="md-help__arrow">→</span>
            <span>{h.does}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Article authoring: upload a .md file (or type), with a live preview of exactly how
 * students will see it, plus the formatting guide. Controlled via value/onChange.
 */
export function ArticleEditor({ value, onChange }) {
  function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result || ''));
    reader.readAsText(file);
  }

  return (
    <div className="md-editor">
      <label className="btn btn--outline btn--sm" style={{ alignSelf: 'flex-start', cursor: 'pointer' }}>
        <UploadCloud size={15} style={{ marginRight: 6 }} /> Upload markdown (.md) file
        <input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={onFile} style={{ display: 'none' }} />
      </label>

      <div className="md-editor__split">
        <div className="md-editor__pane">
          <span className="md-editor__label">Markdown</span>
          <textarea
            className="input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={'# My article\n\nWrite here, or upload a .md file above.\n\n- point one\n- point two'}
            spellCheck
          />
        </div>
        <div className="md-editor__pane">
          <span className="md-editor__label">Preview — how students will see it</span>
          {value.trim()
            ? <Markdown source={value} className="md-editor__preview" />
            : <div className="md-editor__preview markdown-body markdown-body--empty">Nothing to preview yet.</div>}
        </div>
      </div>

      <MarkdownHelp />
    </div>
  );
}
