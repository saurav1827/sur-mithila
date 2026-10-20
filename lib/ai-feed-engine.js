import { getDatabase } from './mongodb';
import { getSongs } from './data-service';
import { slim } from './feed-service';
import { CULTURAL_CATEGORIES } from './categories';

/**
 * Extract user taste profile from MongoDB and client seeds
 */
export async function getUserTasteProfile(userId, anonId, clientSeedIds = []) {
  const profile = {
    favoriteSongIds: [],
    recentSongIds: [],
    topCategories: [],
    topSingers: [],
    tasteSummary: '',
  };

  const db = await getDatabase();
  const seedIds = new Set(clientSeedIds.filter(Boolean));

  // 1. Fetch user favorites if signed in
  if (db && userId) {
    try {
      const userDoc = await db.collection('users').findOne(
        { id: userId },
        { projection: { favorites: 1 } }
      );
      if (userDoc?.favorites && Array.isArray(userDoc.favorites)) {
        for (const fav of userDoc.favorites) {
          if (fav.id) {
            profile.favoriteSongIds.push(fav.id);
            seedIds.add(fav.id);
          }
        }
      }
    } catch (e) {
      console.warn('[AIFeedEngine] Error fetching user favorites:', e.message);
    }
  }

  // 2. Fetch recent plays & interactions from MongoDB
  if (db) {
    try {
      const query = [];
      if (userId) query.push({ userId });
      if (anonId) query.push({ anonId });

      if (query.length > 0) {
        const interactions = await db.collection('interactions')
          .find({
            $or: query,
            type: { $in: ['play', 'favorite', 'complete', 'click'] },
            songId: { $exists: true, $ne: null }
          })
          .sort({ server_ts: -1, _id: -1 })
          .limit(40)
          .toArray();

        for (const act of interactions) {
          if (act.songId) {
            if (!profile.recentSongIds.includes(act.songId)) {
              profile.recentSongIds.push(act.songId);
            }
            seedIds.add(act.songId);
          }
        }
      }
    } catch (e) {
      console.warn('[AIFeedEngine] Error fetching interactions:', e.message);
    }
  }

  // 3. Resolve metadata for all seed songs to calculate category and artist weights
  const allSeedIds = Array.from(seedIds).slice(0, 30);
  if (db && allSeedIds.length > 0) {
    try {
      const seedSongs = await db.collection('songs')
        .find({ id: { $in: allSeedIds } }, { projection: { id: 1, category: 1, 'credits.singer': 1, 'credits.writer.name': 1 } })
        .toArray();

      const catCounts = {};
      const singerCounts = {};

      for (const s of seedSongs) {
        if (s.category) {
          catCounts[s.category] = (catCounts[s.category] || 0) + 1;
        }
        const singer = s.credits?.singer;
        if (singer && singer !== 'पारंपरिक') {
          singerCounts[singer] = (singerCounts[singer] || 0) + 1;
        }
      }

      profile.topCategories = Object.entries(catCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([k]) => k);

      profile.topSingers = Object.entries(singerCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([k]) => k);

      // Taste Summary
      const summaryParts = [
        ...profile.topSingers.slice(0, 2),
        ...profile.topCategories.slice(0, 2)
      ];
      profile.tasteSummary = summaryParts.length > 0 ? summaryParts.join(' • ') : '';
    } catch (e) {
      console.warn('[AIFeedEngine] Error analyzing seed songs:', e.message);
    }
  }

  return profile;
}

/**
 * Generate a dynamic, personalized Spotlight carousel (5 rich songs)
 * Never static, never repeating the same 5 songs every visit.
 */
