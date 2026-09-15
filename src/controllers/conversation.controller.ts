import { Elysia, t } from "elysia";

import { authInterceptor } from "../interceptors/auth.interceptor";
import type { SendMessageInput } from "../dto/send-message.dto";
import type { UpdateLastViewTimeInput } from "../dto/update-last-view-time.dto";
import {
  getConversationById,
  sendMessage,
  updateLastViewTime,
} from "../services/conversation.service";

/**
 * Protected conversation endpoints (Bearer token → APISIX injects X-Userinfo).
 * `authInterceptor` makes `userId` available to every handler and rejects
 * with 401 when the identity header is missing/invalid.
 *
 * The controller lives under `/conversation`; APISIX strips the `/messaging`
 * gateway prefix, so the public URL is
 *   POST /messaging/conversation/message/:id
 *
 * HOW TO ADD A PROTECTED ENDPOINT HERE:
 *   .get("/foo", async ({ userId }) => ...,
 *        { detail: { tags: ["Conversation"], summary: "...", security: [{ bearerAuth: [] }] } })
 */
export const conversationController = authInterceptor(
  new Elysia({ prefix: "/conversation" })
).post(
  "/message/:id",
  async ({ params, query, body, userId, set }) => {
    // --- Locked payload assembly (spec §2) — no `any` ---
    const chatId = params.id; // from URL :id (server-set)
    const colonyId = query?.colonyId ?? ""; // query, default ""
    const b = (body ?? {}) as Partial<SendMessageInput>;

    // Manual DTO validation (type + text are required) — Nest-style 400.
    if (b.type !== "text" && b.type !== "media") {
      set.status = 400;
      return {
        statusCode: 400,
        message: ["type must be a valid enum value"],
        error: "Bad Request",
      };
    }
    if (typeof b.text !== "string" || b.text.length === 0) {
      set.status = 400;
      return {
        statusCode: 400,
        message: ["text should not be empty"],
        error: "Bad Request",
      };
    }

    const input: SendMessageInput = {
      chatId,
      userId, // NOT trusted from client — overwritten with auth user id
      colonyId,
      type: b.type,
      text: b.text,
      attachmentUrl: b.attachmentUrl,
      customData: b.customData,
      stockTags: b.stockTags,
    };

    // No logic here — just call the service and return its response.
    return await sendMessage(input);
  },
  {
    params: t.Object({ id: t.String() }),
    query: t.Object({ colonyId: t.Optional(t.String()) }, { additionalProperties: true }),
    body: t.Object(
      {
        type: t.Optional(t.String()),
        text: t.Optional(t.String()),
        attachmentUrl: t.Optional(t.String()),
        customData: t.Optional(t.Unknown()),
        stockTags: t.Optional(t.Array(t.String())),
      },
      { additionalProperties: true }
    ),
    detail: {
      tags: ["Conversation"],
      summary: "Send a message in a conversation",
      description:
        "Saves the message to Firestore, inserts it into Mongo `messages`, " +
        "updates the conversation (lastMessage / members / unread count) and " +
        "fires addassets/addmedia when applicable. Returns the saved Firestore " +
        "message doc.",
      security: [{ bearerAuth: [] }],
    },
  }
)
.post(
  "/lastviewtime",
  async ({ body, userId, set }) => {
    // --- Locked payload assembly (spec §2) — no `any` ---
    const b = (body ?? {}) as Partial<UpdateLastViewTimeInput>;

    // Manual DTO validation (chatId is required) — Nest-style 400.
    if (typeof b.chatId !== "string" || b.chatId.length === 0) {
      set.status = 400;
      return {
        statusCode: 400,
        message: ["chatId should not be empty"],
        error: "Bad Request",
      };
    }

    // No logic here — just call the service and return its response.
    return await updateLastViewTime(b.chatId, userId);
  },
  {
    body: t.Object(
      { chatId: t.Optional(t.String()) },
      { additionalProperties: true }
    ),
    detail: {
      tags: ["Conversation"],
      summary: "Update last view time of a conversation",
      description:
        "Marks the current authenticated user as having viewed the " +
        "conversation: updates their member lastViewTime + resets unreadCount " +
        "in Mongo, then syncs the conversation to Firestore.",
      security: [{ bearerAuth: [] }],
    },
  }
)
.get(
  "/:id",
  async ({ params }) => {
    // --- Locked payload assembly (spec §2) — no `any` ---
    const chatId = params.id; // from URL :id

    // No logic here — just call the service and return its response.
    return await getConversationById(chatId);
  },
  {
    params: t.Object({ id: t.String() }),
    detail: {
      tags: ["Conversation"],
      summary: "Get a conversation by id",
      description:
        "Reads the conversation by _id, re-writes it to Mongo and syncs it " +
        "to Firestore (setConversation). When found, fire-and-forget marks " +
        "all Firestore messages of the chat as read. Returns the conversation " +
        "doc.",
      security: [{ bearerAuth: [] }],
    },
  }
);
