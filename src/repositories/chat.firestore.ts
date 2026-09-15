import { getFirestore } from "./firestore";

/**
 * Deep-convert any object/array into a plain, Firestore-friendly object.
 * Mirrors the webapi helper EXACTLY (spec §6.5):
 *  - falsy values (0, "", false, null) are kept,
 *  - arrays / nested objects recurse,
 *  - array-like entities (keys[0] === "0") are returned untouched.
 */
export function convertToObject<T>(entity: T): any {
  if (entity === null || typeof entity !== "object") return entity;

  const keys = Object.keys(entity as Record<string, unknown>);
  if (keys[0] === "0") return entity; // already array-like

  const object: Record<string, any> = {};
  for (const key of keys) {
    const value = (entity as Record<string, any>)[key];
    if (value) {
      if (Array.isArray(value)) {
        object[key] = [];
        for (const item of value) {
          object[key]!.push(convertToObject(item));
        }
      } else if (typeof value === "object") {
        object[key] = convertToObject(value);
      } else {
        object[key] = value;
      }
    } else {
      object[key] = value; // falsy values are still written
    }
  }
  return object;
}

/**
 * Firestore addMessage (spec §6.3):
 *   1. message.createdOn = Date.now()
 *   2. deep-convert the message to a plain object
 *   3. set  conversations/{chatId}/messages/{message.id}  with { merge: true }
 *   4. READ BACK the same doc → newMessage (this is the response `data`)
 *   5. updateConversationOnMessage(chatId, newMessage, members)
 *   6. return newMessage
 *
 * Returns null when the Firestore write/read fails (→ "Cannot sent message").
 */
export async function firestoreAddMessage(
  chatId: string,
  message: Record<string, any>,
  members: any[]
): Promise<any | null> {
  try {
    message.createdOn = new Date().getTime();

    const messageObject = convertToObject(message);
    const docRef = getFirestore()
      .collection("conversations")
      .doc(chatId)
      .collection("messages")
      .doc(message.id);

    await docRef.set(messageObject, { merge: true });

    const newMessage = (await docRef.get()).data() ?? null;

    await updateConversationOnMessage(chatId, newMessage, members);

    return newMessage;
  } catch {
    return null; // Firestore save failed
  }
}

/**
 * Firestore conversation-doc update on message (spec §6.4):
 *   modifiedOn, lastMessage = saved message, unreadCount + 1, members.
 * Merged back into conversations/{chatId}.
 */
async function updateConversationOnMessage(
  chatId: string,
  message: any,
  members: any[]
): Promise<void> {
  const docRef = getFirestore().collection("conversations").doc(chatId);
  const doc = await docRef.get();
  const conversationData = doc.data() ?? {};

  conversationData.modifiedOn = new Date().getTime();
  conversationData.lastMessage = message; // full saved message object
  if (!conversationData.unreadCount) {
    conversationData.unreadCount = 0;
  }
  conversationData.unreadCount = conversationData.unreadCount + 1; // total unread
  conversationData.members = [...members]; // unread-count-updated members array

  await docRef.set(convertToObject(conversationData), { merge: true });
}

/**
 * Firestore `setConversation` sync (used by updateLastViewTime, spec §3 step 6):
 *   1. read the LAST message doc in  conversations/{chatId}/messages
 *      (most recent by createdOn desc) → "" when none exists
 *   2. conversation.lastMessage = <last message doc or "">
 *   3. conversation.id = chatId
 *   4. delete conversation._id
 *   5. write  conversations/{chatId}  with { merge: true }
 */
export async function firestoreSetConversation(
  chatId: string,
  conversation: Record<string, any>
): Promise<void> {
  const conversationRef = getFirestore().collection("conversations").doc(chatId);

  const lastMessageQuery = await conversationRef
    .collection("messages")
    .orderBy("createdOn", "desc")
    .limit(1)
    .get();
  const lastMessage = lastMessageQuery.size > 0 ? lastMessageQuery.docs[0]!.data() : "";

  conversation.lastMessage = lastMessage;
  conversation.id = chatId;
  delete conversation._id;

  await conversationRef.set(convertToObject(conversation), { merge: true });
}

/**
 * Firestore `readAllMessages` — marks EVERY message doc in
 * conversations/{chatId}/messages as read ({ isRead: true }, merge).
 *
 * Fire-and-forget in the caller (used by getConversationById): errors are
 * swallowed here so it can never affect the HTTP response.
 */
export async function firestoreReadAllMessages(chatId: string): Promise<void> {
  try {
    const messagesRef = getFirestore()
      .collection("conversations")
      .doc(chatId)
      .collection("messages");

    const snapshot = await messagesRef.get();
    const writes = snapshot.docs.map((doc) =>
      doc.ref.set({ isRead: true }, { merge: true })
    );
    await Promise.all(writes);
  } catch {
    // Errors are swallowed — fire-and-forget.
  }
}
