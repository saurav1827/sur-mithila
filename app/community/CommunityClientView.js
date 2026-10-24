'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Mic, Sparkles, Flame, Radio, Music, RefreshCw, Trophy,
  Play, CheckCircle, ShieldCheck, Plus, Disc, TrendingUp, Users
} from 'lucide-react';
import PostCard from '../../components/community/PostCard';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

const SUGGESTED_SONGS_TO_COVER = [
  { slug: 'mithila-men-charcha-tohara-00023', title: 'मिथिला में चर्चा तोहर', singer: 'अमित झा', category: 'भगवती गीत' },
  { slug: 'bina-suida-ke-karja-tohara-ge-mai-00009', title: 'बिना सुईद के कर्जा तोहर', singer: 'पारंपरिक', category: 'लोकगीत' },
  { slug: 'mehandi-rachaihen-hathava-men-00005', title: 'मेहँदी रचैहें हथवा में', singer: 'सन्नू कुमार', category: 'विवाह गीत' },
  { slug: 'jatajatina-maithili-gita-00013', title: 'जट-जटिन मैथिली गीत', singer: 'पारंपरिक', category: 'पारंपरिक लोकधारा' },
];

function PostSkeleton() {
  return (
    <div className="feed-post-card" style={{ padding: '24px', marginBottom: '24px' }} aria-hidden>
      <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '16px' }}>
        <div className="sk" style={{ width: 46, height: 46, borderRadius: '50%' }} />
        <div style={{ flex: 1 }}>
          <div className="sk" style={{ height: 16, width: '35%', marginBottom: 8, borderRadius: '6px' }} />
          <div className="sk" style={{ height: 12, width: '20%', borderRadius: '4px' }} />
        </div>
      </div>
      <div className="sk" style={{ height: 120, borderRadius: 16 }} />
    </div>
  );
}

