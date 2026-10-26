/**
 * web/lib/history-utils.js
 * Universal helper to record community covers and songs into watch/listening history
 * Across PostPlayer, SongHeroVideo, VersionsStrip, Profile, and PlayerContext.
 */

export function recordCoverInHistory(item) {
  if (!item || typeof window === 'undefined') return;
  try {
    const rawId = item.recording_id || item.id || item._id || '';
    const cleanId = String(rawId).replace(/^cover-/, '');
    const coverId = cleanId ? `cover-${cleanId}` : `cover-${Date.now()}`;

    const audioUrl =
      item.audioUrl ||
      item.audio_url ||
      item.recording_url ||
      item.audio?.hosted_audio_url ||
      '';

    const songSlug =
      item.song?.slug ||
      item.song_slug ||
      item.slug ||
      '';

    const rawTitle =
      (typeof item.song?.title === 'object' ? item.song.title.canonical : item.song?.title) ||
      item.song_title ||
      item.title?.canonical ||
      item.title ||
      'Maithili Geet';
    const cleanTitle = typeof rawTitle === 'string' ? rawTitle.replace(/\s*\(Cover\)$/i, '') : 'Maithili Geet';
    const finalTitle = `${cleanTitle} (Cover)`;

    const rawSinger =
      item.user?.name ||
      item.user_name ||
      item.artist_name ||
      item.singer ||
      'कलाकार';
    const cleanSinger = typeof rawSinger === 'string' ? rawSinger.replace(/\s*\(Cover\)$/i, '') : 'कलाकार';
    const finalSinger = `${cleanSinger} (Cover)`;

    const poster =
      item.song?.poster?.image_url ||
      item.song?.poster ||
      item.song_poster ||
      item.poster?.image_url ||
      item.poster ||
      item.user?.avatar ||
      null;

    const category = item.song?.category || item.category || 'कवर प्रस्तुति';

    const historyItem = {
      id: coverId,
      slug: songSlug,
      title: finalTitle,
      singer: finalSinger,
      poster: poster,
      category: category,
      youtube: {},
      audio: { hosted_audio_url: audioUrl },
      played_at: new Date().toISOString()
    };

    // 1. Immediately persist to localStorage
    const raw = localStorage.getItem('sur_mithila_history') || '[]';
    let local = [];
    try {
      local = JSON.parse(raw);
    } catch {}
    const filtered = local.filter((i) => i.id !== historyItem.id && i.id !== cleanId);
    localStorage.setItem('sur_mithila_history', JSON.stringify([historyItem, ...filtered].slice(0, 80)));

    // 2. Dispatch custom event so any open history tabs or badges update reactively
    window.dispatchEvent(new CustomEvent('sur_mithila_history_updated', { detail: historyItem }));

    // 3. Asynchronously sync to backend MongoDB
    fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ song: historyItem })
    }).catch(() => {});
  } catch (err) {
    console.warn('[recordCoverInHistory] Failed:', err);
  }
}
