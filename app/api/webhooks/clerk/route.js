import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { getDatabase } from '../../../../lib/mongodb';

export async function POST(req) {
    const secret = process.env.CLERK_WEBHOOK_SECRET;
    if (!secret) {
        console.error('CLERK_WEBHOOK_SECRET is not set');
        return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    const h = await headers();
    const svixId = h.get('svix-id');
    const svixTimestamp = h.get('svix-timestamp');
    const svixSignature = h.get('svix-signature');
    if (!svixId || !svixTimestamp || !svixSignature) {
        return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
    }

    // Must verify against the raw body
    const body = await req.text();
    let evt;
    try {
        evt = new Webhook(secret).verify(body, {
            'svix-id': svixId,
            'svix-timestamp': svixTimestamp,
            'svix-signature': svixSignature,
        });
    } catch (err) {
        console.error('Clerk webhook verification failed:', err.message);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const db = await getDatabase();
    if (!db) return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    const users = db.collection('users');

    const { type, data } = evt;

    if (type === 'user.created' || type === 'user.updated') {
        const primary =
            data.email_addresses?.find((e) => e.id === data.primary_email_address_id) || data.email_addresses?.[0];
        const email = primary?.email_address?.toLowerCase() || '';
        const name =
            [data.first_name, data.last_name].filter(Boolean).join(' ') || data.username || email.split('@')[0] || 'Member';

        await users.updateOne(
            { id: data.id },
            {
                // Always mirrored from Clerk
                $set: {
                    email,
                    role: data.public_metadata?.role || 'user',
                    updated_at: new Date().toISOString(),
                },
                // Seeded once; afterwards the user's edits in /api/auth/profile win
                $setOnInsert: {
                    name,
                    avatar: data.image_url || '',
                    bio: '',
                    location: '',
                    joined_at: new Date(data.created_at || Date.now()).toISOString(),
                },
            },
            { upsert: true }
        );
    } else if (type === 'user.deleted' && data.id) {
        await users.deleteOne({ id: data.id });
    }

    return NextResponse.json({ received: true });
}