import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '@/components/ui';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { usePublicSettings } from '@/lib/settings';
import { requestOtp, setPassword as setPasswordApi, verifyOtp } from '@/lib/account';
import './login.css';

// Each step's card flips in as a 3D turning panel. The card is FLAT at rest
// (a normal element) so its inputs/buttons are always reliably clickable —
// unlike a rotating cube, whose nested 3D context breaks hit-testing.
export function LoginPage() {
  const login = useAuth((s) => s.login);
  const { data: settings } = usePublicSettings();
  const navigate = useNavigate();

  const [step, setStep] = useState('login'); // login | otp | set | done
  const [flipKey, setFlipKey] = useState(0); // bump → replays the flip-in animation
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const otpRef = useRef(null);
  const newPassRef = useRef(null);

  function resetMsgs() {
    setError('');
    setInfo('');
  }

  function goTo(next) {
    setStep(next);
    setFlipKey((k) => k + 1); // turn the panel
  }

  // Focus the incoming face's first field once the flip settles.
  useEffect(() => {
    const t = setTimeout(() => {
      if (step === 'otp') otpRef.current?.focus();
      else if (step === 'set') newPassRef.current?.focus();
    }, 560);
    return () => clearTimeout(t);
  }, [step, flipKey]);

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
      await requestOtp(email);
      setOtp('');
      const resending = step === 'otp';
      if (!resending) goTo('otp');
      setInfo(
        resending
          ? `A new code is on its way to ${email}.`
          : `If ${email} is registered, a 6-digit code is on its way.`,
      );
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
      goTo('set');
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
      goTo('done');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function backToLogin() {
    resetMsgs();
    goTo('login');
  }

  return (
    <div className="login">
      <div className="login__theme">
        <ThemeSwitcher />
      </div>

      {/* ── Brand (35%) ── */}
      <div className="login__brand-panel">
        <span className="login__logo">AI</span>
        <h1 className="login__brand-title">AI Ready Engineer</h1>
        <p className="login__brand-tagline">
          Your structured path from absolute beginner to advanced AI Engineer — guided
          classes, trainer-led learning, and milestone certifications.
        </p>
      </div>

      {/* ── Form (65%) — a flat card that flips in 3D between steps ── */}
      <div className="login__form-panel">
        <div className="login__stage">
          {/* First load slides in from the left edge of the screen; later steps
              spin in place. The card is flat at rest, so inputs stay clickable. */}
          <div className={`login__card3d${flipKey === 0 ? ' login__card3d--enter' : ''}`} key={flipKey}>
            {step === 'login' && (
              <div className="login__face-inner">
                <h2 className="login__title">Welcome back</h2>
                <p className="lms-muted login__sub">Sign in to your learning portal.</p>
                <form onSubmit={onLogin} className="login__form">
                  <Input label="Email" name="email" type="email" autoComplete="email"
                    placeholder="you@institution.edu" value={email}
                    onChange={(e) => setEmail(e.target.value)} required />
                  <Input label="Password" name="password" type="password" autoComplete="current-password"
                    placeholder="••••••••" value={password}
                    onChange={(e) => setPassword(e.target.value)} required />
                  {error && <div className="field__error">{error}</div>}
                  <Button type="submit" block loading={loading}>Sign in</Button>
                </form>
                <button type="button" className="login__link-btn" onClick={startOtp} disabled={loading}>
                  First time here, or forgot your password? Set it with an email code
                </button>
                <p className="lms-muted login__hint">
                  Access is managed by your administrator. Contact them if you cannot sign in.
                </p>
              </div>
            )}

            {step === 'otp' && (
              <div className="login__face-inner">
                <h2 className="login__title">Enter your code</h2>
                <p className="lms-muted login__sub">
                  We sent a 6-digit code to <strong>{email}</strong>. It expires in 10 minutes.
                </p>
                <form onSubmit={onVerifyOtp} className="login__form">
                  <Input ref={otpRef} label="6-digit code" name="otp" inputMode="numeric"
                    autoComplete="one-time-code" placeholder="123456" maxLength={6} value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} required />
                  {info && <div className="lms-muted" style={{ fontSize: 'var(--font-size-sm)' }}>{info}</div>}
                  {error && <div className="field__error">{error}</div>}
                  <Button type="submit" block loading={loading} disabled={otp.length !== 6}>Verify code</Button>
                </form>
                <div className="login__row">
                  <button type="button" className="login__link-btn" onClick={backToLogin}>Back to sign in</button>
                  <button type="button" className="login__link-btn" onClick={startOtp} disabled={loading}>Resend code</button>
                </div>
              </div>
            )}

            {step === 'set' && (
              <div className="login__face-inner">
                <h2 className="login__title">Set your password</h2>
                <p className="lms-muted login__sub">Choose a password for <strong>{email}</strong>.</p>
                <form onSubmit={onSetPassword} className="login__form">
                  <Input ref={newPassRef} label="New password" name="new-password" type="password"
                    autoComplete="new-password" placeholder="At least 8 characters" value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)} required />
                  <Input label="Confirm password" name="confirm-password" type="password"
                    autoComplete="new-password" placeholder="Re-enter your password" value={confirm}
                    onChange={(e) => setConfirm(e.target.value)} required />
                  {error && <div className="field__error">{error}</div>}
                  <Button type="submit" block loading={loading}>Save password</Button>
                </form>
              </div>
            )}

            {step === 'done' && (
              <div className="login__face-inner login__face-inner--center">
                <div className="login__done-mark">✓</div>
                <h2 className="login__title">You&apos;re all set</h2>
                <p className="lms-muted login__sub">
                  Your password is ready. Sign in with <strong>{email}</strong> and your new password.
                </p>
                <Button block onClick={backToLogin}>Continue to sign in</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
