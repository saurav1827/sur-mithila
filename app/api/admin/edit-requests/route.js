import { NextResponse } from 'next/server';
import { getAuthRole } from '../../../../lib/authz';
import { getDatabase } from '../../../../lib/mongodb';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/edit-requests
 * Fetch real user edit suggestions
 */
export async function GET(request) {
  try {
    const { role } = await getAuthRole();
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || ''; // 'pending' | 'approved' | 'rejected' | ''

    const db = await getDatabase();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    const filter = {};
    if (status && status !== 'all') {
      if (status === 'pending') {
        filter['status'] = { $in: ['pending', 'pending_triage', 'in_review'] };
      } else {
        filter['status'] = status;
      }
    }

    const requests = await db.collection('edit_requests')
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    // Populate song details if missing
    const songIds = [...new Set(requests.map(r => r.songId).filter(Boolean))];
    const songs = await db.collection('songs')
      .find({ id: { $in: songIds } }, { projection: { id: 1, title: 1, slug: 1, credits: 1, category: 1 } })
      .toArray();

    const songMap = new Map();
    for (const s of songs) {
      songMap.set(s.id, s);
    }

    const enriched = requests.map(r => ({
      ...r,
      _id: r._id.toString(),
      song: songMap.get(r.songId) || { id: r.songId, title: { canonical: r.songTitle || r.songId } }
    }));

    return NextResponse.json({ requests: enriched });
  } catch (err) {
    console.error('[Admin API] GET /api/admin/edit-requests error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
