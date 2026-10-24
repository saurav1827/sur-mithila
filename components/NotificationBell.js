'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Heart, MessageSquare, AtSign, Check, X, Sparkles, ExternalLink, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const date = new Date(dateString);
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'आबहि (Just now)';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} मि. पहिने`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} घंटा पहिने`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} दिन पहिने`;
}

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

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const renderDescription = (notif) => {
    const rawTitle = notif.resourceTitle ? notif.resourceTitle.trim() : '';
    const titleTag = rawTitle ? `'${rawTitle}'` : 'गान';

    if (notif.type === 'recording_like') {
      return `अहाँक गान ${titleTag} पर लाइक कएलनि`;
    }
    if (notif.type === 'recording_comment' || notif.type === 'post_reply') {
      return `अहाँक गान ${titleTag} पर टिप्पणी कएलनि`;
    }
    if (notif.type === 'comment_reply') {
      return `अहाँक टिप्पणीक उत्तर देलनि`;
    }
    if (notif.type === 'mention') {
      return `अहाँक एक टिप्पणी में उल्लेख (@mention) कएलनि`;
    }
    return `अहाँक पोस्ट संग जुड़ल गतिविधि`;
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Notification Bell Button */}
      <button
        type="button"
        onClick={handleToggle}
        className="nav-notification-bell-btn"
        aria-label="Notifications"
        title={unreadCount > 0 ? `${unreadCount} नव सूचना (Notifications)` : 'सूचना (Notifications)'}
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
        <div className="nav-notification-dropdown" role="dialog" aria-label="Notifications Panel">
          {/* Header */}
          <div className="nav-notif-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={16} color="#EAB308" />
              <h3 className="font-traditional" style={{ fontSize: '1rem', color: '#F8FAFC', margin: 0, fontWeight: 700 }}>
                {t('सूचना मंजूषा', 'Notifications')}
              </h3>
              {unreadCount > 0 && (
                <span className="nav-notif-header-count">
                  {unreadCount} नव
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="nav-notif-mark-btn"
                  title="Mark all as read"
                >
                  <Check size={12} />
                  <span>सभ पढ़ल मानू</span>
                </button>
              )}

              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllNotifications}
                  className="nav-notif-clear-btn"
                  title="Clear all notifications"
                >
                  <Trash2 size={12} />
                  <span>सभ मेटाउ</span>
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="nav-notif-body">
            {notifications.length === 0 ? (
              <div className="nav-notif-empty">
                <div className="nav-notif-empty-icon">
                  <Sparkles size={24} color="#EAB308" />
                </div>
                <p className="font-traditional" style={{ margin: '0 0 4px', color: '#F8FAFC', fontWeight: 600 }}>
                  कोनो नव सूचना नहि अछि
                </p>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  लाइक्स, टिप्पणियाँ आ मेंशनक सूचना एतय देखाइत।
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
                        <strong style={{ color: '#F8FAFC' }}>{notif.actorName}</strong>{' '}
                        <span>{renderDescription(notif)}</span>
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

                  {!notif.isRead && <span className="nav-notif-unread-dot" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
