/**
 * web/lib/privacy.js
 * Centralized authorization & privacy logic for Accounts and Community Recordings
 */

export function parseEmailList(envVar) {
  if (!envVar) return [];
  return envVar
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email) {
  if (!email) return false;
  const adminEmails = parseEmailList(process.env.ADMIN_EMAILS);
  return adminEmails.includes(email.toLowerCase());
}

export function isPrivacyFeatureAllowed(email, role) {
  if (!email && !role) return false;
  if (role === 'admin' || isAdminEmail(email)) return true;
  const allowedEmails = parseEmailList(process.env.PRIVACY_FEATURE_EMAILS);
  return allowedEmails.includes((email || '').toLowerCase());
}

/**
 * Evaluates whether a caller can view a given user profile.
 */
export function canViewUserProfile({ targetUser, viewerUserId, viewerRole, viewerEmail }) {
  if (!targetUser?.is_private) return true;
  const isAdmin = viewerRole === 'admin' || isAdminEmail(viewerEmail);
  if (isAdmin) return true;
  if (viewerUserId && (targetUser?.id === viewerUserId || String(targetUser?._id) === String(viewerUserId))) return true;
  if (viewerEmail && targetUser?.email && viewerEmail.trim().toLowerCase() === targetUser.email.trim().toLowerCase()) return true;
  return false;
}

/**
 * Evaluates whether a caller can view a specific recording.
 */
export function canViewRecording({ recording, creatorUser, viewerUserId, viewerRole, viewerEmail }) {
  const isPrivate = Boolean(recording?.is_private || creatorUser?.is_private);
  if (!isPrivate) return true;
  const isAdmin = viewerRole === 'admin' || isAdminEmail(viewerEmail);
  if (isAdmin) return true;

  // Check if caller is the owner by user ID (Clerk ID or DB ID)
  if (viewerUserId) {
    const vId = String(viewerUserId).trim();
    if (recording?.user_id && String(recording.user_id).trim() === vId) return true;
    if (creatorUser?.id && String(creatorUser.id).trim() === vId) return true;
    if (creatorUser?._id && String(creatorUser._id).trim() === vId) return true;
  }

  // Check if caller is the owner by email address
  if (viewerEmail) {
    const vMail = viewerEmail.trim().toLowerCase();
    if (creatorUser?.email && creatorUser.email.trim().toLowerCase() === vMail) return true;
    if (recording?.user_email && recording.user_email.trim().toLowerCase() === vMail) return true;
  }

  return false;
}

/**
 * Evaluates whether a caller can toggle privacy on a recording.
 */
export function canModifyRecordingPrivacy({ recording, viewerUserId, viewerRole, viewerEmail }) {
  const isAdmin = viewerRole === 'admin' || isAdminEmail(viewerEmail);
  if (isAdmin) return true;
  const isOwner = viewerUserId && recording?.user_id === viewerUserId;
  const hasFeature = isPrivacyFeatureAllowed(viewerEmail, viewerRole);
  return Boolean(isOwner && hasFeature);
}

/**
 * Evaluates whether a caller can toggle privacy on a user profile.
 */
export function canModifyProfilePrivacy({ targetUserId, viewerUserId, viewerRole, viewerEmail }) {
  const isAdmin = viewerRole === 'admin' || isAdminEmail(viewerEmail);
  if (isAdmin) return true;
  const isSelf = viewerUserId && targetUserId === viewerUserId;
  const hasFeature = isPrivacyFeatureAllowed(viewerEmail, viewerRole);
  return Boolean(isSelf && hasFeature);
}
