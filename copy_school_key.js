require("dotenv").config();
const mongoose = require("mongoose");
const SchoolKeySchema = new mongoose.Schema({
    schoolId: { type: String, unique: true },
    keysEncrypted: String,
    bucketName: String,
    active: Boolean,
    updatedAt: Date,
});
const SchoolKey = mongoose.model("SchoolKey", SchoolKeySchema);

async function copyLatestTo(targetSchoolId) {
    await mongoose.connect(process.env.MONGO_URI, { dbName: "edu_ai" });
    const latest = await SchoolKey.findOne().sort({ updatedAt: -1 });
    if (!latest) {
        console.log("No existing schools found to copy from.");
        process.exit(0);
    }
    
    let target = await SchoolKey.findOne({ schoolId: targetSchoolId });
    if (target) {
        target.keysEncrypted = latest.keysEncrypted;
        target.bucketName = latest.bucketName;
        target.active = true;
        target.updatedAt = new Date();
        await target.save();
        console.log("Updated existing school " + targetSchoolId + " with latest keys.");
    } else {
        await SchoolKey.create({
            schoolId: targetSchoolId,
            keysEncrypted: latest.keysEncrypted,
            bucketName: latest.bucketName,
            active: true,
            updatedAt: new Date(),
        });
        console.log("Created NEW school " + targetSchoolId + " with latest keys.");
    }
    process.exit(0);
}

copyLatestTo("8323");
