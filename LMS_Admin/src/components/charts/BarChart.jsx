import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { chartSeriesColors } from '@/shared';
import { useTheme } from '@/theme/ThemeProvider';
import { prefersReducedMotion } from '@/lib/anim';
import './charts.css';

/**
 * Horizontal bar chart driven entirely by the active theme's palette.
 *
 * @param {{ data: {label:string,value:number}[], max?:number, suffix?:string,
 *   multicolor?:boolean, emptyText?:string }} props
 */
export function BarChart({ data = [], max, suffix = '', multicolor = false, emptyText = 'No data yet.' }) {
  const { theme } = useTheme();
  const palette = chartSeriesColors(theme);
  const ref = useRef(null);

  useLayoutEffect(() => {
    if (prefersReducedMotion || !ref.current) return undefined;
    const ctx = gsap.context(() => {
      gsap.from(ref.current.querySelectorAll('.bar-row__fill'), {
        scaleX: 0,
        transformOrigin: 'left center',
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.05,
      });
    }, ref);
    return () => ctx.revert();
  }, [data.length, theme]);

  if (!data.length) return <p className="chart-empty">{emptyText}</p>;
  const ceiling = Math.max(max ?? 0, ...data.map((d) => d.value), 1);

  return (
    <div className="bars" ref={ref}>
      {data.map((d, i) => (
        <div className="bar-row" key={`${d.label}-${i}`}>
          <span className="bar-row__label" title={d.label}>{d.label}</span>
          <span className="bar-row__track">
            <span
              className="bar-row__fill"
              style={{
                width: `${Math.round((d.value / ceiling) * 100)}%`,
                background: multicolor ? palette[i % palette.length] : 'var(--color-primary)',
              }}
            />
          </span>
          <span className="bar-row__value">{d.value}{suffix}</span>
        </div>
      ))}
    </div>
  );
}
