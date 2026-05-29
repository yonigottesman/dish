'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

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

        {user && (
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setMenuOpen(o => !o)}
              title={user.full_name || user.username}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="avatar"
              style={{ border: 'none', cursor: 'pointer', padding: 0 }}
            >
              {initials(user)}
            </button>
            {menuOpen && (
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  minWidth: '140px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  boxShadow: 'var(--shadow-md, 0 8px 24px rgba(0,0,0,0.08))',
                  overflow: 'hidden',
                  zIndex: 60,
                }}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); logout(); }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 14px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: 'var(--ink)',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--hover, rgba(0,0,0,0.04))'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
