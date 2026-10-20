'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, Share2, Flag, Mic, CheckCircle, Sparkles, Music2, Play, ExternalLink } from 'lucide-react';
import PostPlayer from './PostPlayer';
import CommentThread from './CommentThread';
import { getAnonId } from '../../lib/tracking';

const LIKED_KEY = 'sur_mithila_liked';
const rtf = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' }) : null;

function timeAgo(iso) {
  if (!iso || !rtf) return 'just now';
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const units = [['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [u, sec] of units) if (Math.abs(s) >= sec) return rtf.format(Math.round(s / sec), u);
  return 'just now';
}

export default function PostCard({ post }) {
  const [liked, setLiked] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return JSON.parse(localStorage.getItem(LIKED_KEY) || '[]').includes(post.id);
    } catch {
      return false;
    }
  });
  const [likes, setLikes] = useState(post.likes || 0);
  const [count, setCount] = useState(post.commentsCount || 0);
  const [open, setOpen] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const [toastMsg, setToastMsg] = useState('');
  const inflight = useRef(false);

  const persist = (on) => {
    try {
      const set = new Set(JSON.parse(localStorage.getItem(LIKED_KEY) || '[]'));
      on ? set.add(post.id) : set.delete(post.id);
      localStorage.setItem(LIKED_KEY, JSON.stringify([...set]));
    } catch {}
  };

  const setLike = async (next) => {
    if (inflight.current || next === liked) return;
    inflight.current = true;
    setLiked(next);
    setLikes((n) => Math.max(0, n + (next ? 1 : -1)));
    persist(next);

    try {
      const res = await fetch('/api/community/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordingId: post.id, anonId: getAnonId(), like: next }),
      });
      if (!res.ok) throw new Error();
      setLikes((await res.json()).likes);
    } catch {
      setLiked(!next);
      setLikes((n) => Math.max(0, n + (next ? -1 : 1)));
      persist(!next);
    } finally {
      inflight.current = false;
    }
  };

  const doubleTap = () => {
    setBurstKey((k) => k + 1);
    if (!liked) setLike(true);
  };

  const share = async () => {
    const url = `${location.origin}/songs/${post.song?.slug}`;
    const shareData = {
      title: `${post.user?.name}'s Folk Cover of ${post.song?.title} - सुर-मिथिला`,
      url
    };

    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setToastMsg('Link Copied to Clipboard!');
        setTimeout(() => setToastMsg(''), 2200);
      } catch {}
    }
  };

  return (
    <article className="feed-post-card">
      {/* 1. Header: Creator Avatar, Name & Action Buttons */}
      <div className="post-user-row" style={{ flexWrap: 'wrap', gap: '12px' }}>
        {(() => {
          const profileSlug = post.user?.id || (post.user?.name ? encodeURIComponent(post.user.name.toLowerCase().replace(/\s+/g, '_')) : 'artist');
          const profileUrl = `/profile/${profileSlug}`;

          return (
            <Link
              href={profileUrl}
              className="post-user-info"
              style={{ textDecoration: 'none', cursor: 'pointer', transition: 'opacity 0.2s ease' }}
            >
              <div className="post-avatar-wrap">
                {post.user?.avatar ? (
                  <img
                    className="post-avatar-img"
                    src={post.user.avatar}
                    alt={post.user?.name || 'Singer'}
                    loading="lazy"
                  />
                ) : (
                  <div style={{
                    width: '46px', height: '46px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #EAB308, #D97706)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#070913', fontWeight: 700, fontSize: '1.1rem'
                  }}>
                    {(post.user?.name || 'M').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '0.98rem',
                      color: '#F8FAFC',
                      transition: 'color 0.15s ease'
                    }}
                    className="hover-gold"
                  >
                    {post.user?.name || 'Mithila Singer'}
                  </span>
                  <CheckCircle size={14} color="var(--neon-saffron)" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  <span>@{post.user?.name?.toLowerCase().replace(/\s+/g, '_') || 'artist'}</span>
                  <span>•</span>
                  <span suppressHydrationWarning>{timeAgo(post.createdAt)}</span>
                </div>
              </div>
            </Link>
          );
        })()}

        {/* Action Buttons Strip: View Cover + Sing This + Original */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {post.song?.slug && (
            <Link
              href={`/songs/${post.song.slug}?cover=${post.id}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 14px',
                borderRadius: '999px',
                background: 'linear-gradient(135deg, #EAB308, #D97706)',
                color: '#070913',
                fontWeight: 700,
                fontSize: '0.78rem',
                textDecoration: 'none',
                boxShadow: '0 2px 10px rgba(234, 179, 8, 0.35)',
                transition: 'transform 0.15s ease',
              }}
              title="View Cover in Spotlight Player"
            >
              <Play size={11} fill="#070913" />
              <span>कवर देखू (View Cover)</span>
            </Link>
          )}

          {post.song?.slug && (
            <Link
              href={`/studio/${post.song.slug}`}
              className="sing-this-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                fontSize: '0.78rem',
              }}
            >
              <Mic size={12} />
              <span>Sing This</span>
            </Link>
          )}

          {post.song?.slug && (
            <Link
              href={`/songs/${post.song.slug}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '999px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--text-secondary)',
                fontSize: '0.78rem',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
              title="View Original Song"
            >
              <ExternalLink size={12} />
              <span>मूल गीत (Original)</span>
            </Link>
          )}
        </div>
      </div>

      {/* 2. Song Attribution Tag Chip */}
      <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Music2 size={14} color="var(--neon-saffron)" />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Covering:{' '}
          <Link
            href={`/songs/${post.song?.slug}?cover=${post.id}`}
            className="font-traditional"
            style={{ color: '#FDE047', fontWeight: 600, textDecoration: 'none' }}
          >
            {post.song?.title}
          </Link>
        </span>
      </div>

      {/* 3. Media Player Card with Double-Tap Heart */}
      <PostPlayer post={post} burstKey={burstKey} onDoubleTap={doubleTap} />

      {/* 4. Instagram Action Engagement Bar */}
      <div className="post-actions-bar">
        <div className="post-action-group">
          {/* Like Heart Button */}
          <button
            className={`action-icon-btn ${liked ? 'liked' : ''}`}
            onClick={() => setLike(!liked)}
            aria-pressed={liked}
            aria-label="Like"
          >
            <Heart size={20} fill={liked ? '#FF2E63' : 'none'} color={liked ? '#FF2E63' : 'currentColor'} />
            <span>{likes}</span>
          </button>

          {/* Comments Toggle Button */}
          <button
            className="action-icon-btn"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Comments"
            style={{ color: open ? 'var(--neon-saffron)' : 'var(--text-secondary)' }}
          >
            <MessageCircle size={20} />
            <span>{count}</span>
          </button>

          {/* Share Button */}
          <button
            className="action-icon-btn"
            onClick={share}
            aria-label="Share"
          >
            <Share2 size={19} />
          </button>
        </div>

        <button
          className="action-icon-btn"
          title="Report Post"
          aria-label="Report"
          style={{ color: 'var(--text-muted)' }}
        >
          <Flag size={15} />
        </button>
      </div>

      {/* 5. Threaded Comment Sheet */}
      {open && (
        <div style={{ marginTop: '16px', animation: 'fadeInModal 0.2s ease' }}>
          <CommentThread recordingId={post.id} onApproved={() => setCount((n) => n + 1)} />
        </div>
      )}

      {/* Share Toast */}
      {toastMsg && (
        <div className="sur-toast">
          <Sparkles size={16} color="var(--neon-saffron)" />
          <span>{toastMsg}</span>
        </div>
      )}
    </article>
  );
}