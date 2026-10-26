'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useClerk, useUser } from '@clerk/nextjs';
import LoginModal from '../components/LoginModal';
import { setTrackingUserId } from '../lib/tracking';

const AuthContext = createContext(null);

/**
 * Thin bridge over Clerk. Same useAuth() the app already uses:
 *   { user, isLoaded, isSignedIn, logout, updateUser }
 * plus openSignIn / openSignUp / closeAuthModal for the global LoginModal.
 *
 * user = { id, name, email, avatar, role, bio, location, joined_at }
 * Identity + role come from Clerk. name / avatar / bio / location are overlaid
 * from the MongoDB profile (GET /api/auth/profile) so edits made in the app win.
 */
export function AuthProvider({ children }) {
  const { user: clerkUser, isLoaded: clerkLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();

  const [profile, setProfile] = useState(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [modal, setModal] = useState({ open: false, mode: 'login', redirectUrl: undefined });

  const clerkId = clerkUser?.id;

  // One-time cleanup of the old insecure localStorage session
  useEffect(() => {
    try {
      localStorage.removeItem('sur_mithila_user');
      localStorage.removeItem('sur_mithila_user_id');
    } catch { /* storage unavailable */ }
  }, []);

  // Load the app-level profile (bio, location, edited name/avatar)
  useEffect(() => {
    if (!clerkLoaded) return undefined;
    if (!isSignedIn || !clerkId) {
      setProfile(null);
      setProfileLoaded(true);
      return undefined;
    }
    let cancelled = false;
    setProfileLoaded(false);
    fetch('/api/auth/profile', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setProfile(d?.profile || null); })
      .catch(() => { /* fall back to Clerk data */ })
      .finally(() => { if (!cancelled) setProfileLoaded(true); });
    return () => { cancelled = true; };
  }, [clerkLoaded, isSignedIn, clerkId]);

  // Middleware sends signed-out visitors to /?signin=1&redirect=/target
  useEffect(() => {
    if (!clerkLoaded) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('signin')) return;
    const redirect = params.get('redirect');
    params.delete('signin');
    params.delete('redirect');
    const qs = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
    if (!isSignedIn) setModal({ open: true, mode: 'login', redirectUrl: redirect || '/' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clerkLoaded]);

  // Close the modal as soon as sign-in completes
  useEffect(() => {
    if (isSignedIn && modal.open) setModal((m) => ({ ...m, open: false }));
  }, [isSignedIn, modal.open]);

  useEffect(() => { setTrackingUserId(clerkId); }, [clerkId]);

  const user = useMemo(() => {
    if (!isSignedIn || !clerkUser) return null;
    const email = clerkUser.primaryEmailAddress?.emailAddress || '';
    return {
      id: clerkUser.id,
      name: profile?.name || clerkUser.fullName || clerkUser.username || email.split('@')[0] || 'Member',
      email,
      avatar: profile?.avatar || clerkUser.imageUrl,
      role: profile?.role || clerkUser.publicMetadata?.role || 'user',
      bio: profile?.bio || '',
      location: profile?.location || '',
      is_private: Boolean(profile?.is_private),
      canManagePrivacy: Boolean(profile?.canManagePrivacy),
      isAdmin: Boolean(profile?.isAdmin || profile?.role === 'admin'),
      joined_at: clerkUser.createdAt ? new Date(clerkUser.createdAt).toISOString() : null,
    };
  }, [isSignedIn, clerkUser, profile]);

  const logout = useCallback(async () => {
    await signOut({ redirectUrl: '/' });
  }, [signOut]);

  // Optimistic local merge after a successful PUT /api/auth/profile
  const updateUser = useCallback((updates) => {
    setProfile((p) => ({ ...(p || {}), ...updates }));
  }, []);

  const openSignIn = useCallback((opts = {}) => {
    setModal({ open: true, mode: 'login', redirectUrl: opts.redirectUrl });
  }, []);
  const openSignUp = useCallback((opts = {}) => {
    setModal({ open: true, mode: 'register', redirectUrl: opts.redirectUrl });
  }, []);
  const closeAuthModal = useCallback(() => setModal((m) => ({ ...m, open: false })), []);

  const value = useMemo(() => ({
    user,
    isLoaded: clerkLoaded && profileLoaded,
    isSignedIn: Boolean(isSignedIn),
    logout,
    updateUser,
    openSignIn,
    openSignUp,
    closeAuthModal,
  }), [user, clerkLoaded, profileLoaded, isSignedIn, logout, updateUser, openSignIn, openSignUp, closeAuthModal]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      <LoginModal
        isOpen={modal.open}
        onClose={closeAuthModal}
        initialMode={modal.mode}
        redirectUrl={modal.redirectUrl}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}