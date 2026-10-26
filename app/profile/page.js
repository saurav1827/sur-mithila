'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { usePlayer } from '../../context/PlayerContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  LogOut, Settings, Disc, Play, Pause, Heart, Shield, Edit2, Edit3, User as UserIcon,
  Clock, Lock, Globe, Loader2, Sparkles, CheckCircle2, MapPin, Mail, Trash2,
  ExternalLink, Mic, ArrowRight, Share2, Music, Volume2, Check, Calendar, AlertCircle
} from 'lucide-react';
import WatchHistoryTab from '../../components/profile/WatchHistoryTab';
import { recordCoverInHistory } from '../../lib/history-utils';

const TAB_IDS = ['details', 'history', 'library', 'covers', 'settings'];

const TABS = [
  { id: 'details', icon: UserIcon, mai: 'हमर विवरण', en: 'My Details', pureMai: 'हमर विवरण' },
  { id: 'history', icon: Clock, mai: 'श्रवण इतिहास', en: 'Watch History', pureMai: 'श्रवण इतिहास' },
  { id: 'library', icon: Heart, mai: 'हमर संग्रह', en: 'Library', pureMai: 'हमर संग्रह' },
  { id: 'covers', icon: Disc, mai: 'रिकाॅर्डिंग', en: 'My Covers', pureMai: 'स्वर-प्रस्तुति' },
  { id: 'settings', icon: Settings, mai: 'सेटिंग्स', en: 'Settings', pureMai: 'विन्यास' },
];


