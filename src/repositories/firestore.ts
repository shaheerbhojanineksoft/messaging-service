import { Firestore } from "@google-cloud/firestore";

import { constants } from "../config/constants";

let firestore: Firestore | null = null;

/**
 * Lazily create the Firestore client.
 *
 * Auth resolution (same Firebase project as the webapi `firebase-admin`
 * init — creds come from env, see `.env.example`):
 *   1. `FIRESTORE_EMULATOR_HOST` set  → emulator (SDK auto-routes to it)
 *   2. `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` set → service account
 *   3. otherwise → Application Default Credentials (ADC)
 *
 * NOTE: bun uses `@google-cloud/firestore` (NOT `firebase-admin`); it IS the
 * SDK that firebase-admin delegates Firestore calls to, and it runs fine on
 * Bun. The RTDB `databaseUrl` / `storageBucket` from the webapi init are not
 * needed here — only Firestore is used.
 */
export function getFirestore(): Firestore {
  if (firestore) return firestore;

  const { FIRESTORE_EMULATOR_HOST, FIREBASE_PROJECT_ID } = constants;

  if (FIRESTORE_EMULATOR_HOST) {
    // The Node Firestore client reads FIRESTORE_EMULATOR_HOST and disables
    // TLS + routes to the emulator automatically when it is set.
    firestore = new Firestore({ projectId: FIREBASE_PROJECT_ID });
    console.log(
      `[firestore] using EMULATOR ${FIRESTORE_EMULATOR_HOST} (project ${FIREBASE_PROJECT_ID})`
    );
  } else if (constants.FIREBASE_CLIENT_EMAIL && constants.FIREBASE_PRIVATE_KEY) {
    firestore = new Firestore({
      projectId: FIREBASE_PROJECT_ID,
      credentials: {
        client_email: constants.FIREBASE_CLIENT_EMAIL,
        private_key: constants.FIREBASE_PRIVATE_KEY,
      },
    });
    console.log(
      `[firestore] using service-account credentials (project ${FIREBASE_PROJECT_ID})`
    );
  } else {
    // ADC (GOOGLE_APPLICATION_CREDENTIALS) — useful on GCP / local gcloud.
    firestore = new Firestore();
    console.log("[firestore] using Application Default Credentials");
  }

  return firestore;
}
