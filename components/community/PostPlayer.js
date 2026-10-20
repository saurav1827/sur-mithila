'use client';

import React, { useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { Play, Pause, Heart } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';

let activeAudio = null;
const BARS = 48;

const fmt = (s) => (!Number.isFinite(s) || isNaN(s) || s < 0 ? '0:00' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`);

function waveform(seed = 'mithila') {
  let h = 0;
  for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return Array.from({ length: BARS }, (_, i) => {
    h = (h * 1664525 + 1013904223) >>> 0;
    const envelope = Math.sin((i / BARS) * Math.PI) * 0.5 + 0.5;
    return 0.25 + (((h >>> 8) % 100) / 100) * 0.75 * envelope;
  });
}

export default function PostPlayer({ post, burstKey, onDoubleTap }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState({ cur: 0, dur: 0 });
  const bars = useMemo(() => waveform(post?.id || post?._id || 'mithila'), [post?.id, post?._id]);
  const { setIsPlaying: setGlobalIsPlaying } = usePlayer() || {};
  const ratio = t.dur > 0 ? Math.min(1, Math.max(0, t.cur / t.dur)) : 0;

  const audioSrc = post?.audioUrl || post?.audio_url || post?.recording_url;

  const toggle = (e) => {
    e?.stopPropagation();
    const el = audioRef.current;
    if (!el || !audioSrc) return;

    if (el.paused) {
      if (activeAudio && activeAudio !== el) {
        try { activeAudio.pause(); } catch (err) {}
      }
      if (setGlobalIsPlaying) setGlobalIsPlaying(false);
      activeAudio = el;
      el.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  const seek = (e) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    const clickRatio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    el.currentTime = clickRatio * el.duration;
    setT(prev => ({ ...prev, cur: el.currentTime }));
  };

  const handleLoadedMetadata = (e) => {
    const dur = e?.currentTarget?.duration || audioRef.current?.duration || 0;
    if (Number.isFinite(dur) && dur > 0) {
      setT(prev => ({ ...prev, dur }));
    }
  };

  const handleTimeUpdate = (e) => {
    const cur = e?.currentTarget?.currentTime || audioRef.current?.currentTime || 0;
    const dur = e?.currentTarget?.duration || audioRef.current?.duration || 0;
    setT({
      cur: Number.isFinite(cur) ? cur : 0,
      dur: Number.isFinite(dur) ? dur : 0
    });
  };

  const posterImg = post?.song?.poster?.image_url || post?.song?.poster || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80';

  return (
    <div
      className="post-media-box"
      data-playing={playing}
      onDoubleClick={onDoubleTap}
      onClick={toggle}
    >
      {/* Dynamic Ambient Glow Backdrop */}
      <div
        className="post-media-ambient-bg"
        style={{ backgroundImage: `url(${posterImg})` }}
      />

      <div className="post-media-content">
        {/* Vinyl / Cover Art Disc */}
        <div className="post-disc-art" style={{ position: 'relative' }}>
          <img src={posterImg} alt={post?.song?.title || 'Cover'} />
          <div
            className="post-disc-overlay-btn"
            style={{
              background: playing
                ? 'linear-gradient(135deg, rgba(255, 46, 99, 0.85), rgba(255, 140, 0, 0.85))'
                : 'rgba(0, 0, 0, 0.55)'
            }}
          >
            {playing ? (
              <Pause size={28} fill="#FFFFFF" color="#FFFFFF" />
            ) : (
              <Play size={28} fill="#FFFFFF" color="#FFFFFF" style={{ marginLeft: '3px' }} />
            )}
          </div>
        </div>

        {/* Track Info & Interactive Waveform */}
        <div style={{ minWidth: 0, flex: 1 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
            <Link
              href={post?.song?.slug ? `/songs/${post.song.slug}` : '#'}
              className="font-traditional"
              style={{
                color: '#F8FAFC',
                fontWeight: 700,
                fontSize: '1.05rem',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {post?.song?.title || 'Community Recording'}
            </Link>
            {playing && (
              <span style={{
                fontSize: '0.68rem',
                padding: '2px 8px',
                borderRadius: '9999px',
                background: 'linear-gradient(135deg, #FF8C00, #FF2E63)',
                color: '#FFFFFF',
                fontWeight: 700,
                letterSpacing: '0.04em'
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
            textOverflow: 'ellipsis'
          }}>
            {post?.song?.originalSinger ? `Original: ${post.song.originalSinger}` : 'Community Folk Cover'}
          </p>

          {/* Interactive Scrub Waveform */}
          <div
            className="pp-wave"
            role="slider"
            aria-label="Seek track"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(ratio * 100)}
            tabIndex={0}
            onPointerDown={(e) => {
              try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
              seek(e);
            }}
            onPointerMove={(e) => e.buttons === 1 && seek(e)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              height: '36px',
              cursor: 'pointer'
            }}
          >
            {bars.map((h, i) => {
              const isOn = i / BARS < ratio;
              return (
                <span
                  key={i}
                  style={{
                    flex: 1,
                    height: `${Math.max(18, h * 100)}%`,
                    borderRadius: '2px',
                    background: isOn
                      ? 'linear-gradient(180deg, #FF8C00, #FF2E63)'
                      : 'rgba(255, 255, 255, 0.18)',
                    transition: 'background 0.1s ease'
                  }}
                />
              );
            })}
          </div>

          {/* Timestamp Track Progress */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            marginTop: '2px',
            fontFamily: 'monospace'
          }}>
            <span>{fmt(t.cur)}</span>
            <span>{fmt(t.dur)}</span>
          </div>
        </div>
      </div>

      {/* Double Tap Heart Explosion Overlay */}
      {burstKey > 0 && (
        <div className="heart-burst-animation" key={burstKey} aria-hidden>
          <Heart size={84} fill="#FF2E63" color="#FF2E63" />
        </div>
      )}

      {/* HTML5 Audio Node */}
      {audioSrc && (
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
        />
      )}
    </div>
  );
}