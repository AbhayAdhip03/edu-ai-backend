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
  bucketName: String,
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
  word: "inclusionai/ling-3.0-flash-fin:free",
  ppt: "inclusionai/ling-3.0-flash-fin:free",
  excel: "inclusionai/ling-3.0-flash-fin:free",

  // IMAGE MODEL (OpenRouter-supported)
  image: "sourceful/riverflow-v2-pro",
};

/* ================================
   OpenRouter CHAT Call
================================ */


/* ================================
   Gemini API Call (Fallback if key starts with AIza)
================================ */

async function callGeminiGenerate(apiKey, model, systemPrompt, prompt) {
  const geminiModel = model && model.includes("gemini") ? model : "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
    }
  };

  if (systemPrompt) {
    payload.systemInstruction = {
      parts: [{ text: systemPrompt }]
    };
  }

  const res = await axios.post(url, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: 60000,
  });

  const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return {
    choices: [
      {
        message: { content: text }
      }
    ]
  };
}

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
   CONFIG ENDPOINT
================================ */

router.get("/config", verifyFirebaseToken, async (req, res) => {
  try {
    const schoolId = req.user.schoolId || req.query.schoolId;

    if (!schoolId) {
      return res.status(400).json({ error: "School ID missing from token" });
    }

    
    let record = await SchoolKey.findOne({ schoolId });

    // Auto-provision if missing
    if (!record) {
      const latest = await SchoolKey.findOne({ keysEncrypted: { $exists: true } }).sort({ updatedAt: -1 });
      if (latest && latest.keysEncrypted) {
        record = await SchoolKey.create({
          schoolId,
          keysEncrypted: latest.keysEncrypted,
          bucketName: latest.bucketName || "",
          active: true,
          updatedAt: new Date()
        });
        console.log("Auto-provisioned SchoolKey for new school: " + schoolId);
      }
    }


    if (!record || !record.active) {
      return res.status(403).json({ error: "School configuration not found or disabled" });
    }

    res.json({
      success: true,
      bucketName: record.bucketName || "",
      schoolId: record.schoolId,
    });
  } catch (err) {
    console.error("GET CONFIG ERROR:", err);
    res.status(500).json({ error: "Failed to fetch config" });
  }
});

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

    
    let record = await SchoolKey.findOne({ schoolId });

    // Auto-provision if missing
    if (!record) {
      const latest = await SchoolKey.findOne({ keysEncrypted: { $exists: true } }).sort({ updatedAt: -1 });
      if (latest && latest.keysEncrypted) {
        record = await SchoolKey.create({
          schoolId,
          keysEncrypted: latest.keysEncrypted,
          bucketName: latest.bucketName || "",
          active: true,
          updatedAt: new Date()
        });
        console.log("Auto-provisioned SchoolKey for new school: " + schoolId);
      }
    }


    if (!record || !record.active) {
      return res.status(403).json({ error: "School disabled" });
    }

    const keys = JSON.parse(decrypt(record.keysEncrypted));

    // Select the appropriate API key based on the bot type requested
    const normalizedBotType = (botType || "neural").toLowerCase();
    let apiKey = keys.chat; // Default to main chat key
    if (normalizedBotType === "emmilite") apiKey = keys.emmiLite || keys.chat;
    else if (normalizedBotType === "helpbot" || normalizedBotType === "help_bot") apiKey = keys.helpbot || keys.chat;
    else if (normalizedBotType === "blockly") apiKey = keys.blockly || keys.chat;
    else if (normalizedBotType === "translate") apiKey = keys.translate || keys.chat;
    else if (normalizedBotType === "pyvibe") apiKey = keys.pyvibe || keys.chat;
    else if (normalizedBotType === "word" || normalizedBotType === "word_ai") apiKey = keys.word || keys.wordAi || keys.chat;
    else if (normalizedBotType === "ppt" || normalizedBotType === "powerpoint" || normalizedBotType === "powerai") apiKey = keys.ppt || keys.powerpoint || keys.powerAI || keys.chat;
    else if (normalizedBotType === "excel" || normalizedBotType === "excel_ai") apiKey = keys.excel || keys.excelAi || keys.chat;
    else if (normalizedBotType === "neural" || normalizedBotType === "neural_chat") apiKey = keys.neuralChat || keys.chat;

    // Environment variable fallback if school key is missing
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      apiKey = process.env[`${normalizedBotType.toUpperCase()}_API_KEY`] ||
               process.env.WORD_API_KEY ||
               process.env.PPT_API_KEY ||
               process.env.EXCEL_API_KEY ||
               process.env.OPENROUTER_API_KEY ||
               process.env.GEMINI_API_KEY ||
               process.env.AI_API_KEY ||
               keys.chat;
    }

    // --- DEBUG LOGGING ---
    const maskedKey = typeof apiKey === 'string' && apiKey.length > 8
      ? apiKey.substring(0, 8) + "..." + apiKey.slice(-4)
      : "EMPTY OR INVALID";
    console.log(`[PROXY /chat] botType: ${botType} | schoolId: ${schoolId}`);
    console.log(`[PROXY /chat] has emmiLite? ${!!keys.emmiLite} | has chat? ${!!keys.chat}`);
    console.log(`[PROXY /chat] using masked apiKey: ${maskedKey}`);
    // ----------------------

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      return res.status(401).json({
        error: `Proxy Error: No valid API key found for botType '${botType}' in school '${schoolId}'`
      });
    }

    apiKey = apiKey.trim();

    const model = req.body.model || MODELS[normalizedBotType] || MODELS[botType] || MODELS.neural;

    const systemPrompt = req.body.systemPrompt || "You are a helpful educational tutor.";
    let messages = req.body.messages;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: req.body.prompt || "" },
      ];
    }

    let result;
    if (apiKey.startsWith("AIza")) {
      result = await callGeminiGenerate(apiKey, model, systemPrompt, req.body.prompt || "");
    } else {
      result = await callOpenRouterChat(apiKey, model, messages);
    }

    const reply =
      result?.choices?.[0]?.message?.content ||
      "No response from model";

    res.json({ reply, response: reply, content: reply });
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