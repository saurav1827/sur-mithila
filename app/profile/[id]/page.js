'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, CheckCircle2, MapPin, Calendar, Share2, Mic,
  Heart, Disc, Sparkles, Music, MessageCircle,
  Check, Edit3, UserPlus, UserCheck, Radio
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import PostCard from '../../../components/community/PostCard';

export default function CreatorProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { t } = useLanguage();

  const rawId = params?.id;
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active Tab: 'covers' | 'activity' | 'about'
  const [activeTab, setActiveTab] = useState('covers');

  // Follow State (stored in localStorage)
  const [isFollowing, setIsFollowing] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);

  useEffect(() => {
    if (!rawId) return;
    loadUserProfile();
  }, [rawId]);

  useEffect(() => {
    if (typeof window !== 'undefined' && profileData?.user?.id) {
      try {
        const follows = JSON.parse(localStorage.getItem('sur_mithila_follows') || '[]');
        setIsFollowing(follows.includes(profileData.user.id));
      } catch { }
    }
  }, [profileData?.user?.id]);

  const loadUserProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(rawId)}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('User not found');
        throw new Error('Failed to load profile');
      }
      const data = await res.json();
      setProfileData(data);
    } catch (err) {
      setError(err.message || 'Error loading profile');
    } finally {
      setLoading(false);
    }
  };

  const isSelf = currentUser && profileData?.user && (
    currentUser.id === profileData.user.id ||
    currentUser.name?.toLowerCase() === profileData.user.name?.toLowerCase()
  );

  const toggleFollow = () => {
    if (!profileData?.user?.id) return;
    const next = !isFollowing;
    setIsFollowing(next);
    try {
      const follows = new Set(JSON.parse(localStorage.getItem('sur_mithila_follows') || '[]'));
      next ? follows.add(profileData.user.id) : follows.delete(profileData.user.id);
      localStorage.setItem('sur_mithila_follows', JSON.stringify([...follows]));
    } catch { }
  };

  const handleShare = async () => {
    const url = window.location.href;
    const shareData = {
      title: `${profileData?.user?.name || 'Artist'} - सुर-मिथिला प्रोफाइल`,
      text: `सुर-मिथिला पर ${profileData?.user?.name || 'कलाकार'} केर गाओल मैथिली लोकगीत सुनू!`,
      url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch { }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCopiedToast(true);
        setTimeout(() => setCopiedToast(false), 2400);
      } catch { }
    }
  };

  const handleDeletePost = (deletedId) => {
    setProfileData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        recordings: (prev.recordings || []).filter(
          (rec) => (rec.recording_id || rec._id) !== deletedId
        ),
        stats: prev.stats
          ? {
              ...prev.stats,
              recordingsCount: Math.max(0, (prev.stats.recordingsCount || 1) - 1),
            }
          : prev.stats,
      };
    });
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '860px', margin: '0 auto', minHeight: '80vh', padding: '24px 16px' }}>
        <div style={{ height: '180px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', marginBottom: '16px' }} className="sk" />
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', marginBottom: '24px' }}>
          <div style={{ width: '88px', height: '88px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} className="sk" />
          <div style={{ flex: 1 }}>
            <div style={{ height: '24px', width: '220px', borderRadius: '6px', marginBottom: '8px' }} className="sk" />
            <div style={{ height: '16px', width: '130px', borderRadius: '4px' }} className="sk" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !profileData?.user) {
    return (
      <div style={{ maxWidth: '640px', margin: '80px auto', textAlign: 'center', padding: '32px' }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#EF4444'
        }}>
          <Disc size={36} />
        </div>
        <h2 style={{ color: '#F8FAFC', fontSize: '1.4rem', marginBottom: '8px' }}>
          {t('कलाकार प्रोफाइल नहि भेटल', 'Artist Profile Not Found')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
          {t('ई प्रोफाइल उपलब्ध नहि अछि वा हटा देल गेल अछि।', 'This creator profile might have changed or does not exist.')}
        </p>
        <Link
          href="/community"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 22px',
            borderRadius: '999px', background: 'linear-gradient(135deg, #EAB308, #CA8A04)',
            color: '#070913', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem'
          }}
        >
          <ArrowLeft size={16} />
          {t('समुदाय पर वापस जाउ', 'Back to Community')}
        </Link>
      </div>
    );
  }

  const { user, recordings = [], recentComments = [] } = profileData;

  const joinYear = user.joined_at ? new Date(user.joined_at).getFullYear() : null;
  const joinMonth = user.joined_at ? new Date(user.joined_at).toLocaleString('default', { month: 'short' }) : null;

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto', minHeight: '90vh', padding: '12px 16px 60px' }}>
      {/* 1. Sticky Navigation Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '18px', padding: '12px 0',
        marginBottom: '6px', position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(7, 9, 19, 0.88)', backdropFilter: 'blur(16px)'
      }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)', color: '#F8FAFC', display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s ease'
          }}
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <h1 className="font-traditional" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#F8FAFC', margin: 0 }}>
              {user.name}
            </h1>
            <CheckCircle2 size={16} color="#EAB308" />
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {recordings.length} {t('प्रस्तुति', 'Recordings')}
          </span>
        </div>
      </div>

      {/* 2. Panoramic Mithila Banner with Madhubani Glass Glow */}
      <div
        style={{
          width: '100%',
          height: '180px',
          borderRadius: '16px',
          position: 'relative',
          overflow: 'hidden',
          background: 'radial-gradient(ellipse at 20% 0%, rgba(234, 179, 8, 0.2) 0%, transparent 60%), linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #070913 100%)',
          border: '1px solid rgba(234, 179, 8, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
        }}
      >
        {/* Subtle Madhubani geometric border lines */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.14,
            backgroundImage: `radial-gradient(#EAB308 1.5px, transparent 1.5px), radial-gradient(#F59E0B 1.5px, transparent 1.5px)`,
            backgroundSize: '24px 24px',
            backgroundPosition: '0 0, 12px 12px',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(7, 9, 19, 0.85) 0%, transparent 70%)',
          }}
        />
        {/* Traditional Heritage Tag */}
        <div style={{
          position: 'absolute', top: 14, right: 16,
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '4px 12px', borderRadius: '999px',
          background: 'rgba(11, 14, 26, 0.65)', border: '1px solid rgba(234, 179, 8, 0.3)',
          color: '#FDE047', fontSize: '0.75rem', fontWeight: 600, backdropFilter: 'blur(8px)'
        }}>
          <Sparkles size={12} />
          <span>सुर-मिथिला लोकगायक</span>
        </div>
      </div>

      {/* 3. Avatar Overlap & Action Strip */}
      <div style={{ padding: '0 12px', position: 'relative', marginBottom: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '-46px', marginBottom: '14px' }}>
          {/* Avatar with Golden Ring Glow */}
          <div style={{ position: 'relative' }}>
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                style={{
                  width: '92px',
                  height: '92px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid #070913',
                  boxShadow: '0 0 0 3px rgba(234, 179, 8, 0.4), 0 8px 24px rgba(0,0,0,0.6)',
                  background: '#0B0E1A',
                }}
              />
            ) : (
              <div
                style={{
                  width: '92px',
                  height: '92px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #EAB308, #D97706)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2.4rem',
                  fontWeight: 800,
                  color: '#070913',
                  border: '3px solid #070913',
                  boxShadow: '0 0 0 3px rgba(234, 179, 8, 0.4), 0 8px 24px rgba(0,0,0,0.6)',
                }}
              >
                {(user.name || 'M').charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Action Buttons Right-Aligned (Twitter Style) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Share Profile Button */}
            <button
              type="button"
              onClick={handleShare}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#F8FAFC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="Share Profile"
            >
              <Share2 size={16} />
            </button>

            {/* If Self: Edit Profile Button. If Other: Follow Button & Sing CTA */}
            {isSelf ? (
              <Link
                href="/profile?tab=details"
                style={{
                  padding: '8px 18px',
                  borderRadius: '999px',
                  border: '1px solid rgba(234, 179, 8, 0.35)',
                  background: 'rgba(234, 179, 8, 0.1)',
                  color: '#FDE047',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background 0.2s ease',
                }}
              >
                <Edit3 size={14} />
                <span>{t('प्रोफाइल सम्पादन', 'Edit Profile')}</span>
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={toggleFollow}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '999px',
                    border: isFollowing ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
                    background: isFollowing ? 'transparent' : '#F8FAFC',
                    color: isFollowing ? '#F8FAFC' : '#070913',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {isFollowing ? (
                    <>
                      <UserCheck size={14} color="#10B981" />
                      <span>{t('फॉलो कएल अछि', 'Following')}</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={14} />
                      <span>{t('फॉलो करू', 'Follow')}</span>
                    </>
                  )}
                </button>

                <Link
                  href="/#row-trending"
                  style={{
                    padding: '8px 18px',
                    borderRadius: '999px',
                    background: 'linear-gradient(135deg, #EAB308, #D97706)',
                    color: '#070913',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 15px rgba(234, 179, 8, 0.3)',
                  }}
                >
                  <Mic size={14} />
                  <span>{t('कवर गाउ', 'Sing Cover')}</span>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Identity */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 className="font-traditional" style={{ fontSize: '1.45rem', fontWeight: 800, color: '#F8FAFC', margin: 0 }}>
              {user.name}
            </h2>
            <CheckCircle2 size={18} color="#EAB308" title="AI Verified Community Creator" />
          </div>
          <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {user.handle}
          </div>
        </div>

        {/* Bio: ONLY rendered if user actually entered one */}
        {user.bio ? (
          <p style={{
            color: '#E2E8F0',
            fontSize: '0.92rem',
            lineHeight: '1.55',
            margin: '0 0 14px 0',
            whiteSpace: 'pre-wrap',
          }}>
            {user.bio}
          </p>
        ) : null}

        {/* Pure Metadata Chips: Location & Calendar ONLY if actually available */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap', fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          {user.location ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <MapPin size={15} color="#EAB308" />
              <span>{user.location}</span>
            </div>
          ) : null}

          {joinYear ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Calendar size={15} />
              <span>{t(`शामिल भेल ${joinMonth} ${joinYear}`, `Joined ${joinMonth} ${joinYear}`)}</span>
            </div>
          ) : null}

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Radio size={14} color="#10B981" />
            <span>{t('सक्रिय गायक', 'Active Artist')}</span>
          </div>
        </div>

        {/* Stats Strip (100% Genuine Data Only) */}
        <div style={{
          display: 'flex',
          gap: '24px',
          padding: '12px 18px',
          borderRadius: '12px',
          background: 'rgba(16, 20, 36, 0.7)',
          border: '1px solid var(--border-card)',
          marginBottom: '16px',
        }}>
          <div>
            <span style={{ fontWeight: 800, color: '#F8FAFC', fontSize: '1.05rem', marginRight: '6px' }}>
              {user.stats?.recordingsCount || recordings.length}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('कवर प्रस्तुति', 'Covers')}</span>
          </div>
          <div>
            <span style={{ fontWeight: 800, color: '#F8FAFC', fontSize: '1.05rem', marginRight: '6px' }}>
              {user.stats?.totalLikes || 0}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('पसंद (Likes)', 'Likes')}</span>
          </div>
          <div>
            <span style={{ fontWeight: 800, color: '#F8FAFC', fontSize: '1.05rem', marginRight: '6px' }}>
              {user.stats?.totalComments || 0}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('टिप्पणी', 'Comments')}</span>
          </div>
        </div>
      </div>

      {/* Copy link toast feedback */}
      {copiedToast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#EAB308', color: '#070913', padding: '10px 20px', borderRadius: '999px',
          fontWeight: 700, fontSize: '0.88rem', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 100,
          display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <Check size={16} />
          <span>{t('प्रोफाइल लिंक कॉपी भऽ गेल!', 'Profile link copied to clipboard!')}</span>
        </div>
      )}

      {/* 4. Sliding Tabs Bar */}
      <div style={{
        display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        marginBottom: '20px', background: 'rgba(7, 9, 19, 0.5)'
      }}>
        {[
          { id: 'covers', label: t('🎙️ कवर प्रस्तुति', '🎙️ Covers & Songs'), count: recordings.length },
          { id: 'activity', label: t('⚡ क्रियाकलाप', '⚡ Activity'), count: recentComments.length },
          { id: 'about', label: t('ℹ️ परिचय', 'ℹ️ About') },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: '14px 12px',
                background: 'transparent',
                border: 'none',
                color: active ? '#F8FAFC' : 'var(--text-secondary)',
                fontWeight: active ? 700 : 500,
                fontSize: '0.92rem',
                cursor: 'pointer',
                position: 'relative',
                transition: 'color 0.2s ease',
              }}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span style={{
                  marginLeft: '6px', fontSize: '0.75rem', padding: '1px 6px',
                  borderRadius: '999px', background: active ? 'rgba(234, 179, 8, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: active ? '#EAB308' : 'var(--text-muted)'
                }}>
                  {tab.count}
                </span>
              )}
              {active && (
                <div style={{
                  position: 'absolute', bottom: 0, left: '20%', right: '20%',
                  height: '3px', borderRadius: '3px', background: '#EAB308'
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* 5. Tab Content Panes */}

      {/* TAB 1: COVERS & RECORDINGS */}
      {activeTab === 'covers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {recordings.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 20px',
              borderRadius: '16px', background: 'rgba(255, 255, 255, 0.02)',
              border: '1px dashed rgba(255, 255, 255, 0.08)'
            }}>
              <Mic size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ color: '#F8FAFC', fontSize: '1.1rem', margin: '0 0 6px 0' }}>
                {t('एखनो कोनो कवर नहि अछि', 'No Covers Recorded Yet')}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
                {isSelf
                  ? t('अपन पसंदीदा मैथिली गीत चुनू आ अपन आवाज मे रिकाॅर्ड करू!', 'Pick a traditional song and record your first cover!')
                  : t('ई कलाकार एखनो कोनो कवर प्रस्तुत नहि केने छथि।', 'This artist has not published any covers yet.')}
              </p>
              {isSelf && (
                <Link
                  href="/#row-trending"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '10px 22px', borderRadius: '999px',
                    background: 'linear-gradient(135deg, #EAB308, #D97706)',
                    color: '#070913', fontWeight: 700, textDecoration: 'none', fontSize: '0.88rem'
                  }}
                >
                  <Mic size={15} />
                  <span>{t('स्टुडियो मे गाउ', 'Open Studio to Sing')}</span>
                </Link>
              )}
            </div>
          ) : (
            recordings.map((rec) => {
              const post = {
                id: rec.recording_id || rec._id,
                user: {
                  id: user.id,
                  name: user.name,
                  avatar: user.avatar,
                },
                song: {
                  slug: rec.song_slug,
                  title: rec.song_title,
                  poster: rec.song_poster,
                  originalSinger: rec.original_singer,
                },
                audioUrl: rec.audio_url,
                duration: Number(rec.duration) || 0,
                likes: rec.likes || 0,
                commentsCount: rec.comments_count || 0,
                createdAt: rec.created_at,
              };

              return <PostCard key={rec._id || rec.recording_id} post={post} onDeletePost={handleDeletePost} />;
            })
          )}
        </div>
      )}

      {/* TAB 2: ACTIVITY */}
      {activeTab === 'activity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {recentComments.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '50px 20px', borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.02)', color: 'var(--text-muted)'
            }}>
              <MessageCircle size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
              <p>{t('कोनो हालिया टिप्पणी उपलब्ध नहि अछि।', 'No recent community comments yet.')}</p>
            </div>
          ) : (
            recentComments.map((cmt) => (
              <div
                key={cmt._id}
                className="glass-panel"
                style={{
                  padding: '16px 18px', borderRadius: '12px',
                  background: 'rgba(16, 20, 36, 0.7)', border: '1px solid var(--border-card)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <MessageCircle size={14} color="#EAB308" />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {t('गीत पर टिप्पणी कएलनि:', 'Commented on song:')}
                  </span>
                  <Link
                    href={`/songs/${cmt.songId}`}
                    style={{ fontSize: '0.82rem', color: '#FDE047', fontWeight: 600, textDecoration: 'none' }}
                  >
                    {cmt.songId}
                  </Link>
                </div>
                <p style={{ margin: 0, color: '#E2E8F0', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  {cmt.text}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: ABOUT (100% PURE ACCURATE DATA) */}
      {activeTab === 'about' && (
        <div className="glass-panel" style={{
          padding: '24px', borderRadius: '16px',
          background: 'rgba(16, 20, 36, 0.7)', border: '1px solid var(--border-card)'
        }}>
          <h3 className="font-traditional" style={{ fontSize: '1.2rem', fontWeight: 700, color: '#F8FAFC', marginBottom: '14px' }}>
            {t('कलाकार परिचय (About the Artist)', 'About the Artist')}
          </h3>

          {user.bio ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: '1.6', marginBottom: '20px' }}>
              {user.bio}
            </p>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', fontStyle: 'italic', marginBottom: '20px' }}>
              {t('कोनो परिचय विवरण उपलब्ध नहि अछि।', 'No bio added yet.')}
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {/* Real Repertoire / Categories */}
            <div style={{ padding: '14px 16px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{t('प्रस्तुति विधा (Repertoire)', 'Repertoire')}</div>
              <div style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.9rem' }}>
                {user.genres && user.genres.length > 0 ? user.genres.join(', ') : '—'}
              </div>
            </div>

            {/* Real Location (if entered) */}
            {user.location ? (
              <div style={{ padding: '14px 16px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{t('स्थान / मूल (Location)', 'Location')}</div>
                <div style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.9rem' }}>{user.location}</div>
              </div>
            ) : null}

            {/* Real Member Since (if entered) */}
            {joinYear ? (
              <div style={{ padding: '14px 16px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{t('सदस्यता काल (Member Since)', 'Member Since')}</div>
                <div style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.9rem' }}>{joinMonth} {joinYear}</div>
              </div>
            ) : null}

            {/* Total Community Impact */}
            <div style={{ padding: '14px 16px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{t('कुल प्रस्तुति (Total Covers)', 'Total Covers')}</div>
              <div style={{ color: '#EAB308', fontWeight: 700, fontSize: '0.9rem' }}>{recordings.length}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