export async function getPersonalizedSpotlight(userProfile, seedOffset = 0) {
  const db = await getDatabase();
  const spotlightCandidates = [];

  // Hourly/Session rotation seed so even with no history, it changes dynamically throughout the day
  const hourBucket = Math.floor(Date.now() / (1000 * 60 * 30)) + seedOffset; // 30-min rotation

  if (db) {
    try {
      const songsCol = db.collection('songs');

      // 1. If user has favorite categories or singers, fetch top 3 matching songs
      if (userProfile.topCategories?.length > 0 || userProfile.topSingers?.length > 0) {
        const matchOr = [];
        if (userProfile.topCategories.length > 0) {
          matchOr.push({ category: { $in: userProfile.topCategories.slice(0, 3) } });
        }
        if (userProfile.topSingers.length > 0) {
          matchOr.push({ 'credits.singer': { $in: userProfile.topSingers.slice(0, 3) } });
        }

        const personalizedPicks = await songsCol
          .find({
            $or: matchOr,
            'poster.image_url': { $exists: true, $ne: '', $ne: null }
          })
          .sort({ 'verification.status': -1, 'stats.views_count': -1 })
          .limit(15)
          .toArray();

        // Pick 2-3 with dynamic shuffle
        const shuffled = shuffleWithSeed(personalizedPicks, hourBucket);
        for (const s of shuffled.slice(0, 3)) {
          let reason = '✦ अहाँक रुचि अनुसार (AI Recommended)';
          if (userProfile.topSingers.includes(s.credits?.singer)) {
            reason = `✦ ${s.credits?.singer} क लोकप्रिय प्रस्तुति`;
          } else if (userProfile.topCategories.includes(s.category)) {
            reason = `✦ ${s.category} विशेषांक`;
          }
          spotlightCandidates.push(slim(s, { curationReason: reason, isAiPick: true }));
        }
      }

      // 2. Add verified cultural gems and trending tracks with posters
      const culturalPicks = await songsCol
        .find({
          'verification.status': 'verified',
          'poster.image_url': { $exists: true, $ne: '', $ne: null },
          id: { $nin: spotlightCandidates.map(c => c.id) }
        })
        .sort({ 'stats.views_count': -1 })
        .limit(20)
        .toArray();

      const shuffledCultural = shuffleWithSeed(culturalPicks, hourBucket + 7);
      for (const s of shuffledCultural) {
        if (spotlightCandidates.length >= 5) break;
        spotlightCandidates.push(
          slim(s, {
            curationReason: s.credits?.writer?.name?.includes('विद्यापति')
              ? '✦ महाकवि विद्यापति धरोहर'
              : '✦ अखन चर्चित एवं लोकप्रिय',
            isAiPick: true
          })
        );
      }
    } catch (e) {
      console.warn('[AIFeedEngine] Error generating spotlight:', e.message);
    }
  }

  // Fallback if DB query was thin
  if (spotlightCandidates.length < 5) {
    const { songs } = await getSongs({ limit: 30, sort_by: 'popular' });
    const pool = songs.filter(s => s.poster?.image_url && !spotlightCandidates.some(c => c.id === s.id));
    const shuffled = shuffleWithSeed(pool, hourBucket);
    for (const s of shuffled) {
      if (spotlightCandidates.length >= 5) break;
      spotlightCandidates.push(slim(s, { curationReason: '✦ लोकप्रिय मैथिली रचना' }));
    }
  }

  return spotlightCandidates;
}

/**
 * Generate full personalized rows for the explore feed
 */
