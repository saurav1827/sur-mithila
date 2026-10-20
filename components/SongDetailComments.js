'use client';

import React, { useState, useEffect } from 'react';
import { Mic, MessageSquare, Sparkles } from 'lucide-react';
import CommentsSection from './CommentsSection';
import CommentThread from './community/CommentThread';
import { useLanguage } from '../context/LanguageContext';

export default function SongDetailComments({ songId, songTitle, initialCover }) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState(initialCover ? 'cover' : 'song');

  // Synchronize comment pane when top hero player switches between cover and original
  useEffect(() => {
    const handleMode = (e) => {
      if (e.detail === 'cover' && initialCover) {
        setActiveTab('cover');
      } else if (e.detail === 'song' || e.detail === 'youtube') {
        setActiveTab('song');
      }
    };
    window.addEventListener('sur_mithila_mode_change', handleMode);
    return () => window.removeEventListener('sur_mithila_mode_change', handleMode);
  }, [initialCover]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sur_mithila_mode_change', { detail: tab }));
      const url = new URL(window.location.href);
      if (tab === 'cover' && initialCover?.id) {
        url.searchParams.set('cover', initialCover.id);
      } else {
        url.searchParams.delete('cover');
      }
      window.history.replaceState(null, '', url.toString());
    }
  };

  if (!initialCover) {
    return <CommentsSection songId={songId} />;
  }

  return (
    <div style={{ marginTop: '28px' }}>
      {/* Tab Switcher: Cover Comments vs Song Discussion */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '12px',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => switchTab('cover')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '999px',
            background: activeTab === 'cover' ? 'linear-gradient(135deg, #EAB308, #D97706)' : 'rgba(255, 255, 255, 0.04)',
            color: activeTab === 'cover' ? '#070913' : 'var(--text-secondary)',
            border: activeTab === 'cover' ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
            fontWeight: 700,
            fontSize: '0.88rem',
            cursor: 'pointer',
            boxShadow: activeTab === 'cover' ? '0 4px 15px rgba(234, 179, 8, 0.35)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <Mic size={15} />
          <span>{initialCover.userName} केर कवर पर टिप्पणी (Cover Comments)</span>
        </button>

        <button
          type="button"
          onClick={() => switchTab('song')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '999px',
            background: activeTab === 'song' ? 'linear-gradient(135deg, #EAB308, #D97706)' : 'rgba(255, 255, 255, 0.04)',
            color: activeTab === 'song' ? '#070913' : 'var(--text-secondary)',
            border: activeTab === 'song' ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
            fontWeight: 700,
            fontSize: '0.88rem',
            cursor: 'pointer',
            boxShadow: activeTab === 'song' ? '0 4px 15px rgba(234, 179, 8, 0.35)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <MessageSquare size={15} />
          <span>{t('मूल गीत चर्चा', 'Original Song Discussion')}</span>
        </button>
      </div>

      {/* Pane 1: Cover Comments (YouTube style nested thread) */}
      {activeTab === 'cover' && (
        <div>
          <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            <Sparkles size={13} color="#EAB308" />
            <span>
              {t(
                `अहाँ ${initialCover.userName} केर गाओल कवर प्रस्तुति पर प्रतिक्रिया दऽ रहल छी।`,
                `You are commenting on ${initialCover.userName}'s folk vocal cover.`
              )}
            </span>
          </div>
          <CommentThread recordingId={initialCover.id} />
        </div>
      )}

      {/* Pane 2: Original Song Discussion */}
      {activeTab === 'song' && (
        <CommentsSection songId={songId} />
      )}
    </div>
  );
}
