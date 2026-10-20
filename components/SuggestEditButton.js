'use client';

import React, { useState } from 'react';
import SuggestEditModal from './SuggestEditModal';
import { Edit3 } from 'lucide-react';

export default function SuggestEditButton({ song }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '8px',
          background: 'rgba(255, 255, 255, 0.05)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-card)',
          fontSize: '0.8rem',
          fontWeight: 600,
          transition: 'all 0.2s ease',
          cursor: 'pointer'
        }}
        className="hover-highlight"
      >
        <Edit3 size={14} /> Suggest edit
      </button>
      <SuggestEditModal song={song} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
