'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { buildApiUrl, API_CONFIG } from '../config/api';
import { useAuth, storeUser } from '../context/auth-context';

declare global {
  interface Window {
    google: any;
  }
}

// Module-level guard: the One Tap FedCM prompt must fire at most once per page
// load. React StrictMode (dev) double-invokes effects, and a second concurrent
// prompt throws "Only one navigator.credentials.get request may be outstanding
// at one time" — a source of intermittent sign-in failures that required a
// second attempt. initialize()/renderButton() are idempotent and re-run safely.
let oneTapPrompted = false;

function SearchParamsHandler({ setError }: { setError: (error: string) => void }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      setError(error === 'google_auth_failed' ? 'Google authentication failed' : error);
    }
  }, [searchParams, setError]);

  return null;
}

function LoginPageContent() {
  const { signup } = useAuth();
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  // Guard so the in-flight auth request fires only once even if One Tap and
  // the button both resolve.
  const authInFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const initializeGoogleSignIn = () => {
      if (cancelled || !window.google || !googleButtonRef.current) return;

      // initialize() must run before renderButton(). Both are idempotent, so we
      // re-run them on every mount — this keeps Google bound to the current
      // callback closure (avoids a stale callback after a client-side remount).
      window.google.accounts.id.initialize({
        client_id: API_CONFIG.GOOGLE_CLIENT_ID,
        callback: handleGoogleCallback,
        auto_select: true,            // silently sign returning users back in
        cancel_on_tap_outside: false,
        use_fedcm_for_prompt: true,   // modern Chrome flow, fewer popups
        itp_support: true,
        ux_mode: 'popup',
      });

      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'center',
      });
      setGoogleReady(true);

      // One Tap (at most once per page load): returning users with an active
      // Google session are signed in automatically, avoiding the
      // "open Google → bounce back" round trip. Guarded because a second
      // concurrent FedCM prompt throws NotAllowedError.
      if (!oneTapPrompted) {
        oneTapPrompted = true;
        window.google.accounts.id.prompt();
      }
    };

    if (window.google) {
      initializeGoogleSignIn();
    } else {
      const interval = setInterval(() => {
        if (window.google) {
          clearInterval(interval);
          initializeGoogleSignIn();
        }
      }, 100);
      const timeout = setTimeout(() => clearInterval(interval), 10000);
      return () => {
        cancelled = true;
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogleCallback = async (response: any) => {
    if (authInFlight.current) return;
    authInFlight.current = true;
    setError('');
    setIsLoading(true);

    try {
      const result = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.GOOGLE_AUTH), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credential: response.credential }),
      });

      if (result.ok) {
        const data = await result.json();
        if (data.user) {
          storeUser({
            username: data.user.username,
            email: data.user.email,
            full_name: data.user.full_name,
          });
        }
        // Full navigation so the authenticated cookie is in place for the
        // first request on the home page.
        window.location.href = '/';
        return;
      }

      const errorData = await result.json().catch(() => ({}));
      setError(errorData.detail || 'Google sign-in failed. Please try again.');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      authInFlight.current = false;
      setIsLoading(false);
    }
  };

  const handleUsernamePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);

      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.LOGIN), {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          storeUser({
            username: data.user.username,
            email: data.user.email,
            full_name: data.user.full_name,
          });
        }
        window.location.href = '/';
      } else {
        try {
          const errorData = await response.json();
          setError(errorData.detail || 'Login failed');
        } catch {
          setError('Login failed. Please check your credentials.');
        }
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signup({
        username,
        password,
        email: email || undefined,
        full_name: fullName || undefined,
      });

      if (!result.success) {
        setError(result.error || 'Signup failed');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setEmail('');
    setFullName('');
    setError('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <Suspense fallback={null}>
        <SearchParamsHandler setError={setError} />
      </Suspense>

      <div style={{ width: '100%', maxWidth: '380px' }} className="fade-up">
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '52px',
            height: '52px',
            margin: '0 auto 16px',
            display: 'grid',
            placeItems: 'center',
            fontSize: '28px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            boxShadow: 'var(--shadow-sm)',
          }}>
            🍜
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 650, letterSpacing: '-0.02em', margin: 0 }}>
            Dish
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--ink-muted)', fontSize: '14px' }}>
            Your recipes, beautifully kept.
          </p>
        </div>

        <div className="card" style={{ padding: '28px' }}>
          {/* Google first — the primary path */}
          <div style={{ minHeight: '44px', display: 'flex', justifyContent: 'center' }}>
            {isLoading ? (
              <div className="btn btn-ghost btn-block" style={{ cursor: 'default' }}>
                <span className="spinner" /> Signing you in…
              </div>
            ) : (
              <div ref={googleButtonRef} />
            )}
          </div>
          {!googleReady && !isLoading && (
            <div style={{ textAlign: 'center', color: 'var(--ink-muted)', fontSize: '13px', marginTop: '8px' }}>
              Loading Google sign-in…
            </div>
          )}

          <div className="divider" style={{ margin: '22px 0' }}>or use a password</div>

          {/* Tabs */}
          <div className="tabs" style={{ marginBottom: '22px' }}>
            {(['login', 'signup'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); resetForm(); }}
                className={`tab ${activeTab === tab ? 'tab-active' : ''}`}
              >
                {tab === 'login' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          {error && (
            <div style={{
              padding: '11px 13px',
              background: 'var(--danger-soft)',
              border: '1px solid #f1cfc8',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--danger)',
              fontSize: '13.5px',
              marginBottom: '18px',
            }}>
              {error}
            </div>
          )}

          {activeTab === 'login' && (
            <form onSubmit={handleUsernamePasswordLogin}>
              <div className="field">
                <label className="label">Username</label>
                <input type="text" required value={username}
                  onChange={(e) => setUsername(e.target.value)} className="input" disabled={isLoading} />
              </div>
              <div className="field" style={{ marginBottom: '22px' }}>
                <label className="label">Password</label>
                <input type="password" required value={password}
                  onChange={(e) => setPassword(e.target.value)} className="input" disabled={isLoading} />
              </div>
              <button type="submit" disabled={isLoading} className="btn btn-primary btn-block">
                {isLoading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}

          {activeTab === 'signup' && (
            <form onSubmit={handleSignup}>
              <div className="field">
                <label className="label">Username</label>
                <input type="text" required value={username}
                  onChange={(e) => setUsername(e.target.value)} className="input" disabled={isLoading} />
              </div>
              <div className="field">
                <label className="label">Password</label>
                <input type="password" required value={password}
                  onChange={(e) => setPassword(e.target.value)} className="input" disabled={isLoading} />
              </div>
              <div className="field">
                <label className="label">Email <span className="muted">(optional)</span></label>
                <input type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} className="input" disabled={isLoading} />
              </div>
              <div className="field" style={{ marginBottom: '22px' }}>
                <label className="label">Full name <span className="muted">(optional)</span></label>
                <input type="text" value={fullName}
                  onChange={(e) => setFullName(e.target.value)} className="input" disabled={isLoading} />
              </div>
              <button type="submit" disabled={isLoading} className="btn btn-primary btn-block">
                {isLoading ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <LoginPageContent />;
}
