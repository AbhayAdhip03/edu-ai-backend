const fs = require('fs');
const path = '/Users/abhayadhip/edu-ai-backend/src/routes/proxy.js';
let code = fs.readFileSync(path, 'utf8');

const autoProvision = `
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
`;

code = code.replace(
  'const record = await SchoolKey.findOne({ schoolId });',
  autoProvision
);

// Do it again for the second occurrence (like in /chat or /config if there are multiple)
code = code.replace(
  'const record = await SchoolKey.findOne({ schoolId });',
  autoProvision
);

fs.writeFileSync(path, code);
console.log('Patched proxy.js to auto-provision schools');
