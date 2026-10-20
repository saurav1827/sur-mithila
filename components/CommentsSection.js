'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MessageSquare, ThumbsUp, Reply, ChevronDown, ChevronUp,
  Send, ShieldAlert, LogIn, Sparkles, CornerDownRight, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

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

function UserAvatar({ name, avatar, size = 36 }) {
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
          border: '1px solid rgba(255, 255, 255, 0.1)',
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
        fontSize: size <= 28 ? '0.75rem' : '0.88rem',
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      {initial}
    </div>
  );
}

export default function CommentsSection({ songId }) {
  const { user, isLoaded, openSignIn } = useAuth();
  const { t } = useLanguage();

  const [rawComments, setRawComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mainText, setMainText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [mainStatus, setMainStatus] = useState('idle'); // idle | submitting | error
  const [mainError, setMainError] = useState('');

  // Replying state: { [commentId]: string }
  const [replyTextMap, setReplyTextMap] = useState({});
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [replyStatusMap, setReplyStatusMap] = useState({});
  const [replyErrorMap, setReplyErrorMap] = useState({});

  // Expanded replies: { [commentId]: boolean }
  const [expandedReplies, setExpandedReplies] = useState({});

  // Sort order: 'newest' | 'top'
  const [sortBy, setSortBy] = useState('top');

  const mainInputRef = useRef(null);

  useEffect(() => {
    fetchComments();
  }, [songId]);

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/comments?songId=${encodeURIComponent(songId)}`);
      if (res.ok) {
        const data = await res.json();
        setRawComments(data.comments || []);
      }
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoading(false);
    }
  };

  // Group into Top-level comments and Replies map
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

    // Sort top level
    if (sortBy === 'top') {
      top.sort((a, b) => (b.likes || 0) - (a.likes || 0) || new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      top.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Sort replies chronologically
    for (const key of Object.keys(repMap)) {
      repMap[key].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }

    return { topLevelComments: top, repliesMap: repMap, totalCount: rawComments.length };
  }, [rawComments, sortBy]);

  // Handle Like / Unlike
  const handleToggleLike = async (commentId) => {
    if (!user) {
      openSignIn();
      return;
    }

    // Optimistic toggle
    setRawComments((prev) =>
      prev.map((c) => {
        if (c._id !== commentId) return c;
        const nextIsLiked = !c.isLiked;
        const nextLikes = nextIsLiked ? (c.likes || 0) + 1 : Math.max(0, (c.likes || 0) - 1);
        return { ...c, isLiked: nextIsLiked, likes: nextLikes };
      })
    );

    try {
      const res = await fetch('/api/comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, action: 'toggle' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setRawComments((prev) =>
            prev.map((c) => (c._id === commentId ? { ...c, likes: data.likes, isLiked: data.isLiked } : c))
          );
        }
      }
    } catch (err) {
      console.error('Failed to like comment:', err);
    }
  };

  // Post top-level comment
  const handlePostMainComment = async (e) => {
    e.preventDefault();
    if (!mainText.trim() || !user) return;

    setMainStatus('submitting');
    setMainError('');

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songId,
          text: mainText.trim(),
          authorName: user.name,
          authorAvatar: user.avatar,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setMainStatus('idle');
        setMainText('');
        setIsFocused(false);
        const newComment = data.comment || {
          _id: Date.now().toString(),
          songId,
          parentId: null,
          text: mainText.trim(),
          userId: user.id,
          authorName: user.name,
          authorAvatar: user.avatar,
          likes: 0,
          isLiked: false,
          createdAt: new Date().toISOString(),
        };
        setRawComments((prev) => [newComment, ...prev]);
      } else {
        setMainStatus('error');
        setMainError(data.reason || data.error || 'Comment could not be published.');
      }
    } catch {
      setMainStatus('error');
      setMainError('Network error. Please try again.');
    }
  };

  // Post reply to a comment
  const handlePostReply = async (parentId, replyAuthor) => {
    const text = (replyTextMap[parentId] || '').trim();
    if (!text || !user) return;

    setReplyStatusMap((prev) => ({ ...prev, [parentId]: 'submitting' }));
    setReplyErrorMap((prev) => ({ ...prev, [parentId]: '' }));

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songId,
          parentId,
          text,
          authorName: user.name,
          authorAvatar: user.avatar,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setReplyStatusMap((prev) => ({ ...prev, [parentId]: 'idle' }));
        setReplyTextMap((prev) => ({ ...prev, [parentId]: '' }));
        setActiveReplyId(null);
        // Automatically expand replies so user sees their new reply
        setExpandedReplies((prev) => ({ ...prev, [parentId]: true }));

        const newReply = data.comment || {
          _id: Date.now().toString(),
          songId,
          parentId,
          text,
          userId: user.id,
          authorName: user.name,
          authorAvatar: user.avatar,
          likes: 0,
          isLiked: false,
          createdAt: new Date().toISOString(),
        };

        setRawComments((prev) => [...prev, newReply]);
      } else {
        setReplyStatusMap((prev) => ({ ...prev, [parentId]: 'error' }));
        setReplyErrorMap((prev) => ({
          ...prev,
          [parentId]: data.reason || data.error || 'Reply blocked by safety moderator.',
        }));
      }
    } catch {
      setReplyStatusMap((prev) => ({ ...prev, [parentId]: 'error' }));
      setReplyErrorMap((prev) => ({ ...prev, [parentId]: 'Network error. Please try again.' }));
    }
  };

  const toggleRepliesExpansion = (id) => {
    setExpandedReplies((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openReplyBox = (id, authorName) => {
    if (!user) {
      openSignIn();
      return;
    }
    const cleanName = (authorName && authorName !== 'Community Member') ? authorName : (user.name || 'Member');
    setActiveReplyId(activeReplyId === id ? null : id);
    if (!replyTextMap[id]) {
      setReplyTextMap((prev) => ({ ...prev, [id]: `@${cleanName} ` }));
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '28px 24px', borderRadius: '16px', background: 'rgba(11, 14, 26, 0.65)' }}>
      {/* Header: Total Count & Sort Filter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <MessageSquare size={22} color="#EAB308" />
          <h3 className="font-traditional" style={{ fontSize: '1.4rem', color: '#FAFAFA', margin: 0 }}>
            {totalCount} {t('टिप्पणी', 'Comments')}
          </h3>
        </div>

        {/* Sort Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setSortBy('top')}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              background: sortBy === 'top' ? 'rgba(234, 179, 8, 0.15)' : 'transparent',
              color: sortBy === 'top' ? '#EAB308' : 'var(--text-secondary)',
              border: sortBy === 'top' ? '1px solid rgba(234, 179, 8, 0.35)' : '1px solid transparent',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {t('शीर्ष टिप्पणी', 'Top comments')}
          </button>
          <button
            type="button"
            onClick={() => setSortBy('newest')}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              background: sortBy === 'newest' ? 'rgba(234, 179, 8, 0.15)' : 'transparent',
              color: sortBy === 'newest' ? '#EAB308' : 'var(--text-secondary)',
              border: sortBy === 'newest' ? '1px solid rgba(234, 179, 8, 0.35)' : '1px solid transparent',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {t('नवीनतम पहिने', 'Newest first')}
          </button>
        </div>
      </div>

      {/* Main Composer Area (YouTube-style) */}
      {!isLoaded ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
      ) : !user ? (
        <div
          style={{
            padding: '24px 20px',
            borderRadius: '14px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px dashed var(--border-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          <div>
            <div style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.96rem', marginBottom: '4px' }}>
              {t('टिप्पणी लिखू आ चर्चा मे भाग लिअ', 'Leave a comment & join the conversation')}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {t('टिप्पणी एवं उत्तर देबय लेल अपन खाता मे लॉगिन करू।', 'Sign in to like, reply, and share your thoughts.')}
            </div>
          </div>
          <button
            type="button"
            onClick={() => openSignIn()}
            style={{
              padding: '9px 22px',
              fontSize: '0.88rem',
              borderRadius: '999px',
              background: 'linear-gradient(135deg, #F59E0B, #EAB308)',
              color: '#070913',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 15px rgba(234, 179, 8, 0.25)',
            }}
          >
            <LogIn size={16} />
            {t('लॉगिन करू', 'Sign In')}
          </button>
        </div>
      ) : (
        <form onSubmit={handlePostMainComment} style={{ marginBottom: '36px' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            <UserAvatar name={user.name} avatar={user.avatar} size={40} />

            <div style={{ flex: 1 }}>
              <textarea
                ref={mainInputRef}
                value={mainText}
                onFocus={() => setIsFocused(true)}
                onChange={(e) => setMainText(e.target.value)}
                placeholder={t('टिप्पणी जोड़ू... (AI Monitored)', 'Add a comment... (AI Monitored)')}
                rows={isFocused ? 3 : 1}
                maxLength={500}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: isFocused ? '12px' : '24px',
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: isFocused ? '1px solid #EAB308' : '1px solid var(--border-card)',
                  color: '#fff',
                  fontSize: '0.92rem',
                  resize: 'none',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  fontFamily: 'inherit',
                }}
              />

              {/* Action Buttons underneath when focused */}
              {isFocused && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setMainText('');
                      setIsFocused(false);
                      setMainError('');
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '999px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {t('रद्द करू', 'Cancel')}
                  </button>

                  <button
                    type="submit"
                    disabled={mainStatus === 'submitting' || !mainText.trim()}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '999px',
                      background: mainText.trim() ? '#EAB308' : 'rgba(255, 255, 255, 0.08)',
                      color: mainText.trim() ? '#070913' : 'var(--text-muted)',
                      border: 'none',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: mainText.trim() ? 'pointer' : 'not-allowed',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {mainStatus === 'submitting' ? (
                      <div className="spinner" style={{ width: '16px', height: '16px' }} />
                    ) : (
                      <>
                        <Send size={14} />
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
        </form>
      )}

      {/* Top-Level Comments List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px 0' }}>{t("लोड भ' रहल अछि...", 'Loading comments...')}</div>
        ) : topLevelComments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '0.95rem', margin: '0 0 6px 0' }}>{t('एखनो कोनो टिप्पणी नहि अछि।', 'No comments yet.')}</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('पहिल टिप्पणी कऽ चर्चा शुरू करू!', 'Be the first to share your thoughts!')}</p>
          </div>
        ) : (
          topLevelComments.map((comment) => {
            const replies = repliesMap[comment._id] || [];
            const isReplyingThis = activeReplyId === comment._id;
            const isRepliesExpanded = expandedReplies[comment._id];

            const isSelf = user && (comment.userId === user.id);
            const author = (isSelf && user.name)
              ? user.name
              : ((comment.authorName && comment.authorName !== 'Community Member') ? comment.authorName : (isSelf ? user.name : 'Member'));
            const avatar = (isSelf && user.avatar) ? user.avatar : comment.authorAvatar;

            return (
              <div key={comment._id} style={{ display: 'flex', gap: '14px' }}>
                <UserAvatar name={author} avatar={avatar} size={38} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Author Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: '#F8FAFC', fontSize: '0.92rem' }}>
                      {author}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {timeAgo(comment.createdAt)}
                    </span>
                    <span
                      style={{
                        background: 'rgba(16, 185, 129, 0.1)',
                        color: 'var(--accent-emerald)',
                        padding: '1px 7px',
                        borderRadius: '999px',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <CheckCircle2 size={11} />
                      AI Verified
                    </span>
                  </div>

                  {/* Comment Text */}
                  <p
                    style={{
                      margin: '0 0 10px 0',
                      color: 'var(--text-secondary)',
                      fontSize: '0.92rem',
                      lineHeight: '1.55',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {comment.text}
                  </p>

                  {/* Action Bar: Like & Reply buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '8px' }}>
                    {/* Like button */}
                    <button
                      type="button"
                      onClick={() => handleToggleLike(comment._id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: comment.isLiked ? '#EAB308' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.85rem',
                        fontWeight: comment.isLiked ? 700 : 500,
                        transition: 'transform 0.15s ease, color 0.15s ease',
                      }}
                    >
                      <ThumbsUp size={15} fill={comment.isLiked ? '#EAB308' : 'none'} />
                      <span>{comment.likes || 0}</span>
                    </button>

                    {/* Reply toggle button */}
                    <button
                      type="button"
                      onClick={() => openReplyBox(comment._id, author)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: isReplyingThis ? '#EAB308' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                      }}
                    >
                      <Reply size={15} />
                      <span>{t('उत्तर दिअ', 'Reply')}</span>
                    </button>
                  </div>

                  {/* Inline Reply Composer (YouTube style) */}
                  {isReplyingThis && (
                    <div style={{ margin: '12px 0 18px 0', padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <UserAvatar name={user?.name} avatar={user?.avatar} size={30} />
                        <div style={{ flex: 1 }}>
                          <textarea
                            value={replyTextMap[comment._id] || ''}
                            onChange={(e) =>
                              setReplyTextMap((prev) => ({ ...prev, [comment._id]: e.target.value }))
                            }
                            placeholder={t('उत्तर लिखू...', `Reply to @${author}...`)}
                            rows={2}
                            maxLength={500}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              background: 'rgba(0, 0, 0, 0.4)',
                              border: '1px solid var(--border-card)',
                              color: '#fff',
                              fontSize: '0.88rem',
                              resize: 'none',
                              outline: 'none',
                              fontFamily: 'inherit',
                            }}
                          />

                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                            <button
                              type="button"
                              onClick={() => setActiveReplyId(null)}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '999px',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                              }}
                            >
                              {t('रद्द करू', 'Cancel')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePostReply(comment._id, comment.authorName)}
                              disabled={replyStatusMap[comment._id] === 'submitting' || !(replyTextMap[comment._id] || '').trim()}
                              style={{
                                padding: '6px 16px',
                                borderRadius: '999px',
                                background: (replyTextMap[comment._id] || '').trim() ? '#EAB308' : 'rgba(255,255,255,0.08)',
                                color: (replyTextMap[comment._id] || '').trim() ? '#070913' : 'var(--text-muted)',
                                border: 'none',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: (replyTextMap[comment._id] || '').trim() ? 'pointer' : 'not-allowed',
                              }}
                            >
                              {replyStatusMap[comment._id] === 'submitting' ? (
                                <div className="spinner" style={{ width: '14px', height: '14px' }} />
                              ) : (
                                t('उत्तर दिअ', 'Reply')
                              )}
                            </button>
                          </div>

                          {replyStatusMap[comment._id] === 'error' && (
                            <div style={{ marginTop: '6px', color: 'var(--accent-vermilion)', fontSize: '0.8rem' }}>
                              {replyErrorMap[comment._id]}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* YouTube-style View Replies Toggle */}
                  {replies.length > 0 && (
                    <div style={{ marginTop: '6px' }}>
                      <button
                        type="button"
                        onClick={() => toggleRepliesExpansion(comment._id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#EAB308',
                          cursor: 'pointer',
                          padding: '4px 0',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                        }}
                      >
                        {isRepliesExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
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
                            marginTop: '12px',
                            paddingLeft: '14px',
                            borderLeft: '2px solid rgba(234, 179, 8, 0.25)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                          }}
                        >
                          {replies.map((reply) => {
                            const isReplySelf = user && (reply.userId === user.id);
                            const replyAuthor = (isReplySelf && user.name)
                              ? user.name
                              : ((reply.authorName && reply.authorName !== 'Community Member') ? reply.authorName : (isReplySelf ? user.name : 'Member'));
                            const replyAvatar = (isReplySelf && user.avatar) ? user.avatar : reply.authorAvatar;

                            return (
                              <div key={reply._id} style={{ display: 'flex', gap: '10px' }}>
                                <UserAvatar name={replyAuthor} avatar={replyAvatar} size={28} />

                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 700, color: '#F8FAFC', fontSize: '0.85rem' }}>
                                      {replyAuthor}
                                    </span>
                                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                    {timeAgo(reply.createdAt)}
                                  </span>
                                </div>

                                <p style={{ margin: '0 0 6px 0', color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: '1.5' }}>
                                  {reply.text}
                                </p>

                                {/* Nested Reply Actions */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleLike(reply._id)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: reply.isLiked ? '#EAB308' : 'var(--text-secondary)',
                                      cursor: 'pointer',
                                      padding: '2px 4px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      fontSize: '0.78rem',
                                      fontWeight: reply.isLiked ? 700 : 500,
                                    }}
                                  >
                                    <ThumbsUp size={13} fill={reply.isLiked ? '#EAB308' : 'none'} />
                                    <span>{reply.likes || 0}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => openReplyBox(comment._id, replyAuthor)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: 'var(--text-secondary)',
                                      cursor: 'pointer',
                                      padding: '2px 4px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      fontSize: '0.78rem',
                                      fontWeight: 600,
                                    }}
                                  >
                                    <Reply size={13} />
                                    <span>{t('उत्तर', 'Reply')}</span>
                                  </button>
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
    </div>
  );
}
