// A simple script to write to Firestore via Admin SDK to set the initial version.
const _admin = require("firebase-admin");

// NOTE: You would need to temporarily supply your service account json path here
// if you were running this locally, but it's easier to just let the user save it
// via the Admin UI directly.
