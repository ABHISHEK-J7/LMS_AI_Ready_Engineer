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

/** Month grid of class sessions. `month` is a Date within the displayed month. */
export function MonthCalendar({ month, classes = [], onSelect }) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(year, m, 1);
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  // Monday-first offset.
  const startOffset = (first.getDay() + 6) % 7;
  const todayKey = keyFor(new Date());

  const byDay = new Map();
  for (const c of classes) {
    const k = keyFor(new Date(c.date));
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(c);
  }
  for (const list of byDay.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));

  const cells = [];
  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, m, day));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="cal">
      <div className="cal__head">
        {WEEKDAYS.map((w) => (
          <div key={w} className="cal__weekday">{w}</div>
        ))}
      </div>
      <div className="cal__grid">
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="cal__cell cal__cell--empty" />;
          const k = keyFor(date);
          const items = byDay.get(k) ?? [];
          return (
            <div key={i} className={`cal__cell${k === todayKey ? ' cal__cell--today' : ''}`}>
              <div className="cal__daynum">{date.getDate()}</div>
              {items.slice(0, 4).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="cal__event"
                  title={`${c.startTime} ${c.title} · ${c.batch?.name ?? ''}`}
                  onClick={() => onSelect?.(c)}
                >
                  <span className="cal__dot" style={{ background: TONE_VAR[STATUS_TONE[c.status]] }} />
                  <span className="cal__event-time">{c.startTime}</span> {c.title}
                </button>
              ))}
              {items.length > 4 && <div className="cal__more">+{items.length - 4} more</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
