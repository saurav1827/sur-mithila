import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getDatabase } from '../../../../lib/mongodb';
import { isPrivacyFeatureAllowed } from '../../../../lib/privacy';

export async function POST(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const { songId, songSlug, audioUrl, title, caption, duration, isMixed, isPrivate, is_private } = body;

    if (!songSlug || !audioUrl) {
      return NextResponse.json({ error: 'Missing required recording fields' }, { status: 400 });
    }

    // 1. Resolve authentic user profile from MongoDB or Clerk
    let me = await db.collection('users').findOne({ id: userId });
    if (me?.is_banned || me?.status === 'banned') {
      return NextResponse.json({ error: 'Your account is suspended from uploading recordings.' }, { status: 403 });
    }
    let userName = me?.name;
    let userAvatar = me?.avatar;

    if (!me || !userName) {
      const clerkUser = await currentUser();
      userName =
        clerkUser?.fullName ||
        clerkUser?.username ||
        clerkUser?.emailAddresses?.[0]?.emailAddress?.split('@')[0] ||
        'Artist';
      userAvatar = clerkUser?.imageUrl || null;

      // Seed user into MongoDB if not present
      await db.collection('users').updateOne(
        { id: userId },
        {
          $setOnInsert: {
            id: userId,
            name: userName,
            avatar: userAvatar,
            email: clerkUser?.emailAddresses?.[0]?.emailAddress || '',
            role: clerkUser?.publicMetadata?.role || 'user',
            bio: '',
            location: '',
            joined_at: new Date().toISOString(),
          },
        },
        { upsert: true }
      );
    }

    // 2. Resolve authentic song details from songs collection
    const originalSong = await db.collection('songs').findOne({
      $or: [{ slug: songSlug }, { id: songId }],
    });

    const canonicalTitle =
      originalSong?.title?.canonical ||
      originalSong?.title?.devanagari ||
      originalSong?.title?.raw_title ||
      title ||
      'Maithili Geet';

    const songPoster = originalSong?.poster?.image_url || null;
    const originalSinger = originalSong?.credits?.singer || 'Traditional';

    const recordingCol = db.collection('community_recordings');

    const userEmail = me?.email || '';
    const userRole = me?.role || 'user';
    const canManagePrivacy = isPrivacyFeatureAllowed(userEmail, userRole);
    const requestedPrivate = Boolean(isPrivate ?? is_private);
    const recordingIsPrivate = Boolean(me?.is_private || (canManagePrivacy && requestedPrivate));

    const newRecording = {
      recording_id: 'rec_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      song_id: originalSong?.id || songId || null,
      song_slug: songSlug,
      song_title: canonicalTitle,
      song_poster: songPoster,
      original_singer: originalSinger,
      user_id: userId,
      user_name: userName,
      user_avatar: userAvatar,
      audio_url: audioUrl,
      caption: (caption || '').trim(),
      duration: Number(duration) || 0,
      is_mixed: Boolean(isMixed),
      likes: 0,
      comments: [],
      is_private: recordingIsPrivate,
      created_at: new Date().toISOString(),
      status: 'published',
    };

    await recordingCol.insertOne(newRecording);

    return NextResponse.json({ success: true, recording: newRecording });
  } catch (error) {
    console.error('Error saving recording:', error);
    return NextResponse.json({ error: 'Failed to save recording' }, { status: 500 });
  }
}
