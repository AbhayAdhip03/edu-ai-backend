require("dotenv").config();
const admin = require("firebase-admin");

const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, "base64").toString("utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uid = process.argv[2];

if (!uid) {
  console.error("Usage: node scripts/setAdmin.js <UID>");
  process.exit(1);
}

admin
  .auth()
  .setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log("Admin claim added");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
