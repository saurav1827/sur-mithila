'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Play, Pause, Heart, Radio, CheckCircle, Disc, Mic } from 'lucide-react';
import YoutubeIcon from './YoutubeIcon';
import { usePlayer } from '../context/PlayerContext';

export default function SongCard({ song }) {
  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const [isFavorited, setIsFavorited] = useState(false);

  const title = song?.title?.canonical || song?.title?.devanagari || 'Maithili Geet';
  const romanTitle = song?.title?.roman || '';
  const singer = song?.credits?.singer || 'पारंपरिक';
  const posterUrl = song?.poster?.image_url;
  const hasYoutube = Boolean(song?.youtube?.url || song?.youtube?.video_id);
  const hasAudio = Boolean(song?.audio?.jiosaavn_url || song?.audio?.apple_music_url || song?.audio?.spotify_url || song?.audio?.hosted_audio_url);
  const isVerified = song?.verification?.status === 'verified';

  // Extract cover/recording ID if present
  const coverId = song?.recording_id || song?.cover_id || (typeof song?.id === 'string' && song.id.startsWith('cover-') ? song.id.replace(/^cover-/, '') : null);
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
          title: title,
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
          aria-label={title}
        >
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={title}
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
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>सुर-मिथिला संगीत</span>
            </div>
          )}
        </Link>

        {/* Play Overlay Button */}
        <button
          onClick={handlePlayClick}
          aria-label={`Play ${title}`}
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

        {/* Favorite Heart Button */}
        <button
          onClick={toggleFavorite}
          aria-label="Add to favorites"
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
        {(song.category || coverId) && (
          <span style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            background: coverId ? 'linear-gradient(135deg, rgba(234, 179, 8, 0.95), rgba(217, 119, 6, 0.95))' : 'rgba(8, 10, 16, 0.8)',
            backdropFilter: 'blur(8px)',
            padding: '3px 9px',
            borderRadius: '6px',
            fontSize: '0.7rem',
            color: coverId ? '#070913' : '#FDE047',
            fontWeight: 700,
            border: coverId ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(255, 140, 0, 0.3)',
            zIndex: 5,
            boxShadow: coverId ? '0 2px 8px rgba(234, 179, 8, 0.4)' : 'none'
          }}>
            {coverId ? '🎙️ कवर' : song.category}
          </span>
        )}
      </div>

      {/* Title & Metadata */}
      <div style={{ marginTop: '8px' }}>
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
            {title}
          </h3>
          {romanTitle && (
            <p style={{
              fontSize: '0.76rem',
              color: 'var(--text-muted)',
              marginBottom: '5px',
              textTransform: 'capitalize',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {romanTitle}
            </p>
          )}
        </Link>

        {/* Singer / Artist & Quick Studio CTA */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', minWidth: 0 }}>
          <span style={{
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            minWidth: 0,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{singer}</span>
            {isVerified && <CheckCircle size={12} color="var(--accent-emerald)" style={{ flexShrink: 0 }} />}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {!coverId && (
              <Link
                href={`/studio/${song.slug}`}
                title="Sing Karaoke in Studio"
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
              <span title="Official YouTube Video Available" style={{ display: 'flex', alignItems: 'center' }}>
                <YoutubeIcon size={13} color="#FF2E63" />
              </span>
            )}
            {hasAudio && (
              <span title="Audio Streaming Available" style={{ display: 'flex', alignItems: 'center' }}>
                <Radio size={13} color="#10B981" />
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
