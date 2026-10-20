'use client';

import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { track } from '../lib/tracking';
import { useAuth } from '../context/AuthContext';

export default function FavoriteButton({ song }) {
  const { user, isLoaded, openSignIn } = useAuth();
  const [isFavorited, setIsFavorited] = useState(false);
  const [loading, setLoading] = useState(false);

  const storageKey = user ? `sur_mithila_favs_${user.id}` : 'sur_mithila_guest_favs';

  // Check favorite status
  useEffect(() => {
    // One-time cleanup of stale legacy shared favorites
    try {
      localStorage.removeItem('sur_mithila_favorites');
    } catch { }

    if (!song?.id) return;

    // Check local cache first for instant feedback
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const list = JSON.parse(raw);
        setIsFavorited(list.some((item) => item.id === song.id));
      } else {
        setIsFavorited(false);
      }
    } catch { }

    // If logged in, sync with server
    if (user) {
      fetch('/api/favorites')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.favorites) {
            const has = d.favorites.some((item) => item.id === song.id);
            setIsFavorited(has);
            try {
              localStorage.setItem(storageKey, JSON.stringify(d.favorites));
            } catch { }
          }
        })
        .catch(() => { });
    }
  }, [song?.id, user?.id, storageKey]);

  const toggleFavorite = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      openSignIn();
      return;
    }

    if (loading || !song?.id) return;
    setLoading(true);

    const nextState = !isFavorited;
    setIsFavorited(nextState);

    try {
      // Optimistic update of local cache
      const raw = localStorage.getItem(storageKey);
      let list = raw ? JSON.parse(raw) : [];

      if (nextState) {
        const item = {
          id: song.id,
          slug: song.slug,
          title: song.title?.canonical || song.title?.devanagari || song.title,
          singer: song.credits?.singer || song.singer,
          poster: song.poster?.image_url || song.poster,
          category: song.category,
        };
        list = [item, ...list.filter((x) => x.id !== song.id)];
        localStorage.setItem(storageKey, JSON.stringify(list));
        track('favorite', { songId: song.id, surface: 'watch_primary' });

        await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ song }),
        });
      } else {
        list = list.filter((x) => x.id !== song.id);
        localStorage.setItem(storageKey, JSON.stringify(list));
        track('unfavorite', { songId: song.id, surface: 'watch_primary' });

        await fetch(`/api/favorites?songId=${encodeURIComponent(song.id)}`, {
          method: 'DELETE',
        });
      }
    } catch (err) {
      console.error('Failed to update favorite:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggleFavorite}
      title={isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 16px',
        borderRadius: '8px',
        background: isFavorited ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)',
        color: isFavorited ? '#EF4444' : 'var(--text-secondary)',
        border: isFavorited ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-card)',
        fontSize: '0.85rem',
        fontWeight: 600,
        transition: 'all 0.2s ease',
        cursor: 'pointer',
      }}
    >
      <Heart size={16} fill={isFavorited ? '#EF4444' : 'none'} />
      <span>{isFavorited ? 'प्रिय सूची मे अछि' : 'प्रिय सूची मे जोड़ू'}</span>
    </button>
  );
}
