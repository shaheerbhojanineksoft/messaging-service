/**
 * Typed DTO for POST /conversation/lastviewtime — mirrors the webapi
 * updateLastViewTime() input (spec §2). NO `any` — all fields are typed.
 *
 * NOTE: `userId` is NOT from the client — it comes from the authenticated
 * user and is used to find the member whose lastViewTime/unreadCount resets.
 */
export interface UpdateLastViewTimeInput {
  /** The conversation id to mark as viewed. */
  chatId: string;
}
