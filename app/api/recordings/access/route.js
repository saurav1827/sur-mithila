import { NextResponse } from 'next/server';
import { getDatabase } from '../../../../lib/mongodb';
import { getAuthRole } from '../../../../lib/authz';
import { canViewRecording } from '../../../../lib/privacy';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

/**
 * GET /api/recordings/access?id=...&url=...
 * Real-time gatekeeper for audio playback of community recordings.
 * Verifies whether the viewer is authorized to listen to a recording if it or its creator is private.
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const rawId = searchParams.get('id') || '';
    const audioUrl = searchParams.get('url') || '';

    // If it's not a cover recording (e.g. traditional song from library or YouTube), access is allowed
    const isCover =
      rawId.startsWith('cover-') ||
      rawId.startsWith('rec_') ||
      audioUrl.includes('sur_mithila_covers') ||
      audioUrl.includes('/karaoke_recordings/');

    if (!isCover && !rawId.startsWith('rec_')) {
      return NextResponse.json({ allowed: true });
    }

    const cleanId = rawId.replace(/^cover-/, '').trim();

    const db = await getDatabase();
    if (!db) {
      // In case DB is temporarily unreachable, fallback safely
      return NextResponse.json({ allowed: true });
    }

    const col = db.collection('community_recordings');
    const recording = await col.findOne({
      $or: [
        ...(cleanId ? [{ recording_id: cleanId }, { id: cleanId }] : []),
        ...(cleanId && ObjectId.isValid(cleanId) && cleanId.length === 24 ? [{ _id: new ObjectId(cleanId) }] : []),
        ...(audioUrl ? [{ audio_url: audioUrl }] : []),
      ]
    });

    // If recording record does not exist or isn't a private cover, allow playback
    if (!recording) {
      return NextResponse.json({ allowed: true });
    }

    let creatorUser = null;
    if (recording.user_id || recording.user_email) {
      creatorUser = await db.collection('users').findOne(
        {
          $or: [
            ...(recording.user_id ? [{ id: recording.user_id }] : []),
            ...(recording.user_email ? [{ email: recording.user_email.toLowerCase() }] : []),
          ]
        },
        { projection: { id: 1, name: 1, email: 1, is_private: 1 } }
      );
    }

    const isPrivate = Boolean(recording.is_private || creatorUser?.is_private);
    if (!isPrivate) {
      return NextResponse.json({ allowed: true });
    }

    // It is private: check viewer credentials
    const { userId: viewerUserId, role: viewerRole, email: viewerEmail } = await getAuthRole();

    const allowed = canViewRecording({
      recording,
      creatorUser,
      viewerUserId,
      viewerRole,
      viewerEmail,
    });

    if (!allowed) {
      return NextResponse.json({
        allowed: false,
        isPrivate: true,
        reason: 'This recording has been set to private by the creator.',
        message: 'ई प्रस्तुति निजी अछि। केवल रचयिता आ व्यवस्थापक एकरा सुनि सकैत छथि।',
      }, { status: 403 });
    }

    return NextResponse.json({ allowed: true, isPrivate: true });
  } catch (error) {
    console.error('[Recording Access Check Error]:', error);
    return NextResponse.json({ allowed: true });
  }
}
