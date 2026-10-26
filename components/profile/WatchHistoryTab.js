'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
    Play, Clock, Trash2, Search, Mic, Info, Sparkles, Filter,
    CheckCircle, AlertCircle, Music, User, Tag, ArrowRight,
    ChevronLeft, ChevronRight
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

    const isEng = lang === 'english';
    const isPure = lang === 'maithili_plus';

    if (diffSec < 60) {
        if (isEng) return 'Just now';
        if (isPure) return 'अखने';
        return 'अखने (Just now)';
    }
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
        return isEng ? `${diffMin}m ago` : `${diffMin} मिनट पहिने`;
    }
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) {
        return isEng ? `${diffHours}h ago` : `${diffHours} घंटा पहिने`;
    }
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) {
        return isEng ? 'Yesterday' : 'काल्हि';
    }
    if (diffDays < 7) {
        return isEng ? `${diffDays}d ago` : `${diffDays} दिन पहिने`;
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
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedCategory]);

    // Load history from localStorage and sync from server
    useEffect(() => {
        let localData = [];
        try {
            const raw = localStorage.getItem('sur_mithila_history');
            if (raw) localData = JSON.parse(raw);
        } catch { }

        setHistory(localData);
        setIsLoading(false);

        // Fetch server history if user is authenticated, passing local IDs to validate privacy
        const localIds = localData.map((i) => i.id).filter(Boolean);
        const queryParam = localIds.length ? `?localIds=${encodeURIComponent(localIds.slice(0, 100).join(','))}` : '';

        fetch(`/api/history${queryParam}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data && Array.isArray(data.history)) {
                    // Filter out only explicitly disallowed private IDs
                    const disallowedSet = new Set(data.disallowedIds || []);
                    const sanitizedLocal = localData.filter((item) => {
                        const id = item.id;
                        const cleanRec = id ? String(id).replace(/^cover-/, '') : '';
                        return !disallowedSet.has(id) && !disallowedSet.has(cleanRec) && !disallowedSet.has(`cover-${cleanRec}`);
                    });

                    const map = new Map();
                    [...data.history, ...sanitizedLocal].forEach((item) => {
                        const id = item.id || item.slug;
                        const cleanRec = id ? String(id).replace(/^cover-/, '') : '';
                        if (disallowedSet.has(id) || disallowedSet.has(cleanRec) || disallowedSet.has(`cover-${cleanRec}`)) {
                            return;
                        }
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

                    // Broadcast unified total count to keep profile header & badges in sync
                    window.dispatchEvent(new CustomEvent('sur_mithila_history_updated', {
                        detail: { totalCount: merged.length, history: merged }
                    }));

                    // Sync any local items missing on server
                    const serverIds = new Set((data.history || []).map((i) => i.id));
                    const unsyncedItems = merged.filter((i) => !serverIds.has(i.id));
                    if (unsyncedItems.length > 0) {
                        fetch('/api/history', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ songs: unsyncedItems })
                        }).catch(() => {});
                    }
                }
            })
            .catch(() => { });

        // Listen for real-time history updates from PostPlayer, VersionsStrip, PlayerContext, etc.
        const handleHistoryUpdated = (e) => {
            if (e.detail?.clearedAll) {
                setHistory([]);
                return;
            }
            if (e.detail?.removed && e.detail?.id) {
                setHistory((prev) => {
                    const filtered = prev.filter((i) => i.id !== e.detail.id && i.id !== `cover-${e.detail.id}`);
                    try {
                        localStorage.setItem('sur_mithila_history', JSON.stringify(filtered));
                    } catch {}
                    return filtered;
                });
                return;
            }
            try {
                const raw = localStorage.getItem('sur_mithila_history');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    setHistory(parsed);
                } else if (e.detail && !e.detail.totalCount) {
                    setHistory((prev) => [e.detail, ...prev.filter((i) => i.id !== e.detail.id)]);
                }
            } catch {}
        };
        window.addEventListener('sur_mithila_history_updated', handleHistoryUpdated);
        return () => window.removeEventListener('sur_mithila_history_updated', handleHistoryUpdated);
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

    // Pagination calculations
    const totalPages = Math.max(1, Math.ceil(filteredHistory.length / ITEMS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
    const paginatedHistory = useMemo(() => {
        return filteredHistory.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredHistory, startIndex]);

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

        paginatedHistory.forEach((item) => {
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
    }, [paginatedHistory]);

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

        // Dispatch updated count
        window.dispatchEvent(new CustomEvent('sur_mithila_history_updated', {
            detail: { id: songId, removed: true, totalCount: updated.length }
        }));

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

        // Dispatch cleared all event
        window.dispatchEvent(new CustomEvent('sur_mithila_history_updated', {
            detail: { clearedAll: true, totalCount: 0 }
        }));

        setShowClearConfirm(false);
        setDeleteFeedback(t('संपूर्ण इतिहास साफ कएल गेल', 'All history cleared'));
        setTimeout(() => setDeleteFeedback(''), 2500);
    };

    const handlePlaySong = (item) => {
        const isCoverItem =
            (item.id && (String(item.id).startsWith('cover-') || String(item.id).startsWith('rec_'))) ||
            item.audio?.hosted_audio_url?.includes('sur_mithila_covers') ||
            (typeof item.title === 'string' && item.title.includes('(Cover)'));

        playTrack(
            {
                id: item.id,
                slug: item.slug,
                title: { canonical: item.title },
                category: item.category,
                poster: { image_url: item.poster },
                credits: { singer: item.singer },
                youtube: isCoverItem ? {} : (item.youtube || {}),
                audio: item.audio || {},
            },
            isCoverItem ? {
                audio: item.audio,
                recording_id: String(item.id).replace(/^cover-/, ''),
                artist_name: item.singer,
                poster: { image_url: item.poster },
                youtube: {},
            } : null
        );
    };

    const lastWatched = history[0];

    return (
        <div className="watch-history-tab">
            <style>{`
                .watch-history-tab {
                    width: 100%;
                }
                .history-header {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 14px;
                    margin-bottom: 20px;
                }
                .history-title {
                    font-size: clamp(1.4rem, 3vw, 1.8rem);
                    color: #FAFAFA;
                    margin-bottom: 4px;
                    font-weight: 800;
                }
                .history-subtitle {
                    font-size: 0.86rem;
                    color: var(--text-secondary);
                    line-height: 1.4;
                    margin: 0;
                }
                .history-clear-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 7px 12px;
                    border-radius: 8px;
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.25);
                    color: #F87171;
                    font-size: 0.8rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    flex-shrink: 0;
                }
                .history-hero-card {
                    position: relative;
                    padding: 20px 22px;
                    border-radius: 16px;
                    margin-bottom: 22px;
                    background: linear-gradient(135deg, rgba(234, 179, 8, 0.14) 0%, rgba(20, 20, 20, 0.85) 100%);
                    border: 1px solid rgba(234, 179, 8, 0.3);
                    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 16px;
                    flex-wrap: wrap;
                }
                .history-hero-content {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    min-width: 0;
                    flex: 1 1 300px;
                }
                .history-hero-art {
                    position: relative;
                    width: 68px;
                    height: 68px;
                    flex-shrink: 0;
                    border-radius: 12px;
                    overflow: hidden;
                    border: 2px solid rgba(234, 179, 8, 0.5);
                    background: #111;
                }
                .history-hero-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 2px 8px;
                    border-radius: 999px;
                    background: rgba(234, 179, 8, 0.15);
                    border: 1px solid rgba(234, 179, 8, 0.35);
                    color: var(--accent-gold-light);
                    font-size: 0.7rem;
                    font-weight: 700;
                    margin-bottom: 5px;
                    white-space: nowrap;
                }
                .history-hero-title {
                    font-size: clamp(1.05rem, 2.5vw, 1.3rem);
                    font-weight: 700;
                    color: #FAFAFA;
                    display: block;
                    line-height: 1.25;
                    margin-bottom: 3px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    text-decoration: none;
                }
                .history-hero-meta {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .history-hero-actions {
                    display: flex;
                    gap: 10px;
                    flex-shrink: 0;
                    align-items: center;
                }

                /* 3 Quick Analytics Stat Cards */
                .history-stats-bar {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 10px;
                    margin-bottom: 22px;
                }
                .history-stat-box {
                    padding: 12px 14px;
                    border-radius: 12px;
                    background: rgba(255, 255, 255, 0.025);
                    border: 1px solid rgba(255, 255, 255, 0.06);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    min-width: 0;
                }
                .history-stat-label {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    color: var(--text-muted);
                    font-size: 0.74rem;
                    margin-bottom: 4px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .history-stat-value {
                    font-size: 1.25rem;
                    font-weight: 800;
                    color: #FAFAFA;
                    line-height: 1.2;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                /* Search & Categories */
                .history-search-bar {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    margin-bottom: 22px;
                }
                .history-search-input-wrap {
                    position: relative;
                    width: 100%;
                    max-width: 440px;
                }
                .history-search-input {
                    width: 100%;
                    padding: 9px 12px 9px 38px;
                    border-radius: 10px;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    color: #FAFAFA;
                    font-size: 0.84rem;
                    box-sizing: border-box;
                }
                .history-search-input:focus {
                    outline: none;
                    border-color: #EAB308;
                }
                .history-category-pills {
                    display: flex;
                    gap: 6px;
                    overflow-x: auto;
                    scrollbar-width: none;
                    padding-bottom: 2px;
                    -webkit-overflow-scrolling: touch;
                }
                .history-category-pills::-webkit-scrollbar { display: none; }
                .history-category-pill {
                    padding: 5px 12px;
                    border-radius: 999px;
                    font-size: 0.75rem;
                    white-space: nowrap;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }

                /* Group Headers & Track Rows */
                .history-group-header {
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: var(--accent-gold-light);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 10px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .history-group-card {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    background: rgba(255, 255, 255, 0.015);
                    border-radius: 14px;
                    padding: 6px;
                    border: 1px solid rgba(255, 255, 255, 0.04);
                }
                .history-track-row {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 9px 12px;
                    border-radius: 10px;
                    background: rgba(255, 255, 255, 0.02);
                    border: 1px solid transparent;
                    transition: all 0.15s ease;
                }
                .history-track-row:hover {
                    background: rgba(255, 255, 255, 0.04);
                }
                .history-track-row.playing {
                    background: rgba(234, 179, 8, 0.12);
                    border-color: rgba(234, 179, 8, 0.35);
                }
                .history-track-art {
                    position: relative;
                    width: 48px;
                    height: 48px;
                    border-radius: 8px;
                    overflow: hidden;
                    flex-shrink: 0;
                    background: #111;
                }
                .history-track-info {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .history-track-title {
                    font-size: 0.92rem;
                    font-weight: 600;
                    color: #FAFAFA;
                    display: block;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    text-decoration: none;
                    line-height: 1.25;
                }
                .history-track-title:hover {
                    color: var(--accent-gold-light);
                }
                .history-track-meta {
                    font-size: 0.76rem;
                    color: var(--text-secondary);
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .history-track-singer {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .history-track-cat {
                    color: var(--accent-gold-light);
                    font-size: 0.7rem;
                    padding: 1px 6px;
                    border-radius: 4px;
                    background: rgba(234, 179, 8, 0.08);
                    white-space: nowrap;
                    flex-shrink: 0;
                }
                .meta-dot {
                    opacity: 0.35;
                    flex-shrink: 0;
                }
                .history-track-actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-shrink: 0;
                }
                .history-action-btn {
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: none;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .history-action-btn.studio {
                    background: rgba(255, 140, 0, 0.12);
                    color: var(--neon-saffron);
                }
                .history-action-btn.studio:hover {
                    background: rgba(255, 140, 0, 0.22);
                }
                .history-action-btn.trash {
                    background: transparent;
                    color: var(--text-muted);
                }
                .history-action-btn.trash:hover {
                    color: #EF4444;
                    background: rgba(239, 68, 68, 0.12);
                }
                .mobile-inline-clock {
                    display: none;
                }
                .desktop-clock {
                    display: inline-block;
                    font-size: 0.76rem;
                    color: var(--text-muted);
                    min-width: 55px;
                    text-align: right;
                }

                /* Pagination */
                .history-pagination {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 14px;
                    margin-top: 22px;
                    padding: 14px 18px;
                    border-radius: 14px;
                    background: rgba(255, 255, 255, 0.02);
                    border: 1px solid rgba(255, 255, 255, 0.06);
                }
                .history-pagination-info {
                    font-size: 0.84rem;
                    color: var(--text-secondary);
                }
                .history-pagination-btns {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                /* Mobile Media Queries (< 640px) */
                @media (max-width: 640px) {
                    .history-header {
                        margin-bottom: 16px;
                        gap: 10px;
                    }
                    .history-subtitle {
                        font-size: 0.78rem;
                    }
                    .history-clear-btn {
                        padding: 5px 10px;
                        font-size: 0.74rem;
                    }
                    .history-hero-card {
                        flex-direction: column;
                        align-items: stretch;
                        padding: 14px;
                        gap: 12px;
                        border-radius: 14px;
                        margin-bottom: 16px;
                    }
                    .history-hero-content {
                        align-items: center;
                        gap: 12px;
                        flex: 1 1 auto;
                    }
                    .history-hero-art {
                        width: 56px;
                        height: 56px;
                        border-radius: 10px;
                    }
                    .history-hero-actions {
                        width: 100%;
                        display: flex;
                        gap: 8px;
                    }
                    .history-hero-actions > * {
                        flex: 1;
                        justify-content: center;
                        text-align: center;
                        padding: 8px 12px !important;
                        font-size: 0.8rem !important;
                        border-radius: 9px !important;
                    }
                    .history-stats-bar {
                        gap: 6px;
                        margin-bottom: 16px;
                    }
                    .history-stat-box {
                        padding: 8px 6px;
                        border-radius: 10px;
                        text-align: center;
                        align-items: center;
                    }
                    .history-stat-label {
                        font-size: 0.64rem;
                        gap: 3px;
                        margin-bottom: 2px;
                        justify-content: center;
                    }
                    .history-stat-value {
                        font-size: 0.92rem;
                        text-align: center;
                    }
                    .history-track-row {
                        gap: 10px;
                        padding: 8px 10px;
                        border-radius: 9px;
                    }
                    .history-track-art {
                        width: 42px;
                        height: 42px;
                        border-radius: 7px;
                    }
                    .history-track-title {
                        font-size: 0.86rem;
                        display: -webkit-box;
                        -webkit-line-clamp: 2;
                        -webkit-box-orient: vertical;
                        overflow: hidden;
                        white-space: normal;
                        line-height: 1.25;
                        word-break: break-word;
                    }
                    .history-track-meta {
                        font-size: 0.72rem;
                        gap: 4px;
                    }
                    .history-track-singer {
                        max-width: 110px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                    .history-track-cat {
                        font-size: 0.66rem;
                        padding: 1px 4px;
                    }
                    .mobile-inline-clock {
                        display: inline-block;
                        font-size: 0.7rem;
                        color: var(--text-muted);
                    }
                    .desktop-clock {
                        display: none !important;
                    }
                    .history-action-btn {
                        width: 28px;
                        height: 28px;
                        border-radius: 6px;
                    }
                    .history-track-actions {
                        gap: 4px;
                    }
                    .history-pagination {
                        flex-direction: column;
                        align-items: center;
                        text-align: center;
                        padding: 12px;
                        gap: 10px;
                    }
                    .history-pagination-info {
                        font-size: 0.78rem;
                        text-align: center;
                        width: 100%;
                    }
                    .history-pagination-btns {
                        width: 100%;
                        justify-content: center;
                        flex-wrap: wrap;
                        gap: 4px;
                    }
                    @media (max-width: 480px) {
                        .pagination-btn-text {
                            display: none !important;
                        }
                    }
                }
            `}</style>

            {/* Header with Title and Clear Action */}
            <div className="history-header">
                <div>
                    <h2 className="history-title font-traditional">
                        <TranslatedText maithili="हमर श्रवण इतिहास" english="Watch & Listening History" />
                    </h2>
                    <p className="history-subtitle">
                        <TranslatedText
                            maithili="अहाँक द्वारा हाल मे सुनल गेल गीत आ गतिविधि।"
                            english="All songs and videos you have recently played."
                        />
                    </p>
                </div>

                {history.length > 0 && (
                    <button
                        onClick={() => setShowClearConfirm(true)}
                        className="history-clear-btn"
                    >
                        <Trash2 size={13} />
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
                    fontSize: '0.86rem',
                    marginBottom: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <CheckCircle size={15} />
                    <span>{deleteFeedback}</span>
                </div>
            )}

            {/* Clear Confirm Modal */}
            {showClearConfirm && (
                <div style={{
                    padding: '16px 18px',
                    borderRadius: '12px',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    marginBottom: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FCA5A5', fontWeight: 600, fontSize: '0.88rem' }}>
                        <AlertCircle size={17} />
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
                                fontSize: '0.82rem',
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
                                fontSize: '0.82rem',
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
                <div className="history-hero-card">
                    <div className="history-hero-content">
                        <div className="history-hero-art">
                            <img
                                src={lastWatched.poster || '/placeholder.jpg'}
                                alt={lastWatched.title}
                                onError={(e) => { e.currentTarget.src = '/placeholder.jpg'; }}
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
                                <Play size={22} fill="#EAB308" color="#EAB308" />
                            </button>
                        </div>

                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="history-hero-badge">
                                <Clock size={11} />
                                <span>
                                    <TranslatedText maithili="अखनहुक सुनल गीत" english="Recently Played Song" />
                                </span>
                                <span>•</span>
                                <span>{formatRelativeTime(lastWatched.played_at, language)}</span>
                            </div>

                            <Link
                                href={`/songs/${lastWatched.slug}`}
                                className="history-hero-title font-traditional"
                            >
                                {lastWatched.title}
                            </Link>

                            <div className="history-hero-meta">
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lastWatched.singer}</span>
                                {lastWatched.category && (
                                    <>
                                        <span className="meta-dot">•</span>
                                        <span style={{ color: 'var(--accent-gold)', flexShrink: 0 }}>{lastWatched.category}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="history-hero-actions">
                        <button
                            className="btn-play"
                            onClick={() => handlePlaySong(lastWatched)}
                            style={{ padding: '8px 16px', fontSize: '0.84rem', whiteSpace: 'nowrap' }}
                        >
                            <Play size={14} fill="#070913" />
                            <TranslatedText maithili="फेरसँ सुनू" english="Resume Play" />
                        </button>
                        <Link
                            href={`/songs/${lastWatched.slug}`}
                            className="btn-ghost"
                            style={{ padding: '8px 14px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                        >
                            <Info size={14} />
                            <TranslatedText maithili="विवरण" english="Details" />
                        </Link>
                    </div>
                </div>
            )}

            {/* Quick Analytics Stats Bar - 3 Columns Always */}
            {history.length > 0 && (
                <div className="history-stats-bar">
                    <div className="history-stat-box">
                        <div className="history-stat-label">
                            <Music size={13} color="#EAB308" />
                            <span><TranslatedText maithili="कुल गीत" english="Total" /></span>
                        </div>
                        <div className="history-stat-value">{stats.total}</div>
                    </div>

                    <div className="history-stat-box">
                        <div className="history-stat-label">
                            <User size={13} color="#06B6D4" />
                            <span><TranslatedText maithili="शीर्ष गायक" english="Top Singer" /></span>
                        </div>
                        <div className="history-stat-value" style={{ fontSize: 'clamp(0.82rem, 1.8vw, 1.05rem)' }}>
                            {stats.topArtist}
                        </div>
                    </div>

                    <div className="history-stat-box">
                        <div className="history-stat-label">
                            <Tag size={13} color="#10B981" />
                            <span><TranslatedText maithili="श्रेणी" english="Category" /></span>
                        </div>
                        <div className="history-stat-value" style={{ fontSize: 'clamp(0.82rem, 1.8vw, 1.05rem)' }}>
                            {stats.topCategory}
                        </div>
                    </div>
                </div>
            )}

            {/* Search and Category Filters */}
            {history.length > 0 && (
                <div className="history-search-bar">
                    <div className="history-search-input-wrap">
                        <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('इतिहास मे खोजू (गीत वा गायक)...', 'Search history by song or singer...')}
                            className="history-search-input"
                        />
                    </div>

                    {categories.length > 2 && (
                        <div className="history-category-pills">
                            {categories.map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className="history-category-pill"
                                    style={{
                                        fontWeight: selectedCategory === cat ? 600 : 400,
                                        background: selectedCategory === cat ? 'rgba(234, 179, 8, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                                        border: '1px solid',
                                        borderColor: selectedCategory === cat ? 'rgba(234, 179, 8, 0.4)' : 'rgba(255, 255, 255, 0.08)',
                                        color: selectedCategory === cat ? 'var(--accent-gold-light)' : 'var(--text-secondary)',
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
                <div style={{ padding: '36px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    <TranslatedText maithili="इतिहास लोड भ रहल अछि..." english="Loading watch history..." />
                </div>
            ) : filteredHistory.length === 0 ? (
                <div style={{
                    padding: '50px 20px',
                    borderRadius: '16px',
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px dashed rgba(255,255,255,0.1)',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '14px'
                }}>
                    <Clock size={40} color="var(--text-muted)" style={{ opacity: 0.35 }} />
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '360px', margin: 0 }}>
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
                        style={{ padding: '8px 20px', fontSize: '0.86rem', marginTop: '4px' }}
                    >
                        <TranslatedText maithili="गीत संग्रह देखू" english="Explore Songs" />
                        <ArrowRight size={14} />
                    </Link>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                    {[
                        { key: 'today', mai: 'आइज (Today)', en: 'Today', list: groupedHistory.today },
                        { key: 'yesterday', mai: 'काल्हि (Yesterday)', en: 'Yesterday', list: groupedHistory.yesterday },
                        { key: 'thisWeek', mai: 'एहि सप्ताह (This Week)', en: 'This Week', list: groupedHistory.thisWeek },
                        { key: 'older', mai: 'पहिलुका (Older)', en: 'Older', list: groupedHistory.older },
                    ].map((group) => {
                        if (!group.list || group.list.length === 0) return null;
                        return (
                            <div key={group.key}>
                                <div className="history-group-header">
                                    <Clock size={12} />
                                    <span>{t(group.mai, group.en)}</span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', fontWeight: 500 }}>
                                        ({group.list.length})
                                    </span>
                                </div>

                                <div className="history-group-card">
                                    {group.list.map((item, itemIdx) => {
                                        const isThisPlaying =
                                            currentTrack?.song?.slug === item.slug && isPlaying;
                                        return (
                                            <div
                                                key={`${item.id || item.slug || 'song'}-${item.played_at || ''}-${itemIdx}`}
                                                className={`history-track-row ${isThisPlaying ? 'playing' : ''}`}
                                            >
                                                {/* Artwork Thumbnail */}
                                                <div className="history-track-art">
                                                    <img
                                                        src={item.poster || '/placeholder.jpg'}
                                                        alt={item.title}
                                                        onError={(e) => { e.currentTarget.src = '/placeholder.jpg'; }}
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
                                                            size={16}
                                                            fill={isThisPlaying ? '#EAB308' : '#FAFAFA'}
                                                            color={isThisPlaying ? '#EAB308' : '#FAFAFA'}
                                                        />
                                                    </button>
                                                </div>

                                                {/* Title & Metadata */}
                                                <div className="history-track-info">
                                                    <Link
                                                        href={`/songs/${item.slug}`}
                                                        className="history-track-title"
                                                    >
                                                        {item.title}
                                                    </Link>

                                                    <div className="history-track-meta">
                                                        <span className="history-track-singer">{item.singer}</span>
                                                        {item.category && (
                                                            <>
                                                                <span className="meta-dot">•</span>
                                                                <span className="history-track-cat">
                                                                    {item.category}
                                                                </span>
                                                            </>
                                                        )}
                                                        <span className="meta-dot mobile-inline-clock">•</span>
                                                        <span className="mobile-inline-clock">{formatClockTime(item.played_at)}</span>
                                                    </div>
                                                </div>

                                                {/* Desktop Clock & Action Buttons */}
                                                <div className="history-track-actions">
                                                    <span className="desktop-clock">
                                                        {formatClockTime(item.played_at)}
                                                    </span>

                                                    <Link
                                                        href={`/studio/${item.slug}`}
                                                        title={t('स्टुडियो मे गाउ', 'Sing in Studio')}
                                                        className="history-action-btn studio"
                                                    >
                                                        <Mic size={14} />
                                                    </Link>

                                                    <button
                                                        onClick={(e) => handleRemoveItem(e, item.id || item.slug)}
                                                        title={t('हटाउ', 'Remove from history')}
                                                        className="history-action-btn trash"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="history-pagination">
                            <div className="history-pagination-info">
                                {t(
                                    `कुल ${filteredHistory.length} मे सँ ${startIndex + 1}–${Math.min(startIndex + ITEMS_PER_PAGE, filteredHistory.length)} गीत देखाओल जा रहल अछि`,
                                    `Showing ${startIndex + 1}–${Math.min(startIndex + ITEMS_PER_PAGE, filteredHistory.length)} of ${filteredHistory.length} songs`
                                )}
                            </div>

                            <div className="history-pagination-btns">
                                <button
                                    type="button"
                                    disabled={safePage <= 1}
                                    onClick={() => {
                                        setCurrentPage((p) => Math.max(1, p - 1));
                                        window.scrollTo({ top: 220, behavior: 'smooth' });
                                    }}
                                    className="history-action-btn"
                                    style={{
                                        padding: '6px 10px',
                                        width: 'auto',
                                        gap: '4px',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        background: safePage <= 1 ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.05)',
                                        color: safePage <= 1 ? 'var(--text-muted)' : '#FAFAFA',
                                        fontSize: '0.78rem',
                                        fontWeight: 600,
                                        cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                                        opacity: safePage <= 1 ? 0.45 : 1,
                                        display: 'inline-flex'
                                    }}
                                >
                                    <ChevronLeft size={14} />
                                    <span className="pagination-btn-text">{t('पहिलुका', 'Prev')}</span>
                                </button>

                                <div style={{ display: 'flex', gap: '4px' }}>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                                        const isActive = p === safePage;
                                        return (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => {
                                                    setCurrentPage(p);
                                                    window.scrollTo({ top: 220, behavior: 'smooth' });
                                                }}
                                                style={{
                                                    width: '30px',
                                                    height: '30px',
                                                    borderRadius: '7px',
                                                    border: '1px solid',
                                                    borderColor: isActive ? '#EAB308' : 'rgba(255, 255, 255, 0.08)',
                                                    background: isActive ? 'linear-gradient(135deg, #EAB308, #CA8A04)' : 'rgba(255, 255, 255, 0.03)',
                                                    color: isActive ? '#070913' : 'var(--text-secondary)',
                                                    fontWeight: isActive ? 800 : 500,
                                                    fontSize: '0.8rem',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'all 0.15s ease',
                                                }}
                                            >
                                                {p}
                                            </button>
                                        );
                                    })}
                                </div>

                                <button
                                    type="button"
                                    disabled={safePage >= totalPages}
                                    onClick={() => {
                                        setCurrentPage((p) => Math.min(totalPages, p + 1));
                                        window.scrollTo({ top: 220, behavior: 'smooth' });
                                    }}
                                    className="history-action-btn"
                                    style={{
                                        padding: '6px 10px',
                                        width: 'auto',
                                        gap: '4px',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        background: safePage >= totalPages ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.05)',
                                        color: safePage >= totalPages ? 'var(--text-muted)' : '#FAFAFA',
                                        fontSize: '0.78rem',
                                        fontWeight: 600,
                                        cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
                                        opacity: safePage >= totalPages ? 0.45 : 1,
                                        display: 'inline-flex'
                                    }}
                                >
                                    <span className="pagination-btn-text">{t('आगाँ', 'Next')}</span>
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
