import {
  countMessages,
  upsertMessage,
} from "../repositories/messages.repo";
import {
  findConversationById,
  updateConversation,
} from "../repositories/conversations.repo";
import {
  firestoreAddMessage,
  firestoreReadAllMessages,
  firestoreSetConversation,
} from "../repositories/chat.firestore";
import { addAssets, addMedia } from "./socialmedia.publisher";
import type {
  MessageDoc,
  MessageTypeName,
  SendMessageInput,
} from "../dto/send-message.dto";

/** LOCKED response envelope (spec §4). */
export interface ResponseModel<T> {
  isSuccess: boolean;
  data: T | null;
  message: string;
}

/**
 * In-memory message record before the Firestore save. Carries `chatId` while
 * building; `chatId` is DELETED before the Firestore save (the doc lives under
 * its own chatId sub-collection). The Mongo `messages` copy re-adds chatId.
 */
interface MessageRecord {
  id: string;
  userId: string;
  type: MessageTypeName;
  text: string;
  isRead: boolean;
  chatId?: string;
  createdOn?: number;
  attachmentUrl?: string;
  customData?: unknown;
  colonyId?: string;
  channelId?: string;
  stockTags?: string[];
}

/**
 * Send a message — behaviourally identical to the webapi
 * `ConversationService.sendMessage()` → `sendMessageCore()`.
 *
 * ⚠️ LOCKED response strings:
 *   success: "Message sent Succesfully" (typo preserved)
 *   firestore fail: "Cannot sent message"
 *   catch: "Something went Wrong" (capital W)
 */
export async function sendMessage(
  data: SendMessageInput
): Promise<ResponseModel<MessageDoc | null>> {
  try {
    // ── Step A — build the message (sendMessage) ──────────────────────────
    const chatId = data.chatId;
    const userId = data.userId;

    const message: MessageRecord = {
      id: "", // overwritten in sendMessageCore
      userId,
      type: data.type,
      text: data.text,
      isRead: false,
      chatId,
    };
    message.attachmentUrl = data.attachmentUrl;
    message.customData = data.customData;
    if (data.colonyId) {
      message.colonyId = data.colonyId;
      message.channelId = chatId;
    }
    if (data.stockTags && data.stockTags.length > 0) {
      message.stockTags = data.stockTags;
    }

    // ── Step B — persist + notify flow (sendMessageCore) ──────────────────
    const conversationId = message.chatId!;
    message.isRead = false;
    delete message.chatId;
    message.id = Date.now().toString();

    // Find the Mongo conversation (may not exist).
    let conversation: any = await findConversationById(conversationId);

    if (conversation) {
      const members: any[] = Array.isArray(conversation.members)
        ? conversation.members
        : [];
      // index of the OTHER member (not the sender)
      const index = members.findIndex((x: any) => x.id !== message.userId);
      if (index !== -1) {
        const lastViewTime = members[index]?.lastViewTime;
        const query: any = {
          $and: [{ chatId: conversationId }, { userId: message.userId }],
        };
        if (lastViewTime) {
          query.$and.push({ createdOn: { $gte: lastViewTime } });
        }
        const count = await countMessages(query);
        members[index]!.unreadCount = lastViewTime ? count + 1 : count;
        delete conversation._id;
      }
    }

    // Firestore save — read-back doc is the response `data`.
    const data_ = await firestoreAddMessage(
      conversationId,
      message,
      conversation ? conversation.members : []
    );

    if (data_) {
      // Mongo: insert the message copy (chatId re-added).
      await upsertMessage(message.id, { ...message, chatId: conversationId });

      // ❌ sendNotificationOfMessage (chat notification HTTP) — NOT implemented.

      // addassets — only when stockTags present (fire-and-forget, kept).
      if (message.stockTags && message.stockTags.length > 0) {
        addAssets({
          assets: [...message.stockTags],
          colonyId: message.colonyId,
          channelId: chatId,
          userId: message.userId,
          referenceId: message.id,
        });
      }

      // addmedia — only when attachmentUrl present (fire-and-forget, kept).
      if (message.attachmentUrl) {
        addMedia({
          media: [{ type: "", url: message.attachmentUrl }],
          colonyId: message.colonyId,
          channelId: chatId,
          userId: message.userId,
          referenceId: message.id,
        });
      }

      // Mongo: update the conversation when it exists.
      if (conversation) {
        await updateConversation(conversationId, {
          lastMessage: data_,
          members: [...conversation.members],
        });
      }

      return { isSuccess: true, data: data_, message: "Message sent Succesfully" };
    }

    // Firestore save failed.
    return { isSuccess: false, data: null, message: "Cannot sent message" };
  } catch {
    return { isSuccess: false, data: null, message: "Something went Wrong" };
  }
}

