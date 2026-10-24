import fs from 'fs';
import path from 'path';
import { ObjectId } from 'mongodb';
import { getDatabase } from './mongodb.js';
import { getSongBySlug } from './data-service.js';

// Fallback curated playlists if database is initializing
const CURATED_PLAYLISTS = [
  {
    id: 'pl_vivah_sanskar',
    slug: 'mithila-vivah-sanskar',
    title: 'मिथिला विवाह संस्कार संपूर्ण संकलन',
    title_roman: 'Mithila Vivah Sanskar Special',
    description: 'लगन, मटकोर, बटगवनी, कन्यादान, सिन्दूरदान, कोहबर आ समदाउनक पारंपरिक गीत संग्रह।',
    badge: 'संस्कार विशेष',
    cover_image: null,
    is_curated: true,
    is_public: true,
    track_ids: [
      'maithili_geet_00003',
      'maithili_geet_00010',
      'maithili_geet_00015',
      'maithili_geet_00022',
      'maithili_geet_00035',
      'maithili_geet_00048'
    ],
    tags: ['विवाह', 'संस्कार', 'कोहबर', 'समदाउन'],
    stats: { plays_count: 24500, followers_count: 1420 }
  },
  {
    id: 'pl_bhagwati_vandana',
    slug: 'bhagwati-gosaini-vandana',
    title: 'भगवती वंदना एवं गोसाउनि गीत',
    title_roman: 'Bhagwati Vandana & Gosaini Geet',
    description: 'जय जय भैरवि असुर भयाउनि सं लऽ कऽ जगदम्ब अहाँ अवलम्ब हमर धरि—देवी भगवतीक अमर स्तुति।',
    badge: 'भक्ति विशेष',
    cover_image: null,
    is_curated: true,
    is_public: true,
    track_ids: [
      'maithili_geet_00001',
      'maithili_geet_00004',
      'maithili_geet_00008',
      'maithili_geet_00018',
      'maithili_geet_00029'
    ],
    tags: ['भगवती', 'दुर्गा', 'वंदना', 'भक्ति'],
    stats: { plays_count: 48900, followers_count: 3200 }
  },
  {
    id: 'pl_vidyapati_padavali',
    slug: 'vidyapati-amar-padavali',
    title: 'महाकवि विद्यापति अमर पदावली',
    title_roman: 'Mahakavi Vidyapati Amar Padavali',
    description: 'मैथिल कोकिल विद्यापतिक अमर प्रेम, भक्ति, विरह आ नचारी पदावलीक शास्त्रीय संकलन।',
    badge: 'साहित्यिक धरोहर',
    cover_image: null,
    is_curated: true,
    is_public: true,
    track_ids: [
      'maithili_geet_00002',
      'maithili_geet_00007',
      'maithili_geet_00012',
      'maithili_geet_00025',
      'maithili_geet_00040'
    ],
    tags: ['विद्यापति', 'पदावली', 'श्रृंगार', 'नचारी'],
    stats: { plays_count: 31200, followers_count: 2150 }
  },
  {
    id: 'pl_chhath_mahaparv',
    slug: 'chhath-mahaparv-arghya',
    title: 'छठि महापर्व पावन संकलन',
    title_roman: 'Chhath Mahaparv Special',
    description: 'काँच ही बाँस के बहँगिया, उगु हे सुरुज देव—छठि माईक अलौकिक आ आस्था सं भरल अमर गीत।',
    badge: 'महापर्व विशेष',
    cover_image: null,
    is_curated: true,
    is_public: true,
    track_ids: [
      'maithili_geet_00005',
      'maithili_geet_00011',
      'maithili_geet_00020',
      'maithili_geet_00033'
    ],
    tags: ['छठि', 'सूर्य', 'महापर्व', 'अर्घ्य'],
    stats: { plays_count: 67800, followers_count: 5400 }
  },
  {
    id: 'pl_shiv_nachari',
    slug: 'shiv-nachari-maheshvani',
    title: 'शिव नचारी एवं महेशवाणी',
    title_roman: 'Shiv Nachari & Maheshvani',
    description: 'भोले बाबाक अलमस्त रूप, भाँगक तरंग आ माता पार्वती संग नोकझोंकक पारंपरिक नचारी।',
    badge: 'शिव आराधना',
    cover_image: null,
    is_curated: true,
    is_public: true,
    track_ids: [
      'maithili_geet_00006',
      'maithili_geet_00014',
      'maithili_geet_00027',
      'maithili_geet_00038'
    ],
    tags: ['शिव', 'नचारी', 'महेशवाणी', 'भोले'],
    stats: { plays_count: 19800, followers_count: 1290 }
  }
];