export async function getPersonalizedFeedRows({
  userProfile,
  category = 'all',
  cursor = 0,
  seedOffset = 0,
  refreshSeed = 0
}) {
  const db = await getDatabase();
  const rows = [];
  const sessionSeed = Math.floor(Date.now() / (1000 * 60 * 15)) + seedOffset + refreshSeed;

  // If specific category is requested, return category grid directly
  if (category && category !== 'all') {
    const page = Math.max(1, cursor || 1);
    const { songs, pagination } = await getSongs({ category, page, limit: 24, sort_by: 'popular' });
    return {
      rows: [{ key: `grid-${page}`, kind: 'grid', songs: songs.map(s => slim(s)) }],
      nextCursor: page < pagination.total_pages ? page + 1 : null,
    };
  }

  // ROW 1: "अहाँक लेल विशेष (AI Mix for You)"
  // Derived from user's favorites & watch history
  if (db) {
    try {
      const songsCol = db.collection('songs');
      let aiSongs = [];

      if (userProfile.topCategories.length > 0 || userProfile.topSingers.length > 0) {
        const query = {
          $or: [
            ...(userProfile.topCategories.length > 0 ? [{ category: { $in: userProfile.topCategories } }] : []),
            ...(userProfile.topSingers.length > 0 ? [{ 'credits.singer': { $in: userProfile.topSingers } }] : [])
          ]
        };

        const raw = await songsCol.find(query).limit(40).toArray();
        const shuffled = shuffleWithSeed(raw, sessionSeed);

        aiSongs = shuffled.slice(0, 14).map(s => {
          let reason = 'अहाँक पसन्द पर आधारित';
          if (userProfile.topSingers.includes(s.credits?.singer)) {
            reason = `पसंदीदा गायक: ${s.credits?.singer}`;
          } else if (userProfile.topCategories.includes(s.category)) {
            reason = `${s.category} विशेषांक`;
          }
          return slim(s, { reason, isAiPick: true });
        });
      }

      // If no history yet, give an inspiring AI Discovery Mix of iconic genres
      if (aiSongs.length < 5) {
        const starterCategories = ['भगवती वंदना', 'सोहर', 'नचारी', 'विद्यापति गीत', 'विवाह गीत'];
        const starterRaw = await songsCol
          .find({ category: { $in: starterCategories }, 'poster.image_url': { $exists: true, $ne: '' } })
          .limit(30)
          .toArray();
        const shuffled = shuffleWithSeed(starterRaw, sessionSeed);
        aiSongs = shuffled.slice(0, 14).map(s => slim(s, { reason: 'एआई विशेष संकलन', isAiPick: true }));
      }

      rows.push({
        key: 'ai_mix_for_you',
        kind: 'ai_mix',
        isAi: true,
        title: {
          mai: 'अहाँक लेल विशेष (AI Curated Mix)',
          en: 'Curated For You by AI'
        },
        subtitle: userProfile.tasteSummary
          ? `अहाँक रुचि: ${userProfile.tasteSummary}`
          : 'अहाँक श्रवण रुचि अनुसार चयनित सर्वश्रेष्ठ मैथिली रचना',
        songs: aiSongs
      });
    } catch (e) {
      console.warn('[AIFeedEngine] Error building AI mix row:', e.message);
    }
  }

  // ROW 2: "हाल मे सुनल गेल (Recently Played)" (if user has watch history)
  if (db && userProfile.recentSongIds.length > 0) {
    try {
      const recentIds = userProfile.recentSongIds.slice(0, 12);
      const recSongs = await db.collection('songs')
        .find({ id: { $in: recentIds } })
        .toArray();

      // Preserve chronological order of recentSongIds
      const byId = new Map(recSongs.map(s => [s.id, s]));
      const sortedRecents = recentIds
        .map(id => byId.get(id))
        .filter(Boolean)
        .map(s => slim(s, { reason: 'हाल मे सुनल गेल' }));

      if (sortedRecents.length > 0) {
        rows.push({
          key: 'recently_played',
          kind: 'recent',
          title: {
            mai: 'हाल मे सुनल गेल (Recently Played)',
            en: 'Recently Played'
          },
          subtitle: 'फेर सं सुनू आ संगीत यात्रा जारी राखू',
          songs: sortedRecents
        });
      }
    } catch (e) {
      console.warn('[AIFeedEngine] Error building recently played row:', e.message);
    }
  }

  // ROW 3: "अहाँक पसंदीदा गीत (Your Favorites)" (if user has saved favorites)
  if (db && userProfile.favoriteSongIds.length > 0) {
    try {
      const favIds = userProfile.favoriteSongIds.slice(0, 14);
      const favSongs = await db.collection('songs')
        .find({ id: { $in: favIds } })
        .toArray();

      if (favSongs.length > 0) {
        rows.push({
          key: 'user_favorites',
          kind: 'favorites',
          title: {
            mai: 'अहाँक पसंदीदा गीत (Your Favorites)',
            en: 'Your Favorites'
          },
          subtitle: 'अहाँक संकलित प्रिय रचनावली',
          songs: favSongs.map(s => slim(s, { reason: 'पसंदीदा' }))
        });
      }
    } catch (e) {
      console.warn('[AIFeedEngine] Error building favorites row:', e.message);
    }
  }

  // ROW 4: "अखन चर्चित (Trending & Viral)"
  if (db) {
    try {
      const trendingRaw = await db.collection('songs')
        .find({ 'poster.image_url': { $exists: true, $ne: '' } })
        .sort({ 'stats.views_count': -1 })
        .limit(30)
        .toArray();

      // Dynamic rotation so it's not identical every single visit
      const shuffled = shuffleWithSeed(trendingRaw, sessionSeed + 3);
      rows.push({
        key: 'trending_dynamic',
        kind: 'trending',
        title: {
          mai: 'अखन चर्चित (Trending Now)',
          en: 'Trending Now'
        },
        subtitle: 'मिथिलाभरि सर्वाधिक सुनल जायवला लोकप्रिय गीत',
        songs: shuffled.slice(0, 14).map(s => slim(s))
      });
    } catch (e) {
      console.warn('[AIFeedEngine] Error building trending row:', e.message);
    }
  }

  // ROW 5: Dynamic Category Feature based on time of day (Bhakti in morning, Folk/Romance in evening)
  const currentHour = new Date().getHours();
  const timeCategory = (currentHour >= 4 && currentHour < 12)
    ? 'भगवती वंदना'
    : (currentHour >= 12 && currentHour < 17 ? 'सोहर' : 'नचारी');

  if (db) {
    try {
      const timeSongs = await db.collection('songs')
        .find({ category: timeCategory })
        .sort({ 'stats.views_count': -1 })
        .limit(20)
        .toArray();

      const shuffled = shuffleWithSeed(timeSongs, sessionSeed + 5);
      if (shuffled.length >= 3) {
        rows.push({
          key: `time_special_${timeCategory}`,
          kind: 'category',
          value: timeCategory,
          href: `/?category=${encodeURIComponent(timeCategory)}`,
          title: {
            mai: `समय विशेष: ${timeCategory}`,
            en: `Time Feature: ${timeCategory}`
          },
          subtitle: currentHour < 12 ? 'प्रातःकालीन भक्ति एवं वंदना' : 'संध्याकालीन पावन संगीत',
          songs: shuffled.slice(0, 14).map(s => slim(s))
        });
      }
    } catch (e) {}
  }

  return {
    rows,
    tasteProfile: {
      summary: userProfile.tasteSummary,
      topCategories: userProfile.topCategories.slice(0, 4),
      topSingers: userProfile.topSingers.slice(0, 4),
    }
  };
}

/**
 * Deterministic pseudo-random shuffle based on seed
 */
function shuffleWithSeed(array, seed) {
  const arr = [...array];
  let m = arr.length;
  let t, i;
  let s = seed;

  while (m) {
    s = (s * 9301 + 49297) % 233280;
    i = Math.floor((s / 233280) * m--);
    t = arr[m];
    arr[m] = arr[i];
    arr[i] = t;
  }
  return arr;
}
