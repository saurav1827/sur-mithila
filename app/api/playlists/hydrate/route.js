import { NextResponse } from 'next/server';
import { hydrateTracks } from '../../../../lib/playlist-service.js';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json();
    const { trackIds = [] } = body;
    const songs = hydrateTracks(Array.isArray(trackIds) ? trackIds : []);
    return NextResponse.json({ songs });
  } catch (error) {
    console.error('Error hydrating tracks:', error);
    return NextResponse.json({ error: 'Failed to hydrate tracks', songs: [] }, { status: 500 });
  }
}
