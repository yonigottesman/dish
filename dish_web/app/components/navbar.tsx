'use client';

import Link from 'next/link';
import { useAuth } from '../context/auth-context';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav style={{
      background: '#f7f6f3',
      borderBottom: '1px solid #e9e9e7',
      padding: '12px 20px'
    }}>
      <div style={{ 
        maxWidth: '800px', 
        margin: '0 auto', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>🍜</span>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '8px 16px',
              background: '#37352f',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '3px',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Home
          </Link>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {user?.username && (
              <span style={{ fontSize: '14px', color: '#666' }}>
                {user.full_name || user.username}
              </span>
            )}
            <button
              onClick={() => logout()}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                color: '#666',
                border: '1px solid #e9e9e7',
                borderRadius: '3px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
} 