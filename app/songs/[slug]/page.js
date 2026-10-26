import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSongBySlug } from '../../../lib/data-service';
import SongHeroVideo from '../../../components/SongHeroVideo';
import LyricsTheatre from '../../../components/LyricsTheatre';
import StreamingLinksBar from '../../../components/StreamingLinksBar';
import Recommendations from '../../../components/Recommendations';
import VersionsStrip from '../../../components/VersionsStrip';
import SuggestEditButton from '../../../components/SuggestEditButton';
import SongDetailComments from '../../../components/SongDetailComments';
import SongActionButtons from '../../../components/SongActionButtons';
import { WatchProvider } from '../../../components/WatchProvider';
import { CheckCircle, ShieldCheck, ArrowLeft, Mic } from 'lucide-react';
import TranslatedText from '../../../components/TranslatedText';

import { getDatabase } from '../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const song = await getSongBySlug(slug);
  if (!song) return { title: 'गीत नहि भेटल | Sur-Mithila' };

  const title = song.title?.canonical || 'Maithili Geet';
  const singer = song.credits?.singer || 'पारंपरिक';

  return {
    title: `${title} (${singer}) - मैथिली गीत बोल एवं भिडियो | Sur-Mithila`,
    description: `${title} - गायक: ${singer}, रचयिता: ${song.credits?.writer?.name || 'पारंपरिक'}। सम्पूर्ण मैथिली बोल, देवनागरी एवं रोमन लिपि, युट्यूब भिडियो।`,
    openGraph: {
      title: `${title} - सुर-मिथिला`,
      description: `गायक: ${singer} | मैथिली लोकगीत एवं विद्यापति पद संग्रह`,
      images: song.poster?.image_url ? [{ url: song.poster.image_url }] : []
    }
  };
}

