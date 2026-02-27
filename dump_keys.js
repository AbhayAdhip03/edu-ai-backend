require("dotenv").config();
const mongoose = require("mongoose");
const { decrypt } = require("./src/crypto");

const SchoolKeySchema = new mongoose.Schema({
    schoolId: { type: String, unique: true },
    keysEncrypted: String,
    active: Boolean,
    updatedAt: Date,
});

const SchoolKey = mongoose.models.SchoolKey || mongoose.model("SchoolKey", SchoolKeySchema);

async function dumpAllKeys() {
    try {
        await mongoose.connect(process.env.MONGO_URI, { dbName: "edu_ai" });
        const records = await SchoolKey.find({});

        console.log(`Found ${records.length} school key records.`);

        records.forEach(record => {
            try {
                const keys = JSON.parse(decrypt(record.keysEncrypted));
                const chatKey = keys.chat || "";
                const emmiKey = keys.emmiLite || "";

                const maskedChat = chatKey.length > 10 ? chatKey.substring(0, 10) + "..." + chatKey.slice(-4) : "NONE/SHORT";
                const maskedEmmi = emmiKey.length > 10 ? emmiKey.substring(0, 10) + "..." + emmiKey.slice(-4) : "NONE/SHORT";

                console.log(`- School ID: ${record.schoolId} | Updated: ${record.updatedAt}`);
                console.log(`  chat: ${maskedChat} | emmiLite: ${maskedEmmi}`);
            } catch (e) {
                console.log(`- School ID: ${record.schoolId} | ERROR DECRYPTING KEY: ${e.message}`);
            }
        });

    } catch (err) {
        console.error("DB Error:", err);
    } finally {
        process.exit(0);
    }
}

dumpAllKeys();
