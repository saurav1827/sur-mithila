import React from 'react';
import { getArtists } from '../../lib/data-service';
import ArtistsCatalogView from '../../components/artist/ArtistsCatalogView';
import { Mic, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'मैथिली गायक एवं गायिका (Singers & Folk Masters) | सुर-मिथिला',
  description: 'शारदा सिन्हा, मैथिली ठाकुर, पूनम मिश्रा, कुंज बिहारी मिश्र, दिलीप दरभंगिया सहित समस्त प्रसिद्ध मैथिली गायकों के संपूर्ण गीत संग्रह।',
  openGraph: {
    title: 'मैथिली गायक | सुर-मिथिला',
    description: 'The Golden Voices of Mithila - Complete Maithili Singers Catalog'
  }
};

export default async function ArtistsPage() {
  const artists = await getArtists();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '60px' }}>
      {/* Page Header */}
      <div className="glass-panel" style={{ padding: '36px 32px', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '200px',
          height: '200px',
          background: 'radial-gradient(circle, rgba(234, 179, 8, 0.12) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
          <span className="gold-badge">कलाकार संग्रह</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--accent-gold-light)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Sparkles size={13} />
            प्रमाणित स्वर
          </span>
        </div>

        <h1 className="font-traditional" style={{ fontSize: '2.5rem', color: '#F8FAFC', marginBottom: '10px', lineHeight: 1.2 }}>
          मैथिली गायक एवं गायिका (Maithili Singers & Artists)
        </h1>

        <p style={{ fontSize: '1.02rem', color: 'var(--text-secondary)', maxWidth: '850px', lineHeight: 1.5 }}>
          बिहार कोकिला शारदा सिन्हा, मैथिली ठाकुर, पूनम मिश्रा, कुंज बिहारी मिश्र, दिलीप दरभंगिया, माधव राय सहित मिथिलाक समस्त मूर्धन्य गायकों के अमर स्वर आ संपूर्ण संगीत संग्रह।
        </p>
      </div>

      {/* Main Interactive Catalog */}
      <ArtistsCatalogView initialArtists={artists} />
    </div>
  );
}
