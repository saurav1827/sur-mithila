import React from 'react';
import Link from 'next/link';
import { getCategories } from '../../lib/data-service';
import { Disc, Music, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div className="glass-panel" style={{ padding: '36px 32px' }}>
        <span className="gold-badge" style={{ marginBottom: '12px' }}>सांस्कृतिक वर्गीकरण</span>
        <h1 className="font-traditional" style={{ fontSize: '2.4rem', color: '#F8FAFC', marginBottom: '8px' }}>
          संस्कार एवं विधा (Sanskars & Musical Categories)
        </h1>
        <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', maxWidth: '800px' }}>
          मिथिलाक जीवन-दर्शन सोलह संस्कार एवं ऋतु चक्र सं आबद्ध अछि। जन्म (सोहर), उपनयन (बटगवनी), विवाह (कोहबर, समदाउन), एवं महापर्व (छठि, महाशिवरात्रि) के आधार पर संगृहीत लोकगीत।
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '20px'
      }}>
        {categories.map((cat) => (
          <Link
            key={cat.name}
            href={`/?category=${encodeURIComponent(cat.name)}`}
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Disc size={20} color="var(--accent-gold)" />
                </div>
                <span className="gold-badge">{cat.count} गीत</span>
              </div>

              <h2 className="font-traditional" style={{ fontSize: '1.3rem', color: '#F8FAFC', marginBottom: '6px' }}>
                {cat.name}
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                पारंपरिक मैथिली लोक परंपरा
              </p>
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
              <span>गीत सूची देखू (Explore)</span>
              <ArrowRight size={14} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
