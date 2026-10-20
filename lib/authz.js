import { auth, currentUser } from '@clerk/nextjs/server';
import { getDatabase } from './mongodb';

/**
 * Server-side identity + role. Checks:
 * 1. MongoDB users collection (direct database authority)
 * 2. Session token claim (when configured in Clerk JWT templates)
 * 3. Clerk currentUser() publicMetadata
 */
export async function getAuthRole() {
  const { userId, sessionClaims } = await auth();
  if (!userId) return { userId: null, role: null };

  let role = null;

  // 1. Check MongoDB first
  try {
    const db = await getDatabase();
    if (db) {
      let dbUser = await db.collection('users').findOne({ id: userId }, { projection: { role: 1 } });
      if (!dbUser?.role) {
        // Fallback to checking by email if Clerk id wasn't matched directly
        try {
          const u = await currentUser();
          const email = u?.emailAddresses?.find((e) => e.id === u?.primaryEmailAddressId)?.emailAddress || u?.emailAddresses?.[0]?.emailAddress;
          if (email) {
            dbUser = await db.collection('users').findOne({ email: email.toLowerCase() }, { projection: { role: 1 } });
          }
        } catch { /* ignore */ }
      }
      if (dbUser?.role) {
        role = dbUser.role;
      }
    }
  } catch (err) {
    console.error('Error checking role in MongoDB:', err);
  }

  // 2. If not found or not admin in DB, check Clerk session claims
  if (!role || role !== 'admin') {
    const metadata = sessionClaims?.metadata || sessionClaims?.public_metadata || sessionClaims;
    if (metadata && typeof metadata === 'object' && metadata.role) {
      role = metadata.role;
    }
  }

  // 3. Fallback to Clerk API lookup
  if (!role || role !== 'admin') {
    try {
      const u = await currentUser();
      if (u?.publicMetadata?.role) {
        role = u.publicMetadata.role;
      }
    } catch (e) {
      // currentUser may fail if Clerk API is unreachable
    }
  }

  return { userId, role: role || 'user' };
}