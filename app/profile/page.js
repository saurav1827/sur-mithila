'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { usePlayer } from '../../context/PlayerContext';
import { useLanguage } from '../../context/LanguageContext';
import { LogOut, Settings, Disc, Play, Heart, Shield, Edit2, User as UserIcon, Clock } from 'lucide-react';
import WatchHistoryTab from '../../components/profile/WatchHistoryTab';

const TAB_IDS = ['details', 'history', 'library', 'covers', 'settings'];

const TABS = [
  { id: 'details', icon: UserIcon, mai: 'हमर विवरण', en: 'My Details' },
  { id: 'history', icon: Clock, mai: 'श्रवण इतिहास', en: 'Watch History' },
  { id: 'library', icon: Heart, mai: 'हमर संग्रह', en: 'Library' },
  { id: 'covers', icon: Disc, mai: 'रिकाॅर्डिंग', en: 'My Covers' },
  { id: 'settings', icon: Settings, mai: 'सेटिंग्स', en: 'Settings' },
];

const navBtn = (active, color) => ({
  display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderRadius: '8px',
  background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
  color: color || (active ? '#FAFAFA' : 'var(--text-secondary)'),
  fontSize: '0.9rem', fontWeight: active ? 600 : 500, transition: 'all 0.2s ease',
  cursor: 'pointer', border: 'none', textAlign: 'left', width: '100%', textDecoration: 'none',
});

const EditableField = ({ label, value, onChange, placeholder, type = 'text', isTextArea = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const fieldStyle = { padding: '12px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', color: '#FAFAFA', fontSize: '0.95rem', width: '100%', fontFamily: 'inherit' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          {isEditing ? (
            isTextArea ? (
              <textarea rows="4" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} style={{ ...fieldStyle, resize: 'none' }} />
            ) : (
              <input type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} style={fieldStyle} />
            )
          ) : (
            <div
              onClick={() => setIsEditing(true)}
              style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid transparent', color: value ? '#FAFAFA' : 'var(--text-muted)', fontSize: '0.95rem', width: '100%', minHeight: isTextArea ? '96px' : 'auto', cursor: 'text', whiteSpace: 'pre-wrap' }}
            >
              {value || placeholder}
            </div>
          )}
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          style={{ padding: '10px', background: 'transparent', border: 'none', color: isEditing ? '#EAB308' : 'var(--text-muted)', cursor: 'pointer', borderRadius: '8px', transition: 'all 0.2s ease' }}
          title={isEditing ? 'Done' : 'Edit'}
        >
          <Edit2 size={18} />
        </button>
      </div>
    </div>
  );
};

const SectionHeader = ({ title, sub }) => (
  <>
    <h2 className="font-traditional" style={{ fontSize: '1.8rem', color: '#FAFAFA', marginBottom: '8px', letterSpacing: '-0.01em' }}>{title}</h2>
    <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '32px' }}>{sub}</p>
  </>
);

const Stat = ({ label, value }) => (
  <div style={{ padding: '14px 16px', borderRadius: '12px', background: 'rgba(0,0,0,0.35)', border: '1px solid var(--border-card)' }}>
    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#FAFAFA', lineHeight: 1.1 }}>{value}</div>
    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{label}</div>
  </div>
);

