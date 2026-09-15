import type { Collection, Document } from "mongodb";

import { getDb } from "./mongo";
import { constants } from "../config/constants";

async function conversations(): Promise<Collection<Document>> {
  return (await getDb()).collection(constants.CONVERSATIONS_COLLECTION);
}

/** Find a conversation by `_id` (= chatId). Returns null when not found. */
export async function findConversationById(
  conversationId: string
): Promise<Document | null> {
  // _id is a plain string (chatId), so bypass ObjectId inference.
  return (await conversations()).findOne({ _id: conversationId } as any);
}

/**
 * Update a conversation by `_id` (= chatId) — mirrors the webapi write:
 *   $set { lastMessage: <saved msg>, members: [...] }
 * Only called when the conversation exists (no upsert).
 */
export async function updateConversation(
  chatId: string,
  update: Record<string, unknown>
): Promise<void> {
  await (
    await conversations()
  ).updateOne({ _id: chatId } as any, { $set: update });
}