// Helper to hydrate full song objects for an array of track IDs
export function hydrateTracks(trackIds = []) {
  if (!Array.isArray(trackIds) || trackIds.length === 0) return [];

  // Load songs database
  let allSongs = [];
  try {
    const candidates = [
      path.resolve(process.cwd(), 'songs_db.json'),
      path.resolve(process.cwd(), '..', 'songs_db.json'),
      path.resolve(process.cwd(), 'web', 'songs_db.json'),
      path.resolve(__dirname, '..', 'songs_db.json'),
      path.resolve(__dirname, '..', '..', 'songs_db.json')
    ];
    const target = candidates.find(p => fs.existsSync(p));
    if (target) {
      allSongs = JSON.parse(fs.readFileSync(target, 'utf8'));
    }
  } catch { }

  const songMap = new Map();
  for (const s of allSongs) {
    if (s.id) songMap.set(s.id, s);
    if (s.slug) songMap.set(s.slug, s);
  }

  const hydrated = [];
  for (const id of trackIds) {
    const s = songMap.get(id);
    if (s) {
      const ytId = s.youtube?.video_id || (s.youtube?.url ? (s.youtube.url.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/)([a-zA-Z0-9_-]{11})/)?.[1]) : null);
      const poster = s.poster?.image_url || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : '/placeholder.jpg');

      hydrated.push({
        id: s.id,
        slug: s.slug || id,
        title: s.title || { canonical: 'मैथिली गीत' },
        category: s.category || 'मैथिली लोकगीत',
        credits: s.credits || {},
        poster: { image_url: poster },
        youtube: s.youtube || {},
        audio: s.audio || {},
        completeness: s.completeness || { has_lyrics: !!(s.lyrics?.devanagari) },
        stats: s.stats || { plays_count: 1200 }
      });
    }
  }
  return hydrated;
}

/**
 * Helper to dynamically resolve authentic cover thumbnails from track IDs
 */
export function resolvePlaylistCovers(trackIds = []) {
  if (!Array.isArray(trackIds) || trackIds.length === 0) {
    return { cover_image: null, mosaicCovers: [] };
  }

  let allSongs = [];
  try {
    const candidates = [
      path.resolve(process.cwd(), 'songs_db.json'),
      path.resolve(process.cwd(), '..', 'songs_db.json'),
      path.resolve(process.cwd(), 'web', 'songs_db.json'),
      path.resolve(__dirname, '..', 'songs_db.json'),
      path.resolve(__dirname, '..', '..', 'songs_db.json')
    ];
    const target = candidates.find(p => fs.existsSync(p));
    if (target) {
      allSongs = JSON.parse(fs.readFileSync(target, 'utf8'));
    }
  } catch { }

  const songMap = new Map();
  for (const s of allSongs) {
    if (s.id) songMap.set(s.id, s);
    if (s.slug) songMap.set(s.slug, s);
  }

  const covers = [];
  for (const id of trackIds) {
    const s = songMap.get(id);
    if (s) {
      const ytId = s.youtube?.video_id || (s.youtube?.url ? (s.youtube.url.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/)([a-zA-Z0-9_-]{11})/)?.[1]) : null);
      const poster = s.poster?.image_url || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null);
      if (poster) covers.push(poster);
    }
  }

  return {
    cover_image: covers[0] || null,
    mosaicCovers: covers.slice(0, 4)
  };
}

/**
 * Get all public curated playlists and user playlists
 */
export async function getPlaylists(userId = null) {
  let userPlaylists = [];
  let dbCurated = [];

  const db = await getDatabase();
  if (db) {
    try {
      const col = db.collection('playlists');
      if (userId) {
        userPlaylists = await col.find({ 'creator.user_id': userId }).sort({ updated_at: -1 }).toArray();
      }
      dbCurated = await col.find({ is_curated: true }).sort({ 'stats.plays_count': -1 }).toArray();
    } catch (e) {
      console.warn('[PlaylistService] MongoDB fetch error:', e.message);
    }
  }

  const curated = dbCurated.length > 0 ? dbCurated : CURATED_PLAYLISTS;

  const formatPlaylist = (p) => {
    const covers = resolvePlaylistCovers(p.track_ids || []);
    const validCover = (p.cover_image && !p.cover_image.includes('unsplash')) ? p.cover_image : covers.cover_image;
    return {
      ...p,
      _id: p._id ? p._id.toString() : p.id,
      cover_image: validCover,
      mosaicCovers: covers.mosaicCovers,
      songs_count: p.track_ids?.length || 0
    };
  };

  return {
    curated: curated.map(formatPlaylist),
    user: userPlaylists.map(formatPlaylist)
  };
}

