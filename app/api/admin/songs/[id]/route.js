import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getAuthRole } from '../../../../../lib/authz';
import { getDatabase } from '../../../../../lib/mongodb';
import { toRoman } from '../../../../../lib/slugs';

export const dynamic = 'force-dynamic';

function getSongQuery(id) {
  const query = [{ id: id }, { slug: id }];
  if (ObjectId.isValid(id)) {
    query.push({ _id: new ObjectId(id) });
  }
  return { $or: query };
}

/**
 * GET /api/admin/songs/[id]
 */
export async function GET(request, { params }) {
  try {
    const { role } = await getAuthRole();
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const db = await getDatabase();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    const song = await db.collection('songs').findOne(getSongQuery(id));
    if (!song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 });
    }

    return NextResponse.json({ song: { ...song, _id: song._id.toString() } });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PUT /api/admin/songs/[id]
 * Update any field of the song
 */
export async function PUT(request, { params }) {
  try {
    const { userId, role } = await getAuthRole();
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const db = await getDatabase();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    const songsCol = db.collection('songs');
    const existing = await songsCol.findOne(getSongQuery(id));
    if (!existing) {
      return NextResponse.json({ error: 'गीत नहि भेटल (Song not found)' }, { status: 404 });
    }

    // Build comprehensive updates
    const updates = {};

    // 1. Title
    if (body.title) {
      const canonical = (body.title.canonical || body.title.devanagari || existing.title?.canonical || '').trim();
      const roman = (body.title.roman || (canonical ? toRoman(canonical) : existing.title?.roman || '')).trim();
      const raw = (body.title.raw_title || canonical).trim();
      updates['title.canonical'] = canonical;
      updates['title.devanagari'] = canonical;
      updates['title.roman'] = roman;
      updates['title.raw_title'] = raw;
    }

    // 2. Category & Genre & Raga
    if (typeof body.category === 'string') updates['category'] = body.category.trim();
    if (typeof body.genre === 'string') updates['genre'] = body.genre.trim();
    if (typeof body.traditional_raga === 'string') updates['traditional_raga'] = body.traditional_raga.trim();

    // 3. Credits
    if (body.credits) {
      if (typeof body.credits.singer === 'string') updates['credits.singer'] = body.credits.singer.trim();
      if (body.credits.writer) {
        if (typeof body.credits.writer.name === 'string') updates['credits.writer.name'] = body.credits.writer.name.trim();
        if (typeof body.credits.writer.type === 'string') updates['credits.writer.type'] = body.credits.writer.type.trim();
      }
      if (body.credits.composer) {
        if (typeof body.credits.composer.name === 'string') updates['credits.composer.name'] = body.credits.composer.name.trim();
        if (typeof body.credits.composer.type === 'string') updates['credits.composer.type'] = body.credits.composer.type.trim();
      }
      if (typeof body.credits.album === 'string') updates['credits.album'] = body.credits.album.trim();
      if (typeof body.credits.year === 'string') updates['credits.year'] = body.credits.year.trim();
    }

    // 4. Lyrics
    if (body.lyrics) {
      if (typeof body.lyrics.devanagari === 'string') {
        const devLyrics = body.lyrics.devanagari.trim();
        updates['lyrics.devanagari'] = devLyrics;
        if (!body.lyrics.roman) {
          updates['lyrics.roman'] = toRoman(devLyrics);
        }
      }
      if (typeof body.lyrics.roman === 'string') {
        updates['lyrics.roman'] = body.lyrics.roman.trim();
      }
    }

    // 5. YouTube
    if (body.youtube) {
      if (typeof body.youtube.url === 'string') {
        const ytUrl = body.youtube.url.trim();
        updates['youtube.url'] = ytUrl;
        let vid = body.youtube.video_id?.trim() || '';
        if (!vid && ytUrl) {
          const match = ytUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
          if (match) vid = match[1];
        }
        if (vid) {
          updates['youtube.video_id'] = vid;
          updates['poster.image_url'] = `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
        }
      }
      if (typeof body.youtube.video_id === 'string' && body.youtube.video_id.trim()) {
        updates['youtube.video_id'] = body.youtube.video_id.trim();
      }
      if (typeof body.youtube.title === 'string') updates['youtube.title'] = body.youtube.title.trim();
      if (typeof body.youtube.channel === 'string') updates['youtube.channel'] = body.youtube.channel.trim();
      if (typeof body.youtube.verified === 'boolean') updates['youtube.verified'] = body.youtube.verified;
    }

    // 6. Audio links
    if (body.audio) {
      if (body.audio.jiosaavn_url !== undefined) updates['audio.jiosaavn_url'] = body.audio.jiosaavn_url?.trim() || null;
      if (body.audio.apple_music_url !== undefined) updates['audio.apple_music_url'] = body.audio.apple_music_url?.trim() || null;
      if (body.audio.spotify_url !== undefined) updates['audio.spotify_url'] = body.audio.spotify_url?.trim() || null;
      if (body.audio.hosted_audio_url !== undefined) updates['audio.hosted_audio_url'] = body.audio.hosted_audio_url?.trim() || null;
    }

    // 7. Verification Status
    if (body.verification?.status) {
      const vStatus = body.verification.status;
      updates['verification.status'] = vStatus;
      updates['verification.confidence'] = vStatus === 'verified' ? 'high' : 'medium';
      updates['verification.last_verified_at'] = new Date().toISOString();
      updates['verification.verified_by'] = userId;
      if (vStatus === 'verified') {
        updates['youtube.verified'] = true;
      }
    }

    // 8. Tags
    if (body.tags) {
      updates['tags'] = Array.isArray(body.tags)
        ? body.tags.map(t => String(t).trim()).filter(Boolean)
        : (typeof body.tags === 'string' ? body.tags.split(',').map(t => t.trim()).filter(Boolean) : []);
    }

    updates['updated_at'] = new Date().toISOString();
    updates['last_edited_by'] = userId;

    await songsCol.updateOne(
      { _id: existing._id },
      { $set: updates }
    );

    const updatedSong = await songsCol.findOne({ _id: existing._id });

    return NextResponse.json({
      success: true,
      message: 'गीतक विवरण सफलता पूर्वक अद्यतन कएल गेल!',
      song: { ...updatedSong, _id: updatedSong._id.toString() }
    });
  } catch (err) {
    console.error('[Admin API] PUT /api/admin/songs/[id] error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/songs/[id]
 */
export async function DELETE(request, { params }) {
  try {
    const { role } = await getAuthRole();
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const db = await getDatabase();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    const result = await db.collection('songs').deleteOne(getSongQuery(id));
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'गीत सफलता पूर्वक हटाओल गेल।' });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
