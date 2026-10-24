import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { toRoman } from '../../../../lib/slugs.js';

export const dynamic = 'force-dynamic';

let cachedSongs = null;

function getSongsCatalog() {
  if (cachedSongs) return cachedSongs;

  const candidates = [
    path.resolve(process.cwd(), 'songs_db.json'),
    path.resolve(process.cwd(), '..', 'songs_db.json'),
    path.resolve(process.cwd(), 'web', 'songs_db.json'),
    path.resolve(__dirname, '..', 'songs_db.json'),
    path.resolve(__dirname, '..', '..', 'songs_db.json'),
    path.resolve(__dirname, '..', '..', '..', 'songs_db.json')
  ];

  const target = candidates.find(p => fs.existsSync(p));
  if (target) {
    try {
      const raw = fs.readFileSync(target, 'utf8');
      cachedSongs = JSON.parse(raw);
      return cachedSongs;
    } catch { }
  }
  return [];
}

export function matchSongCategory(s, category) {
  if (!category || category === 'all') return true;
  const k = category.trim().toLowerCase();

  const cat = (s.category || '').toLowerCase();
  const title = (s.title?.canonical || s.title?.devanagari || s.title?.raw_title || (typeof s.title === 'string' ? s.title : '')).toLowerCase();
  const roman = (s.title?.roman || '').toLowerCase();
  const desc = (s.description || '').toLowerCase();
  const tags = (Array.isArray(s.tags) ? s.tags.join(' ') : '').toLowerCase();
  const writer = (s.credits?.writer?.name || s.credits?.writer || '').toLowerCase();
  const lyrics = (s.lyrics?.devanagari || s.lyrics?.raw_text || '').toLowerCase();
  const ytTitle = (s.youtube?.title || '').toLowerCase();
  const full = cat + ' ' + title + ' ' + roman + ' ' + desc + ' ' + tags + ' ' + writer + ' ' + lyrics + ' ' + ytTitle;

  if (cat === k || cat.includes(k)) return true;

  if (k.includes('छठ') || k.includes('chhath')) {
    return (
      full.includes('छठ') ||
      full.includes('छठी') ||
      full.includes('छठि') ||
      full.includes('chhath') ||
      full.includes('बहँगिया') ||
      full.includes('बहंगिया') ||
      full.includes('सुरुज') ||
      full.includes('छठी माई') ||
      full.includes('छठी मइया')
    );
  }
  if (k.includes('सोहर') || k.includes('sohar') || k.includes('जन्मोत्सव')) {
    return full.includes('सोहर') || full.includes('sohar') || full.includes('जन्मोत्सव') || full.includes('ललना') || (cat.includes('सोहर'));
  }
  if (k.includes('विवाह') || k.includes('vivah') || k.includes('लगन')) {
    return full.includes('विवाह') || full.includes('vivah') || full.includes('लगन') || full.includes('मटकोर') || full.includes('कन्यादान') || full.includes('सिन्दूर') || full.includes('परिछन');
  }
  if (k.includes('कोहबर') || k.includes('kohbar')) {
    return full.includes('कोहबर') || full.includes('kohbar');
  }
  if (k.includes('समदाउन') || k.includes('samdaun') || k.includes('विदाई')) {
    return full.includes('समदाउन') || full.includes('samdaun') || full.includes('विदाई') || full.includes('दहेज');
  }
  if (k.includes('बटगवनी') || k.includes('batgavani') || k.includes('उपनयन')) {
    return full.includes('बटगवनी') || full.includes('batgavani') || full.includes('उपनयन') || full.includes('जनेऊ') || full.includes('पाहुन');
  }
  if (k.includes('भगवती') || k.includes('bhagwati') || k.includes('गोसाउनि') || k.includes('दुर्गा')) {
    return full.includes('भगवती') || full.includes('bhagwati') || full.includes('गोसाउनि') || full.includes('दुर्गा') || full.includes('भैरवि') || full.includes('जगदम्ब') || full.includes('कालिका') || full.includes('भवानी');
  }
  if (k.includes('नचारी') || k.includes('nachari') || k.includes('महेशवाणी') || k.includes('शिव')) {
    return full.includes('नचारी') || full.includes('nachari') || full.includes('महेशवाणी') || full.includes('भोले') || full.includes('शिव') || full.includes('महादेव') || full.includes('डम डम');
  }
  if (k.includes('राम') || k.includes('ram') || k.includes('सिया') || k.includes('जानकी')) {
    return full.includes('राम') || full.includes('ram') || full.includes('raghav') || full.includes('जानकी') || full.includes('सिया') || full.includes('रघुवर') || full.includes('अवध');
  }
  if (k.includes('कृष्ण') || k.includes('krishna') || k.includes('राधा')) {
    return full.includes('कृष्ण') || full.includes('krishna') || full.includes('कान्हा') || full.includes('राधा') || full.includes('मुरली') || full.includes('गोकुल');
  }
  if (k.includes('झिझिया') || k.includes('jhijhiya')) {
    return full.includes('झिझिया') || full.includes('jhijhiya');
  }
  if (k.includes('सामा') || k.includes('sama') || k.includes('चकेवा')) {
    return full.includes('सामा') || full.includes('sama') || full.includes('चकेवा');
  }
  if (k.includes('चैती') || k.includes('chaiti') || k.includes('फगुआ') || k.includes('होली')) {
    return full.includes('चैती') || full.includes('chaiti') || full.includes('फगुआ') || full.includes('होली') || full.includes('फागुन') || full.includes('रंग');
  }
  if (k.includes('विद्यापति') || k.includes('vidyapati')) {
    return full.includes('विद्यापति') || full.includes('vidyapati') || writer.includes('विद्यापति');
  }

  return full.includes(k);
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || 'all';
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const sort = searchParams.get('sort') || 'popular';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '12', 10));

    const catalog = getSongsCatalog();

    // 1. Filter by category
    let filtered = catalog.filter(s => matchSongCategory(s, category));

    // 2. Filter by search query if provided
    if (q) {
      const qRoman = toRoman(q).toLowerCase();
      filtered = filtered.filter(s => {
        const titleCan = (s.title?.canonical || s.title?.devanagari || (typeof s.title === 'string' ? s.title : '')).toLowerCase();
        const titleRom = (s.title?.roman || '').toLowerCase();
        const singer = (s.credits?.singer || '').toLowerCase();
        const writer = (s.credits?.writer?.name || s.credits?.writer || '').toLowerCase();
        const lyrics = (s.lyrics?.devanagari || s.lyrics?.raw_text || '').toLowerCase();
        return (
          titleCan.includes(q) ||
          titleRom.includes(qRoman) ||
          singer.includes(q) ||
          writer.includes(q) ||
          lyrics.includes(q)
        );
      });
    }

    // 3. Filter by special flags
    if (sort === 'video') {
      filtered = filtered.filter(s => Boolean(s.youtube?.video_id || s.youtube?.url));
    } else if (sort === 'audio') {
      filtered = filtered.filter(s => Boolean(s.audio?.jiosaavn_url || s.audio?.spotify_url || s.audio?.apple_music_url));
    }

    // 4. Sort with relevance boost for category keywords in title
    const catLower = category.toLowerCase();
    if (sort === 'az') {
      filtered.sort((a, b) => {
        const titleA = a.title?.canonical || a.title?.devanagari || '';
        const titleB = b.title?.canonical || b.title?.devanagari || '';
        return titleA.localeCompare(titleB, 'hi');
      });
    } else if (sort === 'newest') {
      filtered.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
    } else {
      // popular with relevance boost
      filtered.sort((a, b) => {
        const titleA = (a.title?.canonical || a.title?.devanagari || '').toLowerCase();
        const titleB = (b.title?.canonical || b.title?.devanagari || '').toLowerCase();
        const matchA = titleA.includes(catLower) ? 100 : (a.category?.toLowerCase() === catLower ? 50 : 0);
        const matchB = titleB.includes(catLower) ? 100 : (b.category?.toLowerCase() === catLower ? 50 : 0);

        if (matchA !== matchB) return matchB - matchA;

        const playsA = a.stats?.plays_count || a.stats?.views_count || 0;
        const playsB = b.stats?.plays_count || b.stats?.views_count || 0;
        return playsB - playsA;
      });
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const skip = (page - 1) * limit;
    const paginated = filtered.slice(skip, skip + limit);

    // Format songs for SongCard component
    const formattedSongs = paginated.map(s => {
      const ytId = s.youtube?.video_id || (s.youtube?.url ? (s.youtube.url.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/)([a-zA-Z0-9_-]{11})/)?.[1]) : null);
      const poster = s.poster?.image_url || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null);

      return {
        ...s,
        title: {
          canonical: s.title?.canonical || s.title?.devanagari || s.title?.raw_title || (typeof s.title === 'string' ? s.title : 'मैथिली गीत'),
          devanagari: s.title?.devanagari || s.title?.canonical || 'मैथिली गीत',
          roman: s.title?.roman || toRoman(s.title?.canonical || ''),
          raw_title: s.title?.raw_title || s.title?.canonical || ''
        },
        poster: { image_url: poster },
        credits: {
          singer: s.credits?.singer || 'पारंपरिक',
          writer: typeof s.credits?.writer === 'object' ? s.credits.writer.name : (s.credits?.writer || 'पारंपरिक'),
          composer: typeof s.credits?.composer === 'object' ? s.credits.composer.name : (s.credits?.composer || 'पारंपरिक'),
          album: s.credits?.album || ''
        }
      };
    });

    return NextResponse.json({
      category,
      total,
      page,
      limit,
      totalPages,
      songs: formattedSongs
    });
  } catch (err) {
    console.error('Error fetching category songs:', err);
    return NextResponse.json({ error: 'Failed to fetch category songs', songs: [], total: 0 }, { status: 500 });
  }
}