export default function CommunityClientView({ initialItems = [], initialNextOffset = null }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const targetRecordingId = searchParams?.get('recordingId') || searchParams?.get('recording') || searchParams?.get('rec') || null;
  const targetCommentId = searchParams?.get('commentId') || null;
  const shouldOpenComments = searchParams?.get('openComments') === 'true' || Boolean(targetCommentId);

  const [sort, setSort] = useState('latest');
  const [items, setItems] = useState(initialItems);

  // Active targeted card and comment states (updated via URL or in-page notification clicks)
  const [activeTargetId, setActiveTargetId] = useState(targetRecordingId);
  const [activeCommentId, setActiveCommentId] = useState(targetCommentId);
  const [activeOpenComments, setActiveOpenComments] = useState(shouldOpenComments);

  // Sync state if searchParams change via router navigation
  useEffect(() => {
    if (targetRecordingId) {
      setActiveTargetId(targetRecordingId);
      setActiveCommentId(targetCommentId);
      setActiveOpenComments(shouldOpenComments);
    }
  }, [targetRecordingId, targetCommentId, shouldOpenComments]);

  // Robust scroll & highlight helper
  const triggerScrollAndHighlight = useCallback((recId) => {
    if (!recId) return false;
    const el = document.getElementById(`recording-${recId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.remove('card-target-highlight');
      void el.offsetWidth; // trigger reflow to restart CSS animation
      el.classList.add('card-target-highlight');
      setTimeout(() => el.classList.remove('card-target-highlight'), 3500);
      return true;
    }
    return false;
  }, []);

  // Handle in-page notification clicks when user is already on the community page
  useEffect(() => {
    const handleTargetEvent = (e) => {
      const { recordingId, commentId, openComments } = e.detail || {};
      if (!recordingId) return;

      setActiveTargetId(recordingId);
      if (commentId) setActiveCommentId(commentId);
      if (openComments) setActiveOpenComments(true);

      const exists = items.some((p) => (p.id || p._id) === recordingId);
      if (!exists) {
        fetch(`/api/community/recordings?recordingId=${encodeURIComponent(recordingId)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (data?.success && data?.item) {
              setItems((prev) => [data.item, ...prev.filter((p) => (p.id || p._id) !== recordingId)]);
            }
          })
          .catch(console.error);
      }

      // Attempt scroll with graceful retries
      if (!triggerScrollAndHighlight(recordingId)) {
        setTimeout(() => triggerScrollAndHighlight(recordingId), 120);
        setTimeout(() => triggerScrollAndHighlight(recordingId), 350);
        setTimeout(() => triggerScrollAndHighlight(recordingId), 650);
      }
    };

    window.addEventListener('sur_mithila_navigate_target', handleTargetEvent);
    return () => window.removeEventListener('sur_mithila_navigate_target', handleTargetEvent);
  }, [items, triggerScrollAndHighlight]);

  // If a targeted recording was linked via notification and not loaded in initial items, fetch it immediately
  useEffect(() => {
    if (!activeTargetId) return;
    const exists = items.some((p) => (p.id || p._id) === activeTargetId);
    if (!exists) {
      fetch(`/api/community/recordings?recordingId=${encodeURIComponent(activeTargetId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.success && data?.item) {
            setItems((prev) => [data.item, ...prev.filter((p) => (p.id || p._id) !== activeTargetId)]);
          }
        })
        .catch(console.error);
    }
  }, [activeTargetId, items]);

  // Smoothly scroll to the targeted cover card when items or activeTargetId update
  useEffect(() => {
    if (!activeTargetId) return;
    const timer = setTimeout(() => {
      triggerScrollAndHighlight(activeTargetId);
    }, 250);
    return () => clearTimeout(timer);
  }, [activeTargetId, items, triggerScrollAndHighlight]);

  // Dynamically extract distinct authentic creators from feed items
  const activeCreators = React.useMemo(() => {
    const list = [];
    const seen = new Set();
    if (user?.name) seen.add(user.name.toLowerCase());

    for (const p of items) {
      const name = p.user?.name;
      if (name && name !== 'Anonymous' && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        list.push({
          id: p.id,
          userId: p.user?.id || (name ? encodeURIComponent(name.toLowerCase().replace(/\s+/g, '_')) : p.id),
          name,
          avatar: p.user?.avatar,
          songSlug: p.song?.slug,
        });
        if (list.length >= 8) break;
      }
    }
    return list;
  }, [items, user?.name]);
  const [next, setNext] = useState(initialNextOffset);
  const [status, setStatus] = useState('idle');
  const busy = useRef(false);
  const ticket = useRef(0);
  const sentinel = useRef(null);

  const fetchPage = useCallback(async (offset, s, replace) => {
    const mine = ++ticket.current;
    busy.current = true;
    setStatus('loading');
    try {
      const res = await fetch(`/api/community/feed?offset=${offset}&sort=${s}`);
      if (!res.ok) throw new Error();
      const d = await res.json();
      if (mine !== ticket.current) return;
      setItems((prev) => {
        const base = replace ? [] : prev;
        const seen = new Set(base.map((p) => p.id || p._id));
        return [...base, ...d.items.filter((p) => !seen.has(p.id || p._id))];
      });
      setNext(d.nextOffset);
      setStatus('idle');
    } catch {
      if (mine === ticket.current) setStatus('error');
    } finally {
      if (mine === ticket.current) busy.current = false;
    }
  }, []);

  const switchSort = (s) => {
    if (s === sort) return;
    setSort(s);
    setItems([]);
    setNext(null);
    fetchPage(0, s, true);
  };

  const handleDeletePost = useCallback((deletedId) => {
    setItems((prev) => prev.filter((p) => (p.id || p._id) !== deletedId));
  }, []);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || next == null || status === 'error') return;
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && !busy.current && fetchPage(next, sort, false),
      { rootMargin: '1200px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [next, sort, status, fetchPage]);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '10px 0 40px' }}>
      {/* 1. Real Creator Rail (Self Studio + Community Creators) */}
      <div className="story-rail" style={{ marginBottom: '20px' }}>
        {/* User's Own Studio Bubble */}
        <Link href="/profile" className="story-item" style={{ textDecoration: 'none' }}>
          <div className="story-ring add-story">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name || 'Studio'} className="story-avatar" />
            ) : (
              <div style={{
                width: '100%', height: '100%', borderRadius: '50%',
                background: 'linear-gradient(135deg, #10B981, #059669)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
              }}>
                <Mic size={22} />
              </div>
            )}
            <div style={{
              position: 'absolute', bottom: -2, right: -2,
              width: '22px', height: '22px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #10B981, #059669)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #080A10'
            }}>
              <Plus size={14} strokeWidth={3} />
            </div>
          </div>
          <span className="story-label">{t('+ हमर प्रोफाइल', '+ My Profile')}</span>
        </Link>

        {/* Real Community Singers */}
        {activeCreators.map((creator) => (
          <Link
            key={creator.id}
            href={`/profile/${creator.userId || creator.id}`}
            className="story-item"
            style={{ textDecoration: 'none' }}
          >
            <div className="story-ring">
              {creator.avatar ? (
                <img src={creator.avatar} alt={creator.name} className="story-avatar" />
              ) : (
                <div style={{
                  width: '100%', height: '100%', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #EAB308, #D97706)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#070913', fontWeight: 700, fontSize: '1.1rem'
                }}>
                  {creator.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <span className="story-label">{creator.name}</span>
          </Link>
        ))}
      </div>

      {/* 2. Responsive 2-Column Social Feed Layout */}
      <div className="community-feed-layout">
        {/* Main Feed Column */}
        <div>
          {/* Feed Filter & Action Strip */}
          <div className="feed-filter-bar">
            <div className="feed-filter-pills">
              <button
                className={`filter-pill ${sort === 'latest' ? 'active' : ''}`}
                onClick={() => switchSort('latest')}
              >
                <Sparkles size={15} />
                <span>{t('नव प्रस्तुति (Latest)', 'Latest')}</span>
              </button>
              <button
                className={`filter-pill ${sort === 'top' ? 'active' : ''}`}
                onClick={() => switchSort('top')}
              >
                <Flame size={15} />
                <span>{t('लोकप्रिय (Trending)', 'Trending')}</span>
              </button>
            </div>

            <Link href="/#row-trending" className="record-action-btn">
              <Mic size={16} />
              <span>{t('कवर रिकॉर्ड करू', 'Record Cover')}</span>
            </Link>
          </div>

          {/* Posts Stream */}
          {items.map((post) => {
            const isThisTarget = (post.id || post._id) === activeTargetId;
            return (
              <PostCard
                key={post.id || post._id}
                post={post}
                onDeletePost={handleDeletePost}
                initialOpenComments={isThisTarget && activeOpenComments}
                highlightCommentId={isThisTarget ? activeCommentId : null}
                isTargeted={isThisTarget}
              />
            );
          })}

          {/* Loading Skeletons */}
          {status === 'loading' && (
            <>
              <PostSkeleton />
              <PostSkeleton />
            </>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ marginBottom: '14px', fontSize: '0.95rem' }}>{t('लोड नहि भेल।', "Couldn't load posts.")}</p>
              <button
                className="filter-pill active"
                onClick={() => fetchPage(next ?? 0, sort, next == null)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={14} />
                <span>{t('फेर प्रयास करू (Retry)', 'Retry')}</span>
              </button>
            </div>
          )}

          {next != null && <div ref={sentinel} style={{ height: 1 }} />}

          {items.length === 0 && status === 'idle' && (
            <div className="feed-post-card" style={{ padding: '60px 24px', textAlign: 'center' }}>
              <Music size={48} color="var(--neon-saffron)" style={{ marginBottom: '16px', opacity: 0.8 }} />
              <h3 style={{ color: '#F8FAFC', fontSize: '1.4rem', marginBottom: '8px' }}>
                एखन कोनो कवर नहि अछि
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: '24px' }}>
                पहिल लोक गायक अहीं बनू आ सुर-मिथिला समुदाय मे अपन स्वर गुंजाउ!
              </p>
              <Link href="/#row-trending" className="record-action-btn">
                <Mic size={16} />
                <span>गाउ-मिथिला स्टुडियो मे प्रवेश करू</span>
              </Link>
            </div>
          )}

          {items.length > 0 && next == null && status === 'idle' && (
            <div style={{ padding: 24, textAlign: 'center', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              ✨ {t('सभ पोस्ट देखि लेलहुँ। (You’re all caught up!)', "You're all caught up.")}
            </div>
          )}
        </div>

        {/* Right Discovery Sidebar (Desktop Only) */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 1. Studio VIP Banner */}
          <div className="community-sidebar-widget" style={{
            background: 'linear-gradient(135deg, rgba(255, 140, 0, 0.18) 0%, rgba(255, 46, 99, 0.12) 100%)',
            border: '1px solid rgba(255, 140, 0, 0.35)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span className="gold-badge" style={{ fontSize: '0.7rem' }}>🎙️ STARMAKER BOOTH</span>
            </div>
            <h3 className="font-traditional" style={{ fontSize: '1.28rem', color: '#F8FAFC', marginBottom: '6px' }}>
              गाउ-मिथिला स्टुडियो
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '16px' }}>
              अपन मनपसंद मैथिली लोकगीत चुनू, वोकल FX मिलाउ आ समुदाय संग साझा करू।
            </p>
            <Link
              href="/#row-trending"
              className="record-action-btn"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Mic size={16} />
              <span>स्टुडियो मे गाउ (Sing Now)</span>
            </Link>
          </div>

          {/* 2. Trending Songs to Cover */}
          <div className="community-sidebar-widget">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={18} color="var(--neon-saffron)" />
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#F8FAFC' }}>
                  कवर लेल चर्चित गीत
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {SUGGESTED_SONGS_TO_COVER.map((s, idx) => (
                <div key={s.slug || idx} className="karaoke-quick-card">
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #1E293B, #0F172A)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--neon-saffron)',
                    flexShrink: 0
                  }}>
                    <Disc size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link
                      href={`/songs/${s.slug}`}
                      className="font-traditional"
                      style={{
                        display: 'block',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        color: '#F8FAFC',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        textDecoration: 'none'
                      }}
                    >
                      {s.title}
                    </Link>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {s.singer} • {s.category}
                    </span>
                  </div>
                  <Link
                    href={`/studio/${s.slug}`}
                    className="sing-this-btn"
                    style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                  >
                    <Mic size={12} />
                    <span>गाउ</span>
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Community Safety Note */}
          <div className="community-sidebar-widget" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <ShieldCheck size={16} color="var(--accent-emerald)" />
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                NVIDIA NIM AI Screened
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0 }}>
              सुर-मिथिला समुदाय मे समस्त गायन एवं टिप्पणियां AI सुरक्षा प्रणाली द्वारा प्रमाणित कएल जाइत अछि।
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}