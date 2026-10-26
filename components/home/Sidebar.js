'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Home, Flame, Music } from 'lucide-react';
import TranslatedText from '../TranslatedText';

const NAV = [
    { href: '/', icon: Home, mai: 'मुख्य', en: 'Home', active: (p, c) => p === '/' && c === 'all' },
    { href: '/#row-trending', icon: Flame, mai: 'चर्चित', en: 'Trending', active: () => false },
];

export default function Sidebar({ stats, categories = [] }) {
    const pathname = usePathname();
    const cat = useSearchParams().get('category') || 'all';

    const validCategories = categories.filter((c) => c.count > 0);

    return (
        <aside className="feed-sidebar glass-panel" aria-label="Navigation">
            <nav style={{ display: 'contents' }}>
                {NAV.map(({ href, icon: Icon, mai, en, active }) => (
                    <Link key={href} href={href} className="nav-item" aria-current={active(pathname, cat) ? 'page' : undefined}>
                        <Icon size={19} />
                        <TranslatedText maithili={mai} english={en} />
                    </Link>
                ))}

                {validCategories.length > 0 && (
                    <>
                        <div className="nav-group"><TranslatedText maithili="श्रेणी" english="Categories" /></div>
                        {validCategories.map((c) => {
                            const isSelected = pathname === '/' && (
                                cat === c.value ||
                                cat === c.name ||
                                (cat !== 'all' && (cat.includes(c.value) || c.value.includes(cat) || c.name.includes(cat)))
                            );
                            return (
                                <Link
                                    key={c.name}
                                    href={`/?category=${encodeURIComponent(c.value || c.name)}`}
                                    className="nav-item"
                                    aria-current={isSelected ? 'page' : undefined}
                                >
                                    <Music size={17} />
                                    <span className="font-traditional" style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {c.name}
                                    </span>
                                    <span style={{ fontSize: '0.72rem', opacity: 0.5, fontVariantNumeric: 'tabular-nums' }}>
                                        {c.count}
                                    </span>
                                </Link>
                            );
                        })}
                    </>
                )}
            </nav>

            {stats && (
                <div className="nav-foot">
                    {stats.total?.toLocaleString()} <TranslatedText maithili="गीत संकलित" english="songs" /><br />
                    {stats.verified?.toLocaleString()} <TranslatedText maithili="सत्यापित" english="verified" />
                </div>
            )}
        </aside>
    );
}