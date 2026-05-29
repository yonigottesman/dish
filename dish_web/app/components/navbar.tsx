'use client';

import Link from 'next/link';
import { useAuth } from '../context/auth-context';

function initials(user: { full_name?: string; username?: string; email?: string } | null) {
  if (!user) return '?';
  const source = user.full_name || user.username || user.email || '';
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]);
  return source.slice(0, 2) || '?';
}

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav style={{
      background: 'rgba(246, 245, 242, 0.82)',
      backdropFilter: 'saturate(180%) blur(12px)',
      borderBottom: '1px solid var(--border)',
      padding: '12px 0',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Link
          href="/"
          style={{
            fontSize: '16px',
            fontWeight: 650,
            letterSpacing: '-0.01em',
            color: 'var(--ink)',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
          }}
        >
          <span style={{
            width: '30px', height: '30px', display: 'grid', placeItems: 'center',
            fontSize: '17px', background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '9px', boxShadow: 'var(--shadow-sm)',
          }}>🍜</span>
          Dish
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user && (
            <div
              title={user.full_name || user.username}
              className="avatar"
              aria-hidden
            >
              {initials(user)}
            </div>
          )}
          <button onClick={() => logout()} className="btn btn-ghost btn-sm">
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
