import { NextResponse } from 'next/server';
import { getAIRecommendations } from '@/lib/ai-recommendation-service';

export const dynamic = 'force-dynamic';

function parseList(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(String).filter(Boolean);
    if (typeof val === 'string') {
        return val.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return [];
}

export async function GET(req) {
    try {
        const url = new URL(req.url);
        const sp = url.searchParams;

        const historyIds = parseList(sp.get('history'));
        const favoriteIds = parseList(sp.get('favorites'));
        const seenIds = parseList(sp.get('seen'));
        const excludeIds = parseList(sp.get('exclude'));
        const mood = sp.get('mood') || 'all';
        const limit = Math.min(Math.max(parseInt(sp.get('limit') || '12', 10), 1), 30);
        const isSpotlight = sp.get('spotlight') === 'true';

        const songs = await getAIRecommendations({
            historyIds,
            favoriteIds,
            seenIds,
            excludeIds,
            mood,
            limit,
            isSpotlight,
        });

        return NextResponse.json({
            success: true,
            songs,
            count: songs.length,
            mood,
            generated_at: new Date().toISOString()
        });
    } catch (err) {
        console.error('[api/ai/recommendations GET]', err);
        return NextResponse.json({ success: false, error: 'ai_recommendation_failed' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const body = await req.json().catch(() => ({}));
        const historyIds = parseList(body.history);
        const favoriteIds = parseList(body.favorites);
        const seenIds = parseList(body.seen);
        const excludeIds = parseList(body.exclude);
        const mood = body.mood || 'all';
        const limit = Math.min(Math.max(parseInt(body.limit || '12', 10), 1), 30);
        const isSpotlight = Boolean(body.spotlight);

        const songs = await getAIRecommendations({
            historyIds,
            favoriteIds,
            seenIds,
            excludeIds,
            mood,
            limit,
            isSpotlight,
        });

        return NextResponse.json({
            success: true,
            songs,
            count: songs.length,
            mood,
            generated_at: new Date().toISOString()
        });
    } catch (err) {
        console.error('[api/ai/recommendations POST]', err);
        return NextResponse.json({ success: false, error: 'ai_recommendation_failed' }, { status: 500 });
    }
}
