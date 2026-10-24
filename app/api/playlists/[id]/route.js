import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getPlaylistById, deletePlaylist } from '../../../../lib/playlist-service.js';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const playlist = await getPlaylistById(id);

    if (!playlist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    }

    return NextResponse.json(playlist);
  } catch (error) {
    console.error('Error fetching playlist:', error);
    return NextResponse.json({ error: 'Failed to fetch playlist' }, { status: 500 });
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
    const success = await deletePlaylist(id, userId);

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete playlist or unauthorized' }, { status: 403 });
    }

    return NextResponse.json({ success: true, message: 'प्लेलिस्ट हटाओल गेल' });
  } catch (error) {
    console.error('Error deleting playlist:', error);
    return NextResponse.json({ error: 'Failed to delete playlist' }, { status: 500 });
  }
}
