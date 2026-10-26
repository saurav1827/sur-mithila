'use client';

import React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useLanguage } from '../context/LanguageContext';
import { CULTURAL_CATEGORIES } from '../lib/categories';

export { CULTURAL_CATEGORIES };

export default function CategoryChips({ activeCategory = 'all', onSelectCategory }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useLanguage();

  const handleSelect = (val) => {
    if (onSelectCategory) {
      onSelectCategory(val);
    } else {
      const params = new URLSearchParams(searchParams);
      if (val === 'all') {
        params.delete('category');
      } else {
        params.set('category', val);
      }
      params.delete('cursor');
      params.delete('page');
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  const isCategorySelected = (cat) => {
    if (cat.value === 'all') {
      return !activeCategory || activeCategory === 'all';
    }
    if (!activeCategory || activeCategory === 'all') {
      return false;
    }
    const cur = activeCategory.trim().toLowerCase();
    const val = cat.value.toLowerCase();
    const name = cat.name.toLowerCase();

    return cur === val ||
      cur === name ||
      (cat.pure && cur === cat.pure.toLowerCase()) ||
      cur.includes(val) ||
      val.includes(cur) ||
      Boolean(cat.aliases?.some(a => a.toLowerCase() === cur || cur.includes(a.toLowerCase())));
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      overflowX: 'auto',
      padding: '4px 0 16px 0',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none'
    }}>
      {CULTURAL_CATEGORIES.map((cat) => {
        const isSelected = isCategorySelected(cat);
        return (
          <button
            key={cat.value}
            onClick={() => handleSelect(cat.value)}
            style={{
              whiteSpace: 'nowrap',
              padding: '8px 16px',
              borderRadius: '9999px',
              fontSize: '0.85rem',
              fontWeight: isSelected ? 600 : 500,
              color: isSelected ? '#070913' : 'var(--text-secondary)',
              background: isSelected ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'rgba(255, 255, 255, 0.05)',
              border: isSelected ? '1px solid #F59E0B' : '1px solid var(--border-card)',
              boxShadow: isSelected ? '0 4px 14px rgba(245, 158, 11, 0.3)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {t(cat.name, cat.en, cat.pure)}
          </button>
        );
      })}
    </div>
  );
}
