import { useState } from 'react';
import * as XLSX from 'xlsx';
import { AlertTriangle, CheckCircle2, Download, UploadCloud } from 'lucide-react';
import { QuestionType } from '@lms/shared';
import { Button, Select } from '@/components/ui';
import { apiErrorMessage } from '@/lib/api';
import { useBulkAddQuestions } from '@/lib/assessments';
import { QUESTION_TYPE_OPTIONS, QUESTION_TYPE_LABEL } from './assessmentsUi';

/** Normalize a spreadsheet header to a known field. */
function fieldFor(header) {
  const k = String(header).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (k === 'question' || k === 'prompt' || k === 'scenario' || k === 'questiontext') return 'prompt';
  if (k === 'option1' || k === 'optiona' || k === 'a') return 'opt1';
  if (k === 'option2' || k === 'optionb' || k === 'b') return 'opt2';
  if (k === 'option3' || k === 'optionc' || k === 'c') return 'opt3';
  if (k === 'option4' || k === 'optiond' || k === 'd') return 'opt4';
  if (k === 'correctanswer' || k === 'correct' || k === 'answer' || k === 'correctoption') return 'correct';
  if (k === 'points' || k === 'marks' || k === 'point') return 'points';
  return null;
}

function normalizeRows(raw) {
  return raw.map((row) => {
    const out = {};
    for (const [header, value] of Object.entries(row)) {
      const f = fieldFor(header);
      if (f && value != null && String(value).trim() !== '') out[f] = String(value).trim();
    }
    return out;
  });
}

/** Resolve which option index is correct from the "correct answer" cell. */
function resolveCorrect(correctRaw, options) {
  if (!correctRaw) return -1;
  const c = String(correctRaw).trim();
  const asNum = Number(c);
  if (Number.isInteger(asNum) && asNum >= 1 && asNum <= options.length) return asNum - 1; // 1-based index
  const letter = c.toUpperCase();
  if (/^[A-D]$/.test(letter)) return letter.charCodeAt(0) - 65; // A→0
  const byText = options.findIndex((o) => o.toLowerCase() === c.toLowerCase());
  return byText; // -1 if not found
}

/** Turn a parsed row into a question payload for the given type (or null if invalid). */
function rowToQuestion(row, type) {
  if (!row.prompt) return null;
  const points = Math.max(1, Math.min(100, Math.round(Number(row.points) || 1)));
  if (type !== QuestionType.MCQ) {
    return { type, prompt: row.prompt, points };
  }
  const options = [row.opt1, row.opt2, row.opt3, row.opt4].filter((o) => o && o.trim() !== '');
  if (options.length < 2) return null;
  const correctOption = resolveCorrect(row.correct, options);
  if (correctOption < 0) return null;
  return { type, prompt: row.prompt, options, correctOption, points };
}

const MCQ_HEADERS = ['question', 'option 1', 'option 2', 'option 3', 'option 4', 'correct answer', 'points'];
const TEXT_HEADERS = ['question', 'points'];

/**
 * Bulk-import questions from an Excel/CSV. Renders a Modal body (parent provides
 * the <Modal>). MCQ sheets carry question + 4 options + correct answer; other
 * types carry just the question/scenario text.
 */
export function BulkImportQuestions({ assessmentId, onClose }) {
  const [type, setType] = useState(QuestionType.MCQ);
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const bulk = useBulkAddQuestions();

  const isMcq = type === QuestionType.MCQ;
  const questions = (rows ?? []).map((r) => rowToQuestion(r, type)).filter(Boolean);
  const invalid = (rows ?? []).length - questions.length;

  async function onFile(e) {
    setError('');
    setResult(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const mapped = normalizeRows(raw);
      if (!mapped.length) setError('That file has no data rows.');
      setRows(mapped);
    } catch {
      setError('Could not read that file. Use a .xlsx or .csv export.');
      setRows(null);
    }
  }

  function downloadTemplate() {
    const headers = isMcq ? MCQ_HEADERS : TEXT_HEADERS;
    const example = isMcq
      ? ['What does LLM stand for?', 'Large Language Model', 'Low Level Machine', 'Linear Logic Map', 'Long Lived Memory', 'Large Language Model', 1]
      : ['Describe how you would design a RAG pipeline for a support chatbot.', 5];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Questions');
    XLSX.writeFile(wb, `questions-${type}-template.xlsx`);
  }

  async function submit() {
    setError('');
    try {
      const res = await bulk.mutateAsync({ id: assessmentId, questions });
      setResult({ added: questions.length, total: res?.questions?.length });
    } catch (e2) {
      setError(apiErrorMessage(e2));
    }
  }

  if (result) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-success)' }}>
          <CheckCircle2 size={20} />
          <strong>{result.added} question(s) imported.</strong>
        </div>
        <p className="lms-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
          The assessment now has {result.total ?? '—'} question(s) total.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <Select
        label="Question type"
        value={type}
        options={QUESTION_TYPE_OPTIONS}
        onChange={(e) => { setType(e.target.value); setRows(null); setFileName(''); setError(''); }}
      />

      <p className="lms-muted" style={{ fontSize: 'var(--font-size-sm)', margin: 0 }}>
        {isMcq ? (
          <>Excel columns: <strong>question</strong>, <strong>option 1–4</strong>, <strong>correct answer</strong> (the option text, or 1–4, or A–D), and optional <strong>points</strong>.</>
        ) : (
          <>For <strong>{QUESTION_TYPE_LABEL[type]}</strong>, the Excel only needs a <strong>question</strong> column (the scenario/prompt text) and optional <strong>points</strong>.</>
        )}
      </p>

      <button type="button" className="btn btn--ghost btn--sm" style={{ alignSelf: 'flex-start' }} onClick={downloadTemplate}>
        <Download size={15} style={{ marginRight: 6 }} /> Download {QUESTION_TYPE_LABEL[type]} template
      </button>

      <label className="bulk-drop">
        <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} style={{ display: 'none' }} />
        <UploadCloud size={28} />
        <span>{fileName || 'Choose a .xlsx or .csv file'}</span>
      </label>

      {rows && (
        <div style={{ fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={16} style={{ color: 'var(--color-primary)' }} />
          <span><strong>{questions.length}</strong> ready to import{invalid > 0 ? ` · ${invalid} row(s) skipped (missing question${isMcq ? '/options/correct answer' : ''})` : ''}.</span>
        </div>
      )}
      {rows && invalid > 0 && questions.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-warning)', fontSize: 'var(--font-size-sm)' }}>
          <AlertTriangle size={15} /> Check the column headers match the template.
        </div>
      )}

      {error && <div className="field__error">{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} loading={bulk.isPending} disabled={!questions.length}>
          Import {questions.length || ''} question{questions.length === 1 ? '' : 's'}
        </Button>
      </div>
    </div>
  );
}
