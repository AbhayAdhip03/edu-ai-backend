const express = require("express");
const router = express.Router();

const { verifyFirebaseToken } = require("../auth");
const { encrypt } = require("../crypto");

const mongoose = require("mongoose");

// ----- Mongo Model (inline for simplicity) -----

const SchoolKeySchema = new mongoose.Schema({
  schoolId: { type: String, unique: true },
  keysEncrypted: String,
  active: { type: Boolean, default: true },
  updatedAt: Date,
});

const SchoolKey =
  mongoose.models.SchoolKey ||
  mongoose.model("SchoolKey", SchoolKeySchema);

// ----------------------------------------------

// Admin-only middleware
function requireAdmin(req, res, next) {
  // expects custom claim: admin = true
  if (!req.user.admin) {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}

// Add / update keys for school
router.post(
  "/school-keys",
  verifyFirebaseToken,
  requireAdmin,
  async (req, res) => {
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
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, schoolId: doc.schoolId });
  }
);

// Disable a school
router.post(
  "/school-disable",
  verifyFirebaseToken,
  requireAdmin,
  async (req, res) => {
    const { schoolId } = req.body;

    await SchoolKey.updateOne(
      { schoolId },
      { active: false, updatedAt: new Date() }
    );

    res.json({ success: true });
  }
);

module.exports = router;
