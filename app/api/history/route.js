import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDatabase } from '../../../lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const authData = await auth().catch(() => null);
        const userId = authData?.userId;
        if (!userId) {
            return NextResponse.json({ history: [] });
        }

        const db = await getDatabase();
        if (!db) {
            return NextResponse.json({ history: [] });
        }

        const userDoc = await db.collection('users').findOne(
            { id: userId },
            { projection: { history: 1 } }
        );

        return NextResponse.json({ history: userDoc?.history || [] });
    } catch (error) {
        console.error('[api/history GET]', error);
        return NextResponse.json({ history: [] }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const authData = await auth().catch(() => null);
        const userId = authData?.userId;
        const body = await req.json();
        const { song } = body;

        if (!song || !song.id) {
            return NextResponse.json({ error: 'Invalid song data' }, { status: 400 });
        }

        const historyItem = {
            id: song.id,
            slug: song.slug,
            title: song.title?.canonical || song.title?.devanagari || song.title || 'Maithili Geet',
            singer: song.credits?.singer || song.singer || 'पारंपरिक',
            poster: song.poster?.image_url || song.poster || null,
            category: song.category || 'लोकगीत',
            youtube: song.youtube || {},
            audio: song.audio || {},
            played_at: new Date().toISOString()
        };

        if (userId) {
            const db = await getDatabase();
            if (db) {
                // Remove existing entry for this song to avoid duplicates, then prepend new entry
                await db.collection('users').updateOne(
                    { id: userId },
                    {
                        $pull: { history: { id: song.id } }
                    }
                );
                await db.collection('users').updateOne(
                    { id: userId },
                    {
                        $push: {
                            history: {
                                $each: [historyItem],
                                $position: 0,
                                $slice: 100 // retain up to 100 recent entries
                            }
                        }
                    }
                );
            }
        }

        return NextResponse.json({ success: true, item: historyItem });
    } catch (error) {
        console.error('[api/history POST]', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req) {
    try {
        const authData = await auth().catch(() => null);
        const userId = authData?.userId;
        if (!userId) {
            return NextResponse.json({ success: true });
        }

        const url = new URL(req.url);
        const songId = url.searchParams.get('songId');
        const clearAll = url.searchParams.get('all') === 'true';

        const db = await getDatabase();
        if (!db) {
            return NextResponse.json({ success: true });
        }

        if (clearAll) {
            await db.collection('users').updateOne(
                { id: userId },
                { $set: { history: [] } }
            );
        } else if (songId) {
            await db.collection('users').updateOne(
                { id: userId },
                { $pull: { history: { id: songId } } }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[api/history DELETE]', error);
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}
