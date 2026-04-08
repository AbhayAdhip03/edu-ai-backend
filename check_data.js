require("dotenv").config();
const admin = require("firebase-admin");
const mongoose = require("mongoose");
const { decrypt } = require("./src/crypto");

// 1. Initialize Firebase
const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccountBase64) {
    console.error("❌ FIREBASE_SERVICE_ACCOUNT is missing in .env");
    process.exit(1);
}

const serviceAccount = JSON.parse(
    Buffer.from(serviceAccountBase64, "base64").toString("utf8")
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

// 2. Initialize MongoDB Schema
const SchoolKeySchema = new mongoose.Schema({
    schoolId: { type: String },
    keysEncrypted: String,
    bucketName: String,
    active: Boolean,
});
const SchoolKey = mongoose.models.SchoolKey || mongoose.model("SchoolKey", SchoolKeySchema);

async function fetchData() {
    const uid = "XMq0Nr1ewAPvPuQ1A8lKwh3kebA2";
    const schoolId = "3991";

    console.log(`\n================================`);
    console.log(`🔍 FETCHING DATA FROM SERVER`);
    console.log(`================================\n`);

    try {
        console.log(`1️⃣  Fetching Firebase Auth Data for UID: ${uid}`);
        try {
            const userRecord = await admin.auth().getUser(uid);
            console.log(`   ✅ Auth User Found:`);
            console.log(`      - Email: ${userRecord.email}`);
            console.log(`      - Display Name: ${userRecord.displayName}`);
            console.log(`      - Creation Time: ${userRecord.metadata.creationTime}`);
        } catch (e) {
            console.log(`   ❌ Auth User not found: ${e.message}`);
        }

        console.log(`\n2️⃣  Fetching Firestore 'users' collection for UID: ${uid}`);
        const userDoc = await admin.firestore().collection("users").doc(uid).get();
        if (userDoc.exists) {
            console.log(`   ✅ Firestore User Document Data:`, userDoc.data());
        } else {
            console.log(`   ❌ No Firestore document found in 'users' collection for this UID.`);
        }

        console.log(`\n3️⃣  Fetching DB (API Keys & Bucket) for School ID: ${schoolId}`);
        if (!process.env.MONGO_URI) {
            console.error("   ❌ MONGO_URI missing in .env");
        } else {
            await mongoose.connect(process.env.MONGO_URI, { dbName: "edu_ai" });
            const record = await SchoolKey.findOne({ schoolId });
            
            if (record) {
                console.log(`   ✅ MongoDB Record Found!`);
                console.log(`      - School ID: ${record.schoolId}`);
                console.log(`      - Bucket Name: ${record.bucketName || "NOT SET"}`);
                console.log(`      - Active Status: ${record.active}`);
                
                try {
                    const keys = JSON.parse(decrypt(record.keysEncrypted));
                    console.log(`      - Assigned API Keys:`, Object.keys(keys));
                    for (const [bot, key] of Object.entries(keys)) {
                         const masked = typeof key === "string" && key.length > 10 
                                      ? key.substring(0, 8) + "..." + key.slice(-4) 
                                      : key;
                         console.log(`        * ${bot}: ${masked}`);
                    }
                } catch (err) {
                     console.log(`      - ❌ Failed to decrypt api keys: ${err.message}`);
                }
            } else {
                 console.log(`   ❌ No configuration record found in MongoDB for school ID ${schoolId}`);
            }
        }
    } catch (e) {
        console.error("An error occurred during fetch:", e);
    } finally {
        console.log(`\n================================\n`);
        process.exit(0);
    }
}

fetchData();
