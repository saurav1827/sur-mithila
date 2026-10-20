import { ObjectId } from 'mongodb';
import { getDatabase } from './mongodb';

export const PAGE_SIZE = 10;

// recordings are addressed by recording_id, falling back to Mongo _id
export function recordingFilter(id) {
    return ObjectId.isValid(id) && String(id).length === 24
        ? { $or: [{ recording_id: id }, { _id: new ObjectId(id) }] }
        : { recording_id: id };
}

// Offset paging keeps 'latest' and 'top' on one code path; the client de-dupes by id.
export async function getCommunityPage({ offset = 0, sort = 'latest', limit = PAGE_SIZE } = {}) {
    const db = await getDatabase();
    if (!db) return { items: [], nextOffset: null };

    const sortSpec = sort === 'top' ? { likes: -1, created_at: -1 } : { created_at: -1 };
    const docs = await db.collection('community_recordings')
        .find({ status: 'published' }).sort(sortSpec).skip(offset).limit(limit + 1).toArray();
    const hasMore = docs.length > limit;
    const page = docs.slice(0, limit);

    // Join the ORIGINAL song so every cover shows real artwork + the original singer
    const slugs = [...new Set(page.map((r) => r.song_slug || r.song_id).filter(Boolean))];
    const originals = slugs.length
        ? await db.collection('songs').find({ slug: { $in: slugs } })
            .project({ slug: 1, title: 1, poster: 1, credits: 1 }).toArray()
        : [];
    const by = new Map(originals.map((o) => [o.slug, o]));

    const items = page.map((r) => {
        const slug = r.song_slug || r.song_id;
        const o = by.get(slug);
        const name = r.user_name || 'Anonymous';
        return {
            id: String(r.recording_id || r._id),
            user: { id: r.user_id || null, name, avatar: r.user_avatar || null },
            song: {
                slug,
                title: o?.title?.canonical || r.song_title || 'अज्ञात गीत',
                poster: o?.poster?.image_url || null,
                originalSinger: o?.credits?.singer || null,
            },
            audioUrl: r.audio_url,
            likes: r.likes || 0,
            commentsCount: r.comments_count ?? r.comments?.length ?? 0,
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
        };
    });
    return { items, nextOffset: hasMore ? offset + limit : null };
}