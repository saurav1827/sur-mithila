'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ListMusic, Plus, Play, Sparkles, Disc, Music2,
  FolderPlus, Headphones, Heart, ArrowRight, User
} from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import AddToPlaylistModal from '../../components/playlist/AddToPlaylistModal';

export default function PlaylistsPage() {
  const { playPlaylist } = usePlayer();
  const { user } = useAuth();
  const { t, isEnglish, isMaithiliPlus } = useLanguage();
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'curated' | 'my'
  const [curatedPlaylists, setCuratedPlaylists] = useState([]);
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    loadAllPlaylists();
  }, [user]);

  const loadAllPlaylists = async () => {
    setLoading(true);
    try {
      let apiUser = [];
      let apiCurated = [];
      try {
        const res = await fetch('/api/playlists');
        if (res.ok) {
          const data = await res.json();
          apiCurated = data.curated || [];
          if (data.user) apiUser = data.user;
        }
      } catch (err) {
        console.warn('API playlists fetch note:', err);
      }

      setCuratedPlaylists(apiCurated);

      // Merge with guest playlists in localStorage
      const raw = localStorage.getItem('sur_mithila_guest_playlists') || '[]';
      const guestList = JSON.parse(raw);
      const combinedUser = [...apiUser];

      if (Array.isArray(guestList)) {
        for (const g of guestList) {
          if (!combinedUser.some(p => p.id === g.id || (p._id && p._id === g._id))) {
            combinedUser.push(g);
          }
        }
      }

      setUserPlaylists(combinedUser);
    } catch (e) {
      console.warn('Failed to load playlists:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const title = newTitle.trim();
    try {
      let created = null;
      try {
        const res = await fetch('/api/playlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description: '', trackIds: [] })
        });
        if (res.ok) {
          created = await res.json();
        }
      } catch (err) {
        console.warn('Server playlist creation note:', err);
      }

      if (!created) {
        const now = new Date().toISOString();
        const id = `pl_guest_${Date.now()}`;
        created = {
          id,
          slug: id,
          title,
          description: '',
          creator: { user_id: 'guest', user_name: 'अतिथि श्रोता' },
          is_public: true,
          track_ids: [],
          created_at: now,
          updated_at: now
        };
      }

      // Store in localStorage
      try {
        const raw = localStorage.getItem('sur_mithila_guest_playlists') || '[]';
        const list = JSON.parse(raw);
        const updated = [created, ...list.filter(p => p.id !== created.id && (!p._id || p._id !== created._id))];
        localStorage.setItem('sur_mithila_guest_playlists', JSON.stringify(updated));
      } catch {}

      setUserPlaylists(prev => [created, ...prev]);
      setNewTitle('');
      setShowCreateModal(false);
    } catch (err) {
      console.error('Error creating playlist:', err);
    }
  };

  const displayedPlaylists = activeTab === 'curated'
    ? curatedPlaylists
    : activeTab === 'my'
    ? userPlaylists
    : [...curatedPlaylists, ...userPlaylists];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '36px', minHeight: '100vh', paddingBottom: '80px' }}>
      {/* Hero Banner */}
      <div className="playlist-hero-panel">
        <div className="playlist-hero-meta">
          <div className="playlist-hero-badge">
            <Sparkles size={14} color="#EAB308" />
            <span>{t('विशेष सांस्कृतिक संकलन', 'Curated Cultural Collections', 'विशेष सांस्कृतिक संकलन')}</span>
          </div>
          <h1 className="playlist-hero-title font-traditional">
            {t('सांस्कृतिक प्लेलिस्ट (Curated & Custom Playlists)', 'Curated & Custom Playlists', 'सांस्कृतिक तालिका')}
          </h1>
          <p className="playlist-hero-desc">
            {t(
              'मिथिलाक विभिन्न पावन अवसर, संस्कार, ऋतु आ आराध्य देव-देवी लेल विशेष रूप सं संयोजित संगीत संकलन। अपन मनपसंद गीतिक नव प्लेलिस्ट बनाउ आ सुनू।',
              'Specially curated musical collections for various auspicious Mithila occasions, rituals, seasons, and deities. Create and enjoy playlists of your favorite tracks.',
              'मिथिलाक विभिन्न पावन अवसर, संस्कार, ऋतु आ आराध्य देव-देवी लेल विशेष रूप सं संयोजित संगीत संकलन। अपन मनपसंद गीतिक नव तालिका बनाउ आ सुनू।'
            )}
          </p>

          <div style={{ marginTop: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowCreateModal(true)}
              className="playlist-hero-create-btn"
            >
              <Plus size={16} />
              <span>{t('नव प्लेलिस्ट बनाउ (New Playlist)', 'New Playlist', 'नव तालिका बनाउ')}</span>
            </button>
          </div>
        </div>

        <div className="playlist-hero-icon-box">
          <ListMusic size={64} color="#EAB308" style={{ opacity: 0.9 }} />
        </div>
      </div>

      {/* Navigation Tabs & Controls */}
      <div className="playlist-tabs-nav-bar">
        <div className="playlist-tab-pills">
          <button
            onClick={() => setActiveTab('all')}
            className={`playlist-filter-pill ${activeTab === 'all' ? 'active' : ''}`}
          >
            <span>{t('सभ प्लेलिस्ट', 'All Playlists', 'सभ तालिका')} ({curatedPlaylists.length + userPlaylists.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('curated')}
            className={`playlist-filter-pill ${activeTab === 'curated' ? 'active' : ''}`}
          >
            <span>{t('विशेष संकलन', 'Curated Collections', 'विशेष संकलन')} ({curatedPlaylists.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('my')}
            className={`playlist-filter-pill ${activeTab === 'my' ? 'active' : ''}`}
          >
            <span>{t('हमर प्लेलिस्ट', 'My Playlists', 'हमर तालिका')} ({userPlaylists.length})</span>
          </button>
        </div>
      </div>

      {/* Playlists Grid */}
      {displayedPlaylists.length > 0 ? (
        <div className="playlists-grid">
          {displayedPlaylists.map((pl) => {
            const isCurated = pl.is_curated;
            const linkHref = `/playlists/${pl.slug || pl.id}`;
            const trackCount = pl.track_ids?.length || pl.songs_count || 0;
            const hasMosaic = pl.mosaicCovers?.length >= 4;
            const coverImg = pl.cover_image && !pl.cover_image.includes('unsplash') ? pl.cover_image : null;

            return (
              <div key={pl.id || pl._id} className="playlist-card-container">
                <Link href={linkHref} className="playlist-card-link">
                  {/* Artwork Box */}
                  <div className="playlist-card-artwork">
                    {hasMosaic ? (
                      <div className="playlist-mosaic-grid">
                        {pl.mosaicCovers.slice(0, 4).map((img, i) => (
                          <img key={i} src={img} alt="cover tile" className="mosaic-tile" loading="lazy" />
                        ))}
                      </div>
                    ) : coverImg ? (
                      <img src={coverImg} alt={pl.title} className="playlist-cover-img" loading="lazy" />
                    ) : (
                      <div className="playlist-default-cover">
                        <Disc size={44} color="#EAB308" />
                      </div>
                    )}

                    <div className="playlist-card-overlay">
                      <div className="playlist-hover-play-btn" title={t('प्लेलिस्ट बजाउ (Play Playlist)', 'Play Playlist', 'तालिका बजाउ')}>
                        <Play size={22} fill="#070913" color="#070913" style={{ marginLeft: '3px' }} />
                      </div>
                    </div>

                    {/* Tag badge */}
                    <span className="playlist-badge-tag">
                      {isCurated ? (pl.badge ? t(pl.badge, 'Curated', pl.badge) : t('विशेष', 'Curated', 'विशेष')) : t('व्यक्तिगत', 'Personal', 'व्यक्तिगत')}
                    </span>
                  </div>

                  {/* Metadata */}
                  <div className="playlist-card-body">
                    <h3 className="playlist-card-title font-traditional">{pl.title}</h3>
                    {pl.description && (
                      <p className="playlist-card-desc">{pl.description}</p>
                    )}
                    <div className="playlist-card-footer">
                      <span className="playlist-track-stat">
                        <Music2 size={13} color="var(--accent-gold)" />
                        <span>{trackCount} {t('गीत (Songs)', 'tracks', 'गीत')}</span>
                      </span>
                      {pl.stats?.plays_count > 0 && (
                        <span className="playlist-plays-stat">
                          <Headphones size={13} color="var(--text-muted)" />
                          <span>{(pl.stats.plays_count / 1000).toFixed(1)}K</span>
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="playlist-empty-state">
          <ListMusic size={48} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '16px' }} />
          <h3 className="font-traditional" style={{ fontSize: '1.25rem', color: '#F8FAFC' }}>
            {t('अखनि कोनो प्लेलिस्ट उपलब्ध नै अछि', 'No playlists available yet', 'अखनि कोनो तालिका उपलब्ध नै अछि')}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '420px', margin: '8px auto 20px auto' }}>
            {t(
              'अहाँ अपन मनपसंद गीतिक संग्रह बनेबा लेल "नव प्लेलिस्ट बनाउ" पर क्लिक करू।',
              'Click "New Playlist" to create your personal music collection.',
              'अहाँ अपन मनपसंद गीतिक संग्रह बनेबा लेल "नव तालिका बनाउ" पर क्लिक करू।'
            )}
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="playlist-hero-create-btn"
          >
            <Plus size={16} />
            <span>{t('पहिल प्लेलिस्ट बनाउ', 'Create First Playlist', 'पहिल तालिका बनाउ')}</span>
          </button>
        </div>
      )}

      {/* Inline Modal for Creating New Playlist */}
      {showCreateModal && (
        <div className="playlist-modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="playlist-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="playlist-modal-header">
              <div className="modal-title-box">
                <FolderPlus size={20} color="#EAB308" />
                <h3 className="modal-heading font-traditional">{t('नव प्लेलिस्ट बनाउ (New Playlist)', 'Create New Playlist', 'नव तालिका बनाउ')}</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setShowCreateModal(false)} aria-label={t('बंद करू (Close)', 'Close', 'बंद करू')}>✕</button>
            </div>

            <form onSubmit={handleCreateNew} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
              <div className="create-input-wrapper">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={t('प्लेलिस्टक शीर्षक (e.g. हमर प्रिय सोहर आ समदाउन)...', 'Playlist title (e.g. Favorite Sohar & Samdaun)...', 'तालिकाक शीर्षक (उदा. हमर प्रिय सोहर आ समदाउन)...')}
                  className="playlist-inline-input"
                  autoFocus
                  maxLength={60}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    color: '#FAFAFA',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  {t('रद्द करू', 'Cancel', 'रद्द करू')}
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="playlist-create-submit-btn"
                >
                  <Plus size={15} />
                  <span>{t('बनाउ (Create)', 'Create', 'बनाउ')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
