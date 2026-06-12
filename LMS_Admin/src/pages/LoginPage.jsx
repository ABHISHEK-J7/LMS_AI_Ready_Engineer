import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Button, Card, Input } from '@/components/ui';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useEntrance } from '@/lib/anim';
import './login.css';

export function LoginPage() {
  const login = useAuth((s) => s.login);
  const navigate = useNavigate();
  const cardRef = useEntrance({ y: 28, scale: 0.97, duration: 0.65 });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login">
      <div className="login__theme">
        <ThemeSwitcher />
      </div>

      <div className="login__brand-panel">
        <span className="login__logo">AI</span>
        <h1 className="login__brand-title">AI Ready Engineer</h1>
        <p className="login__brand-tagline">
          Administrator Console — manage users, batches, curriculum, scheduling, assessments,
          certificates, and platform settings.
        </p>
      </div>

      <div className="login__form-panel">
        <Card className="login__card" ref={cardRef}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', color: 'var(--color-primary)' }}>
            <ShieldCheck size={20} strokeWidth={2.2} />
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>Admin access</span>
          </div>
          <h2 style={{ marginBottom: 4 }}>Admin sign in</h2>
          <p className="lms-muted" style={{ marginBottom: 'var(--space-6)' }}>
            This portal is restricted to administrators.
          </p>

          <form onSubmit={onSubmit} className="login__form">
            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="admin@institution.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <div className="field__error">{error}</div>}
            <Button type="submit" block loading={loading}>
              Sign in
            </Button>
          </form>

          <p className="lms-muted login__hint">
            Students and trainers use the main application.
          </p>
        </Card>
      </div>
    </div>
  );
}
