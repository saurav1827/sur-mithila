import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { ObjectId } from 'mongodb';
import { getDatabase } from '../../../../lib/mongodb';
import { recordingFilter } from '../../../../lib/community-service';
import { moderateComment } from '../../../../lib/ai-agents';
import { getAuthRole } from '../../../../lib/authz';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const recordingId = sp.get('recordingId');
  if (!recordingId) return NextResponse.json({ comments: [] });

  try {
    const { userId: currentUserId } = await auth();
    const db = await getDatabase();
    if (!db) return NextResponse.json({ comments: [] });

    // Fetch post creator ID to inform the client of post ownership
    const recording = await db.collection('community_recordings').findOne(
      recordingFilter(recordingId),
      { projection: { user_id: 1 } }
    );
    const recordingAuthorId = recording?.user_id || null;

    const rawComments = await db.collection('community_comments')
      .find({ recording_id: recordingId })
      .sort({ created_at: -1 })
      .toArray();

    // Enrich with users collection if needed
    const userIds = [...new Set(rawComments.map((c) => c.user_id).filter((id) => id && !id.startsWith('anon')))];
    const users = userIds.length
      ? await db.collection('users').find({ id: { $in: userIds } }).project({ id: 1, name: 1, avatar: 1 }).toArray()
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const comments = rawComments.map((c) => {
      const u = userMap.get(c.user_id);
      const likedBy = Array.isArray(c.liked_by) ? c.liked_by : [];

      const author = (c.author && c.author !== 'Community Member')
        ? c.author
        : (u?.name || 'Member');
      const avatar = c.avatar || u?.avatar || null;

      return {
        id: c._id.toString(),
        _id: c._id.toString(),
        parentId: c.parent_id || null,
        author,
        authorName: author,
        avatar,
        authorAvatar: avatar,
        text: c.text,
        userId: c.user_id || null,
        likes: typeof c.likes === 'number' ? c.likes : likedBy.length,
        isLiked: currentUserId ? likedBy.includes(currentUserId) : false,
        createdAt: c.created_at || new Date().toISOString(),
        fresh: false,
      };
    });

    return NextResponse.json({ comments, recordingAuthorId });
  } catch (e) {
    console.error('[api/community/comments GET]', e);
    return NextResponse.json({ comments: [], recordingAuthorId: null });
  }
}

