import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { ObjectId } from 'mongodb';
import { getDatabase } from '../../../../lib/mongodb';
import { recordingFilter } from '../../../../lib/community-service';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const recordingId = sp.get('recordingId');
  if (!recordingId) return NextResponse.json({ comments: [] });

  try {
    const { userId: currentUserId } = await auth();
    const db = await getDatabase();
    if (!db) return NextResponse.json({ comments: [] });

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
        parentId: c.parent_id || null,
        author,
        avatar,
        text: c.text,
        userId: c.user_id || null,
        likes: typeof c.likes === 'number' ? c.likes : likedBy.length,
        isLiked: currentUserId ? likedBy.includes(currentUserId) : false,
        createdAt: c.created_at || new Date().toISOString(),
        fresh: false,
      };
    });

    return NextResponse.json({ comments });
  } catch (e) {
    console.error('[api/community/comments GET]', e);
    return NextResponse.json({ comments: [] });
  }
}

export async function POST(req) {
  const bodyData = await req.json().catch(() => ({}));
  const { recordingId, anonId, text, parentId } = bodyData;
  if (typeof recordingId !== 'string' || !text || text.length > 500) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const { userId } = await auth();
  let authorName = bodyData.author;
  let authorAvatar = bodyData.avatar;

  const db = await getDatabase();
  if (!db) return NextResponse.json({ error: 'db_unavailable' }, { status: 503 });

  // If signed in, resolve authentic author name and DP
  if (userId) {
    const me = await db.collection('users').findOne({ id: userId });
    if (me?.name) {
      authorName = me.name;
      authorAvatar = me.avatar || authorAvatar;
    } else {
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
            $setOnInsert: {
              id: userId,
              name: authorName,
              avatar: authorAvatar,
              email: clerkUser?.emailAddresses?.[0]?.emailAddress || '',
              role: clerkUser?.publicMetadata?.role || 'user',
              joined_at: new Date().toISOString(),
            }
          },
          { upsert: true }
        );
      } catch { }
    }
  }

  const apiKey = process.env.NVIDIA_API_KEY;
  if (apiKey) {
    try {
      const aiRes = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'meta/llama-3.1-8b-instruct',
          messages: [
            {
              role: 'system',
              content: 'You are an AI community moderator for a music site. Reply strictly with JSON format: {"status": "approved"} or {"status": "rejected", "reason": "ai_blocked"}. Reject spam, abuse, hate, sexual content, harassment, or meaningless short testing messages like "hello".'
            },
            {
              role: 'user',
              content: `Comment to moderate: "${text}"`
            }
          ],
          temperature: 0.1,
          max_tokens: 30
        })
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const content = aiData.choices?.[0]?.message?.content || '{}';
        const match = content.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (parsed.status === 'rejected') {
            return NextResponse.json({ status: 'rejected', reason: parsed.reason || 'ai_blocked' });
          }
        }
      }
    } catch (e) {
      console.error('NVIDIA AI error:', e);
    }
  }

  const doc = {
    recording_id: recordingId,
    parent_id: parentId ? String(parentId) : null,
    user_id: userId || null,
    anon_id: anonId || 'anon',
    author: authorName || 'Member',
    avatar: authorAvatar || null,
    text: text.trim(),
    likes: 0,
    liked_by: [],
    created_at: new Date().toISOString()
  };

  const res = await db.collection('community_comments').insertOne(doc);
  await db.collection('community_recordings').updateOne(recordingFilter(recordingId), { $inc: { comments_count: 1 } });

  return NextResponse.json({
    status: 'approved',
    comment: {
      id: res.insertedId.toString(),
      parentId: doc.parent_id,
      author: doc.author,
      avatar: doc.avatar,
      text: doc.text,
      userId: doc.user_id,
      likes: 0,
      isLiked: false,
      createdAt: doc.created_at,
    }
  });
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