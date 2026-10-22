import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDatabase } from '../../../../lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ blockedUserIds: [] });
    }

    const db = await getDatabase();
    if (!db) return NextResponse.json({ blockedUserIds: [] });

    const blocks = await db.collection('creator_blocks')
      .find({ creator_id: userId })
      .project({ blocked_user_id: 1 })
      .toArray();

    return NextResponse.json({
      blockedUserIds: blocks.map((b) => b.blocked_user_id)
    });
  } catch (error) {
    console.error('[Get Blocked Users Error]:', error);
    return NextResponse.json({ blockedUserIds: [] });
  }
}

export async function POST(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { blockedUserId, action = 'block' } = body;

    if (!blockedUserId || typeof blockedUserId !== 'string') {
      return NextResponse.json({ success: false, error: 'Valid blockedUserId is required' }, { status: 400 });
    }

    if (blockedUserId === userId) {
      return NextResponse.json({ success: false, error: 'You cannot block yourself' }, { status: 400 });
    }

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
    }

    const col = db.collection('creator_blocks');

    if (action === 'block') {
      await col.updateOne(
        { creator_id: userId, blocked_user_id: blockedUserId },
        { $setOnInsert: { created_at: new Date().toISOString() } },
        { upsert: true }
      );
      return NextResponse.json({ success: true, isBlocked: true, message: 'User blocked from commenting on your recordings.' });
    } else if (action === 'unblock') {
      await col.deleteOne({ creator_id: userId, blocked_user_id: blockedUserId });
      return NextResponse.json({ success: true, isBlocked: false, message: 'User unblocked.' });
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action (must be block or unblock)' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Block User Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
