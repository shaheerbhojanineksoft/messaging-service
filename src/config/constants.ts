/** All env vars / constants used by the Messaging Service. */

/* ------------------------------------------------------------------ */
/* Env readers — the ONLY place `process.env` is touched.              */
/* (Same helpers/wording as user-and-identity-service.)                */
/* ------------------------------------------------------------------ */

/** String env var, trimmed. Missing/blank -> `fallback` (structural, not config). */
function str(key: string, fallback = ""): string {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const value = raw.trim();
  return value === "" ? fallback : value;
}

/** Required string — throws when missing or blank. */
function reqStr(key: string): string {
  const value = str(key);
  if (value === "") {
    throw new Error(
      `[config] Missing required environment variable "${key}" (see .env.example).`
    );
  }
  return value;
}

/** Required integer — throws when missing, blank or not an integer. */
function reqInt(key: string): number {
  const raw = reqStr(key);
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error(
      `[config] Environment variable "${key}" must be an integer (got "${raw}").`
    );
  }
  return value;
}

/** Required boolean — accepts true/false, 1/0, yes/no, on/off. */
function reqBool(key: string): boolean {
  const raw = reqStr(key).toLowerCase();
  if (["true", "1", "yes", "on"].includes(raw)) return true;
  if (["false", "0", "no", "off"].includes(raw)) return false;
  throw new Error(
    `[config] Environment variable "${key}" must be a boolean (got "${raw}").`
  );
}

export const constants = {
  // --- Service ---
  SERVICE_NAME: "Messaging Service",

  // --- Keycloak (issuer) — SAME keys as user-and-identity-service ---
  KEYCLOAK_BASE_URL: reqStr("KEYCLOAK_BASE_URL"),
  KEYCLOAK_REALM_NAME: reqStr("KEYCLOAK_REALM_NAME"),
  // Tolerated clock skew (seconds) when verifying a Keycloak token locally.
  KEYCLOAK_CLOCK_TOLERANCE_SECONDS: reqInt("KEYCLOAK_CLOCK_TOLERANCE_SECONDS"),

  // --- Auth mode (who verifies the user's token) ---
  // true  → APISIX verified the token and injects `X-Userinfo`:
  //         the protected routes read that header.
  // false → no gateway in front: THIS service verifies the raw
  //         `Authorization: Bearer <token>` itself against Keycloak's JWKS and
  //         takes the identity from the VERIFIED claims. `X-Userinfo` is
  //         ignored completely in this mode.
  GATEWAY_AUTH_ENABLED: reqBool("GATEWAY_AUTH_ENABLED"),
  // Optional override for direct-token mode (blank ⇒ derived from the issuer).
  KEYCLOAK_JWKS_URL: str("KEYCLOAK_JWKS_URL"),
  // Comma separated accepted `iss` values; blank ⇒ the configured issuer only.
  KEYCLOAK_ISSUERS: str("KEYCLOAK_ISSUERS"),

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
