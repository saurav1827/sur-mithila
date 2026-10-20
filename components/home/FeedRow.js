'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import SongCard from '../SongCard';
import TranslatedText from '../TranslatedText';

export default function FeedRow({ row }) {
    const ref = useRef(null);
    const [edge, setEdge] = useState({ start: true, end: false });

    const update = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
    }, []);
    useEffect(() => { update(); }, [row.songs.length, update]);

    const scroll = (dir) =>
        ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: 'smooth' });

    return (
        <section className="feed-row" id={`row-${row.key}`} aria-label={row.title.en}>
            <div className="row-head">
                <h2 className="font-traditional"><TranslatedText maithili={row.title.mai} english={row.title.en} /></h2>
                {row.href && (
                    <Link href={row.href} style={{
                        display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem',
                        color: 'var(--accent-gold-light, var(--accent-gold))', fontWeight: 600
                    }}>
                        <TranslatedText maithili="सभ देखू" english="See all" /> <ArrowRight size={14} />
                    </Link>
                )}
            </div>

            <div className="row-wrap">
                <button className="row-arrow" data-dir="prev" disabled={edge.start} onClick={() => scroll(-1)} aria-label="Previous">
                    <ChevronLeft size={20} />
                </button>
                <div className="row-scroller" ref={ref} onScroll={update}>
                    {row.songs.map((song) => (
                        <div className="row-item" key={song.id}>
                            <SongCard song={song} />
                            {song.reason && <span className="reason-tag">{song.reason}</span>}
                        </div>
                    ))}
                </div>
                <button className="row-arrow" data-dir="next" disabled={edge.end} onClick={() => scroll(1)} aria-label="Next">
                    <ChevronRight size={20} />
                </button>
            </div>
        </section>
    );
}