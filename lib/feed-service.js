import { getSongs, getRecommendations } from './data-service';
import { getDatabase } from './mongodb';
import { CULTURAL_CATEGORIES } from './categories';

// Strip heavy fields (embedding, lyrics, recordings, sources) before sending to the browser.
export const slim = (s, extra = {}) => ({
    id: s.id, slug: s.slug, title: s.title, category: s.category,
    credits: { singer: s.credits?.singer },
    poster: { image_url: s.poster?.image_url },
    youtube: { url: s.youtube?.url, video_id: s.youtube?.video_id },
    audio: s.audio || {},
    verification: { status: s.verification?.status },
    stats: s.stats,
    recording_id: s.recording_id || extra.recording_id,
    cover_id: s.cover_id || extra.cover_id,
    is_cover: Boolean(s.is_cover || extra.is_cover),
    ...extra,
});

const catRows = CULTURAL_CATEGORIES.filter((c) => c.value !== 'all').map((c) => ({
    key: `cat-${c.value}`, kind: 'category', value: c.value, mai: c.name, en: c.name,
    href: `/?category=${encodeURIComponent(c.value)}`,
}));

// The plan is static so cursors stay stable. "For you" is injected client-side (needs localStorage seeds).
export const ROW_PLAN = [
    { key: 'trending', kind: 'trending', mai: 'अखन चर्चित', en: 'Trending now' },
    { key: 'new_covers', kind: 'covers', mai: 'नव कवर', en: 'New covers', href: '/community' },
    ...catRows.slice(0, 3),
    { key: 'verified', kind: 'verified', mai: 'सत्यापित रचना', en: 'Verified lyrics' },
    ...catRows.slice(3),
];

const cache = new Map(); // tiny TTL cache; swap for unstable_cache / Redis in production
const TTL = 60_000;
async function cached(key, fn) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < TTL) return hit.v;
    const v = await fn();
    cache.set(key, { t: Date.now(), v });
    return v;
}

async function fetchCovers(limit) {
    const db = await getDatabase();
    if (!db) return [];
    const recs = await db.collection('community_recordings')
        .find({ $or: [{ status: 'published' }, { status: { $exists: false } }] })
        .sort({ created_at: -1 })
        .limit(limit)
        .toArray();
    const slugs = [...new Set(recs.map((r) => r.song_slug || r.song_id).filter(Boolean))];
    const originals = slugs.length
        ? await db.collection('songs').find({ slug: { $in: slugs } })
            .project({ slug: 1, poster: 1, title: 1, category: 1 }).toArray()
        : [];
    const by = new Map(originals.map((o) => [o.slug, o]));
    return recs.map((r) => {
        const slug = r.song_slug || r.song_id;
        const o = by.get(slug);
        const recId = (r.recording_id || (r._id ? r._id.toString() : '')).toString();
        return {
            id: `cover-${recId}`,
            recording_id: recId,
            cover_id: recId,
            is_cover: true,
            slug,
            title: { canonical: r.song_title || o?.title?.canonical || '' },
            category: o?.category || 'लोकगीत',
            credits: { singer: `${r.user_name || 'Anonymous'} (Cover)` },
            poster: { image_url: r.song_poster || o?.poster?.image_url },
            youtube: {},
            audio: { hosted_audio_url: r.audio_url },
            verification: {},
            stats: {},
            reason: 'समुदायक कवर',
        };
    });
}

async function fetchRow(def) {
    return cached(def.key, async () => {
        switch (def.kind) {
            case 'trending': return (await getSongs({ sort_by: 'popular', limit: 14 })).songs.map((s) => slim(s));
            case 'verified': return (await getSongs({ verified_only: true, sort_by: 'popular', limit: 14 })).songs.map((s) => slim(s));
            case 'category': return (await getSongs({ category: def.value, sort_by: 'popular', limit: 14 })).songs.map((s) => slim(s));
            case 'covers': return fetchCovers(12);
            default: return [];
        }
    });
}

export async function getFeedRows({ cursor = 0, count = 2, category = 'all' } = {}) {
    // Category selected: infinite grid, cursor = page number
    if (category && category !== 'all') {
        const page = Math.max(1, cursor || 1);
        const { songs, pagination } = await getSongs({ category, page, limit: 24, sort_by: 'popular' });
        return {
            rows: [{ key: `grid-${page}`, kind: 'grid', songs: songs.map((s) => slim(s)) }],
            nextCursor: page < pagination.total_pages ? page + 1 : null,
        };
    }
    // Mixed feed: cursor = index into ROW_PLAN. Skip thin rows but keep advancing.
    const rows = [];
    let i = cursor;
    while (i < ROW_PLAN.length && rows.length < count) {
        const def = ROW_PLAN[i++];
        const songs = await fetchRow(def);
        if (songs.length >= 3) rows.push({ key: def.key, title: { mai: def.mai, en: def.en }, href: def.href, songs });
    }
    return { rows, nextCursor: i < ROW_PLAN.length ? i : null };
}

// Personalised row: powered by AI recommendation service with cultural insights & mood intelligence
export async function getForYouRow(seedIds) {
    try {
        const { getAIRecommendations } = await import('./ai-recommendation-service');
        const songs = await getAIRecommendations({
            historyIds: seedIds,
            limit: 14,
            mood: 'all'
        });
        if (songs && songs.length >= 3) {
            return {
                key: 'for_you',
                title: { mai: '✨ अहाँ लेल चुनल (AI Curated)', en: '✨ Recommended for you' },
                songs
            };
        }
    } catch (e) {
        console.warn('[feed-service] AI getForYouRow failed:', e.message);
    }
    return null;
}