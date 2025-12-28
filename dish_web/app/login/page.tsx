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
  const googleButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initializeGoogleSignIn = () => {
      if (window.google && googleButtonRef.current) {
        window.google.accounts.id.initialize({
          client_id: API_CONFIG.GOOGLE_CLIENT_ID,
          callback: handleGoogleCallback,
        });
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          width: '100%',
          text: 'continue_with',
        });
      }
    };

    if (window.google) {
      initializeGoogleSignIn();
    } else {
      const checkGoogleLoaded = setInterval(() => {
        if (window.google) {
          clearInterval(checkGoogleLoaded);
          initializeGoogleSignIn();
        }
      }, 100);
      setTimeout(() => clearInterval(checkGoogleLoaded), 10000);
    }
  }, []);

  const handleGoogleCallback = async (response: any) => {
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
        window.location.href = '/';
      } else {
        const errorData = await result.json();
        setError(errorData.detail || 'Google authentication failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
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
    } catch (err) {
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
    } catch (err) {
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

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid #e5e5e5',
    borderRadius: '6px',
    fontSize: '15px',
    outline: 'none',
    color: '#1a1a1a',
    marginTop: '8px',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500' as const,
    color: '#6b6b6b',
    marginBottom: '4px',
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#fafafa',
      padding: '20px',
    }}>
      <Suspense fallback={null}>
        <SearchParamsHandler setError={setError} />
      </Suspense>

      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: '#fff',
        border: '1px solid #e5e5e5',
        borderRadius: '8px',
        padding: '40px',
      }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: '600',
          color: '#1a1a1a',
          textAlign: 'center',
          marginBottom: '32px',
        }}>
          Dishes
        </h1>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e5e5e5',
          marginBottom: '28px',
        }}>
          {(['login', 'signup'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                resetForm();
              }}
              style={{
                flex: 1,
                padding: '12px',
                border: 'none',
                background: 'transparent',
                color: activeTab === tab ? '#1a1a1a' : '#999',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: activeTab === tab ? '500' : '400',
                textTransform: 'capitalize',
                borderBottom: activeTab === tab ? '2px solid #1a1a1a' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {tab === 'login' ? 'Login' : 'Sign Up'}
            </button>
          ))}
        </div>

        {error && (
          <div style={{
            padding: '12px 14px',
            background: '#fafafa',
            border: '1px solid #e5e5e5',
            borderRadius: '6px',
            color: '#1a1a1a',
            fontSize: '14px',
            marginBottom: '20px',
          }}>
            {error}
          </div>
        )}

        {/* Login Form */}
        {activeTab === 'login' && (
          <form onSubmit={handleUsernamePasswordLogin}>
            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={inputStyle}
                disabled={isLoading}
              />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                disabled={isLoading}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                background: '#1a1a1a',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '15px',
                cursor: 'pointer',
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        )}

        {/* Signup Form */}
        {activeTab === 'signup' && (
          <form onSubmit={handleSignup}>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={inputStyle}
                disabled={isLoading}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                disabled={isLoading}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Email (optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                disabled={isLoading}
              />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={labelStyle}>Full Name (optional)</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={inputStyle}
                disabled={isLoading}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                background: '#1a1a1a',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '15px',
                cursor: 'pointer',
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              {isLoading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        )}

        {/* Divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          margin: '28px 0',
        }}>
          <div style={{ flex: 1, height: '1px', background: '#e5e5e5' }} />
          <span style={{ padding: '0 16px', color: '#999', fontSize: '13px' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: '#e5e5e5' }} />
        </div>

        {/* Google Sign-In */}
        <div
          ref={googleButtonRef}
          style={{ display: isLoading ? 'none' : 'block' }}
        />
        {isLoading && (
          <div style={{
            padding: '12px',
            border: '1px solid #e5e5e5',
            borderRadius: '6px',
            textAlign: 'center',
            color: '#999',
            fontSize: '14px',
          }}>
            Authenticating...
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <LoginPageContent />;
}
