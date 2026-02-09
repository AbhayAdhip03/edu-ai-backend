const express = require("express");
const router = express.Router();

const { verifyFirebaseToken } = require("../auth");
const { decrypt } = require("../crypto");

const mongoose = require("mongoose");
const axios = require("axios");

/* ================================
   Mongo Model
================================ */

const SchoolKeySchema = new mongoose.Schema({
  schoolId: { type: String, unique: true },
  keysEncrypted: String,
  active: Boolean,
  updatedAt: Date,
});

const SchoolKey =
  mongoose.models.SchoolKey ||
  mongoose.model("SchoolKey", SchoolKeySchema);

/* ================================
   MODEL MAP  🔥 CHANGE MODELS HERE
================================ */

const MODELS = {
  neural: "meta-llama/llama-3.1-8b-instruct",
  helpbot: "google/gemma-2-9b-it",

  // IMAGE MODEL (OpenRouter)
  image: "sourceful/riverflow-v2-pro",
};

/* ================================
   OpenRouter CHAT CALL
================================ */

async function callOpenRouterChat(apiKey, model, messages) {
  const res = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model,
      messages,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://qubiq.ai",
        "X-Title": "QubiQ Edu AI",
      },
      timeout: 60_000,
    }
  );

  return res.data;
}

/* ================================
   OpenRouter IMAGE CALL (CHAT API)
================================ */

async function callOpenRouterImage(apiKey, prompt) {
  const res = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: MODELS.image,
      messages: [
        {
          role: "user",
          content: `Generate an image of: ${prompt}. Return ONLY the image URL.`,
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://qubiq.ai",
        "X-Title": "QubiQ Edu AI",
      },
      timeout: 120_000,
    }
  );

  return res.data;
}

/* ================================
   CHAT ENDPOINT
================================ */

router.post("/chat", verifyFirebaseToken, async (req, res) => {
  try {
    const schoolId = req.user.schoolId || req.body.schoolId;
    const botType = req.body.botType || "neural";

    if (!schoolId) {
      return res.status(400).json({ error: "School ID missing" });
    }

    const record = await SchoolKey.findOne({ schoolId });

    if (!record || !record.active) {
      return res.status(403).json({ error: "School disabled" });
    }

    const keys = JSON.parse(decrypt(record.keysEncrypted));

    const apiKey = keys.chat;

    if (!apiKey) {
      return res.status(400).json({ error: "Chat key missing" });
    }

    const model = MODELS[botType] || MODELS.neural;

    const messages = [
      { role: "system", content: "You are a helpful educational tutor." },
      { role: "user", content: req.body.prompt },
    ];

    const result = await callOpenRouterChat(apiKey, model, messages);

    const reply =
      result?.choices?.[0]?.message?.content ||
      "No response from model";

    res.json({ reply });
  } catch (err) {
    console.error("CHAT ERROR:", err.response?.data || err.message);

    res.status(500).json({ error: "AI call failed" });
  }
});

/* ================================
   IMAGE ENDPOINT
================================ */

router.post("/image", verifyFirebaseToken, async (req, res) => {
  try {
    const schoolId = req.user.schoolId || req.body.schoolId;
    const prompt = req.body.prompt;

    if (!schoolId) {
      return res.status(400).json({ error: "School ID missing" });
    }

    if (!prompt) {
      return res.status(400).json({ error: "Prompt missing" });
    }

    const record = await SchoolKey.findOne({ schoolId });

    if (!record || !record.active) {
      return res.status(403).json({ error: "School disabled" });
    }

    const keys = JSON.parse(decrypt(record.keysEncrypted));

    const apiKey = keys.image;

    if (!apiKey) {
      return res
        .status(400)
        .json({ error: "Image key missing" });
    }

    const result = await callOpenRouterImage(apiKey, prompt);

    const imageUrl =
      result?.choices?.[0]?.message?.content || null;

    if (!imageUrl) {
      return res
        .status(500)
        .json({ error: "Image generation failed" });
    }

    res.json({
      image: imageUrl,
    });
  } catch (err) {
    console.error("IMAGE ERROR:", err.response?.data || err.message);

    res.status(500).json({ error: "Image generation failed" });
  }
});

module.exports = router;
