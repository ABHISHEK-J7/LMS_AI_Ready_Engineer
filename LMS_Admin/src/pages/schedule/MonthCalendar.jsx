import { Star } from 'lucide-react';
import { STATUS_TONE } from './scheduleUi';
import './calendar.css';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TONE_VAR = {
  primary: 'var(--color-primary)',
  warning: 'var(--color-warning)',
  success: 'var(--color-success)',
  error: 'var(--color-error)',
  neutral: 'var(--color-text-muted)',
};

function keyFor(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Gamified month board of class sessions. `month` is a Date within the month. */
export function MonthCalendar({ month, classes = [], onSelect, onShowMore }) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(year, m, 1);
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const startOffset = (first.getDay() + 6) % 7; // Monday-first
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const gridStart = new Date(year, m, 1 - startOffset);
  const todayKey = keyFor(new Date());

  const byDay = new Map();
  for (const c of classes) {
    const k = keyFor(new Date(c.date));
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(c);
  }
  for (const list of byDay.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));

  const cells = [];
  for (let i = 0; i < totalCells; i += 1) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }

  return (
    <div className="cal">
      <div className="cal__head">
        {WEEKDAYS.map((w) => (
          <div key={w} className="cal__weekday">{w}</div>
        ))}
      </div>
      <div className="cal__grid">
        {cells.map((date, i) => {
          const k = keyFor(date);
          const items = byDay.get(k) ?? [];
          const out = date.getMonth() !== m;
          const isToday = k === todayKey;
          const has = items.length > 0;
          return (
            <div
              key={i}
              style={{ '--i': i }}
              className={`cal__cell${out ? ' cal__cell--out' : ''}${has ? ' cal__cell--has' : ''}${isToday ? ' cal__cell--today' : ''}`}
            >
              <div className="cal__cell-top">
                <span className="cal__daynum">{date.getDate()}</span>
                {has ? (
                  <span className="cal__count" title={`${items.length} session${items.length > 1 ? 's' : ''}`}>
                    {items.length}
                  </span>
                ) : isToday ? (
                  <Star size={15} className="cal__star" fill="currentColor" strokeWidth={1.5} />
                ) : null}
              </div>
              <div className="cal__events">
                {items.slice(0, 3).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`cal__event${c.status === 'cancelled' ? ' cal__event--off' : ''}`}
                    style={{ '--ev': TONE_VAR[STATUS_TONE[c.status]] }}
                    title={`${c.startTime} · ${c.title}${c.batch?.name ? ` · ${c.batch.name}` : ''}`}
                    onClick={() => onSelect?.(c)}
                  >
                    <span className="cal__event-time">{c.startTime}</span>
                    <span className="cal__event-title">{c.title}</span>
                  </button>
                ))}
                {items.length > 3 && (
                  <button type="button" className="cal__more" onClick={() => onShowMore?.(date, items)}>
                    +{items.length - 3} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
