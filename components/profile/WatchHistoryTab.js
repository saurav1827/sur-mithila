'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
    Play, Clock, Trash2, Search, Mic, Info, Sparkles, Filter,
    CheckCircle, AlertCircle, Music, User, Tag, ArrowRight
} from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { useLanguage } from '../../context/LanguageContext';
import TranslatedText from '../TranslatedText';

// Utility for human-friendly relative time
function formatRelativeTime(isoString, lang = 'maithili') {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) {
        return lang === 'maithili' ? 'अखने (Just now)' : 'Just now';
    }
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
        return lang === 'maithili' ? `${diffMin} मिनट पहिने` : `${diffMin}m ago`;
    }
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) {
        return lang === 'maithili' ? `${diffHours} घंटा पहिने` : `${diffHours}h ago`;
    }
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) {
        return lang === 'maithili' ? 'काल्हि' : 'Yesterday';
    }
    if (diffDays < 7) {
        return lang === 'maithili' ? `${diffDays} दिन पहिने` : `${diffDays}d ago`;
    }
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Format clock time (e.g. 04:30 PM)
function formatClockTime(isoString) {
    if (!isoString) return '';
    try {
        return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
}

export default function WatchHistoryTab() {
    const { playTrack, currentTrack, isPlaying } = usePlayer();
    const { language, t } = useLanguage();

    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [deleteFeedback, setDeleteFeedback] = useState('');

    // Load history from localStorage and sync from server
    useEffect(() => {
        let localData = [];
        try {
            const raw = localStorage.getItem('sur_mithila_history');
            if (raw) localData = JSON.parse(raw);
        } catch { }

        setHistory(localData);
        setIsLoading(false);

        // Fetch server history if user is authenticated
        fetch('/api/history')
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data?.history && Array.isArray(data.history) && data.history.length > 0) {
                    // Merge local and server history deduplicated by ID
                    const map = new Map();
                    // Prioritize most recent
                    [...data.history, ...localData].forEach((item) => {
                        const id = item.id || item.slug;
                        if (id && !map.has(id)) {
                            map.set(id, item);
                        }
                    });
                    const merged = Array.from(map.values()).sort(
                        (a, b) => new Date(b.played_at || 0) - new Date(a.played_at || 0)
                    );
                    setHistory(merged);
                    try {
                        localStorage.setItem('sur_mithila_history', JSON.stringify(merged));
                    } catch { }
                }
            })
            .catch(() => { });
    }, []);

    // Filter categories dynamically from history
    const categories = useMemo(() => {
        const set = new Set();
        history.forEach((h) => {
            if (h.category) set.add(h.category);
        });
        return ['all', ...Array.from(set)];
    }, [history]);

    // Top artist & genre stats
    const stats = useMemo(() => {
        const artistCounts = {};
        const catCounts = {};
        history.forEach((h) => {
            const singer = h.singer;
            if (singer && singer !== 'पारंपरिक') {
                artistCounts[singer] = (artistCounts[singer] || 0) + 1;
            }
            if (h.category) {
                catCounts[h.category] = (catCounts[h.category] || 0) + 1;
            }
        });

        const topArtist = Object.entries(artistCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
        const topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

        return {
            total: history.length,
            topArtist,
            topCategory,
        };
    }, [history]);

    // Filtered history list
    const filteredHistory = useMemo(() => {
        return history.filter((item) => {
            const matchSearch =
                !searchQuery ||
                (item.title && item.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (item.singer && item.singer.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchCat =
                selectedCategory === 'all' || item.category === selectedCategory;

            return matchSearch && matchCat;
        });
    }, [history, searchQuery, selectedCategory]);

    // Group items by time period: Today, Yesterday, This Week, Older
    const groupedHistory = useMemo(() => {
        const groups = {
            today: [],
            yesterday: [],
            thisWeek: [],
            older: [],
        };

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const yesterdayStart = todayStart - 86400000;
        const weekStart = todayStart - 86400000 * 7;

        filteredHistory.forEach((item) => {
            const t = item.played_at ? new Date(item.played_at).getTime() : 0;
            if (t >= todayStart) {
                groups.today.push(item);
            } else if (t >= yesterdayStart) {
                groups.yesterday.push(item);
            } else if (t >= weekStart) {
                groups.thisWeek.push(item);
            } else {
                groups.older.push(item);
            }
        });

        return groups;
    }, [filteredHistory]);

    // Remove single song from history
    const handleRemoveItem = async (e, songId) => {
        e.preventDefault();
        e.stopPropagation();

        const updated = history.filter((x) => x.id !== songId && x.slug !== songId);
        setHistory(updated);
        try {
            localStorage.setItem('sur_mithila_history', JSON.stringify(updated));
        } catch { }

        // Sync with server
        fetch(`/api/history?songId=${encodeURIComponent(songId)}`, { method: 'DELETE' }).catch(() => { });

        setDeleteFeedback(t('इतिहास सँ हटाओल गेल', 'Removed from history'));
        setTimeout(() => setDeleteFeedback(''), 2500);
    };

    // Clear all history
    const handleClearAll = async () => {
        setHistory([]);
        try {
            localStorage.removeItem('sur_mithila_history');
        } catch { }

        fetch('/api/history?all=true', { method: 'DELETE' }).catch(() => { });

        setShowClearConfirm(false);
        setDeleteFeedback(t('संपूर्ण इतिहास साफ कएल गेल', 'All history cleared'));
        setTimeout(() => setDeleteFeedback(''), 2500);
    };

    const handlePlaySong = (item) => {
        playTrack({
            id: item.id,
            slug: item.slug,
            title: { canonical: item.title },
            category: item.category,
            poster: { image_url: item.poster },
            credits: { singer: item.singer },
            youtube: item.youtube || {},
            audio: item.audio || {},
        });
    };

    const lastWatched = history[0];

    return (
        <div className="watch-history-tab">
            {/* Header with Title and Clear Action */}
            <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
                marginBottom: '24px'
            }}>
                <div>
                    <h2 className="font-traditional" style={{ fontSize: '1.8rem', color: '#FAFAFA', marginBottom: '6px' }}>
                        <TranslatedText maithili="हमर श्रवण इतिहास" english="Watch & Listening History" />
                    </h2>
                    <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
                        <TranslatedText
                            maithili="अहाँक द्वारा हाल मे सुनल गेल गीत आ गतिविधि।"
                            english="All songs and videos you have recently played."
                        />
                    </p>
                </div>

                {history.length > 0 && (
                    <button
                        onClick={() => setShowClearConfirm(true)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            borderRadius: '8px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            color: '#F87171',
                            fontSize: '0.84rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <Trash2 size={14} />
                        <TranslatedText maithili="इतिहास साफ करू" english="Clear History" />
                    </button>
                )}
            </div>

            {/* Toast Feedback */}
            {deleteFeedback && (
                <div style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#34D399',
                    fontSize: '0.88rem',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <CheckCircle size={16} />
                    <span>{deleteFeedback}</span>
                </div>
            )}

            {/* Clear Confirm Modal */}
            {showClearConfirm && (
                <div style={{
                    padding: '18px 20px',
                    borderRadius: '12px',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    marginBottom: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FCA5A5', fontWeight: 600 }}>
                        <AlertCircle size={18} />
                        <TranslatedText
                            maithili="की अहाँ सच मे अपन संपूर्ण इतिहास मेटाबय चाहैत छी?"
                            english="Are you sure you want to clear your entire listening history?"
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={handleClearAll}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '6px',
                                background: '#EF4444',
                                color: '#FFF',
                                border: 'none',
                                fontWeight: 600,
                                fontSize: '0.85rem',
                                cursor: 'pointer'
                            }}
                        >
                            <TranslatedText maithili="हँ, साफ करू" english="Yes, Clear All" />
                        </button>
                        <button
                            onClick={() => setShowClearConfirm(false)}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '6px',
                                background: 'rgba(255, 255, 255, 0.1)',
                                color: '#FAFAFA',
                                border: 'none',
                                fontSize: '0.85rem',
                                cursor: 'pointer'
                            }}
                        >
                            <TranslatedText maithili="रद्द करू" english="Cancel" />
                        </button>
                    </div>
                </div>
            )}

            {/* HERO: Last Played Song Card */}
            {lastWatched && (
                <div style={{
                    position: 'relative',
                    padding: '24px',
                    borderRadius: '18px',
                    marginBottom: '28px',
                    background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.14) 0%, rgba(20, 20, 20, 0.8) 100%)',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    gap: '20px',
                    alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', minWidth: 0 }}>
                        <div style={{ position: 'relative', width: '90px', height: '90px', flexShrink: 0, borderRadius: '12px', overflow: 'hidden', border: '2px solid rgba(234, 179, 8, 0.5)' }}>
                            <img
                                src={lastWatched.poster || '/placeholder.jpg'}
                                alt={lastWatched.title}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <button
                                onClick={() => handlePlaySong(lastWatched)}
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'rgba(0,0,0,0.45)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: 'none',
                                    cursor: 'pointer'
                                }}
                                title="Play"
                            >
                                <Play size={26} fill="#EAB308" color="#EAB308" />
                            </button>
                        </div>

                        <div style={{ minWidth: 0 }}>
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '3px 9px',
                                borderRadius: '999px',
                                background: 'rgba(234, 179, 8, 0.15)',
                                border: '1px solid rgba(234, 179, 8, 0.35)',
                                color: 'var(--accent-gold-light)',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                marginBottom: '6px'
                            }}>
                                <Clock size={11} />
                                <span>
                                    <TranslatedText maithili="अखनहुक सुनल गीत" english="LAST PLAYED VIDEO" />
                                </span>
                                <span>•</span>
                                <span>{formatRelativeTime(lastWatched.played_at, language)}</span>
                            </div>

                            <Link
                                href={`/songs/${lastWatched.slug}`}
                                className="font-traditional"
                                style={{
                                    fontSize: 'clamp(1.15rem, 2vw, 1.4rem)',
                                    fontWeight: 700,
                                    color: '#FAFAFA',
                                    display: 'block',
                                    lineHeight: 1.25,
                                    marginBottom: '4px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {lastWatched.title}
                            </Link>

                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>{lastWatched.singer}</span>
                                {lastWatched.category && (
                                    <>
                                        <span style={{ opacity: 0.4 }}>•</span>
                                        <span style={{ color: 'var(--accent-gold)' }}>{lastWatched.category}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                            className="btn-play"
                            onClick={() => handlePlaySong(lastWatched)}
                            style={{ padding: '10px 20px', fontSize: '0.88rem' }}
                        >
                            <Play size={15} fill="#070913" />
                            <TranslatedText maithili="फेरसँ सुनू" english="Resume Play" />
                        </button>
                        <Link
                            href={`/songs/${lastWatched.slug}`}
                            className="btn-ghost"
                            style={{ padding: '10px 16px', fontSize: '0.84rem' }}
                        >
                            <Info size={15} />
                            <TranslatedText maithili="विवरण" english="Details" />
                        </Link>
                    </div>
                </div>
            )}

            {/* Analytics Stats Bar */}
            {history.length > 0 && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '12px',
                    marginBottom: '28px'
                }}>
                    <div style={{ padding: '14px 18px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '4px' }}>
                            <Music size={14} color="#EAB308" />
                            <TranslatedText maithili="कुल सुनल गीत" english="Total Songs Played" />
                        </div>
                        <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#FAFAFA' }}>{stats.total}</div>
                    </div>

                    <div style={{ padding: '14px 18px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '4px' }}>
                            <User size={14} color="#06B6D4" />
                            <TranslatedText maithili="सर्वाधिक सुनल गायक" english="Top Listened Singer" />
                        </div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#FAFAFA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {stats.topArtist}
                        </div>
                    </div>

                    <div style={{ padding: '14px 18px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '4px' }}>
                            <Tag size={14} color="#10B981" />
                            <TranslatedText maithili="पसंदीदा श्रेणी" english="Top Category" />
                        </div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#FAFAFA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {stats.topCategory}
                        </div>
                    </div>
                </div>
            )}

            {/* Search and Category Filters */}
            {history.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('इतिहास मे खोजू (गीत वा गायक)...', 'Search history by song or singer...')}
                            style={{
                                width: '100%',
                                padding: '10px 14px 10px 40px',
                                borderRadius: '10px',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                color: '#FAFAFA',
                                fontSize: '0.88rem'
                            }}
                        />
                    </div>

                    {categories.length > 2 && (
                        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '4px' }}>
                            {categories.map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    style={{
                                        padding: '6px 14px',
                                        borderRadius: '999px',
                                        fontSize: '0.8rem',
                                        fontWeight: selectedCategory === cat ? 600 : 400,
                                        background: selectedCategory === cat ? 'rgba(234, 179, 8, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                                        border: '1px solid',
                                        borderColor: selectedCategory === cat ? 'rgba(234, 179, 8, 0.4)' : 'rgba(255, 255, 255, 0.08)',
                                        color: selectedCategory === cat ? 'var(--accent-gold-light)' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {cat === 'all' ? t('सभ', 'All') : cat}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Grouped Chronological List */}
            {isLoading ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <TranslatedText maithili="इतिहास लोड भ रहल अछि..." english="Loading watch history..." />
                </div>
            ) : filteredHistory.length === 0 ? (
                <div style={{
                    padding: '60px 24px',
                    borderRadius: '16px',
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px dashed rgba(255,255,255,0.1)',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '16px'
                }}>
                    <Clock size={44} color="var(--text-muted)" style={{ opacity: 0.4 }} />
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '380px' }}>
                        {searchQuery || selectedCategory !== 'all' ? (
                            <TranslatedText
                                maithili="कोनो परिणाम नहि भेटल। फिल्टर बदलि कए देखू।"
                                english="No matching songs found in your history. Try adjusting filters."
                            />
                        ) : (
                            <TranslatedText
                                maithili="अहाँ अखन धरि कोनो गीत नहि सुनलहुँ अछि। गृह पृष्ठ सं अपन पसंदीदा गीत सुनू!"
                                english="You haven't played any songs yet. Start exploring from the home page!"
                            />
                        )}
                    </p>
                    <Link
                        href="/"
                        className="btn-play"
                        style={{ padding: '10px 22px', fontSize: '0.9rem', marginTop: '4px' }}
                    >
                        <TranslatedText maithili="गीत संग्रह देखू" english="Explore Songs" />
                        <ArrowRight size={15} />
                    </Link>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                    {[
                        { key: 'today', mai: 'आइज (Today)', en: 'Today', list: groupedHistory.today },
                        { key: 'yesterday', mai: 'काल्हि (Yesterday)', en: 'Yesterday', list: groupedHistory.yesterday },
                        { key: 'thisWeek', mai: 'एहि सप्ताह (This Week)', en: 'This Week', list: groupedHistory.thisWeek },
                        { key: 'older', mai: 'पहिलुका (Older)', en: 'Older', list: groupedHistory.older },
                    ].map((group) => {
                        if (!group.list || group.list.length === 0) return null;
                        return (
                            <div key={group.key}>
                                <div style={{
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    color: 'var(--accent-gold-light)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    marginBottom: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <Clock size={13} />
                                    <span>{t(group.mai, group.en)}</span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 500 }}>
                                        ({group.list.length})
                                    </span>
                                </div>

                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    background: 'rgba(255, 255, 255, 0.015)',
                                    borderRadius: '14px',
                                    padding: '8px',
                                    border: '1px solid rgba(255, 255, 255, 0.04)'
                                }}>
                                    {group.list.map((item) => {
                                        const isThisPlaying =
                                            currentTrack?.song?.slug === item.slug && isPlaying;
                                        return (
                                            <div
                                                key={item.id + (item.played_at || '')}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '14px',
                                                    padding: '10px 12px',
                                                    borderRadius: '10px',
                                                    background: isThisPlaying
                                                        ? 'rgba(234, 179, 8, 0.12)'
                                                        : 'rgba(255, 255, 255, 0.02)',
                                                    border: '1px solid',
                                                    borderColor: isThisPlaying
                                                        ? 'rgba(234, 179, 8, 0.3)'
                                                        : 'transparent',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                {/* Thumbnail with direct Play button */}
                                                <div style={{
                                                    position: 'relative',
                                                    width: '52px',
                                                    height: '52px',
                                                    borderRadius: '8px',
                                                    overflow: 'hidden',
                                                    flexShrink: 0,
                                                    background: '#111'
                                                }}>
                                                    <img
                                                        src={item.poster || '/placeholder.jpg'}
                                                        alt={item.title}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    />
                                                    <button
                                                        onClick={() => handlePlaySong(item)}
                                                        style={{
                                                            position: 'absolute',
                                                            inset: 0,
                                                            background: 'rgba(0,0,0,0.4)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            border: 'none',
                                                            cursor: 'pointer'
                                                        }}
                                                        title="Play"
                                                    >
                                                        <Play
                                                            size={18}
                                                            fill={isThisPlaying ? '#EAB308' : '#FAFAFA'}
                                                            color={isThisPlaying ? '#EAB308' : '#FAFAFA'}
                                                        />
                                                    </button>
                                                </div>

                                                {/* Title, Singer, Category */}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <Link
                                                        href={`/songs/${item.slug}`}
                                                        style={{
                                                            fontSize: '0.96rem',
                                                            fontWeight: 600,
                                                            color: '#FAFAFA',
                                                            display: 'block',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            marginBottom: '2px'
                                                        }}
                                                    >
                                                        {item.title}
                                                    </Link>

                                                    <div style={{
                                                        fontSize: '0.8rem',
                                                        color: 'var(--text-secondary)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        flexWrap: 'wrap'
                                                    }}>
                                                        <span>{item.singer}</span>
                                                        {item.category && (
                                                            <>
                                                                <span style={{ opacity: 0.4 }}>•</span>
                                                                <span style={{
                                                                    color: 'var(--accent-gold-light)',
                                                                    fontSize: '0.74rem',
                                                                    padding: '1px 6px',
                                                                    borderRadius: '4px',
                                                                    background: 'rgba(234, 179, 8, 0.08)'
                                                                }}>
                                                                    {item.category}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Timestamp & Actions */}
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    flexShrink: 0
                                                }}>
                                                    <span style={{
                                                        fontSize: '0.78rem',
                                                        color: 'var(--text-muted)',
                                                        minWidth: '60px',
                                                        textAlign: 'right'
                                                    }}>
                                                        {formatClockTime(item.played_at)}
                                                    </span>

                                                    {/* Sing in studio CTA */}
                                                    <Link
                                                        href={`/studio/${item.slug}`}
                                                        title={t('स्टुडियो मे गाउ', 'Sing in Studio')}
                                                        style={{
                                                            padding: '6px',
                                                            borderRadius: '6px',
                                                            background: 'rgba(255, 140, 0, 0.1)',
                                                            color: 'var(--neon-saffron)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                    >
                                                        <Mic size={14} />
                                                    </Link>

                                                    {/* Remove single item button */}
                                                    <button
                                                        onClick={(e) => handleRemoveItem(e, item.id || item.slug)}
                                                        title={t('हटाउ', 'Remove from history')}
                                                        style={{
                                                            padding: '6px',
                                                            borderRadius: '6px',
                                                            background: 'transparent',
                                                            border: 'none',
                                                            color: 'var(--text-muted)',
                                                            cursor: 'pointer',
                                                            transition: 'color 0.15s ease'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.color = '#EF4444'}
                                                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
