'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { Play, Info } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import TranslatedText from '../TranslatedText';

// Auto-advances every 8s via the CSS progress animation's onAnimationEnd.
// Hover/focus pauses it; prefers-reduced-motion disables auto-advance entirely (see CSS).
export default function Spotlight({ songs }) {
    const [i, setI] = useState(0);
    const { playTrack } = usePlayer();
    const next = useCallback(() => setI((v) => (v + 1) % songs.length), [songs.length]);
    const s = songs[i];
    if (!s) return null;

    const title = s.title?.canonical || s.title?.devanagari || 'Maithili Geet';
    const art = s.poster?.image_url;

    return (
        <section className="spotlight" aria-roledescription="carousel" aria-label="Featured songs">
            <div className="spotlight-bg" style={{ backgroundImage: `url(${art})` }} />
            <div className="spotlight-scrim" />

            <div className="spotlight-inner" key={s.id} aria-live="polite">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 1, minWidth: 0 }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                        marginBottom: '4px'
                    }}>
                        <span className="spotlight-ai-badge">
                            ✨ <TranslatedText maithili="AI विशेष चयन" english="AI Spotlight Pick" />
                        </span>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: 'var(--text-secondary)',
                            fontSize: '0.92rem',
                            fontWeight: 500,
                            lineHeight: 1.4
                        }}>
                            <span style={{ color: 'var(--neon-saffron)', fontWeight: 600 }}>{s.category}</span>
                            {s.credits?.singer && (
                                <>
                                    <span style={{ opacity: 0.4 }}>/</span>
                                    <span>{s.credits?.singer}</span>
                                </>
                            )}
                        </div>
                    </div>

                    <h1 className="font-traditional spotlight-title" style={{
                        fontSize: 'clamp(1.7rem, 3.5vw, 2.8rem)',
                        fontWeight: 800,
                        lineHeight: 1.3,
                        color: '#F8FAFC',
                        textShadow: '0 2px 20px rgba(0, 0, 0, 0.7)',
                        margin: '0 0 6px 0',
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word'
                    }}>
                        {title}
                    </h1>

                    {(s.ai_reason || s.reason) && (
                        <p style={{
                            fontSize: '0.88rem',
                            color: 'var(--accent-gold-light)',
                            margin: '0 0 10px 0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            textShadow: '0 1px 8px rgba(0,0,0,0.8)'
                        }}>
                            <TranslatedText
                                maithili={s.ai_reason?.mai || s.reason}
                                english={s.ai_reason?.en || s.reason_en || s.reason}
                            />
                        </p>
                    )}

                    <div className="spotlight-actions" style={{ marginTop: '10px' }}>
                        <button className="btn-play" onClick={() => playTrack(s)}>
                            <Play size={18} fill="#070913" /> <TranslatedText maithili="सुनू" english="Play" />
                        </button>
                        <Link href={`/songs/${s.slug}`} className="btn-ghost">
                            <Info size={17} /> <TranslatedText maithili="बोल आ विवरण" english="Lyrics & details" />
                        </Link>
                    </div>
                </div>
                <img className="spotlight-art" src={art} alt="" />
            </div>

            <div className="spot-dots" role="tablist">
                {songs.map((x, idx) => (
                    <button key={x.id} role="tab" aria-selected={idx === i} aria-label={`Slide ${idx + 1}`}
                        className="spot-dot" onClick={() => setI(idx)} />
                ))}
            </div>
            <div key={`p-${i}`} className="spotlight-progress" onAnimationEnd={next} />
        </section>
    );
}