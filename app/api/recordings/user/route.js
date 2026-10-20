import { NextResponse } from 'next/server';
import { getDatabase } from '../../../../lib/mongodb';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }

    const col = db.collection('community_recordings');
    const data = await col
      .find({ user_id: userId, status: 'published' })
      .sort({ created_at: -1 })
      .toArray();

    // Populate missing posters and song details from songs collection
    const slugs = [...new Set(data.map((r) => r.song_slug || r.song_id).filter(Boolean))];
    const originals = slugs.length
      ? await db
          .collection('songs')
          .find({ slug: { $in: slugs } })
          .project({ slug: 1, title: 1, poster: 1, credits: 1, category: 1 })
          .toArray()
      : [];
    const bySlug = new Map(originals.map((o) => [o.slug, o]));

    const recordings = data.map((r) => {
      const slug = r.song_slug || r.song_id;
      const songDoc = bySlug.get(slug);

      return {
        ...r,
        _id: r._id.toString(),
        song_title: r.song_title || songDoc?.title?.canonical || 'Maithili Geet',
        song_poster: r.song_poster || songDoc?.poster?.image_url || null,
        song_singer: r.original_singer || songDoc?.credits?.singer || 'Traditional',
        category: songDoc?.category || '',
      };
    });

    return NextResponse.json({ recordings });
  } catch (error) {
    console.error('Error fetching user recordings:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
