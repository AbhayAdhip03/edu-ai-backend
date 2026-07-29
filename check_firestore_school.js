const admin = require("firebase-admin");
const serviceAccount = require("./firebase_key.json"); // assuming this exists in edu-ai-backend

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function run() {
  const doc = await admin.firestore().collection('schools').doc('8323').get();
  console.log("Firestore School 8323 Data:");
  console.log(doc.data());
  process.exit(0);
}
run();
