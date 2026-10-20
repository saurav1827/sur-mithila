import { getDatabase } from './mongodb';
import { slim } from './feed-service';
import fs from 'fs';
import path from 'path';

/**
 * In-memory fallback if MongoDB connection fails
 */
let memoryCache = null;
function getLocalSongs() {
    if (memoryCache && memoryCache.length > 0) return memoryCache;
    try {
        const rootPath = path.resolve(process.cwd(), '..', 'songs_db.json');
        const localPath = path.resolve(process.cwd(), 'songs_db.json');
        const targetPath = fs.existsSync(rootPath) ? rootPath : (fs.existsSync(localPath) ? localPath : null);
        if (targetPath) {
            const raw = fs.readFileSync(targetPath, 'utf-8');
            memoryCache = JSON.parse(raw);
            return memoryCache;
        }
    } catch (e) {
        console.error('[AI Recommendation] Failed to read local songs_db.json:', e);
    }
    return [];
}

/**
 * Cultural Knowledge Engine for Maithili Music
 * Internal + External Cultural Context
 */
export function getCulturalInsight(song, mood = 'all', isHiddenGem = false) {
    const title = (song.title?.canonical || song.title?.devanagari || '').trim();
    const singer = (song.credits?.singer || '').trim();
    const category = (song.category || '').trim();
    const lyrics = typeof song.lyrics === 'string' ? song.lyrics : (song.lyrics?.text || '');

    // 1. Singer-specific cultural nuances
    if (singer.includes('शारदा सिन्हा') || singer.toLowerCase().includes('sharda sinha')) {
        if (category.includes('विवाह') || category.includes('सोहर')) {
            return {
                mai: 'डॉ. शारदा सिन्हा केर कालजयी स्वर मे मिथिलाक पावन सोहर-विवाह परंपरा',
                en: 'Timeless Sharda Sinha folk celebration & wedding classic'
            };
        }
        if (category.includes('छठ') || title.includes('छठ') || title.includes('दीनानाथ')) {
            return {
                mai: 'महापर्व छठ केर परम पावन सुर, शारदा सिन्हा केर अमर आराधना',
                en: 'Sacred Chhath Puja invocation by legendary Dr. Sharda Sinha'
            };
        }
        return {
            mai: 'शारदा सिन्हा केर अमर स्वर: मिथिलाक आत्मा सं जुड़ल दुर्लभ गीत',
            en: 'Dr. Sharda Sinha\'s iconic voice: deeply rooted in Mithila\'s soul'
        };
    }

    if (singer.includes('मैथिली ठाकुर') || singer.toLowerCase().includes('maithili thakur')) {
        return {
            mai: 'मैथिली ठाकुर केर सुमधुर कंठ मे पारंपरिक लोकराग',
            en: 'Soulful traditional folk rendition by Maithili Thakur'
        };
    }

    if (singer.includes('कुंज बिहारी') || singer.toLowerCase().includes('kunj bihari')) {
        return {
            mai: 'कुंज बिहारी मिश्र केर शास्त्रीय लोक-गायन केर अप्रतिम माधुर्य',
            en: 'Classical folk brilliance by Kunj Bihari Mishra'
        };
    }

    if (singer.includes('पूनम मिश्रा') || singer.toLowerCase().includes('poonam mishra')) {
        return {
            mai: 'पूनम मिश्रा केर कर्णप्रिय मधुर स्वर मे पावन रचना',
            en: 'Melodious traditional composition by Poonam Mishra'
        };
    }

    // 2. Vidyapati Classical Gems
    const writerName = song.credits?.writer?.name || song.credits?.writer || '';
    if (String(writerName).includes('विद्यापति') || title.includes('विद्यापति') || lyrics.includes('भनहि विद्यापति')) {
        return {
            mai: 'महाकवि विद्यापति केर अमर पद: भक्ति आ शृंगार केर अनुपम संगम',
            en: 'Immortal verse of Mahakavi Vidyapati blending classical devotion & love'
        };
    }

    // 3. Category & Mood Nuances
    if (category.includes('भगवती') || category.includes('गोसाउनि') || title.includes('भगवती') || title.includes('वंदना')) {
        return {
            mai: 'अहाँक भक्ति रुचि लेल: कुलदेवी भगवतीक पावन मंगल वंदना',
            en: 'Sacred Kuldevi Bhagwati invocation for deep devotional peace'
        };
    }

    if (category.includes('नचारी') || category.includes('महेशवाणी') || title.includes('शिव') || title.includes('भोले')) {
        return {
            mai: 'महादेव शिव केर पावन नचारी: मिथिलाक विशुद्ध आध्यात्मिक भाव',
            en: 'Sacred Shiva Nachari reflecting Mithila\'s mystical bhakti heritage'
        };
    }

    if (category.includes('सोहर') || category.includes('संस्कार') || title.includes('सोहर')) {
        return {
            mai: 'मिथिलाक नवजात शिशु मंगल संस्कार सोहर परंपरा',
            en: 'Auspicious Sohar celebrating new birth in Mithila folk tradition'
        };
    }

    if (category.includes('समदाउन') || title.includes('समदाउन') || category.includes('विरह')) {
        return {
            mai: 'हृदयस्पर्शी समदाउन: मिथिलाक अत्यंत भावुक विदाई परंपरा',
            en: 'Heart-touching Samdaun reflecting Mithila\'s tender farewell poetry'
        };
    }

    if (category.includes('विवाह') || category.includes('लगन') || category.includes('बटगमनी')) {
        return {
            mai: 'मिथिलाक पारंपरिक पावन विवाह एवं बटगमनीक मिठास',
            en: 'Auspicious wedding journey and traditional Maithili ceremonial song'
        };
    }

    // 4. Hidden Gem discovery
    if (isHiddenGem || mood === 'hidden_gems') {
        return {
            mai: 'अनसुना सांस्कृतिक मोती: उच्च प्रामाणिकता आ साहित्यिक मिठास',
            en: 'Unheard cultural gem: rare lyrical authenticity from the roots'
        };
    }

    // 5. General Folk & Personalized
    return {
        mai: 'अहाँक संगीतमय रुचि सं प्रेरित मनमोहक रचना',
        en: 'Melodious Maithili composition curated for your musical taste'
    };
}

