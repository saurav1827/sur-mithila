import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSongBySlug } from '../../../lib/data-service';
import { Music, Play, PlusCircle, Heart, Share2, Disc } from 'lucide-react';
import FavoriteButton from '../../../components/FavoriteButton';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const work = await getSongBySlug(id);
  
  if (!work) return { title: 'Not Found' };
  
  return {
    title: `${work.title?.canonical} (Audio) | Sur-Mithila`,
    description: `All versions and covers for ${work.title?.canonical} on Sur-Mithila.`
  };
}

export default async function WorkPage({ params }) {
  const { id } = await params;
  const work = await getSongBySlug(id);

  if (!work) {
    notFound();
  }

  const title = work.title?.canonical || 'Maithili Geet';
  const writer = work.credits?.writer?.name || 'पारंपरिक';
  const composer = work.credits?.composer?.name || 'पारंपरिक';
  
  const recordings = work.recordings || [];
  const original = recordings.find(r => r.version?.type === 'original') || recordings[0] || {};
  
  // Fake stats for now, later fetched from stats
  const totalPlays = work.stats?.views_count || 1200000;
  const versionsCount = recordings.length;
  
  const formatCompactNumber = (number) => {
    return Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(number);
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Top Banner (Instagram Audio Style) */}
      <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', overflow: 'hidden' }}>
        
        {/* Background Blur Effect */}
        <div style={{ 
          position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', 
          background: `url(${original.poster?.image_url || '/placeholder-music.jpg'}) center/cover`,
          filter: 'blur(100px) brightness(0.2)', zIndex: 0, opacity: 0.6 
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
            
            <div style={{ 
              width: '160px', height: '160px', borderRadius: '16px', overflow: 'hidden', 
              boxShadow: '0 12px 32px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {original.poster?.image_url ? (
                <img src={original.poster.image_url} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Disc size={64} color="var(--text-muted)" />
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Music size={24} color="var(--accent-gold)" />
                <h1 className="font-traditional" style={{ fontSize: '2.4rem', margin: 0, color: '#fff', lineHeight: 1.1 }}>
                  {title}
                </h1>
              </div>
              
              <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                <span><strong>Writer:</strong> {writer}</span>
                <span>•</span>
                <span><strong>Composer:</strong> {composer}</span>
              </div>
              
              <div style={{ marginTop: '8px', padding: '12px', background: 'rgba(0,0,0,0.4)', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '12px', width: 'fit-content' }}>
                <span className="gold-badge">ORIGINAL</span>
                <span style={{ fontWeight: 600, color: '#fff' }}>{original.artist_name || 'Unknown'}</span>
                <span style={{ color: 'var(--text-muted)' }}>{original.release_year}</span>
                <Link href={`/songs/${work.slug}`} className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem', marginLeft: '12px' }}>
                  <Play size={14} /> Play
                </Link>
              </div>

              <div style={{ display: 'flex', gap: '20px', marginTop: '12px', fontSize: '0.9rem', color: '#fff' }}>
                <span><strong>{formatCompactNumber(totalPlays)}</strong> plays</span>
                <span><strong>{versionsCount}</strong> versions</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <Link href={`/studio/${work.slug}`} className="btn-primary">
              <PlusCircle size={18} /> Add your cover
            </Link>
            <FavoriteButton song={work} />
            <button className="btn-secondary">
              <Share2 size={18} /> Share
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Versions */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 className="font-traditional" style={{ fontSize: '1.6rem', color: '#fff' }}>All Versions</h2>
          <select style={{ background: 'var(--bg-card)', color: '#fff', border: '1px solid var(--border-card)', padding: '8px 12px', borderRadius: '8px', outline: 'none' }}>
            <option>Top Plays</option>
            <option>Newest</option>
          </select>
        </div>

        <div className="catalog-grid">
          {recordings.map(rec => {
            const isOriginal = rec.version?.type === 'original';
            const thumbnail = rec.poster?.image_url || rec.youtube?.thumbnail_url || '/placeholder-music.jpg';

            return (
              <Link key={rec.recording_id} href={`/songs/${work.slug}`} className="song-card" style={{ padding: '0', overflow: 'hidden', border: isOriginal ? '1px solid var(--accent-gold)' : '1px solid var(--border-card)' }}>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9' }}>
                  <img src={thumbnail} alt={rec.artist_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', top: '10px', left: '10px' }}>
                    <span className={isOriginal ? 'gold-badge' : 'badge'} style={{ 
                      background: isOriginal ? 'rgba(234, 179, 8, 0.9)' : 'rgba(0,0,0,0.8)',
                      color: isOriginal ? '#000' : '#fff',
                      padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase'
                    }}>
                      {rec.version?.type || 'COVER'}
                    </span>
                  </div>
                </div>
                <div style={{ padding: '16px' }}>
                  <h4 className="font-traditional" style={{ fontSize: '1.1rem', margin: '0 0 6px 0', color: '#fff' }}>{rec.artist_name || 'Unknown Artist'}</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <span>{rec.release_year || 'Unknown Year'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Play size={12} /> {formatCompactNumber(Math.floor(Math.random() * 500000) + 1000)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
