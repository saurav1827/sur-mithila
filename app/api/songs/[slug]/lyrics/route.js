import { NextResponse } from 'next/server';
import { getSongBySlug } from '../../../../../lib/data-service';

export async function GET(request, { params }) {
  const { slug } = await params;

  if (!slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }

  try {
    const song = await getSongBySlug(slug);

    if (!song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 });
    }

    return NextResponse.json(
      { lyrics: song.lyrics || {} },
      { 
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
        }
      }
    );
  } catch (error) {
    console.error('[Lyrics API] Error fetching lyrics:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
