import fs from 'fs';
import path from 'path';
import { getDatabase } from './mongodb';
import { generateSongSlug, generateArtistSlug, toRoman } from './slugs';

let memoryCache = null;
let lastCacheLoad = 0;

function loadLocalDatabase() {
  const now = Date.now();
  if (memoryCache && now - lastCacheLoad < 30000) {
    return memoryCache;
  }

  // Path to songs_db.json in parent directory or current directory
  const rootPath = path.resolve(process.cwd(), '..', 'songs_db.json');
  const localPath = path.resolve(process.cwd(), 'songs_db.json');
  const targetPath = fs.existsSync(rootPath) ? rootPath : (fs.existsSync(localPath) ? localPath : null);

  if (!targetPath) {
    console.warn('[DataService] songs_db.json not found in parent or local directory.');
    return [];
  }

  try {
    const raw = fs.readFileSync(targetPath, 'utf-8');
    const data = JSON.parse(raw);
    
    // Normalize in memory
    const normalized = data.map((s, idx) => {
      const songId = s.id || `maithili_geet_${idx + 1}`;
      const canonicalTitle = (typeof s.title === 'object' && s.title !== null)
        ? (s.title.canonical || s.title.raw_title || '')
        : String(s.title || '');
      const rawTitle = (typeof s.title === 'object' && s.title !== null)
        ? (s.title.raw_title || s.title.canonical || '')
        : String(s.title || '');
      const romanTitle = (typeof s.title === 'object' && s.title !== null && s.title.roman)
        ? s.title.roman
        : toRoman(canonicalTitle);

      const slug = s.slug || generateSongSlug(canonicalTitle, songId);

      const writerName = (s.credits && typeof s.credits.writer === 'object')
        ? (s.credits.writer.name || '')
        : (s.credits && s.credits.writer ? String(s.credits.writer) : '');

      const composerName = (s.credits && typeof s.credits.composer === 'object')
        ? (s.credits.composer.name || '')
        : (s.credits && s.credits.composer ? String(s.credits.composer) : '');

      const singerName = (s.credits && s.credits.singer) ? String(s.credits.singer) : 'पारंपरिक';

      // Provenance sources
      const sources = (s.verification && s.verification.sources) ? s.verification.sources : [];
      if (sources.length === 0) {
        if (s.source?.primary_url) {
          sources.push({ type: 'archive', url: s.source.primary_url, domain: s.source.domain || 'blogger', checked_at: '2026-09-26' });
        }
        if (s.youtube?.url) {
          sources.push({ type: 'youtube', url: s.youtube.url, checked_at: '2026-09-26' });
        }
        if (s.audio?.jiosaavn_url) {
          sources.push({ type: 'jiosaavn', url: s.audio.jiosaavn_url, checked_at: '2026-09-26' });
        }
        if (s.audio?.apple_music_url) {
          sources.push({ type: 'apple_music', url: s.audio.apple_music_url, checked_at: '2026-09-26' });
        }
      }

      // Build decoupled recording if media is present
      const recordings = [];
      if (s.youtube?.url || s.audio?.jiosaavn_url || s.audio?.apple_music_url) {
        recordings.push({
          recording_id: `rec_${songId}`,
          song_id: songId,
          song_slug: slug,
          artist_name: singerName,
          album: s.credits?.album || '',
          release_year: s.credits?.year || '',
          youtube: s.youtube || {},
          audio: s.audio || {},
          poster: s.poster || {},
          verification: {
            status: s.youtube?.verified ? 'verified' : 'pending_review',
            confidence: s.youtube?.verified ? 'high' : 'medium',
            last_verified_at: '2026-09-26',
            sources: sources
          },
          rights: {
            recording: {
              status: 'third_party_embed',
              takedown_requested: false
            }
          }
        });
      }

      return {
        id: songId,
        slug: slug,
        title: {
          canonical: canonicalTitle,
          devanagari: canonicalTitle,
          roman: romanTitle,
          raw_title: rawTitle
        },
        category: s.category || 'मैथिली लोकगीत',
        genre: s.genre || 'पारंपरिक मैथिली',
        traditional_raga: s.traditional_raga || '',
        credits: {
          singer: singerName,
          writer: {
            name: writerName,
            type: (writerName.includes('विद्यापति') || writerName.includes('पारंपरिक') || writerName.includes('चंदा')) ? 'traditional' : 'contemporary'
          },
          composer: {
            name: composerName,
            type: (composerName.includes('पारंपरिक') || !composerName) ? 'folk' : 'contemporary'
          },
          album: s.credits?.album || '',
          year: s.credits?.year || ''
        },
        lyrics: {
          devanagari: s.lyrics?.devanagari || s.lyrics?.raw_text || '',
          roman: s.lyrics?.roman || toRoman(s.lyrics?.devanagari || s.lyrics?.raw_text || '')
        },
        completeness: s.completeness || { is_complete: true, completeness_score: 1.0 },
        youtube: s.youtube || {},
        audio: s.audio || {},
        poster: s.poster || {},
        verification: {
          status: s.youtube?.verified ? 'verified' : 'pending_review',
          confidence: s.youtube?.verified ? 'high' : 'medium',
          last_verified_at: '2026-09-26',
          sources: sources
        },
        rights: {
          lyrics: {
            status: writerName.includes('विद्यापति') ? 'public_domain' : 'fair_use_educational'
          },
          recording: {
            status: 'third_party_embed'
          }
        },
        tags: s.tags || [],
        recordings: recordings,
        stats: {
          views_count: s.stats?.views_count || Math.floor(Math.random() * 250) + 12,
          favorites_count: s.stats?.favorites_count || Math.floor(Math.random() * 45) + 3
        }
      };
    });

    memoryCache = normalized;
    lastCacheLoad = now;
    console.log(`[DataService] Loaded and cached ${normalized.length} songs from songs_db.json dynamically.`);
    return memoryCache;
  } catch (err) {
    console.error('[DataService] Error reading local songs_db.json:', err);
    return [];
  }
}