/**
 * Get a single playlist by ID or slug with hydrated songs
 */
export async function getPlaylistById(idOrSlug) {
  if (!idOrSlug) return null;

  const fallback = CURATED_PLAYLISTS.find(p => p.id === idOrSlug || p.slug === idOrSlug);

  let playlist = null;
  const db = await getDatabase();
  if (db) {
    try {
      const col = db.collection('playlists');
      if (ObjectId.isValid(idOrSlug)) {
        playlist = await col.findOne({ _id: new ObjectId(idOrSlug) });
      }
      if (!playlist) {
        playlist = await col.findOne({ $or: [{ id: idOrSlug }, { slug: idOrSlug }] });
      }
    } catch (e) {
      console.warn('[PlaylistService] getPlaylistById failed:', e.message);
    }
  }

  const resolved = playlist || fallback;
  if (!resolved) return null;

  const songs = hydrateTracks(resolved.track_ids || []);

  // Calculate dynamic mosaic cover and actual real cover from tracks
  const songCovers = songs.map(s => s.poster?.image_url).filter(Boolean);
  const mosaicCovers = songCovers.slice(0, 4);
  const realCover = (resolved.cover_image && !resolved.cover_image.includes('unsplash'))
    ? resolved.cover_image
    : (songCovers[0] || null);

  return {
    ...resolved,
    _id: resolved._id ? resolved._id.toString() : resolved.id,
    cover_image: realCover,
    songs,
    mosaicCovers,
    songs_count: songs.length,
    stats: {
      plays_count: resolved.stats?.plays_count || 1200,
      followers_count: resolved.stats?.followers_count || 85,
      total_duration_sec: songs.length * 240
    }
  };
}

/**
 * Create a new user playlist
 */
export async function createPlaylist({ title, description = '', userId, userName = 'श्रोता', trackIds = [] }) {
  if (!title) throw new Error('Playlist title is required');

  const now = new Date().toISOString();
  const id = `pl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const slug = title
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F-]/g, '')
    .trim()
    .replace(/\s+/g, '-') + `-${id.slice(-4)}`;

  const newDoc = {
    id,
    slug,
    title,
    description,
    creator: {
      user_id: userId || 'guest',
      user_name: userName,
    },
    is_curated: false,
    is_public: true,
    cover_image: null,
    track_ids: Array.from(new Set(trackIds)),
    tags: [],
    stats: { plays_count: 0, followers_count: 0, total_duration_sec: 0 },
    created_at: now,
    updated_at: now
  };

  const db = await getDatabase();
  if (db) {
    try {
      const res = await db.collection('playlists').insertOne(newDoc);
      newDoc._id = res.insertedId.toString();
    } catch (e) {
      console.warn('[PlaylistService] Failed to insert playlist to MongoDB:', e.message);
    }
  }

  return newDoc;
}

/**
 * Add or remove song from playlist
 */
export async function toggleSongInPlaylist(playlistId, songId, action = 'add', userId = null) {
  if (!playlistId || !songId) throw new Error('Missing playlistId or songId');

  const db = await getDatabase();
  if (!db) return null;

  try {
    const col = db.collection('playlists');
    let playlist = null;
    if (ObjectId.isValid(playlistId)) {
      playlist = await col.findOne({ _id: new ObjectId(playlistId) });
    }
    if (!playlist) {
      playlist = await col.findOne({ $or: [{ id: playlistId }, { slug: playlistId }] });
    }
    if (!playlist) return null;

    const query = { _id: playlist._id };
    const update = action === 'add'
      ? { $addToSet: { track_ids: songId }, $set: { updated_at: new Date().toISOString() } }
      : { $pull: { track_ids: songId }, $set: { updated_at: new Date().toISOString() } };

    const result = await col.findOneAndUpdate(
      query,
      update,
      { returnDocument: 'after' }
    );

    return result ? { ...result, _id: result._id.toString() } : null;
  } catch (e) {
    console.error('[PlaylistService] toggleSongInPlaylist failed:', e.message);
    throw e;
  }
}

/**
 * Delete a user playlist
 */
export async function deletePlaylist(playlistId, userId) {
  const db = await getDatabase();
  if (!db) return false;

  try {
    const col = db.collection('playlists');
    const filter = ObjectId.isValid(playlistId) ? { _id: new ObjectId(playlistId) } : { id: playlistId };
    if (userId && userId !== 'admin') {
      filter['creator.user_id'] = userId;
    }
    const res = await col.deleteOne(filter);
    return res.deletedCount > 0;
  } catch (e) {
    console.error('[PlaylistService] deletePlaylist failed:', e.message);
    return false;
  }
}
