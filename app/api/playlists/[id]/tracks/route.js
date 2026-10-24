import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { toggleSongInPlaylist } from '../../../../../lib/playlist-service.js';

export const dynamic = 'force-dynamic';

export async function POST(req, { params }) {
  try {
    let userId = null;
    try {
      const authObj = await auth();
      userId = authObj?.userId;
    } catch {}

    const { id } = await params;
    const body = await req.json();
    const { songId, action = 'add' } = body;

    if (!songId) {
      return NextResponse.json({ error: 'Song ID is required' }, { status: 400 });
    }

    const updated = await toggleSongInPlaylist(id, songId, action, userId);
    return NextResponse.json({ success: true, playlist: updated });
  } catch (error) {
    console.error('Error toggling song in playlist:', error);
    return NextResponse.json({ error: error.message || 'Failed to update playlist tracks' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    let userId = null;
    try {
      const authObj = await auth();
      userId = authObj?.userId;
    } catch {}

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const songId = searchParams.get('songId');

    if (!songId) {
      return NextResponse.json({ error: 'Song ID query parameter is required' }, { status: 400 });
    }

    const updated = await toggleSongInPlaylist(id, songId, 'remove', userId);
    return NextResponse.json({ success: true, playlist: updated });
  } catch (error) {
    console.error('Error removing song from playlist:', error);
    return NextResponse.json({ error: error.message || 'Failed to remove song' }, { status: 500 });
  }
}