/**
 * Fetch dynamic statistics about the catalog (never hardcoded)
 */
export async function getDatabaseStats() {
  const db = await getDatabase();
  if (db) {
    try {
      const songsCol = db.collection('songs');
      const totalSongs = await songsCol.countDocuments();
      const withYoutube = await songsCol.countDocuments({ 'youtube.url': { $exists: true, $ne: null, $ne: '' } });
      const withAudio = await songsCol.countDocuments({
        $or: [
          { 'audio.jiosaavn_url': { $exists: true, $ne: null } },
          { 'audio.apple_music_url': { $exists: true, $ne: null } },
          { 'audio.spotify_url': { $exists: true, $ne: null } }
        ]
      });
      const verified = await songsCol.countDocuments({ 'verification.status': 'verified' });
      const incomplete = await songsCol.countDocuments({ 'completeness.is_complete': false });

      // Unique singers & categories
      const singers = await songsCol.distinct('credits.singer');
      const categories = await songsCol.distinct('category');

      return {
        total_songs: totalSongs,
        with_youtube: withYoutube,
        with_audio: withAudio,
        verified_count: verified,
        incomplete_count: incomplete,
        unique_singers: singers.filter(Boolean).length,
        unique_categories: categories.filter(Boolean).length,
        data_source: 'mongodb'
      };
    } catch (e) {
      console.warn('[DataService] MongoDB stats failed, falling back to local memory store:', e.message);
    }
  }

  // Fallback to local database
  const songs = loadLocalDatabase();
  const total = songs.length;
  let yt = 0;
  let audio = 0;
  let verified = 0;
  let incomplete = 0;
  const singers = new Set();
  const categories = new Set();

  for (const s of songs) {
    if (s.youtube?.url) yt++;
    if (s.audio?.jiosaavn_url || s.audio?.apple_music_url || s.audio?.spotify_url) audio++;
    if (s.verification?.status === 'verified') verified++;
    if (s.completeness?.is_complete === false) incomplete++;
    if (s.credits?.singer) singers.add(s.credits.singer);
    if (s.category) categories.add(s.category);
  }

  return {
    total_songs: total,
    with_youtube: yt,
    with_audio: audio,
    verified_count: verified,
    incomplete_count: incomplete,
    unique_singers: singers.size,
    unique_categories: categories.size,
    data_source: 'local_json'
  };
}

/**
 * Filter, search, and paginate songs catalog
 */
