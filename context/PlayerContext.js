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

  const [lyricsBySlug, setLyricsBySlug] = useState({});
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const lyricsRequested = useRef(new Set()); // avoids duplicate fetches

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

  // Register Service Worker for PWA Offline Caching
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
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
            if (typeof player.getCurrentTime === 'function') {
              const cur = await player.getCurrentTime();
              if (typeof cur === 'number' && !isNaN(cur)) {
                setCurrentTime(cur);
              }
              const dur = typeof player.getDuration === 'function' ? await player.getDuration() : 0;
              if (typeof dur === 'number' && !isNaN(dur) && dur > 0) {
                setDuration(dur);
              }
            } else if (typeof player.currentTime === 'number') {
              const cur = player.currentTime || 0;
              setCurrentTime(cur);
              const dur = player.duration || 0;
              if (dur > 0) {
                setDuration(dur);
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
      const filtered = history.filter(item => item.id !== song.id);
      const historyItem = {
        id: song.id,
        slug: song.slug,
        title: song.title?.canonical || song.title?.devanagari || (typeof song.title === 'string' ? song.title : 'Maithili Geet'),
        singer: song.credits?.singer || song.singer || 'पारंपरिक',
        poster: song.poster?.image_url || song.poster || null,
        category: song.category || 'लोकगीत',
        youtube: song.youtube || {},
        audio: song.audio || {},
        played_at: new Date().toISOString()
      };
      const updated = [historyItem, ...filtered].slice(0, 80);
      localStorage.setItem('sur_mithila_history', JSON.stringify(updated));

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
    } catch (e) {
      // MediaSession error
    }
  }, [currentTrack, isPlaying]);

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
        registerLyrics
      }}
    >
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
