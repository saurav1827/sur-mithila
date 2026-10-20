import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getAuthRole } from '../../../../../lib/authz';
import { getDatabase } from '../../../../../lib/mongodb';
import { toRoman } from '../../../../../lib/slugs';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/edit-requests/[id]
 * Action: 'apply' | 'reject'
 */
export async function POST(request, { params }) {
  try {
    const { userId, role } = await getAuthRole();
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const action = body.action; // 'apply' | 'reject'

    if (!['apply', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be apply or reject.' }, { status: 400 });
    }

    const db = await getDatabase();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid request ID' }, { status: 400 });
    }

    const reqDoc = await db.collection('edit_requests').findOne({ _id: new ObjectId(id) });
    if (!reqDoc) {
      return NextResponse.json({ error: 'Edit request not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    if (action === 'reject') {
      await db.collection('edit_requests').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            status: 'rejected',
            reviewedBy: userId,
            reviewedAt: now,
            reviewNote: body.reason || 'संशोधन स्वीकार नहि कएल गेल।'
          }
        }
      );
      return NextResponse.json({
        success: true,
        message: 'संशोधन अनुरोध अस्वीकृत कएल गेल।'
      });
    }

    // Action === 'apply'
    const songId = reqDoc.songId;
    const song = await db.collection('songs').findOne({ $or: [{ id: songId }, { slug: songId }] });
    if (!song) {
      return NextResponse.json({ error: 'संबद्ध गीत डाटाबेस मे नहि भेटल (Song not found)' }, { status: 404 });
    }

    // Changes to apply can come from body (if admin tweaked them) or the original request changes
    const changesToApply = Array.isArray(body.changes) ? body.changes : reqDoc.changes;
    const songUpdates = {};

    for (const ch of (changesToApply || [])) {
      const path = ch.path;
      const val = typeof ch.newValue === 'string' ? ch.newValue.trim() : ch.newValue;

      if (!path || val === undefined) continue;

      if (path === 'title.canonical') {
        songUpdates['title.canonical'] = val;
        songUpdates['title.devanagari'] = val;
        songUpdates['title.roman'] = toRoman(val);
      } else if (path === 'credits.singer') {
        songUpdates['credits.singer'] = val;
      } else if (path === 'credits.writer.name') {
        songUpdates['credits.writer.name'] = val;
      } else if (path === 'credits.composer.name') {
        songUpdates['credits.composer.name'] = val;
      } else if (path === 'category') {
        songUpdates['category'] = val;
      } else if (path === 'lyrics.devanagari') {
        songUpdates['lyrics.devanagari'] = val;
        songUpdates['lyrics.roman'] = toRoman(val);
      } else if (path === 'youtube.url' || path === 'youtube.video_id') {
        let vid = val;
        let url = val;
        if (val.includes('http')) {
          url = val;
          const match = val.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
          if (match) vid = match[1];
        } else {
          vid = val;
          url = `https://www.youtube.com/watch?v=${val}`;
        }
        songUpdates['youtube.url'] = url;
        songUpdates['youtube.video_id'] = vid;
        songUpdates['poster.image_url'] = `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
      } else {
        songUpdates[path] = val;
      }
    }

    songUpdates['updated_at'] = now;
    songUpdates['last_edited_by'] = `admin_${userId}_via_suggestion`;

    // Apply to song in MongoDB
    await db.collection('songs').updateOne(
      { _id: song._id },
      { $set: songUpdates }
    );

    // Mark edit request as approved
    await db.collection('edit_requests').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'approved',
          reviewedBy: userId,
          reviewedAt: now,
          appliedChanges: songUpdates
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: `संशोधन स्वीकृत क' गीत "${song.title?.canonical || song.id}" मे लागू कएल गेल!`,
      songId: song.id
    });
  } catch (err) {
    console.error('[Admin API] POST /api/admin/edit-requests/[id] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
