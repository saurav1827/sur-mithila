import { NextResponse } from 'next/server';
import { getDatabase } from '../../../../lib/mongodb';
import { getAuthRole } from '../../../../lib/authz';
import { canViewUserProfile } from '../../../../lib/privacy';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const rawId = (await params)?.id;
    if (!rawId) {
      return NextResponse.json({ error: 'Missing user identifier' }, { status: 400 });
    }

    const decodedId = decodeURIComponent(rawId).trim();
    const escapedDecoded = decodedId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const namePattern = `^(${escapedDecoded}|${escapedDecoded.replace(/_/g, ' ')}|${escapedDecoded.replace(/\s+/g, '_')})$`;

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    // 1. Find user in `users` collection by ID or name
    let userDoc = await db.collection('users').findOne({
      $or: [
        { id: decodedId },
        { id: rawId },
        { name: decodedId },
        { name: { $regex: new RegExp(namePattern, 'i') } },
      ],
    });

    // 2. Fallback to community_recordings if user is a legacy creator not yet in users collection
    if (!userDoc) {
      const recSample = await db.collection('community_recordings').findOne({
        $or: [
          { user_id: decodedId },
          { user_id: rawId },
          { user_name: decodedId },
          { user_name: { $regex: new RegExp(namePattern, 'i') } },
        ],
      });

      if (recSample) {
        userDoc = {
          id: recSample.user_id || rawId,
          name: recSample.user_name || decodedId,
          avatar: recSample.user_avatar || null,
          bio: (recSample.caption && recSample.caption.trim()) ? recSample.caption.trim() : '',
          location: '',
          joined_at: recSample.created_at || null,
          role: 'creator',
          is_private: false,
        };
      }
    }

    if (!userDoc) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const resolvedUserId = userDoc.id;
    const resolvedUserName = userDoc.name;

    // Check viewer identity & permissions
    const { userId: viewerUserId, role: viewerRole, email: viewerEmail } = await getAuthRole();
    const isOwner = Boolean(
      (viewerUserId && resolvedUserId && viewerUserId === resolvedUserId) ||
      (viewerUserId && userDoc.id === viewerUserId)
    );
    const isAdmin = viewerRole === 'admin';

    // Privacy Gatekeeper: If user account is private, only owner and admin can view profile
    if (userDoc.is_private) {
      const allowed = canViewUserProfile({
        targetUser: userDoc,
        viewerUserId,
        viewerRole,
        viewerEmail,
      });

      if (!allowed) {
        const handle = '@' + (userDoc.name || 'artist').toLowerCase().replace(/[^a-z0-9_]/g, '_');
        return NextResponse.json({
          success: true,
          isLocked: true,
          is_private: true,
          user: {
            id: userDoc.id,
            name: userDoc.name,
            handle,
            avatar: userDoc.avatar || null,
            bio: '',
            location: '',
            joined_at: userDoc.joined_at || null,
            role: userDoc.role || 'creator',
            is_private: true,
            stats: {
              recordingsCount: 0,
              totalLikes: 0,
              totalComments: 0,
            },
          },
          recordings: [],
          recentComments: [],
          message: 'This account is private.',
        });
      }
    }

    const escapedUserName = (resolvedUserName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const userPattern = `^(${escapedUserName}|${escapedUserName.replace(/_/g, ' ')}|${escapedUserName.replace(/\s+/g, '_')})$`;

    // 3. Fetch community covers by this creator
    // Owner and admin can see all covers (including private ones); others see only public covers
    const recordingQuery = {
      $or: [
        ...(resolvedUserId ? [{ user_id: resolvedUserId }] : []),
        { user_name: resolvedUserName },
        { user_name: { $regex: new RegExp(userPattern, 'i') } },
      ],
      status: 'published',
      ...(!isOwner && !isAdmin ? { is_private: { $ne: true } } : {}),
    };

    const rawRecordings = await db
      .collection('community_recordings')
      .find(recordingQuery)
      .sort({ created_at: -1 })
      .toArray();

    // Populate missing posters and canonical titles from songs collection
    const slugs = [...new Set(rawRecordings.map((r) => r.song_slug || r.song_id).filter(Boolean))];
    const originals = slugs.length
      ? await db
          .collection('songs')
          .find({ slug: { $in: slugs } })
          .project({ slug: 1, title: 1, poster: 1, credits: 1, category: 1 })
          .toArray()
      : [];
    const bySlug = new Map(originals.map((o) => [o.slug, o]));

    const recordings = rawRecordings.map((r) => {
      const slug = r.song_slug || r.song_id;
      const songDoc = bySlug.get(slug);

      return {
        _id: r._id.toString(),
        recording_id: r.recording_id || r._id.toString(),
        song_slug: slug,
        song_title: r.song_title || songDoc?.title?.canonical || 'मैथिली लोकगीत',
        song_poster: r.song_poster || songDoc?.poster?.image_url || null,
        original_singer: r.original_singer || songDoc?.credits?.singer || 'पारंपरिक',
        category: songDoc?.category || r.category || 'लोकगीत',
        audio_url: r.audio_url,
        caption: r.caption || '',
        likes: typeof r.likes === 'number' ? r.likes : (r.likedBy?.length || 0),
        comments_count: r.comments_count ?? r.comments?.length ?? 0,
        is_private: Boolean(r.is_private),
        created_at: r.created_at || new Date().toISOString(),
      };
    });

    // 4. Calculate stats & categories
    const recordingsCount = recordings.length;
    const totalLikes = recordings.reduce((acc, r) => acc + (r.likes || 0), 0);
    const totalComments = recordings.reduce((acc, r) => acc + (r.comments_count || 0), 0);
    const genres = [...new Set(recordings.map((r) => r.category).filter(Boolean))];

    // 5. Fetch recent comments/activity by this user
    const recentComments = resolvedUserId
      ? await db
          .collection('comments')
          .find({ userId: resolvedUserId, status: 'published' })
          .sort({ createdAt: -1 })
          .limit(10)
          .toArray()
      : [];

    const handle = '@' + (userDoc.name || 'artist').toLowerCase().replace(/[^a-z0-9_]/g, '_');

    return NextResponse.json({
      success: true,
      isLocked: false,
      is_private: Boolean(userDoc.is_private),
      user: {
        id: userDoc.id,
        name: userDoc.name,
        handle,
        avatar: userDoc.avatar || null,
        bio: userDoc.bio || '',
        location: userDoc.location || '',
        joined_at: userDoc.joined_at || null,
        role: userDoc.role || 'user',
        is_private: Boolean(userDoc.is_private),
        genres,
        stats: {
          recordingsCount,
          totalLikes,
          totalComments,
        },
      },
      recordings,
      recentComments: recentComments.map((c) => ({
        _id: c._id.toString(),
        songId: c.songId,
        text: c.text,
        likes: c.likes || 0,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    console.error('[API users/[id]] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

