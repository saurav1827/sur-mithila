import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getDatabase } from '../../../../lib/mongodb';

export const dynamic = 'force-dynamic';

const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);

// Avatar must be a small image data-URL (from the profile page's 256px canvas) or an https URL
const validAvatar = (v) =>
  typeof v === 'string' && v.length <= 200_000 && (v.startsWith('data:image/') || v.startsWith('https://'));

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, {
      status: 401,
      headers: { 'Cache-Control': 'no-store, max-age=0' }
    });
  }

  const db = await getDatabase();
  if (!db) {
    return NextResponse.json({ profile: null }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' }
    });
  }

  let clerkUser = null;
  try {
    clerkUser = await currentUser();
  } catch (err) {
    console.error('Clerk currentUser fetch error:', err);
  }

  const primaryEmail =
    clerkUser?.emailAddresses?.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ||
    clerkUser?.emailAddresses?.[0]?.emailAddress || '';
  const email = primaryEmail.toLowerCase();

  // Look up by id OR email so role changes by email in MongoDB are instantly reflected
  let profile = await db.collection('users').findOne(
    email ? { $or: [{ id: userId }, { email }] } : { id: userId },
    { projection: { _id: 0, name: 1, avatar: 1, bio: 1, location: 1, role: 1, email: 1 } }
  );

  // If user signed in via Clerk but does not exist in MongoDB yet, automatically create their record immediately
  if (!profile && clerkUser) {
    try {
      const name =
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') ||
        clerkUser.username ||
        email.split('@')[0] ||
        'Member';
      const avatar = clerkUser.imageUrl || '';
      const role = clerkUser.publicMetadata?.role || 'user';

      const newUser = {
        id: userId,
        name,
        email,
        avatar,
        role,
        bio: '',
        location: '',
        joined_at: clerkUser.createdAt ? new Date(clerkUser.createdAt).toISOString() : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db.collection('users').updateOne(
        { id: userId },
        { $setOnInsert: newUser },
        { upsert: true }
      );

      profile = {
        name: newUser.name,
        avatar: newUser.avatar,
        bio: newUser.bio,
        location: newUser.location,
        role: newUser.role,
      };
    } catch (err) {
      console.error('Auto user sync error on sign-in:', err);
    }
  }

  // If found by email but id wasn't set to current userId, update it
  if (profile && email) {
    db.collection('users').updateOne(
      { email, id: { $ne: userId } },
      { $set: { id: userId, updated_at: new Date().toISOString() } }
    ).catch(() => {});
  }

  return NextResponse.json({ profile: profile || null }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' }
  });
}

export async function PUT(request) {
  try {
    // Identity comes from the verified session, never from the request body
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const name = clean(body.name, 80);
    const location = clean(body.location, 100);
    const bio = clean(body.bio, 500);

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (body.avatar && !validAvatar(body.avatar)) {
      return NextResponse.json({ error: 'Invalid or oversized avatar image' }, { status: 400 });
    }

    const db = await getDatabase();
    if (!db) return NextResponse.json({ error: 'Database not connected' }, { status: 500 });

    await db.collection('users').updateOne(
      { id: userId },
      {
        $set: {
          name,
          location: location ?? '',
          bio: bio ?? '',
          ...(body.avatar ? { avatar: body.avatar } : {}),
          updated_at: new Date().toISOString(),
        },
        // Covers the rare case where the profile is saved before the webhook arrives
        $setOnInsert: { joined_at: new Date().toISOString() },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}