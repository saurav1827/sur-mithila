'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePlayer } from '../context/PlayerContext';
import { Play, Pause, Disc, Maximize2, Minimize2, ExternalLink, Mic, Volume2, CheckCircle2 } from 'lucide-react';
import YouTube from 'react-youtube';

const BARS = 36;
function waveform(seed = 'mithila') {
  let h = 0;
  for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return Array.from({ length: BARS }, (_, i) => {
    h = (h * 1664525 + 1013904223) >>> 0;
    const envelope = Math.sin((i / BARS) * Math.PI) * 0.5 + 0.5;
    return 0.25 + (((h >>> 8) % 100) / 100) * 0.75 * envelope;
  });
}

export default function SongHeroVideo({ youtubeId, posterUrl, title, song, initialCover }) {
  const {
    currentTrack,
    playTrack,
    isPlaying,
    setIsPlaying,
    registerPlayer,
    unregisterPlayer
  } = usePlayer();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);
  const playerRef = useRef(null);

  // Cover Spotlight State
  const [mediaMode, setMediaMode] = useState(initialCover ? 'cover' : 'youtube');
  const [isCoverPlaying, setIsCoverPlaying] = useState(false);
  const [coverProgress, setCoverProgress] = useState(0);
  const [coverCurrentTime, setCoverCurrentTime] = useState('0:00');
  const [coverDuration, setCoverDuration] = useState('0:00');
  const coverAudioRef = useRef(null);
  const bars = useMemo(() => waveform(initialCover?.id || 'mithila'), [initialCover?.id]);

  useEffect(() => {
    const handleMode = (e) => {
      if (e.detail === 'cover' && initialCover) {
        setMediaMode('cover');
      } else if (e.detail === 'song' || e.detail === 'youtube') {
        setMediaMode('youtube');
        if (coverAudioRef.current) {
          coverAudioRef.current.pause();
          setIsCoverPlaying(false);
        }
      }
    };
    window.addEventListener('sur_mithila_mode_change', handleMode);
    return () => window.removeEventListener('sur_mithila_mode_change', handleMode);
  }, [initialCover]);

  const formatSecs = (s) => {
    if (!s || !Number.isFinite(s) || isNaN(s) || s <= 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = String(Math.floor(s % 60)).padStart(2, '0');
    return `${m}:${sec}`;
  };

  const toggleCoverPlayback = () => {
    let audio = coverAudioRef.current;
    if (!audio && initialCover?.audioUrl) {
      audio = new Audio(initialCover.audioUrl);
      coverAudioRef.current = audio;

      const resolveDuration = () => {
        const dur = audio.duration;
        if (Number.isFinite(dur) && dur > 0) {
          setCoverDuration(formatSecs(dur));
        } else if (dur === Infinity) {
          // WebM duration resolution trick for Chrome/Chromium:
          const onSeeked = () => {
            audio.removeEventListener('seeked', onSeeked);
            audio.currentTime = 0;
            if (Number.isFinite(audio.duration) && audio.duration > 0) {
              setCoverDuration(formatSecs(audio.duration));
            }
          };
          audio.addEventListener('seeked', onSeeked);
          audio.currentTime = 1e10;
        }
      };

      audio.onloadedmetadata = resolveDuration;
      audio.ondurationchange = resolveDuration;

      audio.ontimeupdate = () => {
        const cur = audio.currentTime || 0;
        const dur = audio.duration;
        if (Number.isFinite(cur)) {
          setCoverCurrentTime(formatSecs(cur));
        }
        if (Number.isFinite(dur) && dur > 0) {
          setCoverProgress(Math.min(100, Math.max(0, (cur / dur) * 100)));
          setCoverDuration(formatSecs(dur));
        }
      };

      audio.onended = () => {
        setIsCoverPlaying(false);
        setCoverProgress(0);
        setCoverCurrentTime('0:00');
      };
    }

    if (audio) {
      if (isCoverPlaying) {
        audio.pause();
        setIsCoverPlaying(false);
      } else {
        if (playerRef.current) {
          try { playerRef.current.pauseVideo(); } catch { }
        }
        audio.play().then(() => {
          setIsCoverPlaying(true);
        }).catch(console.error);
      }
    }
  };

  const handleSeekCover = (e) => {
    const audio = coverAudioRef.current;
    if (!audio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));

    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = ratio * audio.duration;
      setCoverProgress(ratio * 100);
      setCoverCurrentTime(formatSecs(audio.currentTime));
    }
  };

  // Clean up cover audio on unmount
  useEffect(() => {
    return () => {
      if (coverAudioRef.current) {
        coverAudioRef.current.pause();
        coverAudioRef.current = null;
      }
    };
  }, []);

  const isCurrentTrackThisSong = currentTrack && currentTrack.song?.slug === song?.slug;
  const isPlayingHere = isPlaying && isCurrentTrackThisSong;

  const ytThumb = youtubeId
    ? `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`
    : null;
  const imageSource = posterUrl || ytThumb || (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : null);

  // Clean up registration on unmount
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        unregisterPlayer(playerRef.current);
      }
    };
  }, [unregisterPlayer]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = (e) => {
    if (e) e.stopPropagation();
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      } else if (containerRef.current.webkitRequestFullscreen) {
        containerRef.current.webkitRequestFullscreen();
      } else if (containerRef.current.msRequestFullscreen) {
        containerRef.current.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  };

  const handleStartPlay = () => {
    playTrack(song);
  };

  const onReady = (event) => {
    playerRef.current = event.target;
    registerPlayer(event.target, 'youtube');
    if (isPlaying) {
      try { event.target.playVideo(); } catch (err) {}
    }
  };

  const onStateChange = (event) => {
    if (event.data === 1 && !isPlaying && setIsPlaying) {
      setIsPlaying(true);
    } else if (event.data === 2 && isPlaying && setIsPlaying) {
      setIsPlaying(false);
    } else if (event.data === 0 && setIsPlaying) {
      setIsPlaying(false);
    }
  };

  return (
    <div>
      {/* 1. Modern Segmented Mode Switcher (Cover ⇄ YouTube) */}
      {initialCover && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          maxWidth: '380px',
          width: '100%',
          background: 'rgba(11, 14, 26, 0.85)',
          padding: '4px',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          marginBottom: '14px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
        }}>
          <button
            type="button"
            onClick={() => {
              setMediaMode('cover');
              if (playerRef.current) {
                try { playerRef.current.pauseVideo(); } catch { }
              }
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('sur_mithila_mode_change', { detail: 'cover' }));
                if (initialCover?.id) {
                  const url = new URL(window.location.href);
                  url.searchParams.set('cover', initialCover.id);
                  window.history.replaceState(null, '', url.toString());
                }
              }
            }}
            style={{
              padding: '8px 12px',
              borderRadius: '9px',
              background: mediaMode === 'cover' ? 'linear-gradient(135deg, #EAB308, #D97706)' : 'transparent',
              color: mediaMode === 'cover' ? '#070913' : 'var(--text-secondary)',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: mediaMode === 'cover' ? '0 2px 10px rgba(234, 179, 8, 0.35)' : 'none',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            <Mic size={14} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {initialCover.userName} (कवर)
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMediaMode('youtube');
              if (coverAudioRef.current) {
                coverAudioRef.current.pause();
                setIsCoverPlaying(false);
              }
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('sur_mithila_mode_change', { detail: 'song' }));
                const url = new URL(window.location.href);
                url.searchParams.delete('cover');
                window.history.replaceState(null, '', url.toString());
              }
            }}
            style={{
              padding: '8px 12px',
              borderRadius: '9px',
              background: mediaMode === 'youtube' ? 'linear-gradient(135deg, #FF2E63, #FF8C00)' : 'transparent',
              color: mediaMode === 'youtube' ? '#FFFFFF' : 'var(--text-secondary)',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: mediaMode === 'youtube' ? '0 2px 10px rgba(255, 46, 99, 0.35)' : 'none',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            <Play size={13} fill="currentColor" style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              मूल युट्यूब (Original)
            </span>
          </button>
        </div>
      )}

      {/* 2. Media Player: Cover Spotlight OR YouTube Video OR Poster */}
      {mediaMode === 'cover' && initialCover ? (
        <div
          ref={containerRef}
          className="song-hero-media-wrapper post-media-box"
          data-playing={isCoverPlaying}
          style={{
            width: '100%',
            borderRadius: isFullscreen ? '0px' : '16px',
            overflow: 'hidden',
            position: 'relative',
            minHeight: isFullscreen ? '100vh' : '290px',
            padding: '20px',
            cursor: 'default',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          {/* Dynamic Ambient Glow Backdrop */}
          <div
            className="post-media-ambient-bg"
            style={{ backgroundImage: `url(${imageSource})` }}
          />

          {/* Top Creator Header Pill */}
          <div style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            flexWrap: 'wrap',
            width: '100%',
            marginBottom: '14px',
          }}>
            <Link
              href={`/profile/${initialCover.userId || initialCover.userName}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px',
                borderRadius: '999px',
                background: 'rgba(0, 0, 0, 0.72)',
                border: '1px solid rgba(234, 179, 8, 0.35)',
                textDecoration: 'none',
                color: '#F8FAFC',
                backdropFilter: 'blur(10px)',
                maxWidth: '65%',
              }}
            >
              {initialCover.userAvatar ? (
                <img
                  src={initialCover.userAvatar}
                  alt={initialCover.userName}
                  style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #EAB308, #D97706)',
                  color: '#070913', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '0.72rem', flexShrink: 0,
                }}>
                  {(initialCover.userName || 'M')[0].toUpperCase()}
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {initialCover.userName}
                  </span>
                  <CheckCircle2 size={12} color="#EAB308" style={{ flexShrink: 0 }} />
                </div>
              </div>
              <ExternalLink size={12} color="#EAB308" style={{ flexShrink: 0 }} />
            </Link>

            <div style={{
              padding: '4px 12px',
              borderRadius: '999px',
              background: 'rgba(234, 179, 8, 0.15)',
              border: '1px solid rgba(234, 179, 8, 0.35)',
              color: '#FDE047',
              fontSize: '0.74rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              flexShrink: 0,
            }}>
              <Mic size={12} />
              <span>Live Folk Cover</span>
            </div>
          </div>

          {/* Centerpiece: Vinyl Disc Art + Track Info + Interactive Waveform */}
          <div className="post-media-content" style={{ position: 'relative', zIndex: 2, marginBottom: '14px' }}>
            {/* Vinyl / Cover Art Disc with Play/Pause Button */}
            <div
              className="post-disc-art"
              onClick={toggleCoverPlayback}
              style={{
                cursor: 'pointer',
                borderRadius: '50%',
                boxShadow: isCoverPlaying ? '0 0 26px rgba(234, 179, 8, 0.55), 0 8px 24px rgba(0,0,0,0.85)' : '0 8px 24px rgba(0,0,0,0.8)',
                border: '2px solid rgba(234, 179, 8, 0.45)',
                width: '84px',
                height: '84px',
                flexShrink: 0,
              }}
            >
              <img src={imageSource} alt={title} />
              <div
                className="post-disc-overlay-btn"
                style={{
                  background: isCoverPlaying
                    ? 'linear-gradient(135deg, rgba(234, 179, 8, 0.88), rgba(217, 119, 6, 0.88))'
                    : 'rgba(0, 0, 0, 0.55)',
                  color: isCoverPlaying ? '#070913' : '#FFFFFF',
                }}
              >
                {isCoverPlaying ? (
                  <Pause size={28} fill="currentColor" />
                ) : (
                  <Play size={28} fill="currentColor" style={{ marginLeft: '3px' }} />
                )}
              </div>
            </div>

            {/* Track Info & Interactive Waveform */}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                <span
                  className="font-traditional"
                  style={{
                    color: '#F8FAFC',
                    fontWeight: 700,
                    fontSize: '1.05rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {title}
                </span>
                {isCoverPlaying && (
                  <span style={{
                    fontSize: '0.65rem',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'linear-gradient(135deg, #EAB308, #D97706)',
                    color: '#070913',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    flexShrink: 0,
                  }}>
                    PLAYING
                  </span>
                )}
              </div>

              <p style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                margin: '2px 0 8px 0',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                स्वर: <strong style={{ color: '#FDE047' }}>{initialCover.userName}</strong> {initialCover.caption ? `• "${initialCover.caption}"` : ''}
              </p>

              {/* Interactive Scrub Waveform */}
              <div
                className="pp-wave"
                role="slider"
                aria-label="Seek track"
                onClick={handleSeekCover}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  height: '34px',
                  cursor: 'pointer',
                }}
              >
                {bars.map((h, i) => {
                  const isOn = (i / BARS) * 100 <= coverProgress;
                  return (
                    <span
                      key={i}
                      style={{
                        flex: 1,
                        height: `${Math.max(18, h * 100)}%`,
                        borderRadius: '2px',
                        background: isOn
                          ? 'linear-gradient(180deg, #EAB308, #D97706)'
                          : 'rgba(255, 255, 255, 0.18)',
                        transition: 'background 0.1s ease',
                      }}
                    />
                  );
                })}
              </div>

              {/* Timestamp Track Progress (NEVER Infinity or NaN!) */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.74rem',
                color: '#CBD5E1',
                marginTop: '3px',
                fontFamily: 'monospace',
              }}>
                <span>{coverCurrentTime}</span>
                <span>{coverDuration}</span>
              </div>
            </div>
          </div>
        </div>
      ) : youtubeId ? (
        <div
          ref={containerRef}
          className="song-hero-media-wrapper"
          style={{
            width: '100%',
            borderRadius: isFullscreen ? '0px' : '16px',
            overflow: 'hidden',
            boxShadow: isFullscreen ? 'none' : '0 16px 40px rgba(0, 0, 0, 0.8), 0 0 24px rgba(255, 140, 0, 0.25)',
            border: isFullscreen ? 'none' : '1px solid rgba(255, 140, 0, 0.35)',
            position: 'relative',
            paddingTop: isFullscreen ? '0' : '56.25%',
            height: isFullscreen ? '100vh' : 'auto',
            background: '#000',
            transition: 'box-shadow 0.3s ease'
          }}
        >
          {isCurrentTrackThisSong ? (
            <div style={{
              position: isFullscreen ? 'relative' : 'absolute',
              inset: 0,
              width: '100%',
              height: isFullscreen ? '100%' : '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#000'
            }}>
              <YouTube
                videoId={youtubeId}
                opts={{
                  width: '100%',
                  height: '100%',
                  playerVars: {
                    autoplay: 1,
                    controls: 1,
                    fs: 1,
                    rel: 0,
                    modestbranding: 0
                  }
                }}
                onReady={onReady}
                onStateChange={onStateChange}
                style={{ width: '100%', height: '100%' }}
                iframeClassName="hero-youtube-iframe"
              />

              <div style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                zIndex: 30,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                pointerEvents: 'auto'
              }}>
                <button
                  onClick={toggleFullscreen}
                  title={isFullscreen ? 'Exit Full Screen' : 'Full Screen (पूर्ण स्क्रीन)'}
                  style={{
                    background: 'rgba(8, 10, 16, 0.85)',
                    backdropFilter: 'blur(12px)',
                    color: '#F8FAFC',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  <span>{isFullscreen ? 'Exit' : 'Full Screen'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={handleStartPlay}
              style={{
                position: 'absolute',
                inset: 0,
                cursor: 'pointer',
                overflow: 'hidden'
              }}
            >
              {imageSource ? (
                <img
                  src={imageSource}
                  alt={title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: 0.88,
                    transition: 'transform 0.4s ease'
                  }}
                />
              ) : (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'radial-gradient(circle, rgba(255, 140, 0, 0.15) 0%, #0B0D13 100%)'
                }}>
                  <Disc size={64} color="var(--neon-saffron)" opacity={0.6} />
                </div>
              )}

              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0.75) 100%)'
              }} />

              <div style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                zIndex: 10
              }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartPlay();
                    setTimeout(toggleFullscreen, 300);
                  }}
                  title="Play in Full Screen"
                  style={{
                    background: 'rgba(8, 10, 16, 0.8)',
                    backdropFilter: 'blur(8px)',
                    color: '#F8FAFC',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}
                >
                  <Maximize2 size={14} />
                  <span>Full Screen</span>
                </button>
              </div>

              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #FF8C00 0%, #FF2E63 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 32px rgba(255, 140, 0, 0.65)',
                transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}>
                <Play fill="#FFFFFF" color="#FFFFFF" size={30} style={{ marginLeft: '4px' }} />
              </div>

              <div style={{
                position: 'absolute',
                bottom: '14px',
                left: '16px',
                right: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '0.82rem',
                fontWeight: 500
              }}>
                <span>बजाउ (Click to Play Video)</span>
                <span style={{ color: 'var(--neon-saffron)' }}>HD Video • Full Screen</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          ref={containerRef}
          style={{
            width: '100%',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            position: 'relative',
            aspectRatio: '1 / 1',
            maxHeight: '340px',
            background: 'linear-gradient(135deg, #13192B, #0B0E1A)',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8)'
          }}
        >
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px'
            }}>
              <Disc size={64} color="var(--neon-saffron)" opacity={0.7} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>मिथिला लोक संगीत</span>
            </div>
          )}

          <button
            onClick={handleStartPlay}
            style={{
              position: 'absolute',
              bottom: '16px',
              right: '16px',
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #FF8C00, #FF2E63)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(255, 140, 0, 0.55)'
            }}
          >
            <Play fill="#fff" size={24} style={{ marginLeft: '3px' }} />
          </button>
        </div>
      )}
    </div>
  );
}
