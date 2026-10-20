'use client';

import React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export const CULTURAL_CATEGORIES = [
  { name: 'सभ (All)', value: 'all' },
  { name: 'भगवती गीत', value: 'भगवती' },
  { name: 'विवाह संस्कार', value: 'विवाह' },
  { name: 'छठि महापर्व', value: 'छठि' },
  { name: 'नचारी / महेशवाणी', value: 'नचारी' },
  { name: 'समदाउन (विदाई)', value: 'समदाउन' },
  { name: 'सोहर (जन्मोत्सव)', value: 'सोहर' },
  { name: 'विद्यापति पदावली', value: 'विद्यापति' },
  { name: 'ऋतु / पर्व गीत', value: 'पर्व' }
];

export default function CategoryChips({ activeCategory = 'all', onSelectCategory }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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
      params.delete('page');
      router.push(`${pathname}?${params.toString()}`);
    }
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
        const isSelected = activeCategory === cat.value || (cat.value === 'all' && (!activeCategory || activeCategory === 'all'));
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
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}