/**
 * Filter songs matching a specific mood or theme
 */
function matchesMood(song, mood) {
    if (!mood || mood === 'all') return true;

    const cat = (song.category || '').toLowerCase();
    const title = (song.title?.canonical || song.title?.devanagari || '').toLowerCase();
    const lyrics = typeof song.lyrics === 'string' ? song.lyrics.toLowerCase() : '';

    switch (mood) {
        case 'hidden_gems':
            // High authenticity / completeness, not over-saturated with views
            const views = song.stats?.views_count || 0;
            return views < 12000 && (song.verification?.status === 'verified' || song.audio?.hosted_audio_url || song.poster?.image_url);

        case 'bhakti':
            return (
                cat.includes('भगवती') || cat.includes('नचारी') || cat.includes('महेशवाणी') ||
                cat.includes('भक्ति') || cat.includes('गोसाउनि') || cat.includes('भजन') || cat.includes('आरती') ||
                title.includes('भगवती') || title.includes('शिव') || title.includes('वंदना') ||
                title.includes('गोसाउनि') || title.includes('छठ') || title.includes('राम') || title.includes('जानकी')
            );

        case 'romantic':
            return (
                cat.includes('शृंगार') || cat.includes('प्रेम') || cat.includes('कजरी') ||
                cat.includes('लोकगीत') || cat.includes('विद्यापति') ||
                title.includes('पिया') || title.includes('सजना') || title.includes('नयना') ||
                lyrics.includes('पिया') || lyrics.includes('हिया')
            );

        case 'festive':
            return (
                cat.includes('सोहर') || cat.includes('विवाह') || cat.includes('लगन') ||
                cat.includes('झिझिया') || cat.includes('जट-जटिन') || cat.includes('होली') ||
                cat.includes('बटगमनी') || title.includes('सोहर') || title.includes('विवाह') || title.includes('लगन')
            );

        case 'soulful':
            return (
                cat.includes('समदाउन') || cat.includes('विरह') || cat.includes('प्रवास') ||
                title.includes('समदाउन') || title.includes('बिदाई') || title.includes('परदेसी') ||
                lyrics.includes('कनइत') || lyrics.includes('आँखि')
            );

        default:
            return true;
    }
}

/**
 * Core AI Recommendation Algorithm
 */
