const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://ssssssaa143:UYnydmYfSnbo4146@cluster0.q8k2p.mongodb.net/Sur_Mithila?retryWrites=true&w=majority';

function extractYoutubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

async function fixPosters() {
  const rootDbPath = path.resolve(__dirname, '..', '..', 'songs_db.json');
  const webDbPath = path.resolve(__dirname, '..', 'songs_db.json');

  const songs = JSON.parse(fs.readFileSync(webDbPath, 'utf8'));
  console.log(`Loaded ${songs.length} songs from ${webDbPath}`);

  let updatedYtPoster = 0;
  let clearedBadPoster = 0;
  let keptPoster = 0;

  for (const song of songs) {
    if (!song.youtube) song.youtube = {};
    if (!song.poster) song.poster = {};

    let ytId = song.youtube.video_id || extractYoutubeId(song.youtube.url);

    if (ytId && ytId.length === 11) {
      song.youtube.video_id = ytId;
      const ytThumb = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
      song.youtube.thumbnail_url = ytThumb;
      song.poster = {
        image_url: ytThumb,
        source: 'youtube',
        verified: true
      };
      updatedYtPoster++;
    } else {
      // If no valid YouTube ID, check existing poster
      const currentUrl = song.poster.image_url || '';
      // If poster is from JioSaavn or Apple Music that might be unrelated
      if (currentUrl.includes('saavncdn.com') || currentUrl.includes('mzstatic.com')) {
        // Clear bad poster so fallback icon is used instead of wrong Bollywood/Punjabi art
        song.poster = {
          image_url: null,
          source: null,
          verified: false
        };
        clearedBadPoster++;
      } else {
        keptPoster++;
      }
    }
  }

  console.log(`\n=== POSTER MIGRATION STATS ===`);
  console.log(`Songs updated to authentic YouTube poster: ${updatedYtPoster}`);
  console.log(`Unrelated JioSaavn/Apple posters purged: ${clearedBadPoster}`);
  console.log(`Other posters preserved: ${keptPoster}`);

  // Save to web/songs_db.json
  fs.writeFileSync(webDbPath, JSON.stringify(songs, null, 2), 'utf8');
  console.log(`Saved updated database to ${webDbPath}`);

  // Save to root songs_db.json
  if (fs.existsSync(rootDbPath)) {
    fs.writeFileSync(rootDbPath, JSON.stringify(songs, null, 2), 'utf8');
    console.log(`Saved updated database to ${rootDbPath}`);
  }

  // Sync to MongoDB Atlas
  console.log('\nConnecting to MongoDB Atlas to sync posters...');
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('Sur_Mithila');

    const songOps = [];
    const recOps = [];

    // Deduplicate by song ID
    const processedIds = new Set();

    for (const song of songs) {
      if (!song.id || processedIds.has(song.id)) continue;
      processedIds.add(song.id);

      songOps.push({
        updateOne: {
          filter: { id: song.id },
          update: {
            $set: {
              poster: song.poster,
              'youtube.video_id': song.youtube.video_id || null,
              'youtube.thumbnail_url': song.youtube.thumbnail_url || null
            }
          }
        }
      });

      recOps.push({
        updateMany: {
          filter: { song_id: song.id },
          update: {
            $set: {
              poster: song.poster,
              'youtube.video_id': song.youtube.video_id || null,
              'youtube.thumbnail_url': song.youtube.thumbnail_url || null
            }
          }
        }
      });
    }

    if (songOps.length > 0) {
      console.log(`Executing bulk update on MongoDB 'songs' collection (${songOps.length} ops)...`);
      const resSongs = await db.collection('songs').bulkWrite(songOps, { ordered: false });
      console.log(`MongoDB 'songs' updated: ${resSongs.modifiedCount} documents modified.`);
    }

    if (recOps.length > 0) {
      console.log(`Executing bulk update on MongoDB 'recordings' collection (${recOps.length} ops)...`);
      const resRecs = await db.collection('recordings').bulkWrite(recOps, { ordered: false });
      console.log(`MongoDB 'recordings' updated: ${resRecs.modifiedCount} documents modified.`);
    }

    // Verify random sample from MongoDB
    const sample = await db.collection('songs').find({ 'poster.source': 'youtube' }).limit(5).toArray();
    console.log('\nSample updated songs in MongoDB:');
    sample.forEach(s => {
      console.log(`- ${s.id}: ${s.title?.canonical || s.title} -> ${s.poster?.image_url}`);
    });

  } catch (err) {
    console.error('Error during MongoDB sync:', err);
  } finally {
    await client.close();
  }
}

fixPosters();
