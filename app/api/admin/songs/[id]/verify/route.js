import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getAuthRole } from '../../../../../../lib/authz';
import { getDatabase } from '../../../../../../lib/mongodb';

export const dynamic = 'force-dynamic';

function getSongQuery(id) {
  const query = [{ id: id }, { slug: id }];
  if (ObjectId.isValid(id)) {
    query.push({ _id: new ObjectId(id) });
  }
  return { $or: query };
}

/**
 * POST /api/admin/songs/[id]/verify
 * 1-click verify song in MongoDB
 */
export async function POST(request, { params }) {
  try {
    const { userId, role } = await getAuthRole();
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const db = await getDatabase();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    const songsCol = db.collection('songs');
    const song = await songsCol.findOne(getSongQuery(id));
    if (!song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 });
    }

    await songsCol.updateOne(
      { _id: song._id },
      {
        $set: {
          'verification.status': 'verified',
          'verification.confidence': 'high',
          'verification.last_verified_at': new Date().toISOString(),
          'verification.verified_by': userId,
          'youtube.verified': true,
          updated_at: new Date().toISOString()
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: `गीत "${song.title?.canonical || song.id}" सफलता पूर्वक सत्यापित कएल गेल!`,
      songId: song.id
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
