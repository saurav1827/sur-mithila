'use client';

import React, { useState } from 'react';
import { Play, CheckCircle2, Award, Music, Sparkles, Share2, Heart, MapPin } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';

export default function ArtistHero({ artist, songs = [] }) {
  const { playTrack } = usePlayer();
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

  const bioText = artist.bio?.maithili || artist.bio?.english || 'मिथिला संगीत एवं लोक संस्कृति साधक।';

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
              <span>मिथिला प्रमाणित गायक (Verified)</span>
            </span>

            {artist.origin && (artist.origin.village || artist.origin.district) && (
              <span className="artist-role-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', borderColor: 'rgba(234, 179, 8, 0.4)', color: '#FEF08A' }}>
                <MapPin size={12} color="#EAB308" />
                <span>
                  {artist.origin.village ? `${artist.origin.village}, ` : ''}
                  {artist.origin.district}
                </span>
              </span>
            )}

            {artist.role && (
              <span className="artist-role-badge">
                {artist.role}
              </span>
            )}

            {artist.era && (
              <span className="artist-era-badge">
                {artist.era}
              </span>
            )}
          </div>

          {/* Artist Names */}
          <h1 className="artist-primary-name font-traditional">
            {artist.name_devanagari || artist.name}
          </h1>

          {artist.name_roman && artist.name_roman !== artist.name_devanagari && (
            <p className="artist-roman-name">
              {artist.name_roman}
            </p>
          )}

          {/* Stats Bar */}
          <div className="artist-stats-bar">
            <div className="artist-stat-item">
              <span className="artist-stat-value">{artist.stats?.total_songs || songs.length}</span>
              <span className="artist-stat-label">गीत संकलित (Tracks)</span>
            </div>
            <div className="artist-stat-divider" />
            <div className="artist-stat-item">
              <span className="artist-stat-value">
                {artist.stats?.total_plays ? `${artist.stats.total_plays.toLocaleString()}` : '०'}
              </span>
              <span className="artist-stat-label">साइट प्ले (Site Plays)</span>
            </div>
            <div className="artist-stat-divider" />
            <div className="artist-stat-item">
              <span className="artist-stat-value">{artist.genres?.length || 4}+</span>
              <span className="artist-stat-label">संगीत विधा (Genres)</span>
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
                {bioExpanded ? 'संक्षिप्त करू (Show less)' : 'आर देखू (Read more)...'}
              </button>
            )}
          </div>

          {/* Awards Pills */}
          {artist.awards && artist.awards.length > 0 && (
            <div className="artist-awards-row">
              {artist.awards.map((award, i) => (
                <span key={i} className="artist-award-pill">
                  <Award size={13} color="#EAB308" />
                  <span>{award}</span>
                </span>
              ))}
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
              <span>सभ गीत बजाउ (Play All)</span>
            </button>

            <button
              onClick={() => setFavorited(!favorited)}
              className={`artist-icon-btn ${favorited ? 'active' : ''}`}
              title="पसंद करू (Favorite)"
            >
              <Heart size={18} fill={favorited ? '#EF4444' : 'none'} color={favorited ? '#EF4444' : '#FAFAFA'} />
              <span>{favorited ? 'पसंदीदा' : 'पसंद करू'}</span>
            </button>

            <button
              onClick={handleShare}
              className="artist-icon-btn"
              title="लिंक साझा करू (Share Link)"
            >
              <Share2 size={18} />
              <span>{copied ? 'कॉपी भेल!' : 'साझा करू'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
