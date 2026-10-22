'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MessageSquare, ThumbsUp, Reply, ChevronDown, ChevronUp,
  Send, ShieldAlert, LogIn, Sparkles, CheckCircle2, ShieldCheck,
  Clock, AlertCircle, Loader2, Trash2, Flag, MoreVertical, X, ShieldX
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getAnonId } from '../../lib/tracking';

const rtf = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' }) : null;

function timeAgo(iso) {
  if (!iso || !rtf) return 'just now';
  const diffSec = (new Date(iso).getTime() - Date.now()) / 1000;
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ];
  for (const [unit, secondsInUnit] of units) {
    if (Math.abs(diffSec) >= secondsInUnit || unit === 'second') {
      return rtf.format(Math.round(diffSec / secondsInUnit), unit);
    }
  }
  return 'just now';
}

function UserAvatar({ name, avatar, size = 34 }) {
  const initial = (name || 'U').charAt(0).toUpperCase();

  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name || 'User'}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          border: '1px solid rgba(255, 255, 255, 0.12)',
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #EAB308, #D97706)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#070913',
        fontWeight: 700,
        fontSize: size <= 26 ? '0.72rem' : '0.82rem',
        flexShrink: 0,
        boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
      }}
    >
      {initial}
    </div>
  );
}

const EMOJI_REACTIONS = ['❤️', '👏', '🔥', '🎶', '🌸', '✨'];

