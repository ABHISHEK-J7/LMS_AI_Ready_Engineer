import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { chartSeriesColors } from '@lms/shared';
import { useTheme } from '@/theme/ThemeProvider';
import { prefersReducedMotion } from '@/lib/anim';
import './charts.css';

const SIZE = 132;
const STROKE = 18;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

/**
 * Donut/ring chart with legend. Each datum is one segment; the center shows a
 * total (or a custom value/label). Theme-driven palette, animated reveal.
 *
 * @param {{ data: {label:string,value:number,color?:string}[],
 *   centerValue?: React.ReactNode, centerLabel?: string, emptyText?: string }} props
 */
export function DonutChart({ data = [], centerValue, centerLabel, emptyText = 'No data yet.' }) {
  const { theme } = useTheme();
  const palette = chartSeriesColors(theme);
  const ref = useRef(null);

  const total = data.reduce((s, d) => s + (d.value || 0), 0);

  useLayoutEffect(() => {
    if (prefersReducedMotion || !ref.current || total <= 0) return undefined;
    const ctx = gsap.context(() => {
      gsap.from(ref.current.querySelector('.donut__svg'), {
        opacity: 0,
        scale: 0.85,
        transformOrigin: '50% 50%',
        duration: 0.6,
        ease: 'power3.out',
      });
      gsap.from(ref.current.querySelector('.donut__center'), {
        opacity: 0,
        scale: 0.7,
        transformOrigin: '50% 50%',
        duration: 0.5,
        delay: 0.25,
        ease: 'back.out(1.7)',
      });
    }, ref);
    return () => ctx.revert();
  }, [total, theme]);

  if (total <= 0) return <p className="chart-empty">{emptyText}</p>;

  let acc = 0;
  const segments = data.map((d, i) => {
    const frac = (d.value || 0) / total;
    const len = frac * C;
    const seg = {
      color: d.color ?? palette[i % palette.length],
      dash: `${len} ${C - len}`,
      offset: -acc,
      pct: Math.round(frac * 100),
      ...d,
    };
    acc += len;
    return seg;
  });

  return (
    <div className="donut" ref={ref}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="donut__svg" role="img">
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="var(--color-background)"
            strokeWidth={STROKE}
          />
          {segments.map((s, i) => (
            <circle
              key={`${s.label}-${i}`}
              className="donut__seg"
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={STROKE}
              strokeDasharray={s.dash}
              strokeDashoffset={s.offset}
              strokeLinecap="butt"
            />
          ))}
        </g>
        <g className="donut__center">
          <text x="50%" y="48%" className="donut__center-value" textAnchor="middle" dominantBaseline="middle">
            {centerValue ?? total}
          </text>
          {centerLabel && (
            <text x="50%" y="63%" className="donut__center-label" textAnchor="middle" dominantBaseline="middle">
              {centerLabel}
            </text>
          )}
        </g>
      </svg>
      <ul className="donut__legend">
        {segments.map((s, i) => (
          <li key={`${s.label}-${i}`} className="donut__legend-item">
            <span className="donut__dot" style={{ background: s.color }} />
            <span className="donut__legend-label" title={s.label}>{s.label}</span>
            <span className="donut__legend-value">{s.value}<span className="donut__legend-pct"> · {s.pct}%</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
