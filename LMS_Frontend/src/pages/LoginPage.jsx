import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Input } from '@/components/ui';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { usePublicSettings } from '@/lib/settings';
import { requestOtp, setPassword as setPasswordApi, verifyOtp } from '@/lib/account';
import { useEntrance } from '@/lib/anim';
import './login.css';

// Steps: 'login' → ('otp' → 'set') → 'done' → back to 'login'.
export function LoginPage() {
  const login = useAuth((s) => s.login);
  const { data: settings } = usePublicSettings();
  const navigate = useNavigate();
  const cardRef = useEntrance({ y: 28, scale: 0.97, duration: 0.65 });

  const [step, setStep] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP / set-password state
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  function resetMsgs() {
    setError('');
    setInfo('');
  }

  async function onLogin(e) {
    e.preventDefault();
    resetMsgs();
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

  async function startOtp() {
    resetMsgs();
    if (!email) {
      setError('Enter your email first, then request a code.');
      return;
    }
    setLoading(true);
    try {
      const res = await requestOtp(email);
      setDevOtp(res?.devOtp ?? '');
      setOtp('');
      setStep('otp');
      setInfo(`If ${email} is registered, a 6-digit code is on its way.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyOtp(e) {
    e.preventDefault();
    resetMsgs();
    setLoading(true);
    try {
      const { resetToken: token } = await verifyOtp(email, otp);
      setResetToken(token);
      setNewPassword('');
      setConfirm('');
      setStep('set');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function onSetPassword(e) {
    e.preventDefault();
    resetMsgs();
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await setPasswordApi(resetToken, newPassword);
      setPassword('');
      setStep('done');
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
          Your structured path from absolute beginner to advanced AI Engineer — guided
          classes, trainer-led learning, and milestone certifications.
        </p>
      </div>

      <div className="login__form-panel">
        <Card className="login__card" ref={cardRef}>
          {/* ── Sign in ─────────────────────────────────────── */}
          {step === 'login' && (
            <>
              <h2 style={{ marginBottom: 4 }}>Welcome back</h2>
              <p className="lms-muted" style={{ marginBottom: 'var(--space-6)' }}>
                Sign in to your learning portal.
              </p>
              <form onSubmit={onLogin} className="login__form">
                <Input
                  label="Email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@institution.edu"
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
              <button type="button" className="login__link-btn" onClick={startOtp} disabled={loading}>
                First time here, or forgot your password? Set it with an email code
              </button>
              <p className="lms-muted login__hint">
                {settings?.allowSelfRegistration ? (
                  <>
                    New here? <Link to="/register">Create an account</Link>
                  </>
                ) : (
                  'Access is managed by your administrator. Contact them if you cannot sign in.'
                )}
              </p>
            </>
          )}

          {/* ── Enter OTP ───────────────────────────────────── */}
          {step === 'otp' && (
            <>
              <h2 style={{ marginBottom: 4 }}>Enter your code</h2>
              <p className="lms-muted" style={{ marginBottom: 'var(--space-6)' }}>
                We sent a 6-digit code to <strong>{email}</strong>. It expires in 10 minutes.
              </p>
              <form onSubmit={onVerifyOtp} className="login__form">
                <Input
                  label="6-digit code"
                  name="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                />
                {devOtp && (
                  <div className="lms-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                    Dev mode (email not configured): your code is <strong>{devOtp}</strong>
                  </div>
                )}
                {info && <div className="lms-muted" style={{ fontSize: 'var(--font-size-sm)' }}>{info}</div>}
                {error && <div className="field__error">{error}</div>}
                <Button type="submit" block loading={loading} disabled={otp.length !== 6}>
                  Verify code
                </Button>
              </form>
              <div className="login__row">
                <button type="button" className="login__link-btn" onClick={() => { setStep('login'); resetMsgs(); }}>
                  Back to sign in
                </button>
                <button type="button" className="login__link-btn" onClick={startOtp} disabled={loading}>
                  Resend code
                </button>
              </div>
            </>
          )}

          {/* ── Set new password ────────────────────────────── */}
          {step === 'set' && (
            <>
              <h2 style={{ marginBottom: 4 }}>Set your password</h2>
              <p className="lms-muted" style={{ marginBottom: 'var(--space-6)' }}>
                Choose a password for <strong>{email}</strong>.
              </p>
              <form onSubmit={onSetPassword} className="login__form">
                <Input
                  label="New password"
                  name="new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <Input
                  label="Confirm password"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
                {error && <div className="field__error">{error}</div>}
                <Button type="submit" block loading={loading}>
                  Save password
                </Button>
              </form>
            </>
          )}

          {/* ── Done ────────────────────────────────────────── */}
          {step === 'done' && (
            <>
              <h2 style={{ marginBottom: 4 }}>Password set</h2>
              <p className="lms-muted" style={{ marginBottom: 'var(--space-6)' }}>
                Your password is ready. Sign in with <strong>{email}</strong> and your new password.
              </p>
              <Button block onClick={() => { setStep('login'); resetMsgs(); }}>
                Continue to sign in
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
