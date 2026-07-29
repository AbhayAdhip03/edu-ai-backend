require("dotenv").config();
const mongoose = require("mongoose");
const SchoolKeySchema = new mongoose.Schema({
    schoolId: { type: String, unique: true },
    active: Boolean,
});
const SchoolKey = mongoose.model("SchoolKey", SchoolKeySchema);

async function enableSchool(schoolId) {
    await mongoose.connect(process.env.MONGO_URI, { dbName: "edu_ai" });
    const record = await SchoolKey.findOne({ schoolId });
    if (!record) {
        console.log("No record found for school: " + schoolId);
    } else {
        record.active = true;
        await record.save();
        console.log("School " + schoolId + " is now ENABLED.");
    }
    process.exit(0);
}

enableSchool("8323");
