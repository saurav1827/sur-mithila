// Tracks listening history, favorites, and seen recommendations to ensure fresh, non-repetitive AI discovery.
const RECENT_KEY = 'sur_mithila_recent';
const HISTORY_KEY = 'sur_mithila_history';
const SEEN_KEY = 'sur_mithila_seen';

export function pushRecent(id) {
    if (!id) return;
    try {
        const a = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter((x) => x !== id);
        a.unshift(id);
        localStorage.setItem(RECENT_KEY, JSON.stringify(a.slice(0, 50)));
    } catch { }
}

export function getAllFavorites() {
    if (typeof window === 'undefined') return [];
    try {
        const favs = [];
        // Scan all local storage keys for favorites
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('sur_mithila_favs_') || key === 'sur_mithila_guest_favs' || key === 'sur_mithila_favorites')) {
                try {
                    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
                    if (Array.isArray(parsed)) {
                        favs.push(...parsed);
                    }
                } catch { }
            }
        }
        // Deduplicate by id or slug
        const seen = new Set();
        return favs.filter((item) => {
            const id = item?.id || item?.slug;
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
        });
    } catch {
        return [];
    }
}

export function getWatchHistory() {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        const history = raw ? JSON.parse(raw) : [];
        const recentRaw = localStorage.getItem(RECENT_KEY);
        const recent = recentRaw ? JSON.parse(recentRaw) : [];

        // Normalize history items
        const normalized = [];
        const seen = new Set();

        for (const item of history) {
            const id = typeof item === 'string' ? item : (item?.id || item?.slug);
            if (id && !seen.has(id)) {
                seen.add(id);
                normalized.push(item);
            }
        }
        for (const id of recent) {
            if (id && !seen.has(id)) {
                seen.add(id);
                normalized.push({ id });
            }
        }
        return normalized;
    } catch {
        return [];
    }
}

export function markSongsSeen(ids) {
    if (typeof window === 'undefined' || !Array.isArray(ids) || !ids.length) return;
    try {
        const current = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
        const updated = [...new Set([...ids, ...current])].slice(0, 150);
        localStorage.setItem(SEEN_KEY, JSON.stringify(updated));
    } catch { }
}

export function getSeenSongs() {
    if (typeof window === 'undefined') return [];
    try {
        return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
    } catch {
        return [];
    }
}

export function clearSeenCache() {
    if (typeof window === 'undefined') return;
    try {
        localStorage.removeItem(SEEN_KEY);
    } catch { }
}

export function getUserListeningProfile() {
    const history = getWatchHistory();
    const favs = getAllFavorites();
    const seen = getSeenSongs();

    const historyIds = history.map((h) => (typeof h === 'string' ? h : (h?.id || h?.slug))).filter(Boolean);
    const favoriteIds = favs.map((f) => f?.id || f?.slug).filter(Boolean);

    // Inferred preferred singers & categories from history & favorites
    const singerCounts = {};
    const categoryCounts = {};

    [...history, ...favs].forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const singer = item.singer || item.credits?.singer;
        if (singer && singer !== 'पारंपरिक') {
            singerCounts[singer] = (singerCounts[singer] || 0) + 1;
        }
        const cat = item.category;
        if (cat) {
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        }
    });

    const topSingers = Object.entries(singerCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([k]) => k);

    const topCategories = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k]) => k);

    return {
        historyIds,
        favoriteIds,
        seenIds: seen,
        topSingers,
        topCategories
    };
}

export function getSeeds() {
    const profile = getUserListeningProfile();
    return [...new Set([...profile.historyIds, ...profile.favoriteIds])].slice(0, 5);
}