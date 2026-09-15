/**
 * Typed DTO for POST /conversation/message/:id — mirrors the webapi
 * sendMessage() input (spec §2). NO `any` — all fields are typed.
 *
 * NOTE: `chatId` and `userId` are server-set (URL param + auth), never
 * trusted from the request body.
 */
export type MessageTypeName = "text" | "media";

export interface SendMessageInput {
  /** Conversation id — from the URL `:id` (server-set). */
  chatId: string;
  /** From query `?colonyId=`, default "" — when truthy also sets channelId = chatId. */
  colonyId?: string;
  /** Set = chatId when colonyId is present (server-set). */
  channelId?: string;
  /** Current authenticated user id (server-set from X-Userinfo). */
  userId: string;
  /** Required message type. */
  type: MessageTypeName;
  /** Required message text. */
  text: string;
  /** Optional media URL. */
  attachmentUrl?: string;
  /** Optional free-form custom payload. */
  customData?: unknown;
  /** Optional stock tags (read dynamically in the webapi). */
  stockTags?: string[];
}

/**
 * The message doc that gets persisted (spec §2 "Message object built inside").
 * NOTE: `chatId` is NOT a field here — it is the sub-collection key in
 * Firestore and is re-added only on the Mongo `messages` copy.
 */
export interface MessageDoc {
  /** Message id = Date.now().toString(). */
  id: string;
  userId: string;
  type: MessageTypeName;
  text: string;
  /** Always false on send. */
  isRead: boolean;
  /** Epoch ms — added by the Firestore save. */
  createdOn: number;
  attachmentUrl?: string;
  customData?: unknown;
  /** Present only when a colonyId was supplied. */
  colonyId?: string;
  /** Present only when a colonyId was supplied (= chatId). */
  channelId?: string;
  /** Present only when stockTags were supplied. */
  stockTags?: string[];
}