export async function POST(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const bodyData = await req.json().catch(() => ({}));
    const { recordingId, anonId, text, parentId } = bodyData;
    if (typeof recordingId !== 'string' || !text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    if (text.length > 500) {
      return NextResponse.json({ success: false, error: 'Comment too long (max 500 characters)' }, { status: 400 });
    }

    const db = await getDatabase();
    if (!db) return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });

    // 1. Check if user is globally banned
    const userDoc = await db.collection('users').findOne({ id: userId });
    if (userDoc?.is_banned || userDoc?.status === 'banned') {
      return NextResponse.json({
        success: false,
        error: 'Your account is suspended from commenting on community posts.'
      }, { status: 403 });
    }

    // 2. Check if user is blocked by the creator of this recording
    const recording = await db.collection('community_recordings').findOne(recordingFilter(recordingId));
    if (recording?.user_id && recording.user_id !== userId) {
      const isBlocked = await db.collection('creator_blocks').findOne({
        creator_id: recording.user_id,
        blocked_user_id: userId,
      });
      if (isBlocked) {
        return NextResponse.json({
          success: false,
          error: 'You have been blocked from commenting by the author of this post.'
        }, { status: 403 });
      }
    }

    // 3. AI Comment Moderation Pipeline (exact same as main song page)
    const moderationResult = await moderateComment(text);

    if (!moderationResult.isSafe) {
      return NextResponse.json({ 
        success: false, 
        status: 'rejected',
        error: 'Comment blocked by AI moderator.',
        reason: moderationResult.reason 
      }, { status: 403 });
    }

    // Resolve authentic user profile (exact same as main song page)
    let me = userDoc || (await db.collection('users').findOne({ id: userId }));
    let authorName = (bodyData.authorName && bodyData.authorName !== 'Community Member' && bodyData.authorName !== 'Member')
      ? bodyData.authorName
      : ((bodyData.author && bodyData.author !== 'Community Member' && bodyData.author !== 'Member')
        ? bodyData.author
        : me?.name);
    let authorAvatar = bodyData.authorAvatar || bodyData.avatar || me?.avatar;

    if (!authorName || authorName === 'Community Member' || authorName === 'Member') {
      try {
        const clerkUser = await currentUser();
        authorName =
          clerkUser?.fullName ||
          clerkUser?.username ||
          clerkUser?.emailAddresses?.[0]?.emailAddress?.split('@')[0] ||
          authorName ||
          'Member';
        authorAvatar = clerkUser?.imageUrl || authorAvatar || null;

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
            }
          },
          { upsert: true }
        );
      } catch (err) {
        console.error('[Community Comments] User sync error:', err);
      }
    }

    const doc = {
      recording_id: recordingId,
      parent_id: parentId ? String(parentId) : null,
      user_id: userId,
      anon_id: anonId || 'anon',
      author: authorName || 'Member',
      authorName: authorName || 'Member',
      avatar: authorAvatar || null,
      authorAvatar: authorAvatar || null,
      text: text.trim(),
      likes: 0,
      liked_by: [],
      created_at: new Date().toISOString()
    };

    const res = await db.collection('community_comments').insertOne(doc);
    try {
      await db.collection('community_recordings').updateOne(recordingFilter(recordingId), { $inc: { comments_count: 1 } });
    } catch (e) {
      console.error('[Community Comments] Count increment error:', e);
    }

    return NextResponse.json({
      success: true,
      status: 'approved',
      id: res.insertedId.toString(),
      comment: {
        id: res.insertedId.toString(),
        _id: res.insertedId.toString(),
        recordingId,
        parentId: doc.parent_id,
        author: doc.author,
        authorName: doc.authorName,
        avatar: doc.avatar,
        authorAvatar: doc.authorAvatar,
        text: doc.text,
        userId: doc.user_id,
        likes: 0,
        isLiked: false,
        createdAt: doc.created_at,
      }
    });
  } catch (error) {
    console.error('[Community Comments POST Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    let commentId = searchParams.get('commentId');
    if (!commentId) {
      const body = await req.json().catch(() => ({}));
      commentId = body?.commentId;
    }

    if (!commentId || !ObjectId.isValid(commentId)) {
      return NextResponse.json({ success: false, error: 'Valid commentId is required' }, { status: 400 });
    }

    const db = await getDatabase();
    if (!db) return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });

    const objId = new ObjectId(commentId);
    const comment = await db.collection('community_comments').findOne({ _id: objId });
    if (!comment) {
      return NextResponse.json({ success: false, error: 'Comment not found' }, { status: 404 });
    }

    // Fetch the recording to verify if current user is the post owner
    const recording = await db.collection('community_recordings').findOne(recordingFilter(comment.recording_id));

    // Permission check:
    // 1. Author of the comment can delete their own comment
    // 2. Creator of the recording can delete any comment on their post
    // 3. Platform admin can delete any comment
    const { role } = await getAuthRole();
    const isCommentAuthor = (comment.user_id === userId);
    const isPostOwner = (recording && recording.user_id === userId);
    const isAdmin = (role === 'admin');

    if (!isCommentAuthor && !isPostOwner && !isAdmin) {
      return NextResponse.json({ success: false, error: 'Permission denied to delete this comment' }, { status: 403 });
    }

    // Delete comment and all its nested replies
    const deleteRes = await db.collection('community_comments').deleteMany({
      $or: [
        { _id: objId },
        { parent_id: commentId }
      ]
    });

    const deletedCount = deleteRes.deletedCount || 1;

    // Decrement comments count on the recording
    try {
      await db.collection('community_recordings').updateOne(
        recordingFilter(comment.recording_id),
        { $inc: { comments_count: -deletedCount } }
      );
    } catch (e) {
      console.error('[Community Comments DELETE] Counter decrement error:', e);
    }

    return NextResponse.json({
      success: true,
      deletedCommentId: commentId,
      deletedCount,
    });
  } catch (error) {
    console.error('[Community Comments DELETE Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { commentId } = await req.json().catch(() => ({}));
    if (!commentId || !ObjectId.isValid(commentId)) {
      return NextResponse.json({ error: 'Invalid commentId' }, { status: 400 });
    }

    const db = await getDatabase();
    if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

    const objId = new ObjectId(commentId);
    const comment = await db.collection('community_comments').findOne({ _id: objId });
    if (!comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });

    const likedBy = Array.isArray(comment.liked_by) ? comment.liked_by : [];
    const hasLiked = likedBy.includes(userId);

    let nextLikedBy;
    if (hasLiked) {
      nextLikedBy = likedBy.filter((id) => id !== userId);
    } else {
      nextLikedBy = [...likedBy, userId];
    }
    const nextLikes = nextLikedBy.length;

    await db.collection('community_comments').updateOne(
      { _id: objId },
      { $set: { likes: nextLikes, liked_by: nextLikedBy } }
    );

    return NextResponse.json({
      success: true,
      likes: nextLikes,
      isLiked: !hasLiked
    });
  } catch (err) {
    console.error('[PATCH community/comments]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}