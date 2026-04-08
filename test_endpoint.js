require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");

// Initialize MongoDB Schema to exactly match proxy.js
const SchoolKeySchema = new mongoose.Schema({
  schoolId: { type: String, unique: true },
  keysEncrypted: String,
  bucketName: String,
  active: Boolean,
});
const SchoolKey = mongoose.models.SchoolKey || mongoose.model("SchoolKey", SchoolKeySchema);

async function testFetchRequest() {
  const mockUid = "XMq0Nr1ewAPvPuQ1A8lKwh3kebA2";
  const mockSchoolId = "3991";

  // Connect to DB just like src/index.js
  await mongoose.connect(process.env.MONGO_URI, { dbName: "edu_ai" });

  // Stand up a mini Express app to test our endpoint
  const app = express();
  
  // We mock the Firebase verification middleware properly
  const auth = require("./src/auth");
  auth.verifyFirebaseToken = (req, res, next) => {
    req.user = { uid: mockUid };
    next();
  };

  // Load the proxy routes (which now has our fix for req.query.schoolId!)
  const proxyRoutes = require("./src/routes/proxy");
  app.use("/proxy", proxyRoutes);

  // Start server on a random test port
  const server = app.listen(0, async () => {
    const port = server.address().port;
    const testUrl = `http://localhost:${port}/proxy/config?schoolId=${mockSchoolId}`;
    
    console.log(`\n==============================================`);
    console.log(`🧪 SIMULATING FETCH REQUEST`);
    console.log(`==============================================`);
    console.log(`URL   : GET ${testUrl}`);
    console.log(`TOKEN : Bearer <MOCK_FIREBASE_TOKEN_FOR_${mockUid}>`);
    
    // Perform the fetch request
    try {
        const response = await fetch(testUrl, {
            headers: {
                "Authorization": "Bearer MOCK_TOKEN"
            }
        });
        
        const status = response.status;
        const data = await response.json();
        
        console.log(`\n✅ SERVER RESPONSE (Status ${status}):`);
        console.log(JSON.stringify(data, null, 2));

        if (status === 200) {
            console.log(`\n🎉 EXTRACTION SUCCESS:`);
            console.log(`const bucketName = \x1b[32m"${data.bucketName}"\x1b[0m;`);
        } else {
            console.log(`\n❌ REQUEST FAILED!`);
        }

    } catch (err) {
        console.error("Fetch request failed:", err);
    } finally {
        server.close();
        process.exit(0);
    }
  });
}

testFetchRequest();
