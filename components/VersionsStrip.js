'use client';

import React from 'react';
import Link from 'next/link';
import { PlayCircle, Mic2, Radio, Play } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

export default function VersionsStrip({ workId, recordings, currentRecordingId }) {
  const { playTrack, currentTrack, isPlaying } = usePlayer();

  if (!recordings || recordings.length <= 1) {
    return null;
  }

  return (
    <div className="glass-panel" style={{ padding: '22px', marginTop: '20px', borderRadius: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 className="font-traditional" style={{ fontSize: '1.25rem', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Mic2 size={20} color="var(--neon-saffron)" />
          अन्य संस्करण एवं कवर्स (Versions & Community Covers)
        </h3>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          {recordings.length} Recordings Available
        </span>
      </div>

      <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '8px' }}>
        {recordings.map((rec, idx) => {
          const isCurrent = currentTrack?.recording?.recording_id === rec.recording_id || rec.recording_id === currentRecordingId;
          const thumbnail = rec.poster?.image_url || rec.youtube?.thumbnail_url || (rec.youtube?.video_id ? `https://img.youtube.com/vi/${rec.youtube.video_id}/hqdefault.jpg` : null) || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80';
          const type = rec.version?.type || 'cover';

          return (
            <div
              key={rec.recording_id || rec.id || `rec_${idx}`}
              onClick={() => {
                playTrack(currentTrack?.song || { slug: workId, title: { canonical: rec.artist_name } }, rec);
              }}
              className="song-card"
              style={{
                minWidth: '220px',
                padding: '12px',
                border: isCurrent ? '1px solid var(--neon-saffron)' : '1px solid rgba(255, 255, 255, 0.08)',
                background: isCurrent ? 'rgba(255, 140, 0, 0.12)' : 'rgba(8, 10, 16, 0.65)',
                cursor: 'pointer',
                borderRadius: '14px'
              }}
            >
              <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: '10px', overflow: 'hidden', marginBottom: '10px' }}>
                <img src={thumbnail} alt={rec.artist_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <span
                  style={{
                    position: 'absolute',
                    top: '6px',
                    left: '6px',
                    fontSize: '0.65rem',
                    background: type === 'original' ? 'linear-gradient(135deg, #FF8C00, #FF2E63)' : 'rgba(0,0,0,0.75)',
                    color: '#fff',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    textTransform: 'uppercase',
                    fontWeight: 'bold',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                  }}
                >
                  {type}
                </span>

                {/* Play Icon / Visualizer Overlay */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: isCurrent && isPlaying ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {isCurrent && isPlaying ? (
                    <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                      <div className="visualizer-bar" style={{ height: '18px' }} />
                      <div className="visualizer-bar" style={{ height: '24px' }} />
                      <div className="visualizer-bar" style={{ height: '14px' }} />
                    </div>
                  ) : (
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.9)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#070913'
                    }}>
                      <Play size={16} fill="#070913" style={{ marginLeft: '2px' }} />
                    </div>
                  )}
                </div>
              </div>

              <h4 className="font-traditional" style={{ fontSize: '0.94rem', margin: '0 0 2px 0', color: '#F8FAFC' }}>
                {rec.artist_name || 'Unknown Artist'}
              </h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                {rec.release_year ? `${rec.release_year} • ` : ''}
                {rec.youtube?.video_id ? 'YouTube Performance' : 'Studio Audio'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
