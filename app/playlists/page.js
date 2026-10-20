import React from 'react';
import { getCuratedPlaylists } from '../../lib/data-service';
import SongCard from '../../components/SongCard';
import { Sparkles, Disc, Music, Play } from 'lucide-react';

export default function PlaylistsPage() {
  const playlists = getCuratedPlaylists();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
      <div className="glass-panel" style={{ padding: '36px 32px' }}>
        <span className="gold-badge" style={{ marginBottom: '12px' }}>विशेष संकलन</span>
        <h1 className="font-traditional" style={{ fontSize: '2.4rem', color: '#F8FAFC', marginBottom: '8px' }}>
          सांस्कृतिक प्लेलिस्ट (Curated Cultural Playlists)
        </h1>
        <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', maxWidth: '800px' }}>
          मिथिलाक विभिन्न पावन अवसर, संस्कार, ऋतु एवं आराध्य देव-देवी लेल विशेष रूप सं संयोजित गीत संकलन।
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
        {playlists.map((pl) => (
          <section key={pl.id} id={pl.slug} className="glass-panel" style={{ padding: '28px' }}>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              marginBottom: '20px',
              paddingBottom: '16px',
              borderBottom: '1px solid var(--border-card)'
            }}>
              <div>
                <span className="gold-badge" style={{ fontSize: '0.7rem', marginBottom: '6px' }}>
                  {pl.badge}
                </span>
                <h2 className="font-traditional" style={{ fontSize: '1.6rem', color: '#F8FAFC' }}>
                  {pl.title}
                </h2>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {pl.description}
                </p>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--accent-gold-light)' }}>
                {pl.songs_count} गीत संगृहीत
              </div>
            </div>

            {/* Songs Grid */}
            <div className="catalog-grid">
              {pl.songs.map((song) => (
                <SongCard key={song.id} song={song} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
