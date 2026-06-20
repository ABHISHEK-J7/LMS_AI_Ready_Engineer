import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { AlertTriangle, CheckCircle2, Download, FileQuestion, Lock, Pencil, Plus, Trash2, UploadCloud, X } from 'lucide-react';
import { QuestionType, UserRole } from '@/shared';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Input, Modal, Select, SkeletonTable, useConfirm } from '@/components/ui';
import { PageHeader } from '@/components/PageHeader';
import { apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useModules } from '@/lib/modules';
import {
  useAddBankQuestion,
  useBulkAddBankQuestions,
  useDeleteBankQuestion,
  useQuestionBank,
  useUpdateBankQuestion,
} from '@/lib/questionBank';
import { QUESTION_TYPE_LABEL, QUESTION_TYPE_OPTIONS } from '../assessments/assessmentsUi';
import '../modules/modules.css';

const GENERAL = '__general__'; // sentinel for "no specific topic"

export function QuestionBankPage() {
  const role = useAuth((s) => s.user?.role);
  const confirm = useConfirm();
  const { data: modules } = useModules();
  const [moduleId, setModuleId] = useState('');
  const [topicFilter, setTopicFilter] = useState(''); // '' = all, GENERAL, or topicId
  const { data: items, isLoading, isError, error, refetch } = useQuestionBank({ module: moduleId });

  const moduleObj = useMemo(() => (modules ?? []).find((m) => m.id === moduleId), [modules, moduleId]);
  const topics = moduleObj?.topics ?? [];

  const [editing, setEditing] = useState(null); // question item or {} for new
  const [importing, setImporting] = useState(false);
  const del = useDeleteBankQuestion();

  if (role === UserRole.STUDENT) {
    return (
      <EmptyState
        icon={<Lock size={26} />}
        title="Restricted"
        description="The question bank is for trainers and admins."
      />
    );
  }

  const filtered = (items ?? []).filter((q) => {
    if (!topicFilter) return true;
    if (topicFilter === GENERAL) return !q.topic;
    return q.topic === topicFilter;
  });

  return (
    <>
      <PageHeader
        title="Question Bank"
        subtitle="Dump questions per module (manually or from Excel). Tests are built by picking from here."
      />

      <div className="toolbar">
        <div style={{ flex: '1 1 16rem', minWidth: 0, maxWidth: '22rem' }}>
          <Select
            value={moduleId}
            onChange={(e) => { setModuleId(e.target.value); setTopicFilter(''); }}
            options={[
              { value: '', label: 'Select a module…' },
              ...(modules ?? []).map((m) => ({ value: m.id, label: `${m.name} (${m.code})` })),
            ]}
          />
        </div>
        {moduleId && (
          <div style={{ flex: '1 1 12rem', minWidth: 0, maxWidth: '16rem' }}>
            <Select
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
              options={[
                { value: '', label: 'All topics' },
                { value: GENERAL, label: 'General (whole module)' },
                ...topics.map((t) => ({ value: t.id, label: t.title })),
              ]}
            />
          </div>
        )}
        {moduleId && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginLeft: 'auto' }}>
            <Button variant="outline" onClick={() => setImporting(true)}>
              <UploadCloud size={15} style={{ marginRight: 6 }} /> Import Excel
            </Button>
            <Button onClick={() => setEditing({})}>
              <Plus size={15} style={{ marginRight: 6 }} /> Add question
            </Button>
          </div>
        )}
      </div>

      {!moduleId ? (
        <EmptyState
          icon={<FileQuestion size={26} />}
          title="Choose a module"
          description="Choose a module to view and build its question bank."
        />
      ) : isError ? (
        <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />
      ) : isLoading && !items ? (
        <Card>
          <SkeletonTable rows={6} cols={7} />
        </Card>
      ) : (
        <Card>
          <CardHeader
            title={`${filtered.length} question${filtered.length === 1 ? '' : 's'}`}
            subtitle={topicFilter ? 'Filtered by topic' : 'All topics in this module'}
          />
          {filtered.length === 0 ? (
            <EmptyState
              icon={<FileQuestion size={26} />}
              title="No questions yet"
              description="No questions yet. Add one, or import an Excel file."
              action={<Button onClick={() => setEditing({})}><Plus size={15} style={{ marginRight: 6 }} /> Add question</Button>}
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>#</th><th>Question</th><th>Type</th><th>Topic</th><th>Answer</th><th>Pts</th><th /></tr>
                </thead>
                <tbody>
                  {filtered.map((q, i) => (
                    <tr key={q.id}>
                      <td>{i + 1}</td>
                      <td style={{ maxWidth: '24rem' }}>{q.prompt}</td>
                      <td><Badge tone="neutral">{QUESTION_TYPE_LABEL[q.type]}</Badge></td>
                      <td>{q.topicTitle ? <Badge tone="primary">{q.topicTitle}</Badge> : <span className="lms-muted">General</span>}</td>
                      <td className="lms-muted">
                        {q.type === QuestionType.MCQ && q.options?.[q.correctOption] != null ? q.options[q.correctOption] : '—'}
                      </td>
                      <td>{q.points}</td>
                      <td>
                        <div className="list-actions">
                          <Button size="sm" variant="ghost" onClick={() => setEditing(q)}><Pencil size={14} /></Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => { if (await confirm({ title: 'Delete this question from the bank?', tone: 'danger', confirmLabel: 'Delete' })) del.mutate(q.id); }}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {editing && (
        <BankQuestionModal
          moduleId={moduleId}
          topics={topics}
          question={editing.id ? editing : null}
          onClose={() => setEditing(null)}
        />
      )}

      <Modal open={importing} title="Import questions from Excel" size="lg" onClose={() => setImporting(false)}>
        <BankExcelImport moduleId={moduleId} topics={topics} onClose={() => setImporting(false)} />
      </Modal>
    </>
  );
}

// ── Add / edit a single question ────────────────────────────────────────────────

const BLANK_Q = { type: QuestionType.MCQ, prompt: '', options: ['', ''], correctOption: 0, points: 1, topic: '' };

function BankQuestionModal({ moduleId, topics, question, onClose }) {
  const isEdit = Boolean(question);
  const [form, setForm] = useState(BLANK_Q);
  const [err, setErr] = useState('');
  const add = useAddBankQuestion();
  const update = useUpdateBankQuestion();

  useEffect(() => {
    setErr('');
    setForm(
      question
        ? {
            type: question.type,
            prompt: question.prompt,
            options: question.options?.length ? [...question.options] : ['', ''],
            correctOption: question.correctOption ?? 0,
            points: question.points ?? 1,
            topic: question.topic ?? '',
          }
        : BLANK_Q,
    );
  }, [question]);

  const isMcq = form.type === QuestionType.MCQ;
  const setOption = (i, v) => setForm((f) => ({ ...f, options: f.options.map((o, idx) => (idx === i ? v : o)) }));
  const addOption = () => setForm((f) => ({ ...f, options: [...f.options, ''] }));
  const removeOption = (i) =>
    setForm((f) => {
      const options = f.options.filter((_, idx) => idx !== i);
      return { ...f, options, correctOption: Math.min(f.correctOption, options.length - 1) };
    });

  async function save(e) {
    e.preventDefault();
    setErr('');
    const payload = {
      type: form.type,
      prompt: form.prompt,
      points: Number(form.points) || 1,
      topic: form.topic || null,
      ...(isMcq
        ? { options: form.options.map((o) => o.trim()).filter(Boolean), correctOption: form.correctOption }
        : { options: [] }),
    };
    try {
      if (isEdit) await update.mutateAsync({ id: question.id, ...payload });
      else await add.mutateAsync({ module: moduleId, ...payload });
      onClose();
    } catch (e2) {
      setErr(apiErrorMessage(e2));
    }
  }

  return (
    <Modal
      open
      title={isEdit ? 'Edit question' : 'Add question'}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button form="bank-q-form" type="submit" loading={add.isPending || update.isPending}>Save</Button>
        </>
      }
    >
      <form id="bank-q-form" onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={QUESTION_TYPE_OPTIONS} />
        <Select
          label="Topic (optional)"
          value={form.topic}
          onChange={(e) => setForm({ ...form, topic: e.target.value })}
          options={[{ value: '', label: 'General (whole module)' }, ...topics.map((t) => ({ value: t.id, label: t.title }))]}
        />
        <Input label="Question prompt" value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} required />
        {isMcq && (
          <div className="field">
            <label className="field__label">Options (select the correct answer)</label>
            {form.options.map((opt, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                <input type="radio" name="bank-correct" checked={form.correctOption === i} onChange={() => setForm({ ...form, correctOption: i })} />
                <input className="input" value={opt} onChange={(e) => setOption(i, e.target.value)} placeholder={`Option ${i + 1}`} />
                {form.options.length > 2 && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeOption(i)}><X size={15} /></Button>
                )}
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={addOption}>+ Option</Button>
          </div>
        )}
        <Input label="Points" type="number" min="1" max="100" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} />
        {!isMcq && <p className="lms-muted" style={{ fontSize: 'var(--font-size-xs)' }}>Non-MCQ questions are graded by the AI evaluation engine.</p>}
        {err && <span className="field__error">{err}</span>}
      </form>
    </Modal>
  );
}

// ── Excel import → bank ───────────────────────────────────────────────────────

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
function resolveCorrect(correctRaw, options) {
  if (!correctRaw) return -1;
  const c = String(correctRaw).trim();
  const asNum = Number(c);
  if (Number.isInteger(asNum) && asNum >= 1 && asNum <= options.length) return asNum - 1;
  const letter = c.toUpperCase();
  if (/^[A-D]$/.test(letter)) return letter.charCodeAt(0) - 65;
  return options.findIndex((o) => o.toLowerCase() === c.toLowerCase());
}
function rowToQuestion(row, type) {
  if (!row.prompt) return null;
  const points = Math.max(1, Math.min(100, Math.round(Number(row.points) || 1)));
  if (type !== QuestionType.MCQ) return { type, prompt: row.prompt, points };
  const options = [row.opt1, row.opt2, row.opt3, row.opt4].filter((o) => o && o.trim() !== '');
  if (options.length < 2) return null;
  const correctOption = resolveCorrect(row.correct, options);
  if (correctOption < 0) return null;
  return { type, prompt: row.prompt, options, correctOption, points };
}

const MCQ_HEADERS = ['question', 'option 1', 'option 2', 'option 3', 'option 4', 'correct answer', 'points'];
const TEXT_HEADERS = ['question', 'points'];

function BankExcelImport({ moduleId, topics, onClose }) {
  const [type, setType] = useState(QuestionType.MCQ);
  const [topic, setTopic] = useState('');
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const bulk = useBulkAddBankQuestions();

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
    XLSX.writeFile(wb, `question-bank-${type}-template.xlsx`);
  }

  async function submit() {
    setError('');
    try {
      const res = await bulk.mutateAsync({ module: moduleId, topic: topic || null, items: questions });
      setResult({ added: res?.added ?? questions.length });
    } catch (e2) {
      setError(apiErrorMessage(e2));
    }
  }

  if (result) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-success)' }}>
          <CheckCircle2 size={20} /> <strong>{result.added} question(s) added to the bank.</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 12rem' }}>
          <Select label="Question type" value={type} options={QUESTION_TYPE_OPTIONS} onChange={(e) => { setType(e.target.value); setRows(null); setFileName(''); setError(''); }} />
        </div>
        <div style={{ flex: '1 1 12rem' }}>
          <Select
            label="Topic for these questions"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            options={[{ value: '', label: 'General (whole module)' }, ...topics.map((t) => ({ value: t.id, label: t.title }))]}
          />
        </div>
      </div>

      <p className="lms-muted" style={{ fontSize: 'var(--font-size-sm)', margin: 0 }}>
        {isMcq ? (
          <>Columns: <strong>question</strong>, <strong>option 1–4</strong>, <strong>correct answer</strong> (option text, or 1–4, or A–D), optional <strong>points</strong>.</>
        ) : (
          <>Columns: a <strong>question</strong> column (the scenario/prompt) and optional <strong>points</strong>.</>
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
          <span><strong>{questions.length}</strong> ready to add{invalid > 0 ? ` · ${invalid} row(s) skipped` : ''}.</span>
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
          Add {questions.length || ''} question{questions.length === 1 ? '' : 's'}
        </Button>
      </div>
    </div>
  );
}
