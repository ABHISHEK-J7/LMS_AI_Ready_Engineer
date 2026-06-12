import { forwardRef } from 'react';
import './ui.css';

export const Card = forwardRef(function Card(
  { pad = true, hover = false, className = '', children, ...rest },
  ref,
) {
  const classes = ['card', pad && 'card--pad', hover && 'card--hover', className]
    .filter(Boolean)
    .join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      {children}
    </div>
  );
});

export function CardHeader({ title, subtitle }) {
  return (
    <div className="card__header">
      <div className="card__title">{title}</div>
      {subtitle && <div className="card__subtitle">{subtitle}</div>}
    </div>
  );
}
