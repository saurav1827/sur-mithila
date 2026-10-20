import React from 'react';
import { getSongs } from '../../lib/data-service';
import SongCard from '../../components/SongCard';
import { Search, Filter, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SearchPage({ searchParams }) {
  const resolvedParams = await searchParams;
  const q = resolvedParams?.q || '';
  const category = resolvedParams?.category || '';
  const singer = resolvedParams?.singer || '';
  const verifiedOnly = resolvedParams?.verified === 'true';
  const hasMediaOnly = resolvedParams?.has_media === 'true';

  const { songs, pagination } = await getSongs({
    query: q,
    category,
    singer,
    verified_only: verifiedOnly,
    has_media_only: hasMediaOnly,
    limit: 48
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Search Header Banner */}
      <div className="glass-panel" style={{ padding: '32px 28px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
        <h1 className="font-traditional" style={{ fontSize: '2rem', color: '#F8FAFC', marginBottom: '8px' }}>
          गीत अन्वेषण (Dual-Script Smart Search)
        </h1>
        <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', marginBottom: '22px' }}>
          देवनागरी अथवा Roman (English) मे खोजू—यथा <em>"Bhairavi"</em>, <em>"भैरवि"</em>, <em>"Sharda Sinha"</em>, <em>"विवाह"</em>, वा <em>"विद्यापति"</em>
        </p>

        {/* Search Input Form */}
        <form method="GET" action="/search" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{
            flex: 1,
            minWidth: '280px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center'
          }}>
            <Search size={20} color="var(--accent-gold)" style={{ position: 'absolute', left: '16px' }} />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="शीर्षक, गायक, रचयिता, अथवा बोलक शब्द..."
              style={{
                width: '100%',
                padding: '14px 16px 14px 48px',
                borderRadius: '12px',
                background: 'rgba(7, 9, 19, 0.8)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                color: '#F8FAFC',
                fontSize: '1rem',
                outline: 'none',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <button type="submit" className="btn-primary" style={{ padding: '0 28px' }}>
            खोजू (Search)
          </button>
        </form>

        {/* Quick Filter Pill Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '16px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>लोकप्रिय खोज:</span>
          {['जय जय भैरवि', 'काँचहि बाँस के बहँगिया', 'शारदा सिन्हा', 'कन्यादान', 'विद्यापति', 'नचारी'].map((term) => (
            <a
              key={term}
              href={`/search?q=${encodeURIComponent(term)}`}
              style={{
                fontSize: '0.78rem',
                padding: '4px 10px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--accent-gold-light)',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}
            >
              {term}
            </a>
          ))}
        </div>
      </div>

      {/* Results Meta */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '1.1rem', color: '#F8FAFC', fontWeight: 600 }}>
          {q ? `"${q}" लेल परिणाम` : 'सकल गीत'}
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
            ({pagination.total} गीत प्राप्त)
          </span>
        </h2>
      </div>

      {/* Results Grid */}
      {songs.length > 0 ? (
        <div className="catalog-grid">
          {songs.map((song) => (
            <SongCard key={song.id} song={song} />
          ))}
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <Sparkles size={40} color="var(--accent-gold)" style={{ margin: '0 auto 16px' }} />
          <h3 className="font-traditional" style={{ fontSize: '1.4rem', color: '#F8FAFC', marginBottom: '8px' }}>
            कोनो गीत नहि भेटल
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            कृपया शब्द वर्तनी जांचू अथवा आन शब्द सं खोजक प्रयास करू।
          </p>
        </div>
      )}
    </div>
  );
}
