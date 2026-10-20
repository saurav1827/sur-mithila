'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Play, Mic, Share2, Heart, Check, Sparkles } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import FavoriteButton from './FavoriteButton';

export default function SongActionButtons({ song }) {
  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const [toastMsg, setToastMsg] = useState('');

  const isCurrentPlaying = currentTrack && currentTrack.song?.slug === song.slug && isPlaying;

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const shareData = {
      title: `${song.title?.canonical || 'Maithili Geet'} - सुर-मिथिला`,
      text: `सुनू मैथिली लोकगीत: ${song.title?.canonical} (गायक: ${song.credits?.singer || 'पारंपरिक'})`,
      url
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // user cancelled or share failed
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        showToast('लिंक कॉपी भऽ गेल! (Link Copied to Clipboard)');
      } catch (err) {
        showToast('Failed to copy link');
      }
    }
  };

  return (
    <>
      <div className="hero-action-pill">
        {/* 1. Play Original Button */}
        <button
          onClick={() => playTrack(song)}
          className="pill-btn-play"
          aria-label={isCurrentPlaying ? 'Playing' : 'Play Original'}
        >
          <Play size={18} fill="#FFFFFF" />
          <span>{isCurrentPlaying ? 'Playing Now' : 'Play Original (गीत सुनू)'}</span>
        </button>

        {/* 2. StarMaker-Style Karaoke Studio CTA */}
        <Link href={`/studio/${song.slug}`} className="pill-btn-studio">
          <Mic size={18} color="var(--neon-saffron)" />
          <span>Sing Karaoke (गाउ)</span>
        </Link>

        {/* 3. Favorite Button */}
        <FavoriteButton song={song} />

        {/* 4. Share Button */}
        <button
          onClick={handleShare}
          className="pill-btn-action"
          title="Share Song"
          aria-label="Share Song"
        >
          <Share2 size={18} />
        </button>
      </div>

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className="sur-toast">
          <Sparkles size={16} color="var(--neon-saffron)" />
          <span>{toastMsg}</span>
        </div>
      )}
    </>
  );
}
