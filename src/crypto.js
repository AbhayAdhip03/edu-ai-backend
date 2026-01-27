const crypto = require("crypto");

const MASTER_KEY = process.env.MASTER_KEY; // 32 bytes base64 or hex

if (!MASTER_KEY) {
  throw new Error("MASTER_KEY not set in env");
}

const KEY = Buffer.from(MASTER_KEY, "hex"); // expect 64 hex chars

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag();

  return (
    iv.toString("hex") +
    ":" +
    tag.toString("hex") +
    ":" +
    encrypted
  );
}

function decrypt(payload) {
  const [ivHex, tagHex, dataHex] = payload.split(":");

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    KEY,
    Buffer.from(ivHex, "hex")
  );

  decipher.setAuthTag(Buffer.from(tagHex, "hex"));

  let decrypted = decipher.update(dataHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

module.exports = { encrypt, decrypt };