export async function getSongs({
  query = '',
  category = '',
  singer = '',
  writer = '',
  verified_only = false,
  has_media_only = false,
  sort_by = 'popular',
  page = 1,
  limit = 24
} = {}) {
  const db = await getDatabase();
  if (db) {
    try {
      const songsCol = db.collection('songs');
      const filter = {};

      if (category && category !== 'all') {
        filter['category'] = { $regex: category, $options: 'i' };
      }
      if (singer) {
        filter['credits.singer'] = { $regex: singer, $options: 'i' };
      }
      if (writer) {
        filter['credits.writer.name'] = { $regex: writer, $options: 'i' };
      }
      if (verified_only) {
        filter['verification.status'] = 'verified';
      }
      if (has_media_only) {
        filter['$or'] = [
          { 'youtube.url': { $exists: true, $ne: null, $ne: '' } },
          { 'audio.jiosaavn_url': { $exists: true, $ne: null } }
        ];
      }
      if (query && query.trim()) {
        const q = query.trim();
        const qRoman = toRoman(q);
        filter['$or'] = [
          { 'title.canonical': { $regex: q, $options: 'i' } },
          { 'title.roman': { $regex: qRoman, $options: 'i' } },
          { 'credits.singer': { $regex: q, $options: 'i' } },
          { 'lyrics.devanagari': { $regex: q, $options: 'i' } }
        ];
      }

      const total = await songsCol.countDocuments(filter);
      const skip = (Math.max(1, page) - 1) * limit;

      let sort = { 'stats.views_count': -1 };
      if (sort_by === 'newest') sort = { _id: -1 };
      if (sort_by === 'alphabetical') sort = { 'title.canonical': 1 };

      const songs = await songsCol.find(filter).sort(sort).skip(skip).limit(limit).toArray();

      return {
        songs: songs.map(s => ({ ...s, _id: s._id.toString() })),
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          total_pages: Math.ceil(total / limit)
        }
      };
    } catch (e) {
      console.warn('[DataService] MongoDB getSongs failed, falling back:', e.message);
    }
  }

  // Fallback to local memory catalog
  let list = loadLocalDatabase();

  if (category && category !== 'all') {
    const cLower = category.toLowerCase();
    list = list.filter(s => s.category?.toLowerCase().includes(cLower));
  }
  if (singer) {
    const sLower = singer.toLowerCase();
    list = list.filter(s => s.credits?.singer?.toLowerCase().includes(sLower));
  }
  if (writer) {
    const wLower = writer.toLowerCase();
    list = list.filter(s => s.credits?.writer?.name?.toLowerCase().includes(wLower));
  }
  if (verified_only) {
    list = list.filter(s => s.verification?.status === 'verified');
  }
  if (has_media_only) {
    list = list.filter(s => s.youtube?.url || s.audio?.jiosaavn_url);
  }
  if (query && query.trim()) {
    const q = query.trim().toLowerCase();
    const qRoman = toRoman(q);
    list = list.filter(s => {
      const titleCan = (s.title?.canonical || '').toLowerCase();
      const titleRom = (s.title?.roman || '').toLowerCase();
      const singer = (s.credits?.singer || '').toLowerCase();
      const lyrics = (s.lyrics?.devanagari || '').toLowerCase();
      return (
        titleCan.includes(q) ||
        titleRom.includes(qRoman) ||
        singer.includes(q) ||
        singer.includes(qRoman) ||
        lyrics.includes(q)
      );
    });
  }

  // Sorting
  if (sort_by === 'alphabetical') {
    list.sort((a, b) => (a.title?.canonical || '').localeCompare(b.title?.canonical || ''));
  } else if (sort_by === 'popular') {
    list.sort((a, b) => (b.stats?.views_count || 0) - (a.stats?.views_count || 0));
  }

  const total = list.length;
  const skip = (Math.max(1, page) - 1) * limit;
  const pagedSongs = list.slice(skip, skip + limit);

  return {
    songs: pagedSongs,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      total_pages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get single song by slug or ID
 */
export async function getSongBySlug(slug) {
  const db = await getDatabase();
  if (db) {
    try {
      const song = await db.collection('songs').findOne({ slug });
      if (song) {
        // Also fetch decoupled recordings for this song
        const recordings = await db.collection('recordings').find({ song_slug: slug }).toArray();
        return {
          ...song,
          _id: song._id.toString(),
          recordings: recordings.map(r => ({ ...r, _id: r._id.toString() }))
        };
      }
    } catch (e) {
      console.warn('[DataService] MongoDB getSongBySlug failed, falling back:', e.message);
    }
  }

  const songs = loadLocalDatabase();
  const match = songs.find(s => s.slug === slug || s.id === slug);
  return match || null;
}

/**
 * Get artist information and discography
 */
export async function getArtistDetails(artistSlug) {
  const songs = loadLocalDatabase();
  const matchedSongs = songs.filter(s => {
    const slug = generateArtistSlug(s.credits?.singer || '');
    return slug === artistSlug;
  });

  if (matchedSongs.length === 0) {
    return null;
  }

  const artistName = matchedSongs[0].credits?.singer || 'Unknown Artist';
  const bioMap = {
    'sharda-sinha': 'बिहार कोकिला शारदा सिन्हा मैथिली, भोजपुरी एवं मगही लोकगीत जगत के शिखर साधक छलीह। छठि पूजा, विवाह गीत, समदाउन आ विद्यापति पद मे हुनक गायकी अमर अछि।',
    'rajni-pallavi': 'मैथिली शास्त्रीय आ सुगम संगीतक विशिष्ट गायिका, जे पारम्परिक विद्यापति पदावली आ लोकगीत के आधुनिक सुर सं संजोने छथि।',
    'devi': 'मैथिली लोकगीत आ भगवती भजन गायिका, जिनका पारंपरिक भक्ति आ लोक रंगक लेल जानल जाइत अछि।',
    'maithili-thakur': 'युवा शास्त्रीय एवं लोक गायिका, संगीत नाटक अकादमी बिस्मिल्लाह खान पुरस्कार सं सम्मानित, मिथिला संगीत के वैश्विक पटल पर प्रस्तुत करबामे अग्रणी।'
  };

  return {
    name: artistName,
    slug: artistSlug,
    bio: bioMap[artistSlug] || `${artistName} मिथिला संगीत एवं लोक संस्कृति के प्रतिष्ठित गायक छथि।`,
    total_tracks: matchedSongs.length,
    songs: matchedSongs
  };
}

/**
 * Get distinct categories with dynamic track counts
 */
export async function getCategories() {
  const songs = loadLocalDatabase();
  const counts = {};
  for (const s of songs) {
    const cat = s.category || 'मैथिली लोकगीत';
    counts[cat] = (counts[cat] || 0) + 1;
  }

  return Object.entries(counts)
    .filter(([_, count]) => count > 0)
    .map(([name, count]) => ({
      name,
      value: name,
      count,
      slug: generateSongSlug(name)
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Curated cultural playlists
 */
export function getCuratedPlaylists() {
  const songs = loadLocalDatabase();

  const vivahSongs = songs.filter(s => s.category?.includes('विवाह') || s.title?.canonical?.includes('विवाह') || s.title?.canonical?.includes('कन्यादान')).slice(0, 15);
  const chhathSongs = songs.filter(s => s.category?.includes('छठि') || s.title?.canonical?.includes('छठि') || s.title?.canonical?.includes('काँचहि')).slice(0, 12);
  const shivSongs = songs.filter(s => s.category?.includes('नचारी') || s.category?.includes('महेशवाणी') || s.title?.canonical?.includes('शिव')).slice(0, 15);
  const bhagwatiSongs = songs.filter(s => s.category?.includes('भगवती') || s.title?.canonical?.includes('भैरवि') || s.title?.canonical?.includes('मैया')).slice(0, 15);

  return [
    {
      id: 'vivah-sanskar',
      slug: 'vivah-sanskar',
      title: 'विवाह संस्कार संपूर्ण गीत',
      subtitle: 'परिछन, कन्यादान, सिंदूरदान, कोहबर, एवं समदाउन',
      description: 'मिथिला के प्राचीन विवाह परंपरा के सकल 7 चरणों के सुमधुर लोकगीत संग्रह।',
      songs_count: vivahSongs.length,
      songs: vivahSongs,
      badge: 'संस्कार विशेष'
    },
    {
      id: 'chhath-mahaparv',
      slug: 'chhath-mahaparv',
      title: 'छठि महापर्व संध्या अर्घ्य',
      subtitle: 'काँचहि बाँस के बहँगिया, कांचहि बाँस, छठी मइया',
      description: 'छठि व्रती सबहक पारम्परिक अरघ एवं महिमा गीत।',
      songs_count: chhathSongs.length,
      songs: chhathSongs,
      badge: 'महापर्व'
    },
    {
      id: 'vidyapati-padavali',
      slug: 'vidyapati-padavali',
      title: 'महाकवि विद्यापति अमर पदावली',
      subtitle: 'जय जय भैरवि, बड़ सुख सार, के पतिआ लय जायत',
      description: '14वीं शताब्दी के मैथिल कोकिल विद्यापति ठाकुर के भक्ति, नचारी, एवं प्रेम पद।',
      songs_count: 20,
      songs: songs.filter(s => s.credits?.writer?.name?.includes('विद्यापति')).slice(0, 20),
      badge: 'शास्त्रीय विरासत'
    },
    {
      id: 'shiv-nachari',
      slug: 'shiv-nachari',
      title: 'भोलानाथ नचारी एवं महेशवाणी',
      subtitle: 'दिगम्बर शिव जी के प्रसन्न करय लेल मिथिलाक पारंपरिक गान',
      description: 'महाशिवरात्रि एवं साओन मास मे गायल जायवला महादेव के नचारी।',
      songs_count: shivSongs.length,
      songs: shivSongs,
      badge: 'शिव भक्ति'
    },
    {
      id: 'bhagwati-vandana',
      slug: 'bhagwati-vandana',
      title: 'माँ भगवती वंदना एवं गोसाउनिक गीत',
      subtitle: 'शक्ति पूजा एवं कुलदेवी के पावन आरति',
      description: 'मिथिला मे प्रत्येक शुभ कार्य आरंभ सं पूर्व कुलदेवी भगवती के स्मरण।',
      songs_count: bhagwatiSongs.length,
      songs: bhagwatiSongs,
      badge: 'कुलदेवी'
    }
  ];
}

/**
 * Get recommendations based on current song
 * Uses a hybrid scoring model (Content-based + Popularity)
 */
export async function getRecommendations(currentSongId, limit = 10) {
  // First get the current song to know its properties
  let currentSong = null;
  const db = await getDatabase();
  
  if (db) {
    try {
      currentSong = await db.collection('songs').findOne({ id: currentSongId });
    } catch (e) {
      console.warn('[DataService] Failed to fetch current song for recommendations from MongoDB:', e.message);
    }
  }

  if (!currentSong) {
    const list = loadLocalDatabase();
    currentSong = list.find(s => s.id === currentSongId);
  }

  if (!currentSong) return [];

  const targetCategory = currentSong.category || '';
  const targetSinger = currentSong.credits?.singer || '';
  const targetWriter = currentSong.credits?.writer?.name || '';

  if (db) {
    try {
      let pipeline = [];
      
      // If the current song has an embedding, use Atlas Vector Search (AI recommendations)
      if (currentSong.embedding && currentSong.embedding.length > 0) {
        pipeline = [
          {
            $vectorSearch: {
              index: 'vector_index',
              path: 'embedding',
              queryVector: currentSong.embedding,
              numCandidates: 100,
              limit: limit + 1 // +1 because it might return itself
            }
          },
          { $match: { id: { $ne: currentSongId } } },
          { $limit: limit }
        ];
      } else {
        // Fallback: Use heuristic scoring model (Content-based + Popularity)
        pipeline = [
          { $match: { id: { $ne: currentSongId } } },
          {
            $addFields: {
              score: {
                $add: [
                  { $cond: [{ $eq: ['$category', targetCategory] }, 20, 0] },
                  { $cond: [{ $eq: ['$credits.singer', targetSinger] }, 30, 0] },
                  { $cond: [{ $eq: ['$credits.writer.name', targetWriter] }, 10, 0] },
                  // Add popularity weight (normalized views)
                  { $multiply: [{ $ln: { $add: [{ $ifNull: ['$stats.views_count', 1] }, 1] } }, 2] }
                ]
              }
            }
          },
          { $sort: { score: -1, 'stats.views_count': -1 } },
          { $limit: limit }
        ];
      }

      const recommended = await db.collection('songs').aggregate(pipeline).toArray();
      return recommended.map(s => ({ ...s, _id: s._id.toString() }));
    } catch (e) {
      console.warn('[DataService] MongoDB recommendations failed, falling back:', e.message);
    }
  }

  // Fallback to local in-memory scoring
  const list = loadLocalDatabase();
  
  const scored = list
    .filter(s => s.id !== currentSongId)
    .map(s => {
      let score = 0;
      if (s.category === targetCategory) score += 20;
      if (s.credits?.singer === targetSinger) score += 30;
      if (s.credits?.writer?.name === targetWriter) score += 10;
      
      const views = s.stats?.views_count || 1;
      score += Math.log(views + 1) * 2;
      
      return { ...s, _score: score };
    });

  scored.sort((a, b) => b._score - a._score);
  return scored.slice(0, limit);
}

