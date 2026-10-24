import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getPlaylists, createPlaylist } from '../../../lib/playlist-service.js';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    let userId = null;
    try {
      const authObj = await auth();
      userId = authObj?.userId;
    } catch {}

    const playlists = await getPlaylists(userId);
    return NextResponse.json(playlists);
  } catch (error) {
    console.error('Error fetching playlists:', error);
    return NextResponse.json({ error: 'Failed to fetch playlists' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    let userId = 'guest';
    let userName = 'अतिथि श्रोता';

    try {
      const user = await currentUser();
      if (user) {
        userId = user.id;
        userName = user.fullName || user.firstName || user.username || 'श्रोता';
      }
    } catch {}

    const body = await req.json();
    const { title, description = '', trackIds = [] } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Playlist title is required' }, { status: 400 });
    }

    const playlist = await createPlaylist({
      title: title.trim(),
      description: description.trim(),
      userId,
      userName,
      trackIds
    });

    return NextResponse.json(playlist, { status: 201 });
  } catch (error) {
    console.error('Error creating playlist:', error);
    return NextResponse.json({ error: error.message || 'Failed to create playlist' }, { status: 500 });
  }
}
