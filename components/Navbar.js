'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Music, Search, Disc, Shield, Radio, Sparkles, User, Settings, LogOut, LogIn, Clock, Menu, X, Mic, Bookmark, Globe } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

const menuItem = {
  display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px',
  borderRadius: '8px', fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-main)',
  background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', textDecoration: 'none',
};

function AccountMenu() {
  const { user, isLoaded, logout, openSignIn } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!isLoaded) {
    return <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />;
  }

  if (!user) {
    return (
      <button
        onClick={() => openSignIn()}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 18px', borderRadius: '9999px',
          background: '#EAB308', color: '#070913', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', border: 'none',
          transition: 'box-shadow 0.2s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(234,179,8,0.35)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
      >
        <LogIn size={16} />
        {t('लॉगिन', 'Sign In')}
      </button>
    );
  }

  const ring = hover || open;

  const isAdmin = user?.role === 'admin';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      {isAdmin && (
        <Link
          href="/admin"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            borderRadius: '9999px',
            background: 'rgba(234, 179, 8, 0.12)',
            border: '1px solid rgba(234, 179, 8, 0.35)',
            color: '#EAB308',
            fontSize: '0.8rem',
            fontWeight: 600,
            textDecoration: 'none',
            boxShadow: '0 0 12px rgba(234, 179, 8, 0.15)',
            transition: 'all 0.2s ease',
          }}
          title={t('प्रशासन कक्ष', 'Admin Dashboard')}
        >
          <Shield size={14} color="#EAB308" />
          <span>{t('प्रशासन', 'Admin')}</span>
        </Link>
      )}

      <div ref={ref} style={{ position: 'relative' }}>
        <style>{`.nav-menu-item:hover{background:rgba(255,255,255,0.07)!important}`}</style>
        <button
          onClick={() => setOpen((o) => !o)}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={t('खाता मेनू', 'Account menu')}
          style={{
            padding: '2px', borderRadius: '50%', cursor: 'pointer', background: 'transparent', display: 'flex',
            border: `2px solid ${isAdmin ? '#EAB308' : (ring ? '#EAB308' : 'transparent')}`,
            boxShadow: isAdmin ? '0 0 10px rgba(234,179,8,0.25)' : (ring ? '0 0 0 3px rgba(234,179,8,0.15)' : 'none'),
            transition: 'all 0.2s ease',
          }}
        >
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name || 'User'}
              style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', background: '#111' }}
            />
          ) : (
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #EAB308, #CA8A04)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#070913', fontWeight: 700, fontSize: '0.85rem'
            }}>
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
          )}
        </button>

        {open && (
          <div
            role="menu"
            style={{
              position: 'absolute', right: 0, top: 'calc(100% + 10px)', width: '248px', padding: '8px', zIndex: 60,
              background: 'rgba(10,10,14,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid var(--border-card)', borderRadius: '14px', boxShadow: '0 16px 40px rgba(0,0,0,0.7)',
            }}
          >
            <div style={{ padding: '10px 12px 12px', borderBottom: '1px solid var(--border-card)', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ fontWeight: 600, color: '#FAFAFA', fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
                {isAdmin && (
                  <span style={{
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    color: '#070913',
                    background: '#EAB308',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    letterSpacing: '0.05em'
                  }}>
                    ADMIN
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
            </div>

            <Link href="/profile" role="menuitem" className="nav-menu-item" style={menuItem} onClick={() => setOpen(false)}>
              <User size={16} color="var(--text-secondary)" /> {t('प्रोफाइल', 'Profile')}
            </Link>
            <Link href="/profile?tab=history" role="menuitem" className="nav-menu-item" style={menuItem} onClick={() => setOpen(false)}>
              <Clock size={16} color="var(--text-secondary)" /> {t('श्रवण इतिहास', 'Watch History')}
            </Link>
            <Link href="/profile?tab=settings" role="menuitem" className="nav-menu-item" style={menuItem} onClick={() => setOpen(false)}>
              <Settings size={16} color="var(--text-secondary)" /> {t('सेटिंग्स', 'Settings')}
            </Link>
            {isAdmin && (
              <Link href="/admin" role="menuitem" className="nav-menu-item" style={{ ...menuItem, color: '#EAB308' }} onClick={() => setOpen(false)}>
                <Shield size={16} color="#EAB308" /> {t('प्रशासन', 'Admin')}
              </Link>
            )}
            <button
              role="menuitem"
              className="nav-menu-item"
              style={{ ...menuItem, color: '#EF4444', marginTop: '4px' }}
              onClick={() => { setOpen(false); logout(); }}
            >
              <LogOut size={16} color="#EF4444" /> {t('लॉगआउट', 'Log Out')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const { t, language, toggleLanguage } = useLanguage();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close on Escape key
  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  const navLinks = [
    { href: '/', labelMaithili: 'गीत संग्रह', labelEnglish: 'Explore', icon: Music },
    { href: '/categories', labelMaithili: 'संस्कार एवं विधा', labelEnglish: 'Categories', icon: Disc },
    { href: '/artists', labelMaithili: 'गायक', labelEnglish: 'Artists', icon: Mic },
    { href: '/playlists', labelMaithili: 'प्लेलिस्ट', labelEnglish: 'Playlists', icon: Sparkles },
    { href: '/community', labelMaithili: 'समुदाय (गाउ)', labelEnglish: 'Community', icon: Radio, isCommunity: true },
    ...(user?.role === 'admin'
      ? [{ href: '/admin', labelMaithili: 'प्रशासन', labelEnglish: 'Admin', icon: Shield, isAdmin: true }]
      : [])
  ];

  return (
    <header className="glass-nav" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
      <style>{`
        @media (max-width: 959px) {
          .glass-nav-header {
            padding: 0 16px !important;
            height: 64px !important;
          }
        }
        .mobile-nav-backdrop {
          position: fixed;
          top: 64px;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          z-index: 48;
        }
        .mobile-nav-drawer {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: rgba(12, 14, 22, 0.98);
          backdrop-filter: blur(30px);
          -webkit-backdrop-filter: blur(30px);
          border-bottom: 2px solid rgba(234, 179, 8, 0.35);
          box-shadow: 0 24px 50px rgba(0, 0, 0, 0.9);
          padding: 14px 16px 20px;
          z-index: 49;
          animation: mobileDrawerSlide 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes mobileDrawerSlide {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .mobile-nav-tabs-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .mobile-nav-tab-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          text-decoration: none;
          transition: all 0.2s ease;
        }
        .mobile-nav-tab-link:hover, .mobile-nav-tab-link:active {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.16);
        }
        .mobile-nav-tab-link.is-active {
          background: linear-gradient(90deg, rgba(234, 179, 8, 0.18) 0%, rgba(234, 179, 8, 0.06) 100%);
          border-color: rgba(234, 179, 8, 0.5);
          box-shadow: 0 4px 16px rgba(234, 179, 8, 0.12);
        }
        .mobile-nav-tab-link.is-admin {
          border-color: rgba(234, 179, 8, 0.35);
        }
        .mobile-nav-tab-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .mobile-nav-tab-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          flex-shrink: 0;
          transition: all 0.2s ease;
        }
        .mobile-nav-tab-link.is-active .mobile-nav-tab-icon {
          background: rgba(234, 179, 8, 0.25);
          color: #EAB308;
          box-shadow: 0 0 12px rgba(234, 179, 8, 0.3);
        }
        .mobile-nav-tab-link.is-admin .mobile-nav-tab-icon {
          color: #EAB308;
        }
        .mobile-nav-tab-title {
          font-size: 1.05rem;
          font-weight: 600;
          color: #FAFAFA;
          line-height: 1.2;
        }
        .mobile-nav-tab-link.is-active .mobile-nav-tab-title {
          color: #EAB308;
          font-weight: 700;
        }
        .mobile-nav-tab-badge {
          font-size: 0.72rem;
          padding: 2px 8px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.06);
          color: var(--text-muted);
          font-weight: 500;
        }
        .mobile-nav-tab-link.is-active .mobile-nav-tab-badge {
          background: rgba(234, 179, 8, 0.25);
          color: #EAB308;
          font-weight: 600;
        }
        .mobile-nav-footer {
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .mobile-nav-lang-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 999px;
          background: rgba(234, 179, 8, 0.12);
          border: 1px solid rgba(234, 179, 8, 0.3);
          color: #EAB308;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
        }
      `}</style>

      <div className="glass-nav-header" style={{
        maxWidth: '1380px', margin: '0 auto', padding: '0 24px', height: '74px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px'
      }}>
        {/* Brand / Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <Music size={24} color="#EAB308" strokeWidth={2} />
          <span className="font-traditional" style={{ fontSize: '1.45rem', fontWeight: 600, color: '#FAFAFA', letterSpacing: '-0.01em', lineHeight: 1 }}>
            सुर-मिथिला
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav style={{ display: 'none', alignItems: 'center', gap: '8px' }} className="desktop-nav" suppressHydrationWarning>
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
            const isGold = link.isAdmin;
            return (
              <Link
                key={link.href}
                href={link.href}
                suppressHydrationWarning
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 4px', margin: '0 10px',
                  fontSize: '0.9rem', fontWeight: isActive || isGold ? 600 : 400,
                  color: isGold ? '#EAB308' : (isActive ? '#FAFAFA' : 'var(--text-secondary)'),
                  borderBottom: isActive ? '2px solid #EAB308' : '2px solid transparent',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center' }} suppressHydrationWarning>
                  {link.icon && <link.icon size={15} color={isGold ? '#EAB308' : (isActive ? '#EAB308' : 'currentColor')} />}
                </span>
                <span>{t(link.labelMaithili, link.labelEnglish)}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right side: Notification Bell & Account */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <NotificationBell />
          <AccountMenu />
        </div>
      </div>

      {/* Secondary Search / Community Bar */}
      <div className="navbar-subbar" style={{
        maxWidth: '1380px', margin: '0 auto', padding: '0 24px 10px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: 'transparent'
      }}>
        <Link
          href="/community"
          className={`nav-community-pill ${pathname.startsWith('/community') ? 'is-active' : ''}`}
          title="मिथिला चौपाल - अपन स्वर रिकॉर्ड करू आ साझा करू (Maithili Community & Vocal Studio)"
        >
          <span className="nav-community-live-indicator">
            <span className="nav-community-pulse" />
            <span className="nav-community-dot" />
          </span>
          <Radio size={14} className="nav-community-icon" />
          <span className="nav-community-label">{t('समुदाय (गाउ)', 'Community')}</span>
        </Link>

        {!pathname.startsWith('/search') && (
          <Link
            href="/search"
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '9999px',
              background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)',
              color: 'var(--text-muted)', fontSize: '0.8rem', width: '100%', maxWidth: '240px', transition: 'all 0.2s ease',
              textDecoration: 'none'
            }}
          >
            <Search size={14} color="var(--accent-gold)" />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('गीत खोजू...', 'Search songs...')}</span>
          </Link>
        )}
      </div>
    </header>
  );
}