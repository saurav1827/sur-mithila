import { NextResponse } from 'next/server';
import { getCommunityPage } from '../../../../lib/community-service';

export const dynamic = 'force-dynamic';

export async function GET(req) {
    const sp = new URL(req.url).searchParams;
    const offset = Math.min(1000, Math.max(0, parseInt(sp.get('offset') || '0', 10) || 0));
    const sort = sp.get('sort') === 'top' ? 'top' : 'latest';
    try {
        return NextResponse.json(await getCommunityPage({ offset, sort }));
    } catch (e) {
        console.error('[api/community/feed]', e);
        return NextResponse.json({ error: 'feed_failed' }, { status: 500 });
    }
}