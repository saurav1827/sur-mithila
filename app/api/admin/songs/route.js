import { NextResponse } from 'next/server';
import { getAuthRole } from '../../../../lib/authz';
import { getDatabase } from '../../../../lib/mongodb';
import { generateSongSlug, toRoman } from '../../../../lib/slugs';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/songs
 * Paginated search and filtering of songs directly from MongoDB
 */
export async function GET(request) {
  try {
    const { role } = await getAuthRole();
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category') || '';
    const status = searchParams.get('status') || ''; // 'verified' | 'unverified' | ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const filter = {};

    if (status === 'verified') {
      filter['verification.status'] = 'verified';
    } else if (status === 'unverified') {
      filter['verification.status'] = { $ne: 'verified' };
    }

    if (category && category !== 'all') {
      filter['category'] = { $regex: category, $options: 'i' };
    }

    if (query && query.trim()) {
      const q = query.trim();
      const qRoman = toRoman(q);
      filter['$or'] = [
        { 'title.canonical': { $regex: q, $options: 'i' } },
        { 'title.raw_title': { $regex: q, $options: 'i' } },
        { 'title.roman': { $regex: qRoman, $options: 'i' } },
        { 'credits.singer': { $regex: q, $options: 'i' } },
        { 'credits.writer.name': { $regex: q, $options: 'i' } },
        { 'lyrics.devanagari': { $regex: q, $options: 'i' } },
        { id: { $regex: q, $options: 'i' } },
        { slug: { $regex: q, $options: 'i' } }
      ];
    }

    const songsCol = db.collection('songs');
    const total = await songsCol.countDocuments(filter);
    const skip = (page - 1) * limit;

    const songs = await songsCol
      .find(filter)
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return NextResponse.json({
      songs: songs.map(s => ({ ...s, _id: s._id.toString() })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('[Admin API] GET /api/admin/songs error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/songs
 * Add a new song to the catalog
 */
export async function POST(request) {
  try {
    const { userId, role } = await getAuthRole();
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const titleCanonical = (body.title?.canonical || body.titleCanonical || '').trim();
    if (!titleCanonical) {
      return NextResponse.json({ error: 'गीतक शीर्षक (Title) आवश्यक अछि।' }, { status: 400 });
    }

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const songsCol = db.collection('songs');
    const timestamp = Date.now();
    const songId = `maithili_geet_${timestamp}`;
    const slug = body.slug?.trim() || generateSongSlug(titleCanonical, songId);

    // Verify slug uniqueness
    const existing = await songsCol.findOne({ slug });
    const finalSlug = existing ? `${slug}-${Math.floor(Math.random() * 900 + 100)}` : slug;

    const romanTitle = body.title?.roman?.trim() || toRoman(titleCanonical);
    const singerName = body.credits?.singer?.trim() || 'पारंपरिक';
    const writerName = body.credits?.writer?.name?.trim() || 'पारंपरिक';
    const writerType = body.credits?.writer?.type || ((writerName.includes('विद्यापति') || writerName.includes('पारंपरिक')) ? 'traditional' : 'contemporary');
    const composerName = body.credits?.composer?.name?.trim() || 'पारंपरिक / Traditional';
    const composerType = body.credits?.composer?.type || 'folk';

    const ytUrl = body.youtube?.url?.trim() || '';
    let ytVideoId = body.youtube?.video_id?.trim() || '';
    if (!ytVideoId && ytUrl) {
      const match = ytUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
      if (match) ytVideoId = match[1];
    }

    const devanagariLyrics = body.lyrics?.devanagari?.trim() || '';
    const romanLyrics = body.lyrics?.roman?.trim() || (devanagariLyrics ? toRoman(devanagariLyrics) : '');

    const isVerified = Boolean(body.verification?.status === 'verified' || body.verified);

    const newSong = {
      id: songId,
      slug: finalSlug,
      title: {
        canonical: titleCanonical,
        devanagari: titleCanonical,
        roman: romanTitle,
        raw_title: body.title?.raw_title?.trim() || titleCanonical
      },
      category: body.category?.trim() || 'मैथिली लोकगीत',
      genre: body.genre?.trim() || 'Maithili Music',
      traditional_raga: body.traditional_raga?.trim() || '',
      credits: {
        singer: singerName,
        writer: {
          name: writerName,
          type: writerType
        },
        composer: {
          name: composerName,
          type: composerType
        },
        album: body.credits?.album?.trim() || '',
        year: body.credits?.year?.trim() || ''
      },
      lyrics: {
        devanagari: devanagariLyrics,
        roman: romanLyrics
      },
      completeness: {
        is_complete: Boolean(devanagariLyrics.length > 30),
        completeness_score: devanagariLyrics.length > 50 ? 1.0 : 0.5
      },
      youtube: {
        url: ytUrl,
        video_id: ytVideoId,
        title: body.youtube?.title?.trim() || (ytVideoId ? `${titleCanonical} | ${singerName}` : ''),
        channel: body.youtube?.channel?.trim() || '',
        verified: isVerified
      },
      audio: {
        jiosaavn_url: body.audio?.jiosaavn_url?.trim() || null,
        apple_music_url: body.audio?.apple_music_url?.trim() || null,
        spotify_url: body.audio?.spotify_url?.trim() || null,
        hosted_audio_url: body.audio?.hosted_audio_url?.trim() || null
      },
      poster: {
        image_url: body.poster?.image_url?.trim() || (ytVideoId ? `https://img.youtube.com/vi/${ytVideoId}/hqdefault.jpg` : ''),
        source: ytVideoId ? 'youtube' : 'custom',
        verified: isVerified
      },
      verification: {
        status: isVerified ? 'verified' : 'pending_review',
        confidence: isVerified ? 'high' : 'medium',
        last_verified_at: isVerified ? new Date().toISOString() : null,
        verified_by: isVerified ? userId : null
      },
      rights: {
        lyrics: {
          status: writerName.includes('विद्यापति') ? 'public_domain' : 'fair_use_educational'
        },
        recording: {
          status: 'third_party_embed',
          takedown_requested: false
        }
      },
      tags: Array.isArray(body.tags)
        ? body.tags.map(t => String(t).trim()).filter(Boolean)
        : (typeof body.tags === 'string' ? body.tags.split(',').map(t => t.trim()).filter(Boolean) : [body.category || 'मैथिली लोकगीत']),
      stats: {
        views_count: 0,
        favorites_count: 0,
        recordings_count: 0
      },
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const result = await songsCol.insertOne(newSong);

    return NextResponse.json({
      success: true,
      message: 'नब गीत सफलता पूर्वक जोडि देल गेल!',
      song: { ...newSong, _id: result.insertedId.toString() }
    });
  } catch (err) {
    console.error('[Admin API] POST /api/admin/songs error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
