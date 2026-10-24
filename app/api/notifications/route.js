import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ObjectId } from 'mongodb';
import { getDatabase } from '../../../lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: true, notifications: [], unreadCount: 0 });
    }

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
    }

    const notifications = await db.collection('notifications')
      .find({ recipient_id: String(userId) })
      .sort({ created_at: -1 })
      .limit(30)
      .toArray();

    const unreadCount = await db.collection('notifications').countDocuments({
      recipient_id: String(userId),
      is_read: false
    });

    const formatted = notifications.map(n => ({
      id: n._id.toString(),
      type: n.type,
      actorName: n.actor_name,
      actorAvatar: n.actor_avatar,
      resourceTitle: n.resource_title,
      textPreview: n.text_preview,
      targetUrl: n.target_url,
      isRead: Boolean(n.is_read),
      createdAt: n.created_at
    }));

    return NextResponse.json({
      success: true,
      unreadCount,
      notifications: formatted
    });
  } catch (error) {
    console.error('[Notifications API GET] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { notificationId, markAll, clearAll } = await req.json().catch(() => ({}));

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
    }

    if (clearAll) {
      await db.collection('notifications').deleteMany({ recipient_id: String(userId) });
    } else if (markAll) {
      await db.collection('notifications').updateMany(
        { recipient_id: String(userId), is_read: false },
        { $set: { is_read: true, read_at: new Date() } }
      );
    } else if (notificationId && ObjectId.isValid(notificationId)) {
      await db.collection('notifications').updateOne(
        { _id: new ObjectId(notificationId), recipient_id: String(userId) },
        { $set: { is_read: true, read_at: new Date() } }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Notifications API POST] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
    }

    await db.collection('notifications').deleteMany({ recipient_id: String(userId) });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Notifications API DELETE] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
