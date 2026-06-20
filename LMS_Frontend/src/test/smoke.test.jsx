import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/States';

describe('UI primitives smoke test', () => {
  it('renders a Button with its label and fires onClick', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save changes</Button>);
    const btn = screen.getByRole('button', { name: 'Save changes' });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders an EmptyState title + description', () => {
    render(<EmptyState title="No certificates yet" description="They appear here once earned." />);
    expect(screen.getByText('No certificates yet')).toBeInTheDocument();
    expect(screen.getByText('They appear here once earned.')).toBeInTheDocument();
  });

  it('renders an ErrorState with a working retry', () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Could not load" onRetry={onRetry} />);
    expect(screen.getByText('Could not load')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
