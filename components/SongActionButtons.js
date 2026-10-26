'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Play, Mic, Share2, Heart, Check, Sparkles } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useLanguage } from '../context/LanguageContext';
import FavoriteButton from './FavoriteButton';

export default function SongActionButtons({ song }) {
  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const { t, isEnglish } = useLanguage();
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
      text: isEnglish
        ? `Listen to Maithili folk track: ${song.title?.canonical} (${song.credits?.singer || 'Traditional'})`
        : `सुनू मैथिली लोकगीत: ${song.title?.canonical} (गायक: ${song.credits?.singer || 'पारंपरिक'})`,
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
        showToast(t('लिंक कॉपी भऽ गेल! (Link Copied)', 'Link Copied to Clipboard!', 'लिंक कॉपी भेल!'));
      } catch (err) {
        showToast(t('कॉपी विफल भेल', 'Failed to copy link', 'कॉपी विफल भेल'));
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
          aria-label={isCurrentPlaying ? t('बजि रहल अछि', 'Playing', 'बजि रहल अछि') : t('गीत सुनू (Play Original)', 'Play Original', 'गीत सुनू')}
        >
          <Play size={18} fill="#FFFFFF" />
          <span>{isCurrentPlaying ? t('बजि रहल अछि (Playing)', 'Playing Now', 'बजि रहल अछि') : t('गीत सुनू (Play Original)', 'Play Original', 'गीत सुनू')}</span>
        </button>

        {/* 2. StarMaker-Style Karaoke Studio CTA */}
        <Link href={`/studio/${song.slug}`} className="pill-btn-studio">
          <Mic size={18} color="var(--neon-saffron)" />
          <span>{t('काराओके गाउ (Sing Karaoke)', 'Sing Karaoke', 'काराओके गाउ')}</span>
        </Link>

        {/* 3. Favorite Button */}
        <FavoriteButton song={song} />

        {/* 4. Share Button */}
        <button
          onClick={handleShare}
          className="pill-btn-action"
          title={t('गीत साझा करू (Share Song)', 'Share Song', 'गीत साझा करू')}
          aria-label={t('गीत साझा करू (Share Song)', 'Share Song', 'गीत साझा करू')}
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
