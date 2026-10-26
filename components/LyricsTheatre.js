'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Copy, Check, Type, Sparkles, BookOpen, Mic2, Languages, Lock, Unlock, Volume2, Music2 } from 'lucide-react';
import { transliterateLyrics } from '../lib/slugs';
import { usePlayer } from '../context/PlayerContext';
import { useLanguage } from '../context/LanguageContext';

export default function LyricsTheatre({ lyrics, canonicalTitle, writer, traditionalRaga, song }) {
  const { t, isEnglish, isMaithiliPlus } = useLanguage();
  const [tab, setTab] = useState(isEnglish ? 'roman' : 'devanagari'); // 'devanagari' | 'hindi' | 'roman'
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

  // Intelligent parser for structured narrative songs (extracts clean text, section headers, speakers)
  const parsedLines = useMemo(() => {
    let lastSectionKey = '';
    return currentLines.map((rawLine, idx) => {
      // 1. Timestamp match [mm:ss]
      const tsMatch = rawLine.match(/^\[(\d{2}:\d{2})\]\s*(.*)$/);
      const timestamp = tsMatch ? tsMatch[1] : null;
      let text = tsMatch ? tsMatch[2].trim() : rawLine.trim();

      let sectionType = 'normal'; // 'song' | 'story' | 'normal'
      let sectionTitle = '';
      let speaker = null;

      // Detect song markers: e.g. 🎵 [विवाह गीत १ : मंगलगान] or [विवाह गीत ...] or [गीत ...]
      const songTagMatch = text.match(/^(?:🎵\s*)?\[(?:विवाह\s*गीत|गीत)\s*([^\]]*)\]\s*(.*)$/i);
      if (songTagMatch) {
        sectionType = 'song';
        sectionTitle = songTagMatch[1] ? songTagMatch[1].trim() : 'विवाह गीत';
        text = songTagMatch[2].trim();
      } else if (text.startsWith('🎵')) {
        sectionType = 'song';
        text = text.replace(/^🎵\s*/, '').trim();
      }

      // Detect story/narration markers: e.g. 📖 [कथा-वाचन : बुढ़वा] or [कथा-वाचन]
      const storyTagMatch = text.match(/^(?:📖\s*)?\[कथा-वाचन(?:\s*:\s*([^\]]+))?\]\s*(.*)$/i);
      if (storyTagMatch) {
        sectionType = 'story';
        speaker = storyTagMatch[1] ? storyTagMatch[1].trim() : null;
        text = storyTagMatch[2].trim();
      } else if (text.startsWith('📖')) {
        sectionType = 'story';
        text = text.replace(/^📖\s*/, '').trim();
      }

      // Detect speaker if written as [बुढ़वा] or [इन्द्र] at the start of dialogue
      if (!speaker) {
        const speakerMatch = text.match(/^\[([^\]]{2,15})\]\s*(.*)$/);
        if (speakerMatch && ['बुढ़वा', 'इन्द्र', 'भरत जी', 'राम जी', 'लक्ष्मण जी', 'शत्रुघ्न जी', 'मैथिलानी', 'स्नेहलता'].includes(speakerMatch[1])) {
          speaker = speakerMatch[1];
          text = speakerMatch[2].trim();
        }
      }

      // Residual section tags like "[मंगलगान]" or "[नतोवा]" or "[परिछन]"
      const residualTag = text.match(/^\[([^\]]+)\]\s*(.*)$/);
      if (residualTag && !residualTag[1].includes(':') && (
        residualTag[1].includes('गीत') || residualTag[1].includes('परिछन') || residualTag[1].includes('मंगलगान') ||
        residualTag[1].includes('कथा') || residualTag[1].includes('नतोवा') || residualTag[1].includes('आरती') ||
        residualTag[1].includes('बिछिया') || residualTag[1].includes('सिन्दूरदान') || residualTag[1].includes('कन्यादान') ||
        residualTag[1].includes('भाँवरि') || residualTag[1].includes('दोहा')
      )) {
        if (!sectionTitle && sectionType === 'song') sectionTitle = residualTag[1];
        text = residualTag[2].trim();
      }

      // Grouping key: songs group by their main title or 'song', narration groups as 'story'
      let currentSectionKey = '';
      if (sectionType === 'song') {
        const baseTitle = sectionTitle ? sectionTitle.split(':')[0].trim() : 'गीत';
        currentSectionKey = `song_${baseTitle}`;
      } else if (sectionType === 'story') {
        currentSectionKey = 'story';
      } else {
        currentSectionKey = 'normal';
      }

      let showSectionHeader = false;
      if (currentSectionKey && currentSectionKey !== lastSectionKey) {
        showSectionHeader = true;
        lastSectionKey = currentSectionKey;
      }

      let seconds = null;
      if (timestamp) {
        const [m, s] = timestamp.split(':').map(Number);
        seconds = m * 60 + s;
      }

      return {
        idx,
        rawLine,
        timestamp,
        seconds,
        sectionType,
        sectionTitle: sectionTitle || 'पारंपरिक विवाह गीत',
        speaker,
        cleanText: text || rawLine,
        showSectionHeader,
        isHeaderOnly: !text && !!sectionTitle
      };
    });
  }, [currentLines]);

  // Precise line sync when timestamps exist, or fallback to proportional
  useEffect(() => {
    if (isPlaying && duration > 0 && parsedLines.length > 0) {
      const hasTimestamps = parsedLines.some(l => l.seconds !== null);
      if (hasTimestamps && currentTime >= 0) {
        let foundIdx = -1;
        for (let i = parsedLines.length - 1; i >= 0; i--) {
          if (parsedLines[i].seconds !== null && currentTime >= parsedLines[i].seconds) {
            foundIdx = i;
            break;
          }
        }
        if (foundIdx >= 0 && foundIdx !== activeLineIdx) {
          setActiveLineIdx(foundIdx);
        }
      } else {
        const lineDuration = duration / parsedLines.length;
        const calculatedIdx = Math.min(
          Math.floor(currentTime / lineDuration),
          parsedLines.length - 1
        );
        if (calculatedIdx >= 0 && calculatedIdx !== activeLineIdx) {
          setActiveLineIdx(calculatedIdx);
        }
      }
    }
  }, [currentTime, duration, isPlaying, parsedLines, activeLineIdx]);

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

  // Detect if this song has multi-part narrative sections (like Ram Vivah)
  const hasStructuredSections = useMemo(() => {
    return parsedLines.some(l => l.sectionType === 'song' || l.sectionType === 'story');
  }, [parsedLines]);

  // Group parsed lines into cohesive section containers (Song Container vs Prasang Container)
  const sections = useMemo(() => {
    if (!hasStructuredSections) {
      return [{
        type: 'normal',
        title: '',
        items: parsedLines
      }];
    }

    const list = [];
    let currentSec = null;

    parsedLines.forEach((item) => {
      const isNewSong = item.sectionType === 'song' && item.showSectionHeader;
      const isNewStory = item.sectionType === 'story' && item.showSectionHeader;
      const typeMismatch = currentSec && currentSec.type !== item.sectionType;

      if (!currentSec || isNewSong || isNewStory || typeMismatch) {
        currentSec = {
          type: item.sectionType, // 'song' | 'story' | 'normal'
          title: item.sectionTitle || (item.sectionType === 'song' ? 'विवाह गीत' : 'कथा-प्रसंग'),
          items: []
        };
        list.push(currentSec);
      }

      currentSec.items.push(item);
    });

    return list;
  }, [parsedLines, hasStructuredSections]);

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
              {t('गीतक बोल / Lyrics Theatre', 'Lyrics Theatre', 'गीतक बोल')}
            </h2>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {t('तुल्यकालिक बोल (Spotify-Style Synchronized Lyrics)', 'Spotify-Style Interactive Synchronized Lyrics', 'तुल्यकालिक गीतक बोल')}
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
              {t('मैथिली (मूल)', 'Maithili', 'मूल मैथिली बोल')}
            </button>
            <button
              onClick={() => setTab('hindi')}
              className={`lyrics-tab-btn ${tab === 'hindi' ? 'active' : ''}`}
            >
              {t('हिंदी अनुवाद', 'Hindi Translation', 'हिंदी अनुवाद')}
            </button>
            <button
              onClick={() => setTab('roman')}
              className={`lyrics-tab-btn ${tab === 'roman' ? 'active' : ''}`}
            >
              {t('English / Roman', 'English Lyrics', 'रोमन लिपि')}
            </button>
          </div>

          {/* Auto Scroll Lock Toggle */}
          <button
            onClick={() => setAutoScroll(prev => !prev)}
            title={autoScroll ? t('Auto-scroll चालू अछि (Click to lock)', 'Auto-scroll is ON (Click to lock)', 'स्वचालित स्क्रॉल चालू अछि') : t('Auto-scroll बंद अछि (Click to follow)', 'Auto-scroll is OFF (Click to follow)', 'स्वचालित स्क्रॉल बंद अछि')}
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
            <span>{autoScroll ? t('स्वचालित स्क्रॉल (Auto)', 'Auto-Scroll', 'स्वचालित स्क्रॉल') : t('हस्तचालित (Manual)', 'Manual', 'हस्तचालित')}</span>
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
              title={t('अक्षर आकार घटाउ', 'Decrease Font Size', 'अक्षर आकार घटाउ')}
              style={{ padding: '6px 10px', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              A-
            </button>
            <button
              onClick={resetFont}
              title={t('अक्षर आकार रीसेट करू', 'Reset Font Size', 'अक्षर आकार रीसेट करू')}
              style={{ padding: '6px 8px', color: 'var(--neon-saffron)', fontSize: '0.75rem', cursor: 'pointer' }}
            >
              {Math.round((fontSize / 1.2) * 100)}%
            </button>
            <button
              onClick={increaseFont}
              title={t('अक्षर आकार बढ़ाउ', 'Increase Font Size', 'अक्षर आकार बढ़ाउ')}
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
            <span>{copied ? t('कॉपी भेल!', 'Copied!', 'कॉपी भेल!') : t('कॉपी करू (Copy)', 'Copy Lyrics', 'कॉपी करू')}</span>
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
              {t('महाकवि विद्यापति पदावली भनिता (Classical Bhanita)', 'Mahakavi Vidyapati Padavali Bhanita', 'महाकवि विद्यापति पदावली भनिता')}
            </span>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {t('एहि पद मे महाकवि विद्यापति ठाकुरक पारम्परिक छाप (भनिता) समाहित अछि।', 'This composition contains the classical traditional signature (bhanita) of Mahakavi Vidyapati.', 'एहि पद मे महाकवि विद्यापति ठाकुरक पारम्परिक छाप (भनिता) समाहित अछि।')}
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
          border: '1px solid rgba(255, 255, 255, 0.04)',
          padding: '16px'
        }}
      >
        {sections.map((sec, secIdx) => {
          const isSongSec = sec.type === 'song';
          const isStorySec = sec.type === 'story';
          // Any section that is not narration prose is musical song lyrics (including all normal songs)
          const isSong = sec.type !== 'story';

          return (
            <div
              key={secIdx}
              style={{
                margin: hasStructuredSections ? '18px 0' : '0',
                padding: hasStructuredSections
                  ? (isSongSec ? '16px 18px' : (isStorySec ? '14px 18px' : '0'))
                  : '0',
                borderRadius: '16px',
                // Song container has the warm yellowish tint only when structured sections exist
                background: hasStructuredSections
                  ? (isSongSec
                      ? 'rgba(245, 158, 11, 0.05)'
                      : isStorySec
                      ? 'rgba(30, 41, 59, 0.28)'
                      : 'transparent')
                  : 'transparent',
                border: hasStructuredSections
                  ? (isSongSec
                      ? '1px solid rgba(245, 158, 11, 0.3)'
                      : isStorySec
                      ? '1px solid rgba(148, 163, 184, 0.16)'
                      : 'none')
                  : 'none',
                boxShadow: hasStructuredSections && isSongSec ? '0 4px 24px rgba(245, 158, 11, 0.04)' : 'none'
              }}
            >
              {/* Song Container Header (Only for multi-part songs like Ram Vivah) */}
              {hasStructuredSections && isSongSec && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: '12px',
                  marginBottom: '12px',
                  borderBottom: '1px solid rgba(245, 158, 11, 0.18)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '8px',
                      background: 'rgba(245, 158, 11, 0.18)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FBBF24'
                    }}>
                      <Music2 size={16} />
                    </div>
                    <div>
                      <span style={{
                        fontSize: '0.96rem',
                        fontWeight: 700,
                        color: '#FDE047',
                        letterSpacing: '0.01em',
                        display: 'block'
                      }}>
                        {sec.title.includes('गीत') ? sec.title : `विवाह गीत : ${sec.title}`}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                        पारंपरिक मैथिली सस्वर गायन
                      </span>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.72rem',
                    padding: '3px 10px',
                    borderRadius: '999px',
                    background: 'rgba(245, 158, 11, 0.18)',
                    color: '#FBBF24',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    fontWeight: 600
                  }}>
                    🎵 गीत
                  </span>
                </div>
              )}

              {/* Story / Prasang Container Header */}
              {hasStructuredSections && isStorySec && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: '10px',
                  marginBottom: '10px',
                  borderBottom: '1px solid rgba(148, 163, 184, 0.14)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '7px',
                      background: 'rgba(148, 163, 184, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94A3B8'
                    }}>
                      <BookOpen size={15} />
                    </div>
                    <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#E2E8F0' }}>
                      कथा-प्रसंग एवं संवाद (Narration)
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'rgba(148, 163, 184, 0.12)',
                    color: '#94A3B8',
                    border: '1px solid rgba(148, 163, 184, 0.25)',
                    fontWeight: 600
                  }}>
                    📖 प्रसंग
                  </span>
                </div>
              )}

              {/* Individual Rows: Neutral & Clean by default, GLOWS in signature yellow/saffron when played */}
              {sec.items.map((item) => {
                if (item.isHeaderOnly) return null;

                const isActive = item.idx === activeLineIdx;

                return (
                  <div
                    key={item.idx}
                    onClick={() => {
                      setActiveLineIdx(item.idx);
                      if (item.seconds !== null) {
                        seekTo(item.seconds);
                      } else if (duration > 0 && parsedLines.length > 0) {
                        const targetSeconds = (item.idx / parsedLines.length) * duration;
                        seekTo(targetSeconds);
                      }
                    }}
                    className={`karaoke-line ${isActive ? 'active-karaoke-line' : ''}`}
                    style={{
                      fontFamily: tab === 'devanagari' ? 'var(--font-devanagari)' : 'var(--font-sans)',
                      fontSize: `${fontSize}rem`,
                      cursor: 'pointer',
                      padding: hasStructuredSections ? '8px 12px' : '10px 16px',
                      marginBottom: hasStructuredSections ? '3px' : '6px',
                      borderRadius: '10px',
                      // Clean and neutral by default; signature golden-saffron glow when played
                      background: isActive
                        ? (isSong
                            ? 'linear-gradient(90deg, rgba(255, 140, 0, 0.2) 0%, rgba(255, 46, 99, 0.06) 100%)'
                            : 'linear-gradient(90deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.02) 100%)')
                        : 'transparent',
                      borderLeft: isActive
                        ? (isSong ? '3px solid #FF8C00' : '3px solid #94A3B8')
                        : '3px solid transparent',
                      borderTop: 'none',
                      borderRight: 'none',
                      borderBottom: 'none',
                      transition: 'all 0.22s ease',
                      boxShadow: isActive && isSong ? '0 0 20px rgba(255, 140, 0, 0.25)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        color: isActive
                          ? (isSong ? 'var(--neon-saffron)' : '#E2E8F0')
                          : (item.timestamp ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.2)'),
                        fontFamily: 'monospace',
                        width: item.timestamp ? '44px' : '24px',
                        fontWeight: isActive ? 700 : 500,
                        textShadow: isActive && isSong ? '0 0 10px rgba(255, 140, 0, 0.7)' : 'none',
                        flexShrink: 0
                      }}>
                        {item.timestamp || String(item.idx + 1).padStart(2, '0')}
                      </span>

                      <div style={{ flex: 1, lineHeight: 1.75 }}>
                        {item.speaker && (
                          <span style={{
                            fontSize: '0.76rem',
                            padding: '1px 7px',
                            borderRadius: '5px',
                            background: 'rgba(56, 189, 248, 0.15)',
                            color: '#38BDF8',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            fontWeight: 700,
                            marginRight: '8px',
                            display: 'inline-block'
                          }}>
                            {item.speaker}
                          </span>
                        )}

                        <span style={{
                          // Neutral readable text normally; GLOWS intensely in warm saffron/gold when played
                          color: isActive
                            ? '#FFFFFF'
                            : (isStorySec ? 'rgba(226, 232, 240, 0.82)' : 'rgba(255, 255, 255, 0.78)'),
                          fontWeight: isActive ? 700 : 500,
                          fontStyle: isStorySec ? 'italic' : 'normal',
                          textShadow: isActive
                            ? (isSong
                                ? '0 0 14px rgba(255, 140, 0, 0.85), 0 0 26px rgba(251, 191, 36, 0.6)'
                                : '0 0 12px rgba(226, 232, 240, 0.75)')
                            : 'none',
                          letterSpacing: isSong ? '0.01em' : 'normal'
                        }}>
                          {item.cleanText}
                        </span>
                      </div>

                      {isActive && isPlaying && (
                        <span style={{
                          fontSize: '0.72rem',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          background: isSong ? 'rgba(255, 140, 0, 0.25)' : 'rgba(255, 255, 255, 0.15)',
                          color: isSong ? '#FDE047' : '#FFFFFF',
                          border: isSong ? '1px solid rgba(255, 140, 0, 0.45)' : '1px solid rgba(255, 255, 255, 0.25)',
                          boxShadow: isSong ? '0 0 12px rgba(255, 140, 0, 0.4)' : 'none',
                          fontWeight: 700,
                          flexShrink: 0
                        }}>
                          LIVE
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
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
