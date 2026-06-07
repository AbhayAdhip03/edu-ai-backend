require('dotenv').config();
const admin = require("firebase-admin");
const { S3Client, HeadBucketCommand, CreateBucketCommand } = require("@aws-sdk/client-s3");
const serviceAccount = require("./firebase_key.json"); // Assuming this exists or similar

// Initialize Firebase
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch(e) {
    console.log("Firebase init failed:", e.message);
  }
}

async function testS3() {
  try {
    const doc = await admin.firestore().collection('system_configs').doc('aws').get();
    if (!doc.exists) {
      console.log("NO AWS CONFIG IN DB!");
      return;
    }
    const config = doc.data();
    console.log("Fetched config:", config.accessKey ? "HAS_ACCESS_KEY" : "NO_KEY");

    const s3 = new S3Client({
      region: config.region || "ap-south-1",
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
    });

    console.log("Testing HeadBucket with adslog...");
    try {
      await s3.send(new HeadBucketCommand({ Bucket: "adslog" }));
      console.log("Bucket already exists.");
    } catch (err) {
      console.log("HeadBucket error metadata:", err.$metadata);
      if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
        console.log("Bucket not found, attempting to create...");
        await s3.send(new CreateBucketCommand({ Bucket: "adslog" }));
        console.log("Created successfully!");
      } else {
        console.error("Unknown Error Name:", err.name);
        console.error("Full Error:", err);
      }
    }
  } catch (e) {
    console.error("Script failed:", e);
  }
}
testS3();
