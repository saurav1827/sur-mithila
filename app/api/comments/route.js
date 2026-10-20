import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { ObjectId } from 'mongodb';
import { getDatabase } from '../../../lib/mongodb';
import { moderateComment } from '../../../lib/ai-agents';

export async function POST(request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const data = await request.json().catch(() => ({}));
    if (!data.text || !data.songId || typeof data.text !== 'string' || data.text.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    if (data.text.length > 500) {
      return NextResponse.json({ success: false, error: 'Comment too long (max 500 characters)' }, { status: 400 });
    }

    // AI Comment Moderation Pipeline
    const moderationResult = await moderateComment(data.text);

    if (!moderationResult.isSafe) {
      return NextResponse.json({ 
        success: false, 
        error: 'Comment blocked by AI moderator.',
        reason: moderationResult.reason 
      }, { status: 403 });
    }

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
    }

    // 1. Resolve authentic user profile
    let me = await db.collection('users').findOne({ id: userId });
    let authorName = (data.authorName && data.authorName !== 'Community Member' && data.authorName !== 'Member')
      ? data.authorName
      : me?.name;
    let authorAvatar = data.authorAvatar || me?.avatar;

    if (!authorName || authorName === 'Community Member') {
      const clerkUser = await currentUser();
      authorName =
        clerkUser?.fullName ||
        clerkUser?.username ||
        clerkUser?.emailAddresses?.[0]?.emailAddress?.split('@')[0] ||
        data.authorName ||
        'Member';
      authorAvatar = clerkUser?.imageUrl || authorAvatar || null;

      // Seed/update user into MongoDB
      await db.collection('users').updateOne(
        { id: userId },
        {
          $set: {
            name: authorName,
            avatar: authorAvatar,
            email: clerkUser?.emailAddresses?.[0]?.emailAddress || '',
            role: clerkUser?.publicMetadata?.role || 'user',
            updated_at: new Date().toISOString(),
          },
          $setOnInsert: {
            id: userId,
            bio: '',
            location: '',
            joined_at: new Date().toISOString(),
          },
        },
        { upsert: true }
      );
    }

    // Retroactively update past comments for this user so they never show "Community Member"
    await db.collection('comments').updateMany(
      { userId, $or: [{ authorName: 'Community Member' }, { authorAvatar: null }] },
      { $set: { authorName, authorAvatar } }
    );

    const parentId = data.parentId ? String(data.parentId) : null;

    const comment = {
      songId: data.songId,
      parentId,
      text: data.text.trim(),
      userId,
      authorName,
      authorAvatar,
      likes: 0,
      likedBy: [],
      repliesCount: 0,
      createdAt: new Date().toISOString(),
      status: 'published'
    };

    const result = await db.collection('comments').insertOne(comment);

    // If this is a reply, increment the parent comment's repliesCount
    if (parentId && ObjectId.isValid(parentId)) {
      try {
        await db.collection('comments').updateOne(
          { _id: new ObjectId(parentId) },
          { $inc: { repliesCount: 1 } }
        );
      } catch (err) {
        console.error('Failed to increment parent repliesCount:', err);
      }
    }

    return NextResponse.json({
      success: true,
      id: result.insertedId,
      comment: { ...comment, _id: result.insertedId.toString() }
    });
  } catch (error) {
    console.error('[Comments API] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const songId = searchParams.get('songId');

  if (!songId) {
    return NextResponse.json({ success: false, error: 'Missing songId' }, { status: 400 });
  }

  try {
    const { userId: currentUserId } = await auth();
    const db = await getDatabase();
    if (!db) return NextResponse.json({ success: false, error: 'DB down' }, { status: 503 });

    // Auto-heal current user comments if they were saved with "Community Member"
    if (currentUserId) {
      let me = await db.collection('users').findOne({ id: currentUserId });
      let realName = me?.name;
      let realAvatar = me?.avatar;

      if (!realName || realName === 'Community Member') {
        try {
          const clerkUser = await currentUser();
          if (clerkUser) {
            realName =
              clerkUser.fullName ||
              clerkUser.username ||
              clerkUser.emailAddresses?.[0]?.emailAddress?.split('@')[0] ||
              'Member';
            realAvatar = clerkUser.imageUrl || null;

            await db.collection('users').updateOne(
              { id: currentUserId },
              {
                $set: {
                  id: currentUserId,
                  name: realName,
                  avatar: realAvatar,
                  email: clerkUser.emailAddresses?.[0]?.emailAddress || '',
                },
              },
              { upsert: true }
            );
          }
        } catch { }
      }

      if (realName && realName !== 'Community Member') {
        await db.collection('comments').updateMany(
          { userId: currentUserId, $or: [{ authorName: 'Community Member' }, { authorAvatar: null }] },
          { $set: { authorName: realName, authorAvatar: realAvatar } }
        );
      }
    }

    const rawComments = await db.collection('comments')
      .find({ songId, status: 'published' })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    // Enrich missing user profiles for any comments
    const userIds = [...new Set(rawComments.map((c) => c.userId).filter((id) => id && !id.startsWith('anon')))];
    const users = userIds.length
      ? await db.collection('users').find({ id: { $in: userIds } }).project({ id: 1, name: 1, avatar: 1 }).toArray()
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const comments = rawComments.map((c) => {
      const u = userMap.get(c.userId);
      const likedBy = Array.isArray(c.likedBy) ? c.likedBy : [];

      const authorName = (c.authorName && c.authorName !== 'Community Member')
        ? c.authorName
        : (u?.name || 'Member');
      const authorAvatar = c.authorAvatar || u?.avatar || null;

      return {
        _id: c._id.toString(),
        songId: c.songId,
        parentId: c.parentId || null,
        text: c.text,
        userId: c.userId,
        authorName,
        authorAvatar,
        likes: typeof c.likes === 'number' ? c.likes : likedBy.length,
        isLiked: currentUserId ? likedBy.includes(currentUserId) : false,
        repliesCount: c.repliesCount || 0,
        createdAt: c.createdAt || new Date().toISOString(),
      };
    });

    return NextResponse.json({ comments });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { commentId, action } = await request.json().catch(() => ({}));
    if (!commentId || !ObjectId.isValid(commentId)) {
      return NextResponse.json({ success: false, error: 'Invalid commentId' }, { status: 400 });
    }

    const db = await getDatabase();
    if (!db) return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });

    const objId = new ObjectId(commentId);
    const existing = await db.collection('comments').findOne({ _id: objId });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Comment not found' }, { status: 404 });
    }

    const likedBy = Array.isArray(existing.likedBy) ? existing.likedBy : [];
    const hasLiked = likedBy.includes(userId);

    let updateQuery;
    let nextLikes = typeof existing.likes === 'number' ? existing.likes : likedBy.length;

    if (action === 'unlike' || (action === 'toggle' && hasLiked)) {
      nextLikes = Math.max(0, nextLikes - 1);
      updateQuery = {
        $pull: { likedBy: userId },
        $set: { likes: nextLikes }
      };
    } else {
      nextLikes = nextLikes + 1;
      updateQuery = {
        $addToSet: { likedBy: userId },
        $set: { likes: nextLikes }
      };
    }

    await db.collection('comments').updateOne({ _id: objId }, updateQuery);

    return NextResponse.json({
      success: true,
      likes: nextLikes,
      isLiked: !(action === 'unlike' || (action === 'toggle' && hasLiked))
    });
  } catch (error) {
    console.error('[Comments PATCH Like Error]:', error);
    return NextResponse.json({ success: false, error: 'Failed to update like' }, { status: 500 });
  }
}
