'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, Mic, ArrowRight, CheckCircle2, Music, Sparkles, MapPin } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function ArtistsCatalogView({ initialArtists = [] }) {
  const { t, isEnglish } = useLanguage();
  const [search, setSearch] = useState('');
  const [selectedGender, setSelectedGender] = useState('all');

  const filteredArtists = useMemo(() => {
    let list = [...initialArtists];

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(a => {
        const nameDev = (a.name_devanagari || a.name || '').toLowerCase();
        const nameRom = (a.name_roman || a.slug || '').toLowerCase();
        const role = (a.role || '').toLowerCase();
        return nameDev.includes(q) || nameRom.includes(q) || role.includes(q);
      });
    }

    if (selectedGender !== 'all') {
      list = list.filter(a => a.gender === selectedGender);
    }

    return list;
  }, [initialArtists, search, selectedGender]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Search and Quick Filters Bar */}
      <div className="artists-filter-toolbar">
        <div className="artists-search-wrapper">
          <Search size={18} color="var(--accent-gold)" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('गायक / गायिका खोजू (Search artist by name)...', 'Search artist by name...', 'गायक / गायिका खोजू...')}
            className="artists-search-input"
          />
          {search && (
            <button onClick={() => setSearch('')} className="artists-search-clear">
              ✕
            </button>
          )}
        </div>

        <div
          className="artists-filter-pills no-scrollbar"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <button
            onClick={() => setSelectedGender('all')}
            className={`artists-gender-pill ${selectedGender === 'all' ? 'active' : ''}`}
          >
            {t('सभ गायक (All)', 'All Artists', 'सभ गायक')}
          </button>
          <button
            onClick={() => setSelectedGender('female')}
            className={`artists-gender-pill ${selectedGender === 'female' ? 'active' : ''}`}
          >
            {t('महिला गायिका (Female)', 'Female Singers', 'महिला गायिका')}
          </button>
          <button
            onClick={() => setSelectedGender('male')}
            className={`artists-gender-pill ${selectedGender === 'male' ? 'active' : ''}`}
          >
            {t('पुरुष गायक (Male)', 'Male Singers', 'पुरुष गायक')}
          </button>
        </div>
      </div>

      {/* Results Count */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {t(`कुल ${filteredArtists.length} गायक उपलब्ध अछि`, `Showing ${filteredArtists.length} artists`, `कुल ${filteredArtists.length} गायक उपलब्ध`)}
        </span>
      </div>

      {/* Grid of Redesigned Artist Cards */}
      <div className="artists-grid-container">
        {filteredArtists.map((artist) => {
          const songsCount = artist.stats?.total_songs || 0;
          const artistName = isEnglish && artist.name_roman
            ? artist.name_roman
            : (artist.name_devanagari || artist.name);
          const romanName = isEnglish ? '' : (artist.name_roman || '');

          return (
            <Link
              key={artist.slug || artist._id}
              href={`/artists/${artist.slug}`}
              className="artist-card-item"
            >
              {/* Card Top: Avatar with Glow Ring */}
              <div className="artist-card-avatar-box" style={{ width: 110, height: 110, borderRadius: '50%', overflow: 'hidden', position: 'relative', margin: '0 auto 18px auto', flexShrink: 0 }}>
                <img
                  src={artist.avatar_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80'}
                  alt={artistName}
                  className="artist-card-avatar"
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }}
                />
                <div className="artist-card-avatar-border" />
              </div>

              {/* Artist Name & Badges */}
              <div className="artist-card-info">
                <div className="artist-card-name-row">
                  <h2 className="artist-card-name font-traditional">
                    {artistName}
                  </h2>
                  <CheckCircle2 size={15} color="#EAB308" className="artist-card-check" />
                </div>

                {romanName && romanName !== artistName && (
                  <p className="artist-card-roman">
                    {romanName}
                  </p>
                )}

                {artist.origin && (artist.origin.village || artist.origin.district) && (
                  <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                    <MapPin size={11} color="#EAB308" />
                    <span>{artist.origin.village ? `${artist.origin.village}, ` : ''}{artist.origin.district}</span>
                  </span>
                )}

                {artist.role && (
                  <span className="artist-card-role">
                    {artist.role}
                  </span>
                )}

                {/* Categories */}
                {artist.genres && artist.genres.length > 0 && (
                  <div className="artist-card-genres">
                    {artist.genres.slice(0, 2).map((g) => (
                      <span key={g} className="artist-card-genre-pill">
                        {g}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Card Footer: Track Count & Arrow */}
              <div className="artist-card-footer">
                <span className="artist-card-count">
                  <Music size={13} color="var(--accent-gold)" />
                  <span>{songsCount} {t('गीत', 'tracks', 'गीत')}</span>
                </span>

                <div className="artist-card-cta">
                  <span>{t('प्रोफाइल देखू (View Profile)', 'View Profile', 'प्रोफाइल देखू')}</span>
                  <ArrowRight size={14} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {filteredArtists.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '8px' }}>
            {t('कोनो गायक नै भेटल (No artists found)', 'No artists found matching your query', 'कोनो गायक नहि भेटल')}
          </p>
          <button
            onClick={() => { setSearch(''); setSelectedGender('all'); }}
            style={{
              padding: '8px 18px',
              borderRadius: '999px',
              background: 'rgba(234, 179, 8, 0.15)',
              border: '1px solid rgba(234, 179, 8, 0.4)',
              color: 'var(--accent-gold-light)',
              cursor: 'pointer'
            }}
          >
            {t('फ़िल्टर रीसेट करू (Reset Filters)', 'Reset Filters', 'फ़िल्टर रीसेट करू')}
          </button>
        </div>
      )}
    </div>
  );
}
