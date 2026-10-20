'use client';

// A simple queue to batch events
let queue = [];
let flushInterval = null;

// Set by AuthProvider whenever the signed-in user changes.
let currentUserId = null;
export function setTrackingUserId(id) {
  currentUserId = id || null;
}

// Generate a random anonymous ID if one doesn't exist
export function getAnonId() {
  if (typeof window === 'undefined') return 'server';
  let anonId = localStorage.getItem('sur_mithila_anon_id');
  if (!anonId) {
    anonId = 'anon_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('sur_mithila_anon_id', anonId);
  }
  return anonId;
}

// Generate a session ID (resets when tab closes or after inactivity)
let currentSessionId = null;
export function getSessionId() {
  if (typeof window === 'undefined') return 'server';
  if (!currentSessionId) {
    currentSessionId = 'sess_' + Math.random().toString(36).substring(2, 15);
  }
  return currentSessionId;
}

/**
 * Tracks an interaction event.
 * @param {string} type - 'impression', 'click', 'play', 'complete', 'favorite', 'share'
 * @param {object} payload - Additional data (songId, surface, rankPos, etc.)
 */
export function track(type, payload = {}) {
  if (typeof window === 'undefined') return;

  const event = {
    type,
    ts: Date.now(),
    anonId: getAnonId(),
    sessionId: getSessionId(),
    userId: currentUserId, // Clerk user id (null when signed out). A hint only; derive it server-side with auth() for anything that matters.
    ...payload
  };

  queue.push(event);

  if (queue.length >= 10) {
    flush();
  }

  if (!flushInterval) {
    flushInterval = setInterval(flush, 15000);
  }
}

export function flush() {
  if (queue.length === 0) return;

  const eventsToSend = queue.splice(0, queue.length);

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(eventsToSend)], { type: 'application/json' });
      navigator.sendBeacon('/api/events', blob);
    } else {
      fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventsToSend),
        keepalive: true
      });
    }
  } catch (error) {
    console.error('[Tracking] Failed to flush events', error);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}