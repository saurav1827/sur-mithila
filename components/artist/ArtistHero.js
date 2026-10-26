'use client';

import React, { useState } from 'react';
import { Play, CheckCircle2, Award, Music, Sparkles, Share2, Heart, MapPin } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { useLanguage, stripEnglishCues } from '../../context/LanguageContext';

export default function ArtistHero({ artist, songs = [] }) {
  const { playTrack } = usePlayer();
  const { t, isEnglish, isMaithiliPlus, isBilingual } = useLanguage();
  const [bioExpanded, setBioExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [favorited, setFavorited] = useState(false);

  const handlePlayAll = () => {
    if (songs.length > 0) {
      playTrack(songs[0]);
    }
  };

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatLocation = (loc) => {
    if (!loc) return '';
    if (isEnglish) {
      const match = loc.match(/\(([A-Za-z0-9\s.,]+)\)/);
      return match ? match[1] : loc;
    }
    if (isMaithiliPlus) {
      return stripEnglishCues(loc);
    }
    return loc;
  };

  const roleText = isEnglish
    ? (artist.role_en || 'Classical & Folk Singer')
    : (isMaithiliPlus ? stripEnglishCues(artist.role) : artist.role);

  const eraText = isEnglish
    ? (artist.era?.includes('Contemporary') ? 'Contemporary Era' : 'Modern Era')
    : (isMaithiliPlus ? stripEnglishCues(artist.era) : artist.era);

  const bioText = isEnglish
    ? (artist.bio?.english || artist.bio?.maithili || 'Maithili folk music exponent and cultural custodian.')
    : (artist.bio?.maithili || artist.bio?.english || 'मिथिला संगीत एवं लोक संस्कृति साधक।');

  return (
    <div className="artist-hero-container">
      {/* Dynamic Background Banner with Gradient Scrim */}
      <div
        className="artist-hero-backdrop"
        style={{
          backgroundImage: `url(${artist.banner_url || artist.avatar_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1600&q=80'})`
        }}
      />
      <div className="artist-hero-scrim" />

      {/* Main Hero Card Content */}
      <div className="artist-hero-content">
        {/* Left: Circular Avatar with Glowing Border */}
        <div className="artist-avatar-wrapper">
          <img
            src={artist.avatar_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80'}
            alt={artist.name_devanagari || artist.name}
            className="artist-avatar-img"
          />
          <div className="artist-avatar-ring" />
        </div>

        {/* Center / Right: Meta & Bio */}
        <div className="artist-meta-wrapper">
          {/* Badges */}
          <div className="artist-badge-row">
            <span className="artist-verified-badge">
              <CheckCircle2 size={14} color="#EAB308" />
              <span>{t('मिथिला प्रमाणित गायक (Verified)', 'Verified Artist', 'मिथिला प्रमाणित गायक')}</span>
            </span>

            {artist.origin && (artist.origin.village || artist.origin.district) && (
              <span className="artist-role-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', borderColor: 'rgba(234, 179, 8, 0.4)', color: '#FEF08A' }}>
                <MapPin size={12} color="#EAB308" />
                <span>
                  {artist.origin.village ? `${formatLocation(artist.origin.village)}, ` : ''}
                  {formatLocation(artist.origin.district)}
                </span>
              </span>
            )}

            {artist.role && (
              <span className="artist-role-badge">
                {roleText}
              </span>
            )}

            {artist.era && (
              <span className="artist-era-badge">
                {eraText}
              </span>
            )}
          </div>

          {/* Artist Names */}
          <h1 className="artist-primary-name font-traditional">
            {isEnglish ? (artist.name_roman || artist.name || artist.name_devanagari) : (artist.name_devanagari || artist.name)}
          </h1>

          {isBilingual && artist.name_roman && artist.name_roman !== artist.name_devanagari && (
            <p className="artist-roman-name">
              {artist.name_roman}
            </p>
          )}

          {/* Stats Bar */}
          <div className="artist-stats-bar">
            <div className="artist-stat-item">
              <span className="artist-stat-value">{artist.stats?.total_songs || songs.length}</span>
              <span className="artist-stat-label">{t('गीत संकलित (Tracks)', 'Tracks', 'गीत संकलित')}</span>
            </div>
            <div className="artist-stat-divider" />
            <div className="artist-stat-item">
              <span className="artist-stat-value">
                {artist.stats?.total_plays ? `${artist.stats.total_plays.toLocaleString()}` : (isEnglish ? '0' : '०')}
              </span>
              <span className="artist-stat-label">{t('साइट प्ले (Site Plays)', 'Site Plays', 'कुल श्रवण')}</span>
            </div>
            <div className="artist-stat-divider" />
            <div className="artist-stat-item">
              <span className="artist-stat-value">{artist.genres?.length || 4}+</span>
              <span className="artist-stat-label">{t('संगीत विधा (Genres)', 'Genres', 'संगीत विधा')}</span>
            </div>
          </div>

          {/* Bio paragraph with expand/collapse */}
          <div className="artist-bio-block">
            <p className={`artist-bio-text ${bioExpanded ? 'expanded' : ''}`}>
              {bioText}
            </p>
            {bioText.length > 140 && (
              <button
                className="artist-bio-toggle"
                onClick={() => setBioExpanded(!bioExpanded)}
              >
                {bioExpanded ? t('संक्षिप्त करू (Show less)', 'Show less', 'संक्षिप्त करू') : t('आर देखू (Read more)...', 'Read more...', 'आर देखू...')}
              </button>
            )}
          </div>

          {/* Awards Pills */}
          {artist.awards && artist.awards.length > 0 && (
            <div className="artist-awards-row">
              {artist.awards.map((award, i) => {
                const awardText = isEnglish
                  ? award
                  : (isMaithiliPlus ? stripEnglishCues(award) : award);
                return (
                  <span key={i} className="artist-award-pill">
                    <Award size={13} color="#EAB308" />
                    <span>{awardText}</span>
                  </span>
                );
              })}
            </div>
          )}

          {/* Action Buttons */}
          <div className="artist-actions-row">
            <button
              onClick={handlePlayAll}
              className="artist-play-all-btn"
              disabled={songs.length === 0}
            >
              <Play size={18} fill="#070913" color="#070913" />
              <span className="artist-play-text">{t('सभ गीत बजाउ (Play All)', 'Play All Tracks', 'सभ गीत बजाउ')}</span>
            </button>

            <button
              onClick={() => setFavorited(!favorited)}
              className={`artist-icon-btn ${favorited ? 'active' : ''}`}
              title={favorited ? t('पसंदीदा', 'Favorited', 'पसंदीदा') : t('पसंद करू (Favorite)', 'Favorite', 'पसंद करू')}
              aria-label={favorited ? t('पसंदीदा', 'Favorited', 'पसंदीदा') : t('पसंद करू', 'Favorite', 'पसंद करू')}
            >
              <Heart size={18} fill={favorited ? '#EF4444' : 'none'} color={favorited ? '#EF4444' : '#FAFAFA'} />
              <span className="artist-icon-btn-text">
                {favorited ? t('पसंदीदा', 'Favorited', 'पसंदीदा') : t('पसंद करू', 'Favorite', 'पसंद करू')}
              </span>
            </button>

            <button
              onClick={handleShare}
              className="artist-icon-btn"
              title={t('लिंक साझा करू (Share Link)', 'Share Link', 'लिंक साझा करू')}
              aria-label={t('लिंक साझा करू', 'Share Link', 'लिंक साझा करू')}
            >
              <Share2 size={18} />
              <span className="artist-icon-btn-text">
                {copied ? t('कॉपी भेल!', 'Copied!', 'कॉपी भेल!') : t('साझा करू', 'Share', 'साझा करू')}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
