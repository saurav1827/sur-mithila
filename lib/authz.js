import { auth, currentUser } from '@clerk/nextjs/server';
import { getDatabase } from './mongodb';
import { isAdminEmail } from './privacy';

/**
 * Server-side identity + role. Checks:
 * 1. ADMIN_EMAILS environment variable
 * 2. MongoDB users collection (direct database authority)
 * 3. Session token claim (when configured in Clerk JWT templates)
 * 4. Clerk currentUser() publicMetadata
 */
export async function getAuthRole() {
  const { userId, sessionClaims } = await auth();
  if (!userId) return { userId: null, role: null, email: null };

  let role = null;
  let userEmail = null;

  // 1. Check Clerk currentUser for primary email
  try {
    const u = await currentUser();
    userEmail =
      u?.emailAddresses?.find((e) => e.id === u?.primaryEmailAddressId)?.emailAddress ||
      u?.emailAddresses?.[0]?.emailAddress ||
      null;
  } catch { /* ignore */ }

  if (userEmail && isAdminEmail(userEmail)) {
    return { userId, role: 'admin', email: userEmail.toLowerCase() };
  }

  // 2. Check MongoDB first
  try {
    const db = await getDatabase();
    if (db) {
      let dbUser = await db.collection('users').findOne({ id: userId }, { projection: { role: 1, email: 1 } });
      if (!userEmail && dbUser?.email) {
        userEmail = dbUser.email;
      }
      if (!dbUser?.role && userEmail) {
        dbUser = await db.collection('users').findOne({ email: userEmail.toLowerCase() }, { projection: { role: 1, email: 1 } });
      }
      if (userEmail && isAdminEmail(userEmail)) {
        return { userId, role: 'admin', email: userEmail.toLowerCase() };
      }
      if (dbUser?.role) {
        role = dbUser.role;
      }
    }
  } catch (err) {
    console.error('Error checking role in MongoDB:', err);
  }

  // 3. If not found or not admin in DB, check Clerk session claims
  if (!role || role !== 'admin') {
    const metadata = sessionClaims?.metadata || sessionClaims?.public_metadata || sessionClaims;
    if (metadata && typeof metadata === 'object' && metadata.role) {
      role = metadata.role;
    }
  }

  // 4. Fallback to Clerk API lookup
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

  return { userId, role: role || 'user', email: userEmail ? userEmail.toLowerCase() : null };
}