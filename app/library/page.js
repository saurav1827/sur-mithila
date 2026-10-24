'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Heart, Clock, ListMusic, Trash2, Play, Disc, Music, Sparkles } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { useAuth } from '../../context/AuthContext';

export default function LibraryPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('favorites'); // 'favorites' | 'history' | 'playlists'
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const { playTrack } = usePlayer();

  const favKey = user ? `sur_mithila_favs_${user.id}` : 'sur_mithila_guest_favs';

  useEffect(() => {
    try {
      localStorage.removeItem('sur_mithila_favorites');
    } catch { }

    if (user) {
      fetch('/api/favorites')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.favorites) {
            setFavorites(d.favorites);
            try { localStorage.setItem(favKey, JSON.stringify(d.favorites)); } catch { }
          }
        })
        .catch(() => {
          try {
            const raw = localStorage.getItem(favKey);
            setFavorites(raw ? JSON.parse(raw) : []);
          } catch { setFavorites([]); }
        });
    } else {
      try {
        const favsRaw = localStorage.getItem(favKey) || '[]';
        setFavorites(JSON.parse(favsRaw));
      } catch { setFavorites([]); }
    }

    try {
      const histRaw = localStorage.getItem('sur_mithila_history') || '[]';
      setHistory(JSON.parse(histRaw));
    } catch { }

    // Load user & local playlists reliably
    const loadAllPlaylists = async () => {
      let apiUser = [];
      try {
        const r = await fetch('/api/playlists');
        if (r.ok) {
          const d = await r.json();
          if (Array.isArray(d?.user)) apiUser = d.user;
        }
      } catch (err) {}

      let localList = [];
      try {
        const raw = localStorage.getItem('sur_mithila_guest_playlists') || '[]';
        localList = JSON.parse(raw);
      } catch {}

      try {
        const raw2 = localStorage.getItem('sur_mithila_playlists');
        if (raw2) {
          const parsed = JSON.parse(raw2);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (!localList.some(p => (p.id && p.id === item.id) || (p._id && p._id === item._id))) {
                localList.push(item);
              }
            }
          }
        }
      } catch {}

      const combined = [...apiUser];
      if (Array.isArray(localList)) {
        for (const g of localList) {
          if (!combined.some(p => (p.id && p.id === g.id) || (p._id && p._id === g._id) || (p.slug && p.slug === g.slug))) {
            combined.push(g);
          }
        }
      }

      setPlaylists(combined);
    };

    loadAllPlaylists();

    const onStorageChange = () => {
      loadAllPlaylists();
    };
    window.addEventListener('storage', onStorageChange);
    window.addEventListener('focus', onStorageChange);

    return () => {
      window.removeEventListener('storage', onStorageChange);
      window.removeEventListener('focus', onStorageChange);
    };
  }, [user, favKey]);

  const removeFavorite = async (id, e) => {
    e.stopPropagation();
    const updated = favorites.filter((item) => item.id !== id);
    setFavorites(updated);
    try {
      localStorage.setItem(favKey, JSON.stringify(updated));
    } catch (err) {}

    if (user) {
      try {
        await fetch(`/api/favorites?songId=${encodeURIComponent(id)}`, { method: 'DELETE' });
      } catch { }
    }
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem('sur_mithila_history');
    } catch (err) {}
  };

  return (
    <div className="library-wrapper">
      {/* Compact Minimal Header Card */}
      <div className="library-hero-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
          <span className="gold-badge" style={{ margin: 0 }}>व्यक्तिगत संकलन</span>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            {activeTab === 'favorites' ? `${favorites.length} प्रिय गीत` : activeTab === 'history' ? `${history.length} हालिया` : `${playlists.length} प्लेलिस्ट`}
          </span>
        </div>

        <h1 className="library-title font-traditional">
          हमर संग्रह (My Library)
        </h1>
        <p className="library-subtitle">
          अपनेक प्रिय गीत, हाल मे सुनल गेल रचना, एवं सुरक्षित प्लेलिस्ट।
        </p>

        {/* Tab Controls: Minimal Horizontal Chips */}
        <div
          className="library-tabs-bar no-scrollbar"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <button
            onClick={() => setActiveTab('favorites')}
            className={`library-tab-chip ${activeTab === 'favorites' ? 'is-active' : ''}`}
          >
            <Heart size={14} fill={activeTab === 'favorites' ? '#070913' : 'none'} />
            <span>प्रिय गीत ({favorites.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`library-tab-chip ${activeTab === 'history' ? 'is-active' : ''}`}
          >
            <Clock size={14} />
            <span>हाल मे सुनल ({history.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('playlists')}
            className={`library-tab-chip ${activeTab === 'playlists' ? 'is-active' : ''}`}
          >
            <ListMusic size={14} />
            <span>प्लेलिस्ट ({playlists.length})</span>
          </button>
        </div>
      </div>

      {/* Tab Content: Favorites */}
      {activeTab === 'favorites' && (
        <div>
          {favorites.length > 0 ? (
            <div className="library-song-grid">
              {favorites.map((song) => (
                <div
                  key={song.id}
                  className="library-song-card"
                  onClick={() => playTrack(song)}
                >
                  <div className="library-song-poster">
                    {song.poster ? (
                      <img src={song.poster} alt={song.title} loading="lazy" />
                    ) : (
                      <div className="library-song-disc">
                        <Disc size={20} color="var(--accent-gold)" />
                      </div>
                    )}
                    <button
                      className="library-quick-play-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        playTrack(song);
                      }}
                      title="Play"
                    >
                      <Play size={11} fill="#070913" color="#070913" />
                    </button>
                  </div>

                  <div className="library-song-info">
                    <Link
                      href={`/songs/${song.slug}`}
                      onClick={(e) => e.stopPropagation()}
                      className="library-song-name font-traditional"
                    >
                      {song.title}
                    </Link>
                    <p className="library-song-meta">
                      {song.singer || 'पारंपरिक स्वर'} {song.category ? `• ${song.category}` : ''}
                    </p>
                  </div>

                  <button
                    onClick={(e) => removeFavorite(song.id, e)}
                    title="हटाउ (Remove)"
                    className="library-song-remove-btn"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="library-empty-box glass-panel">
              <Heart size={34} color="var(--accent-vermilion)" style={{ margin: '0 auto 10px', opacity: 0.6 }} />
              <h3 className="font-traditional" style={{ fontSize: '1.15rem', color: '#F8FAFC', marginBottom: '6px' }}>
                कोनो गीत प्रिय सूची मे नहि अछि
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', maxWidth: '340px', margin: '0 auto 16px', lineHeight: 1.4 }}>
                गीत सुनैत काल हृदय (Heart) आइकन पर क्लिक करि अपन प्रिय सूची मे जोड़ू।
              </p>
              <Link href="/" className="btn-primary" style={{ padding: '8px 18px', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-block' }}>
                गीत संग्रह देखू (Explore Songs)
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: History */}
      {activeTab === 'history' && (
        <div>
          {history.length > 0 ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '0 4px' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  कुल {history.length} हालिया गीत
                </span>
                <button
                  onClick={clearHistory}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '0.78rem',
                    color: '#EF4444',
                    background: 'rgba(239, 68, 68, 0.08)',
                    padding: '5px 10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={13} />
                  <span>इतिहास हटाउ</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {history.map((item, idx) => (
                  <div
                    key={idx}
                    className="library-history-row"
                    onClick={() => playTrack(item)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                      <div className="library-history-poster">
                        {item.poster ? (
                          <img src={item.poster} alt={item.title} loading="lazy" />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Disc size={18} color="var(--accent-gold)" />
                          </div>
                        )}
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <Link
                          href={`/songs/${item.slug}`}
                          onClick={(e) => e.stopPropagation()}
                          className="library-history-name font-traditional"
                        >
                          {item.title}
                        </Link>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.singer || 'पारंपरिक स्वर'}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {new Date(item.played_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button
                        className="library-quick-play-btn inline-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          playTrack(item);
                        }}
                        title="Play"
                      >
                        <Play size={11} fill="#070913" color="#070913" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="library-empty-box glass-panel">
              <Clock size={34} color="var(--accent-gold)" style={{ margin: '0 auto 10px', opacity: 0.6 }} />
              <h3 className="font-traditional" style={{ fontSize: '1.15rem', color: '#F8FAFC', marginBottom: '6px' }}>
                कोनो इतिहास नहि अछि
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
                अपने जे गीत सुनब, ओ एतय प्रदर्शित होयत।
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Playlists */}
      {activeTab === 'playlists' && (
        <div>
          {playlists.length > 0 ? (
            <div className="playlists-grid">
              {playlists.map((pl) => {
                const hasMosaic = pl.mosaicCovers?.length >= 4;
                const coverImg = pl.cover_image && !pl.cover_image.includes('unsplash') ? pl.cover_image : null;

                return (
                  <div key={pl.id || pl._id || pl.slug} className="playlist-card-container">
                    <Link href={`/playlists/${pl.slug || pl.id || pl._id}`} className="playlist-card-link">
                      <div className="playlist-card-artwork">
                        {hasMosaic ? (
                          <div className="playlist-mosaic-grid">
                            {pl.mosaicCovers.slice(0, 4).map((img, i) => (
                              <img key={i} src={img} alt="cover tile" className="mosaic-tile" loading="lazy" />
                            ))}
                          </div>
                        ) : coverImg ? (
                          <img
                            src={coverImg}
                            alt={pl.title}
                            className="playlist-cover-img"
                            loading="lazy"
                          />
                        ) : (
                          <div className="playlist-default-cover">
                            <Disc size={36} color="#EAB308" />
                          </div>
                        )}
                        <span className="playlist-badge-tag">हमर प्लेलिस्ट</span>
                      </div>
                      <div className="playlist-card-body">
                        <h3 className="playlist-card-title font-traditional">{pl.title}</h3>
                        <div className="playlist-card-footer">
                          <span className="playlist-track-stat">
                            <Music size={13} color="var(--accent-gold)" />
                            <span>{pl.track_ids?.length || pl.trackIds?.length || pl.songs_count || 0} गीत</span>
                          </span>
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="library-empty-box glass-panel">
              <ListMusic size={34} color="var(--accent-gold)" style={{ margin: '0 auto 10px', opacity: 0.6 }} />
              <h3 className="font-traditional" style={{ fontSize: '1.15rem', color: '#F8FAFC', marginBottom: '6px' }}>
                कोनो प्लेलिस्ट नहि अछि
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', marginBottom: '16px', maxWidth: '360px', margin: '0 auto 16px', lineHeight: 1.4 }}>
                अहाँ कोनो सेहो गीत कार्ड पर जा कऽ &quot;+ प्लेलिस्ट में जोड़ू&quot; बटन सं अपन प्लेलिस्ट बना सकैत छी।
              </p>
              <Link
                href="/playlists"
                className="playlist-hero-create-btn"
                style={{ textDecoration: 'none', display: 'inline-flex', padding: '8px 18px', fontSize: '0.85rem' }}
              >
                <span>प्लेलिस्ट हब देखू</span>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
