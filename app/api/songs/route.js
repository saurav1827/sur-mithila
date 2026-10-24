import { NextResponse } from 'next/server';
import { getSongs } from '../../../lib/data-service';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const category = searchParams.get('category') || '';
    const singer = searchParams.get('singer') || '';
    const verifiedOnly = searchParams.get('verified') === 'true';
    const hasMediaOnly = searchParams.get('has_media') === 'true';
    const limit = parseInt(searchParams.get('limit') || '48', 10);

    const result = await getSongs({
      query: q,
      category,
      singer,
      verified_only: verifiedOnly,
      has_media_only: hasMediaOnly,
      limit
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API /api/songs Error]:', error);
    return NextResponse.json({ songs: [], pagination: { total: 0 } }, { status: 500 });
  }
}
