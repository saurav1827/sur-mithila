import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ObjectId } from 'mongodb';
import { getDatabase } from '../../../../lib/mongodb';
import { recordingFilter } from '../../../../lib/community-service';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required to submit reports' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { targetType, targetId, reason, details } = body;

    if (!targetType || !['post', 'comment', 'user'].includes(targetType)) {
      return NextResponse.json({ success: false, error: 'Valid targetType (post, comment, or user) is required' }, { status: 400 });
    }

    if (!targetId || typeof targetId !== 'string') {
      return NextResponse.json({ success: false, error: 'Valid targetId is required' }, { status: 400 });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Reason for report is required' }, { status: 400 });
    }

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
    }

    let reportedUserId = null;

    if (targetType === 'comment' && ObjectId.isValid(targetId)) {
      const comment = await db.collection('community_comments').findOne({ _id: new ObjectId(targetId) });
      reportedUserId = comment?.user_id || null;
    } else if (targetType === 'post') {
      const recording = await db.collection('community_recordings').findOne(recordingFilter(targetId));
      reportedUserId = recording?.user_id || null;
    } else if (targetType === 'user') {
      reportedUserId = targetId;
    }

    const reportDoc = {
      reporter_id: userId,
      target_type: targetType,
      target_id: String(targetId),
      reported_user_id: reportedUserId,
      reason: reason.trim(),
      details: String(details || '').trim().slice(0, 500),
      status: 'pending',
      created_at: new Date().toISOString()
    };

    await db.collection('moderation_reports').insertOne(reportDoc);

    return NextResponse.json({
      success: true,
      message: 'Report submitted successfully. Our team will review this shortly.'
    });
  } catch (error) {
    console.error('[Community Report Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
