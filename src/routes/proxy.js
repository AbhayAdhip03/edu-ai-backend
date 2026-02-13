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
   MODEL MAP
================================ */

const MODELS = {
  neural: "meta-llama/llama-3.1-8b-instruct",
  helpbot: "google/gemma-2-9b-it",

  // IMAGE MODEL (OpenRouter-supported)
  image: "sourceful/riverflow-v2-pro",
};

/* ================================
   OpenRouter CHAT Call
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
      timeout: 60000,
    }
  );

  return res.data;
}

/* ================================
   IMAGE VIA CHAT (CORRECT WAY)
================================ */

// FIX 1: Added width, height, steps to arguments
async function callOpenRouterImageViaChat(apiKey, prompt, width, height, steps) {
  const res = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: MODELS.image,
      messages: [
        {
          role: "user",
          content: prompt, // Just the prompt
        },
      ],
      modalities: ["image"], 
      
      image_config: {
        width: width,
        height: height,
        steps: steps
      }
    }, // FIX 2: Added missing closing brace for body object
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://qubiq.ai",
        "X-Title": "QubiQ Edu AI",
      },
      timeout: 120000,
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
    console.error(
      "🔥 CHAT OPENROUTER ERROR:",
      err.response?.data || err.message
    );

    res.status(500).json({
      error: "AI chat failed",
      details: err.response?.data || err.message,
    });
  }
});

/* ================================
   IMAGE ENDPOINT (FIXED)
================================ */

router.post("/image", verifyFirebaseToken, async (req, res) => {
  try {
    const schoolId = req.user.schoolId || req.body.schoolId;
    const prompt = req.body.prompt;

    // Capture parameters from the app request
    const width = req.body.width || 512;
    const height = req.body.height || 512;
    const steps = req.body.steps || 30;

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
      return res.status(400).json({ error: "Image key missing" });
    }

    // FIX 3: Call with ALL arguments
    const result = await callOpenRouterImageViaChat(apiKey, prompt, width, height, steps);

    console.log("🖼️ IMAGE CHAT RAW:", JSON.stringify(result));

    const content = result?.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({
        error: "Image generation failed",
        raw: result,
      });
    }

    const urlMatch = content.match(/https?:\/\/\S+/);
    const image = urlMatch ? urlMatch[0] : content;

    res.json({ image });
  } catch (err) {
    console.error(
      "🔥 IMAGE OPENROUTER ERROR:",
      err.response?.data || err.message
    );

    res.status(500).json({
      error: "Image generation failed",
      details: err.response?.data || err.message,
    });
  }
});

module.exports = router;