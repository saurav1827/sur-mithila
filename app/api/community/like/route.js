import { NextResponse } from 'next/server';
import { getDatabase } from '../../../../lib/mongodb';
import { recordingFilter } from '../../../../lib/community-service';
import { createNotification } from '../../../../lib/notification-service';

export const dynamic = 'force-dynamic';
// Needs a unique index: community_likes { recording_id: 1, anon_id: 1 }

export async function POST(req) {
    const { recordingId, anonId, like } = await req.json().catch(() => ({}));
    if (typeof recordingId !== 'string' || typeof anonId !== 'string' || recordingId.length > 64 || anonId.length > 64) {
        return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }
    const db = await getDatabase();
    if (!db) return NextResponse.json({ error: 'db_unavailable' }, { status: 503 });

    const likes = db.collection('community_likes');
    const recs = db.collection('community_recordings');
    const filter = recordingFilter(recordingId);
    const key = { recording_id: recordingId, anon_id: anonId };

    // Idempotent: the counter only moves when the like row actually changes
    if (like) {
        const r = await likes.updateOne(key, { $setOnInsert: { created_at: new Date() } }, { upsert: true });
        if (r.upsertedCount) {
            await recs.updateOne(filter, { $inc: { likes: 1 } });
            // Notify recording creator
            recs.findOne(filter, { projection: { user_id: 1, song_title: 1, song_slug: 1, song_id: 1, title: 1 } }).then(async (rec) => {
                if (rec?.user_id && rec.user_id !== anonId) {
                    let actorName = 'मिथिला स्नेही';
                    let actorAvatar = null;
                    if (anonId && !anonId.startsWith('anon_')) {
                        const actor = await db.collection('users').findOne({ id: anonId });
                        if (actor?.name) actorName = actor.name;
                        if (actor?.avatar) actorAvatar = actor.avatar;
                    }

                    // Resolve true song title
                    let songTitle = rec.song_title;
                    const slug = rec.song_slug || rec.song_id;
                    if (!songTitle && slug) {
                        const orig = await db.collection('songs').findOne({ slug }, { projection: { 'title.canonical': 1, 'title.en': 1 } });
                        songTitle = orig?.title?.canonical || orig?.title?.en;
                    }
                    songTitle = songTitle || rec.title || 'अहाँक गान';

                    createNotification({
                        recipientId: rec.user_id,
                        actorId: anonId,
                        actorName,
                        actorAvatar,
                        type: 'recording_like',
                        resourceId: recordingId,
                        resourceType: 'community_recording',
                        resourceTitle: songTitle,
                        targetUrl: `/community?recordingId=${encodeURIComponent(recordingId)}`
                    }).catch(console.error);
                }
            }).catch(() => {});
        }
    } else {
        const r = await likes.deleteOne(key);
        if (r.deletedCount) await recs.updateOne(filter, { $inc: { likes: -1 } });
    }
    const doc = await recs.findOne(filter, { projection: { likes: 1 } });
    return NextResponse.json({ likes: Math.max(0, doc?.likes || 0) });
}