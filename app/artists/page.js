import React from 'react';
import Link from 'next/link';
import { getSongs } from '../../lib/data-service';
import { generateArtistSlug } from '../../lib/slugs';
import { Radio, Music, ArrowRight, Award, Mic } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ArtistsPage() {
  const { songs } = await getSongs({ limit: 1000 });

  // Group by artist
  const artistMap = {};
  for (const s of songs) {
    const singer = s.credits?.singer || 'पारंपरिक';
    if (!artistMap[singer]) {
      artistMap[singer] = {
        name: singer,
        slug: generateArtistSlug(singer),
        count: 0,
        poster: s.poster?.image_url,
        categories: new Set()
      };
    }
    artistMap[singer].count++;
    if (s.category) artistMap[singer].categories.add(s.category);
    if (!artistMap[singer].poster && s.poster?.image_url) {
      artistMap[singer].poster = s.poster.image_url;
    }
  }

  const artists = Object.values(artistMap).sort((a, b) => b.count - a.count);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div className="glass-panel" style={{ padding: '36px 32px' }}>
        <span className="gold-badge" style={{ marginBottom: '12px' }}>स्वर साधक</span>
        <h1 className="font-traditional" style={{ fontSize: '2.4rem', color: '#F8FAFC', marginBottom: '8px' }}>
          लोक साधक एवं गायक (Folk Masters & Artists)
        </h1>
        <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', maxWidth: '800px' }}>
          बिहार कोकिला शारदा सिन्हा, मैथिली ठाकुर, रजनी पल्लवी, देवी, एवं प्राचीन लोक गायक सबहक अमर गायकी।
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '20px'
      }}>
        {artists.map((artist) => (
          <Link
            key={artist.name}
            href={`/search?singer=${encodeURIComponent(artist.name)}`}
            className="glass-panel"
            style={{
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.25s ease',
              border: '1px solid rgba(245, 158, 11, 0.15)'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1E293B, #0F172A)',
                  border: '2px solid rgba(245, 158, 11, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden'
                }}>
                  {artist.poster ? (
                    <img src={artist.poster} alt={artist.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Mic size={24} color="var(--accent-gold)" />
                  )}
                </div>

                <div>
                  <h2 className="font-traditional" style={{ fontSize: '1.25rem', color: '#F8FAFC' }}>
                    {artist.name}
                  </h2>
                  <span style={{ fontSize: '0.78rem', color: 'var(--accent-gold-light)' }}>
                    {artist.count} गीत संकलित
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {Array.from(artist.categories).slice(0, 3).map((cat) => (
                  <span
                    key={cat}
                    style={{
                      fontSize: '0.7rem',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--text-muted)'
                    }}
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '18px',
              fontSize: '0.82rem',
              color: 'var(--accent-gold-light)',
              fontWeight: 600
            }}>
              <span>गीत संग्रह देखू</span>
              <ArrowRight size={14} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
