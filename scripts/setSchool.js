require("dotenv").config();
const admin = require("firebase-admin");

const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, "base64").toString("utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uid = process.argv[2];
const schoolId = process.argv[3];

if (!uid || !schoolId) {
  console.error("Usage: node scripts/setSchool.js <UID> <schoolId>");
  process.exit(1);
}

admin
  .auth()
  .setCustomUserClaims(uid, { schoolId })
  .then(() => {
    console.log("SchoolId added");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
