import { Link } from 'react-router-dom';
import { Button } from '@/components/ui';

export function NotFound() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', gap: 'var(--space-4)' }}>
      <h1 style={{ fontSize: 'var(--font-size-4xl)' }}>404</h1>
      <p className="lms-muted">This page does not exist.</p>
      <Link to="/app">
        <Button>Back to dashboard</Button>
      </Link>
    </div>
  );
}