export async function getAIRecommendations({
    historyIds = [],
    favoriteIds = [],
    seenIds = [],
    excludeIds = [],
    mood = 'all',
    limit = 12,
    isSpotlight = false,
} = {}) {
    let pool = [];

    const db = await getDatabase();
    if (db) {
        try {
            const query = {};
            if (isSpotlight) {
                query['poster.image_url'] = { $exists: true, $ne: null, $ne: '' };
            }
            // Fetch diverse candidate pool
            pool = await db.collection('songs')
                .find(query)
                .project({
                    id: 1, slug: 1, title: 1, category: 1, credits: 1,
                    poster: 1, youtube: 1, audio: 1, verification: 1, stats: 1,
                    lyrics: 1, recording_id: 1, cover_id: 1, is_cover: 1
                })
                .limit(250)
                .toArray();
        } catch (e) {
            console.warn('[AI Recommendation] MongoDB fetch failed, using local store:', e.message);
        }
    }

    if (!pool || pool.length === 0) {
        pool = getLocalSongs();
    }

    if (!pool || pool.length === 0) {
        return [];
    }

    // Excluded set: explicitly requested exclusions + recently seen (so clicking refresh ALWAYS gives new songs!)
    const excludedSet = new Set([
        ...excludeIds.map(String),
        ...historyIds.map(String) // exclude already listened songs when finding fresh recommendations!
    ]);

    // Track recently seen to deprioritize
    const seenSet = new Set(seenIds.map(String));
    const favsSet = new Set(favoriteIds.map(String));

    // Extract favorite artists & categories to calculate personal affinity
    const preferredSingers = new Set();
    const preferredCategories = new Set();

    pool.forEach((s) => {
        const id = String(s.id || s.slug);
        if (favsSet.has(id)) {
            if (s.credits?.singer) preferredSingers.add(s.credits.singer.trim());
            if (s.category) preferredCategories.add(s.category.trim());
        }
    });

    // Score candidates with AI scoring weights
    const scoredCandidates = [];

    for (const song of pool) {
        const id = String(song.id || song.slug);

        // Strict exclusion check
        if (excludedSet.has(id)) continue;

        // Poster requirement for spotlight
        if (isSpotlight && !song.poster?.image_url) continue;

        // Check mood relevance
        if (!matchesMood(song, mood)) continue;

        let score = 0;
        const views = song.stats?.views_count || 0;
        const singer = (song.credits?.singer || '').trim();
        const cat = (song.category || '').trim();

        // 1. Unheard / Hidden Gem Factor:
        // Penalize songs that have huge view counts if user is looking for unheard gems or variety
        const isHiddenGem = views < 8000 && (Boolean(song.poster?.image_url) || song.verification?.status === 'verified');
        if (mood === 'hidden_gems') {
            if (isHiddenGem) score += 50;
            if (views < 3000) score += 20;
            if (views > 50000) score -= 30; // penalize overplayed songs
        } else {
            // General Smart Mix: Give bonus to high-quality hidden gems so the same popular songs don't always win
            if (isHiddenGem) score += 15;
            // Mild popularity bump, but capped so it doesn't overpower freshness
            score += Math.min(Math.log10(views + 10) * 4, 16);
        }

        // 2. Personal Taste Affinity (Singers & Categories from favorites)
        if (preferredSingers.has(singer)) score += 25;
        if (preferredCategories.has(cat)) score += 18;

        // 3. Media Richness & Quality
        if (song.audio?.hosted_audio_url || song.audio?.jiosaavn_url || song.audio?.spotify_url) score += 10;
        if (song.youtube?.url || song.youtube?.video_id) score += 8;
        if (song.poster?.image_url) score += 12;
        if (song.verification?.status === 'verified') score += 14;

        // 4. Penalize already seen items in recent sessions
        if (seenSet.has(id)) {
            score -= 40;
        }

        // 5. Add controlled randomness for dynamic variety on every refresh
        score += (Math.random() * 12);

        scoredCandidates.push({
            song,
            score,
            isHiddenGem
        });
    }

    // Sort by final score descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    // Apply artist diversity constraint: at most 2 songs per singer in a batch
    const singerCount = {};
    const finalSelection = [];

    for (const item of scoredCandidates) {
        const singer = item.song.credits?.singer || 'unknown';
        const currentCount = singerCount[singer] || 0;

        if (currentCount >= 2 && scoredCandidates.length > limit) {
            continue; // Skip to ensure artist diversity
        }

        singerCount[singer] = currentCount + 1;
        const insight = getCulturalInsight(item.song, mood, item.isHiddenGem);

        const slimSong = slim(item.song, {
            ai_reason: insight,
            reason: insight.mai,
            reason_en: insight.en,
            is_gem: item.isHiddenGem
        });

        finalSelection.push(slimSong);
        if (finalSelection.length >= limit) break;
    }

    // Fallback if strict filters yielded too few songs
    if (finalSelection.length < 3) {
        const fallbackSongs = pool
            .filter((s) => !excludedSet.has(String(s.id || s.slug)))
            .slice(0, limit)
            .map((s) => {
                const insight = getCulturalInsight(s, mood, true);
                return slim(s, {
                    ai_reason: insight,
                    reason: insight.mai,
                    reason_en: insight.en,
                    is_gem: true
                });
            });
        return fallbackSongs;
    }

    return finalSelection;
}
