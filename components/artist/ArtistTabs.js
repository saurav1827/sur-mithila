'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Play, Pause, Flame, Clock, FolderKanban, Heart, Search, FileText,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Headphones,
  Share2, Check, Sparkles, Music2, Disc, ListPlus
} from 'lucide-react';
import AddToPlaylistModal from '../playlist/AddToPlaylistModal';
import { usePlayer } from '../../context/PlayerContext';
import { useLanguage } from '../../context/LanguageContext';

// Helper to format play count into compact readable string (e.g. 14.5K)
function formatPlays(count) {
  const num = typeof count === 'number' ? count : parseInt(count || '0', 10);
  if (isNaN(num) || num <= 0) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

// Category color badges
function getCategoryBadgeClass(category = '') {
  const cat = category.toLowerCase();
  if (cat.includes('सोहर') || cat.includes('विवाह') || cat.includes('समदाउन') || cat.includes('कोहबर')) {
    return 'cat-badge-sanskari';
  }
  if (cat.includes('भगवती') || cat.includes('देवी') || cat.includes('दुर्गा') || cat.includes('छठि') || cat.includes('भक्ति')) {
    return 'cat-badge-bhakti';
  }
  if (cat.includes('शिव') || cat.includes('नचारी') || cat.includes('महेशवाणी') || cat.includes('भोले')) {
    return 'cat-badge-nachari';
  }
  if (cat.includes('विद्यापति') || cat.includes('पदावली')) {
    return 'cat-badge-vidyapati';
  }
  return 'cat-badge-lokgeet';
}

function getLocalizedCategory(cat, isEnglish) {
  if (!cat) return isEnglish ? 'Maithili Folk' : 'मैथिली लोकगीत';
  if (!isEnglish) return cat;
  const map = {
    'मैथिली लोकगीत': 'Maithili Folk',
    'भगवती गीत': 'Bhagwati Geet',
    'विवाह गीत': 'Vivah Geet',
    'सोहर गीत': 'Sohar Geet',
    'नचारी': 'Nachari (Shiva)',
    'समदाउन': 'Samdaun',
    'छठि गीत': 'Chhath Geet',
    'विद्यापति पदावली': 'Vidyapati Padavali',
    'पर्व-त्योहार': 'Festive Songs',
    'झूमर': 'Jhoomar',
    'बटगवनी': 'Batgavani',
    'कोहबर': 'Kohbar'
  };
  return map[cat] || cat;
}

export default function ArtistTabs({ artist, songs = [] }) {
  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const { t, isEnglish, isMaithiliPlus, isBilingual, formatSongTitle } = useLanguage();
  const [activeTab, setActiveTab] = useState('popular'); // 'popular' | 'recent' | 'category' | 'liked'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [copiedSongId, setCopiedSongId] = useState(null);
  const [favoriteSongIds, setFavoriteSongIds] = useState(new Set());
  const [playlistSong, setPlaylistSong] = useState(null);
  const tableTopRef = useRef(null);

  // Load user favorites from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storageKey = 'sur_mithila_guest_favs';
      const raw = localStorage.getItem(storageKey) || localStorage.getItem('sur_mithila_favorites') || '[]';
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setFavoriteSongIds(new Set(parsed.map(s => s.id || s.slug)));
      }
    } catch {}
  }, []);

  // Toggle favorite handler
  const handleToggleFavorite = (e, song) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const storageKey = 'sur_mithila_guest_favs';
      const raw = localStorage.getItem(storageKey) || localStorage.getItem('sur_mithila_favorites') || '[]';
      let favs = JSON.parse(raw);
      if (!Array.isArray(favs)) favs = [];

      const idKey = song.id || song.slug;
      const isFav = favoriteSongIds.has(idKey);
      const nextSet = new Set(favoriteSongIds);

      if (isFav) {
        favs = favs.filter(item => item.id !== song.id && item.slug !== song.slug);
        nextSet.delete(idKey);
      } else {
        favs.push({
          id: song.id,
          slug: song.slug,
          title: song.title?.canonical || song.title?.devanagari || song.title,
          singer: song.credits?.singer || artist?.name || '',
          poster: song.poster?.image_url,
          category: song.category,
          added_at: new Date().toISOString()
        });
        nextSet.add(idKey);
      }

      setFavoriteSongIds(nextSet);
      localStorage.setItem(storageKey, JSON.stringify(favs));
      localStorage.setItem('sur_mithila_favorites', JSON.stringify(favs));
    } catch {}
  };

  // Copy share link handler
  const handleShareSong = (e, song) => {
    e.preventDefault();
    e.stopPropagation();
    const songUrl = `${window.location.origin}/songs/${song.slug}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(songUrl).then(() => {
        setCopiedSongId(song.id || song.slug);
        setTimeout(() => setCopiedSongId(null), 2200);
      });
    }
  };

  // Extract unique categories for this artist
  const categories = useMemo(() => {
    const set = new Set();
    songs.forEach(s => { if (s.category) set.add(s.category); });
    return Array.from(set);
  }, [songs]);

  // Filter and sort songs based on activeTab, searchQuery, and selectedCategory
  const filteredSongs = useMemo(() => {
    let list = [...songs];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(s => {
        const canonical = (s.title?.canonical || s.title?.devanagari || (typeof s.title === 'string' ? s.title : '')).toLowerCase();
        const roman = (s.title?.roman || '').toLowerCase();
        const category = (s.category || '').toLowerCase();
        return canonical.includes(q) || roman.includes(q) || category.includes(q);
      });
    }

    // Filter by category if on category tab
    if (activeTab === 'category' && selectedCategory !== 'all') {
      list = list.filter(s => s.category === selectedCategory);
    }

    // Sort based on active tab
    if (activeTab === 'popular') {
      list.sort((a, b) => {
        const pA = a.stats?.plays_count || a.stats?.views_count || 0;
        const pB = b.stats?.plays_count || b.stats?.views_count || 0;
        return pB - pA;
      });
    } else if (activeTab === 'recent') {
      list.sort((a, b) => {
        const idA = parseInt((a.id || '').replace(/[^0-9]/g, '') || '0', 10);
        const idB = parseInt((b.id || '').replace(/[^0-9]/g, '') || '0', 10);
        return idB - idA;
      });
    } else if (activeTab === 'liked') {
      list.sort((a, b) => {
        const qA = a.verification?.status === 'verified' ? 1 : 0;
        const qB = b.verification?.status === 'verified' ? 1 : 0;
        return qB - qA;
      });
    }

    return list;
  }, [songs, activeTab, searchQuery, selectedCategory]);

  // Reset page when tab, search query, category or pageSize changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, selectedCategory, pageSize]);

  // Pagination calculation
  const totalItems = filteredSongs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const paginatedSongs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSongs.slice(start, start + pageSize);
  }, [filteredSongs, currentPage, pageSize]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    setCurrentPage(newPage);
    if (tableTopRef.current) {
      tableTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = [];
    pages.push(1);
    if (currentPage > 3) {
      pages.push('...');
    }
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) {
      pages.push('...');
    }
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="artist-tabs-container">
      {/* Tab Navigation & Search Bar Row */}
      <div className="artist-tabs-header">
        {/* Quick Search Input */}
        <div className="artist-search-box">
          <Search size={16} color="var(--accent-gold)" className="artist-search-icon" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('गीत खोजू (Search in discography)...', 'Search songs in discography...', 'गीत खोजू...')}
            className="artist-search-input"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="artist-search-clear-btn"
              title={t('सर्च साफ करू', 'Clear search', 'सर्च साफ करू')}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="artist-tabs-nav" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'popular'}
            className={`artist-tab-btn ${activeTab === 'popular' ? 'active' : ''}`}
            onClick={() => setActiveTab('popular')}
          >
            <Flame size={15} />
            <span className="artist-tab-label-full">{t('सर्वाधिक लोकप्रिय (Popular)', 'Popular Tracks', 'सर्वाधिक लोकप्रिय')}</span>
            <span className="artist-tab-label-mobile">{t('लोकप्रिय', 'Popular', 'लोकप्रिय')}</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'recent'}
            className={`artist-tab-btn ${activeTab === 'recent' ? 'active' : ''}`}
            onClick={() => setActiveTab('recent')}
          >
            <Clock size={15} />
            <span className="artist-tab-label-full">{t('नवीनतम गीत (Recent)', 'Recent Tracks', 'नवीनतम गीत')}</span>
            <span className="artist-tab-label-mobile">{t('नवीनतम', 'Recent', 'नवीनतम')}</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'category'}
            className={`artist-tab-btn ${activeTab === 'category' ? 'active' : ''}`}
            onClick={() => setActiveTab('category')}
          >
            <FolderKanban size={15} />
            <span className="artist-tab-label-full">{t('श्रेणी अनुसार (Categories)', 'Categories', 'श्रेणी अनुसार')}</span>
            <span className="artist-tab-label-mobile">{t('विधा', 'Categories', 'विधा')}</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'liked'}
            className={`artist-tab-btn ${activeTab === 'liked' ? 'active' : ''}`}
            onClick={() => setActiveTab('liked')}
          >
            <Heart size={15} />
            <span className="artist-tab-label-full">{t('प्रमाणित संग्रह (Verified)', 'Verified Tracks', 'प्रमाणित संग्रह')}</span>
            <span className="artist-tab-label-mobile">{t('प्रमाणित', 'Verified', 'प्रमाणित')}</span>
          </button>
        </div>
      </div>

      {/* Category Filter Chips (Shown when Categories tab is selected or has categories) */}
      {activeTab === 'category' && categories.length > 0 && (
        <div className="artist-category-chips-row">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`artist-cat-chip ${selectedCategory === 'all' ? 'active' : ''}`}
          >
            <Disc size={13} />
            <span>{t(`सभ श्रेणी (${songs.length})`, `All Categories (${songs.length})`, `सभ श्रेणी (${songs.length})`)}</span>
          </button>
          {categories.map((cat) => {
            const catCount = songs.filter(s => s.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`artist-cat-chip ${selectedCategory === cat ? 'active' : ''}`}
              >
                <span>{getLocalizedCategory(cat, isEnglish)}</span>
                <span className="cat-chip-count">{catCount}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Results Header Count & Page Size Controller */}
      <div className="artist-results-info" ref={tableTopRef} style={{ scrollMarginTop: '100px' }}>
        <div className="artist-results-stats-row">
          <div className="artist-results-count-badge">
            <Music2 size={15} color="#EAB308" />
            <span className="results-count-full">
              {totalItems > 0
                ? (isEnglish
                    ? `Showing ${(currentPage - 1) * pageSize + 1} - ${Math.min(currentPage * pageSize, totalItems)} of ${totalItems} tracks`
                    : (isMaithiliPlus
                        ? `प्रस्तुत ${(currentPage - 1) * pageSize + 1} - ${Math.min(currentPage * pageSize, totalItems)} (कुल ${totalItems} गीत)`
                        : `देखबैत अछि ${(currentPage - 1) * pageSize + 1} - ${Math.min(currentPage * pageSize, totalItems)} (कुल ${totalItems} गीत)`))
                : (isEnglish ? '0 tracks found' : '० गीत उपलब्ध अछि')}
            </span>
            <span className="results-count-mobile">
              {totalItems > 0 ? (isEnglish ? `${totalItems} tracks` : `${totalItems} गीत`) : (isEnglish ? '0 tracks' : '० गीत')}
            </span>
          </div>

          {totalPages > 1 && (
            <span className="artist-current-page-tag">
              {t(`पृष्ठ ${currentPage} / ${totalPages}`, `Page ${currentPage} of ${totalPages}`, `पृष्ठ ${currentPage} / ${totalPages}`)}
            </span>
          )}

          {searchQuery && (
            <span className="artist-search-indicator">
              {t(`&quot;${searchQuery}&quot; लेल परिणाम`, `Results for &quot;${searchQuery}&quot;`, `&quot;${searchQuery}&quot; लेल परिणाम`)}
            </span>
          )}
        </div>

        {/* Per page size selector */}
        {totalItems > 10 && (
          <div className="artist-page-size-selector">
            <span className="page-size-label">{t('प्रति पृष्ठ:', 'Per page:', 'प्रति पृष्ठ:')}</span>
            {[10, 20, 50].map((size) => (
              <button
                key={size}
                onClick={() => setPageSize(size)}
                className={`artist-page-size-btn ${pageSize === size ? 'active' : ''}`}
              >
                {size}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Discography Tracklist Table */}
      {paginatedSongs.length > 0 ? (
        <div className="artist-tracklist-table">
          {/* Header Row */}
          <div className="artist-table-header">
            <span className="col-num">#</span>
            <span className="col-title">{t('गीत (Track Title)', 'Track Title', 'गीत')}</span>
            <span className="col-context">{t('एल्बम / रचनाकार (Album / Writer)', 'Album / Writer', 'एल्बम / रचनाकार')}</span>
            <span className="col-category">{t('विधा / श्रेणी (Category)', 'Category', 'विधा / श्रेणी')}</span>
            <span className="col-plays">{t('श्रोता (Plays)', 'Plays', 'श्रोता')}</span>
            <span className="col-actions">{t('विकल्प (Actions)', 'Actions', 'विकल्प')}</span>
          </div>

          {/* Body Rows */}
          <div className="artist-table-body">
            {paginatedSongs.map((song, index) => {
              const trackNum = (currentPage - 1) * pageSize + index + 1;
              const isThisPlaying = currentTrack?.song?.slug === song.slug && isPlaying;
              const isFav = favoriteSongIds.has(song.id || song.slug);
              const isCopied = copiedSongId === (song.id || song.slug);

              const ytId = song.youtube?.video_id || (song.youtube?.url ? (song.youtube.url.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/)([a-zA-Z0-9_-]{11})/)?.[1]) : null);
              const poster = song.poster?.image_url || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : '/placeholder.jpg');
              const canonical = typeof song.title === 'string'
                ? song.title
                : (song.title?.canonical || song.title?.devanagari || 'मैथिली गीत');
              const romanTitle = typeof song.title?.roman === 'string' ? song.title.roman : '';
              const title = isEnglish ? (romanTitle || canonical) : canonical;
              const plays = song.stats?.plays_count ?? song.stats?.views_count ?? 0;
              const year = song.credits?.year ? String(song.credits.year) : '';

              // Safely extract string for writer, composer, and album to avoid rendering objects
              const writerName = typeof song.credits?.writer === 'object' && song.credits?.writer !== null
                ? (song.credits.writer.name || '')
                : (typeof song.credits?.writer === 'string' ? song.credits.writer : '');
              const composerName = typeof song.credits?.composer === 'object' && song.credits?.composer !== null
                ? (song.credits.composer.name || '')
                : (typeof song.credits?.composer === 'string' ? song.credits.composer : '');
              const albumName = typeof song.credits?.album === 'string' ? song.credits.album : '';
              const albumOrWriter = albumName || writerName || composerName || (isEnglish ? 'Traditional Maithili' : 'पारंपरिक मैथिली गीति');

              const categoryBadgeClass = getCategoryBadgeClass(typeof song.category === 'string' ? song.category : '');

              return (
                <div
                  key={`${song.id || song.slug || 'track'}-${trackNum}`}
                  className={`artist-track-row ${isThisPlaying ? 'is-playing' : ''}`}
                  onClick={() => playTrack(song)}
                >
                  {/* # Index / Play Button / Animated Equalizer */}
                  <div className="col-num">
                    {isThisPlaying ? (
                      <div className="artist-equalizer-bars" title="Playing now">
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>
                    ) : (
                      <>
                        <span className="track-index-num">{trackNum}</span>
                        <button
                          className="artist-play-row-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            playTrack(song);
                          }}
                          aria-label={t('गीत बजाउ', 'Play song', 'गीत बजाउ')}
                          title={t('गीत बजाउ (Play Track)', 'Play Track', 'गीत बजाउ')}
                        >
                          <Play size={14} fill="#EAB308" color="#EAB308" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Thumbnail + Title + Subtitle */}
                  <div className="col-title">
                    <div className="artist-track-thumb-box">
                      <img src={poster} alt={title} className="artist-track-thumb" loading="lazy" />
                      <div className="thumb-hover-overlay">
                        {isThisPlaying ? (
                          <Pause size={18} fill="#EAB308" color="#EAB308" />
                        ) : (
                          <Play size={18} fill="#EAB308" color="#EAB308" />
                        )}
                      </div>
                    </div>

                    <div className="artist-track-text-meta">
                      <div className="track-title-row">
                        <h3 className="artist-track-title font-traditional">
                          {title}
                        </h3>
                        {song.completeness?.has_lyrics && (
                          <span className="track-has-lyrics-tag" title={t('बोल उपलब्ध अछि', 'Lyrics Available', 'बोल उपलब्ध अछि')}>
                            {t('बोल', 'Lyrics', 'बोल')}
                          </span>
                        )}
                      </div>
                      <div className="track-subtitle-row">
                        {song.category && (
                          <span className="track-mobile-cat">{getLocalizedCategory(song.category, isEnglish)} • </span>
                        )}
                        {isBilingual && romanTitle && (
                          <span className="artist-track-roman">
                            {romanTitle}
                          </span>
                        )}
                        {isEnglish && writerName && (
                          <span className="artist-track-roman">
                            {writerName}
                          </span>
                        )}
                        {year && (
                          <span className="track-year-dot">• {year}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Album / Writer Column */}
                  <div className="col-context">
                    <div className="track-context-box" title={albumOrWriter}>
                      <Disc size={13} color="var(--accent-gold)" style={{ opacity: 0.8, flexShrink: 0 }} />
                      <span className="track-context-text">{albumOrWriter}</span>
                    </div>
                  </div>

                  {/* Category Pill with vibrant cultural badge */}
                  <div className="col-category">
                    <span className={`artist-track-cat-pill ${categoryBadgeClass}`}>
                      {getLocalizedCategory(song.category, isEnglish)}
                    </span>
                  </div>

                  {/* True Site Plays & Engagement */}
                  <div className="col-plays">
                    <div className="track-plays-stat" title={isEnglish ? `${plays} total plays` : `${plays} बेर सुनल गेल`}>
                      <Headphones size={13} color="var(--text-muted)" />
                      <span>{formatPlays(plays)}</span>
                    </div>
                  </div>

                  {/* Actions: Lyrics, YouTube, Favorite, Share */}
                  <div className="col-actions" onClick={(e) => e.stopPropagation()}>
                    {/* Lyrics Pill Button */}
                    <Link
                      href={`/songs/${song.slug}`}
                      className="artist-row-link-btn"
                      title={t('बोल आ पूर्ण विवरण (View Lyrics)', 'View Lyrics & Details', 'बोल आ विवरण')}
                    >
                      <FileText size={14} color="#EAB308" />
                      <span>{t('बोल', 'Lyrics', 'बोल')}</span>
                    </Link>

                    {/* YouTube Button */}
                    {song.youtube?.url && (
                      <a
                        href={song.youtube.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="artist-row-yt-btn"
                        title={t('YouTube पर देखू', 'Watch on YouTube', 'YouTube पर देखू')}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="#EF4444" style={{ display: 'block' }}>
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                      </a>
                    )}

                    {/* Add to Playlist Button */}
                    <button
                      className="artist-row-icon-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlaylistSong(song);
                      }}
                      title={t('प्लेलिस्ट में जोड़ू (Add to Playlist)', 'Add to Playlist', 'तालिका में जोड़ू')}
                    >
                      <ListPlus size={15} color="var(--text-muted)" />
                    </button>

                    {/* Favorite Button */}
                    <button
                      className={`artist-row-icon-btn ${isFav ? 'is-favorited' : ''}`}
                      onClick={(e) => handleToggleFavorite(e, song)}
                      title={isFav ? t('पसंदीदा सं हटाउ', 'Remove from Favorites', 'पसंदीदा सं हटाउ') : t('पसंदीदा में जोड़ू', 'Add to Favorites', 'पसंदीदा में जोड़ू')}
                    >
                      <Heart
                        size={15}
                        fill={isFav ? '#EF4444' : 'none'}
                        color={isFav ? '#EF4444' : 'var(--text-muted)'}
                      />
                    </button>

                    {/* Share Button */}
                    <button
                      className="artist-row-icon-btn"
                      onClick={(e) => handleShareSong(e, song)}
                      title={isCopied ? t('कॉपी भेल!', 'Copied!', 'कॉपी भेल!') : t('गीतक लिंक कॉपी करू', 'Copy track link', 'गीतक लिंक कॉपी करू')}
                    >
                      {isCopied ? <Check size={14} color="#10B981" /> : <Share2 size={14} color="var(--text-muted)" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="artist-empty-state">
          <p>{t('कोनो गीत नै भेटल (No tracks found matching your query)', 'No tracks found matching your query', 'कोनो गीत नहि भेटल')}</p>
          <button
            onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
            className="artist-reset-filter-btn"
          >
            {t('फ़िल्टर रीसेट करू (Reset Filters)', 'Reset Filters', 'फ़िल्टर रीसेट करू')}
          </button>
        </div>
      )}

      {/* Modern Floating Pagination Bar */}
      {totalPages > 1 && (
        <div className="artist-pagination-bar">
          <div className="artist-pagination-controls">
            <button
              className="artist-page-nav-btn"
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              title={t('पहिला पृष्ठ (First Page)', 'First Page', 'पहिला पृष्ठ')}
              aria-label="First page"
            >
              <ChevronsLeft size={16} />
            </button>

            <button
              className="artist-page-nav-btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              title={t('पाछू (Previous Page)', 'Previous Page', 'पाछू')}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
              <span className="page-nav-text">{t('पाछू', 'Prev', 'पाछू')}</span>
            </button>

            <div className="artist-page-pills">
              {getPageNumbers().map((p, idx) => {
                if (p === '...') {
                  return <span key={`ellipsis-${idx}`} className="artist-page-ellipsis">...</span>;
                }
                return (
                  <button
                    key={`page-${p}`}
                    onClick={() => handlePageChange(p)}
                    className={`artist-page-pill ${currentPage === p ? 'active' : ''}`}
                    aria-label={`Page ${p}`}
                    aria-current={currentPage === p ? 'page' : undefined}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <button
              className="artist-page-nav-btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              title={t('अगिला (Next Page)', 'Next Page', 'अगिला')}
              aria-label="Next page"
            >
              <span className="page-nav-text">{t('अगिला', 'Next', 'अगिला')}</span>
              <ChevronRight size={16} />
            </button>

            <button
              className="artist-page-nav-btn"
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              title={t('अंतिम पृष्ठ (Last Page)', 'Last Page', 'अंतिम पृष्ठ')}
              aria-label="Last page"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Spotify-Grade Add to Playlist Modal */}
      {playlistSong && (
        <AddToPlaylistModal
          song={playlistSong}
          isOpen={Boolean(playlistSong)}
          onClose={() => setPlaylistSong(null)}
        />
      )}
    </div>
  );
}

