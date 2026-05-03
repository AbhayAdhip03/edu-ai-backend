const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const { verifyAdminKey } = require("../auth");

/* ==========================================
   🎫 SUPPORT TICKETS — CREATE
   ========================================== */

router.post("/ticket", async (req, res) => {
  try {
    const { email, message, chatHistory, isHardwareComplaint, contactNumber } = req.body;

    if (!email || !message) {
      return res.status(400).json({ error: "Email and message are required" });
    }

    const ticketData = {
      email,
      message,
      contactNumber: contactNumber || "",
      chatHistory: chatHistory || "",
      isHardwareComplaint: isHardwareComplaint === true,
      replies: [], // Initialize empty replies array
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
   🎫 SUPPORT TICKETS — GET BY USER EMAIL
   ========================================== */

router.get("/tickets/user/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const snapshot = await admin.firestore().collection("support_tickets")
      .where("email", "==", email)
      .get();

    const tickets = [];
    snapshot.forEach((doc) => {
      tickets.push({ id: doc.id, ...doc.data() });
    });

    res.json(tickets);
  } catch (err) {
    console.error("SUPPORT TICKETS USER FETCH ERROR:", err);
    res.status(500).json({ error: "Failed to fetch user support tickets" });
  }
});

/* ==========================================
   🎫 SUPPORT TICKETS — UPDATE STATUS & RESPONSE (ADMIN)
   ========================================== */

router.patch("/tickets/:id", async (req, res, next) => {
  const { status, adminResponse, isHardwareComplaint, trackingLink, reply } = req.body;
  
  // Define what constitutes an admin-only action
  const isAdminAction = 
    status !== undefined || 
    adminResponse !== undefined || 
    isHardwareComplaint !== undefined || 
    trackingLink !== undefined || 
    (reply && reply.sender === "admin");

  if (isAdminAction) {
    return verifyAdminKey(req, res, next);
  }
  
  // If it's just a user reply, we allow it through
  next();
}, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminResponse, isHardwareComplaint, trackingLink, reply } = req.body;

    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (status) updateData.status = status;
    if (isHardwareComplaint !== undefined) updateData.isHardwareComplaint = isHardwareComplaint;
    if (trackingLink !== undefined) updateData.trackingLink = trackingLink;
    
    if (reply) {
      const replyData = typeof reply === 'string' 
        ? { message: reply, sender: 'admin', timestamp: new Date().toISOString() }
        : { ...reply, timestamp: new Date().toISOString() };
      
      updateData.replies = admin.firestore.FieldValue.arrayUnion(replyData);
      
      // Update status based on sender
      if (replyData.sender === 'admin') {
        updateData.status = "responded";
      } else {
        updateData.status = "open";
      }
    }

    if (adminResponse !== undefined) {
      updateData.adminResponse = adminResponse;
      updateData.respondedAt = admin.firestore.FieldValue.serverTimestamp();
      updateData.status = "resolved"; // Auto-resolve when responding
    }

    await admin.firestore().collection("support_tickets").doc(id).update(updateData);

    res.json({ success: true });
  } catch (err) {
    console.error("SUPPORT TICKET UPDATE ERROR:", err);
    res.status(500).json({ error: "Failed to update ticket status" });
  }
});

module.exports = router;
