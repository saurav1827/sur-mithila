'use client';

import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Heart, MessageCircle, Share2, Flag, Mic, CheckCircle,
  Sparkles, Music2, Play, ExternalLink, Trash2, Loader2, X
} from 'lucide-react';
import PostPlayer from './PostPlayer';
import CommentThread from './CommentThread';
import { getAnonId } from '../../lib/tracking';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const LIKED_KEY = 'sur_mithila_liked';
const rtf = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' }) : null;

function timeAgo(iso) {
  if (!iso || !rtf) return 'just now';
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const units = [['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [u, sec] of units) if (Math.abs(s) >= sec) return rtf.format(Math.round(s / sec), u);
  return 'just now';
}

export default function PostCard({
  post,
  onDeletePost,
  initialOpenComments = false,
  highlightCommentId = null,
  isTargeted = false
}) {
  const { user, openSignIn } = useAuth();
  const { t } = useLanguage();

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
  const [open, setOpen] = useState(initialOpenComments);
  const [burstKey, setBurstKey] = useState(0);
  const [toastMsg, setToastMsg] = useState('');
  const inflight = useRef(false);

  // Automatically open comments if instructed by notification route
  useEffect(() => {
    if (initialOpenComments) {
      setOpen(true);
    }
  }, [initialOpenComments]);

  // Moderation state
  const [isDeleted, setIsDeleted] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('harassment');
  const [reportDetails, setReportDetails] = useState('');
  const [reporting, setReporting] = useState(false);

  const isOwner = Boolean(
    user && (
      (post.user?.id && user.id === post.user.id) ||
      (post.user?.name && user.name && post.user.name.trim().toLowerCase() === user.name.trim().toLowerCase())
    )
  );
  const canDeletePost = isOwner || user?.role === 'admin';

  const persist = (on) => {
    try {
      const set = new Set(JSON.parse(localStorage.getItem(LIKED_KEY) || '[]'));
      on ? set.add(post.id) : set.delete(post.id);
      localStorage.setItem(LIKED_KEY, JSON.stringify([...set]));
    } catch { }
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
      try { await navigator.share(shareData); } catch { }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setToastMsg('Link Copied to Clipboard!');
        setTimeout(() => setToastMsg(''), 2200);
      } catch { }
    }
  };

  const handleDeletePost = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/community/recordings?recordingId=${encodeURIComponent(post.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setToastMsg(t('रिकॉर्डिंग हटाओल गेल', 'Recording deleted successfully'));
        setDeleteConfirmOpen(false);
        setIsDeleted(true);
        onDeletePost?.(post.id);
      } else {
        alert(data.error || 'Failed to delete recording');
      }
    } catch (err) {
      console.error('[PostCard] Delete error:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleReportPost = async (e) => {
    e.preventDefault();
    if (!reportReason) return;
    setReporting(true);
    try {
      const res = await fetch('/api/community/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: 'post',
          targetId: String(post.id),
          reason: reportReason,
          details: reportDetails,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReportModalOpen(false);
        setToastMsg(t('रिपोर्ट दर्ज कएल गेल। धन्यवाद।', 'Report submitted. Thank you for keeping our community safe.'));
        setReportReason('harassment');
        setReportDetails('');
      } else {
        alert(data.error || 'Failed to submit report');
      }
    } catch (err) {
      console.error('[PostCard] Report error:', err);
    } finally {
      setReporting(false);
    }
  };

  if (isDeleted) return null;

  return (
    <article
      id={`recording-${post.id}`}
      className={`feed-post-card ${isTargeted ? 'card-target-highlight' : ''}`}
      style={{ transition: 'all 0.3s ease' }}
    >
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

          {canDeletePost && (
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 14px',
                borderRadius: '999px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#EF4444',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title={t('अपन रिकॉर्डिंग हटाउ', 'Delete your recording')}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.22)';
                e.currentTarget.style.borderColor = '#EF4444';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
              }}
            >
              <Trash2 size={12} />
              <span>{t('हटाउ (Delete)', 'Delete')}</span>
            </button>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {canDeletePost && (
            <button
              type="button"
              className="action-icon-btn"
              title={t('रिकॉर्डिंग हटाउ', 'Delete Recording')}
              aria-label="Delete"
              onClick={() => setDeleteConfirmOpen(true)}
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <Trash2 size={16} />
            </button>
          )}

          {!isOwner && (
            <button
              type="button"
              className="action-icon-btn"
              title={t('पोस्ट रिपोर्ट करू', 'Report Post')}
              aria-label="Report"
              onClick={() => {
                if (!user) {
                  openSignIn();
                  return;
                }
                setReportModalOpen(true);
              }}
              style={{ color: 'var(--text-muted)' }}
            >
              <Flag size={15} />
            </button>
          )}
        </div>
      </div>

      {/* 5. Threaded Comment Sheet */}
      {open && (
        <div style={{ marginTop: '16px', animation: 'fadeInModal 0.2s ease' }}>
          <CommentThread
            recordingId={post.id}
            recordingAuthorId={post.user?.id}
            highlightCommentId={highlightCommentId}
            onApproved={() => setCount((n) => n + 1)}
            onCommentDeleted={() => setCount((n) => Math.max(0, n - 1))}
          />
        </div>
      )}

      {/* 6. Delete Post Confirmation Modal */}
      {deleteConfirmOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setDeleteConfirmOpen(false)}
        >
          <div
            style={{
              background: '#111827',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '400px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#EF4444', marginBottom: '12px' }}>
              <Trash2 size={22} />
              <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#FAFAFA' }}>
                {t('रिकॉर्डिंग हटाउ?', 'Delete recording post?')}
              </h4>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '0 0 20px 0', lineHeight: '1.5' }}>
              {t(
                'की अहाँ सचमुच ई कम्युनिटी रिकॉर्डिंग हटाबय चाहैत छी? एकर सभटा टिप्पणी आ लाइक सेहो हटाओल जायत।',
                'Are you sure you want to delete this community recording? All associated comments and likes will also be removed permanently.'
              )}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '999px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.84rem',
                }}
              >
                {t('रद्द करू', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeletePost}
                style={{
                  padding: '8px 20px',
                  borderRadius: '999px',
                  background: '#EF4444',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontSize: '0.84rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {deleting ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                <span>{t('हटाउ', 'Delete Post')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Report Post Modal */}
      {reportModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setReportModalOpen(false)}
        >
          <div
            style={{
              background: '#111827',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '420px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#EAB308' }}>
                <Flag size={18} />
                <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#FAFAFA' }}>
                  {t('रिकॉर्डिंग रिपोर्ट करू', 'Report recording')}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReportPost}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  {t('रिपोर्टक कारण चुनू:', 'Select reason for reporting:')}
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    { id: 'harassment', label: 'Harassment or hate speech / दुर्व्यवहार' },
                    { id: 'inappropriate', label: 'Inappropriate or vulgar audio / अनुचित ऑडियो' },
                    { id: 'spam', label: 'Spam, misleading or scam / स्पैम' },
                    { id: 'copyright', label: 'Copyright violation / कॉपीराइट' },
                    { id: 'other', label: 'Other violation / अन्य' },
                  ].map((opt) => (
                    <label
                      key={opt.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.82rem',
                        color: reportReason === opt.id ? '#EAB308' : '#F8FAFC',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        background: reportReason === opt.id ? 'rgba(234, 179, 8, 0.12)' : 'rgba(255,255,255,0.03)',
                        border: reportReason === opt.id ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="reportReason"
                        value={opt.id}
                        checked={reportReason === opt.id}
                        onChange={() => setReportReason(opt.id)}
                        style={{ accentColor: '#EAB308' }}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder={t('अतिरिक्त विवरण लिखू (वैकल्पिक)...', 'Provide additional details (optional)...')}
                  rows={2}
                  maxLength={300}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    fontSize: '0.82rem',
                    resize: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setReportModalOpen(false)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '999px',
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                  }}
                >
                  {t('रद्द करू', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!reportReason || reporting}
                  style={{
                    padding: '7px 18px',
                    borderRadius: '999px',
                    background: '#EAB308',
                    color: '#070913',
                    border: 'none',
                    fontWeight: 700,
                    cursor: (!reportReason || reporting) ? 'not-allowed' : 'pointer',
                    fontSize: '0.82rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {reporting ? <Loader2 size={13} className="spin" /> : <Flag size={13} />}
                  <span>{t('सबमिट करू', 'Submit Report')}</span>
                </button>
              </div>
            </form>
          </div>
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