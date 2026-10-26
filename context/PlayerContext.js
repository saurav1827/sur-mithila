'use client';

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  const [currentTrack, setCurrentTrack] = useState(null); // { song, recording, type }
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isMiniDocked, setIsMiniDocked] = useState(false);
  const [activeScript, setActiveScript] = useState('devanagari'); // 'devanagari' | 'roman'

  // Spotify-Grade Playlist Queue & Controls
  const [playlistQueue, setPlaylistQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);

  // Non-blocking in-app player toast notification
  const [playerToast, setPlayerToast] = useState(null);
  const showPlayerToast = useCallback((message, type = 'error', duration = 4000) => {
    setPlayerToast({ message, type });
    setTimeout(() => {
      setPlayerToast((curr) => (curr?.message === message ? null : curr));
    }, duration);
  }, []);

  const [lyricsBySlug, setLyricsBySlug] = useState({});
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const lyricsRequested = useRef(new Set()); // avoids duplicate fetches
  const recordedPlaysRef = useRef(new Set()); // tracks songs played >= 10s in current session

  const registerLyrics = useCallback((slug, lyrics) => {
    if (!slug || !lyrics) return;
    setLyricsBySlug(prev => (prev[slug] ? prev : { ...prev, [slug]: lyrics }));
  }, []);

  const slug = currentTrack?.song?.slug;
  const inlineLyrics = currentTrack?.song?.lyrics;

  // Fetch only if neither the track nor the cache has lyrics
  useEffect(() => {
    if (!slug || inlineLyrics || lyricsBySlug[slug] || lyricsRequested.current.has(slug)) return;
    lyricsRequested.current.add(slug);
    setLyricsLoading(true);

    fetch(`/api/songs/${encodeURIComponent(slug)}/lyrics`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(data => registerLyrics(slug, data.lyrics ?? data))
      .catch(() => lyricsRequested.current.delete(slug)) // allow retry later
      .finally(() => setLyricsLoading(false));
  }, [slug, inlineLyrics, lyricsBySlug, registerLyrics]);

  const currentLyrics = inlineLyrics || (slug ? lyricsBySlug[slug] : null) || null;

  const activePlayerRef = useRef(null); // Active YouTube player instance or HTML5 audio element
  const playerTypeRef = useRef('youtube'); // 'youtube' | 'audio'

  // Register Service Worker for PWA Offline Caching (Production Only)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // In local development, unregister service worker and clear cache to prevent stale chunk hydration mismatches
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const reg of registrations) {
            reg.unregister();
          }
        });
        if ('caches' in window) {
          caches.keys().then((names) => {
            for (const name of names) {
              caches.delete(name);
            }
          });
        }
        return;
      }

      window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').then(
          function(registration) {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
          },
          function(err) {
            console.log('ServiceWorker registration failed: ', err);
          }
        );
      });
    }
  }, []);

  // Centralized real-time time tracking loop (polling every 250ms)
  useEffect(() => {
    let timer;
    if (isPlaying || currentTrack) {
      timer = setInterval(async () => {
        try {
          const player = activePlayerRef.current;
          if (player) {
            let cur = 0;
            if (typeof player.getCurrentTime === 'function') {
              const val = await player.getCurrentTime();
              if (typeof val === 'number' && !isNaN(val)) cur = val;
              const dur = typeof player.getDuration === 'function' ? await player.getDuration() : 0;
              if (typeof dur === 'number' && !isNaN(dur) && dur > 0) {
                setDuration(dur);
              }
            } else if (typeof player.currentTime === 'number') {
              cur = player.currentTime || 0;
              const dur = player.duration || 0;
              if (dur > 0) {
                setDuration(dur);
              }
            }

            setCurrentTime(cur);

            // REAL SITE PLAY TRACKING: Industry standard metric (>= 10s continuous playback)
            const activeSongSlug = currentTrack?.song?.slug;
            if (activeSongSlug && cur >= 10 && !recordedPlaysRef.current.has(activeSongSlug)) {
              recordedPlaysRef.current.add(activeSongSlug);
              const rawSinger = currentTrack?.song?.credits?.singer || '';
              const cleanArtistSlug = currentTrack?.song?.artistSlug || (
                rawSinger ? rawSinger.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') : null
              );
              const payload = JSON.stringify({ songSlug: activeSongSlug, artistSlug: cleanArtistSlug });
              if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
                navigator.sendBeacon('/api/track-play', payload);
              } else {
                fetch('/api/track-play', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: payload,
                  keepalive: true
                }).catch(() => {});
              }
            }
          }
        } catch (err) {
          // Player instance might be initializing
        }
      }, 250);
    }
    return () => clearInterval(timer);
  }, [isPlaying, currentTrack]);

  // Register an active media player (from SongHeroVideo, GlobalPlayer, etc.)
  const registerPlayer = useCallback((playerInstance, type = 'youtube') => {
    if (playerInstance) {
      activePlayerRef.current = playerInstance;
      playerTypeRef.current = type;
      // If already marked playing, trigger playback
      if (isPlaying) {
        try {
          if (type === 'youtube' && typeof playerInstance.playVideo === 'function') {
            playerInstance.playVideo();
          } else if (type === 'audio' && typeof playerInstance.play === 'function') {
            playerInstance.play().catch(() => {});
          }
        } catch (e) {}
      }
    }
  }, [isPlaying]);

  const unregisterPlayer = useCallback((playerInstance) => {
    if (activePlayerRef.current === playerInstance) {
      activePlayerRef.current = null;
    }
  }, []);

  // Play a specific song and performance recording
  const playTrack = (song, recording = null) => {
    if (!song) return;
    const selectedRec = recording || (song.recordings && song.recordings[0]) || {
      youtube: song.youtube,
      audio: song.audio,
      artist_name: song.credits?.singer,
      poster: song.poster
    };

    const isCover =
      (song.id && (String(song.id).startsWith('cover-') || String(song.id).startsWith('rec_'))) ||
      selectedRec.audio?.hosted_audio_url?.includes('sur_mithila_covers') ||
      song.audio?.hosted_audio_url?.includes('sur_mithila_covers');

    // If it is a cover recording, verify real-time playback access
    if (isCover) {
      const coverId = song.id || '';
      const audioUrl = selectedRec.audio?.hosted_audio_url || song.audio?.hosted_audio_url || '';
      fetch(`/api/recordings/access?id=${encodeURIComponent(coverId)}&url=${encodeURIComponent(audioUrl)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.allowed === false) {
            // Stop playback immediately and close player cleanly
            closePlayer();

            // Remove from history in localStorage
            try {
              const historyRaw = localStorage.getItem('sur_mithila_history') || '[]';
              const history = JSON.parse(historyRaw);
              const cleanRecId = String(song.id || '').replace(/^cover-/, '');
              const cleaned = history.filter((item) => {
                const itemId = String(item.id || '');
                return itemId !== song.id &&
                       itemId !== `cover-${song.id}` &&
                       itemId !== cleanRecId &&
                       itemId !== `cover-${cleanRecId}`;
              });
              localStorage.setItem('sur_mithila_history', JSON.stringify(cleaned));
            } catch {}

            // Dispatch real-time removal event for WatchHistoryTab and ProfilePage
            window.dispatchEvent(new CustomEvent('sur_mithila_history_updated', {
              detail: { id: song.id, removed: true }
            }));

            // Sync removal with backend
            fetch(`/api/history?songId=${encodeURIComponent(song.id)}`, { method: 'DELETE' }).catch(() => {});

            // Show sleek in-app toast notification instead of browser alert
            showPlayerToast(data.message || 'ई प्रस्तुति निजी अछि। केवल रचयिता आ व्यवस्थापक एकरा सुनि सकैत छथि।');
          }
        })
        .catch(() => {});
    }

    setCurrentTrack({
      song,
      recording: selectedRec,
      type: selectedRec.audio?.hosted_audio_url ? 'audio' : (selectedRec.youtube?.video_id ? 'youtube' : 'link_only')
    });
    setIsPlaying(true);
    setCurrentTime(0);

    // Save to recently played in localStorage & sync with server
    try {
      const historyRaw = localStorage.getItem('sur_mithila_history') || '[]';
      const history = JSON.parse(historyRaw);
      const isCoverTrack =
        Boolean(isCover) ||
        (song.id && (String(song.id).startsWith('cover-') || String(song.id).startsWith('rec_'))) ||
        selectedRec.audio?.hosted_audio_url?.includes('sur_mithila_covers') ||
        song.audio?.hosted_audio_url?.includes('sur_mithila_covers');

      let historyId = song.id;
      let historyTitle = song.title?.canonical || song.title?.devanagari || (typeof song.title === 'string' ? song.title : 'Maithili Geet');
      let historySinger = song.credits?.singer || song.singer || 'पारंपरिक';
      let historyAudio = selectedRec.audio?.hosted_audio_url ? selectedRec.audio : (song.audio || {});
      let historyPoster = selectedRec.poster?.image_url || selectedRec.poster || song.poster?.image_url || song.poster || null;

      if (isCoverTrack) {
        const rawRecId = selectedRec.recording_id || selectedRec.id || song.id;
        const cleanRecId = String(rawRecId).replace(/^cover-/, '');
        historyId = `cover-${cleanRecId}`;
        const baseTitle = typeof historyTitle === 'string' ? historyTitle.replace(/\s*\(Cover\)$/i, '') : 'Maithili Geet';
        historyTitle = `${baseTitle} (Cover)`;
        const baseSinger = selectedRec.artist_name || selectedRec.user_name || song.singer || 'कलाकार';
        const cleanSinger = typeof baseSinger === 'string' ? baseSinger.replace(/\s*\(Cover\)$/i, '') : 'कलाकार';
        historySinger = `${cleanSinger} (Cover)`;
      }

      const historyItem = {
        id: historyId,
        slug: song.slug,
        title: historyTitle,
        singer: historySinger,
        poster: historyPoster,
        category: song.category || (isCoverTrack ? 'कवर प्रस्तुति' : 'लोकगीत'),
        youtube: isCoverTrack ? (selectedRec.youtube || {}) : (song.youtube || {}),
        audio: historyAudio,
        played_at: new Date().toISOString()
      };
      const filtered = history.filter(item => item.id !== historyItem.id && item.id !== song.id);
      const updated = [historyItem, ...filtered].slice(0, 80);
      localStorage.setItem('sur_mithila_history', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('sur_mithila_history_updated', { detail: historyItem }));

      // Asynchronously sync with backend if user is authenticated
      fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song: historyItem })
      }).catch(() => {});
    } catch (e) {
      // LocalStorage not available or quota exceeded
    }
  };

  const seekTo = (seconds) => {
    const maxDur = duration || currentTrack?.song?.duration || currentTrack?.recording?.duration || seconds;
    const target = Math.max(0, Math.min(seconds, maxDur > 0 ? maxDur : seconds));
    setCurrentTime(target);
    if ((!duration || duration <= 0) && maxDur > 0) {
      setDuration(maxDur);
    }
    try {
      const player = activePlayerRef.current;
      if (player) {
        if (typeof player.seekTo === 'function') {
          player.seekTo(target, true);
        } else if (typeof player.currentTime === 'number') {
          player.currentTime = target;
        }
      }
    } catch (e) {}
  };

  // Play an entire playlist sequentially or shuffled
  const playPlaylist = useCallback((songs = [], startIndex = 0, shuffle = false) => {
    if (!Array.isArray(songs) || songs.length === 0) return;
    let queue = [...songs];
    let startSong = queue[startIndex] || queue[0];
    if (shuffle) {
      const rest = queue.filter((_, i) => i !== startIndex);
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      queue = [startSong, ...rest];
      startIndex = 0;
    }
    setPlaylistQueue(queue);
    setQueueIndex(startIndex);
    setIsShuffle(shuffle);
    playTrack(startSong);
  }, []);

  const playNext = useCallback(() => {
    if (!playlistQueue || playlistQueue.length === 0) return;
    let nextIdx = queueIndex + 1;
    if (nextIdx >= playlistQueue.length) {
      if (isRepeat) {
        nextIdx = 0;
      } else {
        return; // End of playlist queue
      }
    }
    setQueueIndex(nextIdx);
    playTrack(playlistQueue[nextIdx]);
  }, [playlistQueue, queueIndex, isRepeat]);

  const playPrevious = useCallback(() => {
    if (currentTime > 3) {
      seekTo(0);
      return;
    }
    if (!playlistQueue || playlistQueue.length === 0) return;
    let prevIdx = queueIndex - 1;
    if (prevIdx < 0) {
      prevIdx = isRepeat ? playlistQueue.length - 1 : 0;
    }
    setQueueIndex(prevIdx);
    playTrack(playlistQueue[prevIdx]);
  }, [currentTime, playlistQueue, queueIndex, isRepeat]);

  const addToQueue = useCallback((song) => {
    if (!song) return;
    setPlaylistQueue(prev => [...prev, song]);
  }, []);

  const toggleShuffle = useCallback(() => {
    setIsShuffle(prev => !prev);
  }, []);

  const toggleRepeat = useCallback(() => {
    setIsRepeat(prev => !prev);
  }, []);

  const togglePlay = () => {
    setIsPlaying(prev => {
      const next = !prev;
      try {
        const player = activePlayerRef.current;
        if (player) {
          if (next) {
            if (typeof player.playVideo === 'function') player.playVideo();
            else if (typeof player.play === 'function') player.play().catch(() => {});
          } else {
            if (typeof player.pauseVideo === 'function') player.pauseVideo();
            else if (typeof player.pause === 'function') player.pause();
          }
        }
      } catch (e) {}
      return next;
    });
  };

  const closePlayer = () => {
    setIsPlaying(false);
    setCurrentTrack(null);
    setCurrentTime(0);
    setDuration(0);
    try {
      const player = activePlayerRef.current;
      if (player) {
        if (typeof player.pauseVideo === 'function') player.pauseVideo();
        else if (typeof player.pause === 'function') player.pause();
      }
    } catch (e) {}
  };

  const toggleMute = () => {
    setIsMuted(prev => {
      const next = !prev;
      try {
        const player = activePlayerRef.current;
        if (player) {
          if (typeof player.mute === 'function') {
            if (next) player.mute();
            else player.unMute();
          } else if (typeof player.muted === 'boolean') {
            player.muted = next;
          }
        }
      } catch (e) {}
      return next;
    });
  };

  // Native MediaSession API integration (Spotify-style Lock Screen & Notification Controls)
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator) || !currentTrack) {
      return;
    }

    const { song, recording } = currentTrack;
    const title = song?.title?.canonical || song?.title?.devanagari || (typeof song?.title === 'string' ? song.title : 'Maithili Geet');
    const artist = recording?.artist_name || song?.credits?.singer || 'सुर-मिथिला पारंपरिक';
    const poster = recording?.poster?.image_url || song?.poster?.image_url || song?.poster || '/icons/icon-512.png';

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title,
        artist: artist,
        album: 'सुर-मिथिला (Sur-Mithila)',
        artwork: [
          { src: poster, sizes: '512x512', type: 'image/jpeg' },
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      });

      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

      navigator.mediaSession.setActionHandler('play', () => {
        setIsPlaying(true);
        try {
          const player = activePlayerRef.current;
          if (player) {
            if (typeof player.playVideo === 'function') player.playVideo();
            else if (typeof player.play === 'function') player.play().catch(() => {});
          }
        } catch (_) {}
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        setIsPlaying(false);
        try {
          const player = activePlayerRef.current;
          if (player) {
            if (typeof player.pauseVideo === 'function') player.pauseVideo();
            else if (typeof player.pause === 'function') player.pause();
          }
        } catch (_) {}
      });

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && details.seekTime !== null) {
          seekTo(details.seekTime);
        }
      });

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        playNext();
      });

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        playPrevious();
      });
    } catch (e) {
      // MediaSession error
    }
  }, [currentTrack, isPlaying, playNext, playPrevious]);

  // Update MediaSession position state when currentTime or duration updates
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator) || !currentTrack) {
      return;
    }
    try {
      if (
        duration > 0 &&
        typeof currentTime === 'number' &&
        !isNaN(currentTime) &&
        typeof navigator.mediaSession.setPositionState === 'function'
      ) {
        navigator.mediaSession.setPositionState({
          duration: Math.max(duration, 1),
          playbackRate: 1,
          position: Math.min(Math.max(0, currentTime), duration)
        });
      }
    } catch (_) {}
  }, [currentTime, duration, currentTrack]);

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        setIsPlaying,
        currentTime,
        setCurrentTime,
        progress: currentTime, // backward compatibility
        setProgress: setCurrentTime,
        duration,
        setDuration,
        volume,
        setVolume,
        isMuted,
        toggleMute,
        isMiniDocked,
        setIsMiniDocked,
        activeScript,
        setActiveScript,
        playTrack,
        seekTo,
        togglePlay,
        closePlayer,
        registerPlayer,
        unregisterPlayer,
        activePlayerRef,
        currentLyrics,
        lyricsLoading,
        registerLyrics,
        // Spotify-Grade Queue & Playlist
        playlistQueue,
        queueIndex,
        isShuffle,
        isRepeat,
        playPlaylist,
        playNext,
        playPrevious,
        addToQueue,
        toggleShuffle,
        toggleRepeat,
        playerToast,
        showPlayerToast
      }}
    >
      {playerToast && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            maxWidth: '92vw',
            width: 'max-content',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 20px',
            borderRadius: '14px',
            background: 'rgba(20, 20, 25, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.55), 0 0 16px rgba(239, 68, 68, 0.2)',
            color: '#FAFAFA',
            fontSize: '0.92rem',
            fontWeight: 500,
            animation: 'fadeSlideUp 0.25s ease-out',
          }}
          role="alert"
        >
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: '#EF4444'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <span style={{ lineHeight: 1.4 }}>{playerToast.message}</span>
          <button
            onClick={() => setPlayerToast(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9CA3AF',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              marginLeft: '6px'
            }}
            aria-label="Close"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}
