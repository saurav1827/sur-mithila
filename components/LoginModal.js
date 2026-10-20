'use client';

import React, { useEffect, useState } from 'react';
import { SignIn, SignUp } from '@clerk/nextjs';
import { X, Music } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { clerkAppearance } from '../lib/clerkAppearance';

const EXIT_MS = 220;

// Only allow same-site relative paths as post-login targets (no open redirects)
const safePath = (p) => (typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') ? p : '/');

const modalAppearance = {
  ...clerkAppearance,
  elements: {
    ...clerkAppearance.elements,
    rootBox: { width: '100%' },
    cardBox: { width: '100%', boxShadow: 'none', border: 'none', background: 'transparent' },
    card: { background: 'transparent', boxShadow: 'none', border: 'none', padding: 0, width: '100%' },
    header: { display: 'none' },
    footerAction: { display: 'none' },
    footer: { display: 'none' },
  },
};

export default function LoginModal({ isOpen, onClose, initialMode = 'login', redirectUrl }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState(initialMode);
  const [mounted, setMounted] = useState(isOpen);
  const [visible, setVisible] = useState(false);

  // Mount -> animate in; animate out -> unmount
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setMounted(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const id = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(id);
  }, [isOpen, initialMode]);

  // Esc to close + lock page scroll while open
  useEffect(() => {
    if (!mounted) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [mounted, onClose]);

  if (!mounted) return null;

  const target = safePath(redirectUrl || (typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/'));
  const isLogin = mode === 'login';

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, padding: '16px',
        background: 'rgba(3, 4, 10, 0.84)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: visible ? 1 : 0, transition: `opacity ${EXIT_MS}ms ease`,
      }}
    >
      <style>{`
        /* 1. Complete elimination of scrollbars */
        .login-dialog-card::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        .login-dialog-card {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }

        /* 2. Tight, compact Clerk rhythm with dark inputs */
        .cl-formFieldInput {
          background-color: #13192B !important;
          color: #F8FAFC !important;
          border: 1px solid rgba(255, 255, 255, 0.14) !important;
          border-radius: 8px !important;
          padding: 8px 12px !important;
          height: 38px !important;
          font-size: 0.9rem !important;
          box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3) !important;
          transition: all 0.2s ease !important;
        }
        .cl-formFieldInput:focus {
          border-color: #EAB308 !important;
          box-shadow: 0 0 0 2px rgba(234, 179, 8, 0.25) !important;
          outline: none !important;
        }
        .cl-formFieldInput::placeholder {
          color: #64748B !important;
          font-size: 0.85rem !important;
        }

        /* 3. Override browser autofill pale blue/white background */
        .cl-formFieldInput:-webkit-autofill,
        .cl-formFieldInput:-webkit-autofill:hover, 
        .cl-formFieldInput:-webkit-autofill:focus,
        .cl-formFieldInput:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px #13192B inset !important;
          -webkit-text-fill-color: #F8FAFC !important;
          transition: background-color 5000s ease-in-out 0s !important;
          border-color: rgba(234, 179, 8, 0.6) !important;
        }

        /* 4. Google social button */
        .cl-socialButtonsBlockButton {
          background: rgba(255, 255, 255, 0.05) !important;
          border: 1px solid rgba(255, 255, 255, 0.14) !important;
          border-radius: 10px !important;
          height: 42px !important;
          color: #F8FAFC !important;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25) !important;
          transition: all 0.18s ease !important;
          overflow: hidden !important;
        }
        .cl-socialButtonsBlockButton:hover {
          background: rgba(255, 255, 255, 0.09) !important;
          border-color: rgba(234, 179, 8, 0.45) !important;
          transform: translateY(-1px) !important;
        }
        .cl-socialButtonsBlockButtonText {
          color: #F8FAFC !important;
          font-weight: 600 !important;
          font-size: 0.9rem !important;
        }
        .cl-socialButtonsProviderIcon {
          width: 18px !important;
          height: 18px !important;
        }

        /* 5. Primary Continue button */
        .cl-formButtonPrimary {
          background: linear-gradient(135deg, #EAB308 0%, #D97706 100%) !important;
          color: #070913 !important;
          font-weight: 700 !important;
          font-size: 0.92rem !important;
          border-radius: 8px !important;
          height: 40px !important;
          border: none !important;
          box-shadow: 0 3px 14px rgba(234, 179, 8, 0.35) !important;
          transition: all 0.18s ease !important;
          cursor: pointer !important;
          margin-top: 4px !important;
        }
        .cl-formButtonPrimary:hover {
          box-shadow: 0 5px 20px rgba(234, 179, 8, 0.5) !important;
          transform: translateY(-1px) !important;
        }

        /* 6. Spacings & labels */
        .cl-dividerRow {
          margin: 10px 0 !important;
        }
        .cl-dividerLine {
          background: rgba(255, 255, 255, 0.08) !important;
        }
        .cl-dividerText {
          color: #64748B !important;
          font-size: 0.72rem !important;
          font-weight: 600 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.06em !important;
        }
        .cl-formFieldRow {
          margin-bottom: 8px !important;
        }
        .cl-formFieldLabel {
          color: #94A3B8 !important;
          font-size: 0.8rem !important;
          font-weight: 500 !important;
          margin-bottom: 3px !important;
        }
        .cl-formFieldAction__password {
          font-size: 0.78rem !important;
          color: #EAB308 !important;
        }

        /* 7. Hide all Clerk footer badges and watermarks */
        .cl-footer, .cl-footerAction, .cl-internal-b3fm6y, .cl-internal-1dauvpw {
          display: none !important;
          height: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
        }
      `}</style>

      <div
        role="dialog"
        aria-modal="true"
        aria-label={isLogin ? 'Sign in' : 'Create account'}
        className="login-dialog-card"
        style={{
          background: 'radial-gradient(circle at 50% 0%, rgba(234, 179, 8, 0.14) 0%, rgba(11, 14, 26, 0.98) 55%)',
          border: '1px solid rgba(234, 179, 8, 0.22)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '410px',
          overflow: 'hidden',
          position: 'relative',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9), 0 0 35px rgba(234, 179, 8, 0.1)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(6px)',
          transition: `opacity ${EXIT_MS}ms ease, transform ${EXIT_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '50%',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
        >
          <X size={16} />
        </button>

        <div style={{ padding: '20px 22px 18px' }}>
          {/* Header with Music Icon Crest */}
          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(217, 119, 6, 0.1))',
              border: '1px solid rgba(234, 179, 8, 0.35)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '6px',
              boxShadow: '0 2px 10px rgba(234, 179, 8, 0.2)'
            }}>
              <Music size={18} color="#EAB308" />
            </div>

            <h2 className="font-traditional" style={{ fontSize: '1.55rem', color: '#F8FAFC', marginBottom: '2px', lineHeight: 1.15 }}>
              {isLogin ? t('लॉगिन करू', 'Welcome Back') : t('खाता बनाउ', 'Create Account')}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.3, margin: 0 }}>
              {t('सुर-मिथिला मे अपन खाता सं जुड़ू', 'Sign in to Sur-Mithila to continue')}
            </p>
          </div>

          {/* Segmented Mode Switcher */}
          <div
            role="tablist"
            style={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              padding: '3px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              marginBottom: '12px',
            }}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: '3px',
                bottom: '3px',
                left: '3px',
                width: 'calc(50% - 3px)',
                borderRadius: '7px',
                background: 'linear-gradient(135deg, #EAB308 0%, #D97706 100%)',
                boxShadow: '0 2px 6px rgba(234, 179, 8, 0.35)',
                transform: isLogin ? 'translateX(0)' : 'translateX(100%)',
                transition: 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
            <button
              role="tab"
              aria-selected={isLogin}
              onClick={() => setMode('login')}
              style={{
                position: 'relative',
                zIndex: 1,
                padding: '6px 0',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.86rem',
                fontWeight: 700,
                transition: 'color 0.2s ease',
                color: isLogin ? '#070913' : 'var(--text-secondary)',
              }}
            >
              {t('लॉगिन', 'Sign In')}
            </button>
            <button
              role="tab"
              aria-selected={!isLogin}
              onClick={() => setMode('register')}
              style={{
                position: 'relative',
                zIndex: 1,
                padding: '6px 0',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.86rem',
                fontWeight: 700,
                transition: 'color 0.2s ease',
                color: !isLogin ? '#070913' : 'var(--text-secondary)',
              }}
            >
              {t('खाता बनाउ', 'Sign Up')}
            </button>
          </div>

          {/* Embedded Clerk Component */}
          {isLogin ? (
            <SignIn
              routing="virtual"
              appearance={modalAppearance}
              signUpUrl="/sign-up"
              forceRedirectUrl={target}
              fallbackRedirectUrl={target}
              signUpForceRedirectUrl={target}
              signUpFallbackRedirectUrl={target}
            />
          ) : (
            <SignUp
              routing="virtual"
              appearance={modalAppearance}
              signInUrl="/sign-in"
              forceRedirectUrl={target}
              fallbackRedirectUrl={target}
              signInForceRedirectUrl={target}
              signInFallbackRedirectUrl={target}
            />
          )}
        </div>
      </div>
    </div>
  );
}