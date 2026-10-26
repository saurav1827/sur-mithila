import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDatabase } from '../../../lib/mongodb';
import { getAuthRole } from '../../../lib/authz';
import { canViewRecording } from '../../../lib/privacy';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

function extractRecordingId(item) {
    if (!item) return null;
    const idStr = String(item.id || '');
    if (idStr.startsWith('cover-')) return idStr.replace(/^cover-/, '');
    if (idStr.startsWith('rec_')) return idStr;
    const url = item.audio?.hosted_audio_url || item.audio_url || '';
    if (url.includes('sur_mithila_covers') || url.includes('/karaoke_recordings/')) {
        return idStr;
    }
    return null;
}

async function resolveUserDoc(db, authUserId, roleUserId, userEmail) {
    if (!db) return null;
    const clauses = [];
    if (authUserId) clauses.push({ id: authUserId });
    if (roleUserId && roleUserId !== authUserId) clauses.push({ id: roleUserId });
    if (userEmail) clauses.push({ email: userEmail.toLowerCase() });
    if (!clauses.length) return null;
    return await db.collection('users').findOne({ $or: clauses });
}

export async function GET(req) {
    try {
        const authData = await auth().catch(() => null);
        const userId = authData?.userId;
        const { userId: viewerUserId, role: viewerRole, email: viewerEmail } = await getAuthRole();
        const activeUserId = userId || viewerUserId;

        const url = new URL(req.url);
        const localIdsParam = url.searchParams.get('localIds') || '';
        const localIds = localIdsParam ? localIdsParam.split(',').map((s) => s.trim()).filter(Boolean) : [];

        if (!activeUserId && !viewerEmail) {
            return NextResponse.json({ history: [], disallowedIds: [] });
        }

        const db = await getDatabase();
        if (!db) {
            return NextResponse.json({ history: [], disallowedIds: [] });
        }

        const userDoc = await resolveUserDoc(db, userId, viewerUserId, viewerEmail);
        const rawHistory = userDoc?.history || [];

        // Identify candidate cover recordings from both server history and local IDs
        const coverItems = [];
        rawHistory.forEach((item) => {
            const recId = extractRecordingId(item);
            const audioUrl = item.audio?.hosted_audio_url || item.audio_url || '';
            const isCover =
                Boolean(recId) ||
                (item.id && String(item.id).startsWith('cover-')) ||
                audioUrl.includes('sur_mithila_covers') ||
                audioUrl.includes('/karaoke_recordings/');

            if (isCover) {
                coverItems.push({ item, recId, audioUrl });
            }
        });

        // Also inspect any local IDs passed from client
        localIds.forEach((id) => {
            const recId = extractRecordingId(id);
            if (recId || String(id).startsWith('cover-') || String(id).startsWith('rec_')) {
                const cleanRecId = recId || String(id).replace(/^cover-/, '');
                coverItems.push({
                    item: { id },
                    recId: cleanRecId,
                    audioUrl: ''
                });
            }
        });

        // If no covers exist in history or localIds, return raw history directly
        if (!coverItems.length) {
            return NextResponse.json({ history: rawHistory, disallowedIds: [] });
        }

        // Query status of these recordings from community_recordings
        const recIds = coverItems.map((c) => c.recId).filter(Boolean);
        const audioUrls = coverItems.map((c) => c.audioUrl).filter(Boolean);
        const objectIds = recIds
            .filter((id) => ObjectId.isValid(id) && id.length === 24)
            .map((id) => new ObjectId(id));

        const recDocs = await db.collection('community_recordings').find({
            $or: [
                ...(recIds.length ? [{ recording_id: { $in: recIds } }, { id: { $in: recIds } }] : []),
                ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
                ...(audioUrls.length ? [{ audio_url: { $in: audioUrls } }] : []),
            ]
        }).toArray();

        const recByRecId = new Map();
        const recByUrl = new Map();
        const creatorUserIds = new Set();
        const creatorEmails = new Set();

        recDocs.forEach((r) => {
            if (r.recording_id) recByRecId.set(r.recording_id, r);
            if (r.id) recByRecId.set(r.id, r);
            if (r._id) recByRecId.set(r._id.toString(), r);
            if (r.audio_url) recByUrl.set(r.audio_url, r);
            if (r.user_id) creatorUserIds.add(r.user_id);
            if (r.user_email) creatorEmails.add(r.user_email.toLowerCase());
        });

        // Query creator users
        const creatorClauses = [];
        if (creatorUserIds.size) creatorClauses.push({ id: { $in: Array.from(creatorUserIds) } });
        if (creatorEmails.size) creatorClauses.push({ email: { $in: Array.from(creatorEmails) } });

        const creatorUsers = creatorClauses.length
            ? await db.collection('users').find(
                { $or: creatorClauses },
                { projection: { id: 1, name: 1, email: 1, is_private: 1 } }
            ).toArray()
            : [];

        const creatorMapById = new Map(creatorUsers.map((u) => [u.id, u]));
        const creatorMapByEmail = new Map(creatorUsers.filter((u) => u.email).map((u) => [u.email.toLowerCase(), u]));

        const disallowedSongIds = new Set();

        // Check each candidate cover item
        coverItems.forEach(({ item, recId, audioUrl }) => {
            const cleanRecId = recId || extractRecordingId(item) || (item.id ? String(item.id).replace(/^cover-/, '') : '');
            const recDoc =
                (cleanRecId ? recByRecId.get(cleanRecId) : null) ||
                (audioUrl ? recByUrl.get(audioUrl) : null);

            if (recDoc) {
                const creatorUser =
                    (recDoc.user_id ? creatorMapById.get(recDoc.user_id) : null) ||
                    (recDoc.user_email ? creatorMapByEmail.get(recDoc.user_email.toLowerCase()) : null);

                const isPrivate = Boolean(recDoc.is_private || creatorUser?.is_private);
                if (isPrivate) {
                    const allowed = canViewRecording({
                        recording: recDoc,
                        creatorUser,
                        viewerUserId: activeUserId,
                        viewerRole,
                        viewerEmail,
                    });
                    if (!allowed) {
                        if (item.id) disallowedSongIds.add(item.id);
                        if (cleanRecId) {
                            disallowedSongIds.add(cleanRecId);
                            disallowedSongIds.add(`cover-${cleanRecId}`);
                        }
                    }
                }
            }
        });

        const disallowedArray = Array.from(disallowedSongIds);
        const sanitizedHistory = rawHistory.filter((item) => !disallowedSongIds.has(item.id));

        // Asynchronously purge disallowed private items of other users from DB
        if (disallowedArray.length > 0 && userDoc?._id) {
            db.collection('users').updateOne(
                { _id: userDoc._id },
                { $pull: { history: { id: { $in: disallowedArray } } } }
            ).catch(() => {});
        }

        return NextResponse.json({ history: sanitizedHistory, disallowedIds: disallowedArray });
    } catch (error) {
        console.error('[api/history GET]', error);
        return NextResponse.json({ history: [], disallowedIds: [] }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const authData = await auth().catch(() => null);
        const userId = authData?.userId;
        const { userId: viewerUserId, role: viewerRole, email: viewerEmail } = await getAuthRole();
        const activeUserId = userId || viewerUserId;

        const body = await req.json();
        const incomingSongs = Array.isArray(body.songs)
            ? body.songs
            : (body.song && body.song.id ? [body.song] : []);

        if (!incomingSongs.length) {
            return NextResponse.json({ error: 'Invalid song data' }, { status: 400 });
        }

        const db = await getDatabase();
        if (!db) {
            return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
        }

        // Validate items to make sure none are private recordings disallowed for viewer
        const validatedItems = [];
        for (const song of incomingSongs) {
            if (!song || !song.id) continue;
            const recId = extractRecordingId(song);
            const audioUrl = song.audio?.hosted_audio_url || song.audio_url || '';

            if (recId || (audioUrl && (audioUrl.includes('sur_mithila_covers') || audioUrl.includes('/karaoke_recordings/')))) {
                const cleanId = recId || String(song.id).replace(/^cover-/, '');
                const recDoc = await db.collection('community_recordings').findOne({
                    $or: [
                        ...(cleanId ? [{ recording_id: cleanId }, { id: cleanId }] : []),
                        ...(cleanId && ObjectId.isValid(cleanId) && cleanId.length === 24 ? [{ _id: new ObjectId(cleanId) }] : []),
                        ...(audioUrl ? [{ audio_url: audioUrl }] : []),
                    ]
                });

                if (recDoc) {
                    let creatorUser = null;
                    if (recDoc.user_id || recDoc.user_email) {
                        creatorUser = await db.collection('users').findOne({
                            $or: [
                                ...(recDoc.user_id ? [{ id: recDoc.user_id }] : []),
                                ...(recDoc.user_email ? [{ email: recDoc.user_email.toLowerCase() }] : []),
                            ]
                        });
                    }
                    const isPrivate = Boolean(recDoc.is_private || creatorUser?.is_private);
                    if (isPrivate) {
                        const allowed = canViewRecording({
                            recording: recDoc,
                            creatorUser,
                            viewerUserId: activeUserId,
                            viewerRole,
                            viewerEmail,
                        });
                        if (!allowed) {
                            // Skip private recording not belonging to user
                            continue;
                        }
                    }
                }
            }

            validatedItems.push({
                id: song.id,
                slug: song.slug || '',
                title: song.title?.canonical || song.title?.devanagari || (typeof song.title === 'string' ? song.title : 'Maithili Geet'),
                singer: song.credits?.singer || song.singer || 'पारंपरिक',
                poster: song.poster?.image_url || song.poster || null,
                category: song.category || 'लोकगीत',
                youtube: song.youtube || {},
                audio: song.audio || {},
                played_at: song.played_at || new Date().toISOString()
            });
        }

        if (!validatedItems.length) {
            return NextResponse.json({ success: true, count: 0, items: [] });
        }

        if (activeUserId || viewerEmail) {
            const userDoc = await resolveUserDoc(db, userId, viewerUserId, viewerEmail);
            if (userDoc?._id) {
                const existing = userDoc.history || [];
                const incomingIds = new Set(validatedItems.map((s) => s.id));
                const filteredExisting = existing.filter((s) => !incomingIds.has(s.id));
                const merged = [...validatedItems, ...filteredExisting].slice(0, 100);

                await db.collection('users').updateOne(
                    { _id: userDoc._id },
                    { $set: { history: merged } }
                );

                return NextResponse.json({ success: true, count: merged.length, item: validatedItems[0] });
            }
        }

        return NextResponse.json({ success: true, count: validatedItems.length, item: validatedItems[0] });
    } catch (error) {
        console.error('[api/history POST]', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req) {
    try {
        const authData = await auth().catch(() => null);
        const userId = authData?.userId;
        const { userId: viewerUserId, email: viewerEmail } = await getAuthRole();
        const activeUserId = userId || viewerUserId;

        if (!activeUserId && !viewerEmail) {
            return NextResponse.json({ success: true });
        }

        const url = new URL(req.url);
        const songId = url.searchParams.get('songId');
        const clearAll = url.searchParams.get('all') === 'true';

        const db = await getDatabase();
        if (!db) {
            return NextResponse.json({ success: true });
        }

        const userDoc = await resolveUserDoc(db, userId, viewerUserId, viewerEmail);
        if (!userDoc?._id) {
            return NextResponse.json({ success: true });
        }

        if (clearAll) {
            await db.collection('users').updateOne(
                { _id: userDoc._id },
                { $set: { history: [] } }
            );
        } else if (songId) {
            await db.collection('users').updateOne(
                { _id: userDoc._id },
                { $pull: { history: { id: songId } } }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[api/history DELETE]', error);
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}
