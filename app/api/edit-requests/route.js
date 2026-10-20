import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getDatabase } from '../../../lib/mongodb';
import { runEditPipeline } from '../../../lib/ai-agents';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const data = await request.json();
    
    // Whitelisted fields that can be edited by community members
    const allowedPaths = [
      'title.canonical',
      'credits.singer',
      'credits.writer.name',
      'credits.composer.name',
      'category',
      'traditional_raga',
      'genre',
      'lyrics.devanagari',
      'youtube.url',
      'youtube.video_id',
      'credits.album',
      'credits.year',
      'version.type',
      'general'
    ];
    
    const changes = (data.changes || []).filter(change => allowedPaths.includes(change.path));
    
    if (changes.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields provided for editing.' }, { status: 400 });
    }

    let requesterId = data.userId || null;
    let requesterName = data.userName || '';
    let requesterEmail = data.userEmail || '';

    try {
      const { userId } = await auth();
      if (userId) {
        requesterId = userId;
        const u = await currentUser();
        if (u) {
          requesterName = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || requesterName;
          requesterEmail = u.emailAddresses?.[0]?.emailAddress || requesterEmail;
        }
      }
    } catch { /* proceed with anonymous or provided user data */ }

    if (!requesterId) requesterId = 'anon_' + Date.now();
    if (!requesterName) requesterName = 'अतिथि पाठक (Guest)';

    const editRequest = {
      songId: data.songId,
      workId: data.workId || data.songId,
      songTitle: data.songTitle || '',
      songSlug: data.songSlug || '',
      requesterId,
      requesterName,
      requesterEmail,
      status: 'pending', // Pending admin review
      changes: changes,
      reason: data.reason || '',
      evidenceUrls: data.evidenceUrls || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const db = await getDatabase();
    if (!db) {
      console.warn('[EditRequests] No MongoDB connection available.');
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
    }

    const result = await db.collection('edit_requests').insertOne(editRequest);

    // Optional background pipeline trigger (safe fail)
    try {
      runEditPipeline(result.insertedId).catch(() => {});
    } catch {}

    return NextResponse.json({ success: true, id: result.insertedId.toString() });
  } catch (error) {
    console.error('[EditRequests] API error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'pending_triage';
  
  try {
    const db = await getDatabase();
    if (!db) return NextResponse.json({ success: false, error: 'DB down' }, { status: 503 });

    const requests = await db.collection('edit_requests')
      .find({ status })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({ requests });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
