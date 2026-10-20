'use client';

import React from 'react';
import { ExternalLink, Radio, ShieldCheck, Music2 } from 'lucide-react';
import YoutubeIcon from './YoutubeIcon';

export default function StreamingLinksBar({ youtube, audio, verification, rights }) {
  const hasJioSaavn = Boolean(audio?.jiosaavn_url);
  const hasApple = Boolean(audio?.apple_music_url);
  const hasSpotify = Boolean(audio?.spotify_url);
  const hasYoutube = Boolean(youtube?.url);

  if (!hasJioSaavn && !hasApple && !hasSpotify && !hasYoutube) {
    return null;
  }

  return (
    <div className="glass-panel" style={{ padding: '20px', marginTop: '20px' }}>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        <div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            आधिकारिक संगीत मंच / Official Audio Streaming
          </span>
          <p style={{ fontSize: '0.92rem', fontWeight: 600, color: '#F8FAFC', marginTop: '2px' }}>
            उच्च गुणवत्ता मे सुनू (Stream in High Definition)
          </p>
        </div>

        {/* Buttons Group */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          {hasJioSaavn && (
            <a
              href={audio.jiosaavn_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '10px',
                background: 'rgba(43, 195, 123, 0.15)',
                color: '#6EE7B7',
                border: '1px solid rgba(43, 195, 123, 0.35)',
                fontSize: '0.85rem',
                fontWeight: 600,
                textDecoration: 'none'
              }}
            >
              <Music2 size={16} />
              <span>JioSaavn</span>
              <ExternalLink size={13} />
            </a>
          )}

          {hasApple && (
            <a
              href={audio.apple_music_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '10px',
                background: 'rgba(250, 44, 85, 0.15)',
                color: '#FDA4AF',
                border: '1px solid rgba(250, 44, 85, 0.35)',
                fontSize: '0.85rem',
                fontWeight: 600,
                textDecoration: 'none'
              }}
            >
              <Radio size={16} />
              <span>Apple Music</span>
              <ExternalLink size={13} />
            </a>
          )}

          {hasSpotify && (
            <a
              href={audio.spotify_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '10px',
                background: 'rgba(30, 215, 96, 0.15)',
                color: '#86EFAC',
                border: '1px solid rgba(30, 215, 96, 0.35)',
                fontSize: '0.85rem',
                fontWeight: 600,
                textDecoration: 'none'
              }}
            >
              <Radio size={16} />
              <span>Spotify</span>
              <ExternalLink size={13} />
            </a>
          )}

          {hasYoutube && (
            <a
              href={youtube.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#FCA5A5',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                fontSize: '0.85rem',
                fontWeight: 600,
                textDecoration: 'none'
              }}
            >
              <YoutubeIcon size={16} />
              <span>YouTube Video</span>
              <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
