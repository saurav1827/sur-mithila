import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDatabase } from '../../../../lib/mongodb';
import { recordingFilter } from '../../../../lib/community-service';
import { getAuthRole } from '../../../../lib/authz';

export const dynamic = 'force-dynamic';

export async function DELETE(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    let recordingId = searchParams.get('recordingId');
    if (!recordingId) {
      const body = await req.json().catch(() => ({}));
      recordingId = body?.recordingId;
    }

    if (!recordingId || typeof recordingId !== 'string') {
      return NextResponse.json({ success: false, error: 'Valid recordingId is required' }, { status: 400 });
    }

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
    }

    const recCol = db.collection('community_recordings');
    const recording = await recCol.findOne(recordingFilter(recordingId));
    if (!recording) {
      return NextResponse.json({ success: false, error: 'Recording not found' }, { status: 404 });
    }

    // Authorization: only the creator of the recording or an admin can delete it
    const { role } = await getAuthRole();
    const userDoc = await db.collection('users').findOne({ id: userId });
    const isOwner = (recording.user_id === userId) || (
      recording.user_name && userDoc?.name &&
      recording.user_name.trim().toLowerCase() === userDoc.name.trim().toLowerCase()
    );
    const isAdmin = (role === 'admin');

    if (!isOwner && !isAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Permission denied: You can only delete your own recordings.'
      }, { status: 403 });
    }

    // 1. Delete the recording document
    await recCol.deleteOne(recordingFilter(recordingId));

    const canonicalRecId = recording.recording_id || recordingId;

    // 2. Cascade delete all comments associated with this recording
    try {
      await db.collection('community_comments').deleteMany({
        $or: [
          { recording_id: canonicalRecId },
          { recording_id: recordingId }
        ]
      });
    } catch (err) {
      console.error('[Delete Recording] Cascade comments deletion error:', err);
    }

    // 3. Cascade delete all likes associated with this recording
    try {
      await db.collection('community_likes').deleteMany({
        $or: [
          { recording_id: canonicalRecId },
          { recording_id: recordingId }
        ]
      });
    } catch (err) {
      console.error('[Delete Recording] Cascade likes deletion error:', err);
    }

    return NextResponse.json({
      success: true,
      deletedRecordingId: recordingId
    });
  } catch (error) {
    console.error('[Delete Recording Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const recordingId = searchParams.get('recordingId');
    if (!recordingId) {
      return NextResponse.json({ success: false, error: 'recordingId is required' }, { status: 400 });
    }

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
    }

    const rec = await db.collection('community_recordings').findOne(recordingFilter(recordingId));
    if (!rec) {
      return NextResponse.json({ success: false, error: 'Recording not found' }, { status: 404 });
    }

    const slug = rec.song_slug || rec.song_id;
    let songDoc = null;
    if (slug) {
      songDoc = await db.collection('songs').findOne(
        { slug },
        { projection: { slug: 1, title: 1, poster: 1, credits: 1 } }
      );
    }

    const item = {
      id: String(rec.recording_id || rec._id),
      user: {
        id: rec.user_id || null,
        name: rec.user_name || 'Anonymous',
        avatar: rec.user_avatar || null,
      },
      song: {
        slug,
        title: songDoc?.title?.canonical || rec.song_title || 'अज्ञात गीत',
        poster: songDoc?.poster?.image_url || null,
        originalSinger: songDoc?.credits?.singer || null,
      },
      audioUrl: rec.audio_url,
      duration: Number(rec.duration) || 0,
      likes: rec.likes || 0,
      commentsCount: rec.comments_count ?? rec.comments?.length ?? 0,
      createdAt: rec.created_at ? new Date(rec.created_at).toISOString() : null,
    };

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error('[GET Recording Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
