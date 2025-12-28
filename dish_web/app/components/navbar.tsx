'use client';

import Link from 'next/link';
import { useAuth } from '../context/auth-context';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav style={{
      background: '#fff',
      borderBottom: '1px solid #e5e5e5',
      padding: '14px 20px',
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Link
          href="/"
          style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#1a1a1a',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '20px' }}>🍜</span>
          Dishes
        </Link>
        <button
          onClick={() => logout()}
          style={{
            padding: '8px 14px',
            background: 'transparent',
            color: '#6b6b6b',
            border: '1px solid #e5e5e5',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
