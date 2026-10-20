'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, Type, Sparkles, BookOpen, Mic2, Languages, Lock, Unlock, Volume2 } from 'lucide-react';
import { transliterateLyrics } from '../lib/slugs';
import { usePlayer } from '../context/PlayerContext';

export default function LyricsTheatre({ lyrics, canonicalTitle, writer, traditionalRaga, song }) {
  const [tab, setTab] = useState('devanagari'); // 'devanagari' | 'hindi' | 'roman'
  const [fontSize, setFontSize] = useState(1.2); // rem
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [activeLineIdx, setActiveLineIdx] = useState(0);

  const { isPlaying, currentTime, duration, currentTrack, seekTo, registerLyrics } = usePlayer();
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    registerLyrics(song?.slug, lyrics);
  }, [song?.slug, lyrics, registerLyrics]);

  const devanagariText = lyrics?.devanagari || lyrics?.raw_text || 'बोल उपलब्ध नहि अछि...';
  const hindiTranslation = lyrics?.hindi || lyrics?.translation_hindi || 'हिंदी अनुवाद: ' + devanagariText;
  const romanText = (lyrics?.roman && lyrics.roman.trim().length > 0)
    ? lyrics.roman
    : transliterateLyrics(devanagariText);

  // Split into lines for karaoke synchronization & interactive seeking
  const devLines = devanagariText.split('\n').filter(l => l.trim().length > 0);
  const romanLines = romanText.split('\n').filter(l => l.trim().length > 0);
  const hindiLines = hindiTranslation.split('\n').filter(l => l.trim().length > 0);

  const currentLines = tab === 'devanagari' ? devLines : (tab === 'hindi' ? hindiLines : romanLines);
  const currentFullText = tab === 'devanagari' ? devanagariText : (tab === 'hindi' ? hindiTranslation : romanText);

  // Estimate active line based on playback currentTime
  useEffect(() => {
    if (isPlaying && duration > 0 && currentLines.length > 0) {
      const lineDuration = duration / currentLines.length;
      const calculatedIdx = Math.min(
        Math.floor(currentTime / lineDuration),
        currentLines.length - 1
      );
      if (calculatedIdx >= 0 && calculatedIdx !== activeLineIdx) {
        setActiveLineIdx(calculatedIdx);
      }
    }
  }, [currentTime, duration, isPlaying, currentLines.length, activeLineIdx]);

  // Auto-scroll to active line
  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      const activeEl = scrollContainerRef.current.querySelector('.active-karaoke-line');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLineIdx, autoScroll]);

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const increaseFont = () => setFontSize(prev => Math.min(prev + 0.15, 2.2));
  const decreaseFont = () => setFontSize(prev => Math.max(prev - 0.15, 0.95));
  const resetFont = () => setFontSize(1.2);

  const writerName = typeof writer === 'object' ? (writer.name || 'पारंपरिक') : (writer || 'पारंपरिक');
  const isVidyapati = writerName.includes('विद्यापति');

  return (
    <div className="lyrics-theatre-box" style={{ marginTop: '28px' }}>
      {/* Header with Tools */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        paddingBottom: '20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(255, 140, 0, 0.2), rgba(255, 46, 99, 0.2))',
            border: '1px solid rgba(255, 140, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <BookOpen size={20} color="var(--neon-saffron)" />
          </div>
          <div>
            <h2 className="font-traditional" style={{ fontSize: '1.45rem', color: '#F8FAFC', margin: 0 }}>
              गीतक बोल / Lyrics Theatre
            </h2>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Spotify-Style Interactive Synchronized Lyrics
            </span>
          </div>
        </div>

        {/* Action Controls Group */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          {/* 3-Way Language Toggle */}
          <div className="lyrics-tabs-pill">
            <button
              onClick={() => setTab('devanagari')}
              className={`lyrics-tab-btn ${tab === 'devanagari' ? 'active' : ''}`}
            >
              मैथिली (मूल)
            </button>
            <button
              onClick={() => setTab('hindi')}
              className={`lyrics-tab-btn ${tab === 'hindi' ? 'active' : ''}`}
            >
              हिंदी अनुवाद
            </button>
            <button
              onClick={() => setTab('roman')}
              className={`lyrics-tab-btn ${tab === 'roman' ? 'active' : ''}`}
            >
              English / Roman
            </button>
          </div>

          {/* Auto Scroll Lock Toggle */}
          <button
            onClick={() => setAutoScroll(prev => !prev)}
            title={autoScroll ? 'Auto-scroll is ON (Click to lock)' : 'Auto-scroll is OFF (Click to follow)'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '8px',
              background: autoScroll ? 'rgba(255, 140, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              border: autoScroll ? '1px solid rgba(255, 140, 0, 0.35)' : '1px solid rgba(255, 255, 255, 0.1)',
              color: autoScroll ? 'var(--neon-saffron)' : 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {autoScroll ? <Lock size={14} /> : <Unlock size={14} />}
            <span>{autoScroll ? 'Auto-Scroll' : 'Manual'}</span>
          </button>

          {/* Font Resizing Controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '2px'
          }}>
            <button
              onClick={decreaseFont}
              title="Decrease Font Size"
              style={{ padding: '6px 10px', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              A-
            </button>
            <button
              onClick={resetFont}
              title="Reset Font Size"
              style={{ padding: '6px 8px', color: 'var(--neon-saffron)', fontSize: '0.75rem', cursor: 'pointer' }}
            >
              {Math.round((fontSize / 1.2) * 100)}%
            </button>
            <button
              onClick={increaseFont}
              title="Increase Font Size"
              style={{ padding: '6px 10px', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              A+
            </button>
          </div>

          {/* Copy Lyrics Button */}
          <button
            onClick={handleCopy}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              background: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)',
              color: copied ? '#6EE7B7' : 'var(--text-main)',
              border: copied ? '1px solid #10B981' : '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Classical Poet Bhanita Callout */}
      {isVidyapati && (
        <div style={{
          marginTop: '18px',
          padding: '14px 20px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(255, 140, 0, 0.12), rgba(255, 46, 99, 0.06))',
          border: '1px solid rgba(255, 140, 0, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <Sparkles size={22} color="var(--neon-saffron)" />
          <div>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FDE047' }}>
              महाकवि विद्यापति पदावली भनिता (Classical Bhanita)
            </span>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              एहि पद मे महाकवि विद्यापति ठाकुरक पारम्परिक छाप (भनिता) समाहित अछि।
            </p>
          </div>
        </div>
      )}

      {/* Synchronized Karaoke-Style Lyrics Body */}
      <div 
        ref={scrollContainerRef}
        className="karaoke-scroll-box"
        style={{
          marginTop: '20px',
          background: 'rgba(8, 10, 16, 0.65)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.04)'
        }}
      >
        {currentLines.map((line, idx) => {
          const isActive = idx === activeLineIdx;
          return (
            <div
              key={idx}
              onClick={() => {
                setActiveLineIdx(idx);
                if (duration > 0 && currentLines.length > 0) {
                  const targetSeconds = (idx / currentLines.length) * duration;
                  seekTo(targetSeconds);
                }
              }}
              className={`karaoke-line ${isActive ? 'active-karaoke-line' : ''}`}
              style={{
                fontFamily: tab === 'devanagari' ? 'var(--font-devanagari)' : 'var(--font-sans)',
                fontSize: `${fontSize}rem`,
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                <span style={{
                  fontSize: '0.75rem',
                  color: isActive ? 'var(--neon-saffron)' : 'rgba(255, 255, 255, 0.2)',
                  fontFamily: 'monospace',
                  width: '24px'
                }}>
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span style={{ flex: 1 }}>{line}</span>
                {isActive && isPlaying && (
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    background: 'rgba(255, 140, 0, 0.2)',
                    color: '#FDE047',
                    fontWeight: 700
                  }}>
                    LIVE
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cultural Provenance & Attribution Footer */}
      <div style={{
        marginTop: '20px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
        fontSize: '0.82rem',
        color: 'var(--text-muted)',
        paddingTop: '16px',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <span>रचयिता / Lyricist: <strong style={{ color: '#FDE047' }}>{writerName}</strong></span>
        {traditionalRaga && <span>राग / Traditional Raag: <strong style={{ color: '#93C5FD' }}>{traditionalRaga}</strong></span>}
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>प्रमाणिकता / Status:</span>
          <strong style={{ color: 'var(--accent-emerald)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            ✓ सत्यापित (Verified)
          </strong>
        </span>
      </div>
    </div>
  );
}
