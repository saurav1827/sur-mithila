'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Disc, Mic, Sparkles, Bookmark } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const navItems = [
    {
      href: '/',
      icon: Compass,
      labelMai: 'संग्रह',
      labelEn: 'Explore',
      labelPureMai: 'संग्रह',
      matchExact: true,
    },
    {
      href: '/categories',
      icon: Disc,
      labelMai: 'विधा',
      labelEn: 'Categories',
      labelPureMai: 'विधा',
      matchExact: false,
    },
    {
      href: '/artists',
      icon: Mic,
      labelMai: 'गायक',
      labelEn: 'Artists',
      labelPureMai: 'गायक',
      matchExact: false,
    },
    {
      href: '/playlists',
      icon: Sparkles,
      labelMai: 'प्लेलिस्ट',
      labelEn: 'Playlists',
      labelPureMai: 'तालिका',
      matchExact: false,
    },
    {
      href: '/library',
      icon: Bookmark,
      labelMai: 'लाइब्रेरी',
      labelEn: 'Library',
      labelPureMai: 'ग्रंथागार',
      matchExact: false,
    },
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
      <div className="mobile-bottom-nav-inner">
        {navItems.map((item) => {
          const isActive = item.matchExact
            ? pathname === item.href || pathname === '/explore'
            : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="mobile-bottom-nav-icon-wrap">
                <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
                {isActive && <span className="mobile-bottom-nav-pill" />}
              </div>
              <span className="mobile-bottom-nav-label font-traditional">
                {t(item.labelMai, item.labelEn, item.labelPureMai)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
