import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { prefersReducedMotion } from '@/lib/anim';
import './charts.css';

/**
 * Horizontal stacked bars. Each row has N series segments sharing one track,
 * scaled against a common ceiling so rows are comparable. Animated grow-in.
 *
 * @param {{ rows: {label:string, segments:{value:number}[]}[],
 *   series: {key:string,label:string,color:string}[], emptyText?:string }} props
 */
export function StackedBarChart({ rows = [], series = [], emptyText = 'No data yet.' }) {
  const ref = useRef(null);
  const rowTotals = rows.map((r) => r.segments.reduce((s, seg) => s + (seg.value || 0), 0));
  const ceiling = Math.max(1, ...rowTotals);

  useLayoutEffect(() => {
    if (prefersReducedMotion || !ref.current) return undefined;
    const ctx = gsap.context(() => {
      gsap.from(ref.current.querySelectorAll('.sbar__seg'), {
        scaleX: 0,
        transformOrigin: 'left center',
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.04,
      });
    }, ref);
    return () => ctx.revert();
  }, [rows.length, ceiling]);

  if (!rows.length) return <p className="chart-empty">{emptyText}</p>;

  return (
    <div className="sbar" ref={ref}>
      <div className="sbar__legend">
        {series.map((s) => (
          <span key={s.key} className="sbar__legend-item">
            <span className="donut__dot" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      {rows.map((r, ri) => {
        const total = rowTotals[ri];
        return (
          <div className="sbar__row" key={`${r.label}-${ri}`}>
            <span className="sbar__label" title={r.label}>{r.label}</span>
            <span className="sbar__track">
              {r.segments.map((seg, si) => (
                (seg.value || 0) > 0 && (
                  <span
                    key={si}
                    className="sbar__seg"
                    style={{
                      width: `${((seg.value || 0) / ceiling) * 100}%`,
                      background: series[si]?.color ?? 'var(--color-primary)',
                    }}
                    title={`${series[si]?.label ?? ''}: ${seg.value}`}
                  />
                )
              ))}
            </span>
            <span className="sbar__value">{total}</span>
          </div>
        );
      })}
    </div>
  );
}
