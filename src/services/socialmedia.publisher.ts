/**
 * Downstream `socialmedia` TCP calls — kept per spec §3 Step B.
 *
 * In the webapi these are fire-and-forget TCP messages to the `socialmedia`
 * service: `{ cmd: "addassets" }` (when stockTags) and `{ cmd: "addmedia" }`
 * (when attachmentUrl). They NEVER affect the HTTP response.
 *
 * ⚠️ The Bun stack does NOT have a `socialmedia` service yet, so these are
 * **no-op stubs** that only log. TODO: when the service + host/port/protocol
 * are available, replace the log with a real fire-and-forget TCP send
 * (e.g. `net.createConnection`) — same payload shape below.
 */

export interface AddAssetsPayload {
  assets: string[];
  colonyId?: string;
  channelId: string;
  userId: string;
  referenceId: string;
}

export interface AddMediaPayload {
  media: Array<{ type: string; url: string }>;
  colonyId?: string;
  channelId: string;
  userId: string;
  referenceId: string;
}

/** fire-and-forget `{ cmd: "addassets" }` when the message has stockTags. */
export function addAssets(payload: AddAssetsPayload): void {
  // TODO(socialmedia): real TCP send — currently a no-op stub (no target service).
  console.log(`[socialmedia] addassets (stub): ${JSON.stringify(payload)}`);
}

/** fire-and-forget `{ cmd: "addmedia" }` when the message has an attachmentUrl. */
export function addMedia(payload: AddMediaPayload): void {
  // TODO(socialmedia): real TCP send — currently a no-op stub (no target service).
  console.log(`[socialmedia] addmedia (stub): ${JSON.stringify(payload)}`);
}
