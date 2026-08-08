/**
 * Firebase Admin placeholder.
 * Wire up when OTP_PROVIDER=firebase and credentials are set.
 */
function getFirebaseAdmin() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  // Lazy require so the app boots without firebase-admin until needed
  // eslint-disable-next-line global-require
  const admin = require('firebase-admin');

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  return admin;
}

module.exports = { getFirebaseAdmin };
