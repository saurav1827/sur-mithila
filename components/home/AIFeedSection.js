'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, RefreshCw, ChevronLeft, ChevronRight, Gem, Flame, Heart, Music, Sun, Moon } from 'lucide-react';
import SongCard from '../SongCard';
import TranslatedText from '../TranslatedText';
import { getUserListeningProfile, markSongsSeen } from '../../lib/recent';

const MOODS = [
    { id: 'all', icon: Sparkles, mai: 'स्मार्ट मिक्स', en: 'Smart Mix' },
    { id: 'hidden_gems', icon: Gem, mai: 'अनसुने मोती', en: 'Hidden Gems', highlight: true },
    { id: 'bhakti', icon: Sun, mai: 'भक्ति व ध्यान', en: 'Devotional' },
    { id: 'romantic', icon: Heart, mai: 'मधुर प्रेम', en: 'Romantic' },
    { id: 'festive', icon: Flame, mai: 'उत्सव व सोहर', en: 'Celebration' },
    { id: 'soulful', icon: Moon, mai: 'विरह व गम्भीर', en: 'Soulful' },
];

export default function AIFeedSection() {
    const [songs, setSongs] = useState([]);
    const [activeMood, setActiveMood] = useState('all');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [excludedIds, setExcludedIds] = useState([]);
    const scrollerRef = useRef(null);
    const [edge, setEdge] = useState({ start: true, end: false });

    const updateScrollEdge = useCallback(() => {
        const el = scrollerRef.current;
        if (!el) return;
        setEdge({
            start: el.scrollLeft < 8,
            end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8,
        });
    }, []);

    const scroll = (dir) => {
        scrollerRef.current?.scrollBy({
            left: dir * (scrollerRef.current.clientWidth * 0.8),
            behavior: 'smooth',
        });
    };

    const fetchRecommendations = useCallback(async (mood = activeMood, fresh = false) => {
        try {
            if (fresh) setRefreshing(true);
            else setLoading(true);

            const profile = getUserListeningProfile();
            const payload = {
                history: profile.historyIds || [],
                favorites: profile.favoriteIds || [],
                seen: profile.seenIds || [],
                exclude: fresh ? excludedIds : [],
                mood,
                limit: 12,
            };

            const res = await fetch('/api/ai/recommendations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error('Failed to load recommendations');
            const data = await res.json();
            const newSongs = data.songs || [];

            setSongs(newSongs);

            // Record songs so fresh fetches will not repeat them
            const newSongIds = newSongs.map((s) => s.id).filter(Boolean);
            markSongsSeen(newSongIds);

            setExcludedIds((prev) => [...new Set([...prev, ...newSongIds])]);
        } catch (err) {
            console.error('[AIFeedSection] Failed to fetch:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [activeMood, excludedIds]);

    // Initial fetch on mount
    useEffect(() => {
        fetchRecommendations('all', false);
    }, []);

    const handleMoodChange = (moodId) => {
        if (moodId === activeMood && !loading) return;
        setActiveMood(moodId);
        fetchRecommendations(moodId, false);
    };

    const handleDiscoverNew = () => {
        if (refreshing || loading) return;
        fetchRecommendations(activeMood, true);
    };

    return (
        <section className="ai-feed-section" aria-label="AI Recommendations">
            <div className="ai-feed-header">
                <div className="ai-feed-title-block">
                    <div className="ai-pill-badge">
                        <Sparkles size={14} className="sparkle-icon-animated" />
                        <span>AI PERSONALIZED FEED</span>
                    </div>
                    <h2 className="ai-feed-title font-traditional">
                        <TranslatedText
                            maithili="अहाँ लेल विशेष AI अनुशंसा"
                            english="Curated by AI for You"
                        />
                    </h2>
                    <p className="ai-feed-subtitle font-traditional">
                        <TranslatedText
                            maithili="अहाँक श्रवण इतिहास, मनोदशा आ अनसुने सांस्कृतिक मोती पर आधारित"
                            english="Tailored to your listening taste, active mood & undiscovered gems"
                        />
                    </p>
                </div>

                <button
                    className={`ai-refresh-btn ${refreshing ? 'is-spinning' : ''}`}
                    onClick={handleDiscoverNew}
                    disabled={refreshing || loading}
                    title="Discover new unheard songs"
                    aria-label="Discover new songs"
                >
                    <RefreshCw size={15} />
                    <span>
                        <TranslatedText maithili="नव खोजू" english="Discover New" />
                    </span>
                </button>
            </div>

            {/* Mood / Needs Pills */}
            <div className="ai-mood-chips-scroller" role="tablist">
                {MOODS.map((m) => {
                    const Icon = m.icon;
                    const isActive = activeMood === m.id;
                    return (
                        <button
                            key={m.id}
                            role="tab"
                            aria-selected={isActive}
                            className={`ai-mood-chip ${isActive ? 'active' : ''} ${m.highlight ? 'is-gem' : ''}`}
                            onClick={() => handleMoodChange(m.id)}
                        >
                            <Icon size={14} />
                            <span>
                                <TranslatedText maithili={m.mai} english={m.en} />
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Song Carousel */}
            <div className="row-wrap" style={{ marginTop: '14px' }}>
                <button
                    className="row-arrow"
                    data-dir="prev"
                    disabled={edge.start}
                    onClick={() => scroll(-1)}
                    aria-label="Previous"
                >
                    <ChevronLeft size={20} />
                </button>

                <div
                    className="row-scroller ai-row-scroller"
                    ref={scrollerRef}
                    onScroll={updateScrollEdge}
                >
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="row-item" style={{ flex: '0 0 clamp(210px, 22vw, 260px)' }}>
                                <div className="sk" style={{ aspectRatio: '1.55', borderRadius: 12, marginBottom: 10 }} />
                                <div className="sk" style={{ height: 16, marginBottom: 8, width: '80%' }} />
                                <div className="sk" style={{ height: 12, width: '50%', marginBottom: 10 }} />
                                <div className="sk" style={{ height: 22, borderRadius: 6, width: '90%' }} />
                            </div>
                        ))
                    ) : songs.length > 0 ? (
                        songs.map((song) => (
                            <div className="row-item ai-song-item" key={song.id}>
                                <SongCard song={song} />
                            </div>
                        ))
                    ) : (
                        <div className="ai-empty-notice">
                            <TranslatedText
                                maithili="एहि मूड लेल नव गीत खोजी रहल छी। 'नव खोजू' बटन दबाउ।"
                                english="Looking for more songs in this mood. Tap 'Discover New'."
                            />
                        </div>
                    )}
                </div>

                <button
                    className="row-arrow"
                    data-dir="next"
                    disabled={edge.end}
                    onClick={() => scroll(1)}
                    aria-label="Next"
                >
                    <ChevronRight size={20} />
                </button>
            </div>
        </section>
    );
}