export default async function SongDetailPage({ params, searchParams }) {
  const { slug } = await params;
  const sp = (await searchParams) || {};
  const coverId = sp.cover;

  const song = await getSongBySlug(slug);

  if (!song) {
    notFound();
  }

  let initialCover = null;
  if (coverId) {
    try {
      const db = await getDatabase();
      if (db) {
        const cleanCoverId = String(coverId).replace(/^cover-/, '');
        const found = await db.collection('community_recordings').findOne({
          $or: [
            { recording_id: cleanCoverId },
            { recording_id: coverId },
            ...(ObjectId.isValid(cleanCoverId) && cleanCoverId.length === 24 ? [{ _id: new ObjectId(cleanCoverId) }] : []),
            ...(ObjectId.isValid(coverId) && coverId.length === 24 ? [{ _id: new ObjectId(coverId) }] : [])
          ]
        });
        if (found) {
          let creatorUser = null;
          if (found.user_id) {
            creatorUser = await db.collection('users').findOne(
              { id: found.user_id },
              { projection: { id: 1, is_private: 1 } }
            );
          }

          let allowed = true;
          if (found.is_private || creatorUser?.is_private) {
            const { getAuthRole } = await import('../../../lib/authz');
            const { canViewRecording } = await import('../../../lib/privacy');
            const { userId: viewerUserId, role: viewerRole, email: viewerEmail } = await getAuthRole();
            allowed = canViewRecording({
              recording: found,
              creatorUser,
              viewerUserId,
              viewerRole,
              viewerEmail,
            });
          }

          if (allowed) {
            initialCover = {
              id: found.recording_id || found._id.toString(),
              userName: found.user_name || 'Mithila Singer',
              userAvatar: found.user_avatar || null,
              userId: found.user_id || null,
              audioUrl: found.audio_url,
              likes: found.likes || 0,
              caption: found.caption || '',
              createdAt: found.created_at ? new Date(found.created_at).toISOString() : null,
            };
          }
        }
      }
    } catch (err) {
      console.error('Error fetching cover in song page:', err);
    }
  }

  const title = song.title?.canonical || song.title?.devanagari || 'Maithili Geet';
  const romanTitle = song.title?.roman || '';
  const singer = song.credits?.singer || 'पारंपरिक';
  const writer = song.credits?.writer?.name || 'पारंपरिक';
  const composer = song.credits?.composer?.name || 'पारंपरिक';
  const youtubeId = song.youtube?.video_id;
  const posterUrl = song.poster?.image_url;
  const sources = song.verification?.sources || [];

  // Schema.org Structured Data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MusicComposition',
    name: title,
    alternateName: romanTitle,
    composer: {
      '@type': 'Person',
      name: writer
    },
    lyricist: {
      '@type': 'Person',
      name: writer
    },
    inLanguage: 'mai',
    genre: song.category || 'Maithili Folk',
    recordedAs: {
      '@type': 'MusicRecording',
      byArtist: {
        '@type': 'Person',
        name: singer
      },
      image: posterUrl
    }
  };

  return (
    <WatchProvider>
      <div className="watch-layout">
        
        {/* Schema.org Script */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        {/* Back Navigation Bar */}
        <div style={{ marginBottom: '16px' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.88rem',
              color: 'var(--text-secondary)',
              transition: 'color 0.2s ease',
              textDecoration: 'none'
            }}
          >
            <ArrowLeft size={16} />
            <span>
              <TranslatedText maithili="पाछू जाउ (Back to Catalog)" english="Back to Catalog" maithiliPlus="पाछू जाउ" />
            </span>
          </Link>
        </div>

        <section className="watch-primary">
          {/* 1. Ambient Hero Header (Spotify-Style) */}
          <div className="ambient-hero-container" style={{ padding: '32px' }}>
            <div className="ambient-glow-halo" />

            <div style={{
              display: 'grid',
              gridTemplateColumns: youtubeId ? '1fr 1.15fr' : '260px 1fr',
              gap: '32px',
              alignItems: 'center',
              position: 'relative',
              zIndex: 1
            }} className="detail-hero-grid">

              {/* Media / YouTube Embed or High-Res Poster or Community Cover */}
              <SongHeroVideo
                youtubeId={youtubeId}
                posterUrl={posterUrl}
                title={title}
                song={song}
                initialCover={initialCover}
              />

              {/* Title, Badges, Action Pills & Credits */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  <span className="gold-badge">{song.category}</span>
                  {song.traditional_raga && (
                    <span style={{
                      fontSize: '0.72rem',
                      padding: '4px 10px',
                      borderRadius: '9999px',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: '#93C5FD',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      fontWeight: 600
                    }}>
                      राग: {song.traditional_raga}
                    </span>
                  )}
                  {song.verification?.status === 'verified' && (
                    <span className="vermilion-badge">
                      <CheckCircle size={13} />
                      सत्यापित रचना
                    </span>
                  )}
                </div>

                <div>
                  <h1 className="font-traditional" style={{ fontSize: '2.4rem', color: '#F8FAFC', lineHeight: 1.15 }}>
                    {title}
                  </h1>
                  {romanTitle && (
                    <p style={{ fontSize: '1.05rem', color: '#FDE047', marginTop: '4px', fontWeight: 500 }}>
                      {romanTitle}
                    </p>
                  )}
                </div>

                {/* Spotify/StarMaker Action Buttons */}
                <SongActionButtons song={song} />

                {/* Verified Credits Table */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px',
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'rgba(8, 10, 16, 0.65)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  marginTop: '8px'
                }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      <TranslatedText maithili="गायक (Singer)" english="Singer" maithiliPlus="गायक" />
                    </span>
                    <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#F8FAFC' }}>{singer}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      <TranslatedText maithili="रचयिता (Lyricist)" english="Lyricist" maithiliPlus="रचयिता" />
                    </span>
                    <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#F8FAFC' }}>{writer}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      <TranslatedText maithili="संगीतकार (Composer)" english="Composer" maithiliPlus="संगीतकार" />
                    </span>
                    <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#F8FAFC' }}>{composer}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      <TranslatedText maithili="एल्बम (Album)" english="Album" maithiliPlus="एल्बम" />
                    </span>
                    <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#F8FAFC' }}>{song.credits?.album || 'पारंपरिक लोकधारा'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Versions & User Covers Strip */}
            <VersionsStrip workId={song.slug} recordings={song.recordings} currentRecordingId={`rec_${song.id}`} />
          </div>

          {/* 2. Interactive Synchronized Lyrics Theatre */}
          <LyricsTheatre
            lyrics={song.lyrics}
            canonicalTitle={title}
            writer={writer}
            traditionalRaga={song.traditional_raga}
            song={song}
          />

          {/* 3. Official Audio Streaming Platforms Bar (BELOW LYRICS) */}
          <StreamingLinksBar
            youtube={song.youtube}
            audio={song.audio}
            verification={song.verification}
            rights={song.rights}
          />

          {/* 4. Gaau Mithila StarMaker Karaoke Studio Banner (BELOW LYRICS) */}
          <div className="glass-panel" style={{
            padding: '24px 28px',
            marginTop: '20px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            background: 'linear-gradient(135deg, rgba(255, 140, 0, 0.15), rgba(255, 46, 99, 0.08))',
            border: '1px solid rgba(255, 140, 0, 0.35)',
            borderRadius: '16px'
          }}>
            <div>
              <h3 className="font-traditional" style={{ fontSize: '1.35rem', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <span style={{ fontSize: '1.5rem' }}>🎙️</span>
                <TranslatedText
                  maithili="गाउ-मिथिला स्टुडियो (Gaau-Mithila Karaoke Studio)"
                  english="Gaau-Mithila Karaoke Studio"
                  maithiliPlus="गाउ-मिथिला स्टुडियो"
                />
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '600px' }}>
                <TranslatedText
                  maithili="अपन स्वर मे एहि गीत कें रिकाॅर्ड करू, वोकल FX लगाउ आ सुर-मिथिला सोशल फीड पर साझा करू!"
                  english="Record this song in your voice, apply vocal FX, and share to the Sur-Mithila social feed!"
                  maithiliPlus="अपन स्वर मे एहि गीत कें रिकाॅर्ड करू, ध्वनि प्रभाव लगाउ आ सुर-मिथिला सामाजिक मंच पर साझा करू!"
                />
              </p>
            </div>
            <Link
              href={`/studio/${slug}`}
              style={{
                padding: '12px 24px',
                borderRadius: '9999px',
                background: 'linear-gradient(135deg, #10B981, #059669)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.95rem',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 6px 18px rgba(16, 185, 129, 0.35)',
                transition: 'transform 0.15s ease'
              }}
            >
              <Mic size={18} />
              <span>
                <TranslatedText
                  maithili="रिकाॅर्ड करू (Sing Cover)"
                  english="Sing Cover"
                  maithiliPlus="रिकाॅर्ड करू"
                />
              </span>
            </Link>
          </div>

          {/* 5. AI Moderated Comments Section (BELOW LYRICS) */}
          <div style={{ marginTop: '24px' }}>
            <SongDetailComments songId={song.id} songTitle={title} initialCover={initialCover} />
          </div>

          {/* 6. Data Provenance & Source Audit Trail */}
          <div className="glass-panel" style={{ padding: '24px', marginTop: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={20} color="var(--accent-emerald)" />
                <h3 className="font-traditional" style={{ fontSize: '1.2rem', color: '#F8FAFC', margin: 0 }}>
                  <TranslatedText
                    maithili="डेटा प्रमाणिकता एवं स्रोत (Data Provenance)"
                    english="Data Provenance & Sources"
                    maithiliPlus="डेटा प्रमाणिकता एवं स्रोत"
                  />
                </h3>
              </div>
              <SuggestEditButton song={song} />
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              <TranslatedText
                maithili="एहि रचनाक लेखक, गायक एवं युट्यूब भिडियो लिंकक निर्धारण निम्नलिखित प्रामाणिक स्रोतों सं कएल गेल अछि:"
                english="The lyricist, singer, and video sources for this composition were verified from the following sources:"
                maithiliPlus="एहि रचनाक लेखक, गायक एवं भिडियो लिंकक निर्धारण निम्नलिखित प्रामाणिक स्रोतों सं कएल गेल अछि:"
              />
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sources.map((src, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    fontSize: '0.82rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: '1 1 240px' }}>
                    <span className="gold-badge" style={{ fontSize: '0.65rem', flexShrink: 0 }}>{src.type}</span>
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: 'var(--text-secondary)',
                        wordBreak: 'break-all',
                        overflowWrap: 'anywhere',
                        fontSize: '0.8rem',
                        lineHeight: 1.35,
                        textDecoration: 'underline',
                        textDecorationColor: 'rgba(255,255,255,0.2)'
                      }}
                    >
                      {src.url}
                    </a>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    सत्यापित तिथि: {src.checked_at || '2026-09-26'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Up Next / Recommendations Sidebar */}
        <aside className="watch-side">
          <Recommendations currentSongId={song.id} />
        </aside>

      </div>
    </WatchProvider>
  );
}
