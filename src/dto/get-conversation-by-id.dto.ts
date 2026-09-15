/**
 * Typed DTO for GET /conversation/:id — mirrors the webapi
 * getConversationById() input (spec §2). NO `any` — all fields are typed.
 *
 * NOTE: comes only from the URL path param; the authenticated user is NOT
 * used to filter (this handler returns the conversation as-is).
 */
export interface GetConversationByIdInput {
  /** The conversation id to fetch (URL `:id`). */
  chatId: string;
}
