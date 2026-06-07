const mongoose = require("mongoose");
mongoose.connect("mongodb+srv://edu_backend:pcfIWyj7pi8zXkpO@cluster0.pvjkxuc.mongodb.net/?appName=Cluster0");
const SchoolKeySchema = new mongoose.Schema({ schoolId: String, bucketName: String, keysEncrypted: String });
const SchoolKey = mongoose.model("SchoolKey", SchoolKeySchema);

async function check() {
  const all = await SchoolKey.find({});
  console.log("Total records:", all.length);
  for (const doc of all) {
    if (doc.bucketName === "abcgfe" || !doc.bucketName) {
      console.log(doc.schoolId, "=>", doc.bucketName);
    }
  }
  mongoose.connection.close();
}
check();
