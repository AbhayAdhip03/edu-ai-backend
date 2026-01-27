const express = require("express");
const router = express.Router();

const { verifyFirebaseToken } = require("../auth");
const { decrypt } = require("../crypto");

const mongoose = require("mongoose");
const axios = require("axios");

// Same model
const SchoolKeySchema = new mongoose.Schema({
  schoolId: { type: String, unique: true },
  keysEncrypted: String,
  active: Boolean,
  updatedAt: Date,
});

const SchoolKey =
  mongoose.models.SchoolKey ||
  mongoose.model("SchoolKey", SchoolKeySchema);

// Helper to call OpenAI (example for chat)
async function callOpenAI(apiKey, payload) {
  const res = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    payload,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  return res.data;
}

// Chat endpoint
router.post("/chat", verifyFirebaseToken, async (req, res) => {
  try {
    const schoolId = req.user.schoolId; // must exist in Firebase custom claims

    const record = await SchoolKey.findOne({ schoolId });

    if (!record || !record.active) {
      return res.status(403).json({ error: "School disabled" });
    }

    const keys = JSON.parse(decrypt(record.keysEncrypted));

    const apiKey = keys.chat;

    if (!apiKey) {
      return res.status(400).json({ error: "Chat key missing" });
    }

    const result = await callOpenAI(apiKey, req.body);

    res.json(result);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "AI call failed" });
  }
});

module.exports = router;