function ProfileContent() {
  const { user, isLoaded, logout, updateUser, openSignIn } = useAuth();
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { language, setLanguage, toggleLanguage, t, isEnglish, isMaithiliPlus, LANGUAGES } = useLanguage();
  const searchParams = useSearchParams();

  const [recordings, setRecordings] = useState([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(true);
  const [favorites, setFavorites] = useState([]);
  const [historyCount, setHistoryCount] = useState(0);
  const [activeTab, setActiveTab] = useState('details');

  const [formData, setFormData] = useState({ name: '', avatar: '', location: '', bio: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [toastNotification, setToastNotification] = useState(null);
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToastNotification({ message, type });
    setTimeout(() => {
      setToastNotification((curr) => (curr?.message === message ? null : curr));
    }, 3800);
  };

  // Privacy management states
  const [isTogglingAccountPrivacy, setIsTogglingAccountPrivacy] = useState(false);
  const [togglingRecId, setTogglingRecId] = useState(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [deleteConfirmRecId, setDeleteConfirmRecId] = useState(null);
  const [isDeletingRec, setIsDeletingRec] = useState(false);

  // Audio quality selection state (local preference)
  const [audioQuality, setAudioQuality] = useState('high');

  // Deep link ?tab=... support
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (TAB_IDS.includes(tab)) setActiveTab(tab);
  }, [searchParams]);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    setFormData({
      name: user.name || '',
      avatar: user.avatar || '',
      location: user.location || '',
      bio: user.bio || '',
    });

    // Clean legacy global favorites
    try {
      localStorage.removeItem('sur_mithila_favorites');
    } catch { }

    // 1. Load user recordings
    fetch(`/api/recordings/user?userId=${encodeURIComponent(user.id)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.recordings) setRecordings(data.recordings);
      })
      .catch(() => { })
      .finally(() => {
        if (!cancelled) setIsLoadingRecs(false);
      });

    // 2. Load user favorites
    fetch('/api/favorites')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.favorites) {
          setFavorites(data.favorites);
          try {
            localStorage.setItem(`sur_mithila_favs_${user.id}`, JSON.stringify(data.favorites));
          } catch { }
        }
      })
      .catch(() => {
        try {
          const cached = localStorage.getItem(`sur_mithila_favs_${user.id}`);
          setFavorites(cached ? JSON.parse(cached) : []);
        } catch {
          setFavorites([]);
        }
      });

    // 3. Load watch history count
    try {
      const hRaw = localStorage.getItem('sur_mithila_history');
      if (hRaw) setHistoryCount(JSON.parse(hRaw).length);
    } catch { }

    fetch('/api/history')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.history) {
          let localCount = 0;
          try {
            const hRaw = localStorage.getItem('sur_mithila_history');
            if (hRaw) localCount = JSON.parse(hRaw).length;
          } catch { }
          setHistoryCount(Math.max(data.history.length, localCount));
        }
      })
      .catch(() => { });

    // Listen for real-time history changes (play, remove, clear, bulk sync)
    const handleHistoryUpdated = (e) => {
      if (typeof e.detail?.totalCount === 'number') {
        setHistoryCount(e.detail.totalCount);
      } else if (e.detail?.clearedAll) {
        setHistoryCount(0);
      } else {
        try {
          const hRaw = localStorage.getItem('sur_mithila_history');
          if (hRaw) setHistoryCount(JSON.parse(hRaw).length);
        } catch { }
      }
    };
    window.addEventListener('sur_mithila_history_updated', handleHistoryUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener('sur_mithila_history_updated', handleHistoryUpdated);
    };
  }, [user]);

  // Account Privacy Toggle Handler
  const handleToggleAccountPrivacy = async () => {
    if (!user || isTogglingAccountPrivacy) return;
    const nextPrivacy = !user.is_private;
    setIsTogglingAccountPrivacy(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_private: nextPrivacy }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        updateUser({ is_private: nextPrivacy });
        // Also sync user collection directly if applicable
        fetch(`/api/users/${encodeURIComponent(user.id)}/privacy`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_private: nextPrivacy }),
        }).catch(() => { });

        const msg = nextPrivacy
          ? t('अहाँक खाता आब निजी भ\' गेल', 'Your account is now private')
          : t('अहाँक खाता आब सार्वजनिक भ\' गेल', 'Your account is now public');
        setSaveMessage(msg);
        showToast(msg, 'success');
        setShowPrivacyModal(false);
        setTimeout(() => setSaveMessage(''), 3500);
      } else {
        const err = data.error || 'Failed to update account privacy';
        alert(err);
        showToast(err, 'error');
      }
    } catch (err) {
      console.error('Account privacy toggle error:', err);
      showToast('Error updating account privacy', 'error');
    } finally {
      setIsTogglingAccountPrivacy(false);
    }
  };

  // Recording Privacy Toggle Handler
  const handleToggleRecordingPrivacy = async (recordingId, currentPrivacy) => {
    if (togglingRecId) return;
    setTogglingRecId(recordingId);
    const nextPrivacy = !currentPrivacy;
    try {
      const res = await fetch('/api/community/recordings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordingId, is_private: nextPrivacy }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRecordings((prev) =>
          prev.map((r) =>
            (r.recording_id === recordingId || r._id === recordingId)
              ? { ...r, is_private: nextPrivacy }
              : r
          )
        );
        showToast(
          nextPrivacy
            ? t('रिकॉर्डिंग निजी कएल गेल', 'Recording set to private')
            : t('रिकॉर्डिंग सार्वजनिक कएल गेल', 'Recording set to public'),
          'success'
        );
      } else {
        alert(data.error || 'Failed to update recording privacy');
      }
    } catch (err) {
      console.error('Recording privacy toggle error:', err);
    } finally {
      setTogglingRecId(null);
    }
  };

  // Recording Delete Handler
  const handleDeleteRecording = async (recordingId) => {
    if (!recordingId || isDeletingRec) return;
    setIsDeletingRec(true);
    try {
      const res = await fetch(`/api/community/recordings?recordingId=${encodeURIComponent(recordingId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRecordings((prev) =>
          prev.filter((r) => r.recording_id !== recordingId && r._id !== recordingId)
        );
        setDeleteConfirmRecId(null);
        showToast(t('रिकॉर्डिंग हटाओल गेल', 'Recording deleted successfully'), 'success');
      } else {
        alert(data.error || 'Failed to delete recording');
      }
    } catch (err) {
      console.error('Recording delete error:', err);
    } finally {
      setIsDeletingRec(false);
    }
  };

  // Play / Toggle Recording via PlayerContext
  const handlePlayRecording = (rec) => {
    const coverRecId = rec.recording_id || rec._id || rec.id;
    const isThisPlaying =
      (currentTrack?.song?.slug === rec.song_slug ||
        currentTrack?.song?.id === `cover-${coverRecId}` ||
        currentTrack?.recording?.audio?.hosted_audio_url === rec.audio_url) &&
      isPlaying;

    if (isThisPlaying) {
      togglePlay();
      return;
    }

    recordCoverInHistory({
      recording_id: coverRecId,
      song_slug: rec.song_slug,
      song_title: rec.song_title,
      user_name: rec.user_name || user?.name,
      audio_url: rec.audio_url,
      song_poster: rec.song_poster,
    });

    playTrack(
      {
        id: `cover-${coverRecId}`,
        slug: rec.song_slug,
        title: { canonical: `${rec.song_title} (Cover)` },
        category: rec.category || 'कवर प्रस्तुति',
        poster: { image_url: rec.song_poster || null },
        credits: { singer: `${rec.user_name || user?.name || 'Artist'} (Cover)` },
        audio: { hosted_audio_url: rec.audio_url },
        youtube: rec.youtube || {},
      },
      {
        recording_id: coverRecId,
        audio: { hosted_audio_url: rec.audio_url },
        artist_name: `${rec.user_name || user?.name || 'Artist'} (Cover)`,
        poster: { image_url: rec.song_poster || null },
        youtube: rec.youtube || {},
      }
    );
  };

  // Avatar Resizing and Upload
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.src = reader.result;
      img.onload = () => {
        const MAX = 256;
        let { width, height } = img;
        if (width > height) {
          if (width > MAX) { height *= MAX / width; width = MAX; }
        } else if (height > MAX) { width *= MAX / height; height = MAX; }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        setFormData((prev) => ({ ...prev, avatar: canvas.toDataURL('image/jpeg', 0.8) }));
      };
    };
    reader.readAsDataURL(file);
  };

  // Save Profile Handler
  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        updateUser(formData);
        const msg = t('प्रोफाइल विवरण सफलतापूर्वक अपडेट भ गेल!', 'Profile updated successfully!');
        setSaveMessage(msg);
        setIsSavedSuccess(true);
        showToast(msg, 'success');
        setTimeout(() => {
          setIsSavedSuccess(false);
          setSaveMessage('');
        }, 3500);
      } else {
        const errMsg = data.error || t('अपडेट विफल भ गेल', 'Failed to update profile');
        setSaveMessage(errMsg);
        showToast(errMsg, 'error');
      }
    } catch (error) {
      console.error(error);
      const errMsg = 'An error occurred: ' + (error.message || 'unknown');
      setSaveMessage(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isLoaded) {
    return (
      <div style={{ maxWidth: '1180px', margin: '40px auto', padding: '0 20px', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <Loader2 size={36} color="#EAB308" className="animate-spin" />
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{t("प्रोफाइल लोड भ' रहल अछि...", 'Loading profile...')}</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center', maxWidth: '600px', margin: '40px auto' }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(234, 179, 8, 0.1)',
          border: '1px solid rgba(234, 179, 8, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', color: '#EAB308'
        }}>
          <UserIcon size={36} />
        </div>
        <h2 className="font-traditional" style={{ fontSize: '2rem', color: '#FAFAFA', marginBottom: '12px' }}>{t('प्रोफाइल', 'Profile')}</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '28px', fontSize: '0.95rem' }}>
          {t('प्रोफाइल देखय आ अपन रेकॉर्डिंग प्रबंधित करय लेल कृपया लॉगिन करू।', 'Please sign in to view your profile and manage recordings.')}
        </p>
        <button
          onClick={() => openSignIn({ redirectUrl: '/profile' })}
          style={{
            padding: '12px 32px', borderRadius: '9999px',
            background: 'linear-gradient(135deg, #EAB308, #CA8A04)',
            color: '#070913', fontWeight: 700, border: 'none', cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(234, 179, 8, 0.35)', fontSize: '0.95rem'
          }}
        >
          {t('लॉगिन करू', 'Sign In')}
        </button>
      </div>
    );
  }

  const memberSince = user.joined_at
    ? new Date(user.joined_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : 'Oct 2026';

  const canManagePrivacy = Boolean(user.canManagePrivacy || user.isAdmin || user.role === 'admin');

  return (
    <div className="profile-main-wrapper">
      <style>{`
        .profile-main-wrapper {
          max-width: 1180px;
          margin: 0 auto;
          padding: 16px 20px 80px;
          position: relative;
        }
        @media (max-width: 768px) {
          .profile-main-wrapper {
            padding: 12px 14px 170px !important;
          }
        }
        .profile-container {
          position: relative;
        }
        .hero-banner {
          position: relative;
          border-radius: 24px;
          padding: 32px;
          margin-bottom: 32px;
          background: linear-gradient(135deg, rgba(234, 179, 8, 0.16) 0%, rgba(239, 68, 68, 0.08) 50%, rgba(15, 20, 36, 0.95) 100%);
          border: 1px solid rgba(234, 179, 8, 0.28);
          box-shadow: 0 20px 48px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(24px);
          overflow: hidden;
        }
        .hero-banner::before {
          content: '';
          position: absolute;
          top: -80px;
          right: -80px;
          width: 240px;
          height: 240px;
          background: radial-gradient(circle, rgba(234, 179, 8, 0.18) 0%, transparent 70%);
          pointer-events: none;
        }
        .hero-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 24px;
        }
        .hero-user-info {
          display: flex;
          align-items: center;
          gap: 24px;
          min-width: 0;
          flex: 1;
        }
        .avatar-wrapper {
          position: relative;
          width: 96px;
          height: 96px;
          flex-shrink: 0;
        }
        .avatar-img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid #EAB308;
          box-shadow: 0 0 24px rgba(234, 179, 8, 0.4), 0 8px 32px rgba(0, 0, 0, 0.6);
          background: #0B0E1A;
        }
        .avatar-edit-badge {
          position: absolute;
          bottom: 2px;
          right: 2px;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #EAB308;
          color: #070913;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: 2px solid #070913;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
          transition: transform 0.15s ease;
        }
        .avatar-edit-badge:hover {
          transform: scale(1.1);
        }
        .hero-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .hero-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-top: 28px;
        }
        .stat-card {
          padding: 16px 18px;
          border-radius: 16px;
          background: rgba(11, 15, 28, 0.65);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
          transition: all 0.2s ease;
        }
        .stat-card:hover {
          transform: translateY(-2px);
          border-color: rgba(234, 179, 8, 0.35);
          background: rgba(234, 179, 8, 0.05);
        }
        .profile-body-layout {
          display: flex;
          gap: 32px;
          align-items: flex-start;
        }
        .profile-sidebar {
          width: 250px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
          background: rgba(15, 19, 36, 0.45);
          padding: 12px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(16px);
        }
        .nav-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          border-radius: 12px;
          font-size: 0.88rem;
          font-weight: 500;
          color: var(--text-secondary);
          background: transparent;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all 0.18s ease;
          text-decoration: none;
          width: 100%;
          text-align: left;
        }
        .nav-item:hover {
          color: #FAFAFA;
          background: rgba(255, 255, 255, 0.04);
        }
        .nav-item.active {
          color: #FDE047;
          background: linear-gradient(135deg, rgba(234, 179, 8, 0.2) 0%, rgba(234, 179, 8, 0.08) 100%);
          border-color: rgba(234, 179, 8, 0.4);
          font-weight: 700;
          box-shadow: 0 4px 20px rgba(234, 179, 8, 0.12);
        }
        .tab-label {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .tab-badge {
          font-size: 0.72rem;
          padding: 2px 7px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-muted);
          font-weight: 600;
          flex-shrink: 0;
        }
        .nav-item.active .tab-badge {
          background: rgba(234, 179, 8, 0.25);
          color: #FDE047;
        }
        .sidebar-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
          margin: 6px 8px;
        }
        .profile-panel-content {
          flex: 1;
          min-width: 0;
          width: 100%;
          animation: fadeSlideUp 0.25s ease-out;
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .form-card {
          padding: 26px 28px;
          border-radius: 20px;
          background: rgba(15, 19, 36, 0.65);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
          backdrop-filter: blur(16px);
          margin-bottom: 24px;
        }
        .input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 18px;
        }
        .input-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 2px;
        }
        .input-label {
          font-size: 0.84rem;
          font-weight: 600;
          color: #FAFAFA;
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 2px;
        }
        .input-label-cue {
          font-size: 0.72rem;
          color: var(--text-muted);
          font-weight: 400;
        }
        .verified-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 9px;
          border-radius: 999px;
          background: rgba(16, 185, 129, 0.14);
          border: 1px solid rgba(16, 185, 129, 0.35);
          color: #34D399;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.01em;
        }
        .counter-chip {
          font-size: 0.72rem;
          color: var(--text-muted);
          font-variant-numeric: tabular-nums;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 2px 8px;
          border-radius: 6px;
          font-weight: 600;
        }
        .custom-input {
          padding: 13px 15px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #FAFAFA;
          font-size: 16px;
          width: 100%;
          font-family: inherit;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          box-sizing: border-box;
        }
        .custom-input:focus {
          outline: none;
          border-color: #EAB308;
          box-shadow: 0 0 0 3px rgba(234, 179, 8, 0.22);
          background: rgba(255, 255, 255, 0.07);
        }
        .custom-input:disabled {
          opacity: 0.72;
          cursor: not-allowed;
          background: rgba(255, 255, 255, 0.02);
          border-color: rgba(255, 255, 255, 0.06);
        }
        .save-actions-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 6px;
        }
        .save-profile-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 26px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 0.92rem;
          border: none;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .save-profile-btn:active {
          transform: scale(0.98);
        }
        .save-status-msg {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: 10px;
          border: 1px solid;
          font-size: 0.88rem;
          font-weight: 600;
          animation: fadeSlideUp 0.2s ease;
        }
        .recording-card {
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 16px 20px;
          border-radius: 16px;
          background: rgba(15, 19, 36, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.07);
          transition: all 0.2s ease;
          margin-bottom: 14px;
          flex-wrap: wrap;
        }
        .recording-card:hover {
          border-color: rgba(234, 179, 8, 0.3);
          background: rgba(234, 179, 8, 0.04);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }
        .empty-state-card {
          padding: 60px 28px;
          border-radius: 20px;
          background: rgba(15, 19, 36, 0.35);
          border: 1px dashed rgba(234, 179, 8, 0.25);
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (max-width: 920px) {
          .profile-body-layout {
            flex-direction: column;
            gap: 18px;
          }
          .profile-sidebar {
            width: 100%;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            padding: 10px;
            border-radius: 16px;
            background: rgba(15, 19, 36, 0.55);
            border: 1px solid rgba(255, 255, 255, 0.08);
          }
          .sidebar-divider {
            display: none !important;
          }
          .nav-item {
            padding: 9px 12px;
            font-size: 0.82rem;
            border-radius: 10px;
            gap: 6px;
          }
          .nav-item-admin {
            grid-column: span 2;
          }
          .profile-panel-content {
            padding-bottom: 96px;
          }
          .hero-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }
        }
        @media (max-width: 580px) {
          .hero-banner {
            padding: 16px;
            border-radius: 16px;
            margin-bottom: 20px;
          }
          .hero-user-info {
            flex-direction: column;
            text-align: center;
            align-items: center;
            gap: 10px;
          }
          .avatar-wrapper {
            width: 76px !important;
            height: 76px !important;
          }
          .hero-actions {
            width: 100%;
            justify-content: center;
            gap: 8px;
          }
          .hero-actions a, .hero-actions button {
            padding: 7px 14px !important;
            font-size: 0.8rem !important;
          }
          .hero-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            margin-top: 16px;
          }
          .stat-card {
            padding: 10px 12px;
            border-radius: 12px;
          }
          .profile-sidebar {
            gap: 6px;
            padding: 8px;
            border-radius: 14px;
          }
          .nav-item {
            padding: 8px 10px;
            font-size: 0.78rem;
            border-radius: 8px;
          }
          .tab-badge {
            font-size: 0.68rem;
            padding: 1px 5px;
          }
        }
        .privacy-card-inner {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }
        .privacy-card-content {
          display: flex;
          gap: 14px;
          min-width: 0;
          flex: 1;
        }
        .recording-card-playing {
          border-color: rgba(234, 179, 8, 0.45) !important;
          background: rgba(234, 179, 8, 0.08) !important;
          box-shadow: 0 4px 20px rgba(234, 179, 8, 0.15) !important;
        }
        @media (max-width: 680px) {
          .form-card {
            padding: 18px 14px !important;
            border-radius: 16px !important;
            margin-bottom: 16px !important;
          }
          .input-group {
            margin-bottom: 15px !important;
          }
          .custom-input {
            padding: 11px 13px !important;
            font-size: 16px !important;
          }
          .save-actions-wrap {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
          }
          .save-profile-btn {
            width: 100% !important;
            justify-content: center !important;
            padding: 13px 20px !important;
            font-size: 0.95rem !important;
          }
          .save-status-msg {
            width: 100% !important;
            justify-content: center !important;
            text-align: center !important;
            box-sizing: border-box !important;
          }
          .privacy-control-card {
            padding: 18px 14px !important;
            border-radius: 16px !important;
          }
          .privacy-card-inner {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 14px !important;
          }
          .privacy-card-content {
            gap: 12px !important;
          }
          .privacy-icon-badge {
            width: 40px !important;
            height: 40px !important;
            border-radius: 10px !important;
          }
          .privacy-card-toggle-btn {
            width: 100% !important;
            justify-content: center !important;
            padding: 13px 18px !important;
            font-size: 0.92rem !important;
            border-radius: 12px !important;
          }
          .privacy-card-toggle-btn:active {
            transform: scale(0.98);
          }
          .recording-card {
            padding: 12px 14px !important;
            gap: 12px !important;
          }
        }
      `}</style>

      {/* TOP HERO PROFILE BANNER */}
      <div className="hero-banner">
        <div className="hero-top-row">
          <div className="hero-user-info">
            <div className="avatar-wrapper">
              <img
                src={formData.avatar || user.avatar || '/placeholder.jpg'}
                alt={user.name}
                className="avatar-img"
              />
              <button
                type="button"
                className="avatar-edit-badge"
                onClick={() => fileInputRef.current?.click()}
                title={t('तस्वीर बदलू', 'Change Picture')}
              >
                <Edit2 size={15} />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleImageChange}
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <h1 className="font-traditional" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.1rem)', color: '#FAFAFA', margin: 0, fontWeight: 800 }}>
                  {user.name}
                </h1>
                <CheckCircle2 size={20} color="#EAB308" />
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '999px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  background: user.role === 'admin' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                  color: user.role === 'admin' ? '#FDE047' : '#E2E8F0',
                  border: '1px solid',
                  borderColor: user.role === 'admin' ? 'rgba(234, 179, 8, 0.4)' : 'rgba(255, 255, 255, 0.12)',
                }}>
                  {user.role === 'admin' ? t('👑 प्रशासक', '👑 Admin') : t('✨ लोकगायक', '✨ Folk Artist')}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.86rem', color: 'var(--text-secondary)', flexWrap: 'wrap', marginBottom: '10px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Mail size={13} color="var(--text-muted)" />
                  {user.email}
                </span>
                {user.location && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <MapPin size={13} color="#EAB308" />
                    {user.location}
                  </span>
                )}
              </div>

              {/* Account Privacy Status Pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '999px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  background: user.is_private ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  color: user.is_private ? '#F87171' : '#34D399',
                  border: '1px solid',
                  borderColor: user.is_private ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.35)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  {user.is_private ? <Lock size={12} /> : <Globe size={12} />}
                  <span>
                    {user.is_private
                      ? t('निजी प्रोफाइल (Private Account)', 'Private Account')
                      : t('सार्वजनिक प्रोफाइल (Public Account)', 'Public Account')}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Action Strip: Privacy Toggle & Public Profile Link */}
          <div className="hero-actions">
            {canManagePrivacy && (
              <button
                type="button"
                onClick={() => setShowPrivacyModal(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: '999px',
                  border: '1px solid',
                  borderColor: user.is_private ? 'rgba(16, 185, 129, 0.5)' : 'rgba(234, 179, 8, 0.5)',
                  background: user.is_private
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.25))'
                    : 'linear-gradient(135deg, rgba(234, 179, 8, 0.25), rgba(202, 138, 4, 0.25))',
                  color: user.is_private ? '#34D399' : '#FDE047',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: user.is_private
                    ? '0 4px 16px rgba(16, 185, 129, 0.2)'
                    : '0 4px 16px rgba(234, 179, 8, 0.2)',
                }}
              >
                {user.is_private ? <Globe size={15} /> : <Lock size={15} />}
                <span>
                  {user.is_private
                    ? t('खाता सार्वजनिक बनाउ', 'Make Account Public')
                    : t('खाता निजी बनाउ', 'Make Account Private')}
                </span>
              </button>
            )}

            <Link
              href={`/profile/${encodeURIComponent(user.id)}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 18px',
                borderRadius: '999px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#FAFAFA',
                fontSize: '0.86rem',
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <ExternalLink size={14} />
              <span>{t('लोक प्रोफाइल', 'View Public Profile')}</span>
            </Link>
          </div>
        </div>

        {/* 4 LUXURY STATS CARDS */}
        <div className="hero-stats-grid">
          <div className="stat-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: 'clamp(0.72rem, 1.2vw, 0.78rem)', marginBottom: '4px' }}>
              <Disc size={15} color="#EAB308" />
              <span>{t('रिकाॅर्डिंग', 'Covers')}</span>
            </div>
            <div style={{ fontSize: 'clamp(1.25rem, 2.5vw, 1.6rem)', fontWeight: 800, color: '#FAFAFA', lineHeight: 1 }}>
              {isLoadingRecs ? '…' : recordings.length}
            </div>
          </div>

          <div className="stat-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: 'clamp(0.72rem, 1.2vw, 0.78rem)', marginBottom: '4px' }}>
              <Heart size={15} color="#EF4444" />
              <span>{t('प्रिय संग्रह', 'Favorites')}</span>
            </div>
            <div style={{ fontSize: 'clamp(1.25rem, 2.5vw, 1.6rem)', fontWeight: 800, color: '#FAFAFA', lineHeight: 1 }}>
              {favorites.length}
            </div>
          </div>

          <div className="stat-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: 'clamp(0.72rem, 1.2vw, 0.78rem)', marginBottom: '4px' }}>
              <Clock size={15} color="#06B6D4" />
              <span>{t('सुनल गीत', 'Played')}</span>
            </div>
            <div style={{ fontSize: 'clamp(1.25rem, 2.5vw, 1.6rem)', fontWeight: 800, color: '#FAFAFA', lineHeight: 1 }}>
              {historyCount}
            </div>
          </div>

          <div className="stat-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: 'clamp(0.72rem, 1.2vw, 0.78rem)', marginBottom: '4px' }}>
              <Calendar size={15} color="#10B981" />
              <span>{t('सदस्य सँ', 'Member since')}</span>
            </div>
            <div style={{ fontSize: 'clamp(0.95rem, 2vw, 1.15rem)', fontWeight: 700, color: '#FAFAFA', lineHeight: 1.2, marginTop: '2px' }}>
              {memberSince}
            </div>
          </div>
        </div>
      </div>

      {/* FEEDBACK TOAST BANNER */}
      {saveMessage && (
        <div style={{
          padding: '12px 20px',
          borderRadius: '12px',
          background: /error|failed|invalid/i.test(saveMessage) ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
          border: '1px solid',
          borderColor: /error|failed|invalid/i.test(saveMessage) ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)',
          color: /error|failed|invalid/i.test(saveMessage) ? '#FCA5A5' : '#34D399',
          fontSize: '0.9rem',
          fontWeight: 600,
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          animation: 'fadeSlideUp 0.2s ease',
        }}>
          {/error|failed|invalid/i.test(saveMessage) ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{saveMessage}</span>
        </div>
      )}

      {/* MAIN BODY: SIDEBAR TABS & TAB PANELS */}
      <div className="profile-body-layout">
        {/* SIDEBAR NAVIGATION - 2x3 APP GRID ON MOBILE, NEVER HORIZONTALLY SCROLLABLE */}
        <nav className="profile-sidebar" aria-label="Profile navigation">
          {TABS.map(({ id, icon: Icon, mai, en, pureMai }) => {
            const isActive = activeTab === id;
            let count = null;
            if (id === 'covers') count = recordings.length;
            if (id === 'library') count = favorites.length;
            if (id === 'history') count = historyCount;

            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`nav-item ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <Icon size={16} color={isActive ? '#FDE047' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
                  <span className="tab-label">{t(mai, en, pureMai)}</span>
                </div>
                {count !== null && (
                  <span className="tab-badge">{count}</span>
                )}
              </button>
            );
          })}

          {user.role === 'admin' && (
            <Link
              href="/admin"
              className="nav-item nav-item-admin"
              style={{ color: '#EAB308' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={16} color="#EAB308" />
                <span className="tab-label">{t('प्रशासन पोर्टल', 'Admin Portal')}</span>
              </div>
            </Link>
          )}

          <div className="sidebar-divider" />

          <button
            onClick={logout}
            className="nav-item nav-item-logout"
            style={{ color: '#EF4444' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LogOut size={16} color="#EF4444" />
              <span className="tab-label">{t('लॉगआउट', 'Log Out')}</span>
            </div>
          </button>
        </nav>

        {/* TAB CONTENT PANELS */}
        <div className="profile-panel-content">
          {/* TAB 1: DETAILS */}
          {activeTab === 'details' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <h2 className="font-traditional" style={{ fontSize: 'clamp(1.35rem, 3.5vw, 1.75rem)', color: '#FAFAFA', marginBottom: '6px' }}>
                  {t('हमर विवरण', 'My Details')}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0, lineHeight: 1.45 }}>
                  {t('अपन प्रोफाइल सूचना आ व्यक्तिगत विवरण अपडेट करू।', 'Update your personal profile information.')}
                </p>
              </div>

              <div className="form-card">
                <div className="input-group">
                  <label className="input-label">
                    <UserIcon size={14} color="#EAB308" />
                    <span>{t('पूरा नाम (Full Name)', 'Full Name')}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t('अपन नाम दर्ज करू', 'Enter your full name')}
                    className="custom-input"
                  />
                </div>

                <div className="input-group">
                  <div className="input-label-row">
                    <label className="input-label" style={{ marginBottom: 0 }}>
                      <Mail size={14} color="#06B6D4" />
                      <span>{t('ईमेल (Email Address)', 'Email Address')}</span>
                    </label>
                    <span className="verified-chip">
                      <CheckCircle2 size={11} strokeWidth={2.5} />
                      <span>{t('सत्यापित', 'Verified')}</span>
                    </span>
                  </div>
                  <input
                    type="email"
                    value={user.email || ''}
                    disabled
                    className="custom-input"
                    style={{ opacity: 0.65, cursor: 'not-allowed' }}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">
                    <MapPin size={14} color="#EF4444" />
                    <span>{t('स्थान / गाम (Location / Village)', 'Location / Village')}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder={t('जेना: मधुबनी, दरभंगा, सहरसा...', 'e.g. Madhubani, Darbhanga, Saharsa...')}
                    className="custom-input"
                  />
                </div>

                <div className="input-group">
                  <div className="input-label-row">
                    <label className="input-label" style={{ marginBottom: 0 }}>
                      <Music size={14} color="#F59E0B" />
                      <span>{t('अपन विषय मे (Musical Bio)', 'Musical Bio')}</span>
                    </label>
                    <span className="counter-chip">
                      {(formData.bio || '').length} / 500
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={formData.bio}
                    maxLength={500}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder={t('अपन संगीतमय यात्रा आ पसंदीदा मैथिली लोकगीतक विषय मे किछु लिखू...', 'Tell the community about your musical journey and favorite songs...')}
                    className="custom-input"
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <div className="save-actions-wrap">
                  <button
                    type="button"
                    className="save-profile-btn"
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    style={{
                      background: isSavedSuccess
                        ? 'linear-gradient(135deg, #10B981, #059669)'
                        : 'linear-gradient(135deg, #EAB308, #CA8A04)',
                      color: isSavedSuccess ? '#FFFFFF' : '#070913',
                      boxShadow: isSavedSuccess
                        ? '0 6px 20px rgba(16, 185, 129, 0.4)'
                        : '0 6px 20px rgba(234, 179, 8, 0.3)',
                    }}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>{t('सेव भ रहल अछि...', 'Saving Changes...')}</span>
                      </>
                    ) : isSavedSuccess ? (
                      <>
                        <Check size={16} strokeWidth={3} />
                        <span>{t('सुरक्षित भ गेल!', 'Saved Successfully!')}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        <span>{t('विवरण सुरक्षित करू', 'Save Profile')}</span>
                      </>
                    )}
                  </button>

                  {saveMessage && (
                    <div className="save-status-msg" style={{
                      background: /error|failed|invalid/i.test(saveMessage) ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      borderColor: /error|failed|invalid/i.test(saveMessage) ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)',
                      color: /error|failed|invalid/i.test(saveMessage) ? '#FCA5A5' : '#34D399',
                    }}>
                      {/error|failed|invalid/i.test(saveMessage) ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                      <span>{saveMessage}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* DEDICATED ACCOUNT PRIVACY CARD */}
              {canManagePrivacy && (
                <div className="form-card privacy-control-card" style={{ borderColor: 'rgba(234, 179, 8, 0.25)', background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.08) 0%, rgba(15, 19, 36, 0.8) 100%)' }}>
                  <div className="privacy-card-inner">
                    <div className="privacy-card-content">
                      <div className="privacy-icon-badge" style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        background: user.is_private ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid',
                        borderColor: user.is_private ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: user.is_private ? '#F87171' : '#34D399',
                        flexShrink: 0,
                      }}>
                        {user.is_private ? <Lock size={20} /> : <Globe size={20} />}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <h3 style={{ fontSize: '1rem', color: '#FAFAFA', margin: 0, fontWeight: 700 }}>
                            {t('खाता गोपनीयता नियंत्रण', 'Account Privacy Control')}
                          </h3>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: user.is_private ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                            color: user.is_private ? '#F87171' : '#34D399',
                          }}>
                            {user.is_private ? t('निजी (Private)', 'Private') : t('सार्वजनिक (Public)', 'Public')}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, maxWidth: '540px' }}>
                          {user.is_private
                            ? t('अहाँक खाता अखन निजी अछि। केवल अहाँ आ प्रशासक अहाँक प्रोफाइल आ समस्त प्रस्तुति देखि सकैत छथि।', 'Your account is private. Only you and admins can see your profile and recordings.')
                            : t('अहाँक खाता सार्वजनिक अछि। अहाँक समस्त सार्वजनिक प्रस्तुति सुर-मिथिला समुदाय आ खोज मे सभक लेल उपलब्ध अछि।', 'Your account is public. Your approved recordings and profile are visible to the community.')}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="privacy-card-toggle-btn"
                      onClick={() => setShowPrivacyModal(true)}
                      style={{
                        padding: '11px 20px',
                        borderRadius: '12px',
                        border: '1px solid',
                        borderColor: user.is_private ? 'rgba(16, 185, 129, 0.45)' : 'rgba(234, 179, 8, 0.45)',
                        background: user.is_private
                          ? 'linear-gradient(135deg, #10B981, #059669)'
                          : 'linear-gradient(135deg, #EAB308, #CA8A04)',
                        color: '#070913',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                        flexShrink: 0,
                      }}
                    >
                      {user.is_private ? <Globe size={15} /> : <Lock size={15} />}
                      <span>
                        {user.is_private ? t('खाता सार्वजनिक करू', 'Make Account Public') : t('खाता निजी बनाउ', 'Make Account Private')}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: WATCH HISTORY */}
          {activeTab === 'history' && (
            <div>
              <WatchHistoryTab />
            </div>
          )}

          {/* TAB 3: LIBRARY / FAVORITES */}
          {activeTab === 'library' && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <h2 className="font-traditional" style={{ fontSize: '1.75rem', color: '#FAFAFA', marginBottom: '6px' }}>
                  {t('हमर संग्रह', 'My Saved Songs')}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', margin: 0 }}>
                  {t('अहाँक द्वारा पसंदीदा सूची मे सुरक्षित कएल गेल मैथिली लोकगीत।', 'Your bookmarked and favorite folk songs.')}
                </p>
              </div>

              {favorites.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                  {favorites.map((song) => (
                    <div
                      key={song.id || song.slug}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        padding: '14px',
                        background: 'rgba(15, 19, 36, 0.55)',
                        borderRadius: '16px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        transition: 'all 0.2s ease',
                      }}
                      className="recording-card"
                    >
                      <div style={{ position: 'relative', width: '56px', height: '56px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}>
                        <img
                          src={song.poster || '/placeholder.jpg'}
                          alt={song.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <button
                          type="button"
                          onClick={() => playTrack(song)}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'rgba(0, 0, 0, 0.45)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                          title="Play"
                        >
                          <Play size={18} fill="#EAB308" color="#EAB308" />
                        </button>
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Link
                          href={`/songs/${song.slug}`}
                          style={{
                            fontWeight: 700,
                            color: '#FAFAFA',
                            fontSize: '0.96rem',
                            display: 'block',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            textDecoration: 'none',
                          }}
                        >
                          {song.title}
                        </Link>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {song.singer || t('पारंपरिक', 'Traditional')}
                        </div>
                      </div>

                      <Heart size={18} color="#EF4444" fill="#EF4444" style={{ flexShrink: 0 }} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state-card">
                  <div style={{
                    width: '74px', height: '74px', borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444'
                  }}>
                    <Heart size={34} />
                  </div>
                  <h3 className="font-traditional" style={{ color: '#FAFAFA', fontSize: '1.4rem', margin: 0 }}>
                    {t('अहाँक प्रिय संग्रह अखन खाली अछि', 'Your library is empty')}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '420px', margin: 0, lineHeight: 1.5 }}>
                    {t(
                      'अपन मनपसंद मैथिली लोकगीत, सोहर, समदाउन खोजू आ दिल (❤️) आइकन पर क्लिक कए अपन संग्रह मे सुरक्षित करू।',
                      'Explore traditional Maithili folk songs and click the heart icon to save them to your library.'
                    )}
                  </p>
                  <Link
                    href="/"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 24px',
                      borderRadius: '999px',
                      background: 'linear-gradient(135deg, #EAB308, #CA8A04)',
                      color: '#070913',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      textDecoration: 'none',
                      marginTop: '8px',
                    }}
                  >
                    <span>{t('गीत संग्रह देखू', 'Explore Songs')}</span>
                    <ArrowRight size={15} />
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MY COVERS / RECORDINGS */}
          {activeTab === 'covers' && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <h2 className="font-traditional" style={{ fontSize: '1.75rem', color: '#FAFAFA', marginBottom: '6px' }}>
                  {t('हमर रिकाॅर्डिंग', 'My Recordings')}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', margin: 0 }}>
                  {t('अहाँक द्वारा गाउ-मिथिला स्टुडियो मे रिकाॅर्ड कएल गेल गीत आ प्रस्तुति।', 'Karaoke and folk covers recorded by you in Gaau-Mithila Studio.')}
                </p>
              </div>

              {isLoadingRecs ? (
                <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Loader2 size={32} className="animate-spin" color="#EAB308" style={{ margin: '0 auto 12px' }} />
                  <div>{t("लोड भ' रहल अछि...", 'Loading your recordings...')}</div>
                </div>
              ) : recordings.length === 0 ? (
                <div className="empty-state-card">
                  <div style={{
                    width: '74px', height: '74px', borderRadius: '50%',
                    background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EAB308'
                  }}>
                    <Mic size={34} />
                  </div>
                  <h3 className="font-traditional" style={{ color: '#FAFAFA', fontSize: '1.4rem', margin: 0 }}>
                    {t('अखन धरि कोनो प्रस्तुति नहि अछि', 'No recordings recorded yet')}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '440px', margin: 0, lineHeight: 1.5 }}>
                    {t(
                      'गाउ-मिथिला स्टुडियो मे जाउ, अपन मनपसंद लोकगीतक कराओके ट्रैक चुनु आ अपन सुर मे प्रस्तुति रिकॉर्ड करू!',
                      'Visit the Gaau-Mithila Studio to pick a folk karaoke track and record your genuine voice.'
                    )}
                  </p>
                  <Link
                    href="/community"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 24px',
                      borderRadius: '999px',
                      background: 'linear-gradient(135deg, #EAB308, #CA8A04)',
                      color: '#070913',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      textDecoration: 'none',
                      marginTop: '8px',
                    }}
                  >
                    <Mic size={15} />
                    <span>{t('गाउ-मिथिला स्टुडियो खोलू', 'Open Studio')}</span>
                  </Link>
                </div>
              ) : (
                <div>
                  {recordings.map((rec) => {
                    const recId = rec.recording_id || rec._id;
                    const isTogglingThis = togglingRecId === recId;
                    const isThisPlaying =
                      (currentTrack?.song?.slug === rec.song_slug ||
                        currentTrack?.song?.id === `cover-${recId}` ||
                        currentTrack?.recording?.audio?.hosted_audio_url === rec.audio_url) &&
                      isPlaying;

                    return (
                      <div key={recId} className={`recording-card ${isThisPlaying ? 'recording-card-playing' : ''}`}>
                        {/* Artwork & Play Button */}
                        <div style={{ position: 'relative', width: '52px', height: '52px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: '#111' }}>
                          <img
                            src={rec.song_poster || '/placeholder.jpg'}
                            alt={rec.song_title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <button
                            type="button"
                            onClick={() => handlePlayRecording(rec)}
                            style={{
                              position: 'absolute',
                              inset: 0,
                              background: isThisPlaying ? 'rgba(234, 179, 8, 0.45)' : 'rgba(0, 0, 0, 0.45)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                            title={isThisPlaying ? "Pause" : "Play"}
                          >
                            {isThisPlaying ? (
                              <Pause size={18} fill="#FAFAFA" color="#FAFAFA" />
                            ) : (
                              <Play size={18} fill="#EAB308" color="#EAB308" />
                            )}
                          </button>
                        </div>

                        {/* Title, Metadata, Badges */}
                        <div style={{ flex: 1, minWidth: '160px' }}>
                          <Link
                            href={`/songs/${rec.song_slug}?cover=${recId}`}
                            style={{
                              fontWeight: 700,
                              color: isThisPlaying ? '#FDE047' : '#FAFAFA',
                              fontSize: '1rem',
                              display: 'block',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              textDecoration: 'none',
                              marginBottom: '4px',
                            }}
                          >
                            {rec.song_title || t('मैथिली लोकगीत', 'Maithili Folk Song')}
                          </Link>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                            <span>{new Date(rec.created_at).toLocaleDateString()}</span>
                            <span>•</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Heart size={12} color="#EF4444" fill="#EF4444" />
                              {rec.likes || 0}
                            </span>
                            <span>•</span>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: rec.is_private ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                              color: rec.is_private ? '#F87171' : '#34D399',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}>
                              {rec.is_private ? <Lock size={11} /> : <Globe size={11} />}
                              <span>{rec.is_private ? t('निजी प्रस्तुति', 'Private') : t('सार्वजनिक', 'Public')}</span>
                            </span>
                          </div>
                        </div>

                        {/* Actions: Play via Global Player, View Cover, Privacy Toggle, Delete */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => handlePlayRecording(rec)}
                            style={{
                              padding: '7px 14px',
                              borderRadius: '8px',
                              background: isThisPlaying ? 'rgba(234, 179, 8, 0.25)' : 'rgba(234, 179, 8, 0.12)',
                              border: '1px solid',
                              borderColor: isThisPlaying ? '#EAB308' : 'rgba(234, 179, 8, 0.35)',
                              color: '#FDE047',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {isThisPlaying ? <Pause size={13} fill="#FDE047" /> : <Play size={13} fill="#FDE047" />}
                            <span>{isThisPlaying ? t('रोकू', 'Pause') : t('बजाउ', 'Play')}</span>
                          </button>

                          <Link
                            href={`/songs/${rec.song_slug}?cover=${recId}`}
                            style={{
                              padding: '7px 14px',
                              borderRadius: '8px',
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 255, 255, 0.12)',
                              color: '#FAFAFA',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <ExternalLink size={13} />
                            <span>{t('कवर देखू', 'View Cover')}</span>
                          </Link>

                          {canManagePrivacy && (
                            <button
                              type="button"
                              disabled={isTogglingThis}
                              onClick={() => handleToggleRecordingPrivacy(recId, rec.is_private)}
                              style={{
                                padding: '7px 14px',
                                borderRadius: '8px',
                                border: '1px solid',
                                borderColor: rec.is_private ? 'rgba(16, 185, 129, 0.4)' : 'rgba(234, 179, 8, 0.4)',
                                background: rec.is_private ? 'rgba(16, 185, 129, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                                color: rec.is_private ? '#34D399' : '#FDE047',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: isTogglingThis ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                              }}
                            >
                              {isTogglingThis ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : rec.is_private ? (
                                <Globe size={13} />
                              ) : (
                                <Lock size={13} />
                              )}
                              <span>
                                {rec.is_private ? t('सार्वजनिक करू', 'Make Public') : t('निजी बनाउ', 'Make Private')}
                              </span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setDeleteConfirmRecId(recId)}
                            style={{
                              padding: '7px 12px',
                              borderRadius: '8px',
                              background: 'rgba(239, 68, 68, 0.12)',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              color: '#EF4444',
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title={t('हटाउ', 'Delete recording')}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: SETTINGS */}
          {activeTab === 'settings' && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <h2 className="font-traditional" style={{ fontSize: '1.75rem', color: '#FAFAFA', marginBottom: '6px' }}>
                  {t('सेटिंग्स', 'Settings')}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', margin: 0 }}>
                  {t('अपन भाषा, ऑडियो गुणवत्ता आ सूचना प्राथमिकता के अनुकूल बनाउ।', 'Customize your language, audio quality, and notification preferences.')}
                </p>
              </div>

              {/* Language Selection - 3 Cultural Radio Cards */}
              <div className="form-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <h3 style={{ fontSize: '1.05rem', color: '#FAFAFA', margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Globe size={18} color="#EAB308" />
                    <span>{t('भाषा चयन (Language Mode)', 'Language Mode', 'भाषा चयन')}</span>
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {t('३ भाषा विधा उपलब्ध (3 modes available)', '3 modes available', '३ भाषा विधा उपलब्ध')}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                  {(LANGUAGES || [
                    { id: 'maithili', label: 'मैथिली (द्विभाषी)', badge: 'द्विभाषी', description: 'पारंपरिक मैथिली संग अंग्रेजी संकेत (Maithili + English cues)' },
                    { id: 'maithili_plus', label: 'मैथिली प्लस (शुद्ध)', badge: 'शुद्ध', description: '१००% शुद्ध पारंपरिक मैथिली (Zero English / Authentic Maithili)' },
                    { id: 'english', label: 'English', badge: 'Pure EN', description: '100% Global English Interface' },
                  ]).map((item) => {
                    const isSelected = language === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setLanguage(item.id)}
                        style={{
                          padding: '16px 18px',
                          borderRadius: '14px',
                          border: '1.5px solid',
                          borderColor: isSelected ? '#EAB308' : 'rgba(255, 255, 255, 0.08)',
                          background: isSelected ? 'rgba(234, 179, 8, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          transition: 'all 0.2s ease',
                          boxShadow: isSelected ? '0 4px 20px rgba(234, 179, 8, 0.15)' : 'none',
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 700, color: isSelected ? '#FDE047' : '#FAFAFA', fontSize: '0.94rem' }}>
                              {item.label}
                            </span>
                            <span style={{
                              fontSize: '0.68rem',
                              padding: '2px 7px',
                              borderRadius: '999px',
                              background: isSelected ? 'rgba(234, 179, 8, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                              color: isSelected ? '#FDE047' : 'var(--text-muted)',
                              fontWeight: 600,
                            }}>
                              {item.badge}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                            {item.description}
                          </div>
                        </div>
                        <div style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          border: isSelected ? 'none' : '2px solid rgba(255, 255, 255, 0.25)',
                          background: isSelected ? '#EAB308' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#070913',
                          flexShrink: 0
                        }}>
                          {isSelected && <Check size={14} strokeWidth={3} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Audio Quality Selection */}
              <div className="form-card">
                <h3 style={{ fontSize: '1.05rem', color: '#FAFAFA', marginBottom: '14px', fontWeight: 700 }}>
                  {t('ऑडियो गुणवत्ता (Audio Quality)', 'Audio Quality')}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                  {[
                    { id: 'standard', title: t('सामान्य (Standard)', 'Standard'), desc: '128 kbps • Data Saver' },
                    { id: 'high', title: t('उच्च गुणवत्ता (High Fidelity)', 'High Fidelity Studio'), desc: '320 kbps • Lossless Master' },
                  ].map((item) => {
                    const isSelected = audioQuality === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setAudioQuality(item.id)}
                        style={{
                          padding: '16px',
                          borderRadius: '14px',
                          border: '1px solid',
                          borderColor: isSelected ? '#EAB308' : 'rgba(255, 255, 255, 0.08)',
                          background: isSelected ? 'rgba(234, 179, 8, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, color: isSelected ? '#FDE047' : '#FAFAFA', fontSize: '0.92rem' }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {item.desc}
                          </div>
                        </div>
                        {isSelected && (
                          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#EAB308', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#070913' }}>
                            <Check size={14} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notification Preferences */}
              <div className="form-card">
                <h3 style={{ fontSize: '1.05rem', color: '#FAFAFA', marginBottom: '14px', fontWeight: 700 }}>
                  {t('सूचना (Notifications)', 'Notifications')}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                    <input
                      type="checkbox"
                      defaultChecked
                      style={{ width: '18px', height: '18px', accentColor: '#EAB308', cursor: 'pointer' }}
                    />
                    <span>{t('नव समुदाय रिकाॅर्डिंग पर ईमेल भेजू (Email on new community covers)', 'Email on new community covers')}</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                    <input
                      type="checkbox"
                      defaultChecked
                      style={{ width: '18px', height: '18px', accentColor: '#EAB308', cursor: 'pointer' }}
                    />
                    <span>{t('साप्ताहिक लोकप्रिय गीतक ईमेल भेजू (Weekly trending songs email)', 'Weekly trending songs email')}</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ACCOUNT PRIVACY MODAL */}
      {showPrivacyModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => !isTogglingAccountPrivacy && setShowPrivacyModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '480px',
              width: '100%',
              borderRadius: '24px',
              background: '#0B0E1A',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              padding: '28px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.85), 0 0 35px rgba(234, 179, 8, 0.12)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: user.is_private ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: '1px solid',
                borderColor: user.is_private ? '#10B981' : '#EF4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: user.is_private ? '#10B981' : '#EF4444',
                flexShrink: 0,
              }}>
                {user.is_private ? <Globe size={26} /> : <Lock size={26} />}
              </div>
              <div>
                <h3 className="font-traditional" style={{ fontSize: '1.3rem', color: '#F8FAFC', margin: 0 }}>
                  {user.is_private ? t('खाता सार्वजनिक बनाउ', 'Make Account Public') : t('खाता निजी बनाउ', 'Make Account Private')}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {t('गोपनीयता सेटिंग (Privacy Settings)', 'Privacy Configuration')}
                </span>
              </div>
            </div>

            <div style={{
              padding: '16px',
              borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '0.88rem',
              lineHeight: 1.6,
              color: 'var(--text-secondary)',
            }}>
              {user.is_private ? (
                <p style={{ margin: 0 }}>
                  {t(
                    'सार्वजनिक केला उत्तर अहाँक प्रोफाइल आ समस्त सार्वजनिक प्रस्तुति सुर-मिथिला समुदाय आ खोज मे सभक लेल दृश्यमान भ\' जाएत।',
                    'Once made public, your profile and approved recordings will be visible to everyone across the Sur Mithila community and search.'
                  )}
                </p>
              ) : (
                <p style={{ margin: 0 }}>
                  {t(
                    'निजी केला उत्तर अहाँक प्रोफाइल आ समस्त प्रस्तुति केवल अहाँ आ व्यवस्थापक के देखबामे आएत। अन्य कोनो व्यक्ति अहाँक प्रोफाइल नहि देखि सकत।',
                    'Once made private, your profile and recordings will ONLY be visible to you and administrators. Other visitors will see a locked account notice.'
                  )}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                type="button"
                disabled={isTogglingAccountPrivacy}
                onClick={() => setShowPrivacyModal(false)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#FAFAFA',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('रद्द करू', 'Cancel')}
              </button>

              <button
                type="button"
                disabled={isTogglingAccountPrivacy}
                onClick={handleToggleAccountPrivacy}
                style={{
                  padding: '10px 22px',
                  borderRadius: '10px',
                  background: user.is_private
                    ? 'linear-gradient(135deg, #10B981, #059669)'
                    : 'linear-gradient(135deg, #EAB308, #CA8A04)',
                  border: 'none',
                  color: '#070913',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  cursor: isTogglingAccountPrivacy ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {isTogglingAccountPrivacy && <Loader2 size={16} className="animate-spin" />}
                {user.is_private
                  ? t('हँ, सार्वजनिक करू', 'Yes, Make Public')
                  : t('हँ, निजी बनाउ', 'Yes, Make Private')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE RECORDING CONFIRMATION MODAL */}
      {deleteConfirmRecId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => !isDeletingRec && setDeleteConfirmRecId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '440px',
              width: '100%',
              borderRadius: '20px',
              background: '#0B0E1A',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              padding: '28px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.85)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444',
                flexShrink: 0
              }}>
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="font-traditional" style={{ fontSize: '1.25rem', color: '#F8FAFC', margin: 0 }}>
                  {t('रिकॉर्डिंग हटाउ', 'Delete Recording')}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {t('ई प्रक्रिया स्थायी अछि', 'This action cannot be undone')}
                </span>
              </div>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0, lineHeight: 1.5 }}>
              {t(
                'की अहाँ सच मे ई रिकॉर्डिंग हमेशा लेल हटाबय चाहैत छी? एकर समस्त टिप्पड़ी आ पसंद सेहो हटा देल जाएत।',
                'Are you sure you want to permanently delete this cover? All comments and likes will be removed as well.'
              )}
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                type="button"
                disabled={isDeletingRec}
                onClick={() => setDeleteConfirmRecId(null)}
                style={{
                  padding: '9px 16px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#FAFAFA',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('रद्द करू', 'Cancel')}
              </button>

              <button
                type="button"
                disabled={isDeletingRec}
                onClick={() => handleDeleteRecording(deleteConfirmRecId)}
                style={{
                  padding: '9px 20px',
                  borderRadius: '10px',
                  background: '#EF4444',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '0.86rem',
                  fontWeight: 700,
                  cursor: isDeletingRec ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isDeletingRec && <Loader2 size={15} className="animate-spin" />}
                <span>{t('हँ, हटाउ', 'Yes, Delete')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING TOAST NOTIFICATION (ALWAYS VISIBLE ABOVE PLAYER BAR) */}
      {toastNotification && (
        <div style={{
          position: 'fixed',
          bottom: '100px',
          right: '28px',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px 22px',
          borderRadius: '16px',
          background: toastNotification.type === 'error'
            ? 'rgba(28, 12, 18, 0.96)'
            : 'rgba(10, 26, 18, 0.96)',
          border: '1px solid',
          borderColor: toastNotification.type === 'error' ? 'rgba(239, 68, 68, 0.65)' : 'rgba(16, 185, 129, 0.65)',
          boxShadow: toastNotification.type === 'error'
            ? '0 12px 36px rgba(239, 68, 68, 0.35), 0 0 20px rgba(239, 68, 68, 0.2)'
            : '0 12px 36px rgba(16, 185, 129, 0.35), 0 0 20px rgba(16, 185, 129, 0.2)',
          backdropFilter: 'blur(20px)',
          color: '#FAFAFA',
          fontSize: '0.92rem',
          fontWeight: 700,
          animation: 'toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          {toastNotification.type === 'error' ? (
            <AlertCircle size={20} color="#EF4444" />
          ) : (
            <CheckCircle2 size={20} color="#10B981" />
          )}
          <span>{toastNotification.message}</span>
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div style={{ padding: '60px', textAlign: 'center', color: '#FAFAFA' }}>Loading...</div>}>
      <ProfileContent />
    </Suspense>
  );
}