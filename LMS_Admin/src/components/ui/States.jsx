import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from './Button';
import './states.css';

/**
 * Skeleton placeholder — a content-shaped loading block. Prefer this over a
 * full-page spinner on pages with a known layout: it preserves the page shape
 * and avoids the spinner→content layout shift.
 */
export function Skeleton({ width = '100%', height = '1rem', radius = 'var(--radius-md)', style, className = '' }) {
  return (
    <span
      className={`skeleton ${className}`.trim()}
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

/** A few stacked skeleton lines (for paragraph/detail loading). */
export function SkeletonText({ lines = 3 }) {
  return (
    <div className="skeleton-text">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height="0.75rem" width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </div>
  );
}

/** Table-shaped skeleton that mirrors the real `.table-wrap > .table` markup. */
export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="table-wrap" aria-hidden="true">
      <table className="table">
        <thead>
          <tr>{Array.from({ length: cols }).map((_, c) => (
            <th key={c}><Skeleton height="0.7rem" width="55%" /></th>
          ))}</tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>{Array.from({ length: cols }).map((_, c) => (
              <td key={c}><Skeleton height="0.8rem" width={c === 0 ? '70%' : '45%'} /></td>
            ))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A grid of card placeholders (for dashboards / tile layouts). */
export function SkeletonCards({ count = 4, height = '7rem' }) {
  return (
    <div className="skeleton-cards" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={height} radius="var(--radius-lg)" />
      ))}
    </div>
  );
}

/**
 * Thoughtful empty state — icon + title + description + optional CTA. Use when a
 * list/table has loaded but has no rows, instead of a bare "No data" line.
 */
export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="state-block">
      {icon && <div className="state-block__icon">{icon}</div>}
      {title && <h3 className="state-block__title">{title}</h3>}
      {description && <p className="state-block__desc">{description}</p>}
      {action && <div className="state-block__action">{action}</div>}
    </div>
  );
}

/**
 * Friendly error state with a retry. Pass a React Query `refetch` to onRetry so
 * a failed load is recoverable without a full page reload.
 */
export function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="state-block state-block--error">
      <div className="state-block__icon state-block__icon--error"><AlertTriangle size={26} strokeWidth={2} /></div>
      <h3 className="state-block__title">{title}</h3>
      {message && <p className="state-block__desc">{message}</p>}
      {onRetry && (
        <div className="state-block__action">
          <Button variant="outline" size="sm" onClick={onRetry}><RotateCw size={15} /> Try again</Button>
        </div>
      )}
    </div>
  );
}
