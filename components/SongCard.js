'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Play, Pause, Heart, Radio, CheckCircle, Disc, Mic, ListPlus } from 'lucide-react';
import YoutubeIcon from './YoutubeIcon';
import AddToPlaylistModal from './playlist/AddToPlaylistModal';
import { usePlayer } from '../context/PlayerContext';
import { useLanguage } from '../context/LanguageContext';

export default function SongCard({ song }) {
  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const { t, isEnglish, isMaithiliPlus } = useLanguage();
  const [isFavorited, setIsFavorited] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  const rawDevanagari = song?.title?.devanagari || song?.title?.canonical || 'Maithili Geet';
  const romanTitle = song?.title?.roman || '';
  // In English mode, prefer Roman title; otherwise Devanagari
  const displayTitle = isEnglish ? (romanTitle || song?.title?.canonical || rawDevanagari) : rawDevanagari;
  const secondaryTitle = isEnglish ? null : (isMaithiliPlus ? null : romanTitle);

  const singer = song?.credits?.singer || (isEnglish ? 'Traditional' : 'पारंपरिक');
  const ytId = song?.youtube?.video_id || (song?.youtube?.url ? (song.youtube.url.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/)([a-zA-Z0-9_-]{11})/)?.[1]) : null);
  const posterUrl = song?.poster?.image_url || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null);
  const hasYoutube = Boolean(song?.youtube?.url || song?.youtube?.video_id || ytId);
  const hasAudio = Boolean(song?.audio?.jiosaavn_url || song?.audio?.apple_music_url || song?.audio?.spotify_url || song?.audio?.hosted_audio_url);
  const isVerified = song?.verification?.status === 'verified';

  // Extract cover/recording ID and cover artist data if present
  const coverId = song?.recording_id || song?.cover_id || (typeof song?.id === 'string' && song.id.startsWith('cover-') ? song.id.replace(/^cover-/, '') : null);
  const isCover = Boolean(coverId || song?.is_cover || (typeof singer === 'string' && singer.includes('(Cover)')));
  const coverArtistName = song?.cover_artist?.name || (singer ? singer.replace(/\s*\(Cover\)/i, '').trim() : (isEnglish ? 'Community Artist' : 'समुदाय कलाकार'));
  const coverAvatar = song?.cover_artist?.avatar || song?.user_avatar || null;
  const originalSinger = song?.original_singer || null;

  const songUrl = song?.slug ? (coverId ? `/songs/${song.slug}?cover=${encodeURIComponent(coverId)}` : `/songs/${song.slug}`) : '#';

  const isCurrentPlaying = currentTrack?.song?.slug === song?.slug && isPlaying;

  // Check favorite state in localStorage across guest and user keys
  useEffect(() => {
    try {
      const keys = ['sur_mithila_favorites', 'sur_mithila_guest_favs'];
      // Also look for user key if available
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('sur_mithila_favs_')) keys.push(k);
      }
      let found = false;
      for (const k of keys) {
        const raw = localStorage.getItem(k);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list) && list.some(item => item.id === song.id || item.slug === song.slug)) {
            found = true;
            break;
          }
        }
      }
      setIsFavorited(found);
    } catch (e) {}
  }, [song.id, song.slug]);

  const toggleFavorite = (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const storageKey = 'sur_mithila_guest_favs';
      const favsRaw = localStorage.getItem(storageKey) || localStorage.getItem('sur_mithila_favorites') || '[]';
      let favs = JSON.parse(favsRaw);
      if (isFavorited) {
        favs = favs.filter(item => item.id !== song.id && item.slug !== song.slug);
        setIsFavorited(false);
      } else {
        favs.push({
          id: song.id,
          slug: song.slug,
          title: song.title?.canonical || rawDevanagari,
          singer: singer,
          poster: posterUrl,
          category: song.category,
          added_at: new Date().toISOString()
        });
        setIsFavorited(true);
      }
      localStorage.setItem(storageKey, JSON.stringify(favs));
      localStorage.setItem('sur_mithila_favorites', JSON.stringify(favs));
    } catch (e) {}
  };

  const handlePlayClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    playTrack(song);
  };

  return (
    <div className="song-card" style={{ position: 'relative' }}>
      {/* Poster Image Container */}
      <div style={{
        position: 'relative',
        width: '100%',
        paddingTop: '65%',
        borderRadius: '12px',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #13192B 0%, #0B0E1A 100%)',
        border: '1px solid rgba(255, 255, 255, 0.06)'
      }}>
        {/* Full clickable poster link */}
        <Link
          href={songUrl}
          style={{ position: 'absolute', inset: 0, zIndex: 1, textDecoration: 'none' }}
          aria-label={displayTitle}
        >
          {isCover ? (
            <div className="cover-poster-wrap">
              {/* 1. Blurred, darkened ambient original poster */}
              {posterUrl ? (
                <img
                  src={posterUrl}
                  alt={displayTitle}
                  loading="lazy"
                  className="cover-poster-ambient-img"
                />
              ) : (
                <div className="cover-poster-fallback-gradient" />
              )}

              {/* 2. Studio Vignette Scrim */}
              <div className="cover-poster-scrim" />

              {/* 3. Center Studio Spotlight: Avatar with Glowing Mic Ring */}
              <div className="cover-studio-center">
                <div className="cover-avatar-halo">
                  {coverAvatar ? (
                    <img
                      src={coverAvatar}
                      alt={coverArtistName}
                      className="cover-avatar-img"
                    />
                  ) : (
                    <div className="cover-avatar-initial">
                      {coverArtistName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="cover-mic-icon-badge" title={t('कवर स्वर (Vocal Cover)', 'Vocal Cover', 'कवर स्वर')}>
                    <Mic size={10} color="#070913" strokeWidth={2.5} />
                  </span>
                </div>

                {/* Cover Artist Name Ribbon + Live Waveform */}
                <div className="cover-vocal-ribbon">
                  <span className="cover-vocal-name">
                    {coverArtistName}
                  </span>
                  <div className="cover-live-waveform" aria-hidden="true">
                    <span className="wave-bar w1" />
                    <span className="wave-bar w2" />
                    <span className="wave-bar w3" />
                    <span className="wave-bar w4" />
                  </div>
                </div>
              </div>
            </div>
          ) : posterUrl ? (
            <img
              src={posterUrl}
              alt={displayTitle}
              loading="lazy"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transition: 'transform 0.4s ease'
              }}
            />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: 'radial-gradient(circle at center, rgba(255, 140, 0, 0.15) 0%, rgba(11, 14, 26, 0.9) 100%)'
            }}>
              <Disc size={36} color="var(--neon-saffron)" opacity={0.6} />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('सुर-मिथिला संगीत', 'Sur-Mithila Music', 'सुर-मिथिला संगीत')}</span>
            </div>
          )}
        </Link>

        {/* Play Overlay Button */}
        <button
          className="song-card-play-btn"
          onClick={handlePlayClick}
          aria-label={isEnglish ? `Play ${displayTitle}` : `बजाउ ${displayTitle}`}
          title={isEnglish ? 'Play Song' : (isMaithiliPlus ? 'गीत बजाउ' : 'गीत बजाउ (Play)')}
          style={{
            position: 'absolute',
            bottom: '12px',
            right: '12px',
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: isCurrentPlaying
              ? 'linear-gradient(135deg, #FF2E63, #E0218A)'
              : 'linear-gradient(135deg, #FF8C00, #FDE047)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isCurrentPlaying ? '0 0 20px rgba(255, 46, 99, 0.6)' : '0 6px 18px rgba(0, 0, 0, 0.6)',
            cursor: 'pointer',
            border: 'none',
            zIndex: 5,
            transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          {isCurrentPlaying ? (
            <Pause size={20} fill="#FFFFFF" />
          ) : (
            <Play size={20} fill="#070913" color="#070913" style={{ marginLeft: '2px' }} />
          )}
        </button>

        {/* Add to Playlist Button */}
        <button
          className="song-card-playlist-btn"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowPlaylistModal(true);
          }}
          aria-label={t('प्लेलिस्ट में जोड़ू (Add to Playlist)', 'Add to Playlist', 'संगीत-तालिका में जोड़ू')}
          title={t('प्लेलिस्ट में जोड़ू (Add to Playlist)', 'Add to Playlist', 'संगीत-तालिका में जोड़ू')}
          style={{
            position: 'absolute',
            top: '10px',
            right: '48px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            zIndex: 5,
            cursor: 'pointer',
            border: 'none',
            transition: 'transform 0.15s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <ListPlus size={15} color="#EAB308" />
        </button>

        {/* Favorite Heart Button */}
        <button
          className="song-card-fav-btn"
          onClick={toggleFavorite}
          aria-label={isFavorited ? t('पसंदीदा सं हटाउ (Remove Favorite)', 'Remove Favorite', 'मनपसंद सं हटाउ') : t('पसंदीदा में जोड़ू (Add to Favorites)', 'Add to Favorites', 'मनपसंद में जोड़ू')}
          title={isFavorited ? t('पसंदीदा सं हटाउ (Remove Favorite)', 'Remove Favorite', 'मनपसंद सं हटाउ') : t('पसंदीदा में जोड़ू (Add to Favorites)', 'Add to Favorites', 'मनपसंद में जोड़ू')}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isFavorited ? '#FF2E63' : '#fff',
            zIndex: 5,
            cursor: 'pointer',
            border: 'none',
            transition: 'transform 0.15s ease'
          }}
        >
          <Heart size={16} fill={isFavorited ? '#FF2E63' : 'none'} />
        </button>

        {/* Category Badge or Cover Pill on Poster */}
        {(song.category || isCover) && (
          <span
            className="song-card-badge"
            style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              background: isCover ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' : 'rgba(8, 10, 16, 0.8)',
              backdropFilter: 'blur(8px)',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '0.68rem',
              color: isCover ? '#070913' : '#FDE047',
              fontWeight: 700,
              border: isCover ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 140, 0, 0.3)',
              zIndex: 5,
              boxShadow: isCover ? '0 2px 10px rgba(245, 158, 11, 0.4)' : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {isCover ? (
              <>
                <Radio size={11} color="#070913" />
                <span>{t('कवर प्रस्तुति (Cover)', 'Cover Performance', 'कवर प्रस्तुति')}</span>
              </>
            ) : (
              song.category
            )}
          </span>
        )}
      </div>

      {/* Title & Metadata */}
      <div className="song-card-meta" style={{ marginTop: '8px' }}>
        <Link href={songUrl} style={{ textDecoration: 'none' }}>
          <h3 className="font-traditional song-card-title" style={{
            fontSize: '1.02rem',
            fontWeight: 700,
            color: '#F8FAFC',
            lineHeight: 1.3,
            marginBottom: '3px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: '2.5em',
            transition: 'color 0.15s ease'
          }}>
            {displayTitle}
          </h3>
          {secondaryTitle && (
            <p style={{
              fontSize: '0.76rem',
              color: 'var(--text-muted)',
              marginBottom: '5px',
              textTransform: 'capitalize',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {secondaryTitle}
            </p>
          )}
        </Link>

        {/* Singer / Artist & Quick Studio CTA */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', minWidth: 0 }}>
          <span className="song-card-artist-text" style={{
            fontSize: '0.8rem',
            color: isCover ? '#FDE047' : 'var(--text-secondary)',
            fontWeight: isCover ? 600 : 500,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            minWidth: 0,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {isCover && <Radio size={11} color="#10B981" style={{ flexShrink: 0 }} />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isCover ? (isEnglish ? `${coverArtistName} (Cover)` : (isMaithiliPlus ? `${coverArtistName} (कवर)` : `${coverArtistName} (Cover)`)) : singer}
            </span>
            {isVerified && <CheckCircle size={12} color="var(--accent-emerald)" style={{ flexShrink: 0 }} />}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {!coverId && (
              <Link
                href={`/studio/${song.slug}`}
                title={t('स्टूडियो में गाउ (Sing Karaoke)', 'Sing Karaoke in Studio', 'स्टूडियो में गाउ')}
                style={{
                  color: 'var(--neon-saffron)',
                  padding: '3px',
                  borderRadius: '6px',
                  background: 'rgba(255, 140, 0, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Mic size={13} />
              </Link>
            )}

            {hasYoutube && (
              <span title={t('आधिकारिक यूट्यूब वीडियो (Official Video)', 'Official YouTube Video', 'आधिकारिक यूट्यूब वीडियो')} style={{ display: 'flex', alignItems: 'center' }}>
                <YoutubeIcon size={13} color="#FF2E63" />
              </span>
            )}
            {hasAudio && (
              <span title={t('ऑडियो स्ट्रीमिंग उपलब्ध (Audio Streaming)', 'Audio Streaming Available', 'ऑडियो स्ट्रीमिंग उपलब्ध')} style={{ display: 'flex', alignItems: 'center' }}>
                <Radio size={13} color="#10B981" />
              </span>
            )}
          </div>
        </div>

        {/* Original Artist Attribution for Covers */}
        {isCover && originalSinger && (
          <p style={{
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            marginTop: '3px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {t('मूल स्वर: ' + originalSinger, 'Original: ' + originalSinger, 'मूल स्वर: ' + originalSinger)}
          </p>
        )}

        {/* AI Recommendation Reason Banner (Inside Card) */}
        {song?.ai_reason && (
          <div
            className="song-card-ai-badge"
            title={typeof song.ai_reason === 'string' ? song.ai_reason : (isEnglish ? (song.ai_reason.en || song.ai_reason.mai) : (song.ai_reason.mai || song.ai_reason.en))}
          >
            <span style={{ color: 'var(--accent-gold, #EAB308)', display: 'inline-flex', flexShrink: 0, marginTop: '1px' }}>✨</span>
            <span className="song-card-ai-text">
              {typeof song.ai_reason === 'string' ? song.ai_reason : (isEnglish ? (song.ai_reason.en || song.ai_reason.mai) : (song.ai_reason.mai || song.ai_reason.en))}
            </span>
          </div>
        )}
      </div>

      {/* Spotify-Grade Add to Playlist Modal */}
      {showPlaylistModal && (
        <AddToPlaylistModal
          song={song}
          isOpen={showPlaylistModal}
          onClose={() => setShowPlaylistModal(false)}
        />
      )}
    </div>
  );
}

