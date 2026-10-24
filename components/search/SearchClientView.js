'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import SongCard from '../SongCard';
import { Search, Sparkles, X, Loader2 } from 'lucide-react';

export default function SearchClientView({ initialQuery = '', initialSongs = [], totalCount = 0 }) {
  const [query, setQuery] = useState(initialQuery);
  const [songs, setSongs] = useState(initialSongs);
  const [total, setTotal] = useState(totalCount);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const debounceTimer = useRef(null);

  // Auto-focus the search input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const performSearch = useCallback(async (searchQuery) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/songs?q=${encodeURIComponent(searchQuery)}&limit=48`);
      if (res.ok) {
        const data = await res.json();
        setSongs(data.songs || []);
        setTotal(data.pagination?.total ?? (data.songs?.length || 0));
      }
    } catch (err) {
      console.warn('Search fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      // Update browser URL query string without reloading page
      const url = val.trim() ? `/search?q=${encodeURIComponent(val.trim())}` : '/search';
      window.history.replaceState(null, '', url);
      performSearch(val.trim());
    }, 280);
  };

  const handleClear = () => {
    setQuery('');
    window.history.replaceState(null, '', '/search');
    performSearch('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleQuickTagClick = (term) => {
    setQuery(term);
    const url = `/search?q=${encodeURIComponent(term)}`;
    window.history.replaceState(null, '', url);
    performSearch(term);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const popularTags = [
    'जय जय भैरवि',
    'काँचहि बाँस के बहँगिया',
    'शारदा सिन्हा',
    'कन्यादान',
    'विद्यापति',
    'नचारी'
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Search Header Banner */}
      <div className="search-hero-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <span className="gold-badge" style={{ margin: 0, fontSize: '0.72rem' }}>स्मार्ट अन्वेषण</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold-light)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Sparkles size={12} />
            Dual-Script Search
          </span>
        </div>

        <h1 className="search-hero-title font-traditional">
          गीत अन्वेषण (Smart Search)
        </h1>
        <p className="search-hero-subtitle">
          देवनागरी अथवा Roman (English) मे खोजू—यथा <em>&quot;Bhairavi&quot;</em>, <em>&quot;भैरवि&quot;</em>, <em>&quot;Sharda Sinha&quot;</em>, <em>&quot;विवाह&quot;</em>
        </p>

        {/* Live Search Input Box */}
        <div className="search-input-wrapper">
          <Search size={18} color="var(--accent-gold)" className="search-input-icon" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder="शीर्षक, गायक, रचयिता, अथवा बोलक शब्द खोजू..."
            className="search-main-input"
            autoFocus
          />

          {loading && (
            <Loader2 size={16} className="search-loader-spin" />
          )}

          {query && !loading && (
            <button
              onClick={handleClear}
              aria-label="Clear search"
              className="search-clear-btn"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Popular Quick Search Tags */}
        <div className="search-popular-tags-row no-scrollbar">
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            लोकप्रिय खोज:
          </span>
          {popularTags.map((term) => (
            <button
              key={term}
              onClick={() => handleQuickTagClick(term)}
              className={`search-quick-tag-btn ${query === term ? 'active' : ''}`}
            >
              {term}
            </button>
          ))}
        </div>
      </div>

      {/* Results Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
        <h2 style={{ fontSize: '1.05rem', color: '#F8FAFC', fontWeight: 600 }}>
          {query.trim() ? `"${query}" लेल परिणाम` : 'सकल गीत संग्रह'}
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
            ({total} गीत प्राप्त)
          </span>
        </h2>
      </div>

      {/* Results Grid or Empty State */}
      {songs.length > 0 ? (
        <div className="catalog-grid">
          {songs.map((song) => (
            <SongCard key={song.id} song={song} />
          ))}
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '50px 20px', textAlign: 'center', borderRadius: '16px' }}>
          <Sparkles size={36} color="var(--accent-gold)" style={{ margin: '0 auto 12px', opacity: 0.7 }} />
          <h3 className="font-traditional" style={{ fontSize: '1.25rem', color: '#F8FAFC', marginBottom: '6px' }}>
            कोनो गीत नहि भेटल
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', maxWidth: '340px', margin: '0 auto 14px' }}>
            कृपया शब्द वर्तनी जांचू अथवा आन शब्द (यथा गायकक नाम वा विधा) सं खोजक प्रयास करू।
          </p>
          {query && (
            <button
              onClick={handleClear}
              className="btn-primary"
              style={{ padding: '8px 18px', fontSize: '0.85rem' }}
            >
              सभ गीत देखू
            </button>
          )}
        </div>
      )}
    </div>
  );
}
