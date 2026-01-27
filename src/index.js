require("dotenv").config();

const express = require("express");
const cors = require("cors");

const connectDB = require("./db");
const adminRoutes = require("./routes/admin");
const proxyRoutes = require("./routes/proxy");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/", (req, res) => {
  res.send("Edu AI Backend Running");
});

// routes
app.use("/admin", adminRoutes);
app.use("/proxy", proxyRoutes);

const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("DB connection failed:", err);
    process.exit(1);
  });
