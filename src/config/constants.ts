/** All env vars / constants used by the Messaging Service. */
export const constants = {
  // --- Service ---
  SERVICE_NAME: "Messaging Service",

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
