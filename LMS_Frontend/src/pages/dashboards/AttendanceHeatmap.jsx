import { useEffect, useRef } from 'react';
import { Card, CardHeader } from '@/components/ui';
import './attendance-heatmap.css';

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WEEKS = 53; // a full year of weeks

// "Worse" statuses win when a day has more than one class.
const RANK = { absent: 3, late: 2, present: 1, excused: 0 };
const LABEL = { present: 'Present', late: 'Late', absent: 'Absent', excused: 'Excused' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['', 'Mon', '', 'Wed', '', 'Fri', '']; // rows are Sun..Sat

/** GitHub-style one-year calendar heat map of the student's attendance. */
export function AttendanceHeatmap({ records }) {
  const scrollRef = useRef(null);
  useEffect(() => {
    // Show the most recent weeks first.
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [records]);

  const byDay = new Map();
  for (const r of records ?? []) {
    const d = new Date(r.classSession?.date ?? r.markedAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = dayKey(d);
    const prev = byDay.get(key);
    if (!prev || (RANK[r.status] ?? 0) > (RANK[prev] ?? 0)) byDay.set(key, r.status);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (WEEKS * 7 - 1));
  start.setDate(start.getDate() - start.getDay()); // back to the week's Sunday

  const weeks = [];
  const cursor = new Date(start);
  let prevMonth = -1;
  while (cursor <= today) {
    const days = [];
    let monthLabel = '';
    for (let i = 0; i < 7; i += 1) {
      // Label a week-column with the month name the first time that month appears.
      if (i === 0 && cursor.getMonth() !== prevMonth) {
        monthLabel = MONTHS[cursor.getMonth()];
        prevMonth = cursor.getMonth();
      }
      const future = cursor > today;
      const key = dayKey(cursor);
      days.push({ key, date: new Date(cursor), status: future ? undefined : byDay.get(key), future });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push({ monthLabel, days });
  }

  const totalMarked = byDay.size;

  return (
    <Card>
      <CardHeader title="Attendance Heat Map" subtitle="Your class attendance over the past year" />
      {totalMarked === 0 ? (
        <p className="lms-muted">No attendance recorded yet — it‘ll appear here once your trainer marks classes.</p>
      ) : (
        <>
          <div className="hm-scroll" ref={scrollRef}>
            <div className="hm">
              <div className="hm-months">
                {weeks.map((w, i) => (
                  <div className="hm-month-cell" key={i}>{w.monthLabel}</div>
                ))}
              </div>
              <div className="hm-body">
                <div className="hm-weekdays">
                  {WEEKDAYS.map((d, i) => <div key={i} className="hm-wd">{d}</div>)}
                </div>
                <div className="hm-grid">
                  {weeks.map((w, wi) => (
                    <div className="hm-col" key={wi}>
                      {w.days.map((d) => (
                        <div
                          key={d.key}
                          className={`hm-cell${d.status ? ` hm-cell--${d.status}` : ''}${d.future ? ' hm-cell--future' : ''}`}
                          title={d.status ? `${d.date.toLocaleDateString()} · ${LABEL[d.status]}` : d.date.toLocaleDateString()}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="hm-legend">
            <span className="hm-cell hm-cell--present" /> Present
            <span className="hm-cell hm-cell--late" /> Late
            <span className="hm-cell hm-cell--absent" /> Absent
            <span className="hm-cell hm-cell--excused" /> Excused
            <span className="hm-cell" /> No class
          </div>
        </>
      )}
    </Card>
  );
}
