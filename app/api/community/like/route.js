import { NextResponse } from 'next/server';
import { getDatabase } from '../../../../lib/mongodb';
import { recordingFilter } from '../../../../lib/community-service';

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
        if (r.upsertedCount) await recs.updateOne(filter, { $inc: { likes: 1 } });
    } else {
        const r = await likes.deleteOne(key);
        if (r.deletedCount) await recs.updateOne(filter, { $inc: { likes: -1 } });
    }
    const doc = await recs.findOne(filter, { projection: { likes: 1 } });
    return NextResponse.json({ likes: Math.max(0, doc?.likes || 0) });
}