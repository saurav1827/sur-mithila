'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share2, PlusSquare } from 'lucide-react';

export default function PWARegister() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('[PWA] Service Worker registered successfully:', reg.scope);
          })
          .catch((err) => {
            console.error('[PWA] Service Worker registration failed:', err);
          });
      });
    }

    // 2. Check if already installed & running in standalone app mode
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setIsStandalone(standalone);
    if (standalone) return;

    // 3. Check if user already dismissed install banner today
    const dismissedUntil = localStorage.getItem('sur_mithila_pwa_dismissed');
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
      return;
    }

    // 4. Android/Chrome beforeinstallprompt handling
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 5. iOS detection (iOS does not support beforeinstallprompt)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent) && !window.MSStream;
    const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios/.test(userAgent);
    if (isAppleDevice && isSafari && !standalone) {
      setIsIOS(true);
      // Show gentle prompt after 4 seconds of reading
      const timer = setTimeout(() => {
        setShowInstallBanner(true);
      }, 4000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] User choice outcome:', outcome);
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    // Dismiss for 7 days
    localStorage.setItem('sur_mithila_pwa_dismissed', (Date.now() + 7 * 24 * 60 * 60 * 1000).toString());
  };

  if (isStandalone || !showInstallBanner) {
    return null;
  }

  return (
    <div
      className="pwa-install-banner"
      style={{
        position: 'fixed',
        bottom: '100px',
        left: '16px',
        right: '16px',
        maxWidth: '460px',
        margin: '0 auto',
        zIndex: 9999,
        background: 'rgba(10, 14, 24, 0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 140, 0, 0.4)',
        borderRadius: '16px',
        padding: '12px 16px',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.9), 0 0 20px rgba(255, 140, 0, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        animation: 'pwaSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
      }}
    >
      <style>{`
        @keyframes pwaSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* App Icon & Details */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
        <img
          src="/icons/icon-192.png"
          alt="Sur-Mithila"
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            flexShrink: 0,
            border: '1px solid rgba(255, 140, 0, 0.3)',
            background: '#070913'
          }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#FAFAFA', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            सुर-मिथिला ऐप (Install App)
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.2 }}>
            {isIOS ? 'Share बटन पर टैप कऽ "Add to Home Screen" करू' : 'फास्ट एवं ऑफलाइन अनुभव हेतु ऐप इन्स्टॉल करू'}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {!isIOS && deferredPrompt && (
          <button
            onClick={handleInstallClick}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '999px',
              background: 'linear-gradient(135deg, #FF8C00, #FF2E63)',
              color: '#FFFFFF',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none',
              boxShadow: '0 4px 12px rgba(255, 46, 99, 0.4)'
            }}
          >
            <Download size={14} />
            <span>इन्स्टॉल</span>
          </button>
        )}

        <button
          onClick={handleDismiss}
          title="Dismiss"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
