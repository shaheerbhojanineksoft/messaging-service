import type { Collection, Document, Filter } from "mongodb";

import { getDb } from "./mongo";
import { constants } from "../config/constants";

async function messages(): Promise<Collection<Document>> {
  return (await getDb()).collection(constants.MESSAGES_COLLECTION);
}

/**
 * Count messages in a conversation (used for the other member's unread count).
 * Matches the webapi query:
 *   { $and: [ { chatId }, { userId }, ...({ createdOn: { $gte: lastViewTime } }) ] }
 */
export async function countMessages(query: Filter<Document>): Promise<number> {
  return (await messages()).countDocuments(query);
}

/**
 * Insert the sent message into Mongo `messages` by `_id = message.id`
 * (upsert to mirror the webapi "update by _id" write). The doc is the
 * Firestore-saved message with `chatId` re-added.
 */
export async function upsertMessage(
  messageId: string,
  doc: Document
): Promise<void> {
  // _id is a plain string (message.id = Date.now().toString()).
  await (
    await messages()
  ).updateOne({ _id: messageId } as any, { $set: doc }, { upsert: true });
}
