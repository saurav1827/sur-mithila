import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDatabase } from '../../../lib/mongodb';

export async function POST(request) {
  try {
    const events = await request.json();
    
    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ success: true, inserted: 0 });
    }

    const db = await getDatabase();
    if (!db) {
      console.warn('[Events API] No MongoDB connection to store events.');
      return NextResponse.json({ success: false, error: 'Database not available' }, { status: 503 });
    }

    // Prefer verified userId from session if available
    const { userId } = await auth();

    // Add server-side timestamps to prevent client-side time spoofing
    const enrichedEvents = events.map(event => ({
      ...event,
      userId: userId || event.userId || null,
      server_ts: new Date(),
      // Ensure numeric types for ML
      positionSec: event.positionSec ? Number(event.positionSec) : 0,
      watchedSec: event.watchedSec ? Number(event.watchedSec) : 0,
      durationSec: event.durationSec ? Number(event.durationSec) : 0,
    }));

    const result = await db.collection('interactions').insertMany(enrichedEvents);
    
    return NextResponse.json({ 
      success: true, 
      inserted: result.insertedCount 
    });

  } catch (error) {
    console.error('[Events API] Error saving events:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
