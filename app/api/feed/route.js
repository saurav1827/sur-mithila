import { NextResponse } from 'next/server';
import { getFeedRows, getForYouRow } from '../../../lib/feed-service';

export const dynamic = 'force-dynamic';
const ID = /^[\w-]{1,80}$/;

export async function GET(req) {
    const sp = new URL(req.url).searchParams;
    try {
        if (sp.get('row') === 'for_you') {
            const seeds = (sp.get('seeds') || '').split(',').filter((x) => ID.test(x)).slice(0, 3);
            if (!seeds.length) return NextResponse.json({ rows: [] });
            const row = await getForYouRow(seeds);
            return NextResponse.json({ rows: row ? [row] : [] });
        }
        const cursor = Math.max(0, parseInt(sp.get('cursor') || '0', 10) || 0);
        const category = (sp.get('category') || 'all').slice(0, 40);
        return NextResponse.json(await getFeedRows({ cursor, count: 2, category }));
    } catch (e) {
        console.error('[api/feed]', e);
        return NextResponse.json({ error: 'feed_failed' }, { status: 500 });
    }
}