function ProfileContent() {
  const { user, isLoaded, logout, updateUser, openSignIn } = useAuth();
  const { playTrack } = usePlayer();
  const { language, toggleLanguage, t } = useLanguage();
  const searchParams = useSearchParams();

  const [recordings, setRecordings] = useState([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(true);
  const [favorites, setFavorites] = useState([]);
  const [historyCount, setHistoryCount] = useState(0);
  const [activeTab, setActiveTab] = useState('details');

  const [formData, setFormData] = useState({ name: '', avatar: '', location: '', bio: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [formKey, setFormKey] = useState(0);
  const fileInputRef = useRef(null);

  // ?tab=settings deep link (used by the navbar menu)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (TAB_IDS.includes(tab)) setActiveTab(tab);
  }, [searchParams]);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    setFormData({ name: user.name || '', avatar: user.avatar || '', location: user.location || '', bio: user.bio || '' });

    // 1. One-time cleanup of legacy global favorites
    try {
      localStorage.removeItem('sur_mithila_favorites');
    } catch { }

    // 2. Load authentic user recordings
    fetch(`/api/recordings/user?userId=${encodeURIComponent(user.id)}`)
      .then((res) => res.json())
      .then((data) => { if (!cancelled && data.recordings) setRecordings(data.recordings); })
      .catch(() => { })
      .finally(() => { if (!cancelled) setIsLoadingRecs(false); });

    // 3. Load authentic user favorites from server
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

    // 4. Load history count
    try {
      const hRaw = localStorage.getItem('sur_mithila_history');
      if (hRaw) setHistoryCount(JSON.parse(hRaw).length);
    } catch { }

    fetch('/api/history')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.history) {
          setHistoryCount(data.history.length);
        }
      })
      .catch(() => { });

    return () => { cancelled = true; };
  }, [user]);

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

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      // The server identifies the user from their session; no id is sent.
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        updateUser(formData);
        setSaveMessage(t('प्रोफाइल अपडेट भ गेल!', 'Profile updated successfully!'));
        setTimeout(() => { setSaveMessage(''); setFormKey((k) => k + 1); }, 1000);
      } else {
        setSaveMessage(data.error || 'Failed to update');
      }
    } catch (error) {
      console.error(error);
      setSaveMessage('An error occurred: ' + (error.message || 'unknown'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isLoaded) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#FAFAFA' }}>Loading...</div>;
  }

  // Middleware normally redirects before we get here; this is the fallback.
  if (!user) {
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center', maxWidth: '600px', margin: '40px auto' }}>
        <h2 className="font-traditional" style={{ fontSize: '2rem', color: '#FAFAFA', marginBottom: '16px' }}>{t('प्रोफाइल', 'Profile')}</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
          {t('प्रोफाइल देखय लेल कृपया लॉगिन करू।', 'Please sign in to view your profile.')}
        </p>
        <button
          onClick={() => openSignIn({ redirectUrl: '/profile' })}
          style={{ padding: '12px 28px', borderRadius: '9999px', background: '#FAFAFA', color: '#000', fontWeight: 600, border: 'none', cursor: 'pointer' }}
        >
          {t('लॉगिन करू', 'Sign In')}
        </button>
      </div>
    );
  }

  const memberSince = user.joined_at
    ? new Date(user.joined_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : '—';

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 0 40px' }}>
      <style>{`
        .profile-layout{display:flex;gap:48px;align-items:flex-start}
        .profile-nav{width:240px;flex-shrink:0;display:flex;flex-direction:column;gap:4px}
        .profile-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:24px}
        .profile-panel{animation:profileFade .25s ease}
        @keyframes profileFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @media (max-width:860px){
          .profile-layout{flex-direction:column;gap:20px}
          .profile-nav{
            width:100%;
            display:flex;
            flex-direction:row;
            overflow-x:auto;
            -webkit-overflow-scrolling:touch;
            scrollbar-width:none;
            gap:8px;
            padding:4px 2px 10px 2px;
            border-bottom:1px solid rgba(255,255,255,0.08);
          }
          .profile-nav::-webkit-scrollbar{display:none}
          .profile-nav>*{
            flex:0 0 auto!important;
            white-space:nowrap!important;
            width:auto!important;
            padding:8px 14px!important;
            border-radius:9999px!important;
            font-size:0.84rem!important;
            border:1px solid rgba(255,255,255,0.08)!important;
            background:rgba(255,255,255,0.03)!important;
          }
          .profile-nav>*[aria-current="page"]{
            background:rgba(234,179,8,0.16)!important;
            border-color:rgba(234,179,8,0.45)!important;
            color:#FDE047!important;
            font-weight:700!important;
          }
        }
        @media (max-width:680px){.profile-stats{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
        @media (max-width:520px){
          .profile-head{flex-direction:column;align-items:flex-start!important}
          .profile-head img{width:70px!important;height:70px!important}
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '28px', borderRadius: '20px', marginBottom: '32px', border: '1px solid var(--border-card)',
        background: 'linear-gradient(135deg, rgba(234,179,8,0.20) 0%, rgba(239,68,68,0.10) 55%, rgba(6,182,212,0.08) 100%)',
      }}>
        <div className="profile-head" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <img src={user.avatar} alt={user.name} style={{ width: '88px', height: '88px', borderRadius: '50%', objectFit: 'cover', background: '#111', border: '3px solid #EAB308', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }} />
          <div style={{ minWidth: 0 }}>
            <h1 className="font-traditional" style={{ fontSize: '1.9rem', color: '#FAFAFA', letterSpacing: '-0.01em', lineHeight: 1.1, marginBottom: '6px' }}>{user.name}</h1>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>
              {user.email}{user.location ? ` • ${user.location}` : ''}
            </div>
          </div>
        </div>
        <div className="profile-stats">
          <Stat label={t('रिकाॅर्डिंग', 'Covers')} value={isLoadingRecs ? '…' : recordings.length} />
          <Stat label={t('प्रिय गीत', 'Favorites')} value={favorites.length} />
          <Stat label={t('सुनल गीत', 'Played')} value={historyCount} />
          <Stat label={t('सदस्य सँ', 'Member since')} value={memberSince} />
        </div>
      </div>

      <div className="profile-layout">
        {/* Tabs: sidebar on desktop, horizontal scroll on mobile */}
        <nav className="profile-nav" aria-label="Profile sections">
          {TABS.map(({ id, icon: Icon, mai, en }) => (
            <button key={id} onClick={() => setActiveTab(id)} style={navBtn(activeTab === id)} aria-current={activeTab === id ? 'page' : undefined}>
              <Icon size={16} color={activeTab === id ? '#FAFAFA' : 'var(--text-muted)'} />
              {t(mai, en)}
            </button>
          ))}
          {user.role === 'admin' && (
            <Link href="/admin" style={navBtn(false, '#EAB308')}>
              <Shield size={16} color="#EAB308" /> {t('प्रशासन', 'Admin')}
            </Link>
          )}
          <button onClick={logout} style={navBtn(false, '#EF4444')}>
            <LogOut size={16} color="#EF4444" /> {t('लॉगआउट', 'Log Out')}
          </button>
        </nav>

        {/* Content */}
        <div key={activeTab} className="profile-panel" style={{ flex: 1, minWidth: 0, width: '100%' }}>
          {activeTab === 'details' && (
            <div>
              <SectionHeader title={t('हमर विवरण', 'My Details')} sub={t('अपन प्रोफाइल विवरण अपडेट करू।', 'Manage your personal information.')} />
              <div key={formKey} style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '600px' }}>
                <div style={{ position: 'relative', width: '96px', height: '96px' }}>
                  <img src={formData.avatar || user.avatar} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', objectFit: 'cover' }} />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ position: 'absolute', bottom: 0, right: 0, background: '#EAB308', color: '#000', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
                    title={t('तस्वीर बदलू', 'Change Picture')}
                  >
                    <Edit2 size={16} />
                  </button>
                  <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleImageChange} />
                </div>

                <EditableField
                  label={t('पूरा नाम (Full Name)', 'Full Name')}
                  value={formData.name}
                  onChange={(val) => setFormData({ ...formData, name: val })}
                  placeholder={t('पूरा नाम दर्ज करू', 'Enter your full name')}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('ईमेल (Email Address)', 'Email Address')}</label>
                  <input type="email" value={user.email || ''} disabled style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: '0.95rem', width: '100%', cursor: 'not-allowed' }} />
                </div>

                <EditableField
                  label={t('स्थान / गाम (Location / Village)', 'Location / Village')}
                  value={formData.location}
                  onChange={(val) => setFormData({ ...formData, location: val })}
                  placeholder={t('जेना: मधुबनी, दरभंगा', 'e.g. Madhubani, Darbhanga')}
                />

                <EditableField
                  label={t('अपन विषय मे (Bio)', 'Bio')}
                  value={formData.bio}
                  onChange={(val) => setFormData({ ...formData, bio: val })}
                  placeholder={t('अपन संगीतमय यात्राक विषय मे किछु लिखू...', 'Tell us about your musical journey...')}
                  isTextArea
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    style={{ padding: '12px 28px', borderRadius: '8px', background: '#FAFAFA', color: '#000', fontWeight: 600, border: 'none', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1 }}
                  >
                    {isSaving ? t('सेव भ रहल अछि...', 'Saving...') : t('सेव करू', 'Save Changes')}
                  </button>
                  {saveMessage && (
                    <span style={{ fontSize: '0.9rem', fontWeight: 500, color: /error|Failed|Invalid|required/i.test(saveMessage) ? '#EF4444' : '#10B981' }}>
                      {saveMessage}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              <WatchHistoryTab />
            </div>
          )}

          {activeTab === 'covers' && (
            <div>
              <SectionHeader title={t('हमर रिकाॅर्डिंग', 'My Covers')} sub={t('अहाँक द्वारा गाउ-मिथिला स्टुडियो मे रिकाॅर्ड कएल गेल गीत।', 'Songs you have recorded in the Gaau-Mithila Studio.')} />
              {isLoadingRecs ? (
                <div style={{ padding: '40px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{t("लोड भ' रहल अछि...", 'Loading...')}</div>
              ) : recordings.length === 0 ? (
                <div style={{ padding: '40px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <Disc size={40} color="var(--text-muted)" style={{ opacity: 0.5 }} />
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{t('अहाँ अखन धरि कोनो गीत रिकाॅर्ड नहि केने छी।', 'You have not recorded any covers yet.')}</p>
                  <Link href="/community" style={{ color: '#FAFAFA', fontWeight: 500, borderBottom: '1px solid #FAFAFA', width: 'fit-content', paddingBottom: '2px' }}>
                    {t('समुदाय के गीत सुनू', 'Listen to Community Covers')}
                  </Link>
                </div>
              ) : (
                recordings.map((rec) => (
                  <div key={rec._id} style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {rec.song_poster ? (
                        <img
                          src={rec.song_poster}
                          alt={rec.song_title}
                          style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{
                          width: '44px', height: '44px', borderRadius: '8px',
                          background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <Disc size={20} color="#EAB308" />
                        </div>
                      )}
                      <button
                        onClick={() => playTrack(
                          {
                            id: rec.song_slug,
                            slug: rec.song_slug,
                            title: { canonical: rec.song_title },
                            poster: { image_url: rec.song_poster || null },
                            credits: { singer: `${user.name} (Cover)` },
                          },
                          { audio: { hosted_audio_url: rec.audio_url } }
                        )}
                        aria-label="Play"
                        style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                      >
                        <Play size={16} fill="#000" color="#000" style={{ marginLeft: '2px' }} />
                      </button>
                    </div>
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <Link href={`/songs/${rec.song_slug}`} style={{ fontWeight: 600, color: '#FAFAFA', fontSize: '1.05rem', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {rec.song_title || t('अज्ञात गीत', 'Unknown Song')}
                      </Link>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {new Date(rec.created_at).toLocaleDateString()} <span style={{ opacity: 0.5, margin: '0 6px' }}>•</span> {rec.likes} Likes
                      </div>
                    </div>
                    <div style={{ padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '9999px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <audio src={rec.audio_url} controls style={{ height: '32px', maxWidth: '180px', filter: 'grayscale(1) contrast(1.2)' }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'library' && (
            <div>
              <SectionHeader title={t('हमर संग्रह', 'My Library')} sub={t('अहाँक प्रिय गीत सूची।', 'Your favorite saved songs.')} />
              {favorites.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                  {favorites.map((song) => (
                    <Link key={song.id} href={`/songs/${song.slug}`} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <img src={song.poster || '/placeholder.jpg'} alt={song.title} style={{ width: '56px', height: '56px', borderRadius: '8px', objectFit: 'cover' }} />
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontWeight: 600, color: '#FAFAFA', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{song.singer}</div>
                      </div>
                      <Heart size={16} color="#EF4444" fill="#EF4444" />
                    </Link>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '60px 0', color: 'var(--text-muted)' }}>{t('कोनो गीत प्रिय सूची मे नहि अछि।', 'No favorite songs yet.')}</div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div>
              <SectionHeader title={t('सेटिंग्स', 'Settings')} sub={t('अपन अनुभव के अनुकूल बनाउ।', 'Customize your experience.')} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', color: '#FAFAFA', marginBottom: '16px' }}>{t('भाषा (Language)', 'Language')}</h3>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {[['maithili', 'मैथिली'], ['english', 'English']].map(([id, label]) => (
                      <button
                        key={id}
                        onClick={() => language !== id && toggleLanguage()}
                        style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid', borderColor: language === id ? '#EAB308' : 'rgba(255,255,255,0.1)', background: language === id ? 'rgba(234,179,8,0.1)' : 'transparent', color: language === id ? '#EAB308' : '#FAFAFA', cursor: 'pointer', fontWeight: 500 }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '1.1rem', color: '#FAFAFA', marginBottom: '16px' }}>{t('ऑडियो गुणवत्ता (Audio Quality)', 'Audio Quality')}</h3>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#FAFAFA', cursor: 'pointer', fontWeight: 500 }}>
                      {t('सामान्य (Standard)', 'Standard')}
                    </button>
                    <button style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #EAB308', background: 'rgba(234,179,8,0.1)', color: '#EAB308', cursor: 'pointer', fontWeight: 500 }}>
                      {t('उच्च (High - 320kbps)', 'High (320kbps)')}
                    </button>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '1.1rem', color: '#FAFAFA', marginBottom: '16px' }}>{t('सूचना (Notifications)', 'Notifications')}</h3>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <input type="checkbox" defaultChecked style={{ width: '18px', height: '18px', accentColor: '#EAB308' }} />
                    {t('नव समुदाय रिकाॅर्डिंग पर ईमेल भेजू (Email on new community covers)', 'Email on new community covers')}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', color: 'var(--text-secondary)', marginTop: '12px' }}>
                    <input type="checkbox" defaultChecked style={{ width: '18px', height: '18px', accentColor: '#EAB308' }} />
                    {t('साप्ताहिक लोकप्रिय गीतक ईमेल भेजू (Weekly trending songs email)', 'Weekly trending songs email')}
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// useSearchParams needs a Suspense boundary for static builds
export default function ProfilePage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: '#FAFAFA' }}>Loading...</div>}>
      <ProfileContent />
    </Suspense>
  );
}