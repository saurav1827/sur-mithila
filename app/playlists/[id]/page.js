'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Play, Shuffle, Share2, Check, Trash2, ArrowLeft,
  Music2, Clock, Headphones, FileText, Heart, Disc
} from 'lucide-react';
import { usePlayer } from '../../../context/PlayerContext';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';

export default function PlaylistDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { playPlaylist, playTrack, currentTrack, isPlaying } = usePlayer();
  const { user } = useAuth();
  const { t, formatSongTitle, isEnglish, isMaithiliPlus } = useLanguage();

  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [favoriteSongIds, setFavoriteSongIds] = useState(new Set());

  const playlistId = params?.id;

  useEffect(() => {
    if (!playlistId) return;
    loadPlaylistData(playlistId);

    // Load favorites from localStorage
    try {
      const raw = localStorage.getItem('sur_mithila_guest_favs') || localStorage.getItem('sur_mithila_favorites') || '[]';
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setFavoriteSongIds(new Set(parsed.map(s => s.id || s.slug)));
      }
    } catch { }
  }, [playlistId]);

  const loadPlaylistData = async (id) => {
    setLoading(true);
    try {
      // 1. Fetch from server API
      let serverPlaylist = null;
      try {
        const res = await fetch(`/api/playlists/${encodeURIComponent(id)}`);
        if (res.ok) {
          serverPlaylist = await res.json();
        }
      } catch (e) {
        console.warn('Server playlist fetch note:', e);
      }

      // Check localStorage for local guest data
      let localMatch = null;
      try {
        const raw = localStorage.getItem('sur_mithila_guest_playlists') || '[]';
        const list = JSON.parse(raw);
        localMatch = list.find(p => p.id === id || p.slug === id || (serverPlaylist && (p.id === serverPlaylist.id || (p._id && p._id === serverPlaylist._id))));
      } catch { }

      if (serverPlaylist) {
        // If there are local additions in guest mode that server might not have yet, merge them
        const serverTrackIds = serverPlaylist.track_ids || (serverPlaylist.songs || []).map(s => s.id || s.slug);
        const localTrackIds = localMatch?.track_ids || [];
        const mergedTrackIds = Array.from(new Set([...serverTrackIds, ...localTrackIds]));

        if (mergedTrackIds.length > serverTrackIds.length) {
          try {
            const hydRes = await fetch('/api/playlists/hydrate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ trackIds: mergedTrackIds })
            });
            if (hydRes.ok) {
              const hydData = await hydRes.json();
              serverPlaylist.songs = hydData.songs || [];
              serverPlaylist.track_ids = mergedTrackIds;
            }
          } catch { }
        }

        setPlaylist(serverPlaylist);
        setLoading(false);
        return;
      }

      // 2. If not found on server, fallback to guest playlist in localStorage and hydrate tracks
      if (localMatch) {
        let hydratedSongs = [];
        const trackIds = localMatch.track_ids || [];
        if (trackIds.length > 0) {
          try {
            const hydRes = await fetch('/api/playlists/hydrate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ trackIds })
            });
            if (hydRes.ok) {
              const hydData = await hydRes.json();
              hydratedSongs = hydData.songs || [];
            }
          } catch (e) {
            console.warn('Hydration note:', e);
          }
        }

        const mosaicCovers = hydratedSongs.slice(0, 4).map(s => s.poster?.image_url).filter(Boolean);

        setPlaylist({
          ...localMatch,
          songs: hydratedSongs,
          mosaicCovers,
          songs_count: hydratedSongs.length,
          stats: {
            plays_count: localMatch.stats?.plays_count || 0,
            followers_count: localMatch.stats?.followers_count || 0,
            total_duration_sec: hydratedSongs.length * 240
          }
        });
        setLoading(false);
        return;
      }
    } catch (e) {
      console.warn('Error loading playlist:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTrack = async (e, songToRemove) => {
    e.stopPropagation();
    const songId = songToRemove.id || songToRemove.slug;
    if (!songId || !playlist) return;

    // Optimistically remove from state
    const updatedSongs = (playlist.songs || []).filter(s => (s.id !== songId && s.slug !== songId));
    const updatedTrackIds = (playlist.track_ids || []).filter(id => id !== songId);
    setPlaylist(prev => ({
      ...prev,
      songs: updatedSongs,
      track_ids: updatedTrackIds,
      songs_count: updatedSongs.length
    }));

    // Update in localStorage
    try {
      const raw = localStorage.getItem('sur_mithila_guest_playlists') || '[]';
      let list = JSON.parse(raw);
      list = list.map(p => {
        if (p.id === playlist.id || (p._id && p._id === playlist._id)) {
          return { ...p, track_ids: updatedTrackIds };
        }
        return p;
      });
      localStorage.setItem('sur_mithila_guest_playlists', JSON.stringify(list));
    } catch { }

    // Update on server
    const targetId = playlist._id || playlist.id;
    if (targetId) {
      try {
        await fetch(`/api/playlists/${encodeURIComponent(targetId)}/tracks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ songId, action: 'remove' })
        });
      } catch { }
    }
  };

  const handleShare = () => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleDelete = async () => {
    const confirmPrompt = isEnglish
      ? 'Are you sure you want to delete this playlist?'
      : isMaithiliPlus
      ? 'की अहाँ ई तालिका हटाबऽ चाहैत छी?'
      : 'की अहाँ ई प्लेलिस्ट हटाबऽ चाहैत छी? (Are you sure you want to delete this playlist?)';

    if (!confirm(confirmPrompt)) return;

    if (user && playlist?._id) {
      try {
        await fetch(`/api/playlists/${playlist._id}`, { method: 'DELETE' });
      } catch { }
    } else {
      try {
        const raw = localStorage.getItem('sur_mithila_guest_playlists') || '[]';
        const list = JSON.parse(raw).filter(p => p.id !== playlistId && p.slug !== playlistId);
        localStorage.setItem('sur_mithila_guest_playlists', JSON.stringify(list));
      } catch { }
    }
    router.push('/playlists');
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
        <p>{t('प्लेलिस्ट लोड भऽ रहल अछि...', 'Loading playlist...', 'तालिका लोड भऽ रहल अछि...')}</p>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
        <h2>{t('प्लेलिस्ट नै भेटल (Playlist Not Found)', 'Playlist Not Found', 'तालिका नै भेटल')}</h2>
        <Link href="/playlists" style={{ color: 'var(--accent-gold)', marginTop: '16px', display: 'inline-block' }}>
          {t('← सभ प्लेलिस्ट पर वापस जाउ', '← Back to All Playlists', '← सभ तालिका पर वापस जाउ')}
        </Link>
      </div>
    );
  }

  const songs = playlist.songs || [];
  const totalMins = Math.round((songs.length * 240) / 60);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', minHeight: '100vh', paddingBottom: '80px' }}>
      {/* Back Button */}
      <Link href="/playlists" className="playlist-back-btn">
        <ArrowLeft size={16} />
        <span>{t('सभ प्लेलिस्ट', 'All Playlists', 'सभ तालिका')}</span>
      </Link>

      {/* Spotify-Grade Hero Header */}
      <div className="playlist-detail-hero">
        {/* Cover Artwork */}
        <div className="playlist-detail-cover-box">
          {playlist.mosaicCovers?.length >= 4 ? (
            <div className="playlist-mosaic-grid">
              {playlist.mosaicCovers.slice(0, 4).map((img, i) => (
                <img key={i} src={img} alt="cover tile" className="mosaic-tile" />
              ))}
            </div>
          ) : (playlist.cover_image && !playlist.cover_image.includes('unsplash')) ? (
            <img src={playlist.cover_image} alt={playlist.title} className="playlist-detail-cover" />
          ) : playlist.songs?.[0]?.poster?.image_url ? (
            <img src={playlist.songs[0].poster.image_url} alt={playlist.title} className="playlist-detail-cover" />
          ) : (
            <div className="playlist-default-cover">
              <Disc size={64} color="#EAB308" />
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="playlist-detail-info">
          <span className="playlist-detail-badge">
            {playlist.is_curated
              ? (playlist.badge ? t(playlist.badge, 'Curated Collection', playlist.badge) : t('सांस्कृतिक संकलन', 'Curated Collection', 'सांस्कृतिक संकलन'))
              : t('व्यक्तिगत प्लेलिस्ट', 'Personal Playlist', 'व्यक्तिगत तालिका')}
          </span>

          <h1 className="playlist-detail-title font-traditional">
            {playlist.title}
          </h1>

          {playlist.description && (
            <p className="playlist-detail-desc">
              {playlist.description}
            </p>
          )}

          <div className="playlist-meta-row">
            <span className="meta-creator">
              {playlist.creator?.user_name || 'सुर-मिथिला'}
            </span>
            <span className="meta-dot">•</span>
            <span>{songs.length} {t('गीत (Songs)', 'tracks', 'गीत')}</span>
            {totalMins > 0 && (
              <>
                <span className="meta-dot">•</span>
                <span className="meta-duration">
                  {t(`लगभग ${totalMins} मिनट`, `Approx. ${totalMins} mins`, `लगभग ${totalMins} मिनट`)}
                </span>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="playlist-actions-row">
            <button
              onClick={() => playPlaylist(songs, 0, false)}
              disabled={songs.length === 0}
              className="playlist-play-all-btn"
            >
              <Play size={18} fill="#070913" color="#070913" />
              <span>{t('सभ बजाउ (Play All)', 'Play All', 'सभ बजाउ')}</span>
            </button>

            <button
              onClick={() => playPlaylist(songs, 0, true)}
              disabled={songs.length === 0}
              className="playlist-shuffle-btn"
              title={t('शफल करू (Shuffle Play)', 'Shuffle Play', 'शफल करू')}
            >
              <Shuffle size={16} />
              <span>{t('शफल', 'Shuffle', 'शफल')}</span>
            </button>

            <button
              onClick={handleShare}
              className="playlist-icon-action-btn"
              title={copied ? t('लिंक कॉपी भेल!', 'Link copied!', 'लिंक कॉपी भेल!') : t('शेयर करू (Share)', 'Share', 'शेयर करू')}
            >
              {copied ? <Check size={16} color="#10B981" /> : <Share2 size={16} />}
            </button>

            {!playlist.is_curated && (
              <button
                onClick={handleDelete}
                className="playlist-icon-action-btn delete-btn"
                title={t('प्लेलिस्ट हटाउ (Delete)', 'Delete Playlist', 'तालिका हटाउ')}
              >
                <Trash2 size={16} color="#EF4444" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tracklist Table */}
      {songs.length > 0 ? (
        <div className="artist-tracklist-table">
          <div className="artist-table-header">
            <span className="col-num">#</span>
            <span className="col-title">{t('गीत (Track Title)', 'Track Title', 'गीत')}</span>
            <span className="col-context">{t('एल्बम / रचनाकार (Album / Writer)', 'Album / Writer', 'एल्बम / रचनाकार')}</span>
            <span className="col-category">{t('विधा / श्रेणी (Category)', 'Category', 'विधा / श्रेणी')}</span>
            <span className="col-plays">{t('श्रोता (Plays)', 'Plays', 'श्रोता')}</span>
            <span className="col-actions">{t('विकल्प (Actions)', 'Actions', 'विकल्प')}</span>
          </div>

          <div className="artist-table-body">
            {songs.map((song, index) => {
              const isThisPlaying = currentTrack?.song?.slug === song.slug && isPlaying;
              const ytId = song.youtube?.video_id || (song.youtube?.url ? (song.youtube.url.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/)([a-zA-Z0-9_-]{11})/)?.[1]) : null);
              const poster = song.poster?.image_url || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : '/placeholder.jpg');
              const title = formatSongTitle
                ? formatSongTitle(song)
                : (typeof song.title === 'string' ? song.title : (song.title?.canonical || song.title?.devanagari || 'मैथिली गीत'));
              const romanTitle = isEnglish ? '' : (typeof song.title?.roman === 'string' ? song.title.roman : '');
              const plays = song.stats?.plays_count || 1200;
              const albumOrWriter = song.credits?.album || song.credits?.writer?.name || song.credits?.writer || (isEnglish ? 'Traditional Maithili Geet' : 'पारंपरिक मैथिली गीति');

              return (
                <div
                  key={`${song.id || song.slug}-${index}`}
                  className={`artist-track-row ${isThisPlaying ? 'is-playing' : ''}`}
                  onClick={() => playPlaylist(songs, index, false)}
                >
                  <div className="col-num">
                    {isThisPlaying ? (
                      <div className="artist-equalizer-bars" title="Playing now">
                        <span /><span /><span /><span />
                      </div>
                    ) : (
                      <>
                        <span className="track-index-num">{index + 1}</span>
                        <button
                          className="artist-play-row-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            playPlaylist(songs, index, false);
                          }}
                          aria-label={t('गीत बजाउ', 'Play song', 'गीत बजाउ')}
                        >
                          <Play size={14} fill="#EAB308" color="#EAB308" />
                        </button>
                      </>
                    )}
                  </div>

                  <div className="col-title">
                    <div className="artist-track-thumb-box">
                      <img src={poster} alt={title} className="artist-track-thumb" loading="lazy" />
                    </div>
                    <div className="artist-track-text-meta">
                      <h3 className="artist-track-title font-traditional">{title}</h3>
                      {romanTitle && <span className="artist-track-roman">{romanTitle}</span>}
                    </div>
                  </div>

                  <div className="col-context">
                    <div className="track-context-box" title={albumOrWriter}>
                      <Disc size={13} color="var(--accent-gold)" style={{ opacity: 0.8, flexShrink: 0 }} />
                      <span className="track-context-text">{albumOrWriter}</span>
                    </div>
                  </div>

                  <div className="col-category">
                    <span className="artist-track-cat-pill cat-badge-lokgeet">
                      {song.category || (isEnglish ? 'Maithili Folk' : 'मैथिली लोकगीत')}
                    </span>
                  </div>

                  <div className="col-plays">
                    <div className="track-plays-stat">
                      <Headphones size={13} color="var(--text-muted)" />
                      <span>{(plays / 1000).toFixed(1)}K</span>
                    </div>
                  </div>

                  <div className="col-actions" onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={`/songs/${song.slug}`}
                      className="artist-row-link-btn"
                      title={t('बोल देखू (View Lyrics)', 'View Lyrics', 'बोल देखू')}
                    >
                      <FileText size={14} color="#EAB308" />
                      <span>{t('बोल (Lyrics)', 'Lyrics', 'बोल')}</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <p>
            {t(
              'ई प्लेलिस्ट में अखनि कोनो गीत नै अछि। कोनो सेहो गीतक कार्ड पर जा कऽ प्लेलिस्ट में जोड़ू।',
              'This playlist is empty. Browse songs and add them using the playlist button on any song card.',
              'ई तालिका में अखनि कोनो गीत नै अछि। कोनो सेहो गीतक पत्र पर जा कऽ तालिका में जोड़ू।'
            )}
          </p>
        </div>
      )}
    </div>
  );
}
