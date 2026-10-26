'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { usePlayer } from '../context/PlayerContext';
import {
  Play, Pause, X, Radio, Volume2, VolumeX,
  Maximize2, Minimize2, ChevronDown, BookOpen,
  Disc, Mic, RotateCcw, Sparkles
} from 'lucide-react';
import YoutubeIcon from './YoutubeIcon';
import YouTube from 'react-youtube';
import { transliterateLyrics } from '../lib/slugs';
import { useLanguage } from '../context/LanguageContext';

export default function GlobalPlayer() {
  const { t, formatSongTitle, isEnglish, isMaithiliPlus } = useLanguage();
  const {
    currentTrack,
    isPlaying,
    setIsPlaying,
    togglePlay,
    closePlayer,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
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
  const [autoScroll, setAutoScroll] = useState(false); // Default to MANUAL scroll
  const [mobileViewMode, setMobileViewMode] = useState('split'); // 'split' | 'art' | 'lyrics'
  const [isHoveringScrub, setIsHoveringScrub] = useState(false);
  const [scrubPercent, setScrubPercent] = useState(null);
  const isPointerDownRef = useRef(false);

  const audioRef = useRef(null);
  const miniDockRef = useRef(null);
  const miniDockPlayerRef = useRef(null);
  const fullscreenScrollRef = useRef(null);
  const pathname = usePathname();
  const router = useRouter();

  // Auto-close fullscreen modal when navigating to a new route
  useEffect(() => {
    setIsFullscreenLyrics(false);
  }, [pathname]);

  const { song, recording } = currentTrack || {};
  const isCurrentSongPage = currentTrack ? pathname === `/songs/${currentTrack.song?.slug}` : false;

  const isCoverTrack =
    currentTrack?.type === 'audio' ||
    Boolean(recording?.recording_id) ||
    Boolean(recording?.audio_url) ||
    Boolean(recording?.audio?.hosted_audio_url) ||
    Boolean(song?.id && (String(song.id).startsWith('cover-') || String(song.id).startsWith('rec_'))) ||
    Boolean(typeof song?.title?.canonical === 'string' && song.title.canonical.includes('(Cover)')) ||
    Boolean(typeof song?.title === 'string' && song.title.includes('(Cover)'));

  // If this is an audio cover track, NEVER inherit original song's YouTube video
  const youtubeId = isCoverTrack
    ? (recording?.youtube?.video_id || null)
    : (recording?.youtube?.video_id || song?.youtube?.video_id || null);
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

  // Register HTML5 audio if audioUrl is present
  useEffect(() => {
    if (audioUrl && audioRef.current) {
      registerPlayer(audioRef.current, 'audio');
      if (isPlaying) {
        audioRef.current.play().catch(() => {});
      }
    }
  }, [audioUrl, registerPlayer, isPlaying]);

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

  // Auto-scroll inside fullscreen lyrics mode (only when autoScroll is enabled by user)
  useEffect(() => {
    if (autoScroll && isFullscreenLyrics && fullscreenScrollRef.current) {
      const activeEl = fullscreenScrollRef.current.querySelector('.fullscreen-lyric-line.active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLineIdx, isFullscreenLyrics, autoScroll]);

  // ALL HOOKS FINISHED
  if (!currentTrack) {
    return null;
  }

  const ytId = recording?.youtube?.video_id || song?.youtube?.video_id;
  const posterUrl = recording?.poster?.image_url || song?.poster?.image_url || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null);
  const title = formatSongTitle(song) || (typeof song?.title === 'string' ? song.title : null) || recording?.title || (isEnglish ? 'Maithili Song' : 'मैथिली गीत');
  const singer = recording?.artist_name || song?.credits?.singer || (isEnglish ? 'Traditional' : 'पारंपरिक');
  const category = song?.category || (isEnglish ? 'Folk Song' : 'मैथिली लोकगीत');

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const effectiveDuration = duration > 0 ? duration : (song?.duration || recording?.duration || 0);
  const progressPercent = scrubPercent !== null
    ? scrubPercent
    : (effectiveDuration > 0 ? Math.min(100, (currentTime / effectiveDuration) * 100) : 0);

  const calculateSeek = (e, currentTarget) => {
    if (!effectiveDuration || effectiveDuration <= 0) return null;
    const rect = currentTarget.getBoundingClientRect();
    if (!rect || rect.width <= 0) return null;

    const clientX = e.clientX !== undefined && e.clientX !== null
      ? e.clientX
      : (e.touches?.[0]?.clientX ?? e.changedTouches?.[0]?.clientX);

    if (typeof clientX !== 'number' || isNaN(clientX)) return null;

    const clickX = clientX - rect.left;
    const percent = Math.max(0, Math.min(1, clickX / rect.width));
    const targetSeconds = percent * effectiveDuration;
    return { percent: percent * 100, seconds: targetSeconds };
  };

  const handlePointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.cancelable) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();

    const result = calculateSeek(e, e.currentTarget);
    if (!result) return;

    isPointerDownRef.current = true;
    setScrubPercent(result.percent);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
    seekTo(result.seconds);
  };

  const handlePointerMove = (e) => {
    if (!isPointerDownRef.current) return;
    if (e.cancelable) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();

    const result = calculateSeek(e, e.currentTarget);
    if (!result) return;

    setScrubPercent(result.percent);
    seekTo(result.seconds);
  };

  const handlePointerUp = (e) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    if (e.cancelable) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();

    const result = calculateSeek(e, e.currentTarget);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}

    if (result) {
      seekTo(result.seconds);
    }
    setTimeout(() => {
      setScrubPercent(null);
    }, 120);
  };

  const handlePointerCancel = (e) => {
    isPointerDownRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
    setScrubPercent(null);
  };

  const handleSeek = (e) => {
    if (e.stopPropagation) e.stopPropagation();
    const result = calculateSeek(e, e.currentTarget);
    if (result) {
      seekTo(result.seconds);
    }
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
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          autoPlay={isPlaying}
          onTimeUpdate={(e) => {
            if (e.currentTarget.duration && Number.isFinite(e.currentTarget.duration)) {
              setDuration(e.currentTarget.duration);
            }
            setCurrentTime(e.currentTarget.currentTime);
          }}
          onLoadedMetadata={(e) => {
            const a = e.currentTarget;
            if (Number.isFinite(a.duration) && a.duration > 0) {
              setDuration(a.duration);
            } else if (a.duration === Infinity) {
              // WebM duration resolution trick for Chromium
              const fix = () => {
                a.removeEventListener('timeupdate', fix);
                a.currentTime = 0;
                if (Number.isFinite(a.duration) && a.duration > 0) {
                  setDuration(a.duration);
                }
              };
              a.addEventListener('timeupdate', fix);
              a.currentTime = 1e10;
            } else if (recording?.duration || song?.duration) {
              setDuration(recording?.duration || song?.duration);
            }
          }}
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
          className="mini-video-dock"
          style={{
            opacity: isMiniDocked ? 0 : (isPlaying ? 1 : 0.85),
            pointerEvents: isMiniDocked ? 'none' : 'auto',
            transform: isMiniDocked ? 'scale(0.001) translateY(600px)' : 'scale(1) translateY(0)',
          }}
        >
          {/* Quick Action Overlay Controls */}
          <div className="mini-dock-controls">
            <button
              onClick={toggleMiniDockFullscreen}
              title="Full Screen Video"
              className="mini-dock-btn"
            >
              <Maximize2 size={13} />
            </button>
            <button
              onClick={() => router.push(`/songs/${song?.slug}`)}
              title="Go to Song Page"
              className="mini-dock-btn is-gold"
            >
              <BookOpen size={13} />
            </button>
            <button
              onClick={() => setIsMiniDocked(true)}
              title="Minimize to Audio Bar"
              className="mini-dock-btn"
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
          {/* Subtle Ambient Depth & Dark Overlay */}
          {posterUrl && (
            <>
              <div
                className="fullscreen-ambient-backdrop"
                style={{ backgroundImage: `url(${posterUrl})` }}
              />
              <div className="fullscreen-ambient-overlay" />
            </>
          )}

          <div className="fullscreen-player-container">
            {/* Top Navigation Bar */}
            <div className="fs-top-bar">
              <button
                type="button"
                onClick={() => setIsFullscreenLyrics(false)}
                className="fs-minimize-btn"
                title={t('छोट करू (Minimize)', 'Minimize player', 'छोट करू')}
                aria-label="Minimize player"
              >
                <ChevronDown size={20} color="#FDE047" />
                <span className="fs-minimize-label font-traditional">{t('छोट करू (Minimize)', 'Minimize', 'छोट करू')}</span>
              </button>

              <div className="fs-tabs-pill">
                <button
                  type="button"
                  onClick={() => setFullscreenTab('devanagari')}
                  className={`fs-tab-btn ${fullscreenTab === 'devanagari' ? 'active' : ''}`}
                >
                  {t('मैथिली', 'Maithili', 'मैथिली')}
                </button>
                <button
                  type="button"
                  onClick={() => setFullscreenTab('hindi')}
                  className={`fs-tab-btn ${fullscreenTab === 'hindi' ? 'active' : ''}`}
                >
                  {t('हिंदी', 'Hindi', 'हिंदी')}
                </button>
                <button
                  type="button"
                  onClick={() => setFullscreenTab('roman')}
                  className={`fs-tab-btn ${fullscreenTab === 'roman' ? 'active' : ''}`}
                >
                  {t('English', 'English', 'रोमन')}
                </button>
              </div>

              {/* Auto Scroll Toggle Button */}
              <button
                type="button"
                onClick={() => setAutoScroll(prev => !prev)}
                className={`fs-autoscroll-toggle-btn ${autoScroll ? 'active' : ''}`}
                title={autoScroll ? t('Auto-scroll चालू अछि (Click to switch to Manual)', 'Auto-scroll is ON (Click to switch to Manual)', 'स्वतः स्क्रॉल चालू अछि') : t('Auto-scroll बंद अछि (Click to switch to Auto)', 'Auto-scroll is OFF (Click to switch to Auto)', 'स्वतः स्क्रॉल बंद अछि')}
              >
                <Sparkles size={13} color={autoScroll ? '#070913' : '#FDE047'} />
                <span>{autoScroll ? t('स्वतः स्क्रॉल ON', 'Auto-Scroll ON', 'स्वतः स्क्रॉल') : t('Manual Scroll', 'Manual Scroll', 'हस्तचालित')}</span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Link
                  href={`/studio/${song?.slug}`}
                  onClick={() => setIsFullscreenLyrics(false)}
                  className="fs-studio-btn"
                  title={t('स्टूडियो में गाउ (Sing Karaoke)', 'Open Studio to Sing Karaoke', 'स्टूडियो में गाउ')}
                >
                  <Mic size={14} color="var(--neon-saffron)" />
                  <span className="fs-studio-label">{t('Studio', 'Studio', 'स्टूडियो')}</span>
                </Link>

                <button
                  type="button"
                  onClick={() => setIsFullscreenLyrics(false)}
                  className="fs-close-btn"
                  title="Close player"
                  aria-label="Close player"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Mobile View Switcher (Cover Art vs Lyrics) */}
            <div className="fs-mobile-mode-switch">
              <button
                type="button"
                className={`fs-mobile-mode-btn ${mobileViewMode !== 'lyrics' ? 'active' : ''}`}
                onClick={() => setMobileViewMode('art')}
              >
                {t('कला (Art)', 'Cover Art', 'कला')}
              </button>
              <button
                type="button"
                className={`fs-mobile-mode-btn ${mobileViewMode === 'lyrics' ? 'active' : ''}`}
                onClick={() => setMobileViewMode('lyrics')}
              >
                {t('बोल (Lyrics)', 'Lyrics', 'बोल')}
              </button>
            </div>

            {/* Main Content Area */}
            <div className="fs-content-split">
              {/* Left Column: Album Art & Title */}
              <div
                className="fs-art-column"
                style={{
                  display: mobileViewMode === 'lyrics' ? 'none' : 'flex'
                }}
              >
                <div className="fs-disc-wrapper">
                  {posterUrl ? (
                    <img src={posterUrl} alt={title} className="fs-disc-img" />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'radial-gradient(circle, rgba(255, 140, 0, 0.2) 0%, #080A10 100%)'
                    }}>
                      <Disc size={80} color="var(--neon-saffron)" />
                    </div>
                  )}
                </div>

                <h2 className="fs-song-title font-traditional" style={{ fontSize: '1.75rem', color: '#F8FAFC', margin: '0 0 6px 0', lineHeight: 1.25 }}>
                  {title}
                </h2>
                <p className="fs-song-sub" style={{ fontSize: '0.95rem', color: 'var(--neon-saffron)', fontWeight: 600, margin: 0 }}>
                  {singer} • {category}
                </p>
              </div>

              {/* Right Column: Lyrics Scroller */}
              <div
                ref={fullscreenScrollRef}
                className="fullscreen-lyrics-scroll"
                style={{
                  display: mobileViewMode === 'art' ? 'none' : 'flex'
                }}
              >
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
                      >
                        {line}
                      </div>
                    );
                  })
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '120px' }}>
                    {lyricsLoading ? (
                      <p className="fullscreen-lyric-line" style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '1.4rem' }}>
                        Loading lyrics...
                      </p>
                    ) : (
                      <p className="fullscreen-lyric-line" style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '1.4rem' }}>
                        बोल उपलब्ध नहि अछि<br /><span style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.3)' }}>(Lyrics not available yet)</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Integrated Bottom Fullscreen Controls */}
            <div className="fs-bottom-controls">
              {/* Progress Slider */}
              <div className="fs-progress-row">
                <span className="fs-time-label">{formatTime(currentTime)}</span>
                <div
                  className="fs-scrub-bar"
                  onClick={handleSeek}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerCancel}
                  style={{ touchAction: 'none' }}
                  title="Seek track"
                >
                  <div className="fs-scrub-fill" style={{ width: `${progressPercent}%`, transition: scrubPercent !== null ? 'none' : 'width 0.2s linear' }}>
                    <div className="fs-scrub-thumb" />
                  </div>
                </div>
                <span className="fs-time-label">{formatTime(duration)}</span>
              </div>

              {/* Playback Buttons */}
              <div className="fs-buttons-row">
                <button
                  type="button"
                  className="fs-icon-btn"
                  onClick={() => seekTo(0)}
                  title="Restart song"
                >
                  <RotateCcw size={18} />
                </button>

                <button
                  type="button"
                  className="fs-play-btn"
                  onClick={togglePlay}
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause size={24} fill="#FFF" /> : <Play size={24} fill="#FFF" style={{ marginLeft: '3px' }} />}
                </button>

                <button
                  type="button"
                  className="fs-icon-btn"
                  onClick={toggleMute}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
              </div>
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
              bottom: 56px !important;
              height: 60px !important;
              padding: 0 12px !important;
              z-index: 90 !important;
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
              height: 32px;
              transform: translateY(-14px);
              background: transparent;
              cursor: pointer;
              z-index: 60;
              touch-action: none;
              -webkit-tap-highlight-color: transparent;
              padding: 0;
              margin: 0;
            }
            .mobile-top-progress-track {
              position: absolute;
              top: 14px;
              left: 0;
              right: 0;
              height: 4px;
              background: rgba(255, 255, 255, 0.16);
              pointer-events: none;
              transition: height 0.15s ease, background 0.15s ease;
            }
            .mobile-top-progress:active .mobile-top-progress-track,
            .mobile-top-progress.scrubbing .mobile-top-progress-track {
              height: 6px;
              background: rgba(255, 255, 255, 0.32);
            }
            .mobile-top-progress-fill {
              height: 100%;
              background: linear-gradient(90deg, #FF8C00, #FF2E63);
              position: relative;
              box-shadow: 0 0 10px rgba(255, 140, 0, 0.6);
            }
            .mobile-top-progress-thumb {
              position: absolute;
              right: -5px;
              top: 50%;
              transform: translateY(-50%);
              width: 10px;
              height: 10px;
              border-radius: 50%;
              background: #FFFFFF;
              box-shadow: 0 0 8px rgba(255, 140, 0, 0.9);
              opacity: 0;
              transition: opacity 0.15s ease;
            }
            .mobile-top-progress:active .mobile-top-progress-thumb,
            .mobile-top-progress.scrubbing .mobile-top-progress-thumb {
              opacity: 1;
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

        {/* Real-time Top Progress Bar for Mobile (Touch & Drag scrub enabled) */}
        <div
          className={`mobile-top-progress ${scrubPercent !== null ? 'scrubbing' : ''}`}
          onClick={handleSeek}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          role="slider"
          aria-label="Seek track"
          aria-valuenow={Math.round(currentTime)}
          aria-valuemin={0}
          aria-valuemax={Math.round(effectiveDuration)}
          title="Seek playback"
        >
          <div className="mobile-top-progress-track">
            <div
              className="mobile-top-progress-fill"
              style={{
                width: `${progressPercent}%`,
                transition: scrubPercent !== null ? 'none' : 'width 0.2s linear'
              }}
            >
              <div className="mobile-top-progress-thumb" />
            </div>
          </div>
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
                <span>{t('बोल थियेटर (Lyrics)', 'Lyrics Theatre', 'बोल थियेटर')}</span>
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
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onMouseEnter={() => setIsHoveringScrub(true)}
                onMouseLeave={() => setIsHoveringScrub(false)}
                style={{
                  flex: 1,
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  touchAction: 'none'
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
