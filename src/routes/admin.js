const express = require("express");
const router = express.Router();

const { verifyAdminKey } = require("../auth");
const { encrypt } = require("../crypto");
const admin = require("firebase-admin");

const mongoose = require("mongoose");

const SchoolKeySchema = new mongoose.Schema({
  schoolId: { type: String, unique: true },
  keysEncrypted: String,
  active: { type: Boolean, default: true },
  updatedAt: Date,
});

const SchoolKey =
  mongoose.models.SchoolKey ||
  mongoose.model("SchoolKey", SchoolKeySchema);

// ==========================================
// 🔐 ADMIN — STORE / UPDATE SCHOOL KEYS
// ==========================================

router.post("/school-keys", verifyAdminKey, async (req, res) => {
  try {
    const { schoolId, keys } = req.body;

    if (!schoolId || !keys) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const encryptedBlob = encrypt(JSON.stringify(keys));

    const doc = await SchoolKey.findOneAndUpdate(
      { schoolId },
      {
        schoolId,
        keysEncrypted: encryptedBlob,
        active: true,
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      schoolId: doc.schoolId,
    });
  } catch (err) {
    console.error("ADMIN KEY UPLOAD ERROR:", err);
    res.status(500).json({ error: "Failed to store keys" });
  }
});

// ==========================================
// 🚫 DISABLE SCHOOL
// ==========================================

router.post("/school-disable", verifyAdminKey, async (req, res) => {
  try {
    const { schoolId } = req.body;

    if (!schoolId) {
      return res.status(400).json({ error: "schoolId required" });
    }

    await SchoolKey.updateOne(
      { schoolId },
      {
        active: false,
        updatedAt: new Date(),
      }
    );

    res.json({ success: true });
  } catch (err) {
    console.error("ADMIN DISABLE ERROR:", err);
    res.status(500).json({ error: "Failed to disable school" });
  }
});

// ==========================================
// 🔄 SYNC SCHOOL DATA TO QUBIQ FIRESTORE
// ==========================================

router.post("/sync-school", verifyAdminKey, async (req, res) => {
  try {
    const { schoolId, schoolName } = req.body;

    if (!schoolId || !schoolName) {
      return res.status(400).json({ error: "schoolId and schoolName required" });
    }

    // Write to the 'schools' collection in the Qubiq Firebase project
    // This uses the FIREBASE_SERVICE_ACCOUNT configured in index.js/auth.js
    await admin.firestore().collection("schools").doc(schoolId).set({
      schoolId,
      name: schoolName,
      paymentStatus: "paid",
      status: "active",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Ensure createdAt exists if it's a new document
    const docRef = admin.firestore().collection("schools").doc(schoolId);
    const doc = await docRef.get();
    if (!doc.exists || !doc.data().createdAt) {
      await docRef.update({
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    console.log(`Synced school: ${schoolName} (${schoolId})`);

    res.json({
      success: true,
      message: "School synced to Qubiq successfully"
    });
  } catch (err) {
    console.error("ADMIN SYNC ERROR:", err);
    res.status(500).json({ error: "Failed to sync school data" });
  }
});

module.exports = router;
