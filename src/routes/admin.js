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

// ==========================================
// 🔍 GET ADMIN DATA FOR A SCHOOL
// ==========================================
router.get("/get-admin/:schoolId", verifyAdminKey, async (req, res) => {
  try {
    const { schoolId } = req.params;

    if (!schoolId) {
      return res.status(400).json({ error: "schoolId required" });
    }

    const snapshot = await admin.firestore()
      .collection("users")
      .where("schoolId", "==", schoolId)
      .where("role", "==", "admin")
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ error: "No admin found for this school" });
    }

    const adminDoc = snapshot.docs[0];
    const adminData = adminDoc.data();

    res.json({
      success: true,
      adminId: adminDoc.id,
      name: adminData.name || "Admin",
      email: adminData.email
    });
  } catch (err) {
    console.error("GET ADMIN ERROR:", err);
    res.status(500).json({ error: "Failed to fetch admin data" });
  }
});

// ==========================================
// 🔍 DISCOVERY & SYNC (Ultimate Fix)
// ==========================================
router.post("/discovery-sync", verifyAdminKey, async (req, res) => {
  try {
    const { schoolCode, visitDocId } = req.body;

    if (!schoolCode || !visitDocId) {
      return res.status(400).json({ error: "schoolCode and visitDocId required" });
    }

    console.log(`🔍 Discovery Proxy: Checking Qubiq for Admin of school ${schoolCode}...`);

    // 1. Search for Admin in the Qubiq Project
    const userSnapshot = await admin.firestore()
      .collection("users")
      .where("schoolId", "==", schoolCode)
      .where("role", "==", "admin")
      .limit(1)
      .get();

    if (userSnapshot.empty) {
      return res.status(404).json({ error: "No admin found for this school" });
    }

    const adminDoc = userSnapshot.docs[0];
    const adminData = adminDoc.data();
    const adminId = adminDoc.id;
    const adminName = adminData.name || "Admin";

    console.log(`✅ Discovery Proxy: Found Admin ${adminName} (${adminId}). Updating Management DB...`);

    // 2. Update the 'school_visits' document in the Management Project (Default instance)
    await admin.firestore()
      .collection("school_visits")
      .doc(visitDocId)
      .set({
        adminId: adminId,
        adminName: adminName,
      }, { merge: true });

    res.json({
      success: true,
      adminId,
      adminName,
      message: "Admin found and synced to Management successfully"
    });
  } catch (err) {
    console.error("DISCOVERY SYNC ERROR:", err);
    res.status(500).json({ error: "Failed to perform discovery sync" });
  }
});

// ==========================================
// 🔄 SYNC COURSE DATA TO QUBIQ FIRESTORE
// ==========================================

router.post("/sync-course", verifyAdminKey, async (req, res) => {
  try {
    const {
      courseId,
      name,
      description,
      category,
      price,
      duration,
      learningPoints,
      curriculum, // Optional curriculum list
      imageUrl,
      level,
      language,
    } = req.body;

    if (!courseId || !name) {
      return res.status(400).json({ error: "courseId and name required" });
    }

    // Map fields to what the Qubiq Student Dashboard expects
    const courseData = {
      courseId,
      title: name, // Desktop project expects 'title'
      description,
      category,
      price,
      duration,
      whatYouWillLearn: learningPoints || [], // Matches CourseOverviewScreen
      whatsIncluded: [], // Can be expanded later
      instructor: "Emmi Bot", // Default instructor
      thumbnailUrl: imageUrl || "",
      level: level || "Beginner",
      language: language || "English",
      status: "published", // REQUIRED for student dashboard filter
      totalModules: curriculum ? curriculum.length : 0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Write to the 'courses' collection
    await admin.firestore().collection("courses").doc(courseId).set(courseData, { merge: true });

    // Handle Curriculum (Modules sub-collection)
    if (curriculum && Array.isArray(curriculum)) {
      const modulesRef = admin.firestore().collection("courses").doc(courseId).collection("modules");
      
      // Batch update modules
      const batch = admin.firestore().batch();
      curriculum.forEach((item, index) => {
        const modId = `mod_${index + 1}`;
        const modRef = modulesRef.doc(modId);
        batch.set(modRef, {
          title: item.title,
          type: item.type || "Video",
          duration: item.duration || "",
          videoUrl: item.videoUrl || "",
          sequence: index + 1,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      });
      await batch.commit();
    }

    // Ensure createdAt exists
    const docRef = admin.firestore().collection("courses").doc(courseId);
    const doc = await docRef.get();
    if (!doc.exists || !doc.data().createdAt) {
      await docRef.update({
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    console.log(`Synced course: ${name} (${courseId})`);

    res.json({
      success: true,
      message: "Course synced to Qubiq successfully with curriculum",
    });
  } catch (err) {
    console.error("ADMIN COURSE SYNC ERROR:", err);
    res.status(500).json({ error: "Failed to sync course data" });
  }
});

module.exports = router;
