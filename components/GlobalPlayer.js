'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { usePlayer } from '../context/PlayerContext';
import {
  Play, Pause, X, Radio, Volume2, VolumeX,
  Maximize2, Minimize2, ChevronDown, BookOpen,
  Disc, Mic
} from 'lucide-react';
import YoutubeIcon from './YoutubeIcon';
import YouTube from 'react-youtube';
import { transliterateLyrics } from '../lib/slugs';

export default function GlobalPlayer() {
  const {
    currentTrack,
    isPlaying,
    setIsPlaying,
    togglePlay,
    closePlayer,
    currentTime,
    duration,
    seekTo,
    registerPlayer,
    unregisterPlayer,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    isMiniDocked,
    setIsMiniDocked,
    currentLyrics,
    lyricsLoading
  } = usePlayer();

  const [isFullscreenLyrics, setIsFullscreenLyrics] = useState(false);
  const [fullscreenTab, setFullscreenTab] = useState('devanagari'); // 'devanagari' | 'hindi' | 'roman'
  const [isHoveringScrub, setIsHoveringScrub] = useState(false);

  const audioRef = useRef(null);
  const miniDockRef = useRef(null);
  const miniDockPlayerRef = useRef(null);
  const fullscreenScrollRef = useRef(null);
  const pathname = usePathname();
  const router = useRouter();

  const { song, recording } = currentTrack || {};
  const isCurrentSongPage = currentTrack ? pathname === `/songs/${currentTrack.song?.slug}` : false;
  const youtubeId = recording?.youtube?.video_id || song?.youtube?.video_id;
  const audioUrl = recording?.audio?.hosted_audio_url || recording?.audio_url || song?.audio?.hosted_audio_url;

  // Extract lyrics lines unconditionally from the cached state
  const devanagariText = currentLyrics?.devanagari || currentLyrics?.raw_text || '';
  const hindiTranslation = currentLyrics?.hindi || currentLyrics?.translation_hindi || '';
  const romanText = currentLyrics?.roman || (devanagariText ? transliterateLyrics(devanagariText) : '');

  const fullLines = useMemo(() => {
    const raw = fullscreenTab === 'devanagari' ? devanagariText : (fullscreenTab === 'hindi' ? hindiTranslation : romanText);
    return raw ? raw.split('\n').filter(l => l.trim().length > 0) : [];
  }, [fullscreenTab, devanagariText, hindiTranslation, romanText]);

  const activeLineIdx = duration > 0 && fullLines.length > 0
    ? Math.min(Math.floor((currentTime / duration) * fullLines.length), fullLines.length - 1)
    : 0;

  // Register HTML5 audio if audioUrl is present and no YouTube
  useEffect(() => {
    if (audioUrl && !youtubeId && audioRef.current) {
      registerPlayer(audioRef.current, 'audio');
    }
  }, [audioUrl, youtubeId, registerPlayer]);

  // Clean up registration on unmount of mini-dock
  useEffect(() => {
    return () => {
      if (miniDockPlayerRef.current) {
        unregisterPlayer(miniDockPlayerRef.current);
      }
    };
  }, [unregisterPlayer]);

  // Volume and Mute handling
  useEffect(() => {
    const effectiveVol = isMuted ? 0 : (volume || 0.85);
    if (audioRef.current) {
      audioRef.current.volume = effectiveVol;
    }
  }, [volume, isMuted]);

  // Auto-scroll inside fullscreen lyrics mode
  useEffect(() => {
    if (isFullscreenLyrics && fullscreenScrollRef.current) {
      const activeEl = fullscreenScrollRef.current.querySelector('.fullscreen-lyric-line.active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLineIdx, isFullscreenLyrics]);

  // ALL HOOKS FINISHED
  if (!currentTrack) {
    return null;
  }

  const posterUrl = recording?.poster?.image_url || song?.poster?.image_url;
  const title = song?.title?.canonical || song?.title?.devanagari || 'Maithili Geet';
  const singer = recording?.artist_name || song?.credits?.singer || 'पारंपरिक';
  const category = song?.category || 'Folk Song';

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const handleSeek = (e) => {
    if (!duration || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, clickX / rect.width));
    const targetSeconds = percent * duration;
    seekTo(targetSeconds);
  };

  const onMiniDockReady = (event) => {
    miniDockPlayerRef.current = event.target;
    registerPlayer(event.target, 'youtube');
    if (isPlaying) {
      try { event.target.playVideo(); } catch (err) {}
    }
  };

  const onMiniDockStateChange = (event) => {
    if (event.data === 1 && !isPlaying && setIsPlaying) setIsPlaying(true);
    else if (event.data === 2 && isPlaying && setIsPlaying) setIsPlaying(false);
    else if (event.data === 0 && setIsPlaying) setIsPlaying(false);
  };

  const toggleMiniDockFullscreen = (e) => {
    if (e) e.stopPropagation();
    if (!miniDockRef.current) return;
    if (!document.fullscreenElement) {
      if (miniDockRef.current.requestFullscreen) {
        miniDockRef.current.requestFullscreen();
      } else if (miniDockRef.current.webkitRequestFullscreen) {
        miniDockRef.current.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  return (
    <>
      {/* HTML5 Audio Node */}
      {audioUrl && !youtubeId && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setIsPlaying && setIsPlaying(false)}
          onPlay={() => setIsPlaying && setIsPlaying(true)}
          onPause={() => setIsPlaying && setIsPlaying(false)}
          style={{ display: 'none' }}
        />
      )}

      {/* Floating Mini Video Dock for YouTube Playback when browsing OTHER pages (No lag, fixed bottom-right dock) */}
      {youtubeId && !isCurrentSongPage && (
        <div
          ref={miniDockRef}
          style={{
            position: 'fixed',
            bottom: '96px',
            right: '24px',
            width: '320px',
            height: '180px',
            borderRadius: '14px',
            overflow: 'hidden',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.85), 0 0 24px rgba(255, 140, 0, 0.3)',
            border: '2px solid rgba(255, 140, 0, 0.5)',
            zIndex: 99,
            background: '#000',
            transition: 'opacity 0.2s ease, transform 0.2s ease',
            display: !isMiniDocked ? 'block' : 'none',
            opacity: isPlaying ? 1 : 0.85,
            pointerEvents: 'auto'
          }}
        >
          {/* Quick Action Overlay Controls */}
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            zIndex: 10,
            display: 'flex',
            gap: '6px'
          }}>
            <button
              onClick={toggleMiniDockFullscreen}
              title="Full Screen Video"
              style={{
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(8px)',
                color: '#fff',
                padding: '6px',
                borderRadius: '6px',
                cursor: 'pointer',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Maximize2 size={13} />
            </button>
            <button
              onClick={() => router.push(`/songs/${song?.slug}`)}
              title="Go to Song Page"
              style={{
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(8px)',
                color: '#FDE047',
                padding: '6px',
                borderRadius: '6px',
                cursor: 'pointer',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <BookOpen size={13} />
            </button>
            <button
              onClick={() => setIsMiniDocked(true)}
              title="Minimize to Audio Bar"
              style={{
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(8px)',
                color: '#fff',
                padding: '6px',
                borderRadius: '6px',
                cursor: 'pointer',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Minimize2 size={13} />
            </button>
          </div>

          <YouTube
            videoId={youtubeId}
            opts={{
              width: '100%',
              height: '100%',
              playerVars: {
                autoplay: 1,
                controls: 1,
                fs: 1,
                modestbranding: 1
              }
            }}
            onReady={onMiniDockReady}
            onStateChange={onMiniDockStateChange}
            style={{ width: '100%', height: '100%' }}
            iframeClassName="youtube-iframe"
          />
        </div>
      )}

      {/* FULLSCREEN SPOTIFY-STYLE EXPANDED LYRICS & ALBUM ART MODE */}
      {isFullscreenLyrics && (
        <div className="fullscreen-player-modal">
          {/* Top Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            maxWidth: '1200px',
            width: '100%',
            margin: '0 auto',
            paddingBottom: '16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <button
              onClick={() => setIsFullscreenLyrics(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--text-secondary)',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <ChevronDown size={22} color="var(--neon-saffron)" />
              <span>Minimize (छोट करू)</span>
            </button>

            <div className="lyrics-tabs-pill">
              <button
                onClick={() => setFullscreenTab('devanagari')}
                className={`lyrics-tab-btn ${fullscreenTab === 'devanagari' ? 'active' : ''}`}
              >
                मैथिली
              </button>
              <button
                onClick={() => setFullscreenTab('hindi')}
                className={`lyrics-tab-btn ${fullscreenTab === 'hindi' ? 'active' : ''}`}
              >
                हिंदी अनुवाद
              </button>
              <button
                onClick={() => setFullscreenTab('roman')}
                className={`lyrics-tab-btn ${fullscreenTab === 'roman' ? 'active' : ''}`}
              >
                English
              </button>
            </div>

            <Link
              href={`/studio/${song?.slug}`}
              onClick={() => setIsFullscreenLyrics(false)}
              className="pill-btn-studio"
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              <Mic size={15} color="var(--neon-saffron)" />
              <span>Sing Karaoke</span>
            </Link>
          </div>

          {/* Split View */}
          <div style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'minmax(280px, 420px) 1fr',
            gap: '40px',
            maxWidth: '1200px',
            width: '100%',
            margin: '0 auto',
            padding: '24px 0',
            alignItems: 'center',
            overflow: 'hidden'
          }}>
            {/* Left Column: Album Art */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '1/1',
                borderRadius: '24px',
                overflow: 'hidden',
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.9), 0 0 40px rgba(255, 140, 0, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                margin: '0 auto 24px'
              }}>
                {posterUrl ? (
                  <img src={posterUrl} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'radial-gradient(circle, rgba(255, 140, 0, 0.2) 0%, #080A10 100%)'
                  }}>
                    <Disc size={80} color="var(--neon-saffron)" />
                  </div>
                )}
              </div>

              <h2 className="font-traditional" style={{ fontSize: '1.8rem', color: '#F8FAFC', marginBottom: '6px' }}>
                {title}
              </h2>
              <p style={{ fontSize: '1rem', color: 'var(--neon-saffron)', fontWeight: 600 }}>
                {singer} • {category}
              </p>
            </div>

            {/* Right Column: Lyrics Scroller */}
            <div ref={fullscreenScrollRef} className="fullscreen-lyrics-scroll">
              {fullLines.length > 0 ? (
                fullLines.map((line, idx) => {
                  const isActive = idx === activeLineIdx;
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (duration > 0 && fullLines.length > 0) {
                          const targetSeconds = (idx / fullLines.length) * duration;
                          seekTo(targetSeconds);
                        }
                      }}
                      className={`fullscreen-lyric-line ${isActive ? 'active' : ''}`}
                      style={{ cursor: 'pointer' }}
                    >
                      {line}
                    </div>
                  );
                })
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  {lyricsLoading ? (
                    <p className="fullscreen-lyric-line" style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '1.8rem' }}>
                      <span style={{ fontSize: '1.4rem' }}>Loading lyrics...</span>
                    </p>
                  ) : (
                    <p className="fullscreen-lyric-line" style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '1.8rem' }}>
                      बोल उपलब्ध नहि अछि<br/><span style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.3)' }}>(Lyrics not available yet)</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PERSISTENT BOTTOM PLAYER BAR */}
      <aside
        aria-label="Global Music Player"
        className="global-player-bar"
      >
        <style>{`
          .global-player-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 84px;
            background: rgba(8, 10, 16, 0.96);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border-top: 1px solid rgba(255, 140, 0, 0.3);
            box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.85);
            z-index: 90;
            display: flex;
            align-items: center;
            padding: 0 24px;
          }
          .player-inner {
            max-width: 1380px;
            width: 100%;
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            min-width: 0;
          }
          .player-left {
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 0;
            flex: 1 1 240px;
          }
          .player-center {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            flex: 1 1 400px;
            max-width: 580px;
          }
          .player-right {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-shrink: 0;
          }
          .mobile-top-progress {
            display: none;
          }
          .mobile-play-only {
            display: none;
          }

          @media (max-width: 768px) {
            .global-player-bar {
              height: 64px !important;
              padding: 0 12px !important;
            }
            .player-inner {
              gap: 8px !important;
            }
            .player-left {
              flex: 1 1 auto !important;
              max-width: calc(100% - 110px) !important;
            }
            .player-left img, .player-left > div:first-child {
              width: 42px !important;
              height: 42px !important;
            }
            .player-center {
              display: none !important;
            }
            .desktop-only-action {
              display: none !important;
            }
            .mobile-top-progress {
              display: block !important;
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 3px;
              background: rgba(255, 255, 255, 0.12);
              cursor: pointer;
            }
            .mobile-play-only {
              display: flex !important;
              align-items: center;
              justify-content: center;
              width: 38px;
              height: 38px;
              border-radius: 50%;
              background: linear-gradient(135deg, #FF8C00, #FF2E63);
              border: none;
              color: #FFF;
              cursor: pointer;
              flex-shrink: 0;
            }
          }
        `}</style>

        {/* Real-time Top Progress Bar for Mobile */}
        <div
          className="mobile-top-progress"
          onClick={handleSeek}
          title="Seek playback"
        >
          <div style={{
            width: `${progressPercent}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #FF8C00, #FF2E63)',
            transition: 'width 0.2s linear'
          }} />
        </div>

        <div className="player-inner">
          {/* Left: Track Meta & Poster */}
          <div className="player-left">
            <div
              onClick={() => setIsFullscreenLyrics(true)}
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '10px',
                overflow: 'hidden',
                flexShrink: 0,
                background: 'linear-gradient(135deg, #1E293B, #0F172A)',
                border: '1px solid rgba(255, 140, 0, 0.25)',
                position: 'relative',
                cursor: 'pointer'
              }}
              title="Click to expand Lyrics Theater"
            >
              {posterUrl ? (
                <img
                  src={posterUrl}
                  alt={title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Radio size={22} color="var(--neon-saffron)" />
                </div>
              )}
            </div>

            <div style={{ overflow: 'hidden', minWidth: 0, flex: 1 }}>
              <Link
                href={`/songs/${song?.slug}`}
                style={{
                  display: 'block',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  color: '#F8FAFC',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textDecoration: 'none'
                }}
              >
                {title}
              </Link>
              <p style={{
                fontSize: '0.76rem',
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                margin: 0
              }}>
                {singer} • {category}
              </p>
            </div>
          </div>

          {/* Center: Controls & Real-Time Interactive Scrub Bar (Desktop) */}
          <div className="player-center">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button
                onClick={togglePlay}
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #FF8C00, #FF2E63)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(255, 140, 0, 0.4)',
                  cursor: 'pointer',
                  border: 'none',
                  transition: 'transform 0.15s ease'
                }}
              >
                {isPlaying ? <Pause size={20} fill="#FFFFFF" /> : <Play size={20} fill="#FFFFFF" style={{ marginLeft: '2px' }} />}
              </button>

              {/* Expand to Fullscreen Lyrics Button */}
              <button
                onClick={() => setIsFullscreenLyrics(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#FDE047',
                  background: 'rgba(255, 140, 0, 0.12)',
                  padding: '5px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 140, 0, 0.3)',
                  cursor: 'pointer'
                }}
              >
                <BookOpen size={13} />
                <span>बोल थियेटर (Lyrics)</span>
              </button>

              {/* Dynamic Visualizer Bars */}
              {isPlaying && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '18px' }}>
                  <div className="visualizer-bar" />
                  <div className="visualizer-bar" />
                  <div className="visualizer-bar" />
                  <div className="visualizer-bar" />
                </div>
              )}
            </div>

            {/* Scrub / Progress Bar */}
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                fontSize: '0.74rem',
                color: '#F8FAFC',
                fontWeight: 600,
                minWidth: '36px',
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums'
              }}>
                {formatTime(currentTime)}
              </span>

              <div
                onClick={handleSeek}
                onMouseEnter={() => setIsHoveringScrub(true)}
                onMouseLeave={() => setIsHoveringScrub(false)}
                style={{
                  flex: 1,
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  position: 'relative'
                }}
                title="Click or drag to seek in video"
              >
                <div style={{
                  width: '100%',
                  height: isHoveringScrub ? '6px' : '4px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: '3px',
                  overflow: 'hidden',
                  position: 'relative',
                  transition: 'height 0.15s ease'
                }}>
                  <div style={{
                    width: `${progressPercent}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #FF8C00, #FF2E63)',
                    borderRadius: '3px'
                  }} />
                </div>

                <div style={{
                  position: 'absolute',
                  left: `calc(${progressPercent}% - ${isHoveringScrub ? '7px' : '5px'})`,
                  width: isHoveringScrub ? '14px' : '10px',
                  height: isHoveringScrub ? '14px' : '10px',
                  borderRadius: '50%',
                  background: '#FFFFFF',
                  boxShadow: '0 0 10px rgba(255, 140, 0, 0.9)',
                  pointerEvents: 'none',
                  transition: 'width 0.15s ease, height 0.15s ease'
                }} />
              </div>

              <span style={{
                fontSize: '0.74rem',
                color: 'var(--text-muted)',
                minWidth: '36px',
                fontVariantNumeric: 'tabular-nums'
              }}>
                {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="player-right">
            {/* Mobile Play/Pause circular button */}
            <button
              onClick={togglePlay}
              className="mobile-play-only"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={18} fill="#FFFFFF" /> : <Play size={18} fill="#FFFFFF" style={{ marginLeft: '2px' }} />}
            </button>

            {/* Quick Lyrics on Mobile */}
            <button
              onClick={() => setIsFullscreenLyrics(true)}
              style={{
                background: 'rgba(255, 140, 0, 0.12)',
                color: '#FDE047',
                border: '1px solid rgba(255, 140, 0, 0.3)',
                padding: '6px 8px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Lyrics Theater"
            >
              <BookOpen size={16} />
            </button>

            <Link
              href={`/studio/${song?.slug}`}
              className="sing-this-btn desktop-only-action"
              style={{ display: 'inline-flex' }}
            >
              <Mic size={14} />
              <span>गाउ (Studio)</span>
            </Link>

            {youtubeId && (
              <a
                href={`https://www.youtube.com/watch?v=${youtubeId}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Watch on YouTube"
                className="desktop-only-action"
                style={{
                  color: '#FF2E63',
                  background: 'rgba(255, 46, 99, 0.12)',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.75rem',
                  border: '1px solid rgba(255, 46, 99, 0.25)',
                  textDecoration: 'none'
                }}
              >
                <YoutubeIcon size={14} />
                <span>YouTube</span>
              </a>
            )}

            <button
              onClick={closePlayer}
              style={{
                color: 'var(--text-muted)',
                padding: '6px',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
              title="Close Player"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
