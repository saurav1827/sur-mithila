import { NextResponse } from 'next/server';
import { getDatabase } from '../../../lib/mongodb';

// Simple in-memory rate-limiter to prevent inflated play counts from repeated spam
const recentPlays = new Map(); // key: `${ip}_${songSlug}`, value: timestamp
const CLEANUP_INTERVAL_MS = 60000; // 1 minute window

setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentPlays.entries()) {
    if (now - timestamp > CLEANUP_INTERVAL_MS) {
      recentPlays.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

export async function POST(request) {
  try {
    let body = {};
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      // Handles navigator.sendBeacon text/plain payloads
      const text = await request.text();
      try {
        body = JSON.parse(text);
      } catch {
        body = {};
      }
    }

    const { songSlug, artistSlug } = body;
    if (!songSlug) {
      return NextResponse.json({ error: 'songSlug is required' }, { status: 400 });
    }

    // IP or forward header for rate-limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
    const rateLimitKey = `${ip}_${songSlug}`;
    const now = Date.now();
    const lastPlayed = recentPlays.get(rateLimitKey);

    if (lastPlayed && (now - lastPlayed) < 30000) {
      // Debounce: played less than 30 seconds ago from same client
      return NextResponse.json({ success: true, debounced: true });
    }
    recentPlays.set(rateLimitKey, now);

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ success: true, localOnly: true });
    }

    // Atomic increment on the song document
    const songRes = await db.collection('songs').findOneAndUpdate(
      { slug: songSlug },
      { 
        $inc: { 'stats.plays_count': 1 },
        $set: { 'stats.last_played_at': new Date() }
      },
      { returnDocument: 'after' }
    );

    // If an artistSlug is provided, increment artist cumulative site plays
    if (artistSlug) {
      await db.collection('artists').updateOne(
        { slug: artistSlug },
        { 
          $inc: { 'stats.total_plays': 1 },
          $set: { 'stats.last_played_at': new Date() }
        }
      );
    }

    const playsCount = songRes?.stats?.plays_count || 1;

    return NextResponse.json({
      success: true,
      songSlug,
      plays_count: playsCount
    });
  } catch (err) {
    console.error('Error tracking play event:', err);
    return NextResponse.json({ error: 'Internal tracking error' }, { status: 500 });
  }
}
