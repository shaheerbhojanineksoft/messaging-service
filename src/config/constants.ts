/** All env vars / constants used by the Messaging Service. */

/** Boolean env var — accepts true/false, 1/0, yes/no, on/off; blank ⇒ fallback. */
function parseBool(raw: string | undefined, fallback: boolean): boolean {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "") return fallback;
  if (["true", "1", "yes", "on"].includes(value)) return true;
  if (["false", "0", "no", "off"].includes(value)) return false;
  throw new Error(
    `[config] Environment variable must be a boolean (got "${raw}") — use true/false.`
  );
}

export const constants = {
  // --- Service ---
  SERVICE_NAME: "Messaging Service",

  // --- Auth mode (who verifies the user's token) ---
  // true  (DEFAULT, unchanged) → APISIX (openid-connect) verified the token and
  //         injects `X-Userinfo`: the protected routes only read that header.
  // false → no gateway in front: THIS service verifies the raw
  //         `Authorization: Bearer <token>` itself against Keycloak's JWKS
  //         (signature + `iss` + expiry) and takes the identity from the
  //         VERIFIED claims. `X-Userinfo` is IGNORED in this mode — trusting it
  //         would let any caller impersonate any user.
  // (Same flag/semantics as user-and-identity-service.)
  GATEWAY_AUTH_ENABLED: parseBool(process.env.GATEWAY_AUTH_ENABLED, true),
  // --- Keycloak issuer (only used when GATEWAY_AUTH_ENABLED=false) ---
  KEYCLOAK_BASE_URL: process.env.KEYCLOAK_BASE_URL ?? "",
  KEYCLOAK_REALM_NAME: process.env.KEYCLOAK_REALM_NAME ?? "",
  // Optional: explicit JWKS endpoint and extra accepted `iss` values
  // (comma separated). Blank ⇒ derived from the issuer above.
  KEYCLOAK_JWKS_URL: process.env.KEYCLOAK_JWKS_URL ?? "",
  KEYCLOAK_ISSUERS: process.env.KEYCLOAK_ISSUERS ?? "",
  // Tolerated clock skew (seconds) when verifying a Keycloak token locally.
  KEYCLOAK_CLOCK_TOLERANCE_SECONDS: Number(
    process.env.KEYCLOAK_CLOCK_TOLERANCE_SECONDS ?? 5
  ),

  // --- Mongo (single DB per service convention; jobs replicate collections) ---
  DATABASE_URL: process.env.DATABASE_URL ?? "mongodb://localhost:27017",
  // TODO: confirm the official DB name once the messaging DB naming is decided
  // (convention so far: Traderverse-Authentication / Traderverse-connections /
  // Traderverse-Market). This is a placeholder default.
  DATABASE_NAME: process.env.DATABASE_NAME ?? "Traderverse-Messaging",

  // --- Mongo collections (same names as the webapi source) ---
  CONVERSATIONS_COLLECTION: "conversations",
  MESSAGES_COLLECTION: "messages",

  // --- Firebase / Firestore (values come from env — see .env.example) ---
  // Same Firebase project as the webapi (firebase-admin init in main.ts).
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ?? "traderverse-75f26",
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ?? "",
  // firebase-admin replaces literal "\n" with real newlines; keep that here.
  FIREBASE_PRIVATE_KEY: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  // Kept for parity with the webapi firebase-admin init (Realtime DB / Storage).
  // The Firestore client itself only needs projectId + credentials.
  FIREBASE_DATABASE_URL:
    process.env.FIREBASE_DATABASE_URL ??
    "https://internaldev-361116-default-rtdb.firebaseio.com/",
  FIREBASE_STORAGE_BUCKET:
    process.env.FIREBASE_STORAGE_BUCKET ?? "gs://internaldev-361116.appspot.com",
  // When set (e.g. "127.0.0.1:8081") the Firestore client targets the emulator.
  FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST ?? "",
} as const;
