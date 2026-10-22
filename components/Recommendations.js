'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWatch } from './WatchProvider';
import { track } from '../lib/tracking';
import { TrendingUp, Play, User, Music } from 'lucide-react';

const CHIPS = [
  ['all', 'सब'],
  ['singer', 'Same singer'],
  ['category', 'Same category'],
  ['popular', 'Popular']
];

export default function Recommendations({ currentSongId }) {
  const [chip, setChip] = useState('all');
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const { autoplay, setAutoplay, setNext } = useWatch();

  useEffect(() => {
    async function fetchRecommendations() {
      setLoading(true);
      try {
        const res = await fetch(`/api/recommendations?songId=${currentSongId}&filter=${chip}&limit=20`);
        if (res.ok) {
          const data = await res.json();
          setRecommendations(data.recommendations || []);
          if (data.recommendations?.length > 0) {
            setNext(data.recommendations[0]);
            
            // Track impression
            track('impression', {
              surface: 'watch_sidebar',
              itemCount: data.recommendations.length,
              items: data.recommendations.map(s => s.id)
            });
          }
        }
      } catch (err) {
        console.error('Failed to load recommendations', err);
      } finally {
        setLoading(false);
      }
    }

    if (currentSongId) {
      fetchRecommendations();
    }
  }, [currentSongId, chip, setNext]);

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="font-traditional" style={{ fontSize: '1.25rem', color: '#F8FAFC', margin: 0 }}>
          अगिला गीत (Up Next)
        </h3>
        <label style={{ display: 'flex', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', alignItems: 'center', cursor: 'pointer' }}>
          Autoplay
          <input 
            type="checkbox" 
            checked={autoplay} 
            onChange={e => setAutoplay(e.target.checked)} 
            style={{ accentColor: 'var(--accent-gold)' }}
          />
        </label>
      </div>

      <div 
        className="recommendations-chips-scroll"
        style={{ display: 'flex', gap: '8px', overflowX: 'auto', margin: '16px 0', paddingBottom: '4px' }}
      >
        {CHIPS.map(([k, l]) => (
          <button 
            key={k} 
            onClick={() => setChip(k)} 
            className="chip" 
            data-active={chip === k}
          >
            {l}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading && Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: '12px', opacity: 0.7 }}>
            <div className="skeleton" style={{ width: '140px', height: '79px' }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
              <div className="skeleton" style={{ height: '14px', marginBottom: '4px', width: '90%' }} />
              <div className="skeleton" style={{ height: '12px', width: '60%' }} />
            </div>
          </div>
        ))}
        
        {!loading && recommendations.map((s, i) => (
          <Link 
            key={s.id} 
            href={`/songs/${s.slug}`} 
            className="song-card"
            onClick={() => track('click', { songId: s.id, rankPos: i, surface: 'watch_sidebar' })}
            style={{ 
              display: 'flex', 
              flexDirection: 'row',
              gap: '12px', 
              padding: '8px', 
              ...(i === 0 && { border: '1px solid rgba(234,179,8,0.35)' }) 
            }}
          >
            <div style={{ position: 'relative', width: '140px', height: '79px', flexShrink: 0, borderRadius: '8px', overflow: 'hidden', background: 'rgba(0,0,0,0.5)' }}>
              {s.poster?.image_url || s.youtube?.thumbnail_url ? (
                <img 
                  src={s.poster?.image_url || s.youtube?.thumbnail_url} 
                  alt={s.title?.canonical || ''} 
                  loading="lazy" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Music size={24} color="var(--text-muted)" />
                </div>
              )}
              {s.version?.type && s.version.type !== 'original' ? (
                <span className="badge" style={{ position: 'absolute', bottom: '4px', right: '4px', fontSize: '0.65rem', padding: '2px 6px', background: 'rgba(0,0,0,0.7)', borderRadius: '4px' }}>
                  {s.version.type}
                </span>
              ) : (
                <span className="gold-badge" style={{ position: 'absolute', bottom: '4px', right: '4px', fontSize: '0.65rem', padding: '2px 6px' }}>
                  ORIGINAL
                </span>
              )}
            </div>
            
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <h4 className="font-traditional" style={{ 
                fontSize: '0.95rem', 
                color: '#F8FAFC', 
                margin: '0 0 4px 0',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {s.title?.canonical || 'Maithili Geet'}
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 2px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <User size={12} /> {s.credits?.singer || 'पारंपरिक'}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                {(s.stats?.views_count || 0).toLocaleString()} views
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
