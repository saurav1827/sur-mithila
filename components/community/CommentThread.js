'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MessageSquare, ThumbsUp, Reply, ChevronDown, ChevronUp,
  Send, ShieldAlert, LogIn, Sparkles, CheckCircle2, ShieldCheck,
  Clock, AlertCircle, Loader2
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

const REASONS = {
  abuse: 'Abusive language detected.',
  hate: 'Hateful content not permitted.',
  harassment: 'Harassment detected.',
  sexual: 'Inappropriate content.',
  spam: 'Spam or repetitive text.',
  too_long: 'Too long (maximum 500 characters).',
  empty: 'Comment cannot be empty.',
  ai_blocked: 'Comment blocked by AI community safety moderator.',
};

export default function CommentThread({ recordingId, onApproved }) {
  const { user, isLoaded, openSignIn } = useAuth();
  const { t } = useLanguage();

  const [rawComments, setRawComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mainText, setMainText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [mainStatus, setMainStatus] = useState('idle'); // idle | submitting | error | held
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

  const mainInputRef = useRef(null);

  useEffect(() => {
    let live = true;
    if (!recordingId) {
      setRawComments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/community/comments?recordingId=${encodeURIComponent(recordingId)}`)
      .then((r) => (r.ok ? r.json() : { comments: [] }))
      .then((d) => {
        if (live) {
          setRawComments(d.comments || []);
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
          author: user?.name || 'Mithila Singer',
          avatar: user?.avatar || null,
        }),
      });

      if (res.status === 429) {
        setMainStatus('error');
        setMainError(t('बेसी तेजी सं। किछु काल रुकू।', 'Slow down a little and try again.'));
        return;
      }

      const data = await res.json();

      if (res.ok && data.status === 'approved') {
        setMainStatus('idle');
        setMainText('');
        setIsFocused(false);
        const newComment = data.comment || {
          id: Date.now().toString(),
          parentId: null,
          text: textToPost,
          userId: user?.id || null,
          author: user?.name || 'Mithila Singer',
          avatar: user?.avatar || null,
          likes: 0,
          isLiked: false,
          createdAt: new Date().toISOString(),
        };
        setRawComments((prev) => [newComment, ...prev]);
        onApproved?.();
      } else if (data.status === 'held') {
        setMainStatus('held');
        setMainText('');
      } else {
        setMainStatus('error');
        setMainError(REASONS[data.reason] || data.reason || 'Comment not permitted by community guidelines.');
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
          author: user.name || 'Mithila Singer',
          avatar: user.avatar || null,
        }),
      });

      const data = await res.json();

      if (res.ok && data.status === 'approved') {
        setReplyStatusMap((prev) => ({ ...prev, [parentId]: 'idle' }));
        setReplyTextMap((prev) => ({ ...prev, [parentId]: '' }));
        setActiveReplyId(null);
        // Automatically expand the reply thread
        setExpandedReplies((prev) => ({ ...prev, [parentId]: true }));

        const newReply = data.comment || {
          id: Date.now().toString(),
          parentId,
          text: textToPost,
          userId: user.id,
          author: user.name,
          avatar: user.avatar,
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
          [parentId]: REASONS[data.reason] || data.reason || 'Reply could not be posted.',
        }));
      }
    } catch {
      setReplyStatusMap((prev) => ({ ...prev, [parentId]: 'error' }));
      setReplyErrorMap((prev) => ({
        ...prev,
        [parentId]: 'Network error. Please try again.',
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
                placeholder={t('प्रतिक्रिया लिखू… (AI Monitored)', 'Add a comment… (AI Monitored)')}
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

              {/* AI Status Indicators */}
              {mainStatus === 'submitting' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#EAB308', marginTop: '6px' }}>
                  <Loader2 size={13} className="spin" />
                  <span>{t('AI सुरक्षा जाँचि रहल अछि…', 'AI safety screening in progress…')}</span>
                </div>
              )}
              {mainStatus === 'held' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#F59E0B', marginTop: '6px' }}>
                  <Clock size={13} />
                  <span>{t('अहाँक टिप्पणी समीक्षा लेल रोकल गेल अछि।', 'Your comment is queued for moderation review.')}</span>
                </div>
              )}
              {mainStatus === 'error' && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '8px 12px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: '8px',
                    display: 'flex',
                    gap: '6px',
                    alignItems: 'center',
                    color: 'var(--accent-vermilion)',
                    fontSize: '0.82rem',
                  }}
                >
                  <ShieldAlert size={14} style={{ flexShrink: 0 }} />
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

                  {/* Action Bar: Like & Reply */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '6px' }}>
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
                            <div style={{ marginTop: '6px', color: 'var(--accent-vermilion)', fontSize: '0.78rem' }}>
                              {replyErrorMap[comment.id]}
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
    </div>
  );
}