'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ListPlus, Check, Plus, Music2, FolderPlus, X, Lock, Globe } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AddToPlaylistModal({ song, isOpen, onClose }) {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on Escape & Lock body scroll
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  // Load playlists on open
  useEffect(() => {
    if (!isOpen) return;
    loadPlaylists();
  }, [isOpen, user]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const loadPlaylists = async () => {
    setLoading(true);
    try {
      let apiPlaylists = [];
      try {
        const res = await fetch('/api/playlists');
        if (res.ok) {
          const data = await res.json();
          apiPlaylists = user ? (data.user || []) : [];
        }
      } catch {}

      const raw = localStorage.getItem('sur_mithila_guest_playlists') || '[]';
      const guestList = JSON.parse(raw);
      const combined = [...apiPlaylists];

      if (Array.isArray(guestList)) {
        for (const g of guestList) {
          if (!combined.some(p => p.id === g.id || (p._id && p._id === g._id))) {
            combined.push(g);
          }
        }
      }

      setPlaylists(combined);
    } catch (e) {
      console.warn('Failed to load playlists:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSong = async (playlist) => {
    if (!song) return;
    const songId = song.id || song.slug;
    const isPresent = playlist.track_ids?.includes(songId);
    const nextAction = isPresent ? 'remove' : 'add';

    const updatedTrackIds = isPresent
      ? playlist.track_ids.filter(id => id !== songId)
      : [...(playlist.track_ids || []), songId];

    // Optimistic UI update
    setPlaylists(prev =>
      prev.map(p => ((p.id === playlist.id || (p._id && p._id === playlist._id))
        ? { ...p, track_ids: updatedTrackIds }
        : p))
    );

    if (nextAction === 'add') {
      showToast(`"${playlist.title}" में जोड़ल गेल!`);
    } else {
      showToast(`"${playlist.title}" सं हटाओल गेल`);
    }

    // 1. Update in localStorage cache
    try {
      const raw = localStorage.getItem('sur_mithila_guest_playlists') || '[]';
      let list = JSON.parse(raw);
      let found = false;
      list = list.map(p => {
        if (p.id === playlist.id || (p._id && p._id === playlist._id)) {
          found = true;
          return { ...p, track_ids: updatedTrackIds };
        }
        return p;
      });
      if (!found) {
        list.push({ ...playlist, track_ids: updatedTrackIds });
      }
      localStorage.setItem('sur_mithila_guest_playlists', JSON.stringify(list));
    } catch {}

    // 2. Persist to API if playlist has _id or id
    const targetId = playlist._id || playlist.id;
    if (targetId) {
      try {
        await fetch(`/api/playlists/${encodeURIComponent(targetId)}/tracks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ songId, action: nextAction })
        });
      } catch (e) {
        console.warn('API track sync note:', e);
      }
    }
  };

  const handleCreatePlaylist = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !song) return;

    const songId = song.id || song.slug;
    const title = newTitle.trim();
    setCreating(true);

    try {
      let created = null;
      try {
        const res = await fetch('/api/playlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description: '',
            trackIds: [songId]
          })
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
          is_public: isPublic,
          track_ids: [songId],
          created_at: now,
          updated_at: now
        };
      }

      // Save to localStorage
      try {
        const raw = localStorage.getItem('sur_mithila_guest_playlists') || '[]';
        const list = JSON.parse(raw);
        const updated = [created, ...list.filter(p => p.id !== created.id && (!p._id || p._id !== created._id))];
        localStorage.setItem('sur_mithila_guest_playlists', JSON.stringify(updated));
      } catch {}

      setPlaylists(prev => [created, ...prev]);
      setNewTitle('');
      showToast(`नव प्लेलिस्ट "${title}" बनल आ गीत जोड़ल गेल!`);
    } catch (e) {
      console.error('Failed to create playlist:', e);
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const songTitle = typeof song?.title === 'string'
    ? song.title
    : (song?.title?.canonical || song?.title?.devanagari || 'मैथिली गीत');

  const modalContent = (
    <div className="playlist-modal-backdrop" onClick={onClose}>
      <div className="playlist-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="playlist-modal-header">
          <div className="modal-title-box">
            <ListPlus size={20} color="#EAB308" />
            <h3 className="modal-heading font-traditional">प्लेलिस्ट में जोड़ू (Add to Playlist)</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Selected Song Preview Pill */}
        <div className="playlist-song-preview-pill">
          <Music2 size={15} color="var(--accent-gold)" />
          <span className="preview-song-title">{songTitle}</span>
        </div>

        {/* Toast Alert */}
        {toastMsg && (
          <div className="playlist-modal-toast">
            <Check size={14} color="#10B981" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Playlists List */}
        <div className="playlist-items-list">
          {loading ? (
            <div className="playlist-modal-loading">प्लेलिस्ट लोड भऽ रहल अछि...</div>
          ) : playlists.length > 0 ? (
            playlists.map((pl) => {
              const songId = song?.id || song?.slug;
              const isChecked = pl.track_ids?.includes(songId);

              return (
                <div
                  key={pl.id || pl._id}
                  className={`playlist-check-row ${isChecked ? 'is-selected' : ''}`}
                  onClick={() => handleToggleSong(pl)}
                >
                  <div className="playlist-row-checkbox">
                    {isChecked ? (
                      <div className="check-box-checked">
                        <Check size={13} color="#070913" strokeWidth={3} />
                      </div>
                    ) : (
                      <div className="check-box-empty" />
                    )}
                  </div>

                  <div className="playlist-row-info">
                    <span className="playlist-row-title font-traditional">{pl.title}</span>
                    <span className="playlist-row-count">{pl.track_ids?.length || 0} गीत</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="playlist-empty-notice">
              अखनि कोनो प्लेलिस्ट नै बनल अछि। नीचाँ सं नव प्लेलिस्ट बनाउ!
            </div>
          )}
        </div>

        {/* Create New Playlist Form */}
        <form onSubmit={handleCreatePlaylist} className="playlist-create-inline-form">
          <div className="create-input-wrapper">
            <FolderPlus size={16} color="var(--accent-gold)" />
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="नव प्लेलिस्टक नाम (e.g. हमर प्रिय सोहर)..."
              className="playlist-inline-input"
              maxLength={60}
            />
          </div>

          <button
            type="submit"
            disabled={!newTitle.trim() || creating}
            className="playlist-create-submit-btn"
          >
            <Plus size={15} />
            <span>{creating ? 'बनि रहल...' : 'बनाउ आ जोड़ू'}</span>
          </button>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}

