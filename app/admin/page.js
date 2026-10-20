import React from 'react';
import { redirect } from 'next/navigation';
import { getAuthRole } from '../../lib/authz';
import { getDatabase } from '../../lib/mongodb';
import AdminClientView from './AdminClientView';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const { userId, role } = await getAuthRole();
  if (!userId) redirect('/?signin=1&redirect=%2Fadmin');
  if (role !== 'admin') redirect('/');

  const db = await getDatabase();
  let stats = {
    total_songs: 0,
    verified_count: 0,
    unverified_count: 0,
    pending_edits_count: 0,
    singers_count: 0,
    categories_count: 0,
    with_youtube: 0,
    data_source: 'mongodb'
  };

  let unverifiedQueue = [];
  let allSampleSongs = [];
  let editRequests = [];
  let categoriesList = [];

  if (db) {
    try {
      const songsCol = db.collection('songs');
      const editsCol = db.collection('edit_requests');

      const [
        totalSongs,
        verifiedSongs,
        withYoutube,
        pendingEdits,
        distinctSingers,
        distinctCategories
      ] = await Promise.all([
        songsCol.countDocuments(),
        songsCol.countDocuments({ 'verification.status': 'verified' }),
        songsCol.countDocuments({ 'youtube.url': { $exists: true, $ne: null, $ne: '' } }),
        editsCol.countDocuments({ status: { $in: ['pending', 'pending_triage', 'in_review'] } }),
        songsCol.distinct('credits.singer'),
        songsCol.distinct('category')
      ]);

      stats = {
        total_songs: totalSongs,
        verified_count: verifiedSongs,
        unverified_count: totalSongs - verifiedSongs,
        pending_edits_count: pendingEdits,
        singers_count: distinctSingers.filter(Boolean).length,
        categories_count: distinctCategories.filter(Boolean).length,
        with_youtube: withYoutube,
        data_source: 'mongodb'
      };

      categoriesList = distinctCategories.filter(Boolean);

      // Real unverified songs for verification queue
      const rawQueue = await songsCol
        .find({ 'verification.status': { $ne: 'verified' } })
        .sort({ 'stats.views_count': -1, _id: -1 })
        .limit(25)
        .toArray();
      unverifiedQueue = rawQueue.map(s => ({ ...s, _id: s._id.toString() }));

      // First page of songs for song manager
      const rawSongs = await songsCol
        .find({})
        .sort({ _id: -1 })
        .limit(20)
        .toArray();
      allSampleSongs = rawSongs.map(s => ({ ...s, _id: s._id.toString() }));

      // Real user edit suggestions
      const rawEdits = await editsCol
        .find({ status: { $in: ['pending', 'pending_triage', 'in_review'] } })
        .sort({ createdAt: -1 })
        .limit(25)
        .toArray();

      // Enriched edit requests with target song info
      const targetSongIds = [...new Set(rawEdits.map(r => r.songId).filter(Boolean))];
      const targetSongs = await songsCol
        .find({ id: { $in: targetSongIds } }, { projection: { id: 1, title: 1, slug: 1, credits: 1, category: 1, youtube: 1 } })
        .toArray();

      const songMap = new Map();
      for (const s of targetSongs) songMap.set(s.id, s);

      editRequests = rawEdits.map(r => ({
        ...r,
        _id: r._id.toString(),
        song: songMap.get(r.songId) || { id: r.songId, title: { canonical: r.songTitle || r.songId } }
      }));
    } catch (e) {
      console.error('[AdminPage] Error loading data from MongoDB:', e);
    }
  }

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 20px 80px' }}>
      <AdminClientView
        initialStats={stats}
        initialUnverifiedQueue={unverifiedQueue}
        initialSongs={allSampleSongs}
        initialEditRequests={editRequests}
        categoriesList={categoriesList}
      />
    </div>
  );
}