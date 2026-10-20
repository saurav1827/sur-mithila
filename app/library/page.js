'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Heart, Clock, ListMusic, Trash2, Play, Disc } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { useAuth } from '../../context/AuthContext';

export default function LibraryPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('favorites'); // 'favorites' | 'history'
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div className="glass-panel" style={{ padding: '36px 32px' }}>
        <span className="gold-badge" style={{ marginBottom: '12px' }}>व्यक्तिगत संकलन</span>
        <h1 className="font-traditional" style={{ fontSize: '2.4rem', color: '#F8FAFC', marginBottom: '8px' }}>
          हमर संग्रह (My Library)
        </h1>
        <p style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
          अपनेक प्रिय गीत, हाल मे सुनल गेल रचना, एवं सुरक्षित प्लेलिस्ट।
        </p>

        {/* Tab Controls */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button
            onClick={() => setActiveTab('favorites')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '10px',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: activeTab === 'favorites' ? '#070913' : 'var(--text-secondary)',
              background: activeTab === 'favorites' ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'rgba(255, 255, 255, 0.05)',
              border: activeTab === 'favorites' ? '1px solid #F59E0B' : '1px solid var(--border-card)',
              transition: 'all 0.2s ease'
            }}
          >
            <Heart size={16} fill={activeTab === 'favorites' ? '#070913' : 'none'} />
            <span>प्रिय गीत / Favorites ({favorites.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '10px',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: activeTab === 'history' ? '#070913' : 'var(--text-secondary)',
              background: activeTab === 'history' ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'rgba(255, 255, 255, 0.05)',
              border: activeTab === 'history' ? '1px solid #F59E0B' : '1px solid var(--border-card)',
              transition: 'all 0.2s ease'
            }}
          >
            <Clock size={16} />
            <span>हाल मे सुनल गेल / Recently Played ({history.length})</span>
          </button>
        </div>
      </div>

      {/* Tab Content: Favorites */}
      {activeTab === 'favorites' && (
        <div>
          {favorites.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '16px'
            }}>
              {favorites.map((song) => (
                <div
                  key={song.id}
                  className="song-card"
                  style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '14px', padding: '12px' }}
                >
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    flexShrink: 0,
                    background: '#13192B'
                  }}>
                    {song.poster ? (
                      <img src={song.poster} alt={song.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Disc size={24} color="var(--accent-gold)" />
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <Link
                      href={`/songs/${song.slug}`}
                      style={{
                        display: 'block',
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        color: '#F8FAFC',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {song.title}
                    </Link>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {song.singer} • {song.category}
                    </p>
                  </div>

                  <button
                    onClick={(e) => removeFavorite(song.id, e)}
                    title="Remove from favorites"
                    style={{ color: 'var(--text-muted)', padding: '6px' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '60px 24px', textAlign: 'center' }}>
              <Heart size={44} color="var(--accent-vermilion)" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
              <h3 className="font-traditional" style={{ fontSize: '1.3rem', color: '#F8FAFC', marginBottom: '8px' }}>
                कोनो गीत प्रिय सूची मे नहि अछि
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '18px' }}>
                गीत सुनैत काल हृदय (Heart) आइकन पर क्लिक करि अपन प्रिय सूची मे जोड़ू।
              </p>
              <Link href="/" className="btn-primary">
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
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
                <button
                  onClick={clearHistory}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.8rem',
                    color: 'var(--accent-vermilion)',
                    background: 'rgba(239, 68, 68, 0.1)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(239, 68, 68, 0.25)'
                  }}
                >
                  <Trash2 size={14} />
                  <span>इतिहास हटाउ (Clear History)</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {history.map((item, idx) => (
                  <div
                    key={idx}
                    className="glass-panel"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 18px',
                      borderRadius: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: '#13192B',
                        flexShrink: 0
                      }}>
                        {item.poster ? (
                          <img src={item.poster} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Disc size={20} color="var(--accent-gold)" />
                          </div>
                        )}
                      </div>

                      <div>
                        <Link
                          href={`/songs/${item.slug}`}
                          style={{ fontSize: '0.95rem', fontWeight: 600, color: '#F8FAFC' }}
                        >
                          {item.title}
                        </Link>
                        <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          {item.singer}
                        </p>
                      </div>
                    </div>

                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {new Date(item.played_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '60px 24px', textAlign: 'center' }}>
              <Clock size={44} color="var(--accent-gold)" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
              <h3 className="font-traditional" style={{ fontSize: '1.3rem', color: '#F8FAFC', marginBottom: '8px' }}>
                कोनो इतिहास नहि अछि
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                अपने जे गीत सुनब, ओ एतय प्रदर्शित होयत।
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