export default function CommentThread({
  recordingId,
  recordingAuthorId: propAuthorId,
  onApproved,
  onCommentDeleted
}) {
  const { user, isLoaded, openSignIn } = useAuth();
  const { t } = useLanguage();

  const [rawComments, setRawComments] = useState([]);
  const [recordingAuthorId, setRecordingAuthorId] = useState(propAuthorId || null);
  const [loading, setLoading] = useState(true);
  const [mainText, setMainText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [mainStatus, setMainStatus] = useState('idle'); // idle | submitting | error
  const [mainError, setMainError] = useState('');

  // Replying state
  const [replyTextMap, setReplyTextMap] = useState({});
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [replyStatusMap, setReplyStatusMap] = useState({});
  const [replyErrorMap, setReplyErrorMap] = useState({});

  // Expanded replies: { [commentId]: boolean }
  const [expandedReplies, setExpandedReplies] = useState({});

  // Sort: 'top' | 'newest'
  const [sortBy, setSortBy] = useState('top');

  // Moderation & Action states
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteComment, setConfirmDeleteComment] = useState(null);
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const [reportModal, setReportModal] = useState({ isOpen: false, comment: null });
  const [reportReason, setReportReason] = useState('harassment');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [blockModal, setBlockModal] = useState({ isOpen: false, targetUser: null });
  const [blockSubmitting, setBlockSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const mainInputRef = useRef(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  useEffect(() => {
    if (propAuthorId) setRecordingAuthorId(propAuthorId);
  }, [propAuthorId]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleOutside = (e) => {
      if (!e.target.closest('.comment-dropdown-wrap')) {
        setActiveDropdownId(null);
      }
    };
    window.addEventListener('click', handleOutside);
    return () => window.removeEventListener('click', handleOutside);
  }, []);

  useEffect(() => {
    let live = true;
    if (!recordingId) {
      setRawComments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/community/comments?recordingId=${encodeURIComponent(recordingId)}`)
      .then((r) => (r.ok ? r.json() : { comments: [], recordingAuthorId: null }))
      .then((d) => {
        if (live) {
          setRawComments(d.comments || []);
          if (d.recordingAuthorId) setRecordingAuthorId(d.recordingAuthorId);
          setLoading(false);
        }
      })
      .catch(() => {
        if (live) {
          setRawComments([]);
          setLoading(false);
        }
      });

    return () => { live = false; };
  }, [recordingId]);

  // Group into Top-level comments and nested replies
  const { topLevelComments, repliesMap, totalCount } = useMemo(() => {
    const top = [];
    const repMap = {};

    for (const c of rawComments) {
      if (!c.parentId) {
        top.push(c);
      } else {
        if (!repMap[c.parentId]) repMap[c.parentId] = [];
        repMap[c.parentId].push(c);
      }
    }

    if (sortBy === 'top') {
      top.sort((a, b) => (b.likes || 0) - (a.likes || 0) || new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      top.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    for (const k of Object.keys(repMap)) {
      repMap[k].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }

    return { topLevelComments: top, repliesMap: repMap, totalCount: rawComments.length };
  }, [rawComments, sortBy]);

  // Handle Like / Unlike for comment or reply
  const handleToggleLike = async (commentId) => {
    if (!user) {
      openSignIn();
      return;
    }

    // Optimistic toggle
    setRawComments((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c;
        const nextIsLiked = !c.isLiked;
        const nextLikes = nextIsLiked ? (c.likes || 0) + 1 : Math.max(0, (c.likes || 0) - 1);
        return { ...c, isLiked: nextIsLiked, likes: nextLikes };
      })
    );

    try {
      const res = await fetch('/api/community/comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setRawComments((prev) =>
            prev.map((c) => (c.id === commentId ? { ...c, likes: data.likes, isLiked: data.isLiked } : c))
          );
        }
      }
    } catch (err) {
      console.error('Failed to like comment:', err);
    }
  };

  // Post top-level comment
  const handlePostMainComment = async (overrideText = null) => {
    const textToPost = (overrideText || mainText).trim();
    if (!textToPost || mainStatus === 'submitting') return;

    if (!user) {
      openSignIn();
      return;
    }

    setMainStatus('submitting');
    setMainError('');

    try {
      const res = await fetch('/api/community/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordingId,
          anonId: getAnonId(),
          text: textToPost,
          authorName: user.name,
          authorAvatar: user.avatar,
          author: user.name,
          avatar: user.avatar,
        }),
      });

      if (res.status === 429) {
        setMainStatus('error');
        setMainError(t('बेसी तेजी सं। किछु काल रुकू।', 'Slow down a little and try again.'));
        return;
      }

      const data = await res.json();

      if (res.ok && (data.success || data.status === 'approved')) {
        setMainStatus('idle');
        setMainText('');
        setIsFocused(false);
        const newComment = data.comment || {
          id: Date.now().toString(),
          _id: Date.now().toString(),
          parentId: null,
          text: textToPost,
          userId: user.id,
          author: user.name || 'Member',
          authorName: user.name || 'Member',
          avatar: user.avatar || null,
          authorAvatar: user.avatar || null,
          likes: 0,
          isLiked: false,
          createdAt: new Date().toISOString(),
        };
        setRawComments((prev) => [newComment, ...prev]);
        onApproved?.();
      } else {
        setMainStatus('error');
        setMainError(data.reason || data.error || 'Comment could not be published.');
      }
    } catch {
      setMainStatus('error');
      setMainError(t('पठाओल नहि जा सकल। फेर प्रयास करू।', 'Network error. Please try again.'));
    }
  };

  // Post nested reply
  const handlePostReply = async (parentId, parentAuthor) => {
    const textToPost = (replyTextMap[parentId] || '').trim();
    if (!textToPost) return;

    if (!user) {
      openSignIn();
      return;
    }

    setReplyStatusMap((prev) => ({ ...prev, [parentId]: 'submitting' }));
    setReplyErrorMap((prev) => ({ ...prev, [parentId]: '' }));

    try {
      const res = await fetch('/api/community/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordingId,
          parentId,
          anonId: getAnonId(),
          text: textToPost,
          authorName: user.name,
          authorAvatar: user.avatar,
          author: user.name,
          avatar: user.avatar,
        }),
      });

      const data = await res.json();

      if (res.ok && (data.success || data.status === 'approved')) {
        setReplyStatusMap((prev) => ({ ...prev, [parentId]: 'idle' }));
        setReplyTextMap((prev) => ({ ...prev, [parentId]: '' }));
        setActiveReplyId(null);
        // Automatically expand the reply thread
        setExpandedReplies((prev) => ({ ...prev, [parentId]: true }));

        const newReply = data.comment || {
          id: Date.now().toString(),
          _id: Date.now().toString(),
          parentId,
          text: textToPost,
          userId: user.id,
          author: user.name || 'Member',
          authorName: user.name || 'Member',
          avatar: user.avatar || null,
          authorAvatar: user.avatar || null,
          likes: 0,
          isLiked: false,
          createdAt: new Date().toISOString(),
        };

        setRawComments((prev) => [...prev, newReply]);
        onApproved?.();
      } else {
        setReplyStatusMap((prev) => ({ ...prev, [parentId]: 'error' }));
        setReplyErrorMap((prev) => ({
          ...prev,
          [parentId]: data.reason || data.error || 'Reply blocked by safety moderator.',
        }));
      }
    } catch {
      setReplyStatusMap((prev) => ({ ...prev, [parentId]: 'error' }));
      setReplyErrorMap((prev) => ({
        ...prev,
        [parentId]: t('पठाओल नहि जा सकल। फेर प्रयास करू।', 'Network error. Please try again.'),
      }));
    }
  };

  const openReplyBox = (id, authorName) => {
    if (!user) {
      openSignIn();
      return;
    }
    const cleanName = (authorName && authorName !== 'Community Member') ? authorName : (user.name || 'Singer');
    setActiveReplyId(activeReplyId === id ? null : id);
    if (!replyTextMap[id]) {
      setReplyTextMap((prev) => ({ ...prev, [id]: `@${cleanName} ` }));
    }
  };

  const toggleRepliesExpansion = (id) => {
    setExpandedReplies((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleEmojiClick = (emoji) => {
    if (activeReplyId) {
      setReplyTextMap((prev) => ({
        ...prev,
        [activeReplyId]: (prev[activeReplyId] || '') + emoji,
      }));
    } else {
      setMainText((prev) => prev + (prev ? ' ' : '') + emoji);
      setIsFocused(true);
    }
  };

  // Delete a comment (for comment author, post owner, or admin)
  const handleDeleteComment = async (commentId) => {
    if (!commentId) return;
    setDeletingId(commentId);
    try {
      const res = await fetch(`/api/community/comments?commentId=${encodeURIComponent(commentId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRawComments((prev) =>
          prev.filter((c) => c.id !== commentId && c._id !== commentId && c.parentId !== commentId)
        );
        setConfirmDeleteComment(null);
        showToast(t('टिप्पणी हटाओल गेल', 'Comment deleted successfully'));
        onCommentDeleted?.();
      } else {
        alert(data.error || 'Failed to delete comment');
      }
    } catch (err) {
      console.error('[CommentThread] Delete error:', err);
    } finally {
      setDeletingId(null);
    }
  };

  // Block a user from commenting on creator's recordings
  const handleBlockUser = async () => {
    if (!blockModal.targetUser?.id) return;
    setBlockSubmitting(true);
    try {
      const res = await fetch('/api/community/block-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockedUserId: blockModal.targetUser.id,
          action: 'block',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(t('उपयोगकर्ता केँ ब्लॉक कएल गेल', `@${blockModal.targetUser.name} blocked from commenting on your recordings`));
        setBlockModal({ isOpen: false, targetUser: null });
      } else {
        alert(data.error || 'Failed to block user');
      }
    } catch (err) {
      console.error('[CommentThread] Block user error:', err);
    } finally {
      setBlockSubmitting(false);
    }
  };

  // Report a misbehaving comment or user
  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!reportModal.comment || !reportReason) return;
    setReportSubmitting(true);
    try {
      const targetId = reportModal.comment.id || reportModal.comment._id;
      const res = await fetch('/api/community/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: 'comment',
          targetId: String(targetId),
          reason: reportReason,
          details: reportDetails,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(t('रिपोर्ट दर्ज कएल गेल। धन्यवाद।', 'Report submitted. Thank you for keeping our community safe.'));
        setReportModal({ isOpen: false, comment: null });
        setReportReason('harassment');
        setReportDetails('');
      } else {
        alert(data.error || 'Failed to submit report');
      }
    } catch (err) {
      console.error('[CommentThread] Report error:', err);
    } finally {
      setReportSubmitting(false);
    }
  };

  return (
    <div
      className="glass-panel"
      style={{
        padding: '20px 18px',
        borderRadius: '16px',
        background: 'rgba(9, 12, 22, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
      }}
    >
      {/* 1. Header: Total Count, AI Screened Badge & Sort Filter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={17} color="#EAB308" />
          <span style={{ fontWeight: 700, fontSize: '0.98rem', color: '#F8FAFC' }}>
            {totalCount} {t('टिप्पणी', 'Comments')}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.68rem',
              fontWeight: 700,
              color: 'var(--accent-emerald)',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.28)',
              padding: '2px 8px',
              borderRadius: '999px',
              marginLeft: '4px',
            }}
          >
            <ShieldCheck size={11} />
            <span>AI Screened</span>
          </span>
        </div>

        {/* Sort Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setSortBy('top')}
            style={{
              padding: '4px 10px',
              borderRadius: '999px',
              background: sortBy === 'top' ? 'rgba(234, 179, 8, 0.16)' : 'transparent',
              color: sortBy === 'top' ? '#EAB308' : 'var(--text-secondary)',
              border: sortBy === 'top' ? '1px solid rgba(234, 179, 8, 0.35)' : '1px solid transparent',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {t('शीर्ष', 'Top')}
          </button>
          <button
            type="button"
            onClick={() => setSortBy('newest')}
            style={{
              padding: '4px 10px',
              borderRadius: '999px',
              background: sortBy === 'newest' ? 'rgba(234, 179, 8, 0.16)' : 'transparent',
              color: sortBy === 'newest' ? '#EAB308' : 'var(--text-secondary)',
              border: sortBy === 'newest' ? '1px solid rgba(234, 179, 8, 0.35)' : '1px solid transparent',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {t('नवीनतम', 'Newest')}
          </button>
        </div>
      </div>

      {/* 2. Emoji Quick Reactions Bar */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {EMOJI_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => handleEmojiClick(emoji)}
            style={{
              padding: '3px 9px',
              borderRadius: '999px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'transform 0.15s ease, background 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* 3. Main YouTube-style Composer */}
      {!isLoaded ? (
        <div style={{ padding: '10px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
          Loading...
        </div>
      ) : !user ? (
        <div
          style={{
            padding: '14px 16px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px dashed rgba(255, 255, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '20px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.88rem', marginBottom: '2px' }}>
              {t('टिप्पणी लिखू आ चर्चा मे भाग लिअ', 'Leave a reaction & join the conversation')}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              {t('टिप्पणी एवं उत्तर देबय लेल अपन खाता मे लॉगिन करू।', 'Sign in to like, reply, and share feedback.')}
            </div>
          </div>
          <button
            type="button"
            onClick={() => openSignIn()}
            style={{
              padding: '7px 18px',
              fontSize: '0.82rem',
              borderRadius: '999px',
              background: 'linear-gradient(135deg, #F59E0B, #EAB308)',
              color: '#070913',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(234, 179, 8, 0.25)',
            }}
          >
            <LogIn size={14} />
            <span>{t('लॉगिन करू', 'Sign In')}</span>
          </button>
        </div>
      ) : (
        <div style={{ marginBottom: '22px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <UserAvatar name={user.name} avatar={user.avatar} size={36} />

            <div style={{ flex: 1 }}>
              <textarea
                ref={mainInputRef}
                value={mainText}
                onFocus={() => setIsFocused(true)}
                onChange={(e) => {
                  setMainText(e.target.value);
                  if (mainStatus !== 'submitting') setMainStatus('idle');
                }}
                placeholder={t('टिप्पणी जोड़ू... (AI Monitored)', 'Add a comment... (AI Monitored)')}
                rows={isFocused ? 3 : 1}
                maxLength={500}
                style={{
                  width: '100%',
                  padding: '9px 13px',
                  borderRadius: isFocused ? '10px' : '20px',
                  background: 'rgba(0, 0, 0, 0.45)',
                  border: isFocused ? '1px solid #EAB308' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#F8FAFC',
                  fontSize: '0.88rem',
                  resize: 'none',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />

              {/* Action Buttons underneath when focused */}
              {isFocused && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setMainText('');
                      setIsFocused(false);
                      setMainError('');
                      setMainStatus('idle');
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '999px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {t('रद्द करू', 'Cancel')}
                  </button>

                  <button
                    type="button"
                    disabled={mainStatus === 'submitting' || !mainText.trim()}
                    onClick={() => handlePostMainComment()}
                    style={{
                      padding: '6px 18px',
                      borderRadius: '999px',
                      background: mainText.trim() ? '#EAB308' : 'rgba(255, 255, 255, 0.08)',
                      color: mainText.trim() ? '#070913' : 'var(--text-muted)',
                      border: 'none',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: mainText.trim() ? 'pointer' : 'not-allowed',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {mainStatus === 'submitting' ? (
                      <Loader2 size={14} className="spin" />
                    ) : (
                      <>
                        <Send size={13} />
                        <span>{t('टिप्पणी करू', 'Comment')}</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {mainStatus === 'error' && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '10px 14px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: '8px',
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                    color: 'var(--accent-vermilion)',
                    fontSize: '0.85rem',
                  }}
                >
                  <ShieldAlert size={16} style={{ flexShrink: 0 }} />
                  <span>{mainError}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Top-Level Comments & Replies Stream */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0', fontSize: '0.85rem' }}>
            {t("लोड भ' रहल अछि...", 'Loading comments...')}
          </div>
        ) : topLevelComments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '0.88rem', margin: '0 0 4px 0' }}>
              {t('एखनो कोनो टिप्पणी नहि अछि।', 'No comments yet.')}
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
              {t('पहिल टिप्पणी कऽ चर्चा शुरू करू!', 'Be the first to share your thoughts!')}
            </p>
          </div>
        ) : (
          topLevelComments.map((comment) => {
            const replies = repliesMap[comment.id] || [];
            const isReplyingThis = activeReplyId === comment.id;
            const isRepliesExpanded = expandedReplies[comment.id];

            const isSelf = user && (comment.userId === user.id);
            const author = (isSelf && user.name)
              ? user.name
              : ((comment.author && comment.author !== 'Community Member') ? comment.author : (isSelf ? user.name : 'Mithila Singer'));
            const avatar = (isSelf && user.avatar) ? user.avatar : comment.avatar;

            return (
              <div key={comment.id} style={{ display: 'flex', gap: '12px' }}>
                <UserAvatar name={author} avatar={avatar} size={34} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Author Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: '#F8FAFC', fontSize: '0.88rem' }}>
                      {author}
                    </span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {timeAgo(comment.createdAt)}
                    </span>
                    <span
                      style={{
                        background: 'rgba(16, 185, 129, 0.1)',
                        color: 'var(--accent-emerald)',
                        padding: '1px 6px',
                        borderRadius: '999px',
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <CheckCircle2 size={10} />
                      <span>Verified</span>
                    </span>
                  </div>

                  {/* Comment Text */}
                  <p
                    style={{
                      margin: '0 0 8px 0',
                      color: 'var(--text-secondary)',
                      fontSize: '0.88rem',
                      lineHeight: '1.5',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {comment.text}
                  </p>

                  {/* Action Bar: Like, Reply, Delete & Moderation */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    {/* Like button */}
                    <button
                      type="button"
                      onClick={() => handleToggleLike(comment.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: comment.isLiked ? '#EAB308' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '2px 4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.8rem',
                        fontWeight: comment.isLiked ? 700 : 500,
                        transition: 'transform 0.15s ease, color 0.15s ease',
                      }}
                    >
                      <ThumbsUp size={14} fill={comment.isLiked ? '#EAB308' : 'none'} />
                      <span>{comment.likes || 0}</span>
                    </button>

                    {/* Reply toggle button */}
                    <button
                      type="button"
                      onClick={() => openReplyBox(comment.id, author)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: isReplyingThis ? '#EAB308' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '2px 4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                      }}
                    >
                      <Reply size={14} />
                      <span>{t('उत्तर दिअ', 'Reply')}</span>
                    </button>

                    {/* Delete button (for comment author, post creator, or admin) */}
                    {(isSelf || (user && recordingAuthorId && user.id === recordingAuthorId) || (user?.role === 'admin')) && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteComment(comment)}
                        title={t('टिप्पणी हटाउ', 'Delete comment')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.78rem',
                          transition: 'color 0.15s ease',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                      >
                        <Trash2 size={13} />
                        <span>{t('हटाउ', 'Delete')}</span>
                      </button>
                    )}

                    {/* More / Moderation options (Block user from creator recordings / Report) */}
                    {user && (!isSelf || (recordingAuthorId && user.id === recordingAuthorId)) && (
                      <div className="comment-dropdown-wrap" style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdownId(activeDropdownId === comment.id ? null : comment.id);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: activeDropdownId === comment.id ? '#EAB308' : 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                          title="Options"
                        >
                          <MoreVertical size={13} />
                        </button>

                        {activeDropdownId === comment.id && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              zIndex: 50,
                              minWidth: '180px',
                              background: '#1F2937',
                              border: '1px solid rgba(255, 255, 255, 0.12)',
                              borderRadius: '8px',
                              padding: '4px',
                              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                            }}
                          >
                            {/* Post Creator can block misbehaving commenter from their recordings */}
                            {(recordingAuthorId && user.id === recordingAuthorId) && !isSelf && comment.userId && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDropdownId(null);
                                  setBlockModal({
                                    isOpen: true,
                                    targetUser: { id: comment.userId, name: author }
                                  });
                                }}
                                style={{
                                  width: '100%',
                                  padding: '7px 10px',
                                  background: 'none',
                                  border: 'none',
                                  color: '#F59E0B',
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  borderRadius: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                              >
                                <ShieldX size={13} />
                                <span>{t('उपयोगकर्ता ब्लॉक करू', 'Block from my posts')}</span>
                              </button>
                            )}

                            {/* Report comment */}
                            {!isSelf && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDropdownId(null);
                                  setReportModal({ isOpen: true, comment });
                                }}
                                style={{
                                  width: '100%',
                                  padding: '7px 10px',
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-secondary)',
                                  fontSize: '0.78rem',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  borderRadius: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                              >
                                <Flag size={13} />
                                <span>{t('टिप्पणी रिपोर्ट करू', 'Report comment')}</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Inline Reply Composer (YouTube style) */}
                  {isReplyingThis && (
                    <div
                      style={{
                        margin: '10px 0 14px 0',
                        padding: '12px',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.07)',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <UserAvatar name={user?.name} avatar={user?.avatar} size={28} />
                        <div style={{ flex: 1 }}>
                          <textarea
                            value={replyTextMap[comment.id] || ''}
                            onChange={(e) =>
                              setReplyTextMap((prev) => ({ ...prev, [comment.id]: e.target.value }))
                            }
                            placeholder={t('उत्तर लिखू...', `Reply to @${author}...`)}
                            rows={2}
                            maxLength={500}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              background: 'rgba(0, 0, 0, 0.45)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              color: '#F8FAFC',
                              fontSize: '0.84rem',
                              resize: 'none',
                              outline: 'none',
                              fontFamily: 'inherit',
                              boxSizing: 'border-box',
                            }}
                          />

                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                            <button
                              type="button"
                              onClick={() => setActiveReplyId(null)}
                              style={{
                                padding: '5px 12px',
                                borderRadius: '999px',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                              }}
                            >
                              {t('रद्द करू', 'Cancel')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePostReply(comment.id, author)}
                              disabled={replyStatusMap[comment.id] === 'submitting' || !(replyTextMap[comment.id] || '').trim()}
                              style={{
                                padding: '5px 14px',
                                borderRadius: '999px',
                                background: (replyTextMap[comment.id] || '').trim() ? '#EAB308' : 'rgba(255,255,255,0.08)',
                                color: (replyTextMap[comment.id] || '').trim() ? '#070913' : 'var(--text-muted)',
                                border: 'none',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: (replyTextMap[comment.id] || '').trim() ? 'pointer' : 'not-allowed',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                              }}
                            >
                              {replyStatusMap[comment.id] === 'submitting' ? (
                                <Loader2 size={12} className="spin" />
                              ) : (
                                <span>{t('उत्तर दिअ', 'Reply')}</span>
                              )}
                            </button>
                          </div>

                          {replyStatusMap[comment.id] === 'error' && (
                            <div
                              style={{
                                marginTop: '6px',
                                color: 'var(--accent-vermilion)',
                                fontSize: '0.8rem',
                                display: 'flex',
                                gap: '6px',
                                alignItems: 'center',
                              }}
                            >
                              <ShieldAlert size={14} style={{ flexShrink: 0 }} />
                              <span>{replyErrorMap[comment.id]}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* YouTube-style View Replies Collapsible Drawer */}
                  {replies.length > 0 && (
                    <div style={{ marginTop: '4px' }}>
                      <button
                        type="button"
                        onClick={() => toggleRepliesExpansion(comment.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#EAB308',
                          cursor: 'pointer',
                          padding: '3px 0',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                        }}
                      >
                        {isRepliesExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        <span>
                          {isRepliesExpanded
                            ? t('उत्तर नुकाउ', `Hide ${replies.length} replies`)
                            : t(`${replies.length} उत्तर देखू`, `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`)}
                        </span>
                      </button>

                      {/* Nested Replies List */}
                      {isRepliesExpanded && (
                        <div
                          style={{
                            marginTop: '10px',
                            paddingLeft: '12px',
                            borderLeft: '2px solid rgba(234, 179, 8, 0.25)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                          }}
                        >
                          {replies.map((reply) => {
                            const isReplySelf = user && (reply.userId === user.id);
                            const replyAuthor = (isReplySelf && user.name)
                              ? user.name
                              : ((reply.author && reply.author !== 'Community Member') ? reply.author : (isReplySelf ? user.name : 'Mithila Singer'));
                            const replyAvatar = (isReplySelf && user.avatar) ? user.avatar : reply.avatar;

                            return (
                              <div key={reply.id} style={{ display: 'flex', gap: '10px' }}>
                                <UserAvatar name={replyAuthor} avatar={replyAvatar} size={28} />

                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 700, color: '#F8FAFC', fontSize: '0.84rem' }}>
                                      {replyAuthor}
                                    </span>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                      {timeAgo(reply.createdAt)}
                                    </span>
                                  </div>

                                  <p
                                    style={{
                                      margin: '0 0 6px 0',
                                      color: 'var(--text-secondary)',
                                      fontSize: '0.84rem',
                                      lineHeight: '1.45',
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word',
                                    }}
                                  >
                                    {reply.text}
                                  </p>

                                  {/* Action row for nested reply */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '2px', flexWrap: 'wrap' }}>
                                    {/* Like button for nested reply */}
                                    <button
                                      type="button"
                                      onClick={() => handleToggleLike(reply.id)}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: reply.isLiked ? '#EAB308' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        padding: '2px 4px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        fontSize: '0.76rem',
                                        fontWeight: reply.isLiked ? 700 : 500,
                                      }}
                                    >
                                      <ThumbsUp size={12} fill={reply.isLiked ? '#EAB308' : 'none'} />
                                      <span>{reply.likes || 0}</span>
                                    </button>

                                    {/* Delete button for nested reply (author, post creator, or admin) */}
                                    {(isReplySelf || (user && recordingAuthorId && user.id === recordingAuthorId) || (user?.role === 'admin')) && (
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteComment(reply)}
                                        title={t('उत्तर हटाउ', 'Delete reply')}
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          color: 'var(--text-muted)',
                                          cursor: 'pointer',
                                          padding: '2px 4px',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '3px',
                                          fontSize: '0.74rem',
                                          transition: 'color 0.15s ease',
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                                      >
                                        <Trash2 size={11} />
                                        <span>{t('हटाउ', 'Delete')}</span>
                                      </button>
                                    )}

                                    {/* Moderation dropdown for nested reply */}
                                    {user && (!isReplySelf || (recordingAuthorId && user.id === recordingAuthorId)) && (
                                      <div className="comment-dropdown-wrap" style={{ position: 'relative' }}>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveDropdownId(activeDropdownId === reply.id ? null : reply.id);
                                          }}
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            color: activeDropdownId === reply.id ? '#EAB308' : 'var(--text-muted)',
                                            cursor: 'pointer',
                                            padding: '2px 4px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                          }}
                                          title="Options"
                                        >
                                          <MoreVertical size={12} />
                                        </button>

                                        {activeDropdownId === reply.id && (
                                          <div
                                            style={{
                                              position: 'absolute',
                                              top: '100%',
                                              left: 0,
                                              zIndex: 50,
                                              minWidth: '170px',
                                              background: '#1F2937',
                                              border: '1px solid rgba(255, 255, 255, 0.12)',
                                              borderRadius: '8px',
                                              padding: '4px',
                                              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                                            }}
                                          >
                                            {(recordingAuthorId && user.id === recordingAuthorId) && !isReplySelf && reply.userId && (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setActiveDropdownId(null);
                                                  setBlockModal({
                                                    isOpen: true,
                                                    targetUser: { id: reply.userId, name: replyAuthor }
                                                  });
                                                }}
                                                style={{
                                                  width: '100%',
                                                  padding: '6px 8px',
                                                  background: 'none',
                                                  border: 'none',
                                                  color: '#F59E0B',
                                                  fontSize: '0.76rem',
                                                  fontWeight: 600,
                                                  textAlign: 'left',
                                                  cursor: 'pointer',
                                                  borderRadius: '6px',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: '6px',
                                                }}
                                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                                              >
                                                <ShieldX size={12} />
                                                <span>{t('उपयोगकर्ता ब्लॉक करू', 'Block from my posts')}</span>
                                              </button>
                                            )}

                                            {!isReplySelf && (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setActiveDropdownId(null);
                                                  setReportModal({ isOpen: true, comment: reply });
                                                }}
                                                style={{
                                                  width: '100%',
                                                  padding: '6px 8px',
                                                  background: 'none',
                                                  border: 'none',
                                                  color: 'var(--text-secondary)',
                                                  fontSize: '0.76rem',
                                                  textAlign: 'left',
                                                  cursor: 'pointer',
                                                  borderRadius: '6px',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: '6px',
                                                }}
                                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                                              >
                                                <Flag size={12} />
                                                <span>{t('उत्तर रिपोर्ट करू', 'Report reply')}</span>
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. Delete Comment Confirmation Modal */}
      {confirmDeleteComment && (
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
          onClick={() => setConfirmDeleteComment(null)}
        >
          <div
            style={{
              background: '#111827',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '380px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#EF4444', marginBottom: '12px' }}>
              <Trash2 size={20} />
              <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#FAFAFA' }}>
                {t('टिप्पणी हटाउ?', 'Delete comment?')}
              </h4>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', margin: '0 0 20px 0', lineHeight: '1.45' }}>
              {t(
                'की अहाँ सचमुच ई टिप्पणी हटाबय चाहैत छी? ई क्रिया पूर्ववत नहि कएल जा सकैत अछि।',
                'Are you sure you want to delete this comment? This action cannot be undone.'
              )}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setConfirmDeleteComment(null)}
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
                type="button"
                disabled={deletingId === (confirmDeleteComment.id || confirmDeleteComment._id)}
                onClick={() => handleDeleteComment(confirmDeleteComment.id || confirmDeleteComment._id)}
                style={{
                  padding: '7px 18px',
                  borderRadius: '999px',
                  background: '#EF4444',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {deletingId ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />}
                <span>{t('हटाउ', 'Delete')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Block User Confirmation Modal */}
      {blockModal.isOpen && blockModal.targetUser && (
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
          onClick={() => setBlockModal({ isOpen: false, targetUser: null })}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#F59E0B', marginBottom: '12px' }}>
              <ShieldX size={20} />
              <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#FAFAFA' }}>
                {t('उपयोगकर्ता केँ ब्लॉक करू?', 'Block user from commenting?')}
              </h4>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', margin: '0 0 20px 0', lineHeight: '1.45' }}>
              {t(
                `की अहाँ @${blockModal.targetUser.name} केँ ब्लॉक करय चाहैत छी? ब्लॉक केलाक बाद ई उपयोगकर्ता अहाँक कोनो भी रिकॉर्डिंग पर टिप्पणी नहि कऽ सकत।`,
                `Block @${blockModal.targetUser.name} from commenting on any of your recordings? They will no longer be able to post comments on your content.`
              )}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setBlockModal({ isOpen: false, targetUser: null })}
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
                type="button"
                disabled={blockSubmitting}
                onClick={handleBlockUser}
                style={{
                  padding: '7px 18px',
                  borderRadius: '999px',
                  background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                  color: '#070913',
                  border: 'none',
                  fontWeight: 700,
                  cursor: blockSubmitting ? 'not-allowed' : 'pointer',
                  fontSize: '0.82rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {blockSubmitting ? <Loader2 size={13} className="spin" /> : <ShieldX size={13} />}
                <span>{t('ब्लॉक करू', 'Block User')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Report Comment Modal */}
      {reportModal.isOpen && reportModal.comment && (
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
          onClick={() => setReportModal({ isOpen: false, comment: null })}
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
                  {t('टिप्पणी रिपोर्ट करू', 'Report comment')}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setReportModal({ isOpen: false, comment: null })}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitReport}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  {t('रिपोर्टक कारण चुनू:', 'Select reason for reporting:')}
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    { id: 'harassment', label: 'Harassment or hate speech / दुर्व्यवहार' },
                    { id: 'spam', label: 'Spam or repetitive text / स्पैम' },
                    { id: 'abusive', label: 'Abusive or vulgar language / अभद्र भाषा' },
                    { id: 'inappropriate', label: 'Inappropriate content / अनुचित सामग्री' },
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
                  placeholder={t('वैकल्पिक विवरण लिखू...', 'Optional details to help moderators...')}
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
                  onClick={() => setReportModal({ isOpen: false, comment: null })}
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
                  disabled={!reportReason || reportSubmitting}
                  style={{
                    padding: '7px 18px',
                    borderRadius: '999px',
                    background: '#EAB308',
                    color: '#070913',
                    border: 'none',
                    fontWeight: 700,
                    cursor: (!reportReason || reportSubmitting) ? 'not-allowed' : 'pointer',
                    fontSize: '0.82rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {reportSubmitting ? <Loader2 size={13} className="spin" /> : <Flag size={13} />}
                  <span>{t('सबमिट करू', 'Submit Report')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      {toastMsg && (
        <div className="sur-toast" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 10001 }}>
          <Sparkles size={16} color="var(--neon-saffron)" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}