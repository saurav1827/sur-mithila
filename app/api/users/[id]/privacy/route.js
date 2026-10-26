import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getDatabase } from '../../../../../lib/mongodb';
import { canModifyProfilePrivacy, isAdminEmail } from '../../../../../lib/privacy';
import { getAuthRole } from '../../../../../lib/authz';

export const dynamic = 'force-dynamic';

export async function PATCH(req, { params }) {
  try {
    const { userId: viewerUserId, role: viewerRole, email: viewerEmail } = await getAuthRole();
    if (!viewerUserId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const rawId = (await params)?.id;
    if (!rawId) {
      return NextResponse.json({ success: false, error: 'User identifier required' }, { status: 400 });
    }
    const targetUserId = decodeURIComponent(rawId).trim();

    const body = await req.json().catch(() => ({}));
    if (typeof body.is_private !== 'boolean') {
      return NextResponse.json({ success: false, error: 'Boolean is_private field is required' }, { status: 400 });
    }

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
    }

    // Find the target user
    const targetUser = await db.collection('users').findOne({
      $or: [{ id: targetUserId }, { name: targetUserId }],
    });

    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const actualTargetId = targetUser.id;

    // Check authorization: Admin can change anyone; User can change self if allowed
    const canModify = canModifyProfilePrivacy({
      targetUserId: actualTargetId,
      viewerUserId,
      viewerRole,
      viewerEmail,
    });

    if (!canModify) {
      return NextResponse.json({
        success: false,
        error: 'Permission denied: You cannot change the privacy of this account.',
      }, { status: 403 });
    }

    await db.collection('users').updateOne(
      { id: actualTargetId },
      {
        $set: {
          is_private: body.is_private,
          privacy_updated_at: new Date().toISOString(),
          privacy_updated_by: viewerUserId,
          updated_at: new Date().toISOString(),
        },
      }
    );

    return NextResponse.json({
      success: true,
      userId: actualTargetId,
      is_private: body.is_private,
      message: `Account is now ${body.is_private ? 'private' : 'public'}.`,
    });
  } catch (error) {
    console.error('[PATCH /api/users/[id]/privacy Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
