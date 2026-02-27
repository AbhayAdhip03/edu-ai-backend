require("dotenv").config();
const mongoose = require("mongoose");
const { decrypt } = require("./src/crypto");

const SchoolKeySchema = new mongoose.Schema({
    schoolId: { type: String, unique: true },
    keysEncrypted: String,
    active: Boolean,
    updatedAt: Date,
});

const SchoolKey = mongoose.model("SchoolKey", SchoolKeySchema);

async function checkKey(schoolId) {
    await mongoose.connect(process.env.MONGO_URI, { dbName: "edu_ai" });

    const record = await SchoolKey.findOne({ schoolId });
    if (!record) {
        console.log("No record found for school:", schoolId);
        process.exit(0);
    }

    const keys = JSON.parse(decrypt(record.keysEncrypted));
    console.log("Found Keys:", Object.keys(keys));

    if (keys.emmiLite) {
        console.log("emmiLite key length:", keys.emmiLite.length);
        console.log("emmiLite key valid prefix?", keys.emmiLite.startsWith('sk-or-v1-'));
        console.log("emmiLite first 12 chars:", keys.emmiLite.substring(0, 12));
        console.log("emmiLite last 4 chars:", keys.emmiLite.slice(-4));
    }
    if (keys.chat) {
        console.log("chat key length:", keys.chat.length);
        console.log("chat key valid prefix?", keys.chat.startsWith('sk-or-v1-'));
        console.log("chat first 12 chars:", keys.chat.substring(0, 12));
        console.log("chat last 4 chars:", keys.chat.slice(-4));
    }

    process.exit(0);
}

// User didn't give school ID, let's just dump the last updated school
async function checkLatest() {
    await mongoose.connect(process.env.MONGO_URI, { dbName: "edu_ai" });

    const record = await SchoolKey.findOne().sort({ updatedAt: -1 });
    if (!record) {
        console.log("No records found.");
        process.exit(0);
    }

    console.log("Latest School ID:", record.schoolId);
    const keys = JSON.parse(decrypt(record.keysEncrypted));
    console.log("Found Keys:", Object.keys(keys));

    if (keys.emmiLite) {
        console.log("emmiLite key length:", keys.emmiLite.length);
        console.log("emmiLite key valid format?", keys.emmiLite.startsWith('sk-or-v1-'));
        console.log("emmiLite first 12 chars:", keys.emmiLite.substring(0, 12));
        console.log("emmiLite last 4 chars:", keys.emmiLite.slice(-4));
    }
    if (keys.chat) {
        console.log("chat key length:", keys.chat.length);
        console.log("chat key valid format?", keys.chat.startsWith('sk-or-v1-'));
        console.log("chat first 12 chars:", keys.chat.substring(0, 12));
        console.log("chat last 4 chars:", keys.chat.slice(-4));
    }
    if (keys.neuralChat) {
        console.log("neuralChat key length:", keys.neuralChat.length);
        console.log("neuralChat key valid format?", keys.neuralChat.startsWith('sk-or-v1-'));
        console.log("neuralChat first 12 chars:", keys.neuralChat.substring(0, 12));
        console.log("neuralChat last 4 chars:", keys.neuralChat.slice(-4));
    }

    process.exit(0);
}

checkLatest();
