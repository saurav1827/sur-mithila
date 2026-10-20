import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getUserTasteProfile,
  getPersonalizedSpotlight,
  getPersonalizedFeedRows
} from '../../../../lib/ai-feed-engine';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { userId } = await auth();
    const { searchParams } = new URL(request.url);

    const anonId = searchParams.get('anonId') || null;
    const clientSeeds = (searchParams.get('seeds') || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const category = searchParams.get('category') || 'all';
    const refreshSeed = parseInt(searchParams.get('refresh') || '0', 10);

    // 1. Compute user taste profile based on likes, play history, and seeds
    const tasteProfile = await getUserTasteProfile(userId, anonId, clientSeeds);

    // 2. Generate dynamic personalized spotlight
    const spotlight = await getPersonalizedSpotlight(tasteProfile, refreshSeed);

    // 3. Generate dynamic personalized rows
    const { rows } = await getPersonalizedFeedRows({
      userProfile: tasteProfile,
      category,
      cursor: 0,
      refreshSeed
    });

    return NextResponse.json({
      success: true,
      spotlight,
      rows,
      tasteProfile: {
        summary: tasteProfile.tasteSummary,
        topCategories: tasteProfile.topCategories.slice(0, 3),
        topSingers: tasteProfile.topSingers.slice(0, 3),
        hasHistory: Boolean(tasteProfile.recentSongIds.length > 0 || tasteProfile.favoriteSongIds.length > 0)
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (err) {
    console.error('[API] /api/feed/personalized error:', err);
    return NextResponse.json({ error: err.message || 'Feed error' }, { status: 500 });
  }
}
