const admin = require("firebase-admin");

// Firebase service account JSON will be injected via env
const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, "base64").toString("utf8")
);

if (!serviceAccount) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT not set");
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

/* ======================================================
   🔐 FIREBASE TOKEN CHECK (students / teachers / apps)
====================================================== */

async function verifyFirebaseToken(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }

  const token = header.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Token verification failed", err);

    return res.status(401).json({
      error: "Invalid or expired token",
    });
  }
}

/* ======================================================
   🔑 ADMIN MASTER KEY CHECK (super-admin dashboard)
====================================================== */

function verifyAdminKey(req, res, next) {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey || apiKey !== process.env.ADMIN_MASTER_KEY) {
    return res.status(401).json({ error: "Unauthorized admin" });
  }

  next();
}

/* ====================================================== */

module.exports = {
  verifyFirebaseToken,
  verifyAdminKey,
};
