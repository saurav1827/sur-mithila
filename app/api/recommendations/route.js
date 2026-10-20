import { NextResponse } from 'next/server';
import { getRecommendations } from '../../../lib/data-service';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const songId = searchParams.get('songId');
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  if (!songId) {
    return NextResponse.json({ error: 'songId is required' }, { status: 400 });
  }

  try {
    const recommendations = await getRecommendations(songId, limit);
    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error('[API] Error fetching recommendations:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
