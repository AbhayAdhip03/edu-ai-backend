const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const { verifyAdminKey } = require("../auth");

/* ==========================================
   🎫 SUPPORT TICKETS — CREATE
   ========================================== */

router.post("/ticket", async (req, res) => {
  try {
    const { email, message, chatHistory } = req.body;

    if (!email || !message) {
      return res.status(400).json({ error: "Email and message are required" });
    }

    const ticketData = {
      email,
      message,
      chatHistory: chatHistory || "",
      status: "open",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await admin.firestore().collection("support_tickets").add(ticketData);

    res.json({
      success: true,
      ticketId: docRef.id,
    });
  } catch (err) {
    console.error("SUPPORT TICKET CREATION ERROR:", err);
    res.status(500).json({ error: "Failed to create support ticket" });
  }
});

/* ==========================================
   🎫 SUPPORT TICKETS — GET ALL (ADMIN)
   ========================================== */

router.get("/tickets", verifyAdminKey, async (req, res) => {
  try {
    const snapshot = await admin.firestore().collection("support_tickets")
      .orderBy("createdAt", "desc")
      .get();

    const tickets = [];
    snapshot.forEach((doc) => {
      tickets.push({ id: doc.id, ...doc.data() });
    });

    res.json(tickets);
  } catch (err) {
    console.error("SUPPORT TICKETS FETCH ERROR:", err);
    res.status(500).json({ error: "Failed to fetch support tickets" });
  }
});

/* ==========================================
   🎫 SUPPORT TICKETS — UPDATE STATUS (ADMIN)
   ========================================== */

router.patch("/tickets/:id", verifyAdminKey, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    await admin.firestore().collection("support_tickets").doc(id).update({
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true });
  } catch (err) {
    console.error("SUPPORT TICKET UPDATE ERROR:", err);
    res.status(500).json({ error: "Failed to update ticket status" });
  }
});

module.exports = router;
