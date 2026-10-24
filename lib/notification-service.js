import { ObjectId } from 'mongodb';
import { getDatabase } from './mongodb';

/**
 * Creates and dispatches a notification to a recipient user.
 * Suppresses self-notifications (e.g. author liking their own post).
 */
export async function createNotification({
  recipientId,
  actorId,
  actorName = 'मिथिला स्नेही',
  actorAvatar = null,
  type, // 'recording_like' | 'post_reply' | 'comment_reply' | 'mention'
  resourceId,
  resourceType = 'community_recording',
  resourceTitle = '',
  textPreview = '',
  targetUrl = '/community'
}) {
  if (!recipientId || !actorId || !type) return null;
  // Never notify oneself
  if (recipientId === actorId) return null;

  try {
    const db = await getDatabase();
    if (!db) return null;

    const notifications = db.collection('notifications');

    // Deduplicate rapid duplicate events (e.g., toggling like on same resource)
    if (type.includes('like')) {
      const existing = await notifications.findOne({
        recipient_id: recipientId,
        actor_id: actorId,
        type,
        resource_id: String(resourceId)
      });
      if (existing) {
        // Update timestamp and mark unread
        await notifications.updateOne(
          { _id: existing._id },
          { $set: { is_read: false, created_at: new Date() } }
        );
        return existing._id;
      }
    }

    const doc = {
      recipient_id: String(recipientId),
      actor_id: String(actorId),
      actor_name: actorName || 'मिथिला स्नेही',
      actor_avatar: actorAvatar || null,
      type,
      resource_id: resourceId ? String(resourceId) : '',
      resource_type: resourceType || 'community_recording',
      resource_title: resourceTitle || '',
      text_preview: textPreview ? textPreview.substring(0, 160) : '',
      target_url: targetUrl || '/community',
      is_read: false,
      created_at: new Date()
    };

    const res = await notifications.insertOne(doc);
    return res.insertedId;
  } catch (err) {
    console.error('[NotificationService] Failed to create notification:', err);
    return null;
  }
}

/**
 * Parses text for @username or @name and dispatches mention notifications
 */
export async function dispatchMentions({
  text,
  actorId,
  actorName,
  actorAvatar,
  resourceId,
  resourceTitle,
  targetUrl
}) {
  if (!text || typeof text !== 'string') return;
  // Matches @username or @DevanagariName
  const mentionMatches = text.match(/@([a-zA-Z0-9_\u0900-\u097F]+)/g);
  if (!mentionMatches || mentionMatches.length === 0) return;

  try {
    const db = await getDatabase();
    if (!db) return;

    const rawNames = mentionMatches.map(m => m.slice(1).trim()).filter(Boolean);
    const uniqueNames = [...new Set(rawNames)];

    for (const name of uniqueNames) {
      // Find matching user by name or email username
      const user = await db.collection('users').findOne({
        $or: [
          { name: { $regex: new RegExp(`^${name}$`, 'i') } },
          { email: { $regex: new RegExp(`^${name}@`, 'i') } }
        ]
      });

      if (user && user.id && user.id !== actorId) {
        await createNotification({
          recipientId: user.id,
          actorId,
          actorName,
          actorAvatar,
          type: 'mention',
          resourceId,
          resourceTitle,
          textPreview: text,
          targetUrl
        });
      }
    }
  } catch (err) {
    console.error('[NotificationService] Mention dispatch error:', err);
  }
}