/**
 * Update Last View Time — behaviourally identical to the webapi
 * `ConversationService.updateLastViewTime()`.
 *
 * Marks the current authenticated user as having viewed the conversation:
 * updates their member `lastViewTime` + resets `unreadCount` in Mongo, then
 * syncs the conversation to Firestore. No notification / scheduler / NATS.
 *
 * ⚠️ LOCKED response strings:
 *   success: "View Time Updated"
 *   no conversation: "Conversation Not Found."  (with period)
 *   catch: "Something Went Wrong."  (capital W + period)
 */
export async function updateLastViewTime(
  chatId: string,
  userId: string
): Promise<ResponseModel<null>> {
  try {
    // 1. Load the conversation by _id = chatId.
    const conversation = await findConversationById(chatId);
    if (!conversation) {
      return { isSuccess: false, data: null, message: "Conversation Not Found." };
    }

    // 2-3. Find the current authenticated user's member and reset it.
    const members: any[] = Array.isArray(conversation.members)
      ? conversation.members
      : [];
    const index = members.findIndex((x: any) => x.id === userId);
    if (index !== -1) {
      members[index]!.lastViewTime = Date.now(); // epoch ms
      members[index]!.unreadCount = 0; // reset
    }

    // 4. Strip the Mongo _id before saving / syncing.
    delete conversation._id;

    // 5. Save the full conversation back to Mongo by chatId.
    await updateConversation(chatId, conversation);

    // 6. Firestore sync (setConversation): re-reads last message, sets
    //    lastMessage + id = chatId, deletes _id, writes conversations/{chatId}.
    await firestoreSetConversation(chatId, conversation);

    // 7. Success — no data payload.
    return { isSuccess: true, data: null, message: "View Time Updated" };
  } catch {
    return { isSuccess: false, data: null, message: "Something Went Wrong." };
  }
}

/**
 * Internal `getConversation(chatId)` helper — mirrors the webapi private
 * method used by getConversationById (reset flag false on this path).
 *
 *   1. findOne conversation by _id = chatId
 *   2. if found AND chat.userIds present:
 *        - re-write the FULL doc to Mongo by chatId ($set)
 *        - Firestore setConversation sync (lastMessage + id, delete _id, merge)
 *        - return the (now synced) chat
 *      else → return null
 *   (any error in this helper → return null)
 */
async function getConversation(
  chatId: string
): Promise<Record<string, unknown> | null> {
  try {
    const chat = await findConversationById(chatId);
    if (chat && chat.userIds) {
      // Avoid $set on the immutable _id — the doc stays keyed by chatId.
      delete chat._id;
      // Mongo re-write: $set full doc by _id = chatId.
      await updateConversation(chatId, chat);
      // Firestore sync (setConversation): sets lastMessage + id = chatId,
      // deletes _id, writes conversations/{chatId} with merge.
      await firestoreSetConversation(chatId, chat);
      return chat;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get Conversation By Id — behaviourally identical to the webapi
 * `ConversationService.getConversationById()`.
 *
 * ⚠️ LOCKED response strings:
 *   found: "Conversation Finded Succesfully"  (typos preserved)
 *   not found: "Conversation doesn`t exists"  (backtick preserved)
 *   catch: "Something went Wrong"  (capital W, no period)
 */
export async function getConversationById(
  chatId: string
): Promise<ResponseModel<Record<string, unknown> | null>> {
  try {
    const chat = await getConversation(chatId);
    if (chat) {
      // Fire-and-forget: mark every Firestore message of the chat as read.
      // Not awaited — errors are swallowed and never affect the response.
      void firestoreReadAllMessages(chatId);
      return {
        isSuccess: true,
        data: chat,
        message: "Conversation Finded Succesfully",
      };
    }
    return { isSuccess: false, data: null, message: "Conversation doesn`t exists" };
  } catch {
    return { isSuccess: false, data: null, message: "Something went Wrong" };
  }
}
