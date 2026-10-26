'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Heart, MessageSquare, AtSign, Check, X, Sparkles, ExternalLink, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';



export default function NotificationBell() {
  const { user, openSignIn } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Poll notifications periodically when user is signed in
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 25000); // 25s polling
    return () => clearInterval(interval);
  }, [user]);

  // Click outside or press Escape to close
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  const handleToggle = () => {
    if (!user) {
      openSignIn();
      return;
    }
    const nextState = !open;
    setOpen(nextState);
    if (nextState) {
      fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true })
      });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  const clearAllNotifications = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearAll: true })
      });
      setUnreadCount(0);
      setNotifications([]);
    } catch (err) {
      console.error('Failed to clear notifications:', err);
    }
  };

  const handleItemClick = async (notif) => {
    setOpen(false);
    if (!notif.isRead) {
      try {
        await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notificationId: notif.id })
        });
        setUnreadCount(prev => Math.max(0, prev - 1));
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
      } catch (err) {}
    }

    if (notif.targetUrl) {
      try {
        const targetUrlObj = new URL(notif.targetUrl, window.location.origin);
        const isSamePage = window.location.pathname === targetUrlObj.pathname;

        const recId = targetUrlObj.searchParams.get('recordingId') || targetUrlObj.searchParams.get('recording') || targetUrlObj.searchParams.get('rec');
        const commId = targetUrlObj.searchParams.get('commentId');
        const openComm = targetUrlObj.searchParams.get('openComments') === 'true' || Boolean(commId);

        if (isSamePage && recId) {
          // 1. Dispatch custom event so community view catches it instantly
          window.dispatchEvent(new CustomEvent('sur_mithila_navigate_target', {
            detail: { recordingId: recId, commentId: commId, openComments: openComm }
          }));

          // 2. Immediate direct smooth scroll to card
          const el = document.getElementById(`recording-${recId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.remove('card-target-highlight');
            void el.offsetWidth;
            el.classList.add('card-target-highlight');
            setTimeout(() => el.classList.remove('card-target-highlight'), 3500);
          }

          // 3. Update history without disruptive full reload
          window.history.pushState(null, '', notif.targetUrl);
          return;
        }
      } catch (err) {
        console.error('In-page navigation error:', err);
      }

      router.push(notif.targetUrl);
    }
  };

  const renderIcon = (type = '') => {
    if (type.includes('like')) {
      return <Heart size={14} color="#F43F5E" fill="#F43F5E" />;
    }
    if (type.includes('reply') || type.includes('comment')) {
      return <MessageSquare size={14} color="#38BDF8" />;
    }
    if (type.includes('mention')) {
      return <AtSign size={14} color="#EAB308" />;
    }
    return <Bell size={14} color="#EAB308" />;
  };

  const formatRelativeTime = (dateString) => {
    if (!dateString) return '';
    const now = new Date();
    const date = new Date(dateString);
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return t('आबहि (Just now)', 'Just now', 'आबहि');
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return t(`${diffMin} मि. पहिने`, `${diffMin}m ago`, `${diffMin} मि. पहिने`);
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return t(`${diffHour} घंटा पहिने`, `${diffHour}h ago`, `${diffHour} घंटा पहिने`);
    const diffDay = Math.floor(diffHour / 24);
    return t(`${diffDay} दिन पहिने`, `${diffDay}d ago`, `${diffDay} दिन पहिने`);
  };

  const renderDescription = (notif) => {
    const rawTitle = notif.resourceTitle ? notif.resourceTitle.trim() : '';
    const defaultTag = t('गान', 'song', 'गान');
    const titleTag = rawTitle ? `'${rawTitle}'` : defaultTag;

    if (notif.type === 'recording_like') {
      return t(`अहाँक गान ${titleTag} पर लाइक कएलनि`, `liked your song ${titleTag}`, `अहाँक गान ${titleTag} पसंद कएलनि`);
    }
    if (notif.type === 'recording_comment' || notif.type === 'post_reply') {
      return t(`अहाँक गान ${titleTag} पर टिप्पणी कएलनि`, `commented on your song ${titleTag}`, `अहाँक गान ${titleTag} पर टिप्पणी कएलनि`);
    }
    if (notif.type === 'comment_reply') {
      return t('अहाँक टिप्पणीक उत्तर देलनि', 'replied to your comment', 'अहाँक टिप्पणीक उत्तर देलनि');
    }
    if (notif.type === 'mention') {
      return t('अहाँक एक टिप्पणी में उल्लेख (@mention) कएलनि', 'mentioned you in a comment', 'अहाँक एक टिप्पणी में उल्लेख कएलनि');
    }
    return t('अहाँक पोस्ट संग जुड़ल गतिविधि', 'activity on your post', 'अहाँक पोस्टक गतिविधि');
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Notification Bell Button */}
      <button
        type="button"
        onClick={handleToggle}
        className="nav-notification-bell-btn"
        aria-label={t('सूचना', 'Notifications', 'सूचना')}
        title={unreadCount > 0 ? t(`${unreadCount} नव सूचना (Notifications)`, `${unreadCount} new notifications`, `${unreadCount} नव सूचना`) : t('सूचना (Notifications)', 'Notifications', 'सूचना')}
      >
        <Bell size={20} color={unreadCount > 0 ? '#EAB308' : '#FAFAFA'} />
        {unreadCount > 0 && (
          <span className="nav-notification-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Panel */}
      {open && (
        <>
          {/* Mobile backdrop scrim */}
          <div
            className="nav-notif-backdrop"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <div
            className="nav-notification-dropdown"
            role="dialog"
            aria-modal="true"
            aria-label={t('सूचना मंजूषा', 'Notifications Panel')}
          >
            {/* Header */}
            <div className="nav-notif-header">
              <div className="nav-notif-title-group">
                <div className="nav-notif-icon-badge">
                  <Bell size={16} color="#EAB308" />
                </div>
                <h3 className="nav-notif-title font-traditional">
                  {t('सूचना मंजूषा', 'Notifications')}
                </h3>
                {unreadCount > 0 && (
                  <span className="nav-notif-header-count">
                    {unreadCount} {t('नव', 'new')}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="nav-notif-close-btn"
                aria-label={t('बंद करू', 'Close')}
                title={t('बंद करू', 'Close')}
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick Action Toolbar (only if notifications exist) */}
            {notifications.length > 0 && (
              <div className="nav-notif-toolbar">
                <span className="nav-notif-toolbar-summary">
                  {unreadCount > 0
                    ? `${unreadCount} ${t('बिना पढ़ल', 'unread')}`
                    : t('सभ पढ़ल मानल गेल', 'All caught up')}
                </span>

                <div className="nav-notif-toolbar-actions">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="nav-notif-toolbar-btn mark-read"
                      title={t('सभ पढ़ल मानू', 'Mark all as read')}
                    >
                      <Check size={12} strokeWidth={2.5} />
                      <span>{t('सभ पढ़ल मानू', 'Mark read')}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={clearAllNotifications}
                    className="nav-notif-toolbar-btn clear-all"
                    title={t('सभ मेटाउ', 'Clear all notifications')}
                  >
                    <Trash2 size={12} />
                    <span>{t('सभ मेटाउ', 'Clear all')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* List */}
            <div className="nav-notif-body">
              {notifications.length === 0 ? (
                <div className="nav-notif-empty">
                  <div className="nav-notif-empty-icon">
                    <Sparkles size={24} color="#EAB308" />
                  </div>
                  <p className="font-traditional" style={{ margin: '0 0 6px', color: '#F8FAFC', fontWeight: 600, fontSize: '0.95rem' }}>
                    {t('कोनो नव सूचना नहि अछि', 'No new notifications')}
                  </p>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4, maxWidth: '260px', display: 'inline-block' }}>
                    {t('लाइक्स, टिप्पणियाँ आ मेंशनक सूचना एतय देखाइत।', 'Likes, comments, and mentions will appear here.')}
                  </span>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleItemClick(notif)}
                    className={`nav-notif-item ${!notif.isRead ? 'unread' : ''}`}
                  >
                    <div className="nav-notif-item-left">
                      <div className="nav-notif-avatar-box">
                        {notif.actorAvatar ? (
                          <img src={notif.actorAvatar} alt={notif.actorName} className="nav-notif-avatar" />
                        ) : (
                          <div className="nav-notif-avatar-fallback">
                            {notif.actorName?.charAt(0) || 'U'}
                          </div>
                        )}
                        <span className="nav-notif-type-icon">
                          {renderIcon(notif.type)}
                        </span>
                      </div>

                      <div className="nav-notif-content">
                        <p className="nav-notif-text">
                          <strong className="nav-notif-actor">{notif.actorName}</strong>{' '}
                          <span className="nav-notif-desc">{renderDescription(notif)}</span>
                        </p>

                        {notif.textPreview && (
                          <p className="nav-notif-preview">
                            "{notif.textPreview}"
                          </p>
                        )}

                        <span className="nav-notif-time">
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                      </div>
                    </div>

                    {!notif.isRead && (
                      <span className="nav-notif-unread-dot" title={t('बिना पढ़ल', 'Unread')} />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
