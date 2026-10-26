'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import FeedRow from './FeedRow';
import SongCard from '../SongCard';
import TranslatedText from '../TranslatedText';
import AIFeedSection from './AIFeedSection';

function RowSkeleton() {
    return (
        <div className="feed-row" aria-hidden>
            <div className="sk" style={{ width: 200, height: 26 }} />
            <div style={{ display: 'flex', gap: 16, overflow: 'hidden' }}>
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} style={{ flex: '0 0 clamp(200px,22vw,252px)' }}>
                        <div className="sk" style={{ aspectRatio: '1.55', marginBottom: 10 }} />
                        <div className="sk" style={{ height: 14, marginBottom: 8 }} />
                        <div className="sk" style={{ height: 12, width: '55%' }} />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function HomeFeed({ initialRows, initialCursor, category }) {
    const [rows, setRows] = useState(initialRows);
    const [cursor, setCursor] = useState(initialCursor);
    const [status, setStatus] = useState('idle'); // idle | loading | error
    const busy = useRef(false);
    const sentinel = useRef(null);

    const loadMore = useCallback(async () => {
        if (busy.current || cursor == null) return;
        busy.current = true;
        setStatus('loading');
        try {
            const qs = new URLSearchParams({ cursor: String(cursor) });
            if (category !== 'all') qs.set('category', category);
            const res = await fetch(`/api/feed?${qs}`);
            if (!res.ok) throw new Error(String(res.status));
            const data = await res.json();
            setRows((prev) => {
                const seen = new Set(prev.map((r) => r.key));
                return [...prev, ...data.rows.filter((r) => !seen.has(r.key))];
            });
            setCursor(data.nextCursor);
            setStatus('idle');
        } catch {
            setStatus('error');
        } finally {
            busy.current = false;
        }
    }, [cursor, category]);

    // Infinite scroll: fire 900px before the sentinel is visible.
    // Re-created when `cursor` changes, so it re-checks and keeps loading if the sentinel is still on screen.
    useEffect(() => {
        const el = sentinel.current;
        if (!el || cursor == null || status === 'error') return;
        const io = new IntersectionObserver(([e]) => e.isIntersecting && loadMore(), { rootMargin: '900px 0px' });
        io.observe(el);
        return () => io.disconnect();
    }, [loadMore, cursor, status]);



    const totalSongs = rows.reduce((acc, r) => acc + (r.songs?.length || 0), 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
            {category === 'all' && <AIFeedSection />}

            {rows.map((row) =>
                row.kind === 'grid' ? (
                    <div className="feed-grid" key={row.key}>
                        {row.songs.map((s) => <SongCard key={s.id} song={s} />)}
                    </div>
                ) : (
                    <FeedRow key={row.key} row={row} />
                )
            )}

            {status === 'loading' && <RowSkeleton />}

            {status === 'error' && (
                <div className="feed-end">
                    <TranslatedText maithili="लोड नहि भेल।" english="Couldn't load more." pure="लोड नहि भेल।" />{' '}
                    <button className="btn-ghost" onClick={() => { setStatus('idle'); loadMore(); }}>
                        <TranslatedText maithili="फेर प्रयास करू" english="Try again" pure="फेर प्रयास करू" />
                    </button>
                </div>
            )}

            {cursor != null && <div ref={sentinel} style={{ height: 1 }} />}

            {cursor == null && totalSongs > 0 && (
                <div className="feed-end">
                    <TranslatedText
                        maithili="आब सभ देखि लेलहुँ। आन श्रेणी चुनू।"
                        pure="आब सभ देखि लेलहुँ। आन श्रेणी चुनू।"
                        english="You've seen all songs here. Explore other categories."
                    />
                </div>
            )}

            {totalSongs === 0 && status !== 'loading' && (
                <div className="feed-end">
                    <TranslatedText
                        maithili="एहि श्रेणी मे एखन गीत नहि भेटल।"
                        pure="एहि श्रेणी मे एखन गीत नहि भेटल।"
                        english="No songs found in this category yet."
                    />
                </div>
            )}
        </div>
    );
}