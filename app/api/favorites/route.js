import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDatabase } from '../../../lib/mongodb';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ favorites: [] });
    }

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ favorites: [] });
    }

    const userDoc = await db.collection('users').findOne(
      { id: userId },
      { projection: { favorites: 1 } }
    );

    return NextResponse.json({ favorites: userDoc?.favorites || [] });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    return NextResponse.json({ favorites: [] }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }

    const body = await req.json();
    const { song } = body;

    if (!song || !song.id) {
      return NextResponse.json({ error: 'Invalid song data' }, { status: 400 });
    }

    const favoriteItem = {
      id: song.id,
      slug: song.slug,
      title: song.title?.canonical || song.title?.devanagari || song.title || 'Maithili Geet',
      singer: song.credits?.singer || song.singer || 'Traditional',
      poster: song.poster?.image_url || song.poster || null,
      category: song.category || '',
      added_at: new Date().toISOString()
    };

    // Add to user's favorites array (avoiding duplicates)
    await db.collection('users').updateOne(
      { id: userId },
      {
        $pull: { favorites: { id: song.id } },
      }
    );

    await db.collection('users').updateOne(
      { id: userId },
      {
        $push: { favorites: { $each: [favoriteItem], $position: 0 } },
        $setOnInsert: { id: userId, joined_at: new Date().toISOString() }
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true, favorite: favoriteItem });
  } catch (error) {
    console.error('Error adding favorite:', error);
    return NextResponse.json({ error: 'Failed to add favorite' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const songId = searchParams.get('songId');

    if (!songId) {
      return NextResponse.json({ error: 'Missing songId' }, { status: 400 });
    }

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }

    await db.collection('users').updateOne(
      { id: userId },
      { $pull: { favorites: { id: songId } } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing favorite:', error);
    return NextResponse.json({ error: 'Failed to remove favorite' }, { status: 500 });
  }
}
