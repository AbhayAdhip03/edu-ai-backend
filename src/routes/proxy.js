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
    }, // Closing brace for body object
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

    // Select the appropriate API key based on the bot type requested
    let apiKey = keys.chat; // Default to main chat key
    if (botType === "emmiLite") apiKey = keys.emmiLite || keys.chat;
    else if (botType === "helpbot") apiKey = keys.helpbot || keys.chat;
    else if (botType === "blockly") apiKey = keys.blockly || keys.chat;
    else if (botType === "translate") apiKey = keys.translate || keys.chat;

    if (!apiKey) {
      return res.status(400).json({ error: `${botType} key or fallback Chat key missing` });
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

    // FIX: Call with ALL arguments
    const result = await callOpenRouterImageViaChat(apiKey, prompt, width, height, steps);

    // console.log("🖼️ IMAGE CHAT RAW:", JSON.stringify(result)); // Uncomment for debug

    // --- NEW PARSING LOGIC ---
    let image = null;
    const choice = result?.choices?.[0];

    if (choice && choice.message) {
      // 1. Check for standard content (URL string)
      if (choice.message.content) {
        const urlMatch = choice.message.content.match(/https?:\/\/\S+/);
        image = urlMatch ? urlMatch[0] : choice.message.content;
      }

      // 2. Check for OpenRouter native image array (base64 or object)
      // This is often where "Sourceful" models return the image!
      if (!image && choice.message.images && choice.message.images.length > 0) {
        // It could be a URL inside, or a direct base64 string
        const imgObj = choice.message.images[0];
        image = typeof imgObj === 'string' ? imgObj : (imgObj.url || imgObj.image_url?.url);
      }
    }

    if (!image) {
      return res.status(500).json({
        error: "Image generation failed - No image found in response",
        raw: result,
      });
    }

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