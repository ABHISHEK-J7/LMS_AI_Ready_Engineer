import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button, Card, Input } from '@/components/ui';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { api, apiErrorMessage, unwrap } from '@/lib/api';
import { usePublicSettings } from '@/lib/settings';
import './login.css';

export function RegisterPage() {
  const { data: settings } = usePublicSettings();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  // If self-registration is disabled, don't offer the form.
  const disabled = settings && settings.allowSelfRegistration === false;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await unwrap(api.post('/auth/register', form));
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login">
      <div className="login__theme"><ThemeSwitcher /></div>
      <div className="login__brand-panel">
        <span className="login__logo">AI</span>
        <h1 className="login__brand-title">AI Ready Engineer</h1>
        <p className="login__brand-tagline">Create your account and begin your AI engineering journey.</p>
      </div>

      <div className="login__form-panel">
        <Card className="login__card">
          {disabled ? (
            <>
              <h2>Registration closed</h2>
              <p className="lms-muted" style={{ marginTop: 'var(--space-3)' }}>
                Self-registration is currently disabled. Please contact your administrator for access.
              </p>
              <p className="login__hint"><Link to="/login">← Back to sign in</Link></p>
            </>
          ) : done ? (
            <>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Request received <CheckCircle2 size={20} style={{ color: 'var(--color-success)' }} />
              </h2>
              <p className="lms-muted" style={{ marginTop: 'var(--space-3)' }}>
                Your account is awaiting administrator approval. You'll be able to sign in once approved.
              </p>
              <p className="login__hint"><Link to="/login">← Back to sign in</Link></p>
            </>
          ) : (
            <>
              <h2 style={{ marginBottom: 4 }}>Create account</h2>
              <p className="lms-muted" style={{ marginBottom: 'var(--space-6)' }}>Register as a student.</p>
              <form onSubmit={onSubmit} className="login__form">
                <Input label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                <Input label="Email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                <Input label="Password" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                {error && <div className="field__error">{error}</div>}
                <Button type="submit" block loading={loading}>Create account</Button>
              </form>
              <p className="login__hint">
                Already have an account? <Link to="/login">Sign in</Link>
              </p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
