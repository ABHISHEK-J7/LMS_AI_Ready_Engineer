import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { prefersReducedMotion } from '@/lib/anim';
import './charts.css';

const SIZE = 132;
const STROKE = 14;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

/**
 * Single-value radial gauge (0–100). The arc and the center number animate up
 * together. `tone` selects the arc color (primary | success | warning | error).
 *
 * @param {{ value:number, label?:string, suffix?:string, tone?:string }} props
 */
export function GaugeRing({ value = 0, label, suffix = '%', tone = 'primary' }) {
  const ref = useRef(null);
  const numRef = useRef(null);
  const pct = Math.max(0, Math.min(100, value));
  const stroke = `var(--color-${tone})`;

  useLayoutEffect(() => {
    const arc = ref.current?.querySelector('.gauge__arc');
    const num = numRef.current;
    if (!arc || !num) return undefined;
    const target = C - (pct / 100) * C;
    if (prefersReducedMotion) {
      gsap.set(arc, { strokeDashoffset: target });
      num.textContent = String(Math.round(pct));
      return undefined;
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(arc, { strokeDashoffset: C }, { strokeDashoffset: target, duration: 1, ease: 'power2.out' });
      const obj = { n: 0 };
      gsap.to(obj, {
        n: pct,
        duration: 1,
        ease: 'power2.out',
        onUpdate: () => { num.textContent = String(Math.round(obj.n)); },
      });
    }, ref);
    return () => ctx.revert();
  }, [pct, tone]);

  return (
    <div className="gauge" ref={ref}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img">
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--color-background)" strokeWidth={STROKE} />
          <circle
            className="gauge__arc"
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={stroke}
            strokeWidth={STROKE}
            strokeDasharray={C}
            strokeDashoffset={C}
            strokeLinecap="round"
          />
        </g>
        <text x="50%" y="48%" className="gauge__value" textAnchor="middle" dominantBaseline="middle">
          <tspan ref={numRef}>{Math.round(pct)}</tspan><tspan className="gauge__suffix">{suffix}</tspan>
        </text>
      </svg>
      {label && <div className="gauge__label">{label}</div>}
    </div>
  );
}